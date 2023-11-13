import React from 'react';
import classNames from 'classnames';

import { Avatar } from './Avatar';

import { LocalizerType } from '../types/Util';

interface Props {
  phoneNumber: string;
  isMe?: boolean;
  name?: string;
  color: string;
  verified: boolean;
  profileName?: string;
  avatarPath?: string;
  id?: string;
  i18n: LocalizerType;
  onClick?: () => void;
  showCloseBtn?: boolean;
  email?: string;
}

export class ChooseContactListItem extends React.Component<Props> {
  public renderAvatar() {
    const { avatarPath, i18n, color, name, profileName, id } = this.props;

    return (
      <Avatar
        avatarPath={avatarPath}
        color={color}
        conversationType="direct"
        i18n={i18n}
        name={name}
        profileName={profileName}
        size={36}
        id={id}
        noClickEvent={true}
      />
    );
  }

  public renderCloseBtn() {
    const { showCloseBtn } = this.props;

    if (showCloseBtn) {
      return (
        <div style={{ flexGrow: 1, textAlign: 'right' }}>
          {/* tslint:disable-next-line:react-a11y-anchors */}
          <a className="x" style={{ position: 'relative', top: 0, right: 0 }} />
        </div>
      );
    }
    return null;
  }

  public render() {
    const {
      i18n,
      name,
      onClick,
      isMe,
      phoneNumber,
      profileName,
      verified,
      email,
    } = this.props;

    const title = name ? name : phoneNumber;
    const displayName = isMe ? i18n('me') : title;

    const profileElement =
      !isMe && profileName && !name ? (
        <span className="module-contact-list-item__text__profile-name">
          ~{profileName}
        </span>
      ) : null;

    const showNumber = isMe || name;
    const showVerified = !isMe && verified;
    const emailOrNumber = email ? email : phoneNumber;

    return (
      <div
        role="button"
        onClick={onClick}
        className={classNames(
          'module-contact-list-item',
          onClick ? 'module-contact-list-item--with-click-handler' : null
        )}
      >
        {this.renderAvatar()}
        <div
          className="module-contact-list-item__text"
          // text item length = 100% - avatar width - margin width
          style={{ width: 'calc(100% - 48px - 28px)' }}
        >
          <div className="module-contact-list-item__text__name">
            {displayName} {profileElement}
          </div>
          <div className="module-contact-list-item__text__additional-data">
            {showVerified ? (
              <div className="module-contact-list-item__text__verified-icon" />
            ) : null}
            {showVerified ? ` ${i18n('verified')}` : null}
            {showVerified && showNumber ? ' ∙ ' : null}
            {showNumber ? emailOrNumber : null}
          </div>
        </div>
        {this.renderCloseBtn()}
      </div>
    );
  }
}
