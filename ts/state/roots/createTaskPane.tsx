import React from 'react';
import { Provider } from 'react-redux';
import { Store } from 'redux';
import { SmartTaskPane } from '../smart/TaskPane';

// Workaround: A react component's required properties are filtering up through connect()
//   https://github.com/DefinitelyTyped/DefinitelyTyped/issues/31363

export const createTaskPane = (store: Store) => (
  <Provider store={store}>
    <SmartTaskPane />
  </Provider>
);
