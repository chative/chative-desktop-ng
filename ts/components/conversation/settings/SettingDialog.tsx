import React, { useCallback, useEffect, useRef, useState } from 'react';
import PollModal from '../../PollModal';
import { LocalizerType } from '../../../types/Util';
import { Avatar } from '../../Avatar';
import GroupMemberList from './GroupMemberList';
import { ForwardDialog } from '../../ForwardDialog';
import { Switch } from 'antd';
// import moment from 'moment';
// import { Popover } from 'antd';
import { processImageFile } from '../../../util/processImageFile';
import { humanizeSeconds } from '../../../util/humanizeSeconds';
import { ConversationType } from '../../../state/ducks/conversations';
import { getConversationProps } from '../../../shims/Whisper';
import { getConversationComparator } from '../../../state/selectors/conversations';
import { StateType } from '../../../state/reducer';

interface Props {
  id: string;
  name?: string;
  profileName?: string;
  color: string;
  avatarPath?: string;
  ourNumber?: string;

  i18n: LocalizerType;
  isPrivate: boolean;
  stick?: boolean;
  onStick: (stick: boolean) => void;
  onShowAllMedia: () => void;
  onResetSession: () => void;
  onLeaveGroup: () => void;
  onDisbandGroup: () => void;
  onRenameGroupName: (newName: string) => boolean;
  onGroupInviteCode: () => string;
  onForwardTo: (conversationIds: any, groupLink: string) => void;
  onTransferGroupOwner: (id: string) => void;

  groupMembersCount?: number;
  members: Array<any>;
  notifyIndex: number;
  setNotifyIndex: (notification: number) => void;
  setMuteSetting: (isMute: boolean) => void;
  setBlockSetting: (isBlock: boolean) => void;
  mute?: boolean | undefined;
  block?: boolean | undefined;
  mute_setting_init?: boolean;
  isBlockBot?: boolean | undefined;

  isMeLeftGroup: boolean;
  isGroupV2Owner: boolean;
  isGroupV2Admin: boolean;
  onCancel: () => void;

  invitationRule?: number;
  setInvitationRule: (ruleIndex: number) => void;

  // anyoneRemove?: boolean;
  // setAnyoneRemove: (b: boolean) => void;

  // rejoin: boolean;
  // setRejoin: (b: boolean) => void;

  publishRule?: number;
  setPublishRule: (ruleIndex: number) => void;

  defaultMessageExpiry: number;
  currentMessageExpiry: number;
  messageExpiryOptions: Array<number>;
  onChangeMessageExpiry: (messageExpiry: number) => Promise<void>;
  reminderValue: string;
  reminderOptionValues: Array<string>;
  onChangeReminder: (remindCycle: string | undefined) => Promise<void>;
  changeGroupMemberRapidRole: (rapidRole: number, memberId: string) => void;
  memberRapidRole: any;
  spookyBotFlag: boolean;

  anyoneChangeName?: boolean;
  setAnyoneChangeName: (anyoneChangeName: boolean) => void;

  linkInviteSwitch?: boolean;
  setLinkInviteSwitch: (linkInviteSwitch: boolean) => void;
}

export const SettingDialog = (props: Props) => {
  const {
    id,
    i18n,
    members,
    isBlockBot,
    currentMessageExpiry,
    messageExpiryOptions,
    // reminderValue,
    // reminderOptionValues,
    changeGroupMemberRapidRole,
    memberRapidRole,
    isPrivate,
    spookyBotFlag,
  } = props;

  const initIndex = messageExpiryOptions.indexOf(currentMessageExpiry);
  const expiryOptionsToRender =
    initIndex === -1
      ? [currentMessageExpiry, ...messageExpiryOptions]
      : messageExpiryOptions;

  // const reminderIndex = reminderOptionValues.indexOf(reminderValue);
  // const reminderOptionsToRender = ['off', ...reminderOptionValues];
  // const reminderValueToInit = reminderIndex === -1 ? 'off' : reminderValue;

  const [operationLoading, setOperationLoading] = useState(false);
  const [editGroup, setEditGroup] = useState(false);
  const [editGroupNameErrorTips, SetEditGroupNameErrorTips] = useState('');
  const [showMembers, setShowMembers] = useState(false);
  const [editGroupName, setEditGroupName] = useState(props.name || '');
  const [copyButton, setCopyButton] = useState(i18n('copyButton'));
  const [groupLinkText, setGroupLinkText] = useState(i18n('loading'));
  const [showForwardDialog, setShowForwardDialog] = useState(false);
  const [showCopyShareButton, setShowCopyShareButton] = useState(false);
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [showGroupManagerModerators, setShowGroupManagerModerators] =
    useState(false);
  const [showGroupManagerTransfer, setShowGroupManagerTransfer] =
    useState(false);
  const maxGroupNameLength = 64;
  const inputRefImageSelect = useRef(null);

  const [isTestImage, setIsTestImage] = useState(false);
  const [testImageData, setTestImageData] = useState('');

  const [isEditingName, setIsEditingName] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [showCommonGroups, setShowCommonGroups] = useState(false);
  const [commonGroups, setCommonGroups] = useState<ConversationType[]>([]);

  useEffect(() => {
    if (!isPrivate) {
      return;
    }
    if ((window as any).isClickCommonGroup) {
      setShowCommonGroups(true);
      (window as any).isClickCommonGroup = false;
    }
    const state = (window as any).inboxStore.getState();
    const { memberGroupLookup } = (state as StateType).conversations;

    const groups = memberGroupLookup[id];
    if (groups) {
      setCommonGroups(
        groups
          .map(id => getConversationProps(id))
          .filter(props => props.isAliveGroup)
          .sort(getConversationComparator(state))
      );
    }
  }, [id]);

  // same as componentDidMount / componentWillUnmount
  useEffect(() => {
    window.addEventListener(
      'conversation-close-create-poll-dialog',
      props.onCancel
    );

    return () => {
      window.removeEventListener(
        'conversation-close-create-poll-dialog',
        props.onCancel
      );
    };
  }, [isTestImage, testImageData]);

  const renderBackBtn = () => {
    return (
      <span
        className={'common-back'}
        style={{ position: 'absolute', left: '15px', top: '16px' }}
        onMouseDown={() => {
          if (isEditingName) {
            setIsEditingName(false);
          }

          if (showGroupManagerModerators) {
            setShowGroupManagerModerators(false);
            return;
          }
          if (showGroupManagerTransfer) {
            setShowGroupManagerTransfer(false);
            return;
          }
          if (editGroup) {
            setEditGroup(false);
            return;
          }
          if (showMembers) {
            setShowMembers(false);
            return;
          }
          if (showGroupManager) {
            setShowGroupManager(false);
            return;
          }

          if (showCommonGroups) {
            setShowCommonGroups(false);
            return;
          }
        }}
      />
    );
  };

  const renderCloseBtn = () => {
    return (
      <span
        className={'common-close'}
        style={{ position: 'absolute', right: '15px', top: '22px' }}
        onMouseDown={(event: React.MouseEvent<HTMLSpanElement>) => {
          event.stopPropagation();

          if (isEditingName) {
            setIsEditingName(false);
          }

          props.onCancel();
        }}
      />
    );
  };

  const renderOperationLoading = () => {
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
          zIndex: 9999,
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
  };

  const renderTitle = () => {
    if (showGroupManagerModerators) {
      return (
        <div className={'header-container'}>
          <h3>{i18n('conversation_settings_group_moderators')}</h3>
        </div>
      );
    }
    if (showGroupManagerTransfer) {
      return (
        <div className={'header-container'}>
          <h3>{i18n('conversation_settings_group_transfer')}</h3>
        </div>
      );
    }
    if (editGroup) {
      return (
        <div className={'header-container'}>
          <h3>{i18n('conversation_settings_edit_group')}</h3>
        </div>
      );
    }
    if (showMembers) {
      return (
        <div className={'header-container'}>
          <h3>
            {i18n('conversation_settings_group_members') +
              '(' +
              members.length +
              ')'}
          </h3>
        </div>
      );
    }
    if (showGroupManager) {
      return (
        <div className={'header-container'}>
          <h3>{i18n('conversation_settings_group_manager')}</h3>
        </div>
      );
    }

    if (showCommonGroups) {
      const groupCount = commonGroups.length;

      const countTitleKey =
        groupCount > 1 ? 'groupCountTitle2' : 'groupCountTitle1';

      return (
        <div className={'header-container'}>
          <h3>{i18n(countTitleKey, [`${groupCount}`])}</h3>
        </div>
      );
    }

    return (
      <div className={'header-container'}>
        <h3>{i18n('settings')}</h3>
      </div>
    );
  };

  const canInviteJoinGroup = () => {
    const { invitationRule, isGroupV2Owner, isGroupV2Admin } = props;
    return !(invitationRule === 1 && !isGroupV2Owner && !isGroupV2Admin);
  };

  const renderGroupAvatarHeader = () => {
    const {
      id,
      name,
      profileName,
      color,
      avatarPath,
      isPrivate,
      onGroupInviteCode,
    } = props;
    if (isPrivate) {
      return null;
    }

    const conversationType = isPrivate ? 'direct' : 'group';
    return (
      <div
        className={'group-header-container'}
        onClick={async () => {
          if (!canInviteJoinGroup()) {
            return;
          }
          setEditGroup(true);
          SetEditGroupNameErrorTips('');
          setOperationLoading(true);
          const code = await onGroupInviteCode();
          if (code && code.length === 2) {
            setGroupLinkText(code);
            setShowCopyShareButton(true);
          } else {
            setGroupLinkText('Get group link failed, please try again!');
          }
          setOperationLoading(false);
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyItems: 'center',
            alignItems: 'center',
            maxWidth: 'calc(100% - 30px)',
            padding: '10px 0',
            pointerEvents: 'none',
          }}
        >
          <Avatar
            id={id}
            avatarPath={avatarPath}
            color={color}
            conversationType={conversationType}
            i18n={i18n}
            noteToSelf={false}
            name={name}
            profileName={profileName}
            size={48}
          />
          <span style={{ margin: '8px 0 8px 10px', wordBreak: 'break-word' }}>
            {name}
          </span>
        </div>
        {canInviteJoinGroup() ? <span className={'forward-icon'} /> : null}
      </div>
    );
  };

  const renderGroupMembers = () => {
    const {
      id,
      groupMembersCount,
      isPrivate,
      isGroupV2Owner,
      isGroupV2Admin,
      // anyoneRemove,
    } = props;
    if (isPrivate) {
      return null;
    }

    const max5members = members.map((item, index) => {
      if (index > 4) {
        return null;
      }
      return (
        <div key={index} style={{ marginRight: '10px' }}>
          <Avatar
            i18n={i18n}
            conversationType={'direct'}
            id={item.id}
            avatarPath={item.avatarPath}
            profileName={item.profileName}
            name={item.name}
            size={36}
          />
        </div>
      );
    });

    return (
      <div
        className={'group-members-container'}
        onClick={() => {
          setShowMembers(true);
        }}
      >
        <div className={'members'}>
          <span>{i18n('conversation_settings_group_members')}</span>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '12px' }}>{groupMembersCount}</span>
            <span className={'forward-icon'} />
          </div>
        </div>
        <div style={{ display: 'flex' }}>
          {max5members}
          {canInviteJoinGroup() ? (
            <span
              className={'member-add-icon'}
              onClick={e => {
                e.stopPropagation();
                e.preventDefault();
                (window as any).showAddGroupMembersWindow(id);
              }}
            />
          ) : null}
          {isGroupV2Owner || isGroupV2Admin ? (
            <span
              className={'member-reduce-icon'}
              onClick={e => {
                e.stopPropagation();
                e.preventDefault();
                (window as any).showRemoveGroupMembersWindow(id);
              }}
            />
          ) : null}
        </div>
      </div>
    );
  };

  const renderGroupModerators = () => {
    const { id, isPrivate } = props;
    if (isPrivate) {
      return null;
    }

    const adminCount = members.filter(item => {
      return item.role !== 2;
    }).length;
    const max5members = members.map((item, index) => {
      if (index > 4 || item.role === 2) {
        return null;
      }
      return (
        <div key={index} style={{ marginRight: '10px' }}>
          <Avatar
            i18n={i18n}
            conversationType={'direct'}
            id={item.id}
            avatarPath={item.avatarPath}
            profileName={item.profileName}
            name={item.name}
            size={36}
          />
        </div>
      );
    });

    return (
      <div
        className={'group-members-container'}
        onClick={() => {
          setShowGroupManagerModerators(true);
        }}
      >
        <div className={'members'}>
          <span>{i18n('conversation_settings_group_moderators')}</span>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '12px' }}>{adminCount}</span>
            <span className={'forward-icon'} />
          </div>
        </div>
        <div style={{ display: 'flex' }}>
          {max5members}
          <span
            className={'member-add-icon'}
            onClick={e => {
              e.stopPropagation();
              e.preventDefault();
              (window as any).showAddGroupAdminsWindow(id);
            }}
          />
          {adminCount > 1 ? (
            <span
              className={'member-reduce-icon'}
              onClick={e => {
                e.stopPropagation();
                e.preventDefault();
                (window as any).showRemoveGroupAdminsWindow(id);
              }}
            />
          ) : null}
        </div>
      </div>
    );
  };

  const renderGroupManager = () => {
    const { isGroupV2Owner } = props;
    if (!isGroupV2Owner) {
      return null;
    }
    return (
      <div
        className={'common-container'}
        onClick={() => {
          setShowGroupManager(true);
        }}
      >
        <span>{i18n('conversation_settings_group_manager')}</span>
        <span className={'forward-icon'} />
      </div>
    );
  };

  const renderStick = () => {
    const { stick, onStick } = props;
    return (
      <div
        className={'stick-container'}
        onClick={() => {
          onStick(!stick);
        }}
      >
        <span>{i18n('stickToTop')}</span>
        <input type="checkbox" checked={!!stick} onChange={() => {}} />
      </div>
    );
  };

  // const renderTipsContent = () => {
  //   const { i18n } = props;
  //   return (
  //     <div className="module-archive-indicator__tips-content">
  //       <span>{i18n('canRejoinTip1')}</span>
  //       <br></br>
  //       <span>{i18n('canRejoinTip2')}</span>
  //     </div>
  //   );
  // };

  // const renderReminderTipsContent = () => {
  //   const { i18n } = props;
  //   return (
  //     <div className="module-archive-indicator__tips-content">
  //       <span>{i18n('reminderTips')}</span>
  //     </div>
  //   );
  // };

  const renderInviteRule = () => {
    const { invitationRule, setInvitationRule } = props;
    return (
      <div
        className={'stick-container'}
        onClick={() => {
          if (invitationRule === 2) {
            setInvitationRule(1);
          }
          if (invitationRule === 1) {
            setInvitationRule(2);
          }
        }}
      >
        <span>{i18n('onlyAdminCanInvite')}</span>
        <input type="checkbox" checked={invitationRule === 1} readOnly />
      </div>
    );
  };

  const renderPublishOnlyGroup = () => {
    const { publishRule, setPublishRule } = props;
    return (
      <div
        className={'stick-container'}
        onClick={() => {
          if (publishRule === 2) {
            setPublishRule(1);
          }
          if (publishRule === 0) {
            setPublishRule(2);
          }
          if (publishRule === 1) {
            setPublishRule(2);
          }
        }}
      >
        <div style={{ display: 'flex' }}>{i18n('onlyModeratorsCanSpeak')}</div>
        <input type="checkbox" checked={publishRule === 1} readOnly />
      </div>
    );
  };

  // const renderAnyoneRemove = () => {
  //   const { anyoneRemove, setAnyoneRemove } = props;
  //   return (
  //     <div
  //       className={'stick-container'}
  //       onClick={() => {
  //         setAnyoneRemove(!anyoneRemove);
  //       }}
  //     >
  //       <span>{i18n('anyoneCanRemoveMember')}</span>
  //       <input type="checkbox" checked={anyoneRemove} readOnly />
  //     </div>
  //   );
  // };
  // const renderRejoin = () => {
  //   const { rejoin, setRejoin } = props;
  //   return (
  //     <div
  //       className={'stick-container'}
  //       onClick={() => {
  //         setRejoin(!rejoin);
  //       }}
  //     >
  //       <div style={{ display: 'flex' }}>
  //         {i18n('memberCanRejoin')}
  //         <Popover
  //           destroyTooltipOnHide={true}
  //           trigger="hover"
  //           content={renderTipsContent()}
  //           title={i18n('canRejoinTip')}
  //           align={{
  //             offset: [0, 5],
  //           }}
  //           overlayClassName={'module-archive-indicator__popover'}
  //         >
  //           <div className={'rejoin-tip'} />
  //         </Popover>
  //       </div>
  //       <input type="checkbox" checked={rejoin} readOnly />
  //     </div>
  //   );
  // };

  // const renderAnyoneChangeName = () => {
  //   const { anyoneChangeName, setAnyoneChangeName } = props;
  //   return (
  //     <div
  //       className={'stick-container'}
  //       onClick={() => setAnyoneChangeName(!anyoneChangeName)}
  //     >
  //       <span>{i18n('anyoneCanChangeGroupName')}</span>
  //       <input type="checkbox" checked={anyoneChangeName} readOnly />
  //     </div>
  //   );
  // };

  const renderViewMedia = () => {
    const { onShowAllMedia } = props;
    return (
      <div
        className={'common-container'}
        onClick={() => {
          onShowAllMedia();
          props.onCancel();
        }}
      >
        <span>{i18n('viewAllMedia')}</span>
        <span className={'forward-icon'} />
      </div>
    );
  };

  // const renderResetSession = () => {
  //   const { isPrivate, onResetSession } = props;
  //   if (!isPrivate) {
  //     return null;
  //   }
  //   return (
  //     <div
  //       className={'common-container'}
  //       onClick={() => {
  //         onResetSession();
  //         props.onCancel();
  //       }}
  //     >
  //       <span>{i18n('resetSession')}</span>
  //       <span className={'forward-icon'} />
  //     </div>
  //   );
  // };

  const renderNotifications = () => {
    const { isPrivate, notifyIndex, setNotifyIndex } = props;
    if (isPrivate) {
      return null;
    }

    return (
      <div className={'common-container'}>
        <span>{i18n('notifications')}</span>
        <select
          value={notifyIndex}
          onChange={async (e: React.ChangeEvent<HTMLSelectElement>) => {
            setOperationLoading(true);
            await setNotifyIndex(parseInt(e.target.value));
            setOperationLoading(false);
          }}
        >
          <option value={0}>{i18n('notifyAll')}</option>
          <option value={1}>{i18n('notifyAtMe')}</option>
          <option value={2}>{i18n('notifyNone')}</option>
        </select>
      </div>
    );
  };

  const onSwitchChange = async () => {
    const { mute, setMuteSetting } = props;
    setMuteSetting(!mute);
  };

  const renderMute = () => {
    const { mute } = props;
    return (
      <div className={'common-container'} onClick={onSwitchChange}>
        <span>{i18n('mute')}</span>
        <input type="checkbox" checked={!!mute} readOnly />
      </div>
    );
  };

  const onSwitchChangeBlock = async () => {
    const { block, setBlockSetting } = props;
    setBlockSetting(!block);
  };

  const renderBlock = () => {
    const { block } = props;
    return (
      <div className={'common-container'} onClick={onSwitchChangeBlock}>
        <span>{i18n('block')}</span>
        <Switch onChange={() => {}} checked={block} />
      </div>
    );
  };

  const renderHistorySearchEntry = () => {
    return (
      <div
        className={'common-container'}
        onClick={() => {
          (window as any).showLocalSearch('', props.id);
        }}
      >
        <span>{i18n('historySearchTitle')}</span>
        <span className={'forward-icon'} />
      </div>
    );
  };
  const renderEmergencyBtn = () => {
    const { id, isPrivate, onCancel } = props;
    const MENTIONS_ALL_ID = 'MENTIONS_ALL';
    const spookyBotId = (window as any).getGlobalConfig().spookyBotId;
    return (
      <div
        className={'common-container'}
        onClick={() => {
          onCancel();
          if (isPrivate) {
            (window as any).jumpMessage({
              conversationId: spookyBotId,
            });
            setTimeout(() => {
              const conversation = (window as any).ConversationController.get(
                spookyBotId
              );
              conversation.insertAtPersonMessage(id);
            }, 300);
          } else {
            const conversation = (window as any).ConversationController.get(id);
            conversation.trigger('insert-at-person-msg', MENTIONS_ALL_ID, true);
          }
        }}
      >
        <span>{i18n('emergencyAlert')}</span>
        <span className={'forward-icon'} />
      </div>
    );
  };

  const renderMessageExpiryOption = (optionValue: number, index: number) => {
    if (optionValue === -1) {
      const { defaultMessageExpiry } = props;

      return (
        <option value={index} key={index}>
          {i18n('messageDefaultExpiry', [
            humanizeSeconds(defaultMessageExpiry),
          ])}
        </option>
      );
    } else if (optionValue === 0) {
      if (messageExpiryOptions.indexOf(0) === -1) {
        return (
          <option value={index} key={index}>
            {i18n('messageDefaultExpiry', [i18n('messageNeverExpiry')])}
          </option>
        );
      } else {
        return (
          <option value={index} key={index}>
            {i18n('messageNeverExpiry')}
          </option>
        );
      }
    } else if (optionValue > 0) {
      return (
        <option value={index} key={index}>
          {humanizeSeconds(optionValue)}
        </option>
      );
    } else {
      return null;
    }
  };

  const onMessageExpirySelectChanged = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const { onChangeMessageExpiry } = props;

    const index = parseInt(e.target.value);
    const optionValue = expiryOptionsToRender[index];

    // unexpected value
    if (optionValue === -1) {
      return;
    }

    setOperationLoading(true);
    onChangeMessageExpiry(optionValue).finally(() => {
      setOperationLoading(false);
    });
  };

  // const onReminderSelectChanged = (e: React.ChangeEvent<HTMLSelectElement>) => {
  //   const { onChangeReminder } = props;

  //   const optionValue = e.target.value;

  //   // unexpected value
  //   if (!optionValue || optionValue.length === 0) {
  //     return;
  //   }

  //   setOperationLoading(true);
  //   const value = optionValue === 'off' ? 'none' : optionValue;
  //   onChangeReminder(value).finally(() => {
  //     setOperationLoading(false);
  //   });
  // };

  const renderMessageExpirySettings = () => {
    const {
      // isPrivate,
      onChangeMessageExpiry,
      messageExpiryOptions,
      // isGroupV2Owner,
      // isGroupV2Admin,
    } = props;

    // if (isPrivate) {
    //   return null;
    // }

    // anyone can edit group expiry
    // if (!isGroupV2Owner && !isGroupV2Admin) {
    //   return null;
    // }

    if (!onChangeMessageExpiry || !messageExpiryOptions) {
      return null;
    }

    return (
      <div className={'common-container'}>
        <span>{i18n('messageExpiry')}</span>
        <select
          value={initIndex === -1 ? 0 : initIndex}
          onChange={onMessageExpirySelectChanged}
        >
          {expiryOptionsToRender.map(renderMessageExpiryOption)}
        </select>
      </div>
    );
  };

  // const renderGroupRemindCycle = () => {
  //   const { isPrivate } = props;
  //   if (isPrivate) return null;

  //   return (
  //     <div className={'common-container'}>
  //       <span>{i18n('reminder')}</span>
  //       <Popover
  //         destroyTooltipOnHide={true}
  //         trigger="hover"
  //         content={renderReminderTipsContent()}
  //         // title={i18n('reminderTips')}
  //         align={{
  //           offset: [0, 5],
  //         }}
  //         overlayClassName={'module-archive-indicator__popover'}
  //       >
  //         <div className={'rejoin-tip'} style={{ marginLeft: '-45px' }} />
  //       </Popover>
  //       <select value={reminderValueToInit} onChange={onReminderSelectChanged}>
  //         {reminderOptionsToRender.map((r, index) => {
  //           if (!r || r.length === 0) return null;
  //           return (
  //             <option value={r} key={index}>
  //               {i18n(r)}
  //             </option>
  //           );
  //         })}
  //       </select>
  //     </div>
  //   );
  // };

  const renderLinkInviteSwitch = () => {
    const { linkInviteSwitch, setLinkInviteSwitch } = props;
    return (
      <div
        className={'stick-container'}
        onClick={() => setLinkInviteSwitch(!linkInviteSwitch)}
      >
        <span>{i18n('enableGroupInviteLink')}</span>
        <input type="checkbox" checked={linkInviteSwitch} readOnly />
      </div>
    );
  };

  const renderLeaveButton = () => {
    const { isPrivate, onLeaveGroup, isGroupV2Owner } = props;
    if (isPrivate || isGroupV2Owner) {
      return null;
    }
    return (
      <div className={'leave-container'}>
        <button
          onClick={() => {
            onLeaveGroup();
            props.onCancel();
          }}
        >
          {' '}
          {i18n('leaveGroup')}
        </button>
      </div>
    );
  };

  const renderDisbandButton = () => {
    const { isPrivate, onDisbandGroup, isGroupV2Owner } = props;
    if (isPrivate) {
      return null;
    }
    if (!isGroupV2Owner) {
      return null;
    }
    return (
      <div className={'leave-container'}>
        <button
          onClick={() => {
            onDisbandGroup();
            props.onCancel();
          }}
        >
          {i18n('disbandGroup')}
        </button>
      </div>
    );
  };

  function inputUploadImage() {
    if (inputRefImageSelect.current) {
      // @ts-ignore
      inputRefImageSelect.current.click();
    }
  }

  async function inputImageSelectChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    try {
      if (event.target.files && event.target.files[0]) {
        const file = event.target.files[0];
        if (file.size === 0 || file.size > 10 * 1024 * 1024) {
          (window as any).noticeError(i18n('profile_bad_avatar_image_size'));
          return;
        }
        let newAvatar: Uint8Array;
        try {
          newAvatar = await processImageFile(file);
        } catch (err) {
          // Processing errors should be rare; if they do, we silently fail. In an ideal
          //   world, we may want to show a toast instead.
          return;
        }
        if (newAvatar) {
          const b64Avatar =
            'data:image/png;base64,' +
            (window as any).Signal.Crypto.arrayBufferToBase64(newAvatar);
          // this.setState({ isTestImage: true, testImageData: b64Avatar });
          setIsTestImage(true);
          setTestImageData(b64Avatar);
        }

        // const reader = new FileReader();
        // reader.onload = (e: ProgressEvent<FileReader>) => {
        //   const imageData = e?.target?.result;
        //   // NOT SUPPORT GIF FORMAT
        //   if (typeof imageData === 'string') {
        //     const pos = imageData.indexOf(';base64,');
        //     if (pos !== -1) {
        //       const dst = imageData.substr(pos + 8);
        //       if (dst.startsWith('R0lGODlh') || dst.startsWith('R0lGODdh')) {
        //         (window as any).noticeError(i18n('profile_load_image_failed'));
        //         return;
        //       }
        //     }
        //   }
        //
        //   if (typeof imageData === 'string') {
        //     setIsTestImage(true);
        //     setTestImageData(imageData);
        //   }
        // };
        // reader.readAsDataURL(file);
      }
    } catch (e) {
      console.error('[Upload Avatar] exception:', e);
      (window as any).noticeError('[Upload Avatar] unknown error, try again!');
    } finally {
      if (inputRefImageSelect.current) {
        // @ts-ignore
        inputRefImageSelect.current.value = '';
      }
    }
  }

  function renderTestImage() {
    const { id } = props;
    if (isTestImage) {
      return (
        <img
          src={testImageData}
          onError={() => {
            (window as any).noticeError(i18n('profile_load_image_failed'));
            setIsTestImage(false);
            setTestImageData('');
          }}
          onLoad={() => {
            const imageData = testImageData;
            (window as any).uploadGroupAvatar(imageData, id);
            setIsTestImage(true);
            setTestImageData(imageData);
          }}
          style={{ display: 'none' }}
        />
      );
    }
    return null;
  }

  const renderEditButton = () => {
    const { isGroupV2Owner, isGroupV2Admin, anyoneChangeName } = props;

    if (!isGroupV2Owner && !isGroupV2Admin && !anyoneChangeName) {
      return null;
    }

    if (isEditingName) {
      return null;
    }

    return (
      <div
        className={'edit-btn'}
        onClick={() => {
          setIsEditingName(true);
        }}
      ></div>
    );
  };

  useEffect(() => {
    if (textareaRef?.current) {
      (window as any).autosize.update(textareaRef.current);

      if (isEditingName) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(-1, -1);
      }
    }
  }, [isEditingName]);

  useEffect(() => {
    if (textareaRef?.current) {
      (window as any).autosize.update(textareaRef.current);
    }
  }, [props.name, editGroupName]);

  const cbTextareaRef = useCallback(element => {
    if (element) {
      (window as any).autosize(element);
    }

    textareaRef.current = element;
  }, []);

  const renderGroupEdit = () => {
    const {
      isGroupV2Owner,
      isGroupV2Admin,
      id,
      name,
      avatarPath,
      onRenameGroupName,
    } = props;

    return (
      <div className={'edit-group-container'}>
        <input
          type={'file'}
          ref={inputRefImageSelect}
          accept={'image/png, image/jpg, image/bmp, image/gif'}
          style={{ position: 'absolute', display: 'none' }}
          onChange={inputImageSelectChange}
        />
        {renderTestImage()}
        <div className={'conversation_settings_group_avatar'}>
          <div
            style={{
              width: 'fit-content',
              display: 'inline-block',
              padding: '24px 0 10px 0',
            }}
          >
            <Avatar
              id={id}
              conversationType={'group'}
              i18n={i18n}
              size={80}
              avatarPath={avatarPath}
              name={name}
              canUpload={
                isGroupV2Admin || isGroupV2Owner ? inputUploadImage : undefined
              }
              noClickEvent={true}
              noteToSelf={false}
              canPreviewAvatar={!(isGroupV2Admin || isGroupV2Owner)}
            />
          </div>
        </div>
        <p>{i18n('conversation_settings_group_name')}</p>
        <div className="group_name-wrapper">
          <textarea
            ref={cbTextareaRef}
            disabled={!isEditingName}
            defaultValue={props.name}
            maxLength={maxGroupNameLength}
            spellCheck={false}
            onChange={e => {
              let text = e.target.value?.trim();
              if (text && text.length > maxGroupNameLength) {
                text = text.substr(0, maxGroupNameLength);
              }
              setEditGroupName(text);
            }}
            onBlur={async () => {
              setOperationLoading(true);
              const result = await onRenameGroupName(editGroupName);
              setOperationLoading(false);
              if (result) {
                setIsEditingName(false);
                SetEditGroupNameErrorTips('');
              } else {
                SetEditGroupNameErrorTips('Save group name failed!');
              }
            }}
          />
          {renderEditButton()}
        </div>
        <span className={'textarea-word-count'}>
          {editGroupName.length + '/' + maxGroupNameLength}
        </span>
        {editGroupNameErrorTips ? (
          <p style={{ color: 'red' }}>{editGroupNameErrorTips}</p>
        ) : null}
        <div style={{ position: 'relative' }}>
          <p>{i18n('groupLink')}</p>
          <span className={'group-link-text'}>
            {Array.isArray(groupLinkText) ? groupLinkText[1] : groupLinkText}
          </span>
          {showCopyShareButton ? (
            <div className={'group-link-buttons'}>
              <button
                onClick={async () => {
                  await (window as any).copyText(groupLinkText[1]);
                  // await navigator.clipboard.writeText(groupLinkText[1]);
                  setCopyButton(i18n('copiedButton'));
                }}
              >
                {copyButton}
              </button>
              <button
                onClick={() => {
                  setShowForwardDialog(true);
                }}
              >
                {i18n('shareButton')}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  const renderForwardDialog = () => {
    const { onForwardTo } = props;
    if (!showForwardDialog) {
      return null;
    }

    return (
      <ForwardDialog
        i18n={i18n}
        isMerge={false}
        title={i18n('shareGroupTitle')}
        onForwardTo={conversationIds => {
          onForwardTo(conversationIds, groupLinkText[0]);
        }}
        conversations={(window as any).getAliveConversationsProps()}
        onClose={() => setShowForwardDialog(false)}
        onCancel={() => setShowForwardDialog(false)}
      />
    );
  };

  if (showGroupManagerModerators) {
    const admins = members.filter(item => {
      return item.role !== 2;
    });
    return (
      <PollModal onClose={props.onCancel} escClose={true}>
        <div className="conversation-settings-dialog">
          {renderOperationLoading()}
          {renderBackBtn()}
          {renderCloseBtn()}
          {renderTitle()}
          <GroupMemberList
            i18n={i18n}
            members={admins}
            memberRapidRole={memberRapidRole}
          />
        </div>
      </PollModal>
    );
  }

  if (showGroupManagerTransfer) {
    const users = members.filter(item => {
      return item.role !== 0;
    });
    return (
      <PollModal onClose={props.onCancel} escClose={true}>
        <div className="conversation-settings-dialog">
          {renderOperationLoading()}
          {renderBackBtn()}
          {renderCloseBtn()}
          {renderTitle()}
          <GroupMemberList
            i18n={i18n}
            members={users}
            transferGroupOwner={(id: string) => {
              props.onTransferGroupOwner(id);
              props.onCancel();
            }}
            memberRapidRole={memberRapidRole}
          />
        </div>
      </PollModal>
    );
  }

  if (editGroup) {
    return (
      <PollModal onClose={props.onCancel} escClose={true}>
        <div className="conversation-settings-dialog">
          {renderOperationLoading()}
          {renderBackBtn()}
          {renderCloseBtn()}
          {renderTitle()}
          {renderGroupEdit()}
          {renderForwardDialog()}
        </div>
      </PollModal>
    );
  }

  if (showMembers) {
    return (
      <PollModal onClose={props.onCancel} escClose={true}>
        <div className="conversation-settings-dialog">
          {renderOperationLoading()}
          {renderBackBtn()}
          {renderCloseBtn()}
          {renderTitle()}
          <GroupMemberList
            i18n={i18n}
            members={members}
            changeGroupMemberRapidRole={changeGroupMemberRapidRole}
            memberRapidRole={memberRapidRole}
          />
        </div>
      </PollModal>
    );
  }

  if (showGroupManager) {
    return (
      <PollModal onClose={props.onCancel} escClose={true}>
        <div className="conversation-settings-dialog">
          {renderOperationLoading()}
          {renderBackBtn()}
          {renderCloseBtn()}
          {renderTitle()}
          {renderGroupModerators()}
          {
            <div
              className={'common-container'}
              onClick={() => {
                setShowGroupManagerTransfer(true);
              }}
            >
              <span>{i18n('conversation_settings_group_transfer')}</span>
              <span className={'forward-icon'} />
            </div>
          }
          {renderInviteRule()}
          {/* {renderAnyoneRemove()} */}
          {/* {renderRejoin()} */}
          {renderPublishOnlyGroup()}
          {/* {renderAnyoneChangeName()} */}
          {renderLinkInviteSwitch()}
        </div>
      </PollModal>
    );
  }

  const renderCommonGroups = () => {
    if (!isPrivate) {
      return null;
    }

    const groupCount = commonGroups.length;
    const countTitleKey =
      groupCount > 1 ? 'groupCountTitle2' : 'groupCountTitle1';

    return (
      <div
        className={'common-container'}
        onClick={() => {
          if (commonGroups.length) {
            setShowCommonGroups(true);
          }
        }}
      >
        <span>{i18n('commonGroupTitle')}</span>
        <span className="common-groups-count">
          {i18n(countTitleKey, [`${groupCount}`])}
        </span>
        <span className={groupCount > 0 ? 'forward-icon' : ''} />
      </div>
    );
  };

  if (showCommonGroups) {
    return (
      <PollModal onClose={props.onCancel} escClose={true}>
        <div className="conversation-settings-dialog">
          {renderOperationLoading()}
          {renderBackBtn()}
          {renderCloseBtn()}
          {renderTitle()}
          <GroupMemberList
            i18n={i18n}
            members={commonGroups}
            isCommonGroups={true}
          />
        </div>
      </PollModal>
    );
  }

  let emergencyOfGroup = false;
  if (!isPrivate) {
    const spookyBotId = (window as any).getGlobalConfig().spookyBotId;
    if (members.find(item => item.id === spookyBotId)) {
      emergencyOfGroup = true;
    }
  }
  return (
    <PollModal onClose={props.onCancel} escClose={true}>
      <div className="conversation-settings-dialog">
        {renderOperationLoading()}
        {renderCloseBtn()}
        {renderTitle()}
        <div className="conversation-settings-item-list">
          {renderGroupAvatarHeader()}
          {renderGroupMembers()}
          {renderGroupManager()}
          {renderStick()}
          {renderViewMedia()}
          {/*{renderResetSession()}*/}
          {renderNotifications()}
          {renderMute()}
          {/* {renderLargeGroup()} */}
          {renderHistorySearchEntry()}
          {renderMessageExpirySettings()}
          {/* {renderGroupRemindCycle()} */}
          {((isPrivate && spookyBotFlag) || emergencyOfGroup) &&
            renderEmergencyBtn()}
          {isBlockBot ? renderBlock() : null}
          {renderCommonGroups()}
        </div>
        {renderLeaveButton()}
        {renderDisbandButton()}
      </div>
    </PollModal>
  );
};
