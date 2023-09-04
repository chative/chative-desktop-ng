import React from 'react';

import { Menu, MenuItem, MenuRadioGroup } from '@szhsin/react-menu';
import { LocalizerType } from '../../types/Util';
import TaskItem, { TaskType } from './TaskItem';

type PropsType = {
  i18n: LocalizerType;
  ourNumber: string;
};

type StateType = {
  // 0-进行中 / Ongoing
  // 1-被指派的 / Received
  // 2-我创建的 / Assigned
  // 3-已完成 / Completed
  selectedType: number;
  sortType: number; //0-创建时间排序，1-截止时间排序，2-优先级排序

  ongoingItems: Array<TaskType>;
  receivedItems: Array<TaskType>;
  assignedItems: Array<TaskType>;
  completedItems: Array<TaskType>;
};

export class TaskPane extends React.Component<PropsType, StateType> {
  constructor(props: any) {
    super(props);
    this.state = {
      selectedType: 0,
      sortType: 0,
      ongoingItems: [],
      receivedItems: [],
      assignedItems: [],
      completedItems: [],
    };
  }

  public async componentDidMount() {
    window.addEventListener('task-pane-update', this.taskUpdate);

    // fetch all tasks if never fetch before
    (window as any).Whisper.Task.fetchAllTasks();

    // load all tasks
    const items = [];
    const tasks = await (window as any).Signal.Data.getAllTasks();
    for (let i = 0; i < tasks.length; i += 1) {
      const task = tasks[i];
      const roles = await (window as any).Signal.Data.getTaskRoles(
        task.taskId,
        2
      );

      const assignees = [];
      for (let index = 0; index < roles.length; index += 1) {
        if (roles[index].uid) {
          assignees.push(this.getConversationProps(roles[index].uid));
        }
      }

      items.push({
        ...task,
        assignees,
      });
    }

    const filterArray0 = [];
    const filterArray1 = [];
    const filterArray2 = [];
    const filterArray3 = [];
    for (let i = 0; i < items.length; i += 1) {
      if (this.filterTask(items[i], 0)) {
        filterArray0.push(items[i]);
      }
      if (this.filterTask(items[i], 1)) {
        filterArray1.push(items[i]);
      }
      if (this.filterTask(items[i], 2)) {
        filterArray2.push(items[i]);
      }
      if (this.filterTask(items[i], 3)) {
        filterArray3.push(items[i]);
      }
    }

    this.setState(
      {
        ongoingItems: filterArray0,
        receivedItems: filterArray1,
        assignedItems: filterArray2,
        completedItems: filterArray3,
      },
      this.arraySort
    );
  }

  public componentWillUnmount() {
    window.removeEventListener('task-pane-update', this.taskUpdate);
  }

  private getConversationProps = (id: string) => {
    const c = (window as any).ConversationController.get(id);
    if (c) {
      return {
        ...c.format(),
        isMe: false,
      };
    }

    return {
      id,
      name: id,
    };
  };

  private taskUpdate = async (ev: any) => {
    if (!ev || !ev.detail) {
      return;
    }

    const { ongoingItems, receivedItems, assignedItems, completedItems } =
      this.state;

    const isDeleteTask = ev.detail.deleted;
    const isChangeByMySelf = ev.detail.selfOperator;
    const updateReadVersion = ev.detail.updateReadVersion;

    if (updateReadVersion) {
      const dealArrayUnread = async (items: Array<TaskType>) => {
        for (let i = 0; i < items.length; i += 1) {
          if (items[i].taskId === ev.detail.taskId) {
            if (
              !items[i].readAtVersion ||
              items[i].readAtVersion < updateReadVersion
            ) {
              items[i].readAtVersion = updateReadVersion;
              await (window as any).Whisper.Task.markAsRead(
                items[i].taskId,
                updateReadVersion
              );
              return [...items];
            }
            break;
          }
        }
        return undefined;
      };

      const filterArray0 = await dealArrayUnread(ongoingItems);
      const filterArray1 = await dealArrayUnread(receivedItems);
      const filterArray2 = await dealArrayUnread(assignedItems);
      const filterArray3 = await dealArrayUnread(completedItems);

      this.setState(
        {
          ongoingItems: filterArray0 || ongoingItems,
          receivedItems: filterArray1 || receivedItems,
          assignedItems: filterArray2 || assignedItems,
          completedItems: filterArray3 || completedItems,
        },
        this.arraySort
      );
      return;
    }

    const assignees = [];
    if (ev.detail.assignees) {
      for (let index = 0; index < ev.detail.assignees.length; index += 1) {
        if (ev.detail.assignees[index]) {
          assignees.push(this.getConversationProps(ev.detail.assignees[index]));
        }
      }
    }

    const task = { ...ev.detail, assignees };

    if (!task.message) {
      // 查询旧message，需要记录下来，丢了会导致没有‘View in Chat’
      const getOldMessage = (items: Array<TaskType>, taskId: string) => {
        for (let i = 0; i < items.length; i += 1) {
          if (items[i].taskId === taskId && items[i].message) {
            return items[i].message;
          }
        }
        return null;
      };
      let oldMessage = getOldMessage(ongoingItems, task.taskId);
      if (!oldMessage) {
        oldMessage = getOldMessage(receivedItems, task.taskId);
      }
      if (!oldMessage) {
        oldMessage = getOldMessage(assignedItems, task.taskId);
      }
      if (!oldMessage) {
        oldMessage = getOldMessage(completedItems, task.taskId);
      }
      if (oldMessage) {
        task.message = oldMessage;
      }
    }

    const isInArray = (items: Array<TaskType>, taskId: string) => {
      for (let i = 0; i < items.length; i += 1) {
        if (items[i].taskId === taskId) {
          return items[i];
        }
      }
      return undefined;
    };

    // 若此任务已在界面上显示，并且版本号>=task.version, 则直接忽略
    if (!isDeleteTask) {
      let uiTask = isInArray(ongoingItems, task.taskId);
      if (uiTask && uiTask.version >= task.version) {
        return;
      }
      uiTask = isInArray(receivedItems, task.taskId);
      if (uiTask && uiTask.version >= task.version) {
        return;
      }
      uiTask = isInArray(assignedItems, task.taskId);
      if (uiTask && uiTask.version >= task.version) {
        return;
      }
      uiTask = isInArray(completedItems, task.taskId);
      if (uiTask && uiTask.version >= task.version) {
        return;
      }
    }

    const dealArrayType = (items: Array<TaskType>, type: number) => {
      if (isDeleteTask) {
        if (isInArray(items, task.taskId)) {
          let resultItems = [...items];
          for (let i = 0; i < items.length; i += 1) {
            if (items[i].taskId === task.taskId) {
              resultItems.splice(i, 1);
              break;
            }
          }
          return resultItems;
        }
        return undefined;
      }

      let resultItems;
      const beInType = this.filterTask(task, type);
      if (isInArray(items, task.taskId)) {
        resultItems = [...items];
        for (let i = 0; i < items.length; i += 1) {
          if (items[i].taskId === task.taskId) {
            // 版本太旧，忽略
            if (task.version <= items[i].version) {
              // 处理task.message不为空的情况
              if (task.message && !items[i].message) {
                resultItems[i].message = task.message;
                return resultItems;
              }
              return undefined;
            }
            // 更新数据
            if (beInType) {
              resultItems[i] = task;
              if (isChangeByMySelf) {
                resultItems[i].readAtVersion = task.version;
              } else {
                resultItems[i].readAtVersion = 0;
              }
            } else {
              // 移除此类
              resultItems.splice(i, 1);
            }
            break;
          }
        }
      } else {
        if (beInType) {
          resultItems = [...items];
          resultItems.push({
            ...task,
            readAtVersion: isChangeByMySelf ? task.version : 0,
          });
        }
      }
      return resultItems;
    };

    const filterArray0 = dealArrayType(ongoingItems, 0);
    const filterArray1 = dealArrayType(receivedItems, 1);
    const filterArray2 = dealArrayType(assignedItems, 2);
    const filterArray3 = dealArrayType(completedItems, 3);

    this.setState(
      {
        ongoingItems: filterArray0 || ongoingItems,
        receivedItems: filterArray1 || receivedItems,
        assignedItems: filterArray2 || assignedItems,
        completedItems: filterArray3 || completedItems,
      },
      this.arraySort
    );
  };

  public filterTask = (task: TaskType, selectType: number) => {
    const { ourNumber } = this.props;

    let amAssignee = false;
    for (let index = 0; index < task.assignees.length; index += 1) {
      if (task.assignees[index].id === ourNumber) {
        amAssignee = true;
        break;
      }
    }

    // 非我创建的 并且 我不是执行人的任务，直接返回false
    if (task.creator !== ourNumber && !amAssignee) {
      return false;
    }

    // 进行中
    if (selectType === 0 && task.status === 1) {
      return true;
    }

    // 被指派的
    if (selectType === 1 && amAssignee) {
      return true;
    }

    // 我创建的
    if (selectType === 2 && task.creator === ourNumber) {
      return true;
    }

    // 已完成, 已拒绝，已取消
    if (
      selectType === 3 &&
      (task.status === 11 || task.status === 12 || task.status === 13)
    ) {
      return true;
    }
    return false;
  };

  public st = (a: TaskType, b: TaskType) => {
    const { sortType } = this.state;
    if (sortType === 0) {
      return b.timestamp - a.timestamp;
    }
    if (sortType === 1) {
      if (a.dueTime && b.dueTime) {
        return a.dueTime - b.dueTime;
      }
      if (a.dueTime) {
        return -1;
      }
      if (b.dueTime) {
        return 1;
      }
      return 0;
    }
    if (sortType === 2) {
      return a.priority - b.priority;
    }
    throw Error('Bad sortType');
  };

  public arraySort() {
    const { ongoingItems, receivedItems, assignedItems, completedItems } =
      this.state;
    const a0 = ongoingItems.sort(this.st);
    const a1 = receivedItems.sort(this.st);
    const a2 = assignedItems.sort(this.st);
    const a3 = completedItems.sort(this.st);

    const detail =
      this.getUnread(a0) +
      this.getUnread(a1) +
      this.getUnread(a2) +
      this.getUnread(a3);
    const ev = new CustomEvent('main-header-set-task-red-point', { detail });
    window.dispatchEvent(ev);

    this.setState({
      ongoingItems: a0,
      receivedItems: a1,
      assignedItems: a2,
      completedItems: a3,
    });
  }

  public typeTitle(type: number) {
    const { i18n } = this.props;
    if (type === 0) {
      return i18n('task_ongoing');
    } else if (type === 1) {
      return i18n('task_received');
    } else if (type === 2) {
      return i18n('task_assigned');
    } else if (type === 3) {
      return i18n('task_endings');
    } else {
      throw Error('TaskPane.tsx bad type');
    }
  }

  public renderLeftItem(type: number, unreadCount: number) {
    const {
      selectedType,
      ongoingItems,
      receivedItems,
      assignedItems,
      completedItems,
    } = this.state;

    const title = this.typeTitle(type);
    let icon;
    let itemCount;
    if (type === 0) {
      icon = <span className={'ongoing-icon'} />;
      itemCount = ongoingItems.length;
    } else if (type === 1) {
      icon = <span className={'received-icon'} />;
      itemCount = receivedItems.length;
    } else if (type === 2) {
      icon = <span className={'assigned-icon'} />;
      itemCount = assignedItems.length;
    } else if (type === 3) {
      icon = <span className={'completed-icon'} />;
      itemCount = completedItems.length;
    } else {
      throw Error('TaskPane.tsx bad type');
    }

    return (
      <div
        className={'item ' + (type === selectedType ? 'item-selected' : '')}
        onClick={() => {
          this.setState({ selectedType: type }, () => {
            const cl = document.getElementsByClassName('card-list')[0];
            if (cl) {
              cl.scrollTop = 0;
            }
          });
        }}
      >
        {icon}
        <span style={{ lineHeight: '40px', paddingLeft: '10px' }}>{title}</span>
        <div style={{ display: 'inline-block', height: 40, float: 'right' }}>
          {unreadCount ? (
            <span
              style={{ color: '#f84135', lineHeight: '40px', fontSize: '12px' }}
            >
              {unreadCount}
            </span>
          ) : null}
          <span style={{ lineHeight: '40px', fontSize: '12px' }}>
            {(unreadCount ? '/' : '') + itemCount}
          </span>
        </div>
      </div>
    );
  }

  public getUnread = (items: Array<TaskType>) => {
    let count = 0;
    for (let i = 0; i < items.length; i += 1) {
      if (
        !items[i].readAtVersion ||
        items[i].version > items[i].readAtVersion
      ) {
        count += 1;
      }
    }
    return count;
  };

  public renderLeft() {
    const { i18n } = this.props;
    const { ongoingItems, receivedItems, assignedItems, completedItems } =
      this.state;

    const a0 = this.getUnread(ongoingItems);
    const a1 = this.getUnread(receivedItems);
    const a2 = this.getUnread(assignedItems);
    const a3 = this.getUnread(completedItems);

    return (
      <div className={'left'}>
        <h2>{i18n('tasks')}</h2>
        {this.renderLeftItem(0, a0)}
        {this.renderLeftItem(1, a1)}
        {this.renderLeftItem(2, a2)}
        {this.renderLeftItem(3, a3)}
      </div>
    );
  }

  // if cursor: 'pointer' NOT WORK properly
  // Look at this: https://github.com/electron/electron/issues/5723
  public renderRightTitle() {
    const { i18n } = this.props;
    const { selectedType } = this.state;

    return (
      <div className={'title'}>
        <span
          style={{ fontSize: '16px', lineHeight: '50px', paddingLeft: '20px' }}
        >
          {this.typeTitle(selectedType)}
        </span>
        <div
          style={{
            float: 'right',
            width: 80,
            height: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Menu menuButton={<span className={'sort-icon'} />}>
            <MenuRadioGroup
              value={this.state.sortType}
              onRadioChange={e => {
                this.setState({ sortType: e.value }, () => {
                  this.arraySort();
                });
              }}
            >
              <MenuItem value={0}>{i18n('task_sort_by_create_time')}</MenuItem>
              <MenuItem value={1}>{i18n('task_sort_by_due_time')}</MenuItem>
              <MenuItem value={2}>{i18n('task_sort_by_priority')}</MenuItem>
            </MenuRadioGroup>
          </Menu>
        </div>
      </div>
    );
  }

  public renderRightList() {
    const { i18n, ourNumber } = this.props;
    const {
      selectedType,
      ongoingItems,
      receivedItems,
      assignedItems,
      completedItems,
    } = this.state;

    let selectedItems;
    if (selectedType === 0) {
      selectedItems = ongoingItems;
    }
    if (selectedType === 1) {
      selectedItems = receivedItems;
    }
    if (selectedType === 2) {
      selectedItems = assignedItems;
    }
    if (selectedType === 3) {
      selectedItems = completedItems;
    }
    if (!selectedItems) {
      throw Error('bad selectedType');
    }
    if (selectedItems.length === 0) {
      return <div className={'no-tasks'}>{i18n('task_no_tasks')}</div>;
    }
    const items = selectedItems.map((item: TaskType, index: number) => (
      <TaskItem
        key={index}
        i18n={i18n}
        ourNumber={ourNumber}
        task={item}
        conversationId={item.message?.conversationId}
      />
    ));
    return <div className={'card-list'}>{items}</div>;
  }

  public renderRight() {
    return (
      <div className={'right'}>
        {this.renderRightTitle()}
        {this.renderRightList()}
      </div>
    );
  }

  public render() {
    return (
      <>
        {this.renderLeft()}
        {this.renderRight()}
      </>
    );
  }
}
