import React from 'react';
import classNames from 'classnames';

import { Avatar } from './Avatar';

import { LocalizerType } from '../types/Util';
import {
  SearchMacthInfoType,
  ProtectedConfigs,
} from '../state/ducks/conversations';
import { GroupRapidTag } from './GroupRapidTga';
import { Tag } from './Tag';

interface Props {
  phoneNumber: string;
  id?: string;
  isMe?: boolean;
  name?: string;
  color: string;
  verified: boolean;
  profileName?: string;
  avatarPath?: string;
  i18n: LocalizerType;
  onClick?: (event?: any) => void;
  style?: object;
  groupChats?: boolean;
  allBots?: boolean;
  email?: string;
  signature?: string;
  archiveButton?: boolean;
  notShowStatus?: boolean;
  isSelected?: boolean;
  protectedConfigs?: ProtectedConfigs;
  withCheckbox?: boolean;
  checkboxChecked?: boolean;
  disableCheckbox?: boolean;
  noHover?: boolean;
  firstMatch?: SearchMacthInfoType;
  showExtraInfo?: boolean;
  timeZone?: string;
  rapidRole?: number;
  isOutside?: any;
  isContactNewPane?: any;
  isShowTopicFlag?: boolean;
  isCreateGroup?: any;
  smallAvatar?: boolean;
}

export class ContactListItem extends React.Component<Props> {
  public renderAvatar() {
    const {
      avatarPath,
      i18n,
      color,
      name,
      profileName,
      groupChats,
      allBots,
      id,
      isMe,
      archiveButton,
      notShowStatus,
      smallAvatar,
    } = this.props;

    return (
      <Avatar
        id={id}
        avatarPath={avatarPath}
        color={color}
        conversationType="direct"
        i18n={i18n}
        name={name}
        profileName={profileName}
        size={smallAvatar ? 28 : 36}
        noteToSelf={isMe}
        groupChats={groupChats}
        allBots={allBots}
        noClickEvent={true}
        archiveButton={archiveButton}
        notShowStatus={notShowStatus}
      />
    );
  }

  public mouseDown = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    const { onClick } = this.props;
    if (onClick) {
      onClick(event);
    }
  };

  public renderCheckbox() {
    const { withCheckbox, checkboxChecked, disableCheckbox, isCreateGroup } =
      this.props;
    if (!withCheckbox) {
      return null;
    }

    return (
      <input
        className={classNames(
          'module-contact-list-item__input',
          isCreateGroup && 'check-box-border'
        )}
        type="checkbox"
        disabled={disableCheckbox}
        checked={checkboxChecked}
        onChange={() => {}}
      />
    );
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
            {element}
          </div>
        );
      }
    });
    return result;
  }

  public transferTimeZone = (timeZoneStr: string) => {
    const { i18n } = this.props;
    const fn = (num: number, length: number) => {
      return ('' + num).length < length
        ? (new Array(length + 1).join('0') + num).slice(-length)
        : '' + num;
    };

    let timeZone: any = parseFloat(timeZoneStr);
    if (!timeZone && timeZone !== 0) {
      return undefined;
    }

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

  public render() {
    const {
      id,
      i18n,
      name,
      onClick,
      isMe,
      profileName,
      verified,
      style,
      email,
      isSelected,
      noHover,
      firstMatch,
      signature,
      protectedConfigs,
      showExtraInfo,
      timeZone,
      rapidRole,
      isOutside,
      withCheckbox,
      isContactNewPane,
      isShowTopicFlag,
      isCreateGroup,
    } = this.props;

    const title = name ? name : id;
    const displayName = isMe ? i18n('noteToSelf') : title;

    let titleElements = [
      title ? (
        <div
          key={'module-contact-list-item__text__name'}
          className={classNames(
            'module-contact-list-item__text__name__standard',
            isCreateGroup &&
              'module-contact-list-item__text__name__standard-create-group'
          )}
        >
          {displayName}
        </div>
      ) : null,
    ];

    const profileElement =
      !isMe && profileName && !name ? (
        <div className="module-contact-list-item__text__profile-name">
          ~{profileName}
        </div>
      ) : null;

    const showNumber = isMe || name;
    const showVerified = !isMe && verified;
    const emailOrNumber = email ? email : id;
    let displayContent = [];
    const showMatch = firstMatch && firstMatch.field && firstMatch.value;
    const matchValue = firstMatch && firstMatch.value ? firstMatch.value : '';
    const searchTerm =
      firstMatch && firstMatch.searchWord ? firstMatch.searchWord : '';
    const keyWordPostion = firstMatch ? firstMatch.position : -1;

    if (showMatch) {
      if (displayName === matchValue) {
        titleElements = this.renderHighlightBody(
          'module-contact-list-item__text__name',
          'module-contact-list-item__text__name__highlight',
          displayName ?? '',
          searchTerm,
          keyWordPostion
        );

        const infoArray = [
          email,
          protectedConfigs?.staff?.buNamePaths?.slice(-1),
          protectedConfigs?.staff?.groupNamePaths?.slice(-1),
          protectedConfigs?.staff?.directParentName,
          id,
        ];
        displayContent = this.getDisplayExtraInfo(infoArray, 2);
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
          displayContent.push(...this.getDisplayExtraInfo(infoArray, 1));
          displayContent.push(...highlight);
        }
      }
    } else {
      displayContent = [
        <span
          className="module-contact-list-item__text__additional-data"
          key={'module-contact-list-item__text__additional-data'}
        >
          {emailOrNumber}
        </span>,
      ];
    }

    return (
      <div
        style={{ ...style, left: '8px', width: '97%' }}
        role="button"
        onMouseDown={this.mouseDown}
        className={classNames(
          'module-contact-list-item',
          isCreateGroup && 'module-contact-list-item-create-group',
          withCheckbox &&
            (rapidRole || isOutside) &&
            'module-contact-list-item-rapid-outside',
          noHover && !isSelected ? 'module-contact-list-item-no-hover' : '',
          isSelected ? 'module-conversation-list-item--is-selected' : '',
          onClick ? 'module-contact-list-item--with-click-handler' : null
        )}
      >
        {this.renderCheckbox()}
        {this.renderAvatar()}
        <div
          className={classNames(
            'module-contact-list-item__text',
            isCreateGroup && 'module-contact-list-item-create-group__text'
          )}
          // text item length = 100% - avatar width - margin width
          style={{ width: 'calc(100% - 48px - 8px)' }}
        >
          <div className="module-contact-list-item__text__header">
            <div className={classNames('module-contact-list-item__text__name')}>
              {titleElements}
              {profileElement}
            </div>
            {isOutside && (
              <div
                className={'contact-name-tag-box'}
                style={isContactNewPane ? { marginRight: '5px' } : {}}
              >
                <Tag i18n={i18n} tagName={'external'} showTips />
              </div>
            )}
            {rapidRole !== 0 && rapidRole && (
              <div className={'contact-name-tag-box'}>
                <GroupRapidTag i18n={i18n} rapidRole={rapidRole} showTips />
              </div>
            )}
            {showExtraInfo ? (
              <div
                className="module-contact-list-item__header__date"
                style={
                  isContactNewPane ? { flexGrow: 1, textAlign: 'right' } : {}
                }
              >
                {this.transferTimeZone(timeZone ?? '')}
              </div>
            ) : null}
            {isShowTopicFlag && (window as any).Signal.ID.isBotId(id) ? (
              <div className="module-contact-list-item__topic-flag">
                <div
                  role="button"
                  className={classNames('module-message__buttons__forward')}
                  style={{
                    marginRight: '4px',
                    cursor: 'none',
                    height: '20px',
                    pointerEvents: 'none',
                  }}
                />
                <span style={{ color: '#8b8e91', float: 'right' }}>Topic</span>
              </div>
            ) : null}
          </div>

          <div className="module-contact-list-item__text__additional-data">
            {showVerified ? (
              <div className="module-contact-list-item__text__verified-icon" />
            ) : null}
            {showVerified ? ` ${i18n('verified')}` : ''}
            {showVerified && showNumber ? ' ∙ ' : ''}
            {/* {displayContent}  */}
          </div>
        </div>
      </div>
    );
  }
}
