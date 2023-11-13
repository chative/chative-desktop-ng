import React, { useEffect, useState } from 'react';
import { LocalizerType } from '../../types/Util';
import timestampToLocal from './_taskUtil';
import { Avatar } from '../Avatar';
import { TaskDialog } from '../task/TaskDialog';
import classNames from 'classnames';

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
  status: number;
  message?: CardMessageType;
  version: number;
  updater?: string;
  updateTime?: number;
  ext?: any;
}

interface PropsType {
  i18n: LocalizerType;
  task: TaskType;
  ourNumber: string;
  conversationId?: string;
}

export default function EmbeddedTask(props: PropsType) {
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
    let color = 'rgb(11, 132, 255)';
    let taskStatus = i18n('task_ing');
    if (status === 11) {
      color = 'rgb(255,79,121)';
      taskStatus = i18n('task_rejected');
    }
    if (status === 12) {
      color = 'rgb(49,209,91)';
      taskStatus = i18n('task_done');
    }

    if (status === 13) {
      color = 'rgb(114,126,135)';
      taskStatus = i18n('task_canceled');
    }

    return (
      <div className={'task-message-name'}>
        <span className={'priority' + (priority - 1)} />
        <span style={{ color, paddingRight: '5px', display: 'inline-block' }}>
          {'[' + taskStatus + ']'}
        </span>
        {name}
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
    if (status === 1 && dueTime) {
      return (
        <div style={{ margin: '5px 0' }}>
          <span className={'calendar-icon'} />
          <span
            style={{
              verticalAlign: 'middle',
              fontSize: '13px',
              color: outDate ? 'rgb(255,79,121)' : 'inherit',
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

  const renderButton = () => {
    return (
      <button
        className={classNames('task-message__button-view-details')}
        onClick={() => {
          setShowTaskDialog(true);
        }}
      >
        {i18n('task_view_details')}
      </button>
    );
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
    <div className={'task-message-block'}>
      <div className={'task-message-title'}>
        <span className={'task-icon'} />
        {i18n('task')}
      </div>
      <div style={{ padding: '5px 10px' }}>
        {renderName()}
        {renderAssignees()}
        {renderDueTime()}
        {renderButton()}
        {renderTaskDialog()}
      </div>
    </div>
  );
}
