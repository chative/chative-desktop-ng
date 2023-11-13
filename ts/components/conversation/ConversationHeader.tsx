import React from 'react';

import { Avatar } from '../Avatar';
import { LocalizerType } from '../../types/Util';
// import {
//   ContextMenu,
//   ContextMenuTrigger,
//   MenuItem,
// } from 'react-contextmenu';
import { Tooltip } from 'antd';
import { Tag } from '../Tag';

interface TimerOption {
  name: string;
  value: number;
}

interface Props {
  id: string;
  name?: string;

  phoneNumber: string;
  profileName?: string;
  color: string;
  avatarPath?: string;
  email?: string;
  signature?: string;

  isVerified: boolean;
  isMe: boolean;
  isMeLeftGroup: boolean;
  isGroup: boolean;
  isGroupV2: boolean;
  isGroupV2Owner: boolean;
  isGroupV2Admin: boolean;
  isArchived: boolean;
  groupMembersCount?: number;

  // expirationSettingName?: string;
  showBackButton: boolean;
  showGroupEditButton: boolean;
  showGroupSaveButton: boolean;
  timerOptions: Array<TimerOption>;

  // onSetDisappearingMessages: (seconds: number) => void;
  onDeleteMessages: () => void;
  onResetSession: () => void;
  onLeaveGroup: () => void;
  onDisbandGroup: () => void;

  onShowSafetyNumber: () => void;
  onShowAllMedia: () => void;
  onGoBack: () => void;
  onGroupSave: () => void;

  onGroupV2AddMembers: () => void;
  onGroupV2RemoveMembers: () => void;

  onArchive: () => void;
  onMoveToInbox: () => void;

  i18n: LocalizerType;
  isStick?: boolean;
  onStick: (stick: boolean) => void;
  headerTitle?: string;
  onOpenSetting: () => void;
  invitationRule?: number;
  isOutside: any;
}

interface State {
  userStatus?: number;
  noActiveSeconds?: number;
}

export class ConversationHeader extends React.Component<Props, State> {
  // public showMenuBound: (event: React.MouseEvent<HTMLDivElement>) => void;
  // public menuTriggerRef: React.RefObject<any>;
  public showMenuAddBound: (event: React.MouseEvent<HTMLDivElement>) => void;
  public menuAddTriggerRef: React.RefObject<any>;
  public noActiveTimer: number;

  public constructor(props: Props) {
    super(props);

    this.state = {
      userStatus: -1,
      noActiveSeconds: -1,
    };

    this.noActiveTimer = 0;
    // this.menuTriggerRef = React.createRef();
    // this.showMenuBound = this.showMenu.bind(this);
    this.menuAddTriggerRef = React.createRef();
    this.showMenuAddBound = this.showMenuAdd.bind(this);
  }

  public componentDidMount = () => {
    if (
      !this.props.isGroup &&
      this.props.id &&
      (window as any).userStatusReceiver
    ) {
      window.addEventListener(
        'event-user-status-changed',
        this.userStatusChanged
      );
      const v = (window as any).userStatusReceiver.addUserListen(this.props.id);
      if (v) {
        this.userStatusChanged(v);
      }
    }
  };

  public componentWillUnmount = () => {
    if (
      !this.props.isGroup &&
      this.props.id &&
      (window as any).userStatusReceiver
    ) {
      window.removeEventListener(
        'event-user-status-changed',
        this.userStatusChanged
      );
      (window as any).userStatusReceiver.removeUserListen(this.props.id);
    }
    if (this.noActiveTimer) {
      clearInterval(this.noActiveTimer);
    }
  };

  public userStatusChanged = (event: any) => {
    if (
      event &&
      event.detail &&
      event.detail.user &&
      event.detail.user === this.props.id
    ) {
      this.setState({
        userStatus: event.detail.status,
        noActiveSeconds: event.detail.ts,
      });

      if (event.detail.status === 2 && event.detail.ts) {
        if (this.noActiveTimer) {
          clearInterval(this.noActiveTimer);
        }

        this.noActiveTimer = window.setInterval(() => {
          this.setState(prevState => ({
            // @ts-ignore
            noActiveSeconds: prevState.noActiveSeconds + 1,
          }));
        }, 1000);
      } else {
        if (this.noActiveTimer) {
          clearInterval(this.noActiveTimer);
          this.noActiveTimer = 0;
        }
      }
    }
  };

  // public showMenu(event: React.MouseEvent<HTMLDivElement>) {
  //   if (this.menuTriggerRef.current) {
  //     this.menuTriggerRef.current.handleContextClick(event);
  //   }
  // }

  public showMenuAdd(event: React.MouseEvent<HTMLDivElement>) {
    if (this.menuAddTriggerRef.current) {
      this.menuAddTriggerRef.current.handleContextClick(event);
    }
  }

  public renderBackButton() {
    const { onGoBack, showBackButton } = this.props;

    if (!showBackButton) {
      return null;
    }

    return (
      <div
        onClick={onGoBack}
        role="button"
        className="module-conversation-header__back-icon"
      />
    );
  }

  // public renderSignOrPhoneNumberAndEmail(
  //   signature: string | undefined,
  //   phoneNumber: string,
  //   email: string | undefined
  // ) {
  //   if (signature) {
  //     return (
  //       <div className="module-conversation-header__title-sign">
  //         {signature}
  //       </div>
  //     );
  //   }
  //   if (phoneNumber && email) {
  //     return (
  //       <div className="module-conversation-header__title-sign">  {`${phoneNumber} | ${email}`}</div>
  //     );
  //   }
  //   if (phoneNumber) {
  //     return (
  //       <div className="module-conversation-header__title-sign">
  //         {phoneNumber}
  //       </div>
  //     );
  //   }
  //   return null;
  // }

  public formatSecond(sec: number | undefined) {
    const { i18n } = this.props;

    if (!sec) {
      return '';
    }

    if (sec < 60 * 60) {
      return i18n('active_minutes_ago', [`${Math.floor(sec / 60)}`]);
    }

    if (sec < 60 * 60 * 24) {
      return i18n('active_hours_ago', [`${Math.floor(sec / 60 / 60)}`]);
    }

    if (sec < 60 * 60 * 24 * 7) {
      return i18n('active_days_ago', [`${Math.floor(sec / 60 / 60 / 24)}`]);
    }

    if (sec < 60 * 60 * 24 * 30) {
      return i18n('active_weeks_ago', [
        `${Math.floor(sec / 60 / 60 / 24 / 7)}`,
      ]);
    }

    return i18n('active_months_ago');
  }

  public renderStatus() {
    const { i18n } = this.props;
    if (!this.props.isGroup && this.props.id && this.state.userStatus !== -1) {
      let text = '';
      if (this.state.userStatus === 0) {
        text = i18n('active');
      }
      if (this.state.userStatus === 2) {
        text = this.formatSecond(this.state.noActiveSeconds);
      }
      if (this.state.userStatus === 3) {
        text = i18n('calling');
      }
      if (this.state.userStatus === 5) {
        text = i18n('meeting');
      }

      if (text) {
        return (
          <span className="module-conversation-header__title-status">
            {text}
          </span>
        );
      }
    }

    return null;
  }

  public renderTitle() {
    const {
      // phoneNumber,
      i18n,
      profileName,
      isVerified,
      isMe,
      // email,
      isGroup,
      // signature,
      groupMembersCount,
      isOutside,
    } = this.props;
    let name = this.props.name;
    if (isMe) {
      name = i18n('noteToSelf');
    }

    if (isGroup && groupMembersCount) {
      name += '(' + groupMembersCount + ')';
    }

    if (!name) {
      name = this.props.id;
    }

    return (
      <div className="module-conversation-header__title">
        {name ? (
          <span className="module-conversation-header__title-no-drag">
            {name}
            {isOutside && (
              <div className={'contact-name-tag-box'}>
                <Tag
                  i18n={i18n}
                  tagName={'external'}
                  showTips
                  site={'bottom'}
                />
              </div>
            )}
          </span>
        ) : null}
        {/*{name && phoneNumber ? ' · ' : null}*/}
        {/*{phoneNumber ? phoneNumber : null}{' '}*/}
        {profileName && !name ? (
          <span className="module-conversation-header__title__profile-name">
            {profileName}
            {isOutside && (
              <div className={'contact-name-tag-box'}>
                <Tag
                  i18n={i18n}
                  tagName={'external'}
                  showTips
                  site={'bottom'}
                />
              </div>
            )}
          </span>
        ) : null}
        {isVerified ? ' · ' : null}
        {isVerified ? (
          <span className="module-conversation-header__title__verified-icon" />
        ) : null}
        {this.renderStatus()}
        {/* {this.renderSignOrPhoneNumberAndEmail(signature, phoneNumber, email)} */}
      </div>
    );
  }

  public renderAvatar() {
    const {
      id,
      avatarPath,
      color,
      i18n,
      isGroup,
      isMe,
      name,
      profileName,
      onOpenSetting,
    } = this.props;

    const conversationType = isGroup ? 'group' : 'direct';

    return (
      <span className="module-conversation-header__avatar">
        <Avatar
          id={id}
          avatarPath={avatarPath}
          color={color}
          conversationType={conversationType}
          i18n={i18n}
          noteToSelf={isMe}
          name={name}
          profileName={profileName}
          size={28}
          onClickAvatar={isGroup ? onOpenSetting : undefined}
        />
      </span>
    );
  }

  // public renderExpirationLength() {
  //   const {expirationSettingName} = this.props;
  //
  //   if (!expirationSettingName) {
  //     return null;
  //   }
  //
  //   return (
  //     <div className="module-conversation-header__expiration">
  //       <div className="module-conversation-header__expiration__clock-icon"/>
  //       <div className="module-conversation-header__expiration__setting">
  //         {expirationSettingName}
  //       </div>
  //     </div>
  //   );
  // }

  // public renderSave() {
  //   const {
  //     showBackButton,
  //     showGroupSaveButton,
  //     onGroupSave,
  //   } = this.props;
  //
  //   if (showBackButton && showGroupSaveButton) {
  //     return (
  //       <div
  //         role="button"
  //         onClick={onGroupSave}
  //         className="module-conversation-header__save-icon"
  //       />
  //     );
  //   }
  //
  //   return null;
  // }

  // public renderGear(triggerId: string) {
  //   const {
  //     isGroupV2,
  //     isGroupV2Owner,
  //     showBackButton,
  //     showGroupEditButton,
  //     onGroupV2AddMembers,
  //     onGroupV2RemoveMembers,
  //   } = this.props;
  //
  //   if (showGroupEditButton) {
  //     if (isGroupV2) {
  //       return (
  //         <>
  //           <div
  //             role="button"
  //             onClick={onGroupV2AddMembers}
  //             className="module-conversation-header__group-add-icon"
  //           />
  //           {
  //             isGroupV2Owner
  //               ?
  //               <div
  //                 role="button"
  //                 onClick={onGroupV2RemoveMembers}
  //                 className="module-conversation-header__group-remove-icon"
  //               />
  //               : null
  //           }
  //         </>
  //       );
  //     } else {
  //       return (
  //         <div
  //           role="button"
  //           onClick={}
  //           className="module-conversation-header__plus-icon"
  //         />
  //       );
  //     }
  //   }
  //
  //   if (showBackButton) {
  //     return null;
  //   }
  //
  //   return (
  //     <ContextMenuTrigger id={triggerId} ref={this.menuTriggerRef}>
  //       <div
  //         role="button"
  //         onClick={this.showMenuBound}
  //         className="module-conversation-header__gear-icon"
  //       />
  //     </ContextMenuTrigger>
  //   );
  // }

  public setStick = () => {
    const { onStick } = this.props;
    if (onStick) {
      onStick(true);
    }
  };

  public unStick = () => {
    const { onStick } = this.props;
    if (onStick) {
      onStick(false);
    }
  };

  // public renderMenu(triggerId: string) {
  //   const {
  //     i18n,
  //     isMe,
  //     // isMeLeftGroup,
  //     isGroup,
  //     isGroupV2,
  //     // isGroupV2Owner,
  //     // isArchived,
  //     // onLeaveGroup,
  //     // onDisbandGroup,
  //     onDeleteMessages,
  //     onResetSession,
  //     onShowAllMedia,
  //     onShowSafetyNumber,
  //     // onArchive,
  //     // onMoveToInbox,
  //     isStick,
  //   } = this.props;
  //
  //   return (
  //     <ContextMenu id={triggerId}>
  //       {
  //         isStick ?
  //           (<MenuItem onClick={this.unStick}>{i18n('removeFromTop')}</MenuItem>) :
  //           (<MenuItem onClick={this.setStick}>{i18n('stickToTop')}</MenuItem>)
  //       }
  //       <MenuItem onClick={onShowAllMedia}>{i18n('viewAllMedia')}</MenuItem>
  //       {isGroup ?
  //         <MenuItem onClick={}>
  //           {isGroupV2 ? i18n('showDetails') : i18n('showMembers')}
  //         </MenuItem>
  //         : null
  //       }
  //       {!isGroup && !isMe ? (
  //         <MenuItem onClick={onShowSafetyNumber}>
  //           {i18n('showSafetyNumber')}
  //         </MenuItem>
  //       ) : null}
  //       {!isGroup ? (
  //         <MenuItem onClick={onResetSession}>{i18n('resetSession')}</MenuItem>
  //       ) : null}
  //       {/*{isArchived ? (*/}
  //       {/*  <MenuItem onClick={onMoveToInbox}>*/}
  //       {/*    {i18n('moveConversationToInbox')}*/}
  //       {/*  </MenuItem>*/}
  //       {/*) : (*/}
  //       {/*  <MenuItem onClick={onArchive}>{i18n('archiveConversation')}</MenuItem>*/}
  //       {/*)}*/}
  //       <MenuItem onClick={onDeleteMessages}>{i18n('deleteMessages')}</MenuItem>
  //       {
  //         // isGroup && isGroupV2Owner && !isMeLeftGroup ?
  //         //   <MenuItem onClick={onDisbandGroup}>{i18n('disbandGroup')}</MenuItem>
  //         // : isGroup && !isGroupV2Owner && !isMeLeftGroup ?
  //         //     <MenuItem onClick={onLeaveGroup}>{i18n('leaveGroup')}</MenuItem>
  //         //   : null
  //       }
  //     </ContextMenu>
  //   );
  // }

  // public renderMenuAdd(triggerId: string) {
  //   const { id, name, i18n, onGroupV2AddMembers } = this.props;

  //   return (
  //     <ContextMenu id={triggerId}>
  //       <MenuItem onClick={() => (window as any).RapidCreateGroupFromGroup(name, id)}>
  //         {i18n('group_editor_menu_item_fast_group')}
  //       </MenuItem>
  //       <MenuItem onClick={onGroupV2AddMembers}>
  //         {i18n('group_editor_menu_item_add_members')}
  //       </MenuItem>
  //     </ContextMenu>
  //   );
  // }

  // public renderAddButton(triggerId: string) {
  //   const {
  //     id,
  //     i18n,
  //     isMe,
  //     isGroup,
  //     isGroupV2,
  //   } = this.props;

  //   if (isMe) {
  //     return null;
  //   }

  //   if (isGroup && isGroupV2) {
  //     return (
  //       <ContextMenuTrigger id={triggerId} ref={this.menuAddTriggerRef}>
  //         <Tooltip overlayClassName={'antd-tooltip-cover'} placement="bottomRight" title={i18n('addGroupMembersTooltip')}>
  //           <div
  //             role="button"
  //             onClick={this.showMenuAddBound}
  //             className="module-conversation-header__group-add-icon"
  //           />
  //         </Tooltip>
  //       </ContextMenuTrigger>
  //     );
  //   } else {
  //     return (
  //       <Tooltip overlayClassName={'antd-tooltip-cover'} placement="bottomRight" title={i18n('addGroupMembersTooltip')}>
  //         <div
  //           role="button"
  //           onClick={() => (window as any).RapidCreateGroup(id)}
  //           className="module-conversation-header__group-add-icon"
  //         />
  //       </Tooltip>
  //     );
  //   }
  // }

  public renderAddButtonOnly() {
    const {
      id,
      i18n,
      isMe,
      isGroup,
      isGroupV2,
      onGroupV2AddMembers,
      isGroupV2Owner,
      isGroupV2Admin,
      invitationRule,
    } = this.props;

    if (isMe) {
      return null;
    }

    if (isGroup && isGroupV2) {
      if (invitationRule === 1 && !isGroupV2Owner && !isGroupV2Admin) {
        return null;
      }
      return (
        <Tooltip
          mouseEnterDelay={1.5}
          overlayClassName={'antd-tooltip-cover'}
          placement="bottomRight"
          title={i18n('addGroupMembersTooltip')}
        >
          <div
            role="button"
            onClick={onGroupV2AddMembers}
            className="module-conversation-header__group-add-icon"
          />
        </Tooltip>
      );
    } else {
      return (
        // <Tooltip overlayClassName={'antd-tooltip-cover'} placement="bottomRight" title={i18n('quickGroupTooltip')}>
        <div
          role="button"
          onClick={() => (window as any).RapidCreateGroup(id)}
          className="module-conversation-header__group-add-icon"
        />
        // </Tooltip>
      );
    }
  }

  public renderRightButtons() {
    const {
      // id,
      i18n,
      isMeLeftGroup,
      onOpenSetting,
      showBackButton,
    } = this.props;

    if (isMeLeftGroup || showBackButton) {
      return null;
    }

    // const triggerId = `conversation-${id}`;

    return (
      <>
        {/* <div
        role="button"
        onClick={() => (window as any).showLocalSearch('', id)}
        className="module-conversation-header__history-icon"
      /> */}
        {this.renderAddButtonOnly()}
        {/* {this.renderAddButton(triggerId)} */}
        {/* {this.renderMenuAdd(triggerId)} */}
        <Tooltip
          mouseEnterDelay={1.5}
          overlayClassName={'antd-tooltip-cover'}
          placement="bottomRight"
          title={i18n('sessionInformationTooltip')}
        >
          <div
            role="button"
            onClick={onOpenSetting}
            className="module-conversation-header__gear-icon"
          />
        </Tooltip>
      </>
    );
  }

  public render() {
    const { headerTitle } = this.props;

    return (
      <div className="module-conversation-header">
        {this.renderBackButton()}
        <div className="module-conversation-header__title-container">
          {headerTitle ? (
            <div className="module-conversation-header__title-middle">
              <div
                className="module-conversation-header__title-no-drag"
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {headerTitle}
              </div>
            </div>
          ) : (
            <div className="module-conversation-header__title-flex">
              {this.renderAvatar()}
              {this.renderTitle()}
            </div>
          )}
        </div>
        {/* {this.renderExpirationLength()} */}
        {/*{this.renderGear(triggerId)}*/}
        {/*{this.renderSave()}*/}
        {/*{this.renderMenu(triggerId)}*/}
        {this.renderRightButtons()}
      </div>
    );
  }
}
