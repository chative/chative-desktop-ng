import React from 'react';
import classNames from 'classnames';

import { Avatar } from './Avatar';
import { ContactName } from './conversation/ContactName';
import { LocalizerType } from '../types/Util';
import { MeetingType } from '../state/ducks/conversations';
import MeetingTimer from './MeetingTimer';

export type PropsData = {
  ourNumber: string;
  meetingStatus: MeetingType | null;
};

type PropsHousekeeping = {
  i18n: LocalizerType;
  style?: Object;
};

type Props = PropsData & PropsHousekeeping;

export class ConversationListInstantMeetingItem extends React.Component<Props> {
  public meetingStatus: any;

  public constructor(props: Props) {
    super(props);
    this.onJoinMeeting = this.onJoinMeeting.bind(this);
  }

  public onJoinMeeting() {
    const { meetingStatus } = this.props;
    // if ((window as any).Signal.OS.isLinux()) {
    //   alert((window as any).i18n('meeting-linux-not-support'));
    //   return;
    // }
    if (meetingStatus) {
      let serverToken;
      if ((window as any).textsecure && (window as any).textsecure.messaging) {
        serverToken = (
          window as any
        ).textsecure.messaging.getServerTokenDirect();
      }

      const callOptions = {
        callType: 'passive',
        isPrivate: false,
        // groupMembers: [{ self: true, id: this.props.ourNumber }],
        meetingName: meetingStatus.name,
        channelName: meetingStatus.channelName,
        serverToken,
      };

      (window as any).dispatchBeforeJoinMeeting(callOptions);
      // window.dispatchEvent(
      //   new CustomEvent('before-join-meeting', { detail: callOptions })
      // );

      // (window as any).showCallVoiceGroup();
    }
  }

  public renderAvatar() {
    const { meetingStatus, i18n } = this.props;

    if (!meetingStatus) {
      return null;
    }

    return (
      <div className="module-conversation-list-item__avatar-container">
        <Avatar
          name={meetingStatus.name || 'Chative Meeting'}
          color="grey"
          conversationType="direct"
          i18n={i18n}
          nonImageType="instant-meeting"
          size={36}
        />
      </div>
    );
  }

  public renderHeader() {
    const { i18n, meetingStatus } = this.props;

    this.meetingStatus = meetingStatus;
    if (!meetingStatus) {
      return null;
    }

    const isInCurrentMeetingNow =
      meetingStatus &&
      meetingStatus.channelName === (window as any).currentMeetingChannelName;

    return (
      <div className="module-conversation-list-item__header">
        <div
          className={classNames('module-conversation-list-item__header__name')}
        >
          <ContactName
            phoneNumber={''}
            name={meetingStatus.name || 'Chative Meeting'}
            profileName={undefined}
            i18n={i18n}
          />
        </div>
        <div
          className={classNames('module-conversation-list-item__header__date')}
        >
          <div
            className={classNames(
              'module-left-pane__meeting-status-float-right'
            )}
          >
            <span className="online">{meetingStatus.online || ''}</span>
            <span
              role={'button'}
              className="duration"
              onClick={this.onJoinMeeting}
            >
              {meetingStatus.startAt && isInCurrentMeetingNow ? (
                <MeetingTimer startAt={meetingStatus.startAt} />
              ) : (
                'Join'
              )}
              {/*{formatDurationSeconds(meetingStatus.startAt)}*/}
            </span>
          </div>
        </div>
      </div>
    );
  }

  public render() {
    const { style } = this.props;

    return (
      <div
        role="button"
        style={{ ...style, left: '8px', width: '97%' }}
        className={classNames('module-conversation-list-item')}
      >
        {this.renderAvatar()}
        <div className="module-conversation-list-item__content">
          {this.renderHeader()}
        </div>
      </div>
    );
  }
}
