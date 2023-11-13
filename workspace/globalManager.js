const electron = require('electron');
const config = require('../app/config');
const { ipcMain, desktopCapturer } = electron;

let globalUid;
let globalDid;
let globalUserEmail;
let globalTheme = 'system';
const miniProgramWindows = new Map();
let sideBrowser;
let webviewBrowser;
const timeoutTimer = {};
let mainWindow;
let globalConfig;
let WBCConfig;
let bcSession;
let hardwareInfo;
let mpList;
let locale;
let appInfo = {};
let appHostWhiteListMap = {};
let privateContacts = [];
let proxyMap = {};
let wsProxy;
let localServer;
let localServerPort;
let beyondCorpApps;

const updateGlobalUid = uid => {
  if (uid) globalUid = uid;
};
const getGlobalUid = () => globalUid;
ipcMain.handle('get_our_number', event => {
  return globalUid;
});

const updateGlobalDid = did => {
  if (did) globalDid = did;
};
const getGlobalDid = () => globalDid;

const updateGlobalUserEmail = email => {
  if (email) globalUserEmail = email;
};
const getGlobalUserEmail = () => globalUserEmail;

const updateGlobalTheme = theme => {
  if (theme) globalTheme = theme;
};
const getGlobalTheme = () => globalTheme;
ipcMain.handle('get_global_theme', event => {
  return globalTheme;
});

const updateIndependentMpWindow = (appId, window) => {
  if (appId) {
    miniProgramWindows.set(appId, window);
  }
};
const deleteIndependentMpWindow = appId => {
  if (appId && miniProgramWindows.has(appId)) {
    miniProgramWindows.delete(appId);
  }
};
const getIndependentMpWindow = appId => {
  if (!appId) {
    return miniProgramWindows;
  }
  if (!miniProgramWindows.has(appId)) {
    return undefined;
  }
  return miniProgramWindows.get(appId);
};

const independentMpToChangeArr = map => {
  const openAppsArr = [];
  for (let [key, value] of map) {
    const { appInfo } = value || {};
    const {
      appId,
      appName,
      h5url,
      picture,
      supportBot,
      browserType,
      hostname,
      type,
    } = appInfo || {};
    openAppsArr.push({
      appId,
      appName,
      h5url,
      picture,
      supportBot,
      browserType,
      hostname,
      type,
    });
  }
  return openAppsArr;
};

const getSideBrowser = () => sideBrowser;
const updateSideBrowser = data => {
  sideBrowser = data;
};

const getWebviewBrowser = () => webviewBrowser;
const updateWebviewBrowser = data => {
  webviewBrowser = data;
};

const addTimeoutTimer = (key, value) => {
  if (!key) {
    return;
  }
  timeoutTimer[key] = value;
};
const removeTimeoutTimer = key => {
  if (!key) {
    return;
  }
  clearTimeout(timeoutTimer[key]);
  delete timeoutTimer[key];
};
const getTimeoutTimer = () => timeoutTimer;

const updateMainWindow = data => (mainWindow = data);
const getMainWindow = () => mainWindow;

const updateGlobalConfig = data => (globalConfig = data);
const getGlobalConfig = () => globalConfig;
ipcMain.on('cache_globalConfig', (_, globalConfig) => {
  updateGlobalConfig(globalConfig);
});

const updateWBCConfig = data => (WBCConfig = data);
const getWBCConfig = () => WBCConfig;
ipcMain.on('cache_wbc_config', (_, WBCConfig) => {
  // 没有数据用本地写死的，最终兜底
  WBCConfig = WBCConfig || config?.WBCConfig || {};
  updateWBCConfig(WBCConfig);
});

const updateBcSession = data => (bcSession = data);
const getBcSession = () => bcSession;

const updateHardwareInfo = data => (hardwareInfo = data);
const getHardwareInfo = () => hardwareInfo;
ipcMain.handle('get_user_fingerprint', event => {
  const { fingerprint } = hardwareInfo || {};
  return fingerprint;
});

const updateMpList = data => (mpList = data);
const getMpList = () => mpList;
ipcMain.on('cache_mp_list', (_, mpList) => {
  updateMpList(mpList);
  beyondCorpApps = mpList?.filter(m => m?.beyondCorp);
});

const getBeyondCorpApps = () => beyondCorpApps;

const updateLocale = data => {
  locale = data;
};
const getLocale = () => locale;

const updateAppInfo = (key, value) => {
  appInfo[key] = value;
};
const getAppInfo = key => {
  if (!key) {
    return appInfo;
  }
  return appInfo[key];
};

const updateAppHostWhiteListMap = (reg, hostname) => {
  if (!hostname || !reg) {
    return;
  }
  appHostWhiteListMap[reg] = hostname;
};
const getAppHostWhiteListMap = () => appHostWhiteListMap;

ipcMain.on('cache_private_contact', (event, data) => {
  if (!data || !Array.isArray(data) || !data.length) {
    return;
  }
  privateContacts = data;
});
ipcMain.handle('get_private_contact', event => privateContacts);

ipcMain.handle('DESKTOP_CAPTURER_GET_SOURCES', (event, opts) =>
  desktopCapturer.getSources(opts)
);

const getPrivateContacts = () => privateContacts;

const updateProxyMap = data => {
  if (data) {
    proxyMap = data;
  }
};
const getProxyMap = () => proxyMap;

const updateWsProxy = data => {
  if (data) {
    wsProxy = data;
  }
};
const getWsProxy = () => wsProxy;

const updateLocalServer = data => {
  localServer = data;
};
const getLocalServer = () => localServer;

const updateLocalServerPort = data => {
  if (data) {
    localServerPort = data;
  }
};
const getLocalServerPort = () => localServerPort;

module.exports = {
  updateGlobalUid,
  getGlobalUid,
  updateGlobalDid,
  getGlobalDid,
  updateIndependentMpWindow,
  deleteIndependentMpWindow,
  getIndependentMpWindow,
  independentMpToChangeArr,
  updateGlobalTheme,
  getGlobalTheme,
  getSideBrowser,
  updateSideBrowser,
  getWebviewBrowser,
  updateWebviewBrowser,
  addTimeoutTimer,
  removeTimeoutTimer,
  getTimeoutTimer,
  updateMainWindow,
  getMainWindow,
  updateGlobalConfig,
  getGlobalConfig,
  getWBCConfig,
  updateBcSession,
  getBcSession,
  updateHardwareInfo,
  getHardwareInfo,
  updateMpList,
  getMpList,
  updateLocale,
  getLocale,
  updateAppInfo,
  getAppInfo,
  updateAppHostWhiteListMap,
  getAppHostWhiteListMap,
  updateGlobalUserEmail,
  getGlobalUserEmail,
  getPrivateContacts,
  updateProxyMap,
  getProxyMap,
  updateLocalServerPort,
  getLocalServerPort,
  updateLocalServer,
  getLocalServer,
  getBeyondCorpApps,
  updateWsProxy,
  getWsProxy,
};
