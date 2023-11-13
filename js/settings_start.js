/* global $, Whisper */

$(document).on('keyup', e => {
  'use strict';

  if (e.keyCode === 27) {
    window.closeSettings();
  }
});

const $body = $(document.body);
if (window.theme === 'system') {
  $body.addClass(`${window.systemTheme}-theme`);
} else {
  $body.addClass(`${window.theme}-theme`);
}

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

// eslint-disable-next-line strict
const getInitialData = async () => ({
  deviceName: await window.getDeviceName(),

  themeSetting: await window.getThemeSetting(),
  hideMenuBar: await window.getHideMenuBar(),

  notificationSetting: await window.getNotificationSetting(),
  audioNotification: await window.getAudioNotification(),

  spellCheck: await window.getSpellCheck(),

  quitTopicSetting: await window.getQuitTopicSetting(),
  mediaPermissions: await window.getMediaPermissions(),
  disableHardwareAcceleration: await window.getDisableHardwareAcceleration(),

  isPrimary: await window.isPrimary(),
  lastSyncTime: await window.getLastSyncTime(),
});

window.initialRequest = getInitialData();

window.log.info('Storage fetch');
storage.fetch();

// eslint-disable-next-line more/no-then
window.initialRequest.then(
  data => {
    'use strict';

    window.initialData = data;
    window.view = new Whisper.SettingsView();
    window.view.$el.appendTo($body);
  },
  error => {
    'use strict';

    window.log.error(
      'settings.initialRequest error:',
      error && error.stack ? error.stack : error
    );
    window.closeSettings();
  }
);
