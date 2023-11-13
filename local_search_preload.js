/* global
  window,
  watermark,
  $,
*/

const { ipcRenderer } = require('electron');
const url = require('url');
const i18n = require('./js/modules/i18n');

const electron = require('electron');

const remote = require('@electron/remote');
const { app } = remote;

const Attachments = require('./app/attachments');

const config = url.parse(window.location.toString(), true).query;
const { locale } = config;
const localeMessages = ipcRenderer.sendSync('locale-data');
window.filesize = require('filesize');
window._lodash = require('lodash');
const bs58 = require('bs58');

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

window.base58_encode = str => {
  let bytes = Buffer.from(str);
  let address = bs58.encode(bytes);
  return address;
};
require('./js/logging');
const Signal = require('./js/modules/signal');

window.moment.updateLocale(locale.toLowerCase(), {
  relativeTime: {
    s: window.i18n('timestamp_s'),
    m: window.i18n('timestamp_m'),
    h: window.i18n('timestamp_h'),
  },
});
window.moment.locale(locale.toLowerCase());

window.Signal = Signal.setup({
  Attachments,
  userDataPath: app.getPath('userData'),
  getRegionCode: () => window.storage.get('regionCode'),
  logger: window.log,
});

ipcRenderer.on('receive-keywords', (_, keywords, conversationId) => {
  window.keywords = keywords;
  window.conversationId = conversationId;
});

window.jumpMessage = info => {
  ipcRenderer.send('jump-message', info);
};

window.changeTheme = fn => {
  ipcRenderer.on('set-theme-setting', (_, info) => {
    fn(info);
  });
};

window.setupWaterMark = userNumber => {
  if (userNumber) {
    let user = userNumber.replace('+', '');
    if (user.indexOf('.') !== -1) {
      user = user.substr(0, user.indexOf('.'));
    }

    $('.simple_blind_watermark').remove();
    watermark({ watermark_txt: user });
    window.addEventListener('resize', () => {
      $('.simple_blind_watermark').remove();
      watermark({ watermark_txt: user });
    });
  }
};

window.getNativeSystemTheme = makeGetter('system-theme');
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

window.getGlobalConfig = makeGetter('global-config');
