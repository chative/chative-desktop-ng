/* global window */

const { ipcRenderer } = require('electron');
const url = require('url');
const i18n = require('./js/modules/i18n');

const config = url.parse(window.location.toString(), true).query;
const { locale } = config;
const localeMessages = ipcRenderer.sendSync('locale-data');

window.React = require('react');
window.ReactDOM = require('react-dom');
window.theme = config.theme;
window.getEnvironment = () => config.environment;
window.getVersion = () => config.version;
window.getAppInstance = () => config.appInstance;
window.getAppName = () => config.name;
window.systemTheme = config.systemTheme;
window.getPlatform = () => config.platform;
window.getArch = () => config.arch;

window.getBuildAt = () => config.buildAt;
window.getBuildNumber = () => config.CIBuildNumber;
window.getCommitSha = () => config.lastCommitSha;
window.getCommitTime = () => config.lastCommitTime;
window.moment = require('moment');

window.getDeveloperMagicView = () => {
  const { DeveloperMagicView } = require('./ts/components/DeveloperMagicView');
  return DeveloperMagicView;
};

window.closeAbout = () => ipcRenderer.send('close-about');
window.exportLocalCert = () => ipcRenderer.send('export-local-cert');
window.clearLocalCert = () => ipcRenderer.send('clear-local-cert');
window.setLocalCertExpire = timestamp =>
  ipcRenderer.send('set-local-cert-expire', timestamp);
window.setBeyondCorpHost = host => {
  ipcRenderer.send('bind-beyondCorp-host', host);
};
window.removeBeyondCorpHost = () => {
  ipcRenderer.send('unbind-beyondCorp-host');
};
window.mainWindowOpenDevTools = () =>
  ipcRenderer.send('main-window-openDevTools');
window.setAntivirous = b => {
  ipcRenderer.send('set-antivirous', b);
};
window.setSelfService = b => {
  ipcRenderer.send('set-selfService', b);
};
window.setWorkspaceOne = b => {
  ipcRenderer.send('set-workspaceOne', b);
};

// 更改主题
window.changeTheme = fn => {
  ipcRenderer.on('set-theme-setting', (_, info) => {
    fn(info);
  });
};
window.i18n = i18n.setup(locale, localeMessages);

require('./js/logging');

// 获取系统主题
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
