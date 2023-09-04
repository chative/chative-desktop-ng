/*
  _,
  log,
  Backbone,
  Whisper,
  MessageController,
*/

// eslint-disable-next-line func-names
(function () {
  window.Whisper = window.Whisper || {};

  const {
    saveMessage,
    removeMessage,
    getMessageById,
    getLinkedMessages,
    delLinkedMessages,
    updateTaskReadAtVersion,
  } = window.Signal.Data;

  const WhisperMessage = { Message: Whisper.Message };

  window.Whisper.Task = {
    async findMessage(messageId) {
      let found = MessageController.getById(messageId);
      if (!found) {
        const fetched = await getMessageById(messageId, WhisperMessage);

        if (fetched) {
          found = MessageController.register(fetched.id, fetched);
        } else {
          window.log.error('message not found in database for ', messageId);
        }
      }

      return found;
    },

    async updateTaskLinkedMessages(task) {
      // notify task list pane
      const ev = new CustomEvent('task-pane-update', { detail: task });
      window.dispatchEvent(ev);

      const { taskId } = task;
      if (!taskId) {
        window.log.error('invalid taskId.');
        return;
      }

      const messageIds = await getLinkedMessages(task.taskId);
      if (messageIds && messageIds.length > 0) {
        for (let i = 0; i < messageIds.length; i += 1) {
          const { messageId } = messageIds[i];
          // eslint-disable-next-line no-await-in-loop
          const message = await this.findMessage(messageId);
          if (message) {
            const existTask = message.get('task') || {};
            message.set({
              task: {
                ...existTask,
                ...task,
              },
            });

            // eslint-disable-next-line no-await-in-loop
            await saveMessage(message.attributes, WhisperMessage);
          }
        }
      }
    },
    async deleteTaskLinkedMessages(taskId) {
      // notify task list pane
      const ev = new CustomEvent('task-pane-update', {
        detail: { taskId, deleted: true },
      });
      window.dispatchEvent(ev);

      const messageIds = await getLinkedMessages(taskId);
      if (messageIds && messageIds.length > 0) {
        for (let i = 0; i < messageIds.length; i += 1) {
          const { messageId } = messageIds[i];
          // eslint-disable-next-line no-await-in-loop
          const message = await this.findMessage(messageId);
          if (message) {
            // eslint-disable-next-line no-await-in-loop
            await removeMessage(message.id, WhisperMessage);

            // using 'destroy' will unload all related views
            message.trigger('destroy');

            const conversation = message.getConversation();
            if (conversation) {
              conversation.messageCollection.remove(message.id);
            }
          }
        }
        await delLinkedMessages(taskId);
      }
    },

    /*
      0. 该任务已变更
      1. xxx给你创建了任务
      2. xxx完成了任务
      3. xxx拒绝了任务
      4. xxx将你添加为执行者
      5. xxx将你从执行者中移除
      6. xxx变更了任务截止时间
    */
    // async fakeTaskBotMessage(notifyTime, task, taskUpdate) {
    //   // TaskBot 先不上啦，以后再说
    //   if (notifyTime || task || taskUpdate) {
    //     return;
    //   }
    //   // TaskBot 先不上啦，以后再说

    //   const taskBotId = '+10006';

    //   const message = new Whisper.Message({
    //     source: taskBotId,
    //     sourceDevice: 1,
    //     sent_at: notifyTime,
    //     received_at: Date.now(),
    //     conversationId: taskBotId,
    //     type: 'incoming',
    //     unread: 1,
    //     task: {
    //       ...task,
    //     },
    //     taskUpdate: {
    //       ...taskUpdate,
    //     },
    //   });

    //   const id = await saveMessage(message.attributes, WhisperMessage);
    //   message.set({id});
    //   MessageController.register(message.id, message);

    //   // link task <-> message
    //   await linkTaskMessage(task.taskId, id);

    //   const conversation =
    //     await ConversationController.getOrCreateAndWait(taskBotId, 'private');

    //   conversation.set({
    //     active_at: Date.now(),
    //     unreadCount: conversation.get('unreadCount') + 1,
    //   });

    //   conversation.trigger('newmessage', message);
    // },

    async markAsReadAll(taskReads, shouldSync) {
      const now = Date.now();

      if (taskReads instanceof Array) {
        const promises = [];
        const reads = [];

        // update database
        for (let taskRead of taskReads) {
          const { taskId, version, timestamp = now } = taskRead;
          promises.push(updateTaskReadAtVersion(taskId, timestamp, version));
          reads.push({ taskId, version, timestamp });
        }

        log.info('marking as read:', reads);

        await Promise.all(promises);

        // send task read sync
        if (shouldSync) {
          try {
            const globalConfig = window.getGlobalConfig();

            const { tunnelSecurityEnds, tunnelSecurityForced = true } =
              globalConfig?.message || {};

            const extension = {
              tunnelSecurityEnds: tunnelSecurityEnds || [],
              tunnelSecurityForced,
            };

            await textsecure.messaging.syncTaskRead(reads, extension);
          } catch (error) {
            log.error('sync task read message failed for', reads, error);
          }
        }
      }
    },

    async markAsRead(taskId, version, shouldSync = true) {
      await this.markAsReadAll([{ taskId, version }], shouldSync);
    },

    async fetchAllTasks(forceRead = true) {
      const done = window.storage.get('fetch_task_list');
      if (done === 'done') {
        return;
      }

      try {
        const pageSize = 100;
        let pageNum = 1;
        while (true) {
          if (!window.textsecure.messaging) {
            return;
          }

          // eslint-disable-next-line no-await-in-loop
          const tasks = await window.textsecure.messaging.getTaskList(
            pageNum,
            pageSize
          );
          pageNum += 1;
          if (tasks && tasks.rows) {
            for (let i = 0; i < tasks.rows.length; i += 1) {
              const latestTask = tasks.rows[i];
              // 任务已删除 (好像这种类型任务不会返回)
              if (latestTask.deleted || latestTask.archived) {
                continue;
              }

              // eslint-disable-next-line no-await-in-loop
              const localTask = await window.Signal.Data.getLightTask(
                latestTask.tid
              );
              if (localTask) {
                if (latestTask.version <= localTask.version) {
                  continue;
                }
              }

              // 强制更新task (本地没有数据，或者跨版本的情况)
              const assignees = [];
              const assigneesLocal = [];
              if (latestTask.users && latestTask.users.length) {
                for (
                  let index = 0;
                  index < latestTask.users.length;
                  index += 1
                ) {
                  if (latestTask.users[index].role === 2) {
                    assignees.push(latestTask.users[index]);
                    assigneesLocal.push(latestTask.users[index].uid);
                  }
                }
              }
              await window.Signal.Data.createOrUpdateLightTask({
                ...latestTask,
                taskId: latestTask.tid,
                timestamp: latestTask.createTime,
                roles: assignees,
              });

              if (forceRead) {
                await this.markAsRead(
                  latestTask.tid,
                  latestTask.version,
                  false
                );
              }

              await window.Whisper.Task.updateTaskLinkedMessages({
                ...latestTask,
                taskId: latestTask.tid,
                timestamp: latestTask.createTime,
                // message: localTask?.message,
                assignees: assigneesLocal,
                selfOperator: forceRead ? 1 : 0,
              });
            }
            if (
              tasks.rows.length < pageSize ||
              tasks.total === (pageNum - 1) * pageSize
            ) {
              break;
            }
          } else {
            // 出错了
            return;
          }
        }
      } catch (e) {
        return;
      }
      window.storage.put('fetch_task_list', 'done');
    },

    // notifyTime 有值表示需要提醒，默认不需要提醒
    // notSetUnread 有值表示不需要设置未读，默认需要设置未读
    async shouldFetchLatestTask(taskId, options) {
      if (!taskId) {
        window.log.info('shouldFetchLatestTask bad taskId.');
        return;
      }
      const { notifyTime, notSetUnread } = options || {};

      window.log.info(
        'shouldFetchLatestTask taskId:' +
          taskId +
          ' notifyTime:' +
          notifyTime +
          ' notSetUnread:' +
          notSetUnread
      );
      const localTask = await window.Signal.Data.getLightTask(taskId);

      // 设置获取任务状态失败
      if (localTask) {
        await window.Signal.Data.setLightTaskExt(taskId, {
          // ...localTask.ext,  先屏蔽掉，这个字段目前是字符串不可以直接展开
          fetchFailed: true,
        });
      }

      if (!textsecure || !textsecure.messaging) {
        window.log.info('shouldFetchLatestTask offline, Bad network!');
        return;
      }

      let latestTask;
      try {
        latestTask = await textsecure.messaging.getLightTask(taskId);
      } catch (e) {}

      // 网络请求失败了
      if (!latestTask) {
        window.log.info('background shouldFetchLatestTask bad network!');
        return;
      }

      // 任务已删除或归档
      if (latestTask.deleted || latestTask.archived) {
        window.log.info('background shouldFetchLatestTask delete or archived.');
        // 删除任务，更新界面展示
        await window.Whisper.Task.deleteTaskLinkedMessages(taskId);
        await window.Signal.Data.deleteLightTask(taskId);
        return;
      }

      const isChangeByMySelf =
        textsecure?.storage?.user?.getNumber() === latestTask.updater;

      // 本地版本需要更新
      if (!localTask || localTask.version < latestTask.version) {
        const assignees = []; // [id1, id2...]
        const assigneesRole = []; // [{id:xxx, role:2},{}...]
        if (latestTask.users && latestTask.users.length) {
          for (let index = 0; index < latestTask.users.length; index += 1) {
            assigneesRole.push(latestTask.users[index]);
            if (latestTask.users[index].role === 2) {
              assignees.push(latestTask.users[index].uid);
            }
          }
        }

        // 强制更新task
        await window.Signal.Data.createOrUpdateLightTask({
          ...latestTask,
          taskId,
          timestamp: latestTask.createTime || 1,
          roles: assigneesRole,
        });
        // 界面更新
        await window.Whisper.Task.updateTaskLinkedMessages({
          ...latestTask,
          taskId,
          timestamp: latestTask.createTime,
          assignees,
          // message: localTask?.message,
          selfOperator: notSetUnread ? 1 : isChangeByMySelf ? 1 : 0,
        });
      }

      // 取消设置获取任务状态失败
      await window.Signal.Data.setLightTaskExt(taskId, {
        // ...localTask?.ext,  先屏蔽掉，这个字段是字符串不可以直接展开
        fetchFailed: false,
      });

      // 以下是任务提醒相关逻辑
      if (!notifyTime) {
        return;
      }

      // 任务已结束, 不要再通知了
      if (latestTask.status !== 1) {
        return;
      }

      // 此任务没有截止时间了
      if (!latestTask.dueTime) {
        return;
      }

      const now = Date.now();
      // 截止时间延后了的情况，属于过期通知
      if (latestTask.dueTime - notifyTime > 35 * 60 * 1000) {
        return;
      }

      const leftMin = Math.floor((latestTask.dueTime - now) / (60 * 1000));
      // 当前时间不在提醒范围内
      if (leftMin < 5 || leftMin > 30) {
        return;
      }

      // 可以提醒啦
      new Notification(i18n('task_due_time_left', [leftMin]), {
        body: latestTask.name,
      });
    },
  };
})();
