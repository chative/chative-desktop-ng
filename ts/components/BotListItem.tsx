import React /*, { useEffect, useState } */ from 'react';
import classNames from 'classnames';

import { Avatar } from './Avatar';
import { MessageBody } from './conversation/MessageBody';
import { ContactName } from './conversation/ContactName';
import { TypingAnimation } from './conversation/TypingAnimation';

import { LocalizerType } from '../types/Util';
import { MeetingType, SearchMacthInfoType } from '../state/ducks/conversations';
import { pick } from 'lodash';

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

  isSelected: boolean;

  isTyping: boolean;
  meetingStatus?: MeetingType | null;
  notificationSetting?: number;
  firstMatch?: SearchMacthInfoType;
  members?: any;
  ext?: any;
  isGroupOwnerSelect?: any;
  searchValue?: string;
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

export class BotListItem extends React.Component<Props> {
  public meetingStatus: any;
  public wrapperRef: React.RefObject<HTMLDivElement>;
  private clickTimeout: NodeJS.Timeout | null;

  public constructor(props: Props) {
    super(props);
    this.meetingStatus = null;
    this.wrapperRef = React.createRef();
    this.handleClick = this.handleClick.bind(this);
    this.clickTimeout = null;
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
      </div>
    );
  }

  public renderFirstMatchContent(isHeaderHighLight: boolean) {
    const { name, searchValue, signature, id } = this.props;
    let displayContent = [];

    const title = isHeaderHighLight ? name : signature ? signature : id;

    let keyWordPostion = -1;

    if (typeof searchValue === 'string') {
      if (isHeaderHighLight) {
        // @ts-ignore
        keyWordPostion = name?.toLowerCase().indexOf(searchValue.toLowerCase());
      } else {
        // @ts-ignore
        keyWordPostion = signature
          ?.toLowerCase()
          .indexOf(searchValue.toLowerCase());
      }
    }
    // @ts-ignore
    if (searchValue.length == 0) {
      return [];
    }
    displayContent = this.renderHighlightBody(
      isHeaderHighLight
        ? 'module-contact-list-item__text__name'
        : 'module-contact-list-item__text__additional-data',
      'module-contact-list-item__text__name__highlight',
      title ?? '',
      searchValue,
      !isHeaderHighLight && !signature ? -1 : keyWordPostion
    );
    return displayContent;
  }

  public renderHeader() {
    const { id, i18n, name, profileName, meetingStatus } = this.props;

    this.meetingStatus = meetingStatus;
    let isOutside;
    const displayContent = this.renderFirstMatchContent(true);

    return (
      <div className="module-conversation-list-item__header">
        <div
          className={classNames('module-conversation-list-item__header__name')}
        >
          {displayContent.length > 0 ? (
            displayContent
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
      </div>
    );
  }

  public renderHighlightBody(
    normalClasName: string,
    highlightClassName: string,
    displayText: string,
    keyWord: string | undefined,
    position: number
  ) {
    const results: Array<JSX.Element> = [];

    if (
      position !== -1 &&
      position < displayText.length &&
      keyWord &&
      keyWord.length
    ) {
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

  public renderSignature() {
    const { isTyping, i18n, notificationSetting, signature, searchValue, id } =
      this.props;
    if (searchValue) {
      const displayContentArray = this.renderFirstMatchContent(false);
      return (
        <div className="module-contact-list-item__text__additional-data">
          {displayContentArray}
        </div>
      );
    }
    return (
      <div className="module-conversation-list-item__message">
        <div
          className={classNames('module-conversation-list-item__message__text')}
        >
          {isTyping ? (
            <TypingAnimation i18n={i18n} />
          ) : (
            <MessageBody
              text={signature || id}
              disableJumbomoji={true}
              disableLinks={true}
              i18n={i18n}
              notificationSetting={notificationSetting}
            />
          )}
        </div>
      </div>
    );
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
    const { onClick, onDoubleClick, id, /*isSelected*/ style } = this.props;

    return (
      <div
        ref={this.wrapperRef}
        role="button"
        onMouseDown={event => {
          console.log('BotListItem.tx onMouseDown.');
          const clickEvent = pick(event || {}, ['button', 'pageX', 'pageY']);

          if (event?.button === 2) {
            // right click
            if (onClick) {
              onClick(id, clickEvent);
            }
          } else {
            if (this.clickTimeout) {
              console.log('BotListItem.tx this.clickTimeout NOT NULL.');
            }

            if (!this.clickTimeout && onClick) {
              this.clickTimeout = setTimeout(() => {
                onClick(id, clickEvent);
                this.clickTimeout = null;
              }, 300);
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
        style={{ ...style, left: '8px', width: '99%' }}
        className={classNames(
          'module-bot-list-item'
          // isSelected ? 'module-conversation-list-item--is-selected' : null
        )}
      >
        {this.renderAvatar()}
        <div className="module-conversation-list-item__content">
          {this.renderHeader()}
          {this.renderSignature()}
        </div>
      </div>
    );
  }
}
