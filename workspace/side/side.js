const electron = require('electron');
const { BrowserView, ipcMain } = electron;

const {
  windowIsAlive,
  browserIsAlive,
  handleNewWindow,
  formatUrl,
  handleUrlWhiteListMap,
  getUrlParams,
} = require('../utils');
const {
  getSideBrowser,
  getMainWindow,
  getBcSession,
  updateGlobalDid,
  updateGlobalUid,
  updateSideBrowser,
  getHardwareInfo,
  updateAppInfo,
  updateGlobalUserEmail,
  getGlobalTheme,
  getAppInfo,
} = require('../globalManager');
const path = require('path');

const sidePageWidth = 360;
const timeout = 1000 * 30; // 加载超时时间
const navigateHeight = 48; // 导航栏高度

const handleMpSideView = async params => {
  const {
    h5url,
    appId,
    appName,
    supportBot,
    did,
    uid,
    beyondCorp,
    urlWhiteList,
    browserType,
    email,
  } = params || {};
  const mainWindow = getMainWindow();
  if (!appId || !h5url || !windowIsAlive(mainWindow)) {
    console.error(
      '[workspace]',
      'handle side browser view params invalid',
      params
    );
    return;
  }

  let {
    browserView: preBrowserView,
    header,
    appId: preAppId,
  } = getSideBrowser() || {};

  // 该应用处于打开状态
  if (appId === preAppId) {
    return;
  }

  // cache global data
  updateGlobalDid(did);
  updateGlobalUid(uid);
  updateGlobalUserEmail(email);

  // 当前已经有打开着的 side view
  if (preBrowserView) {
    mainWindow.removeBrowserView(preBrowserView);
  }

  if (browserIsAlive(header)) {
    header.webContents.send('on_title_change', appName);
  } else {
    header = new BrowserView({
      webPreferences: {
        preload: path.join(__dirname, 'side_preload.js'),
      },
    });
    mainWindow.addBrowserView(header);
    // header.webContents.openDevTools();
    header.setBounds({
      x: mainWindow.getBounds().width - sidePageWidth,
      y: 0,
      width: sidePageWidth,
      height: mainWindow.getBounds().height,
    });
    header.setAutoResize({
      height: true,
      width: true,
    });

    header.webContents.on('did-finish-load', event => {
      header.webContents.send('on_title_change', appName);
      header.webContents.send('on_theme_change', getGlobalTheme());
    });

    header?.webContents?.loadURL(
      formatUrl([__dirname, 'html/side_navigate.html'], { browserType })
    );
  }

  let hostname;
  try {
    hostname = new URL(h5url).hostname;
  } catch (e) {
    console.error('[workspace]', 'url parser error', e);
  }

  // create browser view
  const browserView = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, 'side_view_preload.js'),
      session: beyondCorp ? getBcSession() : undefined,
    },
  });
  // browserView.webContents.openDevTools();
  mainWindow.addBrowserView(browserView);
  browserView.setBounds({
    x: mainWindow.getBounds().width - sidePageWidth + 1,
    y: navigateHeight,
    width: sidePageWidth - 1,
    height: mainWindow.getBounds().height,
  });
  browserView.setAutoResize({
    width: true,
    height: true,
  });

  browserView.webContents.on('dom-ready', _ => {
    browserView.webContents.send('final_check', browserType);
  });
  browserView.webContents.on(
    'did-fail-load',
    (_, errorCode, errorDescription) => {
      console.error(
        '[workspace]' + 'side browserView did-fail-load',
        errorCode,
        errorDescription
      );
      if (errorCode === -3) {
        return;
      }
      browserView?.webContents?.loadURL(
        formatUrl([__dirname, '../html/mp_error.html'], {
          errorCode,
          errorType: 'network',
          supportBot,
          appId,
          browserType,
        })
      );
    }
  );
  browserView.webContents.on('did-navigate', (_, httpUrl, errorCode) => {
    if (errorCode < 400) {
      return;
    }
    browserView?.webContents?.loadURL(
      formatUrl([__dirname, '../html/mp_error.html'], {
        errorCode,
        errorType: 'http',
        supportBot,
        appId,
        browserType,
      })
    );
  });
  browserView.webContents.setWindowOpenHandler(details => {
    console.log('side browserView setWindowOpenHandler', details);
    const { url } = details || {};
    handleNewWindow({ url, window: mainWindow });
    // 阻止默认行为，采用自定义逻辑判断去决定如何打开
    return { action: 'deny' };
  });
  browserView.webContents.on('did-create-window', (browserWindow, details) => {
    console.log('side browserView did-create-window', details);
    const { url } = details || {};
    handleNewWindow({ url, window: mainWindow });
  });
  browserView.webContents.on(
    'certificate-error',
    (event, url, error, cert, callback) => {
      callback(true);
    }
  );
  browserView.webContents.session.setCertificateVerifyProc(
    (request, callback) => {
      // if (beyondCorp) {
      callback(0);
      // } else {
      //   callback(-2)
      // }
    }
  );

  const extParams = { ...params, hostname };

  updateSideBrowser({
    ...extParams,
    browserView,
    header,
  });

  // 缓存一份应用的信息保存到全局
  updateAppInfo(hostname, extParams);
  updateAppInfo(appId, extParams);
  // 将应用的 urlWhiteList 和 hostname 做一下映射
  handleUrlWhiteListMap(urlWhiteList, hostname);

  loadSideBrowserView(extParams);
};

function loadSideBrowserView(extParams) {
  const { h5url, appId, supportBot, beyondCorp, browserType } = extParams || {};

  const { browserView, header } = getSideBrowser() || {};
  const mainWindow = getMainWindow();
  if (
    !windowIsAlive(mainWindow) ||
    !browserIsAlive(browserView) ||
    !browserIsAlive(header)
  ) {
    return;
  }

  browserView?.webContents?.loadURL(h5url);
}

const showSideView = () => {
  const { browserView } = getSideBrowser() || {};
  const mainWindow = getMainWindow() || {};
  if (!windowIsAlive(mainWindow) || !browserIsAlive(browserView)) {
    return;
  }
  browserView.setBackgroundColor('#f7f7f7');
};

const closeSideviewBrowser = () => {
  if (getSideBrowser()) {
    const mainWindow = getMainWindow();
    const { browserView, header, appId, browserType } = getSideBrowser() || {};
    mainWindow.removeBrowserView(header);
    mainWindow.removeBrowserView(browserView);
    header?.webContents?.destroy();
    browserView?.webContents?.destroy();
    updateSideBrowser(undefined);
  }
};

let GLOBAL_NEED_DISPLAY_MINI_PROGRAM = false;
function resizeSideBrowser() {
  const { header, browserView } = getSideBrowser() || {};
  const mainWindow = getMainWindow();
  if (
    !windowIsAlive(mainWindow) ||
    !browserIsAlive(browserView) ||
    !browserIsAlive(header)
  ) {
    return;
  }
  if (GLOBAL_NEED_DISPLAY_MINI_PROGRAM) {
    const windowWidth = mainWindow.getBounds().width;
    const windowHeight = mainWindow.getBounds().height;
    header.setBounds({
      x: windowWidth - sidePageWidth,
      y: 0,
      width: sidePageWidth,
      height: windowHeight,
    });
    browserView.setBounds({
      x: windowWidth - sidePageWidth + 1,
      y: navigateHeight,
      width: sidePageWidth - 1,
      height: windowHeight,
    });
  } else {
    header.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    browserView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
  }
}
ipcMain.on('display_mp_sideview', (_, display) => {
  GLOBAL_NEED_DISPLAY_MINI_PROGRAM = display;
  if (getSideBrowser()) {
    resizeSideBrowser();
  }
});

const sideTryAgain = forceInject => {
  const { browserView, header, appId } = getSideBrowser() || {};
  if (!browserIsAlive(browserView) || !browserIsAlive(header)) {
    return;
  }
  const params = getAppInfo(appId);
  loadSideBrowserView({ ...params, forceInject });
};

module.exports = {
  handleMpSideView,
  showSideView,
  closeSideviewBrowser,
  resizeSideBrowser,
  sideTryAgain,
};
