import React from 'react';
// import classNames from 'classnames';

import { ContactName } from './ContactName';
import { Intl } from '../Intl';
import { LocalizerType } from '../../types/Util';

interface Contact {
  phoneNumber: string;
  profileName?: string;
  name?: string;
}

interface Props {
  isGroup: boolean;
  contact: Contact;
  i18n: LocalizerType;
  onVerify: () => void;
}

export class SafetyNumberNotification extends React.Component<Props> {
  public render() {
    const { contact, isGroup, i18n, onVerify } = this.props;
    const changeKey = isGroup
      ? 'safetyNumberChangedGroup'
      : 'safetyNumberChanged';

    return (
      <div className="module-safety-number-notification">
        <div className="module-safety-number-notification__icon" />
        <div className="module-safety-number-notification__text">
          <Intl
            id={changeKey}
            components={[
              <span
                key="external-1"
                className="module-safety-number-notification__contact"
              >
                <ContactName
                  i18n={i18n}
                  name={contact.name}
                  profileName={contact.profileName}
                  phoneNumber={contact.phoneNumber}
                  module="module-verification-notification__contact"
                  inMessage
                />
              </span>,
            ]}
            i18n={i18n}
          />
        </div>
        <div
          role="button"
          onClick={onVerify}
          className="module-verification-notification__button"
        >
          {i18n('verifyNewNumber')}
        </div>
      </div>
    );
  }
}
