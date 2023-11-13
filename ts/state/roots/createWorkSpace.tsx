import React from 'react';
import { Provider } from 'react-redux';
import { Store } from 'redux';
import { SmartWorkSpace } from '../smart/WorkSpace';

// Workaround: A react component's required properties are filtering up through connect()
//   https://github.com/DefinitelyTyped/DefinitelyTyped/issues/31363

export const createWorkSpace = (store: Store) => (
  <Provider store={store}>
    <SmartWorkSpace />
  </Provider>
);
