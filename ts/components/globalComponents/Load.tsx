import React, { useEffect, useState } from 'react';
import { LocalizerType } from '../../types/Util';
import MembersChange from './MembersChange';
import { Notice } from '../Notice';
import CreateGroup from './CreateGroup';
import { Modal } from 'antd';
import BeforeJoinMeeting from './BeforeJoinMeeting';

type PropsType = {
  i18n: LocalizerType;
  ourNumber: string;
};

export default function Load(props: PropsType) {
  const { i18n, ourNumber } = props;
  const collator = new Intl.Collator();

  const [showCreateGroupDialog, setShowCreateGroupDialog] = useState(false);
  const [buList, setBuList] = useState([] as any);
  const [leaderList, setLeaderList] = useState([] as any);

  const [meetingOptions, setMeetingOptions] = useState(null);
  const [showJoinMeetingDialog, setShowJoinMeetingDialog] = useState(false);
  const [showMembersChangeDialog, setShowMembersChangeDialog] = useState(false);
  const [membersChangeType, setMembersChangeType] = useState('');
  const [membersChangeItems, setMembersChangeItems] = useState<Array<any>>([]);
  const [membersChangeDisabledItems, setMembersChangeDisabledItems] = useState<
    Array<string>
  >([]);
  const [membersChangeRapidId, setMembersChangeRapidId] = useState(null);
  const [membersChangeGroupId, setMembersChangeGroupId] = useState(null);
  const [membersChangeGroupName, setMembersChangeGroupName] = useState('');
  const [membersChangeFromGroup, setMembersChangeFromGroup] = useState(null);
  const [channelName, setChannelName] = useState('');
  const [memberRapidRole, setMemberRapidRole] = useState<any>({});
  const [membersChangeMeetingId, setMembersChangeMeetingId] = useState('');
  //设置meetingKey和meetingVersion
  const [membersChangeMeetingKey, setMembersChangeMeetingKey] = useState('');
  const [membersChangeMeetingVersion, setMembersChangeMeetingVersion] =
    useState(1);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (window as any).addEventListener(
      'global-components-members-change',
      membersChange
    );

    (window as any).addEventListener(
      'maybe-rapid-role-change',
      maybeRapidRoleChange
    );

    (window as any).addEventListener('before-join-meeting', beforeJoinMeeting);

    (window as any).addEventListener('close-all-load-dialog', closeAllDialog);

    return () => {
      (window as any).removeEventListener(
        'global-components-members-change',
        membersChange
      );
      (window as any).removeEventListener(
        'maybe-rapid-role-change',
        maybeRapidRoleChange
      );
      (window as any).removeEventListener(
        'before-join-meeting',
        beforeJoinMeeting
      );
      (window as any).removeEventListener(
        'close-all-load-dialog',
        closeAllDialog
      );
    };
  }, []);

  const closeAllDialog = () => {
    setShowCreateGroupDialog(false);
    setShowMembersChangeDialog(false);
    setShowJoinMeetingDialog(false);
  };

  const maybeRapidRoleChange = (event: any) => {
    const rapidRole = event.detail;
    if (rapidRole) {
      setMemberRapidRole(rapidRole);
    }
  };
  const onConfirm = (members: Array<string>, options: any) => {
    if (
      membersChangeType === 'new-group' ||
      membersChangeType === 'rapid-group' ||
      membersChangeType === 'group-rapid-group'
    ) {
      // setShowCreateGroupDialog(false);
      setLoading(true);

      const fromGroup =
        membersChangeType === 'group-rapid-group'
          ? membersChangeFromGroup
          : undefined;

      // 群名字限制64字节长度
      let name = options.groupName || 'New group';
      if (name > 64) {
        name = name.substring(0, 64);
      }
      const editInfo = {
        mode: 'new-group',
        groupInfo: {
          name,
          members:
            membersChangeType === 'new-group' ||
            membersChangeType === 'group-rapid-group'
              ? members
              : [...members, membersChangeRapidId],
        },
        fromGroup,
      };

      (window as any).Whisper.events.once(
        'result-of-create-or-edit',
        (result: boolean) => {
          setLoading(false);
          if (result) {
            setShowCreateGroupDialog(false);
          }
        }
      );

      (window as any).Whisper.events.trigger(
        'create-or-edit-group',
        undefined,
        editInfo
      );
    }

    if (membersChangeType === 'instant-meeting') {
      setShowMembersChangeDialog(false);
      (window as any).instantMeeting(
        members,
        options.groupName || 'Chative Meeting'
      );
    }
    if (
      membersChangeType === 'add-group-members' ||
      membersChangeType === 'remove-group-members'
    ) {
      // setShowMembersChangeDialog(false);
      setLoading(true);

      const editInfo = {
        mode: membersChangeType,
        groupInfo: {
          id: membersChangeGroupId,
          members,
          operator: ourNumber,
        },
      };

      (window as any).Whisper.events.once(
        'result-of-create-or-edit',
        (result: boolean) => {
          setLoading(false);
          if (result) {
            setShowMembersChangeDialog(false);
          }
        }
      );

      (window as any).Whisper.events.trigger(
        'create-or-edit-group',
        undefined,
        editInfo
      );
    }
    if (
      membersChangeType === 'add-group-admins' ||
      membersChangeType === 'remove-group-admins'
    ) {
      // setShowMembersChangeDialog(false);
      setLoading(true);

      const editInfo = {
        mode: membersChangeType,
        groupInfo: {
          id: membersChangeGroupId,
          members,
        },
      };

      (window as any).Whisper.events.once(
        'result-of-create-or-edit',
        (result: boolean) => {
          setLoading(false);
          if (result) {
            setShowMembersChangeDialog(false);
          }
        }
      );

      (window as any).Whisper.events.trigger(
        'create-or-edit-group',
        undefined,
        editInfo
      );
    }
    if (membersChangeType === 'meeting-add') {
      setShowMembersChangeDialog(false);

      (window as any).addMeetingMembers(
        members,
        channelName,
        membersChangeGroupName,
        membersChangeMeetingId,
        membersChangeMeetingKey,
        membersChangeMeetingVersion
      );
    }
  };

  const getContactsUsers = async () => {
    const items = (window as any).getPrivateConversations();
    items.sort((left: any, right: any) => {
      if (left.isMe()) {
        return -1;
      }
      if (right.isMe()) {
        return 1;
      }

      const leftLower = (left.getName() || left.id).toLowerCase().trim();
      const rightLower = (right.getName() || right.id).toLowerCase().trim();
      return collator.compare(leftLower, rightLower);
    });

    const itemsSort = items.map((v: any) => {
      return { ...v.cachedProps, isMe: false };
    });

    // 外部用户不可以添加
    const filterItemSort = itemsSort.filter((m: any) => m.directoryUser);
    setMembersChangeItems(filterItemSort);
    return filterItemSort;
  };

  const getUserAccessedBUList = async () => {
    return;

    try {
      const BuResult = await (
        window as any
      ).textsecure.messaging.getUserAccessedBUList();
      const { buList } = BuResult || {};
      if (buList && buList instanceof Array) {
        (window as any).cacheBuList = buList;
        setBuList([...buList]);
      }
    } catch (e) {
      (window as any).log.info('getUserAccessedBUList failed', e);
    }
  };

  const getUserAccessedLeaderList = async () => {
    return;

    try {
      const LeaderResult = await (
        window as any
      ).textsecure.messaging.getUserAccessedLeaderList();
      const { userList } = LeaderResult || {};
      if (userList && userList instanceof Array) {
        (window as any).cacheLeaderList = userList;
        setLeaderList([...userList]);
      }
    } catch (e) {
      (window as any).log.info('getUserAccessedLeaderList failed', e);
    }
  };

  const membersChange = async (ev: any) => {
    if (!ev || !ev.detail) {
      return;
    }
    const conversations = (window as any).getPrivateConversations();
    const allItems = conversations.map((v: any) => {
      return { ...v.cachedProps, isMe: false };
    });

    if (
      ev.detail.type === 'new-group' ||
      ev.detail.type === 'rapid-group' ||
      ev.detail.type === 'group-rapid-group'
    ) {
      // new-group || rapid-group || group-rapid-group
      // 获取 BU 和 Leader 相关信息, 有缓存用缓存，因为这信息一天更新一次，客户端 6小时拉一次
      if ((window as any).cacheBuList) {
        setBuList((window as any).cacheBuList);
      } else {
        getUserAccessedBUList();
      }

      if ((window as any).cacheLeaderList) {
        setLeaderList((window as any).cacheLeaderList);
      } else {
        getUserAccessedLeaderList();
      }
    }

    if (ev.detail.type === 'new-group' || ev.detail.type === 'rapid-group') {
      setMembersChangeType(ev.detail.type);
      const items = await getContactsUsers();
      if (ev.detail.type === 'new-group') {
        setMembersChangeDisabledItems([ourNumber]);
      }
      if (ev.detail.type === 'rapid-group') {
        if (!ev.detail.id) {
          throw Error('Rapid bad param id.');
        }
        let existContact;
        for (let i = 0; i < items.length; i += 1) {
          if (items[i].id === ev.detail.id) {
            existContact = true;
            break;
          }
        }
        if (!existContact) {
          alert('The user is not in your contact list!');
          return;
        }
        setMembersChangeDisabledItems([ourNumber, ev.detail.id]);
        setMembersChangeRapidId(ev.detail.id);
      }
      setShowCreateGroupDialog(true);
    }
    if (ev.detail.type === 'group-rapid-group') {
      await getContactsUsers();
      setMembersChangeType(ev.detail.type);

      if (!ev.detail.name || !ev.detail.groupId) {
        alert('group name|id can not be null!');
        return;
      }

      setMembersChangeFromGroup(ev.detail.groupId);
      setMembersChangeGroupName(ev.detail.name);
      setMembersChangeDisabledItems([ourNumber]);
      setShowCreateGroupDialog(true);
    }

    if (ev.detail.type === 'instant-meeting') {
      setMembersChangeType(ev.detail.type);
      await getContactsUsers();
      setMembersChangeDisabledItems([ourNumber]);
      setShowMembersChangeDialog(true);
    }
    if (ev.detail.type === 'add-group-members' && ev.detail.groupId) {
      setMembersChangeType(ev.detail.type);
      setMembersChangeGroupId(ev.detail.groupId);
      await getContactsUsers();
      const conversation = await (
        window as any
      ).Signal.Data.getConversationById(ev.detail.groupId, {
        Conversation: (window as any).Whisper.Conversation,
      });

      const disabledItems = [ourNumber];
      const members = conversation.get('members') || [];
      for (let i = 0; i < members.length; i++) {
        if (!disabledItems.includes(members[i])) {
          disabledItems.push(members[i]);
        }
      }
      setMembersChangeDisabledItems(disabledItems);
      setMembersChangeGroupName(conversation.get('name'));
      setShowMembersChangeDialog(true);
    }
    if (ev.detail.type === 'remove-group-members' && ev.detail.groupId) {
      setMembersChangeType(ev.detail.type);
      setMembersChangeGroupId(ev.detail.groupId);

      const conversation = await (
        window as any
      ).Signal.Data.getConversationById(ev.detail.groupId, {
        Conversation: (window as any).Whisper.Conversation,
      });
      let meOwner = false;
      const leftItems = [];
      const disabledItems: any = [];
      const members = conversation.get('membersV2') || [];

      const memoryConversation = (window as any).ConversationController.get(
        ev.detail.groupId
      );
      let cacheMemberLastActive =
        memoryConversation?.getCacheMemberLastActive();
      // 这边做一个标记位。而不是看 cacheMemberLastActive 是否为空，因为在没有移除成员前，新消息来，也存到了 cacheMemberLastActive 中。
      if (!cacheMemberLastActive?.flag) {
        const memberLastActive =
          (await (window as any).Signal.Data.getGroupMemberLastActiveList(
            ev.detail.groupId
          )) || [];
        for (let i = 0; i < memberLastActive.length; i++) {
          cacheMemberLastActive[memberLastActive[i]?.number] =
            memberLastActive[i]?.lastActive || 0;
        }
        cacheMemberLastActive.flag = true;

        // 拉取完后更新
        memoryConversation.setCacheMemberLastActive(cacheMemberLastActive);
      }
      for (let i = 0; i < members.length; i++) {
        if (members[i].id === ourNumber) {
          meOwner = members[i].role === 0;
          break;
        }
      }
      for (let i = 0; i < members.length; i++) {
        let pushItem = { id: members[i].id };
        for (let index = 0; index < allItems.length; index += 1) {
          if (members[i].id === allItems[index].id) {
            // allItems 中，如果这个人是非通讯录的，并且本地也没有跟他进行过对话，里面的 extId 是 undefined， 这边用 members 的 extId 重新赋值一下。
            const item = { ...allItems[index] };
            item['extId'] = members[i]?.extId;
            pushItem = item;
            break;
          }
        }
        leftItems.push(pushItem);
        // 自己不可以编辑
        if (members[i].id === ourNumber) {
          disabledItems.push(members[i].id);
          continue;
        }

        if (!meOwner) {
          // 创建者，管理员，不可以编辑
          if (members[i].role !== 2) {
            disabledItems.push(members[i].id);
          }
        }
      }
      leftItems.sort((left: any, right: any) => {
        if (left.id === ourNumber) {
          return 1;
        }
        if (right.id === ourNumber) {
          return -1;
        }
        const leftLastActive = cacheMemberLastActive?.[left.id] || 0;
        const rightLastActive = cacheMemberLastActive?.[right.id] || 0;
        if (leftLastActive === rightLastActive) {
          const leftLower = (left.name || left.id).toLowerCase().trim();
          const rightLower = (right.name || right.id).toLowerCase().trim();
          return collator.compare(leftLower, rightLower);
        } else {
          return leftLastActive - rightLastActive;
        }
      });
      setMembersChangeItems(leftItems);
      setMembersChangeDisabledItems(disabledItems);
      setMembersChangeGroupName(conversation.get('name'));
      setShowMembersChangeDialog(true);
    }
    if (ev.detail.type === 'add-group-admins' && ev.detail.groupId) {
      setMembersChangeType(ev.detail.type);
      setMembersChangeGroupId(ev.detail.groupId);

      const conversation = await (
        window as any
      ).Signal.Data.getConversationById(ev.detail.groupId, {
        Conversation: (window as any).Whisper.Conversation,
      });

      const leftItems = [];
      const disabledItems: any = [];
      const members = conversation.get('membersV2') || [];
      for (let i = 0; i < members.length; i++) {
        let pushItem = { id: members[i].id };
        for (let index = 0; index < allItems.length; index += 1) {
          if (members[i].id === allItems[index].id) {
            pushItem = allItems[index];
          }
        }
        leftItems.push(pushItem);
        if (members[i].role !== 2) {
          disabledItems.push(members[i].id);
        }
      }
      leftItems.sort((left: any, right: any) => {
        if (left.id === ourNumber) {
          return -1;
        }
        if (right.id === ourNumber) {
          return 1;
        }
        const leftLower = (left.name || left.id).toLowerCase().trim();
        const rightLower = (right.name || right.id).toLowerCase().trim();
        return collator.compare(leftLower, rightLower);
      });
      setMembersChangeItems(leftItems);
      setMembersChangeDisabledItems(disabledItems);
      setMembersChangeGroupName(conversation.get('name'));
      setShowMembersChangeDialog(true);
    }
    if (ev.detail.type === 'remove-group-admins' && ev.detail.groupId) {
      setMembersChangeType(ev.detail.type);
      setMembersChangeGroupId(ev.detail.groupId);

      const conversation = await (
        window as any
      ).Signal.Data.getConversationById(ev.detail.groupId, {
        Conversation: (window as any).Whisper.Conversation,
      });

      const leftItems = [];
      const members = conversation.get('membersV2') || [];
      for (let i = 0; i < members.length; i++) {
        let pushItem = { id: members[i].id };
        for (let index = 0; index < allItems.length; index += 1) {
          if (members[i].id === allItems[index].id) {
            pushItem = allItems[index];
          }
        }
        if (members[i].role !== 2) {
          leftItems.push(pushItem);
        }
      }
      leftItems.sort((left: any, right: any) => {
        if (left.id === ourNumber) {
          return -1;
        }
        if (right.id === ourNumber) {
          return 1;
        }
        const leftLower = (left.name || left.id).toLowerCase().trim();
        const rightLower = (right.name || right.id).toLowerCase().trim();
        return collator.compare(leftLower, rightLower);
      });
      setMembersChangeItems(leftItems);
      setMembersChangeDisabledItems([ourNumber]);
      setMembersChangeGroupName(conversation.get('name'));
      setShowMembersChangeDialog(true);
    }
    if (ev.detail.type === 'meeting-add' && ev.detail.channelName) {
      // 创建群组是独立的标记，这边置为false。
      setShowCreateGroupDialog(false);
      setMembersChangeMeetingId(ev.detail.meetingId);
      setMembersChangeMeetingKey(ev.detail.meetingKey);
      setMembersChangeMeetingVersion(ev.detail.meetingVersion);
      setChannelName(ev.detail.channelName);
      setMembersChangeGroupName(ev.detail.meetingName || 'Chative Meeting');
      setMembersChangeType(ev.detail.type);
      await getContactsUsers();
      setMembersChangeDisabledItems([ourNumber]);
      setShowMembersChangeDialog(true);

      // 会议窗口邀请人入会 ，关闭 fullview 或者 halfview
      (window as any).forceCloseWebview();
    }

    // 过来统一存一份当前群成员 id 和 rapidRole 的字典数据， 用于显示 group rapid tag
    const groupConversation = await (
      window as any
    ).Signal.Data.getConversationById(ev.detail.groupId, {
      Conversation: (window as any).Whisper.Conversation,
    });
    if (groupConversation) {
      const membersV2 = groupConversation.get('membersV2') || [];
      let memberAndRapidRole = {} as any;
      membersV2?.forEach((member: any) => {
        if (member?.id) {
          memberAndRapidRole[member.id] = member?.rapidRole;
        }
      });
      setMemberRapidRole(memberAndRapidRole);
    }
  };

  const beforeJoinMeeting = async (ev: any) => {
    setShowMembersChangeDialog(false);
    setShowCreateGroupDialog(false);

    setMeetingOptions(ev.detail);
    setShowJoinMeetingDialog(true);
  };

  return (
    <>
      <Notice />
      {showMembersChangeDialog ? (
        <MembersChange
          i18n={i18n}
          type={membersChangeType}
          onClose={() => {
            if (membersChangeType === 'meeting-add') {
              (window as any).focusMeetingDialog();
            }
            setShowMembersChangeDialog(false);
          }}
          onConfirm={onConfirm}
          groupName={membersChangeGroupName}
          items={membersChangeItems}
          disabledItems={membersChangeDisabledItems}
          memberRapidRole={memberRapidRole}
          loading={loading}
        ></MembersChange>
      ) : null}
      {showCreateGroupDialog && (
        <CreateGroup
          i18n={i18n}
          type={membersChangeType}
          onClose={() => {
            setShowCreateGroupDialog(false);
          }}
          onConfirm={onConfirm}
          groupName={membersChangeGroupName}
          items={membersChangeItems}
          disabledItems={membersChangeDisabledItems}
          memberRapidRole={memberRapidRole}
          buList={buList}
          leaderList={leaderList}
          loading={loading}
        ></CreateGroup>
      )}
      {showJoinMeetingDialog ? (
        <Modal
          centered
          closable={false}
          destroyOnClose={true}
          title={''}
          open={showJoinMeetingDialog}
          onOk={() => {}}
          onCancel={() => setShowJoinMeetingDialog(false)}
          footer={null}
          width={384}
          className={'before-join-meeting-modal'}
          // bodyStyle={{
          //   display: 'flex',
          //   padding: 10,
          //   maxHeight: 375,
          //   backgroundColor: '#2B3139',
          // }}
        >
          <BeforeJoinMeeting
            meetingOptions={meetingOptions}
            // justStart={(meetingOptions as any).justStart}
            onOk={() => {
              setShowJoinMeetingDialog(false);
              (window as any).showCallVoiceGroup(meetingOptions);
            }}
            onCancel={() => setShowJoinMeetingDialog(false)}
          />
        </Modal>
      ) : null}
    </>
  );
}
