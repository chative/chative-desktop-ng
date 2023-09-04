import { combineReducers } from 'redux';

import { reducer as search, SearchStateType } from './ducks/search';
import {
  ConversationsStateType,
  reducer as conversations,
} from './ducks/conversations';
import { reducer as user, UserStateType } from './ducks/user';
import {
  ContactSearchType,
  reducer as contactSearch,
} from './ducks/contactSearch';
import { DockType, reducer as dock } from './ducks/dock';

export type StateType = {
  search: SearchStateType;
  conversations: ConversationsStateType;
  user: UserStateType;
  contactSearch: ContactSearchType;
  dock: DockType;
};

export const reducers = {
  search,
  conversations,
  user,
  contactSearch,
  dock,
};

// Making this work would require that our reducer signature supported AnyAction, not
//   our restricted actions
// @ts-ignore
export const reducer = combineReducers(reducers);
