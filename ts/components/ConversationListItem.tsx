import React from 'react';
import classNames from 'classnames';

import { Avatar } from './Avatar';
import { MessageBody } from './conversation/MessageBody';
import { Timestamp } from './conversation/Timestamp';
import { ContactName } from './conversation/ContactName';
import { TypingAnimation } from './conversation/TypingAnimation';

import { LocalizerType } from '../types/Util';
import {
  ConversationType,
  MeetingType,
  SearchMacthInfoType,
  ProtectedConfigs,
} from '../state/ducks/conversations';
import { pick } from 'lodash';
import MeetingTimer from './MeetingTimer';

export type PropsData = {
  id: string;
  phoneNumber: string;
  color?: string;
  profileName?: string;
  name?: string;
  type: 'group' | 'direct';
  avatarPath?: string;
  isMe: boolean;
  signature?: string;
  timeZone?: string;

  lastUpdated: number;
  unreadCount: number;
  isSelected: boolean;

  isTyping: boolean;
  lastMessage?: {
    status: 'sending' | 'sent' | 'delivered' | 'read' | 'error';
    text: string;
  };
  atPersons?: string;
  ourNumber?: string;
  meetingStatus?: MeetingType | null;
  email?: string;
  searchResultOfContacts?: boolean;
  searchResultOfRecent?: boolean;
  isStick?: boolean;
  isMute?: boolean;
  notificationSetting?: number;
  firstMatch?: SearchMacthInfoType;
  searchResultMembers?: Array<ConversationType>;
  draft?: string;
  draftQuotedMessageId?: string;
  protectedConfigs?: ProtectedConfigs;
  members?: any;
  directoryUser?: any;
  searchResult?: boolean;
  extId?: any;
  ext?: any;
  isGroupOwnerSelect?: any;
  isMyGroup?: boolean;
};

export type ClickEvent = {
  button: number;
  pageX: number;
  pageY: number;
};

type PropsHousekeeping = {
  i18n: LocalizerType;
  style?: Object;
  onClick?: (id: string, event?: ClickEvent) => void;
  onDoubleClick?: (id: string, event?: any) => void;
};

type Props = PropsData & PropsHousekeeping;
export class ConversationListItem extends React.Component<Props> {
  public meetingStatus: any;
  public wrapperRef: React.RefObject<HTMLDivElement>;
  private clickTimeout: NodeJS.Timeout | null;

  public constructor(props: Props) {
    super(props);
    this.onJoinMeeting = this.onJoinMeeting.bind(this);
    this.meetingStatus = null;
    this.wrapperRef = React.createRef();
    this.handleClick = this.handleClick.bind(this);
    this.clickTimeout = null;
  }

  public onJoinMeeting() {
    const { ourNumber, name, id } = this.props;
    // if ((window as any).Signal.OS.isLinux()) {
    //   alert((window as any).i18n('meeting-linux-not-support'));
    //   return;
    // }

    if (this.meetingStatus) {
      let serverToken;
      if ((window as any).textsecure && (window as any).textsecure.messaging) {
        serverToken = (
          window as any
        ).textsecure.messaging.getServerTokenDirect();
      }

      // 1v1 计时按钮快速入会（对方切换成群模式后）
      let callerId;
      if (this.props.type === 'direct' && ourNumber) {
        const { meetingType, privateUsers: invite } = this.meetingStatus || {};
        const myID = ourNumber.replace('+', '');
        if (
          meetingType === 'private' &&
          invite &&
          Array.isArray(invite) &&
          invite.length === 2 &&
          invite.includes(myID)
        ) {
          const index = invite.indexOf(myID) === 0 ? 1 : 0;
          callerId = '+' + invite[index];
        }

        if (!callerId) {
          console.log(
            'ConversationListItem.tsx private onJoinMeeting NOT FOUND callerId:' +
              JSON.stringify(this.meetingStatus)
          );
          return;
        }
      }

      let meetingName = this.meetingStatus.name;
      if (this.props.type === 'direct') {
        meetingName = name || id;
      }

      const callOptions = {
        callType: 'passive',
        isPrivate: false,
        // groupMembers: [{ self: true, id: this.props.ourNumber }],
        meetingName,
        channelName: this.meetingStatus.channelName,
        serverToken,
        meetingId: this.meetingStatus.meetingId,
        callerId,
      };
      //alert(JSON.stringify(this.meetingStatus));

      (window as any).dispatchBeforeJoinMeeting(callOptions);

      // window.dispatchEvent(
      //   new CustomEvent('before-join-meeting', { detail: callOptions })
      // );

      // (window as any).showCallVoiceGroup();
    }
  }

  public renderAvatar() {
    const {
      id,
      avatarPath,
      color,
      type,
      i18n,
      isMe,
      name,
      profileName,
      isGroupOwnerSelect,
    } = this.props;

    let groupMembersCount;
    if (type === 'group') {
      const c = (window as any).ConversationController.get(id);
      let selfLeft = c?.isMeLeftGroup();
      // already left group does not show members count
      if (!c.isPrivate() && !selfLeft) {
        groupMembersCount = c?.get('membersV2')?.length;
      }
    }

    return (
      <div className="module-conversation-list-item__avatar-container">
        <Avatar
          id={id}
          avatarPath={avatarPath}
          color={color}
          noteToSelf={isGroupOwnerSelect ? false : isMe}
          conversationType={type}
          i18n={i18n}
          name={name}
          profileName={profileName}
          size={36}
          noClickEvent={true}
          groupMembersCount={groupMembersCount}
        />
        {/* {this.renderUnread()} */}
      </div>
    );
  }

  public renderUnread() {
    const { unreadCount, isMute } = this.props;
    if (unreadCount > 0) {
      return (
        <div
          className={
            !isMute
              ? 'module-conversation-list-item__unread-count'
              : 'module-conversation-list-item__unread-count-atMeOrOff'
          }
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </div>
      );
    }
    return null;
  }

  public renderHeader() {
    const {
      id,
      type,
      unreadCount,
      i18n,
      isMe,
      lastUpdated,
      name,
      profileName,
      meetingStatus,
      timeZone,
      searchResultOfContacts,
      searchResultOfRecent,
      ext,
      searchResult,
      extId,
      isGroupOwnerSelect,
      isMyGroup,
    } = this.props;

    this.meetingStatus = meetingStatus;

    const showLocalTime = searchResultOfContacts || searchResultOfRecent;
    const showDateTime = type !== 'group';
    const displayContent = this.renderFirstMatchContent(false);
    let isOutside;
    // 搜索不显示标签
    if (!searchResult) {
      if (type === 'group') {
        isOutside = ext;
      } else {
        isOutside = (window as any).ConversationController.get(id).isOutside(
          extId
        );
      }
    }

    const isInCurrentMeetingNow =
      meetingStatus &&
      meetingStatus.channelName === (window as any).currentMeetingChannelName;

    return (
      <div className="module-conversation-list-item__header">
        <div
          className={classNames(
            'module-conversation-list-item__header__name',
            unreadCount > 0
              ? 'module-conversation-list-item__header__name--with-unread'
              : null
          )}
        >
          {displayContent.length > 0 ? (
            displayContent
          ) : isMe && !isGroupOwnerSelect ? (
            i18n('noteToSelf')
          ) : (
            <ContactName
              phoneNumber={id}
              name={name}
              profileName={profileName}
              i18n={i18n}
              isOutside={isOutside}
            />
          )}
        </div>

        {!isMyGroup ? (
          <div
            className={classNames(
              'module-conversation-list-item__header__date',
              unreadCount > 0
                ? 'module-conversation-list-item__header__date--has-unread'
                : null
            )}
          >
            {meetingStatus && meetingStatus.meetingType != 'private' ? (
              <div
                className={classNames(
                  'module-left-pane__meeting-status-float-right'
                )}
              >
                <span className="online">
                  {type !== 'direct' ? meetingStatus.online || '' : ''}
                </span>
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
            ) : ///Just Date
            showLocalTime ? (
              showDateTime ? (
                <div className="module-contact-list-item__header__date">
                  {this.transferTimeZone(timeZone ?? '')}
                </div>
              ) : null
            ) : (
              <Timestamp
                timestamp={lastUpdated}
                extended={false}
                module="module-conversation-list-item__header__timestamp"
                i18n={i18n}
              />
            )}
          </div>
        ) : null}
      </div>
    );
  }

  public getMessagePreview(): { text: string; suffixType?: any } {
    const { atPersons, unreadCount, ourNumber, lastMessage } = this.props;

    if (unreadCount && atPersons?.length) {
      if (ourNumber?.length && atPersons.includes(ourNumber)) {
        return {
          text: lastMessage?.text || '',
          suffixType: 'atYou',
        };
      }

      if (atPersons.includes('MENTIONS_ALL')) {
        return {
          text: lastMessage?.text || '',
          suffixType: 'atAll',
        };
      }
    }

    const { draft, draftQuotedMessageId } = this.props;
    if (draft || draftQuotedMessageId) {
      return {
        text: draft || '',
        suffixType: 'draft',
      };
    }

    return {
      text: lastMessage?.text || '',
    };
  }

  public renderHighlightBody(
    normalClasName: string,
    highlightClassName: string,
    displayText: string,
    keyWord: string,
    position: number
  ) {
    const results: Array<JSX.Element> = [];

    if (position !== -1 && position < displayText.length && keyWord.length) {
      results.push(
        <span className={normalClasName} key={normalClasName + 'pre'}>
          {displayText.substring(0, position)}
        </span>
      );
      results.push(
        <span className={highlightClassName} key={highlightClassName}>
          {displayText.substring(position, position + keyWord.length)}
        </span>
      );
      results.push(
        <span className={normalClasName} key={normalClasName + 'suf'}>
          {displayText.substring(position + keyWord.length, displayText.length)}
        </span>
      );
    } else {
      results.push(
        <span className={normalClasName} key={normalClasName}>
          {displayText}
        </span>
      );
    }
    return results;
  }

  public getDisplayExtraInfo(items: Array<any>, limit: number) {
    let result = Array<JSX.Element>();
    items.forEach(element => {
      if (element && element.length > 0 && result.length < limit) {
        result.push(
          <div
            className="module-contact-list-item__text__additional-data"
            key={
              'module-contact-list-item__text__additional-data__extraInfo' +
              result.length
            }
          >
            {/* {element} */}
          </div>
        );
      }
    });
    return result;
  }

  public transferTimeZone = (timeZoneStr: string) => {
    const { i18n } = this.props;
    // 整数格式化，前面补零
    const fn = (num: number, length: number) => {
      return ('' + num).length < length
        ? (new Array(length + 1).join('0') + num).slice(-length)
        : '' + num;
    };

    let timeZone: any = parseFloat(timeZoneStr);
    if (!timeZone && timeZone !== 0) {
      return undefined;
    }

    // 可能会有半时区，1/4时区，3/4时区的情况，需要转化为float处理
    timeZone = parseFloat(timeZone.toFixed(2));

    if (timeZone >= -12 && timeZone <= 14) {
      const date = new Date(Date.now() + timeZone * 60 * 60 * 1000);

      let hours = date.getUTCHours();
      const minutes = fn(date.getUTCMinutes(), 2);

      if (hours === 12) {
        return i18n('time_format_noon', ['12:' + minutes]);
      }
      if (hours === 0) {
        return i18n('time_format_midnight', ['12:' + minutes]);
      }
      if (hours < 12) {
        return i18n('time_format_am', [hours + ':' + minutes]);
      }
      if (hours > 12) {
        return i18n('time_format_pm', [(hours % 12) + ':' + minutes]);
      }
    }

    return undefined;
  };

  public renderFirstMatchContent(isExtraInfo: boolean) {
    const {
      i18n,
      isMe,
      name,
      email,
      id,
      firstMatch,
      protectedConfigs,
      signature,
      isGroupOwnerSelect,
    } = this.props;

    let displayContent = [];

    const title = name ? name : id;
    const displayName =
      isMe && !isGroupOwnerSelect ? i18n('noteToSelf') : title;

    const matchValue = firstMatch && firstMatch.value ? firstMatch.value : '';
    const searchTerm =
      firstMatch && firstMatch.searchWord ? firstMatch.searchWord : '';
    const keyWordPostion = firstMatch ? firstMatch.position : -1;

    if (searchTerm.length == 0) {
      return [];
    }

    if (!isExtraInfo) {
      if (matchValue !== displayName) {
        return [];
      }
      displayContent = this.renderHighlightBody(
        'module-contact-list-item__text__name',
        'module-contact-list-item__text__name__highlight',
        displayName ?? '',
        searchTerm,
        keyWordPostion
      );
    } else {
      const highlight = this.renderHighlightBody(
        'module-contact-list-item__text__additional-data',
        'module-contact-list-item__text__additional-data__highlight',
        matchValue,
        searchTerm,
        keyWordPostion
      );
      if (id === matchValue) {
        if (signature) {
          displayContent.push(...this.getDisplayExtraInfo([signature], 1));
          displayContent.push(...highlight);
        } else {
          displayContent.push(...highlight);
          const infoArray = [
            email,
            protectedConfigs?.staff?.buNamePaths?.slice(-1),
            protectedConfigs?.staff?.groupNamePaths?.slice(-1),
            protectedConfigs?.staff?.directParentName,
          ];
          displayContent.push(...this.getDisplayExtraInfo(infoArray, 1));
        }
      } else if (protectedConfigs?.staff?.buNamePaths?.includes(matchValue)) {
        if (signature) {
          displayContent.push(...this.getDisplayExtraInfo([signature], 1));
          displayContent.push(...highlight);
        } else {
          displayContent.push(...highlight);
          const infoArray = [
            email,
            protectedConfigs?.staff?.groupNamePaths?.slice(-1),
            protectedConfigs?.staff?.directParentName,
            id,
          ];
          displayContent.push(...this.getDisplayExtraInfo(infoArray, 1));
        }
      } else {
        const buInfo = protectedConfigs?.staff?.buNamePaths?.slice(-1)[0];
        const depInfo = protectedConfigs?.staff?.groupNamePaths?.slice(-1)[0];
        const leaderInfo = protectedConfigs?.staff?.directParentName;

        const infoArray = [
          signature !== matchValue ? signature : undefined,
          email !== matchValue ? email : undefined,
          buInfo !== matchValue ? buInfo : undefined,
          depInfo !== matchValue ? depInfo : undefined,
          leaderInfo !== matchValue ? leaderInfo : undefined,
          id !== matchValue ? id : undefined,
        ];
        if (displayName === matchValue) {
          displayContent.push(...this.getDisplayExtraInfo(infoArray, 2));
        } else {
          displayContent.push(...this.getDisplayExtraInfo(infoArray, 1));
          displayContent.push(...highlight);
        }
      }
    }
    return displayContent;
  }

  public renderMessage() {
    const {
      lastMessage,
      // email,
      // id,
      isTyping,
      i18n,
      searchResultOfContacts,
      searchResultOfRecent,
      type,
      searchResultMembers,
      notificationSetting,
      draft,
      firstMatch,
    } = this.props;

    const isRecentContact = searchResultOfRecent && type !== 'group';

    if (searchResultOfContacts || isRecentContact) {
      let text: string = '';
      if (type === 'group') {
        if (searchResultMembers?.length) {
          text = i18n('searchResultIncludes');
          text += searchResultMembers
            .map(m => m.firstMatch?.value)
            .reduce((previous, current) => {
              if (previous) {
                return previous + ',' + current;
              }

              return current;
            }, '');
        }
      } else {
        //text = email || id;
        text = ' ';
        if (firstMatch) {
          const displayContentArray = this.renderFirstMatchContent(true);
          return (
            <div className="module-contact-list-item__text__additional-data">
              {displayContentArray}
            </div>
          );
        }
      }

      if (!text) {
        return null;
      }

      return (
        <div className="module-conversation-list-item__message">
          <div
            className={classNames(
              'module-conversation-list-item__message__text'
            )}
          >
            <MessageBody
              text={text}
              disableJumbomoji={true}
              disableLinks={true}
              i18n={i18n}
              notificationSetting={notificationSetting}
            />
          </div>
        </div>
      );
    }

    if (!lastMessage && !isTyping && !draft) {
      return null;
    }

    const preview = this.getMessagePreview();

    return (
      <div className="module-conversation-list-item__message">
        <div
          className={classNames(
            'module-conversation-list-item__message__text'
            // unreadCount > 0
            //   ? 'module-conversation-list-item__message__text--has-unread'
            //   : null
          )}
        >
          {isTyping ? (
            <TypingAnimation i18n={i18n} />
          ) : (
            <MessageBody
              text={preview.text}
              suffixType={preview.suffixType}
              disableJumbomoji={true}
              disableLinks={true}
              i18n={i18n}
              notificationSetting={notificationSetting}
            />
          )}
          {this.renderUnread()}
        </div>
        {/*  design changed: do not show status anymore
        {lastMessage && lastMessage.status ? (
          <div
            className={classNames(
              'module-conversation-list-item__message__status-icon',
              `module-conversation-list-item__message__status-icon--${
                lastMessage.status
              }`
            )}
          />
        ) : null} */}
      </div>
    );
  }

  public renderStick() {
    const { isStick } = this.props;
    if (isStick) {
      return (
        <span
          style={{
            position: 'absolute',
            right: '10px',
            top: '2px',
            borderRadius: '3px',
            width: '12px',
            height: '12px',
            border: '6px solid transparent',
            borderTopColor: '#2090ea',
            borderBottomColor: 'transparent',
            borderLeftColor: 'transparent',
            borderRightColor: '#2090ea',
          }}
        />
      );
    }
    return null;
  }

  handleClick(event: MouseEvent) {
    if (event && event.button === 0) {
      $('.module-conversation-list-item').css('outline', 'none');
    }
    if (
      event &&
      event.button === 2 &&
      this.wrapperRef?.current &&
      this.wrapperRef.current.contains(event.target as Node)
    ) {
      // 右击
      $('.module-conversation-list-item').css('outline', 'none');
      this.wrapperRef.current.style.outline = '#2090ea solid 1px';
      this.wrapperRef.current.style.outlineOffset = '-1px';
      window.dispatchEvent(
        new CustomEvent('conversation-operation', {
          detail: { event, refCurrent: this.wrapperRef.current },
        })
      );
    }
  }

  componentDidMount() {
    document.addEventListener('mousedown', this.handleClick);
  }

  componentWillUnmount() {
    document.removeEventListener('mousedown', this.handleClick);
  }

  public render() {
    const {
      /*unreadCount,*/ onClick,
      onDoubleClick,
      id,
      isSelected,
      style,
      isMyGroup,
    } = this.props;

    return (
      <div
        ref={this.wrapperRef}
        role="button"
        onMouseDown={event => {
          console.log('ConversationListItem.tx onMouseDown.');
          const clickEvent = pick(event || {}, ['button', 'pageX', 'pageY']);

          if (event?.button === 2) {
            // right click
            if (onClick) {
              onClick(id, clickEvent);
            }
          } else {
            if (this.clickTimeout) {
              console.log(
                'ConversationListItem.tx this.clickTimeout NOT NULL.'
              );
            }

            if (!this.clickTimeout && onClick) {
              this.clickTimeout = setTimeout(() => {
                onClick(id, clickEvent);
                this.clickTimeout = null;
              }, 200);
            }
          }
        }}
        onDoubleClick={event => {
          if (this.clickTimeout) {
            clearTimeout(this.clickTimeout);
            this.clickTimeout = null;
          }

          if (onDoubleClick) {
            onDoubleClick(id, event);
          }
        }}
        style={{ ...style, left: '8px', width: isMyGroup ? '99%' : '97%' }}
        className={classNames(
          'module-conversation-list-item',
          // unreadCount > 0 ? 'module-conversation-list-item--has-unread' : null,
          isSelected ? 'module-conversation-list-item--is-selected' : null
        )}
      >
        {this.renderAvatar()}
        <div className="module-conversation-list-item__content">
          {this.renderHeader()}
          {!isMyGroup ? this.renderMessage() : null}
        </div>
        {this.renderStick()}
      </div>
    );
  }
}
