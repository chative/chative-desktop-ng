import React from 'react';
import { Provider } from 'react-redux';
import { Store } from 'redux';
import { SmartContactNewPane } from '../smart/ContactPane';

// Workaround: A react component's required properties are filtering up through connect()
//   https://github.com/DefinitelyTyped/DefinitelyTyped/issues/31363
const AnyContactNewPane = SmartContactNewPane as any;

export const createContactPane = (store: Store) => (
  <Provider store={store}>
    <AnyContactNewPane />
  </Provider>
);
