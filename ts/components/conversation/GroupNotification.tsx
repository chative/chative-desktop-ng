import React from 'react';
// import classNames from 'classnames';
import { compact, flatten } from 'lodash';

import { ContactName } from './ContactName';
import { Intl } from '../Intl';
import { LocalizerType } from '../../types/Util';

import { missingCaseError } from '../../util/missingCaseError';

interface Contact {
  phoneNumber: string;
  profileName?: string;
  name?: string;
  isMe: boolean;
}

interface Change {
  type:
    | 'add'
    | 'leave'
    | 'remove'
    | 'name'
    | 'avatar'
    | 'general'
    | 'disband'
    | 'changeOwner'
    | 'addAdmin'
    | 'removeAdmin'
    | 'addPin'
    | 'feedback'
    | 'normalString'
    | 'meetingReminder'
    | 'onlyOwnerOrAdminPublishRule'
    | 'everyonePublishRule'
    | 'groupAgendaTips';

  isMe: boolean;
  newName?: string;
  contacts?: Array<Contact>;
  pin?: any;
  scrollToMessage?: () => void;
  setFeedbackMessage?: () => void;
  feedback?: string | boolean;
  normalString?: string | undefined;
  meetingReminder: any;
  rejoin?: () => void;
  inviteCode?: any;
  publishRule?: number;
  sendHistory?: () => void;
  agendaURL?: string | undefined;
  operatorName?: string;
  isDisbandByOwner?: boolean;
}

interface Props {
  changes: Array<Change>;
  i18n: LocalizerType;
  ourNumber: string;
  isHaveHistory?: boolean;
  joinOperator?: string;
}

export class GroupNotification extends React.Component<Props> {
  hrefClickBind: (
    event: React.MouseEvent<HTMLAnchorElement, MouseEvent>
  ) => void;

  constructor(props: Readonly<Props>) {
    super(props);
    this.hrefClickBind = this.hrefClick.bind(this);
  }

  public hrefClick(event: React.MouseEvent<HTMLAnchorElement, MouseEvent>) {
    if (event && event.currentTarget && event.currentTarget.href) {
      event.preventDefault();
      event.stopPropagation();
      (window as any).sendBrowserOpenUrl(event.currentTarget.href);
    }
  }

  public renderChange(change: Change) {
    const {
      isMe,
      contacts,
      type,
      newName,
      pin,
      scrollToMessage,
      // setFeedbackMessage,
      feedback,
      normalString,
      meetingReminder,
      rejoin,
      inviteCode,
      sendHistory,
      agendaURL,
      operatorName,
      isDisbandByOwner,
    } = change;
    const { i18n, ourNumber, isHaveHistory, joinOperator } = this.props;

    const otherPeople = compact(
      flatten(
        (contacts || []).map(contact => {
          if (contact.isMe) {
            return null;
          }

          return (
            <span
              key={`external-${contact.phoneNumber}`}
              className="module-group-notification__contact"
            >
              <ContactName
                i18n={i18n}
                phoneNumber={contact.phoneNumber}
                profileName={contact.profileName}
                name={contact.name}
                inMessage
              />
            </span>
          );
        })
      )
    );

    const otherPeopleWithCommas: Array<JSX.Element | string> = compact(
      flatten(
        otherPeople.map((person, index) => [index > 0 ? ', ' : null, person])
      )
    );
    const contactsIncludesMe = (contacts || []).length !== otherPeople.length;

    switch (type) {
      case 'normalString':
        return normalString;
      case 'groupAgendaTips':
        return (
          <div>
            <span>The group has an agenda meeting, </span>
            <a href={`${agendaURL}`} onClick={this.hrefClickBind}>
              click here
            </a>
            <span> to edit participants.</span>
          </div>
        );
      case 'changeOwner':
        if (isMe) {
          return i18n('becomeNewOwnerOfTheGroup', [i18n('you')]);
        }
        if (!contacts || !contacts.length) {
          throw new Error('Group update is missing contacts');
        }
        return (
          <Intl
            i18n={i18n}
            id={'becomeNewOwnerOfTheGroup'}
            components={[otherPeopleWithCommas]}
          />
        );
      case 'addAdmin':
        if (isMe) {
          return i18n('becomeNewAdminOfTheGroup', [i18n('you')]);
        }
        if (!contacts || !contacts.length) {
          throw new Error('Group update is missing contacts');
        }
        return (
          <Intl
            i18n={i18n}
            id={'becomeNewAdminOfTheGroup'}
            components={[otherPeopleWithCommas]}
          />
        );
      case 'removeAdmin':
        if (isMe) {
          return i18n('removeAdminOfTheGroup', [i18n('you')]);
        }
        if (!contacts || !contacts.length) {
          throw new Error('Group update is missing contacts');
        }
        const removeAdminKey =
          otherPeople.length > 1
            ? 'removeAdminOfTheGroupMultiple'
            : 'removeAdminOfTheGroup';
        return (
          <Intl
            i18n={i18n}
            id={removeAdminKey}
            components={[otherPeopleWithCommas]}
          />
        );
      case 'name':
        if (operatorName) {
          // const someone = isMe ? i18n('you') : operatorName;
          return i18n('titleChangedBySomeone', [operatorName, newName || '']);
        } else {
          return i18n('titleIsNow', [newName || '']);
        }
      case 'avatar':
        return i18n('groupAvatarChange');
      case 'add':
        if (!contacts || !contacts.length) {
          throw new Error('Group update is missing contacts');
        }

        const joinKey =
          otherPeople.length > 1 ? 'multipleJoinedTheGroup' : 'joinedTheGroup';

        return (
          <>
            {otherPeople.length > 0 && (
              <div style={{ display: 'inline' }}>
                <Intl
                  i18n={i18n}
                  id={joinKey}
                  components={[otherPeopleWithCommas]}
                />
              </div>
            )}
            {joinOperator && joinOperator === ourNumber && isHaveHistory && (
              <span
                className="span-click"
                onClick={() => {
                  if (confirm(i18n('send-chat-history')) && sendHistory) {
                    sendHistory();
                  }
                }}
              >
                {i18n('sendChatHistory')}
              </span>
            )}

            {contactsIncludesMe && (
              <div className="module-group-notification__change">
                <Intl i18n={i18n} id="youJoinedTheGroup" />
              </div>
            )}
          </>
        );

      // return <Intl i18n={i18n} id={joinKey} components={[otherPeople]} />;
      case 'leave':
        if (isMe) {
          return i18n('youLeftTheGroup');
        }

        if (!contacts || !contacts.length) {
          throw new Error('Group update is missing contacts');
        }

        const leftKey =
          otherPeople.length > 1 ? 'multipleLeftTheGroup' : 'leftTheGroup';

        return (
          <Intl i18n={i18n} id={leftKey} components={[otherPeopleWithCommas]} />
        );
      case 'remove':
        if (isMe) {
          return (
            <>
              <span>
                {i18n('youWereRemovedFromTheGroup')}
                {inviteCode && (
                  <span>
                    {'. '}
                    <span
                      className="span-click"
                      onClick={() => {
                        const b = confirm(i18n('checkRejoinGroup'));
                        if (b && rejoin) {
                          rejoin();
                        }
                      }}
                    >
                      {i18n('memberRejoin')}
                    </span>
                  </span>
                )}
              </span>
            </>
          );
        }

        if (!contacts || !contacts.length) {
          throw new Error('Group update is missing contacts');
        }

        const removedKey =
          otherPeople.length > 1
            ? 'multipleRemovedFromTheGroup'
            : 'removedFromTheGroup';

        return (
          <>
            <Intl
              i18n={i18n}
              id={removedKey}
              components={[otherPeopleWithCommas]}
            />
            {contactsIncludesMe && (
              <div className="module-group-notification__change">
                <Intl i18n={i18n} id="youWereRemovedFromTheGroup" />
              </div>
            )}
          </>
        );
      case 'general':
        return i18n('updatedTheGroup');
      case 'onlyOwnerOrAdminPublishRule':
        return (
          <>
            {
              <div className="module-group-notification__change">
                <Intl i18n={i18n} id="onlyOwnerOrAdminCanSpeak" />
              </div>
            }
          </>
        );

      case 'everyonePublishRule':
        return (
          <>
            {
              <div className="module-group-notification__change">
                <Intl i18n={i18n} id="everyoneCanSpeak" />
              </div>
            }
          </>
        );
      case 'disband':
        if (isDisbandByOwner) {
          return i18n('groupDisbandedByOwner');
        }
        return i18n('groupDisbanded');
      case 'feedback':
        if (feedback === '###' || feedback === true) {
          return (
            <div>
              <span>Meeting ended.</span>
              {/*<span>Meeting ended. Please </span>*/}
              {/*<span*/}
              {/*  className="span-click"*/}
              {/*  onClick={() => {*/}
              {/*    if (setFeedbackMessage) setFeedbackMessage();*/}
              {/*  }}*/}
              {/*>*/}
              {/*  click here*/}
              {/*</span>*/}
              {/*<span> to share your feedback about the meeting.</span>*/}
            </div>
          );
        } else {
          return (
            <div>
              <span>{'Meeting ended ' + feedback + '.'}</span>
              {/*<span>{'Meeting ended ' + feedback + '. Please '}</span>*/}
              {/*<span*/}
              {/*  className="span-click"*/}
              {/*  onClick={() => {*/}
              {/*    if (setFeedbackMessage) setFeedbackMessage();*/}
              {/*  }}*/}
              {/*>*/}
              {/*  click here*/}
              {/*</span>*/}
              {/*<span> to share your feedback about the meeting.</span>*/}
            </div>
          );
        }
      case 'addPin':
        if (!contacts || !contacts.length) {
          throw new Error('Group update is missing contacts');
        }
        let tempMessage;
        const { description, operator } = pin;
        if (operator === ourNumber) {
          tempMessage = (
            <span>{i18n('pinMessageOfTheGroup', [i18n('you')])}</span>
          );
        } else {
          tempMessage = (
            <Intl
              i18n={i18n}
              id={'pinMessageOfTheGroup'}
              components={[otherPeopleWithCommas]}
            />
          );
        }

        return (
          <div>
            {tempMessage}
            <span>"</span>
            <span
              className="span-click"
              onClick={() => {
                if (scrollToMessage) scrollToMessage();
              }}
            >
              {description}
            </span>
            <span>"</span>
          </div>
        );
      case 'meetingReminder':
        if (meetingReminder && meetingReminder.type === 'create') {
          const repeated = meetingReminder.isRecurrence ? ' repeated' : '';
          return (
            <div>
              <span>{`${meetingReminder.organizer} scheduled a${repeated} meeting on ${meetingReminder.startAt}. `}</span>
              <a href={`${meetingReminder.link}`} onClick={this.hrefClickBind}>
                View details
              </a>
            </div>
          );
        }
        if (meetingReminder && meetingReminder.type === 'remind') {
          return (
            <div>
              <span>The group meeting will </span>
              <span
                style={{ color: '#df7800' }}
              >{`start in ${meetingReminder.reminder}. `}</span>
              <a
                href={`${meetingReminder.joinMeetUrl}`}
                onClick={this.hrefClickBind}
              >
                Join
              </a>
            </div>
          );
        }
        if (meetingReminder && meetingReminder.type === 'cancel') {
          return (
            <div>
              <span>{`${meetingReminder.organizer} canceled a meeting on ${meetingReminder.startAt}. `}</span>
            </div>
          );
        }
        return null;
      default:
        throw missingCaseError(type);
    }
  }

  public render() {
    const { changes } = this.props;

    return (
      <div className="module-group-notification">
        {(changes || []).map((change, index) => (
          <div key={index} className="module-group-notification__change">
            {this.renderChange(change)}
          </div>
        ))}
      </div>
    );
  }
}
