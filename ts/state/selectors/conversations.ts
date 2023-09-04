import { createSelector } from 'reselect';
import { format } from '../../types/PhoneNumber';

import { LocalizerType } from '../../types/Util';
import { StateType } from '../reducer';
import {
  ConversationLookupType,
  ConversationMeetingStateType,
  ConversationsStateType,
  ConversationType,
  MeetingsStateType,
  MemberGroupLookupType,
} from '../ducks/conversations';
import { getIntl, getRegionCode, getUserNumber } from './user';
import { uniq } from 'lodash';
import { DockItemType } from '../ducks/dock';

export const getConversations = (state: StateType): ConversationsStateType =>
  state.conversations;
const getContactSearch = (state: StateType): string =>
  state.contactSearch.query;

const currentDockItem = (state: StateType): DockItemType => state.dock.current;

export const getConversationLookup = createSelector(
  getConversations,
  (state: ConversationsStateType): ConversationLookupType => {
    return state.conversationLookup;
  }
);

export const getMemberGroupLookup = createSelector(
  getConversations,
  (state: ConversationsStateType): MemberGroupLookupType => {
    return state.memberGroupLookup;
  }
);

export const getSortedContacts = createSelector(
  [currentDockItem, getIntl, getConversationLookup, getContactSearch],
  (
    dockItem: DockItemType,
    i18n: LocalizerType,
    state: ConversationLookupType,
    searchTerm: string
  ): Array<ConversationType> => {
    if (dockItem !== 'contact') {
      return [];
    }

    const results: Array<ConversationType> = [];
    const search = searchTerm.toLowerCase();

    const SEARCHED_FIELDS = [
      'name',
      'email',
      'signature',
      'id',
      'title',
      'profileName',
      'protectedConfigs',
    ];

    const searchField = (conversation: { [x: string]: any }, field: string) => {
      const value = conversation[field];

      //BU信息单独判断
      if (field === 'protectedConfigs') {
        const buInfo = value?.staff?.buNamePaths?.slice(-1)[0] ?? undefined;
        if (buInfo && buInfo.toLowerCase().includes(search)) {
          return {
            field: 'protectedConfigs',
            value: buInfo,
            position: buInfo.toLowerCase().indexOf(search),
            searchWord: search,
          };
        }
      } else {
        if (value && value.toLowerCase().includes(search)) {
          return {
            field,
            value,
            position: value.toLowerCase().indexOf(search),
            searchWord: search,
          };
        }
      }

      return null;
    };

    Object.keys(state).forEach((k: string) => {
      const c = state[k];
      if (c.type !== 'direct' || !c.directoryUser) {
        return;
      }

      if (!search) {
        //reset firstMatch
        c.firstMatch = undefined;
        results.push(c);
        return;
      }

      for (const field of SEARCHED_FIELDS) {
        const firstMatch = searchField(c, field);
        if (firstMatch) {
          results.push({ ...c, firstMatch });
          return;
        }
      }

      // for self
      if (c.isMe) {
        const name = i18n('me');
        if (name.toLowerCase().includes(search)) {
          results.push(c);
          return;
        }
      }
    });

    results.sort((left: ConversationType, right: ConversationType) => {
      const getTitle = (item: ConversationType) => {
        return (
          item.name ||
          (item as any).title ||
          (item as any).profileName ||
          item.id
        ).trim();
      };

      if (left.isMe) {
        return -1;
      }

      if (right.isMe) {
        return 1;
      }

      if (left.firstMatch && right.firstMatch) {
        const diffField =
          SEARCHED_FIELDS.indexOf(left.firstMatch.field) -
          SEARCHED_FIELDS.indexOf(right.firstMatch.field);

        if (diffField !== 0) {
          return diffField;
        }

        const diffPosition =
          left.firstMatch.position - right.firstMatch.position;
        if (diffPosition !== 0) {
          return diffPosition;
        }

        if (left.firstMatch.value < right.firstMatch.value) {
          return -1;
        } else if (left.firstMatch.value > right.firstMatch.value) {
          return 1;
        } else {
          return 0;
        }
      }

      const leftLower = getTitle(left).toLowerCase();
      const rightLower = getTitle(right).toLowerCase();

      return collator.compare(leftLower, rightLower);
    });

    return results;
  }
);

export const getSelectedConversation = createSelector(
  getConversations,
  (state: ConversationsStateType): string | undefined => {
    return state.selectedConversation;
  }
);

export const getMeetings = createSelector(
  getConversations,
  (state: ConversationsStateType): MeetingsStateType | undefined => {
    return state.meetings;
  }
);

export const getConversationMeetings = createSelector(
  [getConversations, getUserNumber],
  (
    state: ConversationsStateType,
    ourNumber: string
  ): ConversationMeetingStateType | undefined => {
    const { meetings } = state;
    if (!meetings) {
      return undefined;
    }

    const conversationMeetings: ConversationMeetingStateType = {};

    for (const meeting of Object.values(meetings)) {
      const { meetingType, channelName } = meeting;

      if (meetingType === 'group') {
        if (!channelName?.startsWith('G-')) {
          // not realy group meeting
          continue;
        }

        const b64Id = channelName.substring(2).replace(/-/g, '/');

        try {
          const groupId = window.atob(b64Id);
          conversationMeetings[groupId] = meeting;
        } catch (error) {
          // invalid base64 format
          continue;
        }
      } else if (meetingType === 'private') {
        const { privateUsers } = meeting;
        if (Array.isArray(privateUsers) && privateUsers.length === 2) {
          const index = privateUsers.indexOf(ourNumber.replace('+', ''));
          if (index === -1) {
            // private meeting without ourself
            continue;
          }

          // another meeting member
          const number = privateUsers[index === 0 ? 1 : 0];
          conversationMeetings['+' + number] = meeting;
        }

        continue;
      } else {
        continue;
      }
    }

    return conversationMeetings;
  }
);

export const getShowArchived = createSelector(
  getConversations,
  (state: ConversationsStateType): boolean => {
    return Boolean(state.showArchived);
  }
);

function getConversationTitle(
  conversation: ConversationType,
  options: { i18n: LocalizerType; ourRegionCode: string }
): string {
  if (conversation.name) {
    return conversation.name;
  }

  if (conversation.type === 'group') {
    const { i18n } = options;

    return i18n('unknownGroup');
  }

  return format(conversation.phoneNumber, options);
}

const collator = new Intl.Collator();

const _positiveComparator = (
  left?: number | boolean,
  right?: number | boolean
) => {
  return (Number(right) || 0) - (Number(left) || 0);
};

export const _getConversationComparator = (
  i18n: LocalizerType,
  ourRegionCode: string
) => {
  return (left: ConversationType, right: ConversationType): number => {
    let result = _positiveComparator(left.activeAt, right.activeAt);
    if (result) {
      return result;
    }

    result = _positiveComparator(left.timestamp, right.timestamp);
    if (result) {
      return result;
    }

    const options = { i18n, ourRegionCode };
    const leftTitle = getConversationTitle(left, options).toLowerCase();
    const rightTitle = getConversationTitle(right, options).toLowerCase();

    return collator.compare(leftTitle, rightTitle);
  };
};

const _getMeetingConverastionComparator = (
  defaultComparator: (
    left: ConversationType,
    right: ConversationType
  ) => number,
  conversationMeetings: ConversationMeetingStateType | undefined
) => {
  return (left: ConversationType, right: ConversationType): number => {
    if (conversationMeetings) {
      const leftMeeting = conversationMeetings[left.id];
      const rightMeeting = conversationMeetings[right.id];

      const result = _positiveComparator(
        leftMeeting.timestamp,
        rightMeeting.timestamp
      );
      if (result) {
        return result;
      }
    }

    return defaultComparator(left, right);
  };
};

export const getConversationComparator = createSelector(
  getIntl,
  getRegionCode,
  _getConversationComparator
);

const getMeetingConverastionComparator = createSelector(
  getConversationComparator,
  getConversationMeetings,
  _getMeetingConverastionComparator
);

export const _getLeftPaneLists = (
  lookup: ConversationLookupType,
  comparator: (left: ConversationType, right: ConversationType) => number,
  meetingComparator?: (
    left: ConversationType,
    right: ConversationType
  ) => number,
  selectedConversation?: string,
  meetings?: MeetingsStateType,
  conversationMeetings?: ConversationMeetingStateType
): {
  conversations: Array<ConversationType>;
  archivedConversations: Array<ConversationType>;
  meetings: MeetingsStateType | undefined;
} => {
  const activeConversations: ConversationType[] = [];
  const stickedConversations: ConversationType[] = [];
  const meetingConversations: ConversationType[] = [];
  const archivedConversations: ConversationType[] = [];

  for (const [key, value] of Object.entries(lookup)) {
    let conversation = value;

    if (key === selectedConversation) {
      conversation = {
        ...conversation,
        isSelected: true,
      };
    }

    if (conversationMeetings?.[key]) {
      meetingConversations.push(conversation);
    }

    const { activeAt, isStick, isArchived } = conversation;

    if (isStick) {
      stickedConversations.push(conversation);
    }

    if (isArchived) {
      archivedConversations.push(conversation);
    } else if (activeAt) {
      activeConversations.push(conversation);
    }
  }

  activeConversations.sort(comparator);
  stickedConversations.sort(comparator);
  meetingConversations.sort(meetingComparator || comparator);
  archivedConversations.sort(comparator);

  return {
    // _.uniq : only the first occurrence of each element is kept
    conversations: uniq([
      ...meetingConversations,
      ...stickedConversations,
      ...activeConversations,
    ]),
    archivedConversations,
    meetings,
  };
};

export const getLeftPaneLists = createSelector(
  getConversationLookup,
  getConversationComparator,
  getMeetingConverastionComparator,
  getSelectedConversation,
  getMeetings,
  getConversationMeetings,
  _getLeftPaneLists
);

export const getMe = createSelector(
  [getConversationLookup, getUserNumber],
  (lookup: ConversationLookupType, ourNumber: string): ConversationType => {
    return lookup[ourNumber];
  }
);
