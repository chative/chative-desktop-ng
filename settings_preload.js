/* global window */

const { ipcRenderer } = require('electron');
const url = require('url');
const i18n = require('./js/modules/i18n');

const remote = require('@electron/remote');
const { app } = remote;

const config = url.parse(window.location.toString(), true).query;
const { locale } = config;
const localeMessages = ipcRenderer.sendSync('locale-data');

const Attachments = require('./app/attachments');

window.theme = config.theme;

window.i18n = i18n.setup(locale, localeMessages);

window.getEnvironment = () => config.environment;
window.getVersion = () => config.version;
window.getAppInstance = () => config.appInstance;
window.systemTheme = config.systemTheme;

window.PROTO_ROOT = 'protos';
window.React = require('react');
window.ReactDOM = require('react-dom');
window.moment = require('moment');

// So far we're only using this for Signal.Types
const Signal = require('./js/modules/signal');

require('./js/logging');

window.Signal = Signal.setup({
  Attachments,
  userDataPath: app.getPath('userData'),
  getRegionCode: () => window.storage.get('regionCode'),
  logger: window.log,
});

window.closeSettings = () => ipcRenderer.send('close-settings');

window.getDeviceName = makeGetter('device-name');

window.getThemeSetting = makeGetter('theme-setting');
window.setThemeSetting = makeSetter('theme-setting');
window.getNativeSystemTheme = makeGetter('system-theme');
window.getHideMenuBar = makeGetter('hide-menu-bar');
window.setHideMenuBar = makeSetter('hide-menu-bar');

window.getSpellCheck = makeGetter('spell-check');
window.setSpellCheck = makeSetter('spell-check');

window.getQuitTopicSetting = makeGetter('quit-topic-setting');
window.setQuitTopicSetting = makeSetter('quit-topic-setting');

window.getNotificationSetting = makeGetter('notification-setting');
window.setNotificationSetting = makeSetter('notification-setting');
window.getAudioNotification = makeGetter('audio-notification');
window.setAudioNotification = makeSetter('audio-notification');

window.getMediaPermissions = makeGetter('media-permissions');
window.setMediaPermissions = makeSetter('media-permissions');

window.getDisableHardwareAcceleration = makeGetter(
  'disable-hardware-acceleration'
);
window.setDisableHardwareAcceleration = v => {
  makeSetter('disable-hardware-acceleration')(v);
  alert('Relaunch Chative to take effect.');
};

window.isPrimary = makeGetter('is-primary');
window.makeSyncRequest = makeGetter('sync-request');
window.getLastSyncTime = makeGetter('sync-time');
window.setLastSyncTime = makeSetter('sync-time');

window.deleteAllData = () => ipcRenderer.send('delete-all-data');

function makeGetter(name) {
  return () =>
    new Promise((resolve, reject) => {
      ipcRenderer.once(`get-success-${name}`, (event, error, value) => {
        if (error) {
          return reject(error);
        }

        return resolve(value);
      });
      ipcRenderer.send(`get-${name}`);
    });
}

function makeSetter(name) {
  return value =>
    new Promise((resolve, reject) => {
      ipcRenderer.once(`set-success-${name}`, (event, error) => {
        if (error) {
          return reject(error);
        }

        return resolve();
      });
      ipcRenderer.send(`set-${name}`, value);
    });
}

window.changeInternalName = (newName, resolve, reject) => {
  ipcRenderer.once('edit-result', (e, res) => {
    if (res.result) {
      resolve();
    } else {
      reject();
    }
  });

  const currWin = remote.getCurrentWindow();
  const parent = currWin.getParentWindow();
  parent.webContents.send('change-internal-name', currWin.id, newName);
};

// window.ourProfileChanged = ourConversationUpdate => {
//   ipcRenderer.on('our-profile-change', e => {
//     ourConversationUpdate();
//   });
// };

// 更改主题
window.changeTheme = fn => {
  ipcRenderer.on('set-theme-setting', (_, info) => {
    fn(info);
  });
};
