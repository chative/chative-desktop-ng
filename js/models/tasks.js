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

    // async fakeTaskBotMessage(notifyTime, task, taskUpdate) {
    //   if (notifyTime || task || taskUpdate) {
    //     return;
    //   }

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
            return;
          }
        }
      } catch (e) {
        return;
      }
      window.storage.put('fetch_task_list', 'done');
    },

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

      if (localTask) {
        await window.Signal.Data.setLightTaskExt(taskId, {
          // ...localTask.ext,
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

      if (!latestTask) {
        window.log.info('background shouldFetchLatestTask bad network!');
        return;
      }

      if (latestTask.deleted || latestTask.archived) {
        window.log.info('background shouldFetchLatestTask delete or archived.');
        await window.Whisper.Task.deleteTaskLinkedMessages(taskId);
        await window.Signal.Data.deleteLightTask(taskId);
        return;
      }

      const isChangeByMySelf =
        textsecure?.storage?.user?.getNumber() === latestTask.updater;

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

        await window.Signal.Data.createOrUpdateLightTask({
          ...latestTask,
          taskId,
          timestamp: latestTask.createTime || 1,
          roles: assigneesRole,
        });
        await window.Whisper.Task.updateTaskLinkedMessages({
          ...latestTask,
          taskId,
          timestamp: latestTask.createTime,
          assignees,
          // message: localTask?.message,
          selfOperator: notSetUnread ? 1 : isChangeByMySelf ? 1 : 0,
        });
      }

      await window.Signal.Data.setLightTaskExt(taskId, {
        // ...localTask?.ext,
        fetchFailed: false,
      });

      if (!notifyTime) {
        return;
      }

      if (latestTask.status !== 1) {
        return;
      }

      if (!latestTask.dueTime) {
        return;
      }

      const now = Date.now();
      if (latestTask.dueTime - notifyTime > 35 * 60 * 1000) {
        return;
      }

      const leftMin = Math.floor((latestTask.dueTime - now) / (60 * 1000));
      if (leftMin < 5 || leftMin > 30) {
        return;
      }

      new Notification(i18n('task_due_time_left', [leftMin]), {
        body: latestTask.name,
      });
    },
  };
})();
