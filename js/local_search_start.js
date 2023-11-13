/* global $, Whisper */

const $body = $(document.body);
$body.addClass(`${window.theme}-theme`);

// eslint-disable-next-line strict
const getInitialData = async () => {
  await window.storage.fetch();
};

window.initialRequest = getInitialData();

// eslint-disable-next-line more/no-then
window.initialRequest.then(
  () => {
    'use strict';

    Whisper.LocalSearchView = new Whisper.ReactWrapperView({
      Component: window.Signal.Components.LocalSearch,
      props: {
        i18n: window.i18n,
      },
    });

    const $body = $(document.body);
    window.setImmediate = window.nodeSetImmediate;
    Whisper.LocalSearchView.$el.appendTo($body);
  },
  error => {
    'use strict';

    window.log.error(
      'settings.initialRequest error:',
      error && error.stack ? error.stack : error
    );
    // window.closeGroupEditor();
  }
);

// eslint-disable-next-line strict
const setTheme = async theme => {
  if (theme === 'system') {
    const temp = await window.getNativeSystemTheme();
    $(document.body)
      .removeClass('dark-theme')
      .removeClass('light-theme')
      .addClass(`${temp}-theme`);
    return;
  }
  $(document.body)
    .removeClass('dark-theme')
    .removeClass('light-theme')
    .addClass(`${theme}-theme`);
};
window.changeTheme(setTheme);
if (window.theme === 'dark') {
  setTheme('dark');
}
if (window.theme === 'system') {
  setTheme(window.systemTheme);
}
