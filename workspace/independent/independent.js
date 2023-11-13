const electron = require('electron');
const { BrowserWindow, BrowserView, ipcMain, clipboard, app, shell, screen } =
  electron;
const {
  getIndependentMpWindow,
  updateGlobalDid,
  updateGlobalUid,
  updateIndependentMpWindow,
  deleteIndependentMpWindow,
  getSideBrowser,
  getBcSession,
  getMainWindow,
  getHardwareInfo,
  getGlobalTheme,
  getLocale,
  updateAppInfo,
  updateGlobalUserEmail,
  independentMpToChangeArr,
} = require('../globalManager');
const {
  formatUrl,
  browserIsAlive,
  checkExistApp,
  windowIsAlive,
  handleUrlWhiteListMap,
  showNativeDialog,
  hostFilter,
  customUUID,
  getCustomUserAgent,
  getUrlParams,
} = require('../utils');
const path = require('path');
const i18n = require('../../js/modules/i18n');

const _ = require('lodash');
const ephemeralConfig = require('../../app/ephemeral_config');

const navigateHeight = 40; // 导航栏高度
const DEFAULT_WIDTH = 1024;
const DEFAULT_HEIGHT = 700;
const MIN_WIDTH = process.platform === 'linux' ? 680 : 768;
const MIN_HEIGHT = process.platform === 'linux' ? 420 : 700;
const BOUNDS_BUFFER = 100;
const windowCurrentTabMap = new Map();

const isVisible = (window, bounds) => {
  const boundsX = _.get(bounds, 'x') || 0;
  const boundsY = _.get(bounds, 'y') || 0;
  const boundsWidth = _.get(bounds, 'width') || DEFAULT_WIDTH;
  const boundsHeight = _.get(bounds, 'height') || DEFAULT_HEIGHT;

  // requiring BOUNDS_BUFFER pixels on the left or right side
  const rightSideClearOfLeftBound =
    window.x + window.width >= boundsX + BOUNDS_BUFFER;
  const leftSideClearOfRightBound =
    window.x <= boundsX + boundsWidth - BOUNDS_BUFFER;

  // top can't be offscreen, and must show at least BOUNDS_BUFFER pixels at bottom
  const topClearOfUpperBound = window.y >= boundsY;
  const topClearOfLowerBound =
    window.y <= boundsY + boundsHeight - BOUNDS_BUFFER;

  return (
    rightSideClearOfLeftBound &&
    leftSideClearOfRightBound &&
    topClearOfUpperBound &&
    topClearOfLowerBound
  );
};

const focusCurrentBrowserView = appId => {
  if (!appId) {
    return;
  }
  try {
    const window = getIndependentMpWindow(appId);
    if (!windowIsAlive(window)) {
      return;
    }
    const tabId = windowCurrentTabMap.get(appId);

    const browserViews = window?.getBrowserViews();
    const browserView = browserViews?.find(
      browserView => browserView?.tabId === tabId
    );

    if (browserIsAlive(browserView)) {
      browserView?.webContents?.focus();
    }
  } catch (e) {
    console.error(e);
  }
};

const handleMpIndependentView = async params => {
  const {
    h5url,
    appId,
    appName,
    did,
    uid,
    jumpUrl,
    browserType,
    email,
    displayType,
    hostname,
    urlWhiteList,
    onlyDisplay,
  } = params || {};

  if ((!h5url && !jumpUrl) || !appId) {
    console.error(
      '[workspace]',
      'handle independent browser view params invalid',
      params
    );
    return;
  }

  // 该应用已经在侧边展示了
  const { appId: sideAppId } = getSideBrowser() || {};
  if (sideAppId === appId) {
    return;
  }

  // 该应用处于打开状态
  if (getIndependentMpWindow(appId)) {
    const window = getIndependentMpWindow(appId);
    if (!windowIsAlive(window)) {
      return;
    }

    if (!onlyDisplay) {
      await handleBrowserInWindow(window, {
        ...params,
        multipleTab: true,
      });
    }
    window.show();
    if (window.isMinimized()) {
      window.restore();
    }

    focusCurrentBrowserView(appId);

    return;
  }

  // cache global data
  updateGlobalDid(did);
  updateGlobalUid(uid);
  updateGlobalUserEmail(email);

  let windowConfig = ephemeralConfig.get(`${appId}`);
  const options = Object.assign(
    {
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      resizable: true,
      autoHideMenuBar: true,
      backgroundColor: '#FFFFFF',
      modal: false,
      webPreferences: {
        preload: path.join(__dirname, 'independent_preload.js'),
      },
      fullscreenable: true,
      minimizable: true,
      maximizable: true,
      titleBarStyle: 'hidden',
      acceptFirstMouse: true,
      trafficLightPosition: { x: 10, y: 12 },
    },
    _.pick(windowConfig, [
      'maximized',
      'autoHideMenuBar',
      'width',
      'height',
      'x',
      'y',
    ])
  );
  if (!_.isNumber(options.width) || options.width < MIN_WIDTH) {
    options.width = DEFAULT_WIDTH;
  }
  if (!_.isNumber(options.height) || options.height < MIN_HEIGHT) {
    options.height = DEFAULT_HEIGHT;
  }
  if (!_.isBoolean(options.maximized)) {
    delete options.maximized;
  }
  if (!_.isBoolean(options.autoHideMenuBar)) {
    delete options.autoHideMenuBar;
  }

  const visibleOnAnyScreen = _.some(screen.getAllDisplays(), display => {
    if (!_.isNumber(options.x) || !_.isNumber(options.y)) {
      return false;
    }

    return isVisible(options, _.get(display, 'bounds'));
  });
  if (!visibleOnAnyScreen) {
    console.log('Location reset needed');
    delete options.x;
    delete options.y;
  }

  if (options.fullscreen === false) {
    delete options.fullscreen;
  }

  console.log('Initializing BrowserWindow config: %s', JSON.stringify(options));
  const window = new BrowserWindow(options);
  window.appInfo = params;
  window.recentClosedList = [];
  // window.webContents.openDevTools();
  if (!windowConfig && displayType === 1) {
    window.maximize();
  }

  function captureAndSaveAppWindowStats() {
    if (!windowIsAlive(window)) {
      return;
    }

    try {
      window.webContents.send('on_adapt_tab_size');

      const tabId = windowCurrentTabMap.get(appId);
      const browserView = window
        ?.getBrowserViews()
        ?.find(b => b?.tabId === tabId);
      if (browserIsAlive(browserView)) {
        browserView.setBounds({
          x: 0,
          y: navigateHeight,
          width: window.getBounds().width,
          height: window.getBounds().height - navigateHeight,
        });
      }

      removeAllMenuView(window);

      const size = window.getSize();
      const position = window.getPosition();

      // so if we need to recreate the window, we have the most recent settings
      windowConfig = {
        maximized: window.isMaximized(),
        autoHideMenuBar: window.isMenuBarAutoHide(),
        width: size[0],
        height: size[1],
        x: position[0],
        y: position[1],
      };

      if (window.isFullScreen()) {
        // Only include this property if true, because when explicitly set to
        // false the fullscreen button will be disabled on osx
        windowConfig.fullscreen = true;
      }

      ephemeralConfig.set(`${appId}`, windowConfig);
    } catch (e) {
      console.error('[workspace]', 'captureAndSaveAppWindowStats error', e);
    }
  }

  const debouncedCaptureStats = _.debounce(captureAndSaveAppWindowStats, 100);
  window.on('resize', debouncedCaptureStats);
  window.on('move', debouncedCaptureStats);

  window.on('focus', () => {
    window.flashFrame(false);
    removeAllMenuView(window);
    focusCurrentBrowserView(appId);
  });

  window.on('blur', () => {
    removeAllMenuView(window);
  });

  window.on('close', () => {
    // TODO 找到 window 下所有的 browserView 并依次关闭
    const browserViews = window.getBrowserViews() || [];
    if (browserViews && browserViews.length) {
      browserViews.forEach(view => {
        view?.webContents?.close?.();
      });
    }

    // 更新主窗口的 openAppsArr
    deleteIndependentMpWindow(appId);
    const independentMp = getIndependentMpWindow();
    const openAppsArr = independentMpToChangeArr(independentMp);
    mainWindow.webContents.send('show-open-app-panel', { openAppsArr });
  });

  window.webContents.on('did-finish-load', event => {
    window.webContents.send('on_title_change', { title: appName });
    window.webContents.send('on_theme_change', { theme: getGlobalTheme() });
  });
  window.once('ready-to-show', () => window.show());

  updateIndependentMpWindow(appId, window);
  const independentMp = getIndependentMpWindow();
  const openAppsArr = independentMpToChangeArr(independentMp);

  const mainWindow = getMainWindow();
  if (windowIsAlive(mainWindow)) {
    mainWindow.webContents.send('show-open-app-panel', { openAppsArr });
  }

  window?.loadURL(
    formatUrl([__dirname, 'html/independent_navigate.html'], { browserType })
  );

  // 缓存应用的信息保存到全局, 跟 appId 和 hostname 做一下映射
  updateAppInfo(hostname, params);
  updateAppInfo(appId, params);
  // 将应用的 urlWhiteList 和 hostname 做一下映射
  handleUrlWhiteListMap(urlWhiteList, hostname);

  await handleBrowserInWindow(window, params);
};

const handleBrowserInWindow = async (window, params) => {
  if (!windowIsAlive(window)) {
    return;
  }

  const {
    multipleTab,
    beyondCorp,
    browserType,
    appId,
    supportBot,
    appName,
    h5url,
    urlWhiteList,
    config,
  } = params || {};
  const tabId = customUUID();

  windowCurrentTabMap.set(appId, tabId);

  const { isolationFree } = config || {};

  // 创建 tab
  if (multipleTab) {
    window.webContents.send('on_new_tab', { ...params, tabId });
  } else {
    window.webContents.on('did-finish-load', event => {
      window.webContents.send('on_new_tab', { ...params, tabId });
    });
  }

  // create browser view
  const preload = isolationFree
    ? path.join(__dirname, 'independent_isolation_free_preload.js')
    : path.join(__dirname, 'independent_view_preload.js');
  const webPreferences = {
    session: beyondCorp ? getBcSession() : undefined,
    preload,
    nodeIntegration: isolationFree,
    contextIsolation: !isolationFree,
  };
  const browserView = new BrowserView({ webPreferences });
  browserView.tabId = tabId;
  // browserView.webContents.openDevTools();
  // addBrowserView 默认就会在最高一级的涂层
  window.addBrowserView(browserView);
  browserView.setAutoResize({
    width: true,
    height: true,
  });
  browserView.setBounds({
    x: 0,
    y: navigateHeight,
    width: window.getBounds().width,
    height: window.getBounds().height - navigateHeight,
  });

  // 控制前进后退按钮的显示
  subscribeBrowserViewEvent(browserView, window);

  browserView.webContents.on('page-title-updated', (event, title) => {
    window.webContents.send('on_tab_title_change', {
      title: title || appName,
      tabId,
    });
  });
  browserView.webContents.on('dom-ready', _ => {
    browserView.webContents.send('final_check', { browserType, tabId });
  });
  browserView.webContents.on(
    'did-fail-load',
    (_, errorCode, errorDescription, validatedURL) => {
      console.error(
        '[workspace]' + 'independent browserView did-fail-load',
        errorCode,
        errorDescription,
        validatedURL
      );
      // ignore action aborted, 所有的应用都会拦截这个错误
      if (errorCode === -3) {
        return;
      }
      // window.preLoadUrl = validatedURL;
      browserView?.webContents?.loadURL(
        formatUrl([__dirname, '../html/mp_error.html'], {
          errorCode,
          errorType: 'network',
          supportBot,
          appId,
          browserType,
          tabId,
        })
      );
    }
  );
  browserView.webContents.on('did-navigate', (_, httpUrl, errorCode) => {
    if (errorCode < 400) {
      const { didNavigateRedirectUrlMap } = config || {};
      if (didNavigateRedirectUrlMap?.[httpUrl]) {
        browserView?.webContents?.loadURL(didNavigateRedirectUrlMap[httpUrl]);
      }
      return;
    }
    console.log(
      '[workspace]' + 'browserView did-navigate error',
      appName,
      httpUrl
    );

    const { didNavigatePassCode } = config || {};
    if (
      didNavigatePassCode &&
      Array.isArray(didNavigatePassCode) &&
      didNavigatePassCode.includes(errorCode)
    ) {
      return;
    }

    browserView.preLoadUrl = httpUrl;
    browserView?.webContents?.loadURL(
      formatUrl([__dirname, '../html/mp_error.html'], {
        errorCode,
        errorType: 'http',
        supportBot,
        appId,
        browserType,
        tabId,
      })
    );
  });

  // TODO 多tab 创建处理
  browserView.webContents.setWindowOpenHandler(details => {
    console.log('independent browserView setWindowOpenHandler', details);
    let { url, features } = details || {};

    const { newWindowUrlDeny, newWindowUrlStartsWithDefault } = config || {};

    if (
      newWindowUrlDeny &&
      Array.isArray(newWindowUrlDeny) &&
      newWindowUrlDeny.includes(url)
    ) {
      return { action: 'deny' };
    }

    const { width, height } = features || {};
    const { width: parentWidth, height: parentHeight } =
      window.getBounds() || {};

    if (
      newWindowUrlStartsWithDefault &&
      Array.isArray(newWindowUrlStartsWithDefault) &&
      newWindowUrlStartsWithDefault.some(item => url.startsWith(item))
    ) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: parentWidth || width || DEFAULT_WIDTH,
          height: parentHeight || height || DEFAULT_HEIGHT,
          center: true,
        },
      };
    }

    try {
      // google 自己的重定向逻辑，需要特殊处理，拿到真正的 url
      const { pathname, hostname, searchParams } = new URL(url) || {};
      if (
        hostname.includes('google.com') &&
        pathname === '/url' &&
        searchParams.get('q')
      ) {
        url = searchParams.get('q');
      }
      let currentHost;
      try {
        currentHost = new URL(h5url).hostname;
      } catch (e) {
        console.error(
          '[workspace] independent browserView setWindowOpenHandler error',
          e
        );
      }
      const existApp = checkExistApp(url);
      const mainWindow = getMainWindow();

      let urlInWhiteList = false;
      if (urlWhiteList && urlWhiteList.length) {
        for (let i = 0; i < urlWhiteList.length; i++) {
          const regex = new RegExp(urlWhiteList[i]);
          if (regex.test(url)) {
            urlInWhiteList = true;
            break;
          }
        }
      }

      // 特殊情况
      if (url.startsWith('blob:')) {
        handleBrowserInWindow(window, {
          ...params,
          jumpUrl: url,
          multipleTab: true,
        });
      } else {
        // 先检测当前路径是否存在对应的应用
        if (existApp && existApp.type === 0) {
          const { appId: existAppId } = existApp || {};
          if (existAppId === appId) {
            // 为当前应用直接窗口打开
            handleBrowserInWindow(window, {
              ...params,
              jumpUrl: url,
              multipleTab: true,
            });
          } else {
            // 为其他的应用，打开相应的应用
            if (windowIsAlive(mainWindow)) {
              mainWindow.webContents.send('jump_other_app', {
                app: existApp,
                type: existApp.type,
                jumpUrl: url,
              });
            }
          }
        } else {
          // google 相关的一些跳转，需要打开新的窗口， 如果在白名单里面，也需要打开新窗口
          if (
            (currentHost.includes('google.com') &&
              hostname.includes('google.com')) ||
            urlInWhiteList
          ) {
            handleBrowserInWindow(window, {
              ...params,
              jumpUrl: url,
              multipleTab: true,
            });
          } else {
            // 啥也不是
            shell.openExternal(url);
          }
        }
      }
    } catch (e) {
      console.log(e);
    }
    return { action: 'deny' };
  });

  browserView.webContents.on('did-create-window', (browserWindow, details) => {
    console.log('independent browserView did-create-window', details);
  });

  browserView.webContents.on('will-redirect', (event, httpUrl) => {
    try {
      const url = new URL(httpUrl);
      const { pathname, hostname } = url || {};
      const { firstOpenJumpUrl, willRedirectForbidden } = config || {};

      const backToOktaHome =
        pathname === '/app/UserHome' && hostname.includes('okta.com');

      if (backToOktaHome) {
        event.preventDefault();
        browserView?.webContents?.loadURL(firstOpenJumpUrl || h5url);
        return;
      }

      if (!willRedirectForbidden) {
        const redirectHost = hostFilter(httpUrl);
        const currentHost = hostFilter(h5url);
        const existApp = checkExistApp(httpUrl);
        const mainWindow = getMainWindow();
        if (
          httpUrl &&
          redirectHost !== currentHost &&
          existApp &&
          existApp.type === 0 &&
          windowIsAlive(mainWindow)
        ) {
          mainWindow.webContents.send('jump_other_app', {
            app: existApp,
            type: existApp.type,
            jumpUrl: httpUrl,
          });
          event.preventDefault();
        }
      }
    } catch (e) {
      console.error(
        '[workspace]' + 'browser view will-redirect catch error',
        e
      );
    }
  });
  browserView.webContents.session.on(
    'will-download',
    (event, item, webContents) => {
      item.on('updated', (event, state) => {
        if (state === 'interrupted') {
          console.log('Download is interrupted but can be resumed');
        } else if (state === 'progressing') {
          if (item.isPaused()) {
            console.log('Download is paused');
          } else {
            console.log(`Received bytes: ${item.getReceivedBytes()}`);
          }
        }
      });
      item.once('done', (event, state) => {
        if (state === 'completed') {
          console.log('Download successfully');
        } else {
          console.log(`Download failed: ${state}`);
        }

        // 第一次打开链接就去下载才需要关闭窗口
        if (browserView?.downloadFlag && windowIsAlive(window)) {
          window.webContents.send('on_close_page', {
            tabId,
            bridgeClose: true,
          });
        }
      });

      if (
        browserView?.loadingState === 'loading' &&
        browserIsAlive(browserView)
      ) {
        browserView.downloadFlag = true;
        browserView.webContents.loadURL(
          formatUrl([__dirname, 'html/download_tip.html'], {})
        );
      }
    }
  );
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

  browserView.webContents.on('destroyed', () => {
    browserView.destoryed = true;
    handleBrowserDestroy({ appId, tabId });
  });

  loadIndependentBrowserView({
    ...params,
    tabId,
  });
};

const handleBrowserDestroy = params => {
  const { appId, tabId } = params || {};
  const window = getIndependentMpWindow(appId);
  if (windowIsAlive(window)) {
    window.webContents.send('on_close_page', { tabId, bridgeClose: true });
  }
};

function loadIndependentBrowserView(params) {
  const { h5url, appId, supportBot, beyondCorp, jumpUrl, browserType, tabId } =
    params || {};

  const window = getIndependentMpWindow(appId);
  if (!windowIsAlive(window)) {
    return;
  }

  const browserViews = window.getBrowserViews() || [];
  const browserView = browserViews.find(item => item.tabId === tabId);
  if (!browserIsAlive(browserView)) {
    return;
  }

  browserView.loadingState = 'loading';
  let loadUrl = jumpUrl || h5url;

  const urlParams = getUrlParams(loadUrl);
  if (!urlParams) {
    loadUrl = loadUrl + `?t=${Date.now()}`;
  } else if (urlParams && !urlParams?.['t']) {
    loadUrl = loadUrl + `&t=${Date.now()}`;
  }

  browserView?.webContents?.loadURL(loadUrl, {
    userAgent: getCustomUserAgent(beyondCorp) + 'bridgeId' + tabId,
  });
}

const showIndependentView = params => {
  const { appId, tabId } = params || {};
  const window = getIndependentMpWindow(appId);
  if (!windowIsAlive(window)) {
    return;
  }
  const browserViews = window.getBrowserViews() || [];
  const browserView = browserViews.find(item => item?.tabId === tabId);
  if (!browserIsAlive(browserView)) {
    return;
  }
  browserView.setBackgroundColor('#f7f7f7');
  browserView.loadingState = 'complete';
};

function subscribeBrowserViewEvent(browserView, window) {
  browserView.webContents
    .on('did-start-loading', () => {
      updateWindowControlConfig(browserView, window);
    })
    .on('will-redirect', () => {
      updateWindowControlConfig(browserView, window);
    })
    .on('did-stop-loading', () => {
      updateWindowControlConfig(browserView, window);
    });
}

function updateWindowControlConfig(browserView, window) {
  if (!windowIsAlive(window) || !browserIsAlive(browserView)) {
    console.log('updateWindowControlConfig destroy');
    return;
  }
  try {
    const canGoBack = browserView.webContents.canGoBack();
    const canGoForward = browserView.webContents.canGoForward();
    const tabId = browserView?.tabId;
    window.webContents.send('on_control_action', {
      canGoBack,
      canGoForward,
      tabId,
    });
  } catch (e) {
    console.error('[workspace]' + 'updateWindowControlConfig catch error', e);
  }
}

const independentTryAgain = (window, reloadParams) => {
  const { tabId } = reloadParams || {};
  try {
    if (!windowIsAlive(window)) {
      return;
    }
    const browserViews = window.getBrowserViews() || [];
    const browserView = browserViews.find(item => item?.tabId === tabId);
    if (!browserIsAlive(browserView)) {
      return;
    }
    const params = window?.appInfo || {};
    if (browserView?.preLoadUrl) {
      params.jumpUrl = browserView.preLoadUrl;
      delete browserView.preLoadUrl;
    } else {
      // 对有兜底重试路径，有 firstOpenJumpUrl 需要优先加载
      const { config } = params || {};
      const { firstOpenJumpUrl } = config || {};
      params.jumpUrl = firstOpenJumpUrl || params?.jumpUrl;
    }
    loadIndependentBrowserView({ ...params, ...reloadParams });
  } catch (e) {
    console.error(e);
  }
};

ipcMain.on('maximized_window', event => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (windowIsAlive(window)) {
    if (window.isMaximized()) {
      window.unmaximize();
    } else {
      window.maximize();
    }
  }
});

ipcMain.on('get_page_description_callback', (event, params) => {
  console.log('get_page_description_callback', params);
  const { url, title, appId, description } = params || {};
  const mainWindow = getMainWindow();
  if (windowIsAlive(mainWindow)) {
    mainWindow.show();
    mainWindow.webContents.send('event-share-mini-program', {
      content: `
[${title}](${url})
\`\`${url}\`\`
${description ? `**${description}**` : ''}
`,
      appId,
    });
  }
});
ipcMain.on('independent_view_navigate_control', async (event, params) => {
  const { action, tabId } = params || {};
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!windowIsAlive(window)) {
    return;
  }
  const browserViews = window.getBrowserViews() || [];
  const browserView = browserViews.find(item => item?.tabId === tabId);
  if (!browserIsAlive(browserView)) {
    return;
  }

  let { h5url: link, appId, appName } = window?.appInfo || {};
  const currentPageUrl = browserView.webContents.getURL();
  const title = browserView.webContents.getTitle() || appName;
  if (currentPageUrl && !currentPageUrl.startsWith('file://')) {
    link = currentPageUrl;
  }
  if (action === 'copyLink') {
    const locale = getLocale();
    const i18nLocale = app.getLocale();
    const localMsg = locale.messages;
    const messages = i18n.setup(i18nLocale, localMsg)('copiedButton');
    browserView.webContents.send('on_toast', messages);
    await clipboard.writeText(link);
  } else if (action === 'openInBrowser') {
    await shell.openExternal(link);
  } else if (action === 'sharePage') {
    browserView.webContents.send('get_page_description', {
      appId,
      title,
      url: link,
    });
  } else {
    browserView.webContents[action]();
  }
  // 操作完毕后，关闭 tabMenu
  removeAllMenuView(window);
});

ipcMain.on('navigate_share_note_callback', async (event, note) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  const mainWindow = getMainWindow();
  if (!windowIsAlive(mainWindow)) {
    return;
  }
  const { content, prompt } = note || {};
  const { appId } = window || {};
  if (!appId || !content) {
    return;
  }
  if (prompt) {
    const { message, detail } = prompt || {};
    const result = await showNativeDialog({
      window,
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
  mainWindow.show();
  mainWindow.webContents.send('event-share-mini-program', {
    content,
    appId,
  });
});

ipcMain.on('open_devtools', (event, tabId) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!windowIsAlive(window)) {
    return;
  }
  const browserView = window
    ?.getBrowserViews()
    ?.find(item => item?.tabId === tabId);
  if (browserIsAlive(browserView)) {
    browserView.webContents.openDevTools();
  }
});

ipcMain.on('switch_tab', (event, params) => {
  const { tabId, appId, inWindow } = params || {};
  let window = BrowserWindow.fromWebContents(event.sender);

  // 从 mainMenu 过来的
  if (appId) {
    window = getIndependentMpWindow(appId);
  }
  if (!windowIsAlive(window)) {
    return;
  }

  removeAllMenuView(window);

  windowCurrentTabMap.set(window?.appInfo?.appId, tabId);

  if (!inWindow) {
    window.webContents.send('on_switch_tab', params);
  }

  window.show();
  if (window.isMinimized()) {
    window.restore();
  }

  const browserViews = window.getBrowserViews() || [];
  const browserView = browserViews.find(item => item?.tabId === tabId);
  if (browserIsAlive(browserView)) {
    window.setTopBrowserView(browserView);
    browserView?.webContents?.focus();
  }
});

ipcMain.on('remove_menu_view', event => {
  const window = BrowserWindow.fromWebContents(event.sender);
  removeAllMenuView(window);
});

ipcMain.on('close_tab', (event, params) => {
  let { tabId } = params || {};
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!windowIsAlive(window)) {
    return;
  }

  const browserViews =
    window.getBrowserViews()?.filter(item => item?.tabId) || [];
  // 如果是最后一个 tab，关闭窗口
  if (browserViews.length === 1) {
    window.close();
  }

  let browserView = browserViews.find(item => item?.tabId === tabId);

  // 获取当前 tab 的 url
  if (browserIsAlive(browserView)) {
    const url = browserView?.webContents?.getURL();
    const title = browserView?.webContents?.getTitle();
    if (url && !url.startsWith('file://')) {
      const recentClosedList = window?.recentClosedList || [];

      if (recentClosedList.length >= 5) {
        window?.recentClosedList?.shift();
      }
      window?.recentClosedList?.push({
        url,
        title,
      });
    }
  }

  window.removeBrowserView(browserView);
  if (browserIsAlive(browserView)) {
    browserView?.webContents?.close();
  } else {
    browserView = null;
  }
});

ipcMain.on('close_window', (event, params) => {
  const { appId } = params || {};
  const window = getIndependentMpWindow(appId);
  if (windowIsAlive(window)) {
    window.close();
  }
});

ipcMain.on('show_tab_menu', (event, params) => {
  handleTabMenuBrowserView(event, params);
});

const handleTabMenuBrowserView = (event, params) => {
  const { tabId, clientX, clientY } = params || {};
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!windowIsAlive(window)) {
    return;
  }

  removeAllMenuView(window);

  // 创建 menu 的 browserView
  const tabMenuBrowserView = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, 'tab_menu_preload.js'),
    },
  });
  tabMenuBrowserView.tabMenu = true;
  // tabMenuBrowserView.webContents.openDevTools();
  window.addBrowserView(tabMenuBrowserView);
  window.setTopBrowserView(tabMenuBrowserView);
  tabMenuBrowserView.setAutoResize({
    width: true,
    height: true,
  });
  tabMenuBrowserView.setBounds({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  tabMenuBrowserView.webContents.on('did-finish-load', event => {
    tabMenuBrowserView.webContents.send('on_theme_change', {
      theme: getGlobalTheme(),
    });
    // 这边需要手动延迟懒加载，否则会出现闪烁
    setTimeout(() => {
      if (browserIsAlive(tabMenuBrowserView)) {
        tabMenuBrowserView.setBounds({
          x: clientX - 170,
          y: clientY + 2,
          width: 190,
          height: 115,
        });
      }
    }, 10);
  });

  tabMenuBrowserView?.webContents?.loadURL(
    formatUrl([__dirname, 'html/tab_menu.html'], { tabId })
  );
};

const removeTabMenuView = window => {
  if (!windowIsAlive(window)) {
    return;
  }
  const tabMenuView = window.getBrowserViews()?.find(item => item?.tabMenu);
  if (tabMenuView) {
    window.removeBrowserView(tabMenuView);
    tabMenuView.webContents.close();
  }
};

ipcMain.on('close_menus', event => {
  const window = BrowserWindow.fromWebContents(event.sender);
  removeAllMenuView(window);
});

ipcMain.on('show_down_action_menu', (event, params) => {
  handleDownActionMenuView(event, params);
});

const handleDownActionMenuView = (event, params) => {
  const { tabId, clientX, clientY } = params || {};
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!windowIsAlive(window)) {
    return;
  }

  removeAllMenuView(window);

  const recentClosedList = window?.recentClosedList || [];

  // 创建 menu 的 browserView
  const downActionMenuBrowserView = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, 'down_action_menu_preload.js'),
    },
  });
  downActionMenuBrowserView.downActionMenu = true;
  // downActionMenuBrowserView.webContents.openDevTools();
  window.addBrowserView(downActionMenuBrowserView);
  window.setTopBrowserView(downActionMenuBrowserView);
  downActionMenuBrowserView.setAutoResize({
    width: true,
    height: true,
  });
  downActionMenuBrowserView.setBounds({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  downActionMenuBrowserView.webContents.on('did-finish-load', event => {
    downActionMenuBrowserView.webContents.send('on_theme_change', {
      theme: getGlobalTheme(),
    });
    // 这边需要手动延迟懒加载，否则会出现闪烁
    setTimeout(() => {
      if (browserIsAlive(downActionMenuBrowserView)) {
        const base = recentClosedList.length || 1;
        downActionMenuBrowserView.setBounds({
          x: clientX - 170,
          y: clientY + 2,
          width: 190,
          height: 19 + 32 + base * 32,
        });
      }
    }, 10);
  });

  const recentList = JSON.stringify(recentClosedList);
  downActionMenuBrowserView?.webContents?.loadURL(
    formatUrl([__dirname, 'html/down_action_menu.html'], {
      tabId,
      recentList,
    })
  );
};

const removeDownActionMenuView = window => {
  if (!windowIsAlive(window)) {
    return;
  }
  const downActionMenu = window
    .getBrowserViews()
    ?.find(item => item?.downActionMenu);
  if (downActionMenu) {
    window.removeBrowserView(downActionMenu);
    downActionMenu.webContents.close();
  }
};

const removeAllMenuView = window => {
  removeDownActionMenuView(window);
  removeTabMenuView(window);
};

ipcMain.on('open_recent_link', (event, params) => {
  const { url } = params || {};
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!windowIsAlive(window)) {
    return;
  }

  const { appInfo } = window || {};
  if (!appInfo) {
    return;
  }

  appInfo.jumpUrl = url;
  appInfo.multipleTab = true;

  handleBrowserInWindow(window, appInfo);

  // 操作完毕后，关闭菜单
  removeAllMenuView(window);
});

ipcMain.handle('get_app_tab_list', (event, params) => {
  const { appId } = params || {};
  const window = getIndependentMpWindow(appId);
  if (!windowIsAlive(window)) {
    return [];
  }
  const browserViews =
    window
      .getBrowserViews()
      ?.filter(item => !item?.tabMenu && !item?.downActionMenu) || [];
  if (!browserViews.length) {
    return [];
  }
  const result = [];
  for (let i = 0; i < browserViews.length; i++) {
    const item = browserViews[i];
    const { tabId } = item || {};
    const url = item?.webContents?.getURL() || undefined;
    const title = item?.webContents?.getTitle() || undefined;
    result.push({
      url,
      title,
      tabId,
    });
  }
  return result || [];
});

ipcMain.handle('check_app_opened', (event, params) => {
  const { appId } = params || {};
  const window = getIndependentMpWindow(appId);
  return windowIsAlive(window);
});

module.exports = {
  handleMpIndependentView,
  showIndependentView,
  independentTryAgain,
};
