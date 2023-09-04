const electron = require('electron');
const { ipcMain, nativeImage, shell, dialog } = electron;
const url = require('url');
const path = require('path');
const packageJson = require('../package.json');
const os = require('os');
const crypto = require('crypto');

const {
  getMainWindow,
  getGlobalConfig,
  getMpList,
  updateAppHostWhiteListMap,
  getWBCConfig,
} = require('./globalManager');

const sha256 = str => {
  return crypto.createHash('sha256').update(str).digest('hex');
};

const betterEncodeURIComponent = param => {
  if (typeof param === 'number') {
    return '' + param;
  }
  if (!param || typeof param !== 'string') {
    throw Error('main.js betterEncodeURIComponent bad param!');
  }
  const queryParams = { a: param };
  let queryString = new URLSearchParams(queryParams).toString();
  queryString = queryString.substring(2);
  queryString = queryString.replace(/\+/g, '%20');
  return queryString;
};

const formatUrl = (pathSegments, moreKeys) => {
  return url.format({
    pathname: path.join.apply(null, pathSegments),
    protocol: 'file:',
    slashes: true,
    query: moreKeys || {},
  });
};

const browserIsAlive = browser => {
  return browser && browser.webContents && !browser.webContents.isDestroyed();
};

const windowIsAlive = window => {
  return (
    window &&
    !window.isDestroyed() &&
    window.webContents &&
    !window.webContents.isDestroyed()
  );
};

const getUrlParams = urlStr => {
  if (!urlStr) {
    return null;
  }
  if (!urlStr.split('?') || urlStr.split('?').length < 2) {
    return null;
  }
  const params = {};
  const strArr = urlStr.split('?')[1].split('&') || undefined;
  for (let i = 0; i < strArr.length; i++) {
    if (!strArr[i]?.split('=') || strArr[i]?.split('=').length < 2) {
      continue;
    }
    params[strArr[i].split('=')[0]] = decodeURI(strArr[i].split('=')[1]);
  }
  if (!Object.getOwnPropertyNames(params).length) {
    return null;
  }
  return params;
};

const NORMAL_DOCUMENT_SUFFIX = ['pdf', 'txt', 'xlsx', 'docx'];
const isNormalDocument = reqUrl => {
  if (!reqUrl) {
    return false;
  }
  try {
    const data = reqUrl?.split('?')[0]?.split('.') || [];
    if (!data.length) {
      return false;
    }
    const suffix = data[data.length - 1].toLowerCase();
    return NORMAL_DOCUMENT_SUFFIX.includes(suffix);
  } catch (e) {
    return false;
  }
};
const handleNewWindow = async params => {
  const { url: httpUrl, window } = params || {};
  if (httpUrl.startsWith('http://') || httpUrl.startsWith('https://')) {
    try {
      const existApp = checkExistApp(httpUrl);
      const mainWindow = getMainWindow();
      if (existApp && existApp.type === 0 && windowIsAlive(mainWindow)) {
        mainWindow.webContents.send('jump_other_app', {
          app: existApp,
          type: existApp.type,
          jumpUrl: httpUrl,
        });
      } else {
        let showHttpUrl = httpUrl;
        if (showHttpUrl.length > 125) {
          showHttpUrl = showHttpUrl.substring(0, 125) + '...';
        }
        const dialogIcon = nativeImage.createFromPath(
          path.join(__dirname, 'images', 'jump-warning.png')
        );
        const options = {
          type: 'warning',
          buttons: ['Yes', 'Cancel'],
          message: 'Open by default browser',
          // icon: dialogIcon,
          detail: `${showHttpUrl}`,
        };
        if (isNormalDocument(httpUrl)) {
          await shell.openExternal(httpUrl);
        } else {
          const result = await dialog.showMessageBox(window, options);
          if (!result) {
            return;
          }
          const { response } = result || {};
          // Cancel
          if (response === 1) {
            return;
          }
          await shell.openExternal(httpUrl);
        }
      }
    } catch (e) {
      console.log(e);
    }
  }
};
const showNativeDialog = async params => {
  const { type, buttons, message, icon, detail, window, defaultId } =
    params || {};
  if (!window || !message) {
    return false;
  }
  const options = {
    type: type || 'warning',
    buttons: buttons || ['Yes', 'Cancel'],
    message,
    icon,
    detail,
    defaultId,
  };

  const result = await dialog.showMessageBox(window, options);
  return result;
};

const checkExistApp = path => {
  if (path?.endsWith('/')) {
    path = path.slice(0, path.length - 1);
  }

  const mpList = getMpList();
  if (!mpList || !Array.isArray(mpList) || !mpList.length) {
    return false;
  }
  try {
    const { gsuiteUrlMap } = getWBCConfig() || {};
    const gsuiteArr = []; //  [{ key: value},...]
    for (let key in gsuiteUrlMap) {
      gsuiteArr.push({
        key,
        value: gsuiteUrlMap[key],
      });
    }

    for (let i = 0; i < mpList.length; i++) {
      let { h5url } = mpList[i] || {};
      if (!h5url) {
        continue;
      }

      if (h5url?.endsWith('/')) {
        h5url = h5url.slice(0, h5url.length - 1);
      }

      // gsuite 相关的应用需要特殊处理，因为域名太多变了
      let g1name;
      let g2name;
      for (let j = 0; j < gsuiteArr.length; j++) {
        const { key, value } = gsuiteArr[j] || {};
        if (path.startsWith(key)) {
          g1name = value;
        }
        if (h5url.startsWith(key)) {
          g2name = value;
        }
      }
      if (g1name && g2name && g1name === g2name) {
        return mpList[i];
      }

      if (path.startsWith(h5url)) {
        return mpList[i];
      }
    }
    return false;
  } catch (e) {
    return false;
  }
};
const hostFilter = path => {
  try {
    const hostname = new URL(path).hostname;

    const { gsuiteUrlMap } = getWBCConfig() || {};
    const gsuiteArr = []; //  [{ key: value},...]
    for (let key in gsuiteUrlMap) {
      gsuiteArr.push({
        key,
        value: gsuiteUrlMap[key],
      });
    }

    let ghostname;
    for (let i = 0; i < gsuiteArr.length; i++) {
      const { key, value } = gsuiteArr[i] || {};
      if (path.startsWith(key)) {
        ghostname = value;
      }
    }

    return ghostname || hostname;
  } catch (e) {
    console.error('hostFilter catch error', e);
    return undefined;
  }
};

ipcMain.handle('check_wea_app', (event, path) => {
  if (!path) {
    return false;
  }
  return checkExistApp(path);
});

const getCustomUserAgent = beyondCorp => {
  let osTypeString = 'macOS';
  if (process.platform === 'linux') {
    osTypeString = 'Linux';
  }
  if (process.platform === 'win32') {
    osTypeString = 'Windows';
  }

  const fixedUserAgent =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36' +
    ` ${packageJson.productName}/${packageJson.version}` +
    ` (${osTypeString};${os.release()};node-fetch/1.0)`;

  if (beyondCorp) {
    return `${packageJson.productName}/${
      packageJson.version
    } (${osTypeString};${os.release()};node-fetch/1.0)`;
  }
  return fixedUserAgent;
};

const handleUrlWhiteListMap = (urlWhiteList, hostname) => {
  try {
    // 通过 urlWhiteList 映射 hostname
    if (urlWhiteList && Array.isArray(urlWhiteList) && urlWhiteList.length) {
      for (let i = 0; i < urlWhiteList.length; i++) {
        updateAppHostWhiteListMap(urlWhiteList[i], hostname);
      }
    }
  } catch (e) {
    console.error('[beyondCorp]' + 'handleUrlWhitelistMap catch error', e);
  }
};

const customUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

module.exports = {
  formatUrl,
  browserIsAlive,
  windowIsAlive,
  getUrlParams,
  handleNewWindow,
  betterEncodeURIComponent,
  getCustomUserAgent,
  handleUrlWhiteListMap,
  showNativeDialog,
  checkExistApp,
  hostFilter,
  customUUID,
  sha256,
};
