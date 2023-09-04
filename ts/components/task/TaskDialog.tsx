import React from 'react';
import { LocalizerType } from '../../types/Util';
import SelectContactSmaller from '../SelectContactSmaller';
import PriorityItem from './PriorityItem';
import { ConversationType } from '../../state/ducks/conversations';
import { Avatar } from '../Avatar';
import DateTimeItem from './DateTimeItem';
import moment from 'moment';
import { TaskType } from '../conversation/EmbeddedTask';
import timestampToLocal from '../conversation/_taskUtil';
import { trigger } from '../../shims/events';
import { MenuItem, ContextMenu, ContextMenuTrigger } from 'react-contextmenu';
import { v4 as uuidv4 } from 'uuid';
import classNames from 'classnames';
import Dialog from '../Dialog';

const MAX_TASK_NAME_LENGTH = 2000;

// 类型 1新建；2恢复(X)；3修改多项目(X)；4修改名称；5修改等级；6修改到期时间；
// 7修改描述(x)；8；修改执行人；11拒绝；12完成；13取消；99删除(x)
// "businessType": 1,
// "businessId": "081df166-2cd0-409a-88ed-be9df1cbd2d7", //任务ID
// "operUser": "+758",  // 操作人
// "oldValue": "1",     // 原值
// "newValue": "2",      // 新值
// "operTime": 1758847929838 // 操作时间
const LOG_TEMPLATES: { [index: string]: string } = {
  '1': 'someoneCreatedATask',
  '4': 'someoneChangedTaskName',
  '5': 'someoneChangedTaskPriority',
  '6': 'someoneChangedTaskDueTime',
  '8': 'someoneChangedTaskAssignees',
  '11': 'someoneRejectedTask',
  '12': 'someoneCompletedTask',
  '13': 'someoneCancelledTask',
};

interface updateTaskType {
  tid?: string;
  name?: string;
  priority?: number;
  status?: number;
  users?: any;
  dueTime?: number;
}

interface Props {
  task?: TaskType; // 存在此参数，表示是编辑模式

  i18n: LocalizerType;
  conversationId?: string;
  name?: string;
  onCancel: () => void;
  ourNumber: string;
  atPersons?: string;
}

interface State {
  name: string;
  lastCommitName: string;
  showSelectContactSmaller: boolean;
  x: number;
  y: number;
  priority: number; // 1-P0, 2-P1, 3-P2
  members: Array<ConversationType>;
  selectedMembers: Array<ConversationType>;
  dueTime: number;
  showBell: boolean;
  operationLoading: boolean;
  changeRecords: Array<string>;
  showLogs: boolean;
  maxAssigneeCount: number;
  memberRapidRole: any;
}

interface Trigger {
  handleContextClick: (event: React.MouseEvent<HTMLDivElement>) => void;
}

export class TaskDialog extends React.Component<Props, State> {
  public textareaRef: React.RefObject<HTMLTextAreaElement>;
  public btnExecutorRef: React.RefObject<HTMLButtonElement>;
  public btnExecutorSpanRef: React.RefObject<HTMLSpanElement>;

  public captureMenuTriggerBound: (trigger: any) => void;
  public showMenuBound: (event: React.MouseEvent<HTMLDivElement>) => void;

  public menuTriggerRef: Trigger | undefined;

  constructor(props: Readonly<Props>) {
    super(props);

    this.captureMenuTriggerBound = this.captureMenuTrigger.bind(this);
    this.showMenuBound = this.showMenu.bind(this);

    this.textareaRef = React.createRef();
    this.btnExecutorRef = React.createRef();
    this.btnExecutorSpanRef = React.createRef();

    const dueTime = props?.task?.dueTime || 0;
    // 30分钟内，不显示小铃铛
    let showBell = false;
    if (dueTime) {
      showBell = dueTime - Date.now() >= 30 * 60 * 1000;
    }

    let name = props.name || '';
    if (name.length > MAX_TASK_NAME_LENGTH) {
      name = name.substr(0, MAX_TASK_NAME_LENGTH);
    }

    const { conversationId, ourNumber, task } = props;

    // true       try to fullload and success
    // false      try to fullload but failed
    // undefined  no full load
    const { ext } = task || {};
    const { fetchFailed } = ext || {};

    const localState: State = {
      name,
      lastCommitName: name,
      showSelectContactSmaller: false,
      x: 0,
      y: 0,
      priority: props.task?.priority || 3,
      members: [],
      selectedMembers: [],
      dueTime,
      showBell,
      operationLoading: !!fetchFailed,
      changeRecords: [],
      showLogs: false,
      maxAssigneeCount: 0,
      memberRapidRole: {},
    };

    // 先将所有 Assignees 加入到 selectedMembers 里
    if (task && task.assignees) {
      for (let i = 0; i < task.assignees.length; i += 1) {
        const conversation = this.getConversationProps(task.assignees[i].id);
        if (conversation) {
          localState.selectedMembers.push(conversation);
        }
      }
    }

    if (conversationId) {
      const conversation = this.getConversationProps(conversationId);
      if (conversation) {
        // 创建任务时，添加自己为执行人
        if (this.createMode()) {
          const me = this.getConversationProps(ourNumber);
          localState.selectedMembers.push(me);
        }

        if (conversation.type === 'group') {
          // 获取群成员列表
          const c = (window as any).ConversationController.get(
            props.conversationId
          );
          const ids = c?.get('members');
          if (ids) {
            for (let i = 0; i < ids.length; i += 1) {
              const groupMember = this.getConversationProps(ids[i]);
              const beInSelected = this.isInSelectedMembers(
                localState.selectedMembers,
                groupMember.id
              );
              if (beInSelected) {
                continue;
              }
              if (this.isInAssigneesList(groupMember.id)) {
                localState.selectedMembers.push(groupMember);
                continue;
              }
              localState.members.push(groupMember);
            }
          }
        } else {
          // 1v1 场景
          // 添加对方为执行人
          if (
            this.createMode() &&
            !this.isInSelectedMembers(
              localState.selectedMembers,
              conversation.id
            )
          ) {
            localState.selectedMembers.push(conversation);
          }
        }
      }
    }

    const globalConfig = (window as any).getGlobalConfig();
    const maxAssigneeCount = globalConfig?.task?.maxAssigneeCount;
    if (maxAssigneeCount) {
      localState.maxAssigneeCount = maxAssigneeCount;

      if (
        this.createMode() &&
        localState.selectedMembers.length > maxAssigneeCount
      ) {
        localState.members.push(...localState.selectedMembers);
        localState.selectedMembers = [];
      }
    }

    if (task && fetchFailed) {
      setTimeout(async () => {
        try {
          // full load
          await (window as any).Whisper.Task.shouldFetchLatestTask(
            task.taskId,
            { notSetUnread: true }
          );
        } catch (error) {
          console.log('full load failed:', error);
        }

        this.setState({ operationLoading: false });
      }, 1);
    }

    this.state = localState;
  }

  public isInSelectedMembers(members: Array<ConversationType>, id: string) {
    for (let i = 0; i < members.length; i += 1) {
      if (id === members[i].id) {
        return true;
      }
    }
    return false;
  }

  public getConversation(id: string | undefined) {
    if (!id) {
      console.log('conversation not found for:', id);
      return null;
    }
    return (window as any).ConversationController.get(id);
  }

  public getConversationProps(id: string) {
    const c = this.getConversation(id);
    if (c) {
      return {
        ...c.format(),
        isMe: false,
      };
    } else {
      return {
        id,
        name: id,
        isArchived: false,
        timestamp: 0,
        phoneNumber: id,
        type: 'direct',
        isMe: false,
        lastUpdated: 0,
        unreadCount: 0,
        isSelected: false,
        isTyping: false,
      };
    }
  }

  public isInAssigneesList = (id: string) => {
    const { task, atPersons, conversationId } = this.props;

    if (this.createMode()) {
      // at all OR include the id
      if (
        atPersons &&
        (atPersons.includes('MENTIONS_ALL') || atPersons.includes(id))
      ) {
        return true;
      }

      if (id && id === conversationId) {
        return true;
      }
    }

    if (task && task.assignees) {
      for (let i = 0; i < task.assignees.length; i += 1) {
        if (id === task.assignees[i].id) {
          return true;
        }
      }
    }
    return false;
  };

  public closeTaskDialogCallback = () => {
    this.props.onCancel();
  };
  public componentDidMount() {
    window.addEventListener('close-task-dialog', this.closeTaskDialogCallback);

    // set as read
    const { task } = this.props;
    if (task) {
      const detail = { updateReadVersion: task.version, taskId: task.taskId };
      const ev = new CustomEvent('task-pane-update', { detail });
      window.dispatchEvent(ev);
    }

    setTimeout(() => {
      if (this.textareaRef.current) {
        (window as any).autosize(this.textareaRef.current);
        this.textareaRef.current?.focus();
        const len = this.textareaRef.current?.value.length;
        if (len && this.canEdit()) {
          this.textareaRef.current?.setSelectionRange(len, len);
          // @ts-ignore
          this.textareaRef.current?.scrollTop =
            this.textareaRef.current?.scrollHeight;
        }
      }
    }, 0);

    // 初始化rapid role 字典
    const conversation = (window as any).ConversationController.get(
      this.props.conversationId
    );
    if (conversation) {
      const membersV2 = conversation.get('membersV2') || [];
      let memberRapidRole = {} as any;
      membersV2?.forEach((member: any) => {
        if (member?.id) {
          memberRapidRole[member.id] = member?.rapidRole;
        }
      });
    }
  }

  public componentWillUnmount() {
    window.removeEventListener(
      'close-task-dialog',
      this.closeTaskDialogCallback
    );
  }

  public captureMenuTrigger(triggerRef: Trigger) {
    this.menuTriggerRef = triggerRef;
  }

  public showMenu(event: React.MouseEvent<HTMLDivElement>) {
    if (this.menuTriggerRef) {
      this.menuTriggerRef.handleContextClick(event);
    }
  }

  public moveArray = (
    id: string,
    flag: boolean,
    from: Array<ConversationType>,
    to: Array<ConversationType>
  ) => {
    let item;
    for (let i = 0; i < from.length; i += 1) {
      if (from[i].id === id) {
        item = from[i];
        from.splice(i, 1);
        break;
      }
    }
    if (!item) {
      throw Error('Bad param');
    }
    to.push(item);

    this.setState({
      members: flag ? [...from] : [...to],
      selectedMembers: flag ? [...to] : [...from],
    });
    this.showSelectContactSmallerDialog();
  };

  public onCreateTask = async () => {
    const { i18n, conversationId, ourNumber } = this.props;
    this.setState({ operationLoading: true });

    // 检查参数是否允许创建任务
    // let willAlertBell = false
    if (this.state.dueTime) {
      const now = Date.now();

      // 30分钟内不提醒
      // willAlertBell = this.state.dueTime - now < 30 * 60 * 1000;

      if (this.state.dueTime < now) {
        this.setState({ operationLoading: false });
        alert(i18n('task_due_time_timeout'));
        return;
      }
    }

    let gid;
    let uid;
    if (conversationId) {
      const conversation = this.getConversationProps(conversationId);
      if (conversation) {
        if (conversation.type === 'group') {
          const m = (window as any).ConversationController.get(conversationId);
          if (m) {
            gid = m.getGroupV2Id();
          } else {
            uid = conversationId;
          }
        } else {
          uid = conversationId;
        }
      }
    }

    const taskPutData = {
      uid,
      gid,
      name: this.state.name,
      priority: this.state.priority,
      users: [],
      dueTime: this.state.dueTime || undefined,
    };

    const assignees = [];
    for (let i = 0; i < this.state.selectedMembers.length; i += 1) {
      const item = this.state.selectedMembers[i];
      // @ts-ignore role=2执行人
      taskPutData.users.push({ uid: item.id, role: 2 });
      assignees.push(item.id);
    }

    let task;
    let errorMsg = 'Unknown error';
    try {
      if ((window as any).textsecure.messaging) {
        task = await (window as any).textsecure.messaging.createLightTask(
          taskPutData
        );
      } else {
        errorMsg = 'Network is not available';
      }
    } catch (e: any) {
      if (e && e.message) {
        errorMsg = e.message;
      }
    }

    if (!task || !task.tid) {
      alert('Create Task failed:' + errorMsg);
      this.setState({ operationLoading: false });
      return;
    }

    // write to database
    task = {
      taskId: task.tid,
      creator: ourNumber,
      name: taskPutData.name,
      priority: taskPutData.priority,
      timestamp: task.createTime || Date.now(),
      status: 1, // 默认状态是1
      dueTime: taskPutData.dueTime,
      version: task.version,
    };

    try {
      await (window as any).Signal.Data.createOrUpdateLightTask({
        ...task,
        roles: taskPutData.users,
      });
      await (window as any).Whisper.Task.markAsRead(task.taskId, task.version);
    } catch (e: any) {
      alert('Create Task failed SQL createOrUpdateLightTask:' + e.message);
      this.setState({ operationLoading: false });
      return;
    }

    // send task card
    try {
      const c = await (window as any).ConversationController.getOrCreateAndWait(
        conversationId,
        'group'
      );
      if (c) {
        // @ts-ignore
        task.assignees = assignees;
        await c.forceSendMessageAuto(
          '',
          null,
          [],
          null,
          null,
          null,
          null,
          null,
          null,
          { task }
        );
      }
    } catch (e: any) {
      alert('Create Task failed Send task card:' + e.message);
      this.setState({ operationLoading: false });
      return;
    }

    this.setState({ operationLoading: false });
    this.props.onCancel();

    // if (willAlertBell) {
    //   alert(i18n('task_due_time_warning'));
    // }
  };

  public onCancelTask = async () => {
    const { i18n } = this.props;

    if (confirm(i18n('task_confirm_cancel'))) {
      this.updateTask({ status: 13 });
    }
  };

  public updateTask = async (data: updateTaskType) => {
    const { task } = this.props;
    // 创建任务，不触发修改操作
    if (!task) {
      return;
    }

    // 不可以编辑，不触发修改操作
    if (!this.canEdit()) {
      return;
    }

    const { taskId } = task;

    this.setState({ operationLoading: true });

    let willCloseDialog = false;
    const reqData: updateTaskType = { tid: taskId };
    // 修改名字
    if (data.name) {
      reqData.name = data.name;
    } else if (data.priority) {
      reqData.priority = data.priority;
    } else if (data.status) {
      reqData.status = data.status;
      willCloseDialog = true;
    } else if (data.users) {
      reqData.users = data.users;
    } else if (data.dueTime === 0 || data.dueTime) {
      reqData.dueTime = data.dueTime;
    } else {
      throw Error('TaskDialog.tsx updateTask bad param.');
    }

    let reqResult;
    let errorTemplate;

    try {
      reqResult = await (window as any).textsecure.messaging.updateLightTask(
        reqData
      );
      if (!reqResult || !reqResult.tid) {
        errorTemplate = 'task_update_failed';
      }
    } catch (e: any) {
      console.log('update light task failed:', e);

      const { status } = e?.response || {};
      // 2 no permission
      // 11 no such group task
      // 12 已经是终态，不允许再变更状态
      if (status === 2 || status === 11 || status === 12) {
        try {
          (window as any).Whisper.Task.shouldFetchLatestTask(taskId, {
            notSetUnread: true,
          });
        } catch (err) {
          console.log('get latest message failed:', err);
        }
        errorTemplate = 'task_can_not_be_update';
      } else {
        errorTemplate = 'task_update_failed';
      }
    }

    if (errorTemplate) {
      this.setState({ operationLoading: false });
      // 领导说不要这个提示，直接更新最新任务状态就好
      // alert(i18n(errorTemplate));
      this.props.onCancel(); // 必须关闭dialog，否则dialog数据会变更（taskId等）但title未变化
      return;
    }

    // 名字不一样，需要转一下
    reqResult.timestamp = reqResult.createTime;

    // 写入数据库
    const localTask = await (window as any).Signal.Data.getLightTask(
      reqResult.tid
    );
    // 本地没有此任务？ 这种情况可能正在编辑时，任务到期删除了。 直接关闭窗口吧。
    if (!localTask) {
      console.log(
        'TaskDialog.tsx updateTask failed, NOT FOUND LOCAL TASK IN SQLITE.'
      );
      this.setState({ operationLoading: false });
      this.props.onCancel();
      return;
    }

    // 强制更新task
    await (window as any).Signal.Data.createOrUpdateLightTask({
      ...reqResult,
      taskId: reqResult.tid,
      // message: localTask.message,
      roles: reqResult.users,
    });

    await (window as any).Whisper.Task.markAsRead(
      reqResult.tid,
      reqResult.version
    );

    // 本地消息内容 + 界面变更
    const assignees = [];
    if (reqResult.users && reqResult.users.length) {
      for (let index = 0; index < reqResult.users.length; index += 1) {
        if (reqResult.users[index].role === 2) {
          assignees.push(reqResult.users[index].uid);
        }
      }
    }
    await (window as any).Whisper.Task.updateTaskLinkedMessages({
      ...reqResult,
      taskId: reqResult.tid,
      assignees,
      // message: localTask.message,
      selfOperator: 1,
    });

    this.setState({ operationLoading: false });
    if (willCloseDialog) {
      this.props.onCancel();
    }

    return true;
  };

  public formatOperationLog = (log: any) => {
    const { i18n } = this.props;

    // "businessType": 1,
    // "businessId": "081df166-2cd0-409a-88ed-be9df1cbd2d7", //任务ID
    // "operUser": "+758",  // 操作人
    // "oldValue": "1",     // 原值
    // "newValue": "2",      // 新值
    // "operTime": 1758847929838 // 操作时间
    const { businessType, operUser, operTime, newValue } = log;

    const conversation = (window as any).ConversationController.get(operUser);
    const userName = conversation ? conversation.getTitle() : operUser;

    let changedValue;
    if (businessType === 5) {
      changedValue = 'P' + (newValue - 1);
    } else if (businessType === 6) {
      const timestamp = Number(newValue);
      if (timestamp) {
        changedValue = moment(timestamp).format('YYYY/MM/DD, HH:mm');
      } else {
        changedValue = timestamp;
      }
    } else {
      changedValue = newValue;
    }

    const logTemplate = LOG_TEMPLATES[businessType as string];
    const timeString = timestampToLocal(operTime, i18n('lang') === 'zh-CN');
    if (logTemplate) {
      return {
        log: i18n(logTemplate, [userName, changedValue]),
        time: timeString,
      };
    }

    return null;
  };

  public loadChangeRecords = async () => {
    const { task } = this.props;

    if (!task || !task.taskId) {
      return;
    }

    this.setState({ operationLoading: true });

    const { getLightTaskOperationLog } =
      (window as any).textsecure.messaging || {};

    if (getLightTaskOperationLog) {
      try {
        const logs = await getLightTaskOperationLog(task.taskId, 1, 100);
        const { rows = [] } = logs;
        const formatedRows = rows.map(this.formatOperationLog);
        const filterRows = formatedRows.filter((row: any) => !!row);

        this.setState({ changeRecords: filterRows });
      } catch (error) {
        this.setState({ showLogs: false });
      }
    } else {
      // network is not avaliable
      this.setState({ showLogs: false });
    }

    this.setState({ operationLoading: false });
  };

  public createMode = () => {
    const { task } = this.props;
    return !task;
  };

  public canEdit = () => {
    const { task, ourNumber } = this.props;
    if (!task) {
      return true;
    }

    // 11 rejected, 12 deleted, 13 canceled
    if (task.status === 11 || task.status === 12 || task.status === 13) {
      return false;
    }

    const { creator, assignees } = task;
    if (creator === ourNumber) {
      return true;
    }
    if (assignees) {
      for (let i = 0; i < assignees.length; i += 1) {
        if (assignees[i].id === ourNumber) {
          return true;
        }
      }
    }
    return false;
  };

  public isOwner = () => {
    const { task, ourNumber } = this.props;
    if (!task) {
      return false;
    }

    const { creator } = task;
    if (creator === ourNumber) {
      return true;
    }
    return false;
  };

  public renderName() {
    const { i18n } = this.props;
    const { name } = this.state;
    const canEditTask = this.canEdit();
    return (
      <textarea
        disabled={!canEditTask}
        ref={this.textareaRef}
        className={canEditTask ? 'name' : 'name not-allow-pointer'}
        defaultValue={name}
        maxLength={MAX_TASK_NAME_LENGTH}
        spellCheck={false}
        autoFocus={true}
        placeholder={i18n('addTask')}
        onChange={e => {
          const name = e.target.value?.trim();
          if (name !== this.state.name) {
            this.setState({ name });
          }
        }}
        onBlur={() => {
          const { name, lastCommitName } = this.state;

          if (this.createMode()) {
            this.setState({ name });
          } else if (name && lastCommitName !== name) {
            this.updateTask({ name }).then(result => {
              if (result) {
                this.setState({ lastCommitName: name, name });
              } else {
                this.setState({ name: lastCommitName });
              }
            });
          }
        }}
      />
    );
  }

  public renderJump = () => {
    const { i18n, task, onCancel } = this.props;
    if (!task || !task.message || !task.message.conversationId) {
      return null;
    }

    const conversation = (window as any).ConversationController.get(
      task.message.conversationId
    );
    if (!conversation) {
      return null;
    }

    return (
      <div
        className={'view-in-chat'}
        onClick={(event: React.MouseEvent<HTMLDivElement>) => {
          event.stopPropagation();
          trigger('showConversation', conversation.id);
          const myEvent = new Event('event-toggle-switch-chat');
          window.dispatchEvent(myEvent);
          onCancel();
        }}
      >
        {' '}
        {i18n('task_view_in_chat')}
        <span style={{ color: 'rgb(55,105,225)', marginLeft: 5 }}>
          {' '}
          {conversation.get('name')}
        </span>
      </div>
    );
  };

  public showSelectContactSmallerDialog = () => {
    if (!this.btnExecutorRef.current && !this.btnExecutorSpanRef.current) {
      return;
    }
    const rect =
      this.btnExecutorRef?.current?.getBoundingClientRect() ||
      this.btnExecutorSpanRef?.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const DialogHeight = 400;
    const DialogWidth = 480;
    const innerWidth = window.innerWidth;
    const innerHeight = window.innerHeight;
    const maxY = innerHeight - DialogHeight - 10;
    const maxX = innerWidth - DialogWidth - 10;
    this.setState({
      showSelectContactSmaller: true,
      x: Math.min(rect.x + rect.width + 8, maxX),
      y: Math.min(rect.y, maxY),
    });
  };

  public renderAddAssignees() {
    const { i18n } = this.props;
    const { selectedMembers } = this.state;
    const canEditTask = this.canEdit();

    let style: any = {
      padding: '0',
      margin: '0 10px',
      width: '15px',
      height: '15px',
    };
    let buttonText = '';
    if (selectedMembers.length === 0) {
      style = {
        paddingLeft: '2px',
        margin: '0',
        fontSize: '13px',
        border: 'none',
        textAlign: 'left',
      };
      buttonText = i18n('task_add_assignee');
    }

    const avatars = [];
    for (let i = 0; i < selectedMembers.length && i < 3; i += 1) {
      const avatarItem = selectedMembers[i];
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
            avatarPath={(avatarItem as any).avatarPath}
            noteToSelf={false}
          />
        </div>
      );
    }

    if (selectedMembers.length === 1) {
      const item = selectedMembers[0];
      avatars.push(
        <span key={item.id} style={{ fontSize: '12px', cursor: 'default' }}>
          {item.name || item.id}
        </span>
      );
    }

    if (selectedMembers.length > 1) {
      avatars.push(
        <span
          key={selectedMembers.length}
          ref={this.btnExecutorSpanRef}
          onClick={() => {
            if (this.canEdit()) {
              return;
            }
            this.showSelectContactSmallerDialog();
          }}
          style={{
            fontSize: '12px',
            cursor: this.canEdit() ? 'default' : 'pointer',
          }}
        >
          {selectedMembers.length + ' ' + i18n('task_assignees')}
        </span>
      );
    }

    return (
      <div className={classNames('dialog-task__row-container')}>
        <span
          className={classNames('dialog-task__row-icon', 'assignee-icon')}
        />
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {avatars}
          {selectedMembers.length && !canEditTask ? null : (
            <button
              disabled={!canEditTask}
              className={classNames(
                selectedMembers.length
                  ? 'dialog-task__button-edit-assginees'
                  : '',
                canEditTask ? '' : 'not-allow-pointer'
              )}
              style={style}
              ref={this.btnExecutorRef}
              onClick={this.showSelectContactSmallerDialog}
            >
              {buttonText}
            </button>
          )}
        </div>
      </div>
    );
  }

  public renderDueDate() {
    const { i18n } = this.props;

    return (
      <div className={classNames('dialog-task__row-container')}>
        <span
          className={classNames('dialog-task__row-icon', 'calendar-icon')}
        />
        {this.state.dueTime ? (
          <DateTimeItem
            disabled={!this.canEdit()}
            timestamp={this.state.dueTime}
            setTimestamp={t => {
              const now = Date.now();

              //首先判断选择的时间，非法时间直接提示错误并返回
              if (t <= now) {
                (window as any).noticeError(i18n('task_due_time_timeout'), 3);
                return;
              }

              const lastDueTime = this.state.dueTime;
              const lastShowBell = this.state.showBell;
              // 30分钟内，不显示小铃铛
              const showBell = t - now >= 30 * 60 * 1000;

              if (this.createMode()) {
                this.setState({ showBell, dueTime: t });
              } else if (this.canEdit() && t > now) {
                this.updateTask({ dueTime: t }).then(result => {
                  if (result) {
                    this.setState({ showBell, dueTime: t });
                  } else {
                    // TODO:// does not take effect ???
                    this.setState({
                      dueTime: lastDueTime,
                      showBell: lastShowBell,
                    });
                  }
                });
              }
            }}
          />
        ) : (
          <button
            disabled={!this.canEdit()}
            className={this.canEdit() ? '' : 'not-allow-pointer'}
            style={{
              paddingLeft: '2px',
              margin: '0',
              fontSize: '13px',
              border: 'none',
              textAlign: 'left',
            }}
            onClick={() => {
              const nowTimestamp = Date.now();
              const today18 =
                moment(nowTimestamp).startOf('day').valueOf() +
                18 * 3600 * 1000;
              let lastDueTime: number;
              let showBell: boolean;

              if (nowTimestamp > today18) {
                lastDueTime = today18 + 24 * 3600 * 1000;
                showBell = true;
              } else {
                lastDueTime = today18;
                showBell = today18 - nowTimestamp >= 30 * 60 * 1000;
              }

              if (this.createMode()) {
                this.setState({ dueTime: lastDueTime, showBell });
              } else if (this.canEdit()) {
                this.updateTask({ dueTime: lastDueTime }).then(result => {
                  if (result) {
                    this.setState({ dueTime: lastDueTime, showBell });
                  }
                });
              }
            }}
          >
            {i18n('task_add_due_time')}
          </button>
        )}
        {this.state.showBell && this.canEdit() ? (
          <span className={classNames('bell-icon')} />
        ) : null}
        {this.state.dueTime && this.canEdit() ? (
          <button
            style={{
              padding: '0',
              margin: '5px',
              width: '12px',
              height: '12px',
            }}
            className="dialog-task__button-remove-due-time"
            onClick={() => {
              if (this.createMode()) {
                this.setState({ showBell: false, dueTime: 0 });
              } else {
                this.updateTask({ dueTime: 0 }).then(result => {
                  if (result) {
                    this.setState({ showBell: false, dueTime: 0 });
                  }
                });
              }
            }}
          />
        ) : null}
      </div>
    );
  }

  public renderPriorityItem(type: number) {
    const { priority } = this.state;
    const disabled = !this.canEdit();
    return (
      <PriorityItem
        disabled={disabled}
        type={type}
        selected={type === priority}
        setType={() => {
          if (disabled) {
            return;
          }

          if (this.createMode()) {
            this.setState({ priority: type });
          } else {
            this.updateTask({ priority: type }).then(result => {
              if (result) {
                this.setState({ priority: type });
              }
            });
          }
        }}
      />
    );
  }

  public renderPriority() {
    return (
      <div className={classNames('dialog-task__row-container')}>
        <span
          className={classNames('dialog-task__row-icon', 'priority-icon')}
        />
        {this.renderPriorityItem(1)}
        {this.renderPriorityItem(2)}
        {this.renderPriorityItem(3)}
      </div>
    );
  }

  public renderShowLogsButton = () => {
    const { i18n } = this.props;
    const { showLogs } = this.state;
    const title = showLogs ? 'refreshChangeRecords' : 'showChangeRecords';

    return (
      <div className="dialog-task__button-show-or-refresh">
        <span
          className="dialog-task__button-title"
          onClick={() => {
            this.setState({ showLogs: true });
            this.loadChangeRecords();
          }}
        >
          {i18n(title)}
        </span>
      </div>
    );
  };

  public renderLogList() {
    const { changeRecords, showLogs } = this.state;

    if (!showLogs) {
      return null;
    }

    const maxShowCount = 100;

    return (
      <div className="dialog-task__change-records">
        {changeRecords
          .filter((_, idx) => idx < maxShowCount)
          .map((log: any, index: any) => (
            <div key={'log' + index} className="dialog-task__span-log">
              <span key={'time' + index} className="dialog-task__span-log-time">
                {log.time}
              </span>
              <span
                key={'content' + index}
                className="dialog-task__span-log-content"
              >
                {log.log}
              </span>
            </div>
          ))}
      </div>
    );
  }

  public renderHistory() {
    if (this.createMode()) {
      return null;
    }

    return (
      <div
        className={classNames(
          'dialog-task__row-container',
          'dialog-task__row-history'
        )}
      >
        <span className={classNames('dialog-task__row-icon', 'history-icon')} />
        <div>
          {this.renderShowLogsButton()}
          {this.renderLogList()}
        </div>
      </div>
    );
  }

  public renderOperationLoading() {
    const { operationLoading } = this.state;
    if (!operationLoading) {
      return null;
    }
    return (
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          textAlign: 'center',
          zIndex: 200,
        }}
      >
        <div style={{ width: '100%', height: '100%' }}>
          <div className={'waiting-border'}>
            <div
              className="waiting"
              style={{ width: 40, height: 40, margin: 10 }}
            />
          </div>
        </div>
      </div>
    );
  }

  public renderHeaderToolbar() {
    const { onCancel } = this.props;

    return (
      <div className="dialog-task__top-header-bar">
        <span
          className={'apple-close'}
          onClick={(event: React.MouseEvent<HTMLSpanElement>) => {
            event.stopPropagation();
            onCancel();
          }}
        />
        {this.renderContextMenu()}
      </div>
    );
  }

  public renderMenuItems() {
    const { i18n, onCancel } = this.props;

    const isCreating = this.createMode();
    const isMeOwner = this.isOwner();

    const menuItems = [];

    if (this.canEdit() && (isCreating || isMeOwner)) {
      const handleCancel = isCreating ? onCancel : this.onCancelTask;
      const titleTemplate = isCreating ? 'cancel' : 'task_cancel';

      menuItems.push(
        <MenuItem
          key={uuidv4()}
          attributes={{ className: 'dialog-task-menu-cancel' }}
          onClick={() => {
            handleCancel();
          }}
        >
          {i18n(titleTemplate)}
        </MenuItem>
      );
    }

    if (this.canEdit() && !isCreating) {
      menuItems.push(
        <MenuItem
          key={uuidv4()}
          attributes={{ className: 'dialog-task-menu-reject' }}
          onClick={() => {
            if (confirm(i18n('task_confirm_reject'))) {
              this.updateTask({ status: 11 });
            }
          }}
        >
          {i18n('task_reject')}
        </MenuItem>
      );
    }

    return menuItems;
  }

  public renderContextMenu() {
    const triggerId = 'trigger-id-toolbar-more-action';

    const menuItems = this.renderMenuItems();
    if (menuItems.length > 0) {
      return (
        <>
          <ContextMenuTrigger id={triggerId} ref={this.captureMenuTriggerBound}>
            <span className={'more-action'} onClick={this.showMenuBound} />
          </ContextMenuTrigger>
          <ContextMenu id={triggerId} rtl>
            {menuItems}
          </ContextMenu>
        </>
      );
    }

    return null;
  }

  public renderCreateButton() {
    if (!this.createMode()) {
      return null;
    }

    const { i18n } = this.props;
    const { name } = this.state;
    const buttonDisabled = !name;

    return (
      <button
        className={classNames(
          'dialog-task__button-operate',
          `dialog-task__button-operate-${
            buttonDisabled ? 'disabled' : 'enabled'
          }`
        )}
        disabled={buttonDisabled}
        onClick={() => {
          if (!buttonDisabled) {
            this.onCreateTask();
          }
        }}
      >
        {i18n('create')}
      </button>
    );
  }

  public renderCompleteButton() {
    if (this.createMode() || !this.canEdit()) {
      return null;
    }

    const { i18n } = this.props;
    const { name } = this.state;

    const buttonDisabled = !name;

    return (
      <button
        className={classNames(
          'dialog-task__button-operate',
          `dialog-task__button-operate-${
            buttonDisabled ? 'disabled' : 'enabled'
          }`
        )}
        onClick={() => {
          if (!buttonDisabled && confirm(i18n('task_confirm_complete'))) {
            this.updateTask({ status: 12 });
          }
        }}
      >
        {i18n('task_complete')}
      </button>
    );
  }

  public renderTaskFinalStatus() {
    const { i18n, task } = this.props;

    if (this.createMode()) {
      return null;
    }

    if (task && task.updateTime && task.updater) {
      const { status } = task;
      if (status === 11 || status === 12 || status === 13) {
        const formatedMsg = this.formatOperationLog({
          businessType: status,
          operUser: task.updater,
          operTime: task.updateTime,
        });

        const { time, log } = formatedMsg || {};
        if (time && log) {
          return (
            <div className={'final-message'}>
              <span style={{ fontSize: '10px', marginRight: '8px' }}>
                {time}
              </span>
              <span>{log}</span>
            </div>
          );
        }
      }
    }

    if (!this.canEdit()) {
      return (
        <div className={'final-message'}>
          <span>{i18n('task_details_view_only')}</span>
        </div>
      );
    }

    return null;
  }

  public renderBottomRow() {
    return (
      <div className={classNames('dialog-task__row-container')}>
        {this.renderCreateButton()}
        {this.renderCompleteButton()}
        {this.renderTaskFinalStatus()}
      </div>
    );
  }

  public render() {
    const { i18n, ourNumber, onCancel } = this.props;
    const {
      showSelectContactSmaller,
      x,
      y,
      members,
      selectedMembers,
      operationLoading,
      maxAssigneeCount,
    } = this.state;

    return (
      <Dialog onClose={onCancel} escClose={!operationLoading}>
        <div className="task-dialog">
          {this.renderOperationLoading()}
          {this.renderHeaderToolbar()}
          {this.renderName()}
          {this.renderJump()}
          {this.renderAddAssignees()}
          {this.renderDueDate()}
          {this.renderPriority()}
          {this.renderHistory()}
          {this.renderBottomRow()}
          {showSelectContactSmaller ? (
            <div
              className={'select-contact-smaller-dialog-wrapper'}
              style={{
                margin: y + 'px 0 0 ' + x + 'px',
              }}
            >
              <SelectContactSmaller
                i18n={i18n}
                members={members}
                selectedMembers={selectedMembers}
                addItem={id => {
                  if (!this.canEdit()) {
                    return;
                  }

                  if (
                    maxAssigneeCount &&
                    selectedMembers.length >= maxAssigneeCount
                  ) {
                    alert(
                      i18n('maxAssigneesExceeded', [
                        maxAssigneeCount.toString(),
                      ])
                    );
                    return;
                  }

                  this.moveArray(id, true, members, selectedMembers);
                  if (!this.createMode()) {
                    const users = [];
                    for (
                      let i = 0;
                      i < this.state.selectedMembers.length;
                      i += 1
                    ) {
                      users.push({
                        uid: this.state.selectedMembers[i].id,
                        role: 2,
                      });
                    }
                    this.updateTask({ users });
                  }
                }}
                removeItem={id => {
                  if (!this.canEdit()) {
                    return;
                  }
                  if (
                    id === ourNumber &&
                    !this.isOwner() &&
                    !this.createMode()
                  ) {
                    if (!confirm(i18n('task_remove_assignee_self'))) {
                      return;
                    }
                  }
                  this.moveArray(id, false, selectedMembers, members);
                  if (!this.createMode()) {
                    const users = [];
                    for (
                      let i = 0;
                      i < this.state.selectedMembers.length;
                      i += 1
                    ) {
                      users.push({
                        uid: this.state.selectedMembers[i].id,
                        role: 2,
                      });
                    }
                    this.updateTask({ users });
                  }
                }}
                onClose={() => {
                  this.setState({ showSelectContactSmaller: false });
                }}
                memberRapidRole={this.state.memberRapidRole}
              />
            </div>
          ) : null}
        </div>
      </Dialog>
    );
  }
}
