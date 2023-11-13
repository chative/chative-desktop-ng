import React from 'react';

import { LocalizerType } from '../../types/Util';
import { Tag } from '../Tag';
import { GroupRapidTag } from '../GroupRapidTga';
import classNames from 'classnames';
interface Props {
  phoneNumber: string;
  name?: string;
  profileName?: string;
  i18n: LocalizerType;
  module?: string;
  groupRapidRole?: number;
  isOutside?: any;
  inMessage?: any;
  inSearch?: any;
  sourceBrief?: string;
  botId?: string;
  groupId?: string;
  groupName?: string;
  supportType?: any;
}

export class ContactName extends React.Component<Props> {
  public render() {
    const {
      phoneNumber,
      name,
      profileName,
      module,
      isOutside,
      groupRapidRole,
      i18n,
      inMessage,
      inSearch,
      sourceBrief,
      botId,
      groupId,
      groupName,
      supportType,
    } = this.props;

    const prefix = module
      ? module
      : inMessage
      ? 'module-contact-name-in-message'
      : 'module-contact-name';

    let title;
    if (botId && !groupId && supportType) {
      title = 'From ' + name;
    } else if (botId && groupId && supportType) {
      title = 'From ' + groupName + '/' + name;
    } else {
      title =
        name && sourceBrief
          ? name + ' : ' + sourceBrief
          : name
          ? name
          : phoneNumber;
    }

    const shouldShowProfile = Boolean(profileName && !name);
    const profileElement = shouldShowProfile ? (
      <span className={`${prefix}__profile-name`}>~{profileName || ''}</span>
    ) : null;

    return (
      <div className={prefix} dir="auto">
        <div
          className={classNames(
            !inMessage && 'module-contact-name-outside-rapid',
            inMessage && 'module-contact-name-outside-rapid-message'
          )}
        >
          {title}
          {shouldShowProfile ? ' ' : null}
          {profileElement}
        </div>
        {!inSearch && isOutside && (
          <div className={'contact-name-tag-box'}>
            <Tag i18n={i18n} tagName={'external'} showTips />
          </div>
        )}
        {!inSearch && Boolean(groupRapidRole) && (
          <div className={'contact-name-tag-box'}>
            <GroupRapidTag i18n={i18n} rapidRole={groupRapidRole} showTips />
          </div>
        )}
      </div>
    );
  }
}
