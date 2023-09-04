import React, { useEffect, useState } from 'react';
import { LocalizerType } from '../../types/Util';
import timestampToLocal from '../conversation/_taskUtil';
import { Avatar } from '../Avatar';
import { TaskDialog } from '../task/TaskDialog';

export interface TaskAvatarType {
  id: string;
  name?: string;
  avatarPath?: string;
}

export interface CardMessageType {
  conversationId: string;
  source: string;
  sourceDevice: number;
  timestamp: number;
}

export interface TaskType {
  taskId: string;
  creator: string;
  name: string;
  assignees: Array<TaskAvatarType>;
  priority: number;
  dueTime: number;
  timestamp: number;
  status: number; // 1-处理中 11-拒绝，12-完成，13-已取消
  message?: CardMessageType;
  version: number;
  readAtVersion: number;
  updateTime: number;
}

interface PropsType {
  i18n: LocalizerType;
  task: TaskType;
  ourNumber: string;
  conversationId?: string;
}

export default function TaskItem(props: PropsType) {
  const { i18n, task, ourNumber, conversationId } = props;
  const { assignees, name, dueTime, updateTime, status, priority } = task;

  const [outDate, setOutDate] = useState(status === 1 && dueTime < Date.now());
  const [showTaskDialog, setShowTaskDialog] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    setOutDate(status === 1 && dueTime < Date.now());
    if (dueTime && status === 1) {
      timer = setInterval(() => {
        setOutDate(status === 1 && dueTime < Date.now());
      }, 60 * 1000);
    }

    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [dueTime, status]);

  const renderName = () => {
    // 处理中
    let color = 'rgb(11, 132, 255)';
    let taskStatus = i18n('task_ing');
    // 已拒绝
    if (status === 11) {
      color = 'rgb(255,79,121)';
      taskStatus = i18n('task_rejected');
    }
    // 已完成
    if (status === 12) {
      color = 'rgb(49,209,91)';
      taskStatus = i18n('task_done');
    }
    // 已取消
    if (status === 13) {
      color = 'rgb(128,128,128)';
      taskStatus = i18n('task_canceled');
    }

    // red point
    const showRedPoint =
      !task.readAtVersion || task.version > task.readAtVersion;

    return (
      <div className={'task-message-name'}>
        <span className={'priority' + (priority - 1)} />
        <span style={{ color, paddingRight: '5px', display: 'inline-block' }}>
          {'[' + taskStatus + ']'}
        </span>
        {name}
        {(status >= 11 && status <= 13) || showRedPoint ? (
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              display: 'inline-block',
            }}
          >
            {status >= 11 && status <= 13 ? (
              <span
                className={'remove'}
                onClick={async (event: React.MouseEvent<HTMLSpanElement>) => {
                  event.stopPropagation();

                  // notify delete task
                  const ev = new CustomEvent('task-pane-update', {
                    detail: { ...task, assignees: [], deleted: true },
                  });
                  window.dispatchEvent(ev);
                  await (window as any).Signal.Data.deleteLocalTask(
                    task.taskId
                  );
                }}
              />
            ) : null}
            {showRedPoint ? (
              <span
                style={{
                  width: 10,
                  height: 10,
                  backgroundColor: '#f84135',
                  borderRadius: '50%',
                  display: 'inline-block',
                }}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  const renderAssigneesAvatars = () => {
    const avatars = [];
    for (let i = 0; i < assignees.length && i < 3; i += 1) {
      const avatarItem: TaskAvatarType = assignees[i];
      avatars.push(
        <div
          key={i}
          style={{
            display: 'inline-block',
            marginRight: '5px',
          }}
        >
          <Avatar
            i18n={i18n}
            size={28}
            conversationType={'direct'}
            id={avatarItem.id}
            name={avatarItem.name}
            avatarPath={avatarItem.avatarPath}
            noteToSelf={false}
          />
        </div>
      );
    }

    return (
      <>
        {avatars}
        {assignees.length > 1 ? (
          <span style={{ fontSize: '12px' }}>
            {assignees.length + ' ' + i18n('task_assignees')}
          </span>
        ) : null}
        {assignees.length === 1 ? (
          <span style={{ fontSize: '12px' }}>
            {assignees[0].name || assignees[0].id}
          </span>
        ) : null}
      </>
    );
  };

  const renderAssignees = () => {
    if (assignees && assignees.length) {
      return (
        <div style={{ margin: '8px 0' }}>
          <span className={'assignee-icon'} />
          <div className={'assignee-container'}>{renderAssigneesAvatars()}</div>
        </div>
      );
    }
    return null;
  };

  const renderDueTime = () => {
    // 进行中
    if (status === 1 && dueTime) {
      return (
        <div style={{ margin: '5px 0' }}>
          <span className={'calendar-icon'} />
          <span
            style={{
              verticalAlign: 'middle',
              fontSize: '13px',
              color: outDate ? '#f84135' : 'inherit',
            }}
          >
            {i18n('task_due_on') +
              ' ' +
              timestampToLocal(dueTime, i18n('lang') === 'zh-CN')}
          </span>
        </div>
      );
    }

    let text;
    if (status === 11) {
      text = i18n('task_rejected_on');
    }
    if (status === 12) {
      text = i18n('task_completed_on');
    }
    if (status === 13) {
      text = i18n('task_canceled_on');
    }

    if (text && updateTime) {
      return (
        <div style={{ margin: '5px 0' }}>
          <span className={'calendar-icon'} />
          <span
            style={{
              verticalAlign: 'middle',
              fontSize: '13px',
            }}
          >
            {text +
              ' ' +
              timestampToLocal(updateTime, i18n('lang') === 'zh-CN')}
          </span>
        </div>
      );
    }
    return null;
  };

  const closeTaskDialog = () => {
    setShowTaskDialog(false);
  };

  const renderTaskDialog = () => {
    if (!showTaskDialog) {
      return null;
    }

    return (
      <TaskDialog
        i18n={i18n}
        task={task}
        ourNumber={ourNumber}
        conversationId={conversationId}
        name={name}
        onCancel={closeTaskDialog}
      />
    );
  };

  return (
    <div
      className={'for-task-item task-message-block'}
      style={{ width: '100%', cursor: 'pointer' }}
      onClick={() => {
        setShowTaskDialog(true);
      }}
    >
      {renderName()}
      {renderAssignees()}
      {renderDueTime()}
      {renderTaskDialog()}
    </div>
  );
}
