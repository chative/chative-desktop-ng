const electron = require('electron');
const { BrowserView, ipcMain } = electron;
const path = require('path');
const {
  getMainWindow,
  getWebviewBrowser,
  updateGlobalDid,
  updateGlobalUid,
  updateWebviewBrowser,
  getBcSession,
  getHardwareInfo,
  getGlobalTheme,
  updateAppInfo,
  updateGlobalUserEmail,
  getAppInfo,
} = require('../globalManager');
const {
  windowIsAlive,
  formatUrl,
  handleNewWindow,
  browserIsAlive,
  handleUrlWhiteListMap,
  getCustomUserAgent,
} = require('../utils');

const leftPaneWidth = 367;
const sidePageWidth = 360;
const navigateHeight = 48; // 导航栏高度

const handleWebview = params => {
  const { h5url, appId, appName, jumpUrl, did, uid, browserType, email } =
    params || {};
  const mainWindow = getMainWindow();
  if (!windowIsAlive(mainWindow) || !appId || (!h5url && !jumpUrl)) {
    console.error('[workspace]', 'handle webview params invalid', params);
    return;
  }

  // cache global data
  updateGlobalDid(did);
  updateGlobalUid(uid);
  updateGlobalUserEmail(email);

  const webviewBrowser = getWebviewBrowser();
  if (webviewBrowser) {
    const {
      header,
      browserView,
      appId: webviewAppId,
      browserType: preType,
    } = webviewBrowser || {};
    if (appId === webviewAppId) {
      if (browserType !== preType) {
        closeWebviewBrowser();
        handleWebviewHeader(params);
        handleWebviewBrowser(params);
      } else {
        if (!browserIsAlive(header)) {
          handleWebviewHeader(params);
        }
        if (!browserIsAlive(browserView)) {
          handleWebviewBrowser(params);
        } else {
          const { jumpUrl } = params || {};
          if (jumpUrl) {
            browserView.webContents.loadURL(jumpUrl);
          }
        }
      }
    } else {
      if (browserType === preType) {
        if (header) {
          header.webContents.send('on_title_change', appName);
        } else {
          handleWebviewHeader(params);
        }
        if (!browserView) {
          handleWebviewBrowser(params);
        } else {
          browserView?.setBounds({ x: 0, y: 0, width: 0, height: 0 });
          loadWebviewBrowser(params);
        }
      } else {
        closeWebviewBrowser();
        handleWebviewHeader(params);
        handleWebviewBrowser(params);
      }
    }
  } else {
    handleWebviewHeader(params);
    handleWebviewBrowser(params);
  }
};

function handleWebviewHeader(params) {
  const { appName, browserType } = params || {};
  const mainWindow = getMainWindow();
  const header = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, 'webview_preload.js'),
    },
  });
  mainWindow.addBrowserView(header);
  // header.webContents.openDevTools();
  header.setBounds({
    x:
      browserType === 'fullview'
        ? leftPaneWidth
        : mainWindow.getBounds().width - sidePageWidth,
    y: 0,
    width:
      browserType === 'fullview'
        ? mainWindow.getBounds().width - leftPaneWidth
        : sidePageWidth,
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
    formatUrl([__dirname, 'html/webview_navigate.html'], { browserType })
  );
  let webviewBrowser = getWebviewBrowser();
  if (webviewBrowser) {
    webviewBrowser['header'] = header;
  } else {
    webviewBrowser = { header };
  }
  updateWebviewBrowser(webviewBrowser);
}

async function handleWebviewBrowser(params) {
  const { appId, supportBot, beyondCorp, browserType, urlWhiteList, hostname } =
    params || {};
  const mainWindow = getMainWindow();

  // create browser view
  const browserView = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, 'web_view_preload.js'),
      session: beyondCorp ? getBcSession() : undefined,
    },
  });
  // browserView.webContents.openDevTools();
  mainWindow.addBrowserView(browserView);
  browserView.setBounds({
    x:
      browserType === 'fullview'
        ? leftPaneWidth + 1
        : mainWindow.getBounds().width - sidePageWidth + 1,
    y: navigateHeight,
    width:
      browserType === 'fullview'
        ? mainWindow.getBounds().width - leftPaneWidth - 1
        : sidePageWidth - 1,
    height: mainWindow.getBounds().height - navigateHeight,
  });
  browserView.setAutoResize({
    width: true,
    height: true,
  });

  let webviewBrowser = getWebviewBrowser();
  if (webviewBrowser) {
    webviewBrowser = {
      ...webviewBrowser,
      ...params,
      browserView,
      hostname,
    };
  } else {
    webviewBrowser = { ...params, browserView, hostname };
  }
  updateWebviewBrowser(webviewBrowser);

  browserView.webContents.on('dom-ready', _ => {
    browserView.webContents.send('final_check', browserType);
  });
  browserView.webContents.on(
    'did-fail-load',
    (_, errorCode, errorDescription) => {
      console.error(
        '[workspace]' + 'webview browserView did-fail-load',
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
    console.log('webview browserView setWindowOpenHandler', details);
    const { url } = details || {};
    handleNewWindow({ url, window: mainWindow });
    // 阻止默认行为，采用自定义逻辑判断去决定如何打开
    return { action: 'deny' };
  });
  browserView.webContents.on('did-create-window', (browserWindow, details) => {
    console.log('webview browserView did-create-window', details);
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
      callback(0);
    }
  );

  // 缓存一份应用的信息保存到全局
  updateAppInfo(hostname, { ...params, hostname });
  updateAppInfo(appId, { ...params, hostname });
  // 将应用的 urlWhiteList 和 hostname 做一下映射
  handleUrlWhiteListMap(urlWhiteList, hostname);

  loadWebviewBrowser({ ...params, hostname });
}

function loadWebviewBrowser(params) {
  const { h5url, appId, supportBot, beyondCorp, jumpUrl, browserType } =
    params || {};

  const { browserView, header } = getWebviewBrowser() || {};
  const mainWindow = getMainWindow();
  if (
    !windowIsAlive(mainWindow) ||
    !browserIsAlive(browserView) ||
    !browserIsAlive(header)
  ) {
    return;
  }

  browserView?.webContents?.loadURL(jumpUrl || h5url, {
    userAgent: getCustomUserAgent(beyondCorp),
  });
}

function closeWebviewBrowser() {
  if (getWebviewBrowser()) {
    const mainWindow = getMainWindow();
    const { header, browserView, appId } = getWebviewBrowser() || {};
    mainWindow.removeBrowserView(header);
    mainWindow.removeBrowserView(browserView);
    header?.webContents?.destroy();
    browserView?.webContents?.destroy();
    updateWebviewBrowser(undefined);
  }
}

function webviewTryAgain(forceInject) {
  const { browserView, header, appId } = getWebviewBrowser() || {};
  if (!browserIsAlive(browserView) || !browserIsAlive(header)) {
    return;
  }
  const params = getAppInfo(appId);
  loadWebviewBrowser({ ...params, forceInject });
}

ipcMain.on('web_view_close', _ => {
  closeWebviewBrowser();
});

ipcMain.on('web_view_navigate_control', async (event, action) => {
  try {
    if (action === 'close') {
      closeWebviewBrowser();
    }
  } catch (e) {
    console.error('webview navigate control catch error', e);
  }
});

function showWebView() {
  const { browserView } = getWebviewBrowser() || {};
  if (!browserIsAlive(browserView)) {
    return;
  }
  browserView.setBackgroundColor('#f7f7f7');
}

let GLOBAL_NEED_DISPLAY_INSIDE_MINI_PROGRAM = true;
function resizeInsideBrowser() {
  const mainWindow = getMainWindow();
  const { browserView, header, browserType } = getWebviewBrowser() || {};
  if (
    !windowIsAlive(mainWindow) ||
    !browserIsAlive(browserView) ||
    !browserIsAlive(header)
  ) {
    return;
  }
  if (GLOBAL_NEED_DISPLAY_INSIDE_MINI_PROGRAM) {
    const windowWidth = mainWindow.getBounds().width;
    const windowHeight = mainWindow.getBounds().height;
    header.setBounds({
      x:
        browserType === 'fullview'
          ? leftPaneWidth
          : windowWidth - sidePageWidth,
      y: 0,
      width:
        browserType === 'fullview'
          ? windowWidth - leftPaneWidth
          : sidePageWidth,
      height: windowHeight,
    });
    browserView.setBounds({
      x:
        browserType === 'fullview'
          ? leftPaneWidth + 1
          : windowWidth - sidePageWidth + 1,
      y: navigateHeight,
      width:
        browserType === 'fullview'
          ? windowWidth - leftPaneWidth - 1
          : sidePageWidth - 1,
      height: mainWindow.getBounds().height - navigateHeight,
    });
  } else {
    header.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    browserView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
  }
}
ipcMain.on('display_mp_webview', (_, display) => {
  GLOBAL_NEED_DISPLAY_INSIDE_MINI_PROGRAM = display;
  if (getWebviewBrowser()) {
    resizeInsideBrowser();
  }
});

module.exports = {
  handleWebview,
  resizeInsideBrowser,
  closeWebviewBrowser,
  showWebView,
  webviewTryAgain,
};
