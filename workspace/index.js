const electron = require('electron');
const { ipcMain, BrowserWindow, BrowserView } = electron;

const {
  handleMpIndependentView,
  independentTryAgain,
  showIndependentView,
} = require('./independent/independent');
const {
  handleMpSideView,
  closeSideviewBrowser,
  showSideView,
  sideTryAgain,
} = require('./side/side');
const {
  handleWebview,
  closeWebviewBrowser,
  showWebView,
  webviewTryAgain,
} = require('./webview/webview');
const {
  getIndependentMpWindow,
  getMainWindow,
  getSideBrowser,
  getWebviewBrowser,
} = require('./globalManager');
const {
  windowIsAlive,
  browserIsAlive,
  formatUrl,
  showNativeDialog,
} = require('./utils');

const handleWorkspace = params => {
  const { browserType } = params;
  if (browserType === 'independent') {
    handleMpIndependentView(params);
  } else if (browserType === 'side') {
    handleMpSideView(params);
  } else if (browserType === 'halfview' || browserType === 'fullview') {
    handleWebview(params);
  }
};

ipcMain.on('on_js_bridge', (event, data) => {
  const mainWindow = getMainWindow();
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!windowIsAlive(mainWindow) || !windowIsAlive(window)) {
    return;
  }

  // 通过 UA 的特征来判断是哪个 tab 发出的请求
  const tabId = event.sender.userAgent?.split('bridgeId')[1];

  const { isWebview } = data;
  const { appInfo } = window || {};
  let { appId, browserType } = appInfo || {};
  if (isWebview) {
    browserType = getWebviewBrowser()?.browserType;
    appId = getWebviewBrowser()?.appId;
  } else if (window === mainWindow) {
    browserType = 'side';
    appId = getSideBrowser()?.appId;
  }
  mainWindow.webContents.send('on_js_bridge', {
    ...data,
    appId,
    browserType,
    tabId,
  });
});

ipcMain.on('on_js_bridge_callback', async (_, data) => {
  try {
    const { response, appId, params, callbackid, browserType, tabId } =
      data || {};
    const { action } = response || {};
    let browserView;
    if (browserType === 'independent') {
      const window = getIndependentMpWindow(appId);
      if (!windowIsAlive(window)) {
        console.error('window is unavailable');
        return;
      }
      const browserViews = window.getBrowserViews() || [];
      browserView = browserViews.find(item => item?.tabId === tabId);
      if (!browserIsAlive(browserView)) {
        console.error('browserView is unavailable');
        return;
      }
      if (action === 'reload') {
        independentTryAgain(window);
      } else if (action === 'setTitle') {
        // TODO setTitle 先屏蔽
        // window.webContents.send('on_title_change', params?.title);
      } else if (action === 'closePage') {
        window.webContents.send('on_close_page', { tabId, bridgeClose: true });
      } else if (action === 'installCert') {
        // not support
      } else if (action === 'shareNote') {
        const { content, prompt } = params || {};
        if (!appId || !content) {
          return;
        }
        if (prompt) {
          const { message, detail } = prompt || {};
          const result = await showNativeDialog({
            window: getIndependentMpWindow(appId),
            message,
            detail,
          });
          if (!result) {
            return;
          }
          const { response } = result || {};
          // Cancel
          if (response === 1) {
            return;
          }
        }
        const mainWindow = getMainWindow();
        if (!windowIsAlive(mainWindow)) {
          return;
        }
        mainWindow.show();
        mainWindow.webContents.send('event-share-mini-program', {
          content,
          appId,
        });
      } else if (action === 'getGroupInfo') {
        const createBotWindow = getIndependentMpWindow(appId);
        createBotWindow.show();
      }
    } else if (browserType === 'side') {
      const { browserView: sideBrowser, header } = getSideBrowser() || {};
      browserView = sideBrowser;
      if (action === 'reload') {
        sideTryAgain();
      } else if (action === 'setTitle' && browserIsAlive(header)) {
        header.webContents.send('on_title_change', params?.title);
      } else if (action === 'closePage') {
        closeSideviewBrowser();
      } else if (action === 'installCert') {
        // not support
      }
    } else if (browserType === 'halfview' || browserType === 'fullview') {
      const { browserView: webviewBrowser, header } = getWebviewBrowser();
      browserView = webviewBrowser;
      if (action === 'reload') {
        webviewTryAgain();
      } else if (action === 'setTitle' && browserIsAlive(header)) {
        header.webContents.send('on_title_change', params?.title);
      } else if (action === 'closePage') {
        closeWebviewBrowser();
      } else if (action === 'installCert') {
        // not support
      }
    }
    if (browserIsAlive(browserView)) {
      browserView.webContents.send(
        `on_js_bridge_callback_${callbackid}`,
        response
      );
    }
  } catch (e) {
    console.error('on_js_bridge_callback catch error', e);
  }
});

ipcMain.on('try_again', (event, params) => {
  const { browserType, forceInject, ssl } = params || {};

  if (browserType === 'independent') {
    const window = BrowserWindow.fromWebContents(event.sender);
    independentTryAgain(window, params);
  } else if (browserType === 'side') {
    sideTryAgain(forceInject);
  } else if (browserType === 'halfview' || browserType === 'fullview') {
    webviewTryAgain(forceInject);
  }
});

ipcMain.on('contact_developer', (event, supportBot) => {
  const mainWindow = getMainWindow();
  if (windowIsAlive(mainWindow)) {
    mainWindow.show();
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.webContents.send('jump-message', { conversationId: supportBot });
  }
});

ipcMain.on('final_check_callback', (event, params) => {
  const { browserType, tabId } = params || {};
  if (browserType === 'independent') {
    const { appInfo } = BrowserWindow.fromWebContents(event.sender) || {};
    const { appId } = appInfo || {};
    showIndependentView({ appId, tabId });
  } else if (browserType === 'side') {
    showSideView(browserType);
  } else if (browserType === 'halfview' || browserType === 'fullview') {
    showWebView(browserType);
  }
});

module.exports = {
  handleWorkspace,
};
