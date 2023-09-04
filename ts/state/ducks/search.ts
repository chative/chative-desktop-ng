import { omit, reject } from 'lodash';

import { normalize } from '../../types/PhoneNumber';
import { trigger } from '../../shims/events';
// import { getMessageModel } from '../../shims/Whisper';
// import { cleanSearchTerm } from '../../util/cleanSearchTerm';
import {
  searchConversations /*, searchMessages */,
} from '../../../js/modules/data';
import { makeLookup } from '../../util/makeLookup';

import {
  DBConversationType,
  MessageExpiredActionType,
  MessageType,
  RemoveAllConversationsActionType,
  SelectedConversationChangedActionType,
} from './conversations';

// State

export type SearchStateType = {
  query: string;
  normalizedPhoneNumber?: string;
  // We need to store messages here, because they aren't anywhere else in state
  messages: Array<MessageType>;
  selectedMessage?: string;
  messageLookup: {
    [key: string]: MessageType;
  };
  // For conversations we store just the id, and pull conversation props in the selector
  conversations: Array<string>;
  contacts: Array<string>;
  ourNumber: string;
  noteToSelf: string;
};

// Actions

type SearchResultsPayloadType = {
  query: string;
  normalizedPhoneNumber?: string;
  messages: Array<MessageType>;
  conversations: Array<string>;
  contacts: Array<string>;
  ourNumber: string;
  noteToSelf: string;
};

type SearchResultsKickoffActionType = {
  type: 'SEARCH_RESULTS';
  payload: Promise<SearchResultsPayloadType>;
};
type SearchResultsFulfilledActionType = {
  type: 'SEARCH_RESULTS_FULFILLED';
  payload: SearchResultsPayloadType;
};
type UpdateSearchTermActionType = {
  type: 'SEARCH_UPDATE';
  payload: {
    query: string;
  };
};
type ClearSearchActionType = {
  type: 'SEARCH_CLEAR';
  payload: null;
};

export type SEARCH_TYPES =
  | SearchResultsFulfilledActionType
  | UpdateSearchTermActionType
  | ClearSearchActionType
  | MessageExpiredActionType
  | RemoveAllConversationsActionType
  | SelectedConversationChangedActionType;

// Action Creators

export const actions = {
  search,
  clearSearch,
  updateSearchTerm,
  startNewConversation,
};

function search(
  query: string,
  options: { regionCode: string; ourNumber: string; noteToSelf: string }
): SearchResultsKickoffActionType {
  return {
    type: 'SEARCH_RESULTS',
    payload: doSearch(query, options),
  };
}

async function doSearch(
  query: string,
  options: {
    regionCode: string;
    ourNumber: string;
    noteToSelf: string;
  }
): Promise<SearchResultsPayloadType> {
  const { regionCode, ourNumber, noteToSelf } = options;

  const [discussions /*, messages */] = await Promise.all([
    queryConversationsAndContacts(query, { ourNumber, noteToSelf }),
    // queryMessages(query),
  ]);
  const { conversations, contacts } = discussions;

  return {
    query,
    normalizedPhoneNumber: normalize(query, { regionCode }),
    conversations,
    contacts,
    messages: [], // getMessageProps(messages) || [],
    ourNumber,
    noteToSelf,
  };
}
function clearSearch(): ClearSearchActionType {
  return {
    type: 'SEARCH_CLEAR',
    payload: null,
  };
}
function updateSearchTerm(query: string): UpdateSearchTermActionType {
  return {
    type: 'SEARCH_UPDATE',
    payload: {
      query,
    },
  };
}
function startNewConversation(
  query: string,
  options: { regionCode: string }
): ClearSearchActionType {
  const { regionCode } = options;
  const normalized = normalize(query, { regionCode });
  if (!normalized) {
    throw new Error('Attempted to start new conversation with invalid number');
  }
  trigger('showConversation', normalized);

  return {
    type: 'SEARCH_CLEAR',
    payload: null,
  };
}

// Helper functions for search

// const getMessageProps = (messages: Array<MessageType>) => {
//   if (!messages || !messages.length) {
//     return [];
//   }

//   return messages.map(message => {
//     const model = getMessageModel(message);

//     return model.propsForSearchResult;
//   });
// };

// async function queryMessages(query: string) {
//   try {
//     const normalized = cleanSearchTerm(query);

//     return searchMessages(normalized);
//   } catch (e) {
//     return [];
//   }
// }

async function queryConversationsAndContacts(
  providedQuery: string,
  options: { ourNumber: string; noteToSelf: string }
) {
  let query = providedQuery;
  // 这里做一个特殊处理，以应对输入id全称类似'+10001'，查不到用户的情况
  if (query && query.length >= 2 && query.startsWith('+')) {
    query = query.substring(1);
  }

  const { ourNumber, noteToSelf } = options;
  // https://github.com/signalapp/Signal-Desktop/commit/5fad43fcfbd2ce470fec6de3a61ff3aa01cc2640
  // const query = providedQuery.replace(/[+.()]*/g, '');
  query = query.replace(/_/g, '\\_');
  query = query.replace(/%/g, '\\%');
  const searchResults: Array<DBConversationType> = await searchConversations(
    query
  );

  const isAliveGroup = (c: DBConversationType) =>
    c.type === 'group' && !c.left && !c.disbanded;

  // Split into two groups
  // active conversations and items from address book
  let conversations: Array<string> = [];
  let contacts: Array<string> = [];
  const max = searchResults.length;
  for (let i = 0; i < max; i += 1) {
    const conversation = searchResults[i];

    // active conversations
    if (conversation.lastMessage && conversation.active_at) {
      conversations.push(conversation.id);
      // continue
      //remove the ```continue```, recent conversation id also will add to the contacts
    }

    // contacts
    // private contacts: directoryUser === true
    // group contacts: type === 'group' && (left === false || disbanded = false)
    if (isAliveGroup(conversation) || conversation.directoryUser) {
      contacts.push(conversation.id);
    }
  }

  // Inject synthetic Note to Self entry if query matches localized 'Note to Self'
  if (noteToSelf.toLowerCase().indexOf(providedQuery.toLowerCase()) !== -1) {
    // ensure that we don't have duplicates in our results
    contacts = contacts.filter(id => id !== ourNumber);
    conversations = conversations.filter(id => id !== ourNumber);

    contacts.unshift(ourNumber);
  }

  return { conversations, contacts };
}

// Reducer

function getEmptyState(): SearchStateType {
  return {
    query: '',
    messages: [],
    messageLookup: {},
    conversations: [],
    contacts: [],
    ourNumber: '',
    noteToSelf: '',
  };
}

export function reducer(
  state: SearchStateType | undefined,
  action: SEARCH_TYPES
): SearchStateType {
  if (!state) {
    return getEmptyState();
  }

  if (action.type === 'SEARCH_CLEAR') {
    // chat-folder 显示状态置为true
    window.dispatchEvent(
      new CustomEvent('folder-bar-visible', { detail: true })
    );
    return getEmptyState();
  }

  if (action.type === 'SEARCH_UPDATE') {
    // chat-folder 显示状态置为 false
    window.dispatchEvent(
      new CustomEvent('folder-bar-visible', { detail: false })
    );

    const { payload } = action;
    const { query } = payload;

    return {
      ...state,
      query,
    };
  }

  if (action.type === 'SEARCH_RESULTS_FULFILLED') {
    const { payload } = action;
    const { query, messages } = payload;

    // Reject if the associated query is not the most recent user-provided query
    if (state.query !== query) {
      return state;
    }

    return {
      ...state,
      ...payload,
      messageLookup: makeLookup(messages, 'id'),
    };
  }

  if (action.type === 'CONVERSATIONS_REMOVE_ALL') {
    return getEmptyState();
  }

  if (action.type === 'SELECTED_CONVERSATION_CHANGED') {
    const { payload } = action;
    const { messageId } = payload;

    if (!messageId) {
      return state;
    }

    return {
      ...state,
      selectedMessage: messageId,
    };
  }

  if (action.type === 'MESSAGE_EXPIRED') {
    const { messages, messageLookup } = state;
    if (!messages.length) {
      return state;
    }

    const { payload } = action;
    const { id } = payload;

    return {
      ...state,
      messages: reject(messages, message => id === message.id),
      messageLookup: omit(messageLookup, ['id']),
    };
  }

  return state;
}
