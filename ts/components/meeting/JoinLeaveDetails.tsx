import React from 'react';
import { LocalizerType } from '../../types/Util';
import PollModal from '../PollModal';

const getWebUserDisplayName = (name: string) => {
  if (name.startsWith('+web-')) {
    const temp = name.replace('+web-', '');
    return (
      (temp.indexOf('-') > 0 ? temp.substring(0, temp.indexOf('-')) : temp) +
      '(Web)'
    );
  }
  return name;
};

interface Props {
  i18n: LocalizerType;
  groupMeetingId: string;
  onCancel: () => void;
  ourNumber: string;
}

interface State {
  operationLoading: boolean;
  userEvent: any;
  nonParticipants: any;
}

export class JoinLeaveDetails extends React.Component<Props, State> {
  constructor(props: Readonly<Props>) {
    super(props);
    this.state = {
      operationLoading: true,
      userEvent: undefined,
      nonParticipants: undefined,
    };
  }

  public networkGetList = async () => {
    let errorMsg = 'Network is not available';
    try {
      if ((window as any).textsecure.messaging) {
        const result = await (
          window as any
        ).textsecure.messaging.getGroupMeetingDetails(
          this.props.groupMeetingId
        );

        console.log(result);

        // userEvent排序
        const userEvent = result.userEvent;
        userEvent.sort((a: any, b: any) => {
          return a.timestamp - b.timestamp;
        });

        this.setState({
          operationLoading: false,
          userEvent: userEvent.filter((a: any) => a.event === 'join'),
          nonParticipants: result.nonParticipants,
        });
        return;
      }
    } catch (e: any) {
      console.error(e);
    }

    this.setState({ operationLoading: false });
    if (errorMsg) {
      alert(errorMsg);
    }
  };

  public componentDidMount() {
    window.addEventListener(
      'conversation-close-create-poll-dialog',
      this.closeSelf
    );
    this.networkGetList();
  }

  public componentWillUnmount() {
    window.removeEventListener(
      'conversation-close-create-poll-dialog',
      this.closeSelf
    );
  }

  public closeSelf = () => {
    this.props.onCancel();
  };

  public renderCloseBtn() {
    return (
      <span
        className={'common-close'}
        style={{ position: 'absolute', right: '15px', top: '22px' }}
        onClick={(event: React.MouseEvent<HTMLSpanElement>) => {
          event.stopPropagation();
          this.props.onCancel();
        }}
      />
    );
  }

  public renderFreshBtn() {
    return (
      <span
        className={'common-fresh'}
        style={{
          position: 'absolute',
          left: '15px',
          top: '22px',
          height: '20px',
          width: '20px',
        }}
        onClick={(event: React.MouseEvent<HTMLSpanElement>) => {
          event.stopPropagation();
          this.setState({ operationLoading: true });
          this.networkGetList();
        }}
      />
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

  public renderTitle() {
    const { i18n } = this.props;
    return (
      <div className={'header-container'}>
        <h3>{i18n('groupMeetingDetail')}</h3>
      </div>
    );
  }

  public getConversation(id: string | undefined) {
    if (!id) {
      console.log('conversation not found for:', id);
      return null;
    }
    return (window as any).ConversationController.get(id);
  }

  public renderList() {
    const { i18n, ourNumber } = this.props;
    const { userEvent, nonParticipants } = this.state;
    if (userEvent === undefined || nonParticipants === undefined) {
      return null;
    }

    const ueCount = new Set();
    let ueList = [];
    for (let i = 0; i < userEvent.length; i++) {
      let uid = userEvent[i].account;
      if (uid.startsWith('mac')) {
        uid = uid.replace('mac', '');
      }
      if (uid.startsWith('ios')) {
        uid = uid.replace('ios', '');
      }
      if (uid.startsWith('android')) {
        uid = uid.replace('android', '');
      }
      ueCount.add(uid);
      const c = this.getConversation('+' + uid);
      let name = '+' + uid;
      if (c) {
        name = c.get('name') || '+' + uid;
        if (c.id === ourNumber) {
          name = i18n('you');
        }
      }

      // message middle
      const notifyMiddle =
        userEvent[i].event === 'join'
          ? i18n('groupNotifyMeetingUserJoin')
          : i18n('groupNotifyMeetingUserLeave');

      // timestamp format
      const d = new Date(userEvent[i].timestamp);
      // 整数格式化，前面补零
      const intToFix = (num: number, length: number) => {
        return ('' + num).length < length
          ? (new Array(length + 1).join('0') + num).slice(-length)
          : '' + num;
      };
      const timeStr = ` ${d.getHours()}:${intToFix(
        d.getMinutes(),
        2
      )}:${intToFix(d.getSeconds(), 2)}`;

      ueList.push(
        <div key={i + 'ue'} className={'item'}>
          <span className={'time'}>{timeStr + ' '}</span>
          <span>{getWebUserDisplayName(name) + notifyMiddle}</span>
        </div>
      );
    }

    let npList = [];
    for (let i = 0; i < nonParticipants.length; i++) {
      const c = this.getConversation(nonParticipants[i]);
      let name = nonParticipants[i];
      if (c) {
        name = c.get('name') || nonParticipants[i];
        if (c.id === ourNumber) {
          name = i18n('you');
        }
      }
      npList.push(
        <div key={i + 'np'} className={'item'}>
          <span>{getWebUserDisplayName(name)}</span>
        </div>
      );
    }

    return (
      <div className={'member-list'}>
        <div className={'title'}>
          {i18n('groupMeetingInMeeting') + '(' + ueCount.size + ')'}
        </div>
        {ueList}
        <div className={'title'}>
          {i18n('groupMeetingNotInMeeting') +
            '(' +
            nonParticipants.length +
            ')'}
        </div>
        {npList}
      </div>
    );
  }

  public render() {
    const { onCancel } = this.props;
    const { operationLoading } = this.state;

    return (
      <PollModal onClose={onCancel} escClose={!operationLoading}>
        <div className="join-leave-meeting-dialog">
          {this.renderOperationLoading()}
          {this.renderCloseBtn()}
          {this.renderFreshBtn()}
          {this.renderTitle()}
          {this.renderList()}
        </div>
      </PollModal>
    );
  }
}
