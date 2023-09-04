import { difference, omit } from 'lodash';

import { trigger } from '../../shims/events';
import { NoopActionType } from './noop';
import { makeLookup } from '../../util/makeLookup';

export type MessageType = {
  id: string;
  conversationId: string;
  sentAt: number;
  receivedAt: number;
  serverTimestamp: number;

  snippet: string;

  from: {
    phoneNumber: string;
    isMe?: boolean;
    name?: string;
    color?: string;
    profileName?: string;
    avatarPath?: string;
  };

  to: {
    groupName?: string;
    phoneNumber: string;
    isMe?: boolean;
    name?: string;
    profileName?: string;
  };

  isSelected?: boolean;
};

export type DBConversationType = {
  id: string;
  lastMessage: string;
  type: string;
  left?: boolean;
  active_at?: number;
  directoryUser?: boolean;
  disbanded?: boolean;
};

export type ProtectedConfigs = {
  staff?: StaffInfoType;
};

export type StaffInfoType = {
  roleNames?: Array<string>;
  buNamePaths?: Array<string>;
  groupNamePaths?: Array<string>;
  directParentName?: string;
  directParentEmail?: string;
  localParentName?: string;
  enable?: boolean;
};

export type SearchMacthInfoType = {
  field: string;
  value: string;
  position: number;
  searchWord: string;
};

export type ConversationType = {
  keyPosition?: number;
  id: string;
  name?: string;
  isArchived: boolean;
  activeAt?: number;
  timestamp: number;
  lastMessage?: {
    status: 'error' | 'sending' | 'sent' | 'delivered' | 'read';
    text: string;
  };
  atPersons?: string;
  phoneNumber: string;
  type: 'direct' | 'group';
  isMe: boolean;
  lastUpdated: number;
  unreadCount: number;
  isSelected: boolean;
  isTyping: boolean;
  signature?: string;
  timeZone?: string;
  email?: string;
  directoryUser?: boolean;
  isStick?: boolean;
  members?: Array<string>;
  notificationSetting?: number;
  firstMatch?: SearchMacthInfoType;
  searchResultMembers?: Array<ConversationType>;
  protectedConfigs?: ProtectedConfigs;
  extId?: any;
  isAliveGroup?: boolean;
};
export type ConversationLookupType = {
  [key: string]: ConversationType;
};

export type MemberGroupLookupType = {
  [key: string]: Array<string>;
};

export type ConversationsStateType = {
  conversationLookup: ConversationLookupType;
  memberGroupLookup: MemberGroupLookupType;
  selectedConversation?: string;
  showArchived: boolean;
  meetings: MeetingsStateType;
};

export type MeetingType = {
  channelName: string;
  shouldJoin: boolean;
  startAt: number;
  online: number;
  isPrivate: boolean;
  timestamp: number;
  meetingType: 'private' | 'instant' | 'group' | 'external';
  privateUsers: Array<string>;
  name: string;
};

export type MeetingsStateType = {
  [key: string]: MeetingType;
};

export type ConversationMeetingStateType = {
  [conversationId: string]: MeetingType;
};

// Actions

type ConversationAddedActionType = {
  type: 'CONVERSATION_ADDED';
  payload: {
    id: string;
    data: ConversationType;
  };
};
type ConversationChangedActionType = {
  type: 'CONVERSATION_CHANGED';
  payload: {
    id: string;
    data: ConversationType;
  };
};
type ConversationRemovedActionType = {
  type: 'CONVERSATION_REMOVED';
  payload: {
    id: string;
  };
};

type ConversationBulkUpdateActionType = {
  type: 'CONVERSATION_BULK_UPDATE';
  payload: {
    data: Array<ConversationType>;
  };
};

export type RemoveAllConversationsActionType = {
  type: 'CONVERSATIONS_REMOVE_ALL';
  payload: null;
};
export type MessageExpiredActionType = {
  type: 'MESSAGE_EXPIRED';
  payload: {
    id: string;
    conversationId: string;
  };
};
export type SelectedConversationChangedActionType = {
  type: 'SELECTED_CONVERSATION_CHANGED';
  payload: {
    id: string;
    messageId?: string;
  };
};
type ShowInboxActionType = {
  type: 'SHOW_INBOX';
  payload: null;
};
type ShowArchivedConversationsActionType = {
  type: 'SHOW_ARCHIVED_CONVERSATIONS';
  payload: null;
};

// Actions
type MeetingAddedActionType = {
  type: 'MEETING_ADDED';
  payload: {
    channelName: string;
    data: MeetingType;
  };
};

type MeetingRemovedActionType = {
  type: 'MEETING_REMOVED';
  payload: {
    channelName: string;
    data: MeetingType;
  };
};

type MeetingUpdateActionType = {
  type: 'MEETING_UPDATE';
  payload: {
    channelName: string;
    data: MeetingType;
  };
};

type MeetingRemoveAllActionType = {
  type: 'MEETING_REMOVE_ALL';
  payload: {};
};

type MeetingJoinUpdateActionType = {
  type: 'MEETING_JOIN_UPDATE';
  payload: {
    channelName: string;
    data: MeetingType;
  };
};

// type MeetingUpdateDurationActionType = {
//   type: 'MEETING_UPDATE_DURATION';
//   payload: {};
// };

function meetingAdded(
  channelName: string,
  data: MeetingType
): MeetingAddedActionType {
  return {
    type: 'MEETING_ADDED',
    payload: {
      channelName,
      data,
    },
  };
}

function meetingUpdate(
  channelName: string,
  data: MeetingType
): MeetingUpdateActionType {
  return {
    type: 'MEETING_UPDATE',
    payload: {
      channelName,
      data,
    },
  };
}

function meetingRemoved(
  channelName: string,
  data: MeetingType
): MeetingRemovedActionType {
  return {
    type: 'MEETING_REMOVED',
    payload: {
      channelName,
      data,
    },
  };
}

function meetingRemoveAll(): MeetingRemoveAllActionType {
  return {
    type: 'MEETING_REMOVE_ALL',
    payload: {},
  };
}

function meetingJoinUpdate(
  channelName: string,
  data: MeetingType
): MeetingJoinUpdateActionType {
  return {
    type: 'MEETING_JOIN_UPDATE',
    payload: {
      channelName,
      data,
    },
  };
}

// function meetingUpdateDuration(): MeetingUpdateDurationActionType {
//   return {
//     type: 'MEETING_UPDATE_DURATION',
//     payload: {},
//   };
// }

export type ConversationActionType =
  | ConversationAddedActionType
  | ConversationChangedActionType
  | ConversationRemovedActionType
  | RemoveAllConversationsActionType
  | ConversationBulkUpdateActionType
  | MessageExpiredActionType
  | SelectedConversationChangedActionType
  | MessageExpiredActionType
  | SelectedConversationChangedActionType
  | ShowInboxActionType
  | ShowArchivedConversationsActionType
  | MeetingAddedActionType
  | MeetingRemovedActionType
  | MeetingUpdateActionType
  | MeetingRemoveAllActionType
  // | MeetingUpdateDurationActionType;
  | MeetingJoinUpdateActionType;
// Action Creators

export const actions = {
  conversationAdded,
  conversationChanged,
  conversationRemoved,
  conversationStick,
  conversationLeaveGroup,
  conversationDisbandGroup,
  conversationMute,
  conversationArchived,
  removeAllConversations,
  conversationsBulkUpdate,
  messageExpired,
  openConversationInternal,
  openConversationExternal,
  showInbox,
  showArchivedConversations,
  meetingAdded,
  meetingRemoved,
  meetingUpdate,
  meetingRemoveAll,
  meetingJoinUpdate,
  // meetingUpdateDuration,
  deleteMessages,
};

function conversationAdded(
  id: string,
  data: ConversationType
): ConversationAddedActionType {
  return {
    type: 'CONVERSATION_ADDED',
    payload: {
      id,
      data,
    },
  };
}

function conversationChanged(
  id: string,
  data: ConversationType
): ConversationChangedActionType {
  return {
    type: 'CONVERSATION_CHANGED',
    payload: {
      id,
      data,
    },
  };
}

function conversationRemoved(id: string): ConversationRemovedActionType {
  return {
    type: 'CONVERSATION_REMOVED',
    payload: {
      id,
    },
  };
}

function conversationStick(id: string, stick: boolean): NoopActionType {
  trigger('conversationStick', id, stick);
  return {
    type: 'NOOP',
    payload: null,
  };
}
function conversationLeaveGroup(id: string): NoopActionType {
  trigger('conversationLeaveGroup', id);
  return {
    type: 'NOOP',
    payload: null,
  };
}
function conversationDisbandGroup(id: string): NoopActionType {
  trigger('conversationDisbandGroup', id);
  return {
    type: 'NOOP',
    payload: null,
  };
}

function conversationMute(id: string, mute: boolean): NoopActionType {
  trigger('conversationMute', id, mute);
  return {
    type: 'NOOP',
    payload: null,
  };
}

function conversationArchived(id: string): NoopActionType {
  trigger('conversationArchived', id);
  return {
    type: 'NOOP',
    payload: null,
  };
}

function removeAllConversations(): RemoveAllConversationsActionType {
  return {
    type: 'CONVERSATIONS_REMOVE_ALL',
    payload: null,
  };
}

function conversationsBulkUpdate(
  data: Array<ConversationType>
): ConversationBulkUpdateActionType {
  return {
    type: 'CONVERSATION_BULK_UPDATE',
    payload: {
      data,
    },
  };
}

function messageExpired(
  id: string,
  conversationId: string
): MessageExpiredActionType {
  return {
    type: 'MESSAGE_EXPIRED',
    payload: {
      id,
      conversationId,
    },
  };
}

// Note: we need two actions here to simplify. Operations outside of the left pane can
//   trigger an 'openConversation' so we go through Whisper.events for all conversation
//   selection.
function openConversationInternal(
  id: string,
  messageId?: string
): NoopActionType {
  trigger('showConversation', id, messageId);

  return {
    type: 'NOOP',
    payload: null,
  };
}

function openConversationExternal(
  id: string,
  messageId?: string
): SelectedConversationChangedActionType {
  return {
    type: 'SELECTED_CONVERSATION_CHANGED',
    payload: {
      id,
      messageId,
    },
  };
}

function showInbox() {
  return {
    type: 'SHOW_INBOX',
    payload: null,
  };
}

function showArchivedConversations() {
  return {
    type: 'SHOW_ARCHIVED_CONVERSATIONS',
    payload: null,
  };
}

function deleteMessages(
  id: string,
  type: string,
  deleteInFolder?: any
): NoopActionType {
  trigger('deleteMessages', id, type, deleteInFolder);

  return {
    type: 'NOOP',
    payload: null,
  };
}

// Reducer

function getEmptyState(): ConversationsStateType {
  return {
    conversationLookup: {},
    memberGroupLookup: {},
    showArchived: false,
    meetings: {},
  };
}

// tslint:disable-next-line:max-func-body-length
export function reducer(
  state: ConversationsStateType,
  action: ConversationActionType
): ConversationsStateType {
  if (!state) {
    return getEmptyState();
  }

  const memberAdded = (
    lookup: MemberGroupLookupType,
    member: string,
    id: string
  ) => {
    const groups = lookup[member];
    if (groups) {
      if (!groups.includes(id)) {
        groups.push(id);
      }
    } else {
      lookup[member] = [id];
    }
  };

  const memberRemoved = (
    lookup: MemberGroupLookupType,
    member: string,
    id: string
  ) => {
    const groups = lookup[member];
    if (groups) {
      groups.splice(groups.indexOf(id), 1);
    }
  };

  const { memberGroupLookup = {} } = state;

  if (!state.memberGroupLookup && state.conversationLookup) {
    Object.keys(state.conversationLookup).forEach(id => {
      const conversation = state.conversationLookup[id];
      if (conversation.type === 'group' && conversation.members?.length) {
        conversation.members.forEach(member =>
          memberAdded(memberGroupLookup, member, id)
        );
      }
    });
    state.memberGroupLookup = memberGroupLookup;
  }

  if (action.type === 'CONVERSATION_ADDED') {
    const { payload } = action;
    const { id, data } = payload;
    const { conversationLookup } = state;

    if (data.type === 'group' && data.members?.length) {
      data.members.forEach(member =>
        memberAdded(memberGroupLookup, member, id)
      );
    }

    return {
      ...state,
      conversationLookup: {
        ...conversationLookup,
        [id]: data,
      },
      memberGroupLookup,
    };
  }
  if (action.type === 'CONVERSATION_CHANGED') {
    const { payload } = action;
    const { id, data } = payload;
    const { conversationLookup } = state;
    let showArchived = state.showArchived;
    let selectedConversation = state.selectedConversation;

    const existing = conversationLookup[id];
    // In the change case we only modify the lookup if we already had that conversation
    if (!existing) {
      return state;
    }

    if (selectedConversation === id) {
      // Archived -> Inbox: we go back to the normal inbox view
      if (existing.isArchived && !data.isArchived) {
        showArchived = false;
      }
      // Inbox -> Archived: no conversation is selected
      // Note: With today's stacked converastions architecture, this can result in weird
      //   behavior - no selected conversation in the left pane, but a conversation show
      //   in the right pane.
      if (!existing.isArchived && data.isArchived) {
        selectedConversation = undefined;
      }
    }

    if (data.type === 'group' && data.members?.length) {
      const addedMembers = difference(
        data.members || [],
        existing.members || []
      );
      const removedMembers = difference(
        existing.members || [],
        data.members || []
      );

      addedMembers.forEach(member =>
        memberAdded(memberGroupLookup, member, id)
      );
      removedMembers.forEach(member =>
        memberRemoved(memberGroupLookup, member, id)
      );
    }

    return {
      ...state,
      selectedConversation,
      showArchived,
      conversationLookup: {
        ...conversationLookup,
        [id]: data,
      },
      memberGroupLookup,
    };
  }
  if (action.type === 'CONVERSATION_REMOVED') {
    const { payload } = action;
    const { id } = payload;
    const { conversationLookup } = state;

    const existing = conversationLookup[id];
    if (existing?.type === 'group' && existing.members?.length) {
      const members = existing.members || [];
      members.forEach(member => memberRemoved(memberGroupLookup, member, id));
    }

    return {
      ...state,
      conversationLookup: omit(conversationLookup, [id]),
      memberGroupLookup,
    };
  }
  if (action.type === 'CONVERSATIONS_REMOVE_ALL') {
    return getEmptyState();
  }

  if (action.type === 'CONVERSATION_BULK_UPDATE') {
    const { payload } = action;
    const { data } = payload;
    const { conversationLookup } = state;

    const newLookup = makeLookup(data, 'id');

    data.forEach(c => {
      const existing = conversationLookup[c.id];
      if (existing?.type === 'group' && existing.members?.length) {
        const addedMembers = difference(
          c.members || [],
          existing.members || []
        );
        const removedMembers = difference(
          existing.members || [],
          c.members || []
        );

        addedMembers.forEach(member =>
          memberAdded(memberGroupLookup, member, c.id)
        );
        removedMembers.forEach(member =>
          memberRemoved(memberGroupLookup, member, c.id)
        );
      }
    });

    return {
      ...state,
      conversationLookup: {
        ...conversationLookup,
        ...newLookup,
      },
      memberGroupLookup,
    };
  }

  if (action.type === 'MESSAGE_EXPIRED') {
    // noop - for now this is only important for search
  }
  if (action.type === 'SELECTED_CONVERSATION_CHANGED') {
    const { payload } = action;
    const { id } = payload;

    return {
      ...state,
      selectedConversation: id,
    };
  }
  if (action.type === 'SHOW_INBOX') {
    return {
      ...state,
      showArchived: false,
    };
  }
  if (action.type === 'SHOW_ARCHIVED_CONVERSATIONS') {
    return {
      ...state,
      showArchived: true,
    };
  }

  if (action.type === 'MEETING_ADDED') {
    const { payload } = action;
    const { channelName, data } = payload;

    // 存在
    if (state.meetings.hasOwnProperty(channelName)) {
      return {
        ...state,
        meetings: {
          ...state.meetings,
          [channelName]: {
            ...data,
            shouldJoin: state.meetings[channelName].shouldJoin,
          },
        },
      };
    }

    return {
      ...state,
      meetings: { ...state.meetings, [channelName]: data },
    };
  }

  if (action.type === 'MEETING_REMOVED') {
    const { payload } = action;
    const { channelName, data } = payload;

    const tmp = state.meetings[channelName];
    if (tmp && tmp.meetingType === data.meetingType && !tmp.shouldJoin) {
      return {
        ...state,
        meetings: omit(state.meetings, [channelName]),
      };
    }

    // 清除online, startAt
    if (tmp && tmp.shouldJoin) {
      return {
        ...state,
        meetings: {
          ...state.meetings,
          [channelName]: { ...tmp, online: 0, startAt: 0 },
        },
      };
    }

    return {
      ...state,
    };
  }

  if (action.type === 'MEETING_UPDATE') {
    const { payload } = action;
    const { channelName, data } = payload;

    // 不存在直接丢弃
    if (!state.meetings.hasOwnProperty(channelName)) {
      return {
        ...state,
      };
    }

    // 需要保存之前的时间戳
    data.timestamp = state.meetings[channelName].timestamp;
    if (state.meetings[channelName].shouldJoin) {
      data.shouldJoin = state.meetings[channelName].shouldJoin;
    }

    return {
      ...state,
      meetings: { ...state.meetings, [channelName]: data },
    };
  }

  if (action.type === 'MEETING_REMOVE_ALL') {
    // 需要保留private类型会议
    const privateMeetings = {};
    const meetings = { ...state.meetings };
    Object.keys(meetings).forEach(channelName => {
      const item = meetings[channelName];
      if (item.isPrivate) {
        // @ts-ignore
        privateMeetings[channelName] = { ...item };
      }
    });

    return {
      ...state,
      meetings: privateMeetings,
    };
  }

  if (action.type === 'MEETING_JOIN_UPDATE') {
    const { payload } = action;
    const { channelName, data } = payload;
    const { shouldJoin } = data;

    // 不存在此会议
    if (!state.meetings.hasOwnProperty(channelName)) {
      if (shouldJoin) {
        return {
          ...state,
          meetings: {
            ...state.meetings,
            [channelName]: {
              ...data,
              startAt: 0,
              online: 0,
              isPrivate: false,
              timestamp: Date.now(),
              meetingType: 'group',
            },
          },
        };
      }
    } else {
      if (!shouldJoin && !state.meetings[channelName].startAt) {
        return {
          ...state,
          meetings: omit(state.meetings, [channelName]),
        };
      }
      return {
        ...state,
        meetings: {
          ...state.meetings,
          [channelName]: { ...state.meetings[channelName], shouldJoin },
        },
      };
    }

    return {
      ...state,
    };
  }

  // if (action.type === 'MEETING_UPDATE_DURATION') {
  //   const meetings = {...state.meetings};
  //   Object.keys(meetings).forEach(channelName => {
  //     meetings[channelName].duration = meetings[channelName].duration + 1;
  //   });
  //
  //   return {
  //     ...state,
  //     meetings,
  //   };
  // }

  return state;
}
