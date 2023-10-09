/* eslint-disable no-console */

const path = require('path');
const url = require('url');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');
// const { lt } = require('semver');
const i18n = require('./js/modules/i18n');
const _ = require('lodash');
const pify = require('pify');
const electron = require('electron');
const { redactAll } = require('./js/modules/privacy');
const fetch = require('node-fetch');
const { formatError } = require('./ts/logger/utils');
const { markShouldQuit } = require('./app/window_state');

// Add right-click listener for selected text and urls
const contextMenu = require('electron-context-menu');
contextMenu({
  showCopyLink: true,
  showInspectElement: false,
  showLookUpSelection: false,
  showSearchWithGoogle: false,
  shouldShowMenu: (event, params) =>
    Boolean(
      !params.isEditable &&
        params.mediaType === 'none' &&
        (params.linkURL || params.selectionText)
    ),
});

const remoteMain = require('@electron/remote/main');
remoteMain.initialize();

const packageJson = require('./package.json');
const GlobalErrors = require('./app/global_errors');
GlobalErrors.addHandler();

const getRealPath = pify(fs.realpath);
const {
  app,
  autoUpdater,
  BrowserView,
  BrowserWindow,
  desktopCapturer,
  clipboard,
  ipcMain: ipc,
  Menu,
  protocol: electronProtocol,
  session,
  shell,
  dialog,
  nativeTheme,
  systemPreferences,
  powerMonitor,
  powerSaveBlocker,
  nativeImage,
} = electron;

// from electron v9, allowRendererProcessReuse default is true.
app.allowRendererProcessReuse = false;
// app.commandLine.appendSwitch('ignore-certificate-errors');  // 此行，测试版本才需要
app.setAsDefaultProtocolClient('difft');
app.setAsDefaultProtocolClient('chative');

ipc.on('copy', () => {
  let num = 10;
  const prev = '';
  clipboard.writeText(prev);

  const interval = setInterval(() => {
    const newest = clipboard.readText('clipboard');
    if (prev !== newest) {
      clipboard.writeText(newest);
      // eslint-disable-next-line no-unreachable
      clearInterval(interval);
      return;
    }
    if (prev === newest && num > 0) {
      // eslint-disable-next-line no-plusplus
      num--;
    }
    if (num <= 0) {
      // eslint-disable-next-line no-unreachable
      clearInterval(interval);
    }
  }, 100);
});

const {
  betterEncodeURIComponent,
  getCustomUserAgent,
  customUUID,
} = require('./workspace/utils');

async function joinMeeting(urlLink, external = false) {
  const params = new URL(urlLink).searchParams;
  const v = parseInt(params.get('v'), 10);
  const meetingname = params.get('meetingname') || 'Chative Meeting';
  const channelname = params.get('channelname');
  const meetingId = params.get('meetingid') || params.get('meetingId');
  const expireTime = params.get('expireTime') || params.get('expiretime');

  // 只支持v=1版本
  if (v !== 1) {
    dialog.showErrorBox('', 'Join meeting failed, version too old!');
    return;
  }

  if (channelname) {
    // if callVoiceGroup exist, show it first
    if (callVoiceWindowGroup) {
      if (callVoiceWindowGroup.isVisible()) {
        callVoiceWindowGroup.show();
      }
      if (callVoiceWindowGroup.isMinimized()) {
        callVoiceWindowGroup.restore();
      }
      return;
    }
    showWindow();

    mainWindow.webContents.send('prepare-join-meeting', {
      callType: 'passive',
      channelName: channelname,
      meetingName: meetingname,
      isPrivate: false,
      external: external ? 1 : undefined,
      meetingId,
      expireTime,
    });

    // 二次确认是否入会
    // const options = {
    //   type: 'info',
    //   buttons: ['Yes', 'Cancel'],
    //   message: 'Join Meeting',
    //   detail: 'Are you sure to join the meeting?',
    // };
    // const dialogRes = await dialog.showMessageBox(mainWindow, options);
    // if (dialogRes && dialogRes.response === 0) {
    //   setTimeout(async () => {
    //     await showCallVoiceGroupWindow({
    //       callType: 'passive',
    //       channelName: channelname,
    //       meetingName: meetingname,
    //       isPrivate: false,
    //       external: external ? 1 : undefined,
    //       meetingId,
    //     });
    //   }, 0);
    // }
  }
}

function joinGroup(urlLink) {
  if (mainWindow) {
    mainWindow.webContents.send('fast-join-group', urlLink);
  }
}

async function handleUrl(event, params) {
  console.log('main.js handleUrl params', params);
  const {
    target,
    pos,
    cid,
    did,
    uid,
    token,
    urlWhiteList,
    appId,
    beyondCorp,
    supportBot,
  } = params || {};

  if (event) {
    event.preventDefault();
  }

  if (!target) {
    console.log('invalid target url.');
    return;
  }

  try {
    // 打开系统偏好设置
    if (target.startsWith('x-apple.systempreferences:')) {
      await shell.openExternal(target);
      return;
    }

    const { host, protocol, pathname } = url.parse(target);
    if (protocol === 'http:' || protocol === 'https:') {
      // 如果是 workspace 中的应用，直接打开应用就好了
      const existApp = checkExistApp(target);
      if (existApp && existApp.type === 0 && mainWindow) {
        mainWindow.webContents.send('jump_other_app', {
          app: existApp,
          type: 0,
          jumpUrl: target,
        });
      } else {
        await shell.openExternal(target);
      }
    } else if (protocol === 'chative:') {
      if (host === 'group') {
        if (pathname === '/join') {
          joinGroup(target);
        }
        return;
      }

      if (host === 'meeting') {
        joinMeeting(target);
        return;
      }

      if (host === 'external-meeting') {
        joinMeeting(target, true);
        return;
      }

      const params = new URL(target).searchParams;
      // open api 必须有appid才响应
      if (host === 'openapi' && appId) {
        if (pathname === '/profile') {
          // 打开个人名片
          const uid = params.get('uid');
          if (uid && mainWindow) {
            mainWindow.webContents.send('open-profile', uid, pos);
          }
        } else if (pathname === '/thread') {
          // 打开单人会话或者群会话
          const tid = params.get('tid');
          if (tid && mainWindow) {
            mainWindow.webContents.send('open-external-conversation', tid);
          }
        } else if (pathname === '/webview') {
          // 打开webview
          const layout = params.get('layout'); // 0 default 全屏，1半屏
          const httpUrl = params.get('url');
          mainWindow.webContents.send(
            'link_open_webview',
            appId,
            httpUrl,
            layout
          );
        } else if (pathname === '/submit') {
          // 提交数据
          const httpUrl = params.get('url');
          if (httpUrl && mainWindow) {
            mainWindow.webContents.send('external-submit', {
              httpUrl,
              appId,
              cid,
            });
          }
        } else if (pathname === '/miniprogram') {
          const httpUrl = params.get('url');
          // 如果是 workspace 中的应用，直接打开应用就好了
          const existApp = checkExistApp(httpUrl);
          if (existApp && existApp.type === 0 && mainWindow) {
            mainWindow.webContents.send('jump_other_app', {
              app: existApp,
              type: existApp.type,
              jumpUrl: httpUrl,
            });
          } else {
            await shell.openExternal(httpUrl);
          }
        }
      }

      // 本地事件
      if (host === 'localaction') {
        if (pathname === '/groupMeetingDetails') {
          const groupMeetingId = params.get('groupMeetingId');
          const conversationId = params.get('conversationId');
          if (conversationId && mainWindow) {
            if (conversationId !== cid) {
              dialog.showErrorBox(
                '',
                locale.messages.groupMeetingDeniedDetails.message
              );
              return;
            }
            mainWindow.webContents.send('local-action', {
              action: 'groupMeetingDetails',
              groupMeetingId,
              conversationId,
            });
          }
        }
        if (pathname === '/thread') {
          // 打开单人会话或者群会话
          const tid = params.get('tid');
          if (tid && mainWindow) {
            mainWindow.webContents.send('open-external-conversation', tid);
          }
        }
      }
    } else if (protocol === 'difft:') {
      if (host === 'group') {
        if (pathname === '/join') {
          joinGroup(target);
        }
      }
    }
  } catch (e) {
    console.log('main.js handleUrl exception:', e);
  }
}

app.on('will-finish-launching', () => {
  // open-url must be set from within will-finish-launching for macOS
  // https://stackoverflow.com/a/43949291
  app.on('open-url', (event, hrefUrl) => {
    event.preventDefault();
    // 客户端还未启动的情况，先启动客户端
    if (!mainWindow) {
      return;
    }

    // meeting 跳转
    showWindow();
    handleUrl(event, { target: hrefUrl });
  });
});

const appUserModelId = `org.difft.${packageJson.name}`;
console.log('Set Windows Application User Model ID (AUMID)', {
  appUserModelId,
});
app.setAppUserModelId(appUserModelId);

let isBeta = false;
let isBetaSubtitle = false;
let globalTheme = 'system';

// Keep a global reference of the window object, if you don't, the window will
//   be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

function getMainWindow() {
  return mainWindow;
}

// Tray icon and related objects
let tray = null;
const startInTray = process.argv.some(arg => arg === '--start-in-tray');
const usingTrayIcon =
  startInTray || process.argv.some(arg => arg === '--use-tray-icon');

const config = require('./app/config');

// Very important to put before the single instance check, since it is based on the
//   userData directory.
const userConfig = require('./app/user_config');

// 默认开启硬件加速
// 禁用当前应用程序的硬件加速。这个方法只能在应用程序准备就绪（ready）之前调用。
const disableHardware = userConfig.get('disableHardwareAcceleration') || false;
if (disableHardware) {
  app.disableHardwareAcceleration();
}

const importMode =
  process.argv.some(arg => arg === '--import') || config.get('import');

const development = config.environment === 'development';

// We generally want to pull in our own modules after this point, after the user
//   data directory has been set.
const attachments = require('./app/attachments');
const attachmentChannel = require('./app/attachment_channel');
const updater = require('./ts/updater/index');
const createTrayIcon = require('./app/tray_icon');
const ephemeralConfig = require('./app/ephemeral_config');
const logging = require('./app/logging');
const { MainSQL } = require('./ts/sql/sqlMain');
const sqlChannels = require('./app/sql_channel');
const windowState = require('./app/window_state');
const { createTemplate } = require('./app/menu');
const {
  installFileHandler,
  installWebHandler,
} = require('./app/protocol_filter');
const { installPermissionsHandler } = require('./app/permissions');
const OS = require('./ts/OS');
const { spawn } = require('child_process');
const { clearTimeout, clearInterval } = require('timers');
const {
  checkExistApp,
  windowIsAlive,
  browserIsAlive,
} = require('./workspace/utils');
const { handleWorkspace } = require('./workspace');
const { resizeSideBrowser } = require('./workspace/side/side');
const { resizeInsideBrowser } = require('./workspace/webview/webview');
const {
  updateGlobalTheme,
  getIndependentMpWindow,
  getSideBrowser,
  getWebviewBrowser,
  updateLocale,
  updateMainWindow,
} = require('./workspace/globalManager');

const sql = new MainSQL();

function showWindow() {
  if (!mainWindow) {
    return;
  }

  // Using focus() instead of show() seems to be important on Windows when our window
  //   has been docked using Aero Snap/Snap Assist. A full .show() call here will cause
  //   the window to reposition:
  //   https://github.com/signalapp/Signal-Desktop/issues/1429
  if (mainWindow.isVisible()) {
    mainWindow.focus();
  } else {
    mainWindow.show();
  }

  // toggle the visibility of the show/hide tray icon menu entries
  if (tray) {
    tray.updateContextMenu();
  }
}

if (!process.mas) {
  console.log('making app single instance');
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    console.log('quitting; we are the second instance');
    app.exit();
  } else {
    app.on('second-instance', () => {
      // Someone tried to run a second instance, we should focus our window
      if (mainWindow) {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }

        showWindow();
      }
      return true;
    });
  }
}

const windowFromUserConfig = userConfig.get('window');
const windowFromEphemeral = ephemeralConfig.get('window');
let windowConfig = windowFromEphemeral || windowFromUserConfig;
if (windowFromUserConfig) {
  userConfig.set('window', null);
  ephemeralConfig.set('window', windowConfig);
}

const loadLocale = require('./app/locale').load;

// Both of these will be set after app fires the 'ready' event
let logger;
let locale;
let appLocale;

function prepareURL(pathSegments, moreKeys) {
  const buildAt = config.has('buildAt') ? config.get('buildAt') : undefined;

  const CIBuildNumber = config.has('CIBuildNumber')
    ? config.get('CIBuildNumber')
    : undefined;

  const lastCommitSha = config.has('lastCommitSha')
    ? config.get('lastCommitSha')
    : undefined;

  const lastCommitTime = config.has('lastCommitTime')
    ? config.get('lastCommitTime')
    : undefined;

  return url.format({
    pathname: path.join.apply(null, pathSegments),
    protocol: 'file:',
    slashes: true,
    query: {
      systemTheme: nativeTheme.shouldUseDarkColors ? 'dark' : 'light',
      name: packageJson.productName,
      locale: locale.name,
      version: app.getVersion(),
      // approvalAppid: config.get('approvalAppid'),
      // webMeetingURL: config.get('webMeetingURL'),
      buildExpiration: config.get('buildExpiration'),
      certificateAuthority: config.get('certificateAuthority'),
      buildAt,
      CIBuildNumber,
      lastCommitSha,
      lastCommitTime,
      environment: config.environment,
      node_version: process.versions.node,
      hostname: os.hostname(),
      appInstance: process.env.NODE_APP_INSTANCE,
      proxyUrl: process.env.HTTPS_PROXY || process.env.https_proxy,
      platform: process.platform,
      arch: process.arch,
      importMode: importMode ? true : undefined, // for stringify()
      ...moreKeys,
    },
  });
}

function captureClicks(window) {
  window.webContents.on('will-navigate', (event, url) => {
    handleUrl(event, { target: url });
  });
  window.webContents.on('new-window', (event, url) => {
    handleUrl(event, { target: url });
  });
}

const DEFAULT_WIDTH = 1024;
const DEFAULT_HEIGHT = 768;
const MIN_WIDTH = 960;
const MIN_HEIGHT = 680;
const BOUNDS_BUFFER = 100;

function isVisible(window, bounds) {
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
}

async function createWindow() {
  const { screen } = electron;
  const windowOptions = Object.assign(
    {
      show: !startInTray, // allow to start minimised in tray
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT,
      autoHideMenuBar: false,
      backgroundColor: '#ffffff',
      webPreferences: {
        nodeIntegration: false,
        nodeIntegrationInWorker: false,
        contextIsolation: false,
        preload: path.join(__dirname, 'preload.js'),
        nativeWindowOpen: true,
        enableRemoteModule: true,
        sandbox: false,
      },
      icon: path.join(__dirname, 'images', 'icon_256.png'),
      titleBarStyle: 'hidden',
      acceptFirstMouse: true,
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

  if (!_.isNumber(windowOptions.width) || windowOptions.width < MIN_WIDTH) {
    windowOptions.width = DEFAULT_WIDTH;
  }
  if (!_.isNumber(windowOptions.height) || windowOptions.height < MIN_HEIGHT) {
    windowOptions.height = DEFAULT_HEIGHT;
  }
  if (!_.isBoolean(windowOptions.maximized)) {
    delete windowOptions.maximized;
  }
  if (!_.isBoolean(windowOptions.autoHideMenuBar)) {
    delete windowOptions.autoHideMenuBar;
  }

  const visibleOnAnyScreen = _.some(screen.getAllDisplays(), display => {
    if (!_.isNumber(windowOptions.x) || !_.isNumber(windowOptions.y)) {
      return false;
    }

    return isVisible(windowOptions, _.get(display, 'bounds'));
  });
  if (!visibleOnAnyScreen) {
    console.log('Location reset needed');
    delete windowOptions.x;
    delete windowOptions.y;
  }

  if (windowOptions.fullscreen === false) {
    delete windowOptions.fullscreen;
  }

  logger.info(
    'Initializing BrowserWindow config: %s',
    JSON.stringify(windowOptions)
  );

  // Create the browser window.
  mainWindow = new BrowserWindow(windowOptions);
  remoteMain.enable(mainWindow.webContents);

  updateMainWindow(mainWindow);

  function captureAndSaveWindowStats() {
    if (!mainWindow) {
      return;
    }

    const size = mainWindow.getSize();
    const position = mainWindow.getPosition();

    // so if we need to recreate the window, we have the most recent settings
    windowConfig = {
      maximized: mainWindow.isMaximized(),
      autoHideMenuBar: mainWindow.isMenuBarAutoHide(),
      width: size[0],
      height: size[1],
      x: position[0],
      y: position[1],
    };

    if (mainWindow.isFullScreen()) {
      // Only include this property if true, because when explicitly set to
      // false the fullscreen button will be disabled on osx
      windowConfig.fullscreen = true;
    }

    // logger.info(
    //   'Updating BrowserWindow config: %s',
    //   JSON.stringify(windowConfig)
    // );
    ephemeralConfig.set('window', windowConfig);
  }

  const debouncedCaptureStats = _.debounce(captureAndSaveWindowStats, 500);
  mainWindow.on('resize', debouncedCaptureStats);
  mainWindow.on('resize', resizeSideBrowser);
  mainWindow.on('resize', resizeInsideBrowser);
  mainWindow.on('move', debouncedCaptureStats);

  mainWindow.on('focus', () => {
    mainWindow.flashFrame(false);
  });

  // Ingested in preload.js via a sendSync call
  ipc.on('locale-data', event => {
    // eslint-disable-next-line no-param-reassign
    event.returnValue = locale.messages;
  });

  if (config.environment === 'test') {
    mainWindow.loadURL(prepareURL([__dirname, 'test', 'index.html']));
  } else if (config.environment === 'test-lib') {
    mainWindow.loadURL(
      prepareURL([__dirname, 'libtextsecure', 'test', 'index.html'])
    );
  } else {
    mainWindow.loadURL(prepareURL([__dirname, 'background.html']), {
      userAgent: getCustomUserAgent(),
    });
  }

  mainWindow.webContents.session.webRequest.onHeadersReceived(
    { urls: ['*://*/*'] },
    (d, c) => {
      const resHeadersStr = JSON.stringify(Object.keys(d.responseHeaders));
      // 在这里把你想要移除的header头部添加上，代码中已经实现了忽略大小了，所以不用担心匹配不到大小写的问题
      const removeHeaders = ['X-Frame-Options', 'Content-Security-Policy'];
      removeHeaders.forEach(header => {
        const regPattern = new RegExp(header, 'ig');
        const matchResult = resHeadersStr.match(regPattern);
        if (matchResult && matchResult.length) {
          matchResult.forEach(i => {
            delete d.responseHeaders[i];
          });
        }
      });
      c({ cancel: false, responseHeaders: d.responseHeaders });
    }
  );

  if (config.get('openDevTools')) {
    // Open the DevTools.
    mainWindow.webContents.openDevTools();
  }

  captureClicks(mainWindow);

  // Set session scoped UserAgent
  mainWindow.webContents.session.setUserAgent(getCustomUserAgent());

  // 获取权限相关, 先全部放开
  mainWindow.webContents.session.setPermissionRequestHandler(
    (webContents, permission, callback) => {
      callback(true);
    }
  );
  mainWindow.webContents.session.setPermissionCheckHandler(() => {
    return true;
  });

  // Emitted when the window is about to be closed.
  // Note: We do most of our shutdown logic here because all windows are closed by
  //   Electron before the app quits.
  mainWindow.on('close', async e => {
    console.log('close event', {
      readyForShutdown: mainWindow ? mainWindow.readyForShutdown : null,
      shouldQuit: windowState.shouldQuit(),
    });
    // If the application is terminating, just do the default
    if (
      config.environment === 'test' ||
      config.environment === 'test-lib' ||
      (mainWindow.readyForShutdown && windowState.shouldQuit())
    ) {
      return;
    }

    // Prevent the shutdown
    e.preventDefault();

    /**
     * if the user is in fullscreen mode and closes the window, not the
     * application, we need them leave fullscreen first before closing it to
     * prevent a black screen.
     *
     * issue: https://github.com/signalapp/Signal-Desktop/issues/4348
     */

    if (mainWindow.isFullScreen()) {
      mainWindow.once('leave-full-screen', () => mainWindow.hide());
      mainWindow.setFullScreen(false);
    } else {
      mainWindow.hide();
    }

    // On Mac, or on other platforms when the tray icon is in use, the window
    // should be only hidden, not closed, when the user clicks the close button
    if (!windowState.shouldQuit() && (usingTrayIcon || OS.isMacOS())) {
      // toggle the visibility of the show/hide tray icon menu entries
      if (tray) {
        tray.updateContextMenu();
      }

      return;
    }

    await requestShutdown();
    if (mainWindow) {
      mainWindow.readyForShutdown = true;
    }
    await sql.close(true);
    app.quit();
  });

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });

  // BrowserWindow.addDevToolsExtension(
  //   path.join(os.homedir(),
  // eslint-disable-next-line max-len
  //   '/Library/Application Support/Google/Chrome/Default/Extensions/fmkadmapgofadopljbjfkapdkoienihi/4.13.5_0'
  //   ));

  // BrowserWindow.addDevToolsExtension(
  //   path.join(os.homedir(),
  // eslint-disable-next-line max-len
  //   '/Library/Application Support/Google/Chrome/Default/Extensions/lmhkpmbekcpmknklioeibfkpmmfibljd/2.17.2_0'
  //   ));
}

ipc.on('default-user-agent', (event, appId) => {
  // eslint-disable-next-line no-param-reassign
  event.returnValue = getCustomUserAgent(appId);
});

ipc.on('show-window', () => {
  showWindow();
});

let updatesStarted = false;

ipc.on('ready-for-updates', async () => {
  // test reboot button
  // mainWindow.webContents.send('show-update-button');

  if (updatesStarted) {
    return;
  }
  updatesStarted = true;

  try {
    await updater.start(getMainWindow, locale.messages, logger);
  } catch (error) {
    logger.error(
      'Error starting update checks:',
      error && error.stack ? error.stack : error
    );
  }
});

function openReleaseNotes() {
  shell.openExternal(
    `https://github.com/signalapp/Signal-Desktop/releases/tag/v${app.getVersion()}`
  );
}

function openNewBugForm() {
  shell.openExternal('https://github.com/signalapp/Signal-Desktop/issues/new');
}

function openSupportPage() {
  shell.openExternal(
    'https://support.signal.org/hc/en-us/categories/202319038-Desktop'
  );
}

function openForums() {
  shell.openExternal('https://community.signalusers.org/');
}

function setupWithImport() {
  if (mainWindow) {
    mainWindow.webContents.send('set-up-with-import');
  }
}

function setupAsNewDevice() {
  if (mainWindow) {
    mainWindow.webContents.send('set-up-as-new-device');
  }
}

function setupAsStandalone() {
  if (mainWindow) {
    mainWindow.webContents.send('set-up-as-standalone');
  }
}

let aboutWindow;

async function showAbout() {
  const theme = globalTheme;
  if (aboutWindow) {
    aboutWindow.show();
    return;
  }

  const options = {
    width: 540,
    height: 380,
    resizable: false,
    title: locale.messages.aboutSignalDesktop.message,
    autoHideMenuBar: true,
    backgroundColor: '#2090EA',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      contextIsolation: false,
      preload: path.join(__dirname, 'about_preload.js'),
      nativeWindowOpen: true,
      enableRemoteModule: true,
      sandbox: false,
    },
    acceptFirstMouse: true,
    // parent: mainWindow,
    fullscreenable: false,
    minimizable: false,
    maximizable: false,
    titleBarStyle: 'hidden',
  };

  aboutWindow = new BrowserWindow(options);
  remoteMain.enable(aboutWindow.webContents);

  captureClicks(aboutWindow);

  aboutWindow.loadURL(prepareURL([__dirname, 'about.html'], { theme }));

  aboutWindow.on('closed', () => {
    aboutWindow = null;
  });

  aboutWindow.once('ready-to-show', () => {
    aboutWindow.show();
  });
}

ipc.on('main-window-openDevTools', () => {
  if (mainWindow) {
    mainWindow.webContents.openDevTools();
  }
  if (callVoiceWindowGroup) {
    callVoiceWindowGroup.webContents.openDevTools();
  }
});

let webApiUrlCache;
let groupMeetingChannelName;
let callVoiceWindowGroup;
let callVoiceWindowGroupSystemClose = true;

async function showCallVoiceGroupWindow(info) {
  // linux meeting use web meeting
  if (process.platform === 'linux') {
    let { channelName, meetingName, groupMembers } = info;
    if (!channelName) {
      channelName =
        (info.isPrivate ? 'P-' : 'I-') +
        Buffer.from(customUUID()).toString('base64');
    }
    if (!meetingName) {
      meetingName = 'Chative Meeting';
    }

    // open it in workspace app
    let target = 'https://webmeeting.chative.im/?v=1&meetingname=';
    if (packageJson.productName === 'ChativeTest') {
      target = 'https://webmeeting.test.chative.im/?v=1&meetingname=';
    }
    target +=
      betterEncodeURIComponent(meetingName) +
      '&channelname=' +
      betterEncodeURIComponent(channelName);

    let invite = '';
    if (info.id && channelName.startsWith('P-')) {
      invite = info.id.replace('+', '');
    }
    if (channelName.startsWith('I-')) {
      if (Array.isArray(groupMembers)) {
        groupMembers.forEach(item => {
          if (!item.self) {
            if (invite) {
              invite += '-' + item.id.replace('+', '');
            } else {
              invite += item.id.replace('+', '');
            }
          }
        });
      }
    }
    if (invite) {
      target += '&invite=' + invite;
    }
    handleUrl(null, { target });

    // 1. Instant meeting, should send notify message
    if (channelName.startsWith('I-')) {
      const joinUrl =
        'chative://meeting?v=1' +
        `&meetingname=${betterEncodeURIComponent(meetingName)}` +
        `&channelname=${betterEncodeURIComponent(channelName)}` +
        `&meetingId=0`;

      const message = `invited you to "${meetingName}", [click to join the meeting](${joinUrl})`;

      // 即时会议通知
      if (Array.isArray(groupMembers)) {
        groupMembers.forEach(item => {
          if (!item.self) {
            mainWindow?.webContents.send('voiceSendMessage', {
              id: item.id,
              message,
              callAction: 'RING_GROUP',
              meetingName,
              channelName,
              markdown: true,
            });
          }
        });
      }
    }
    return;
  }

  callVoiceWindowGroupSystemClose = true;
  if (callVoiceWindowGroup) {
    if (callVoiceWindowGroup.isVisible()) {
      callVoiceWindowGroup.show();
    }
    if (callVoiceWindowGroup.isMinimized()) {
      callVoiceWindowGroup.restore();
    }
    return;
  }

  groupMeetingChannelName = info.channelName;
  const theme = globalTheme;

  const options = {
    width: 1024,
    height: 768,
    minWidth: 1024,
    minHeight: 768,
    autoHideMenuBar: true,
    backgroundColor: '#181A20',
    show: true,
    webPreferences: {
      nodeIntegration: true,
      nodeIntegrationInWorker: false,
      contextIsolation: false,
      preload: path.join(__dirname, 'meeting_preload.js'),
      nativeWindowOpen: true,
      enableRemoteModule: true,
      sandbox: false,
    },
    acceptFirstMouse: true,
    // fullscreenable: false,
    titleBarStyle: 'hidden',
  };

  callVoiceWindowGroup = new BrowserWindow(options);

  captureClicks(callVoiceWindowGroup);

  const tempInfo = { ...info, isBetaSubtitle };
  delete tempInfo.groupMembers;

  callVoiceWindowGroup.loadURL(
    prepareURL([__dirname, 'meeting.html'], {
      theme,
      ...tempInfo,
      webApiUrlCache,
    })
  );

  callVoiceWindowGroup.on('close', e => {
    if (callVoiceWindowGroupSystemClose) {
      e.preventDefault();
      callVoiceWindowGroup.webContents.send('system-close');
    }
  });

  callVoiceWindowGroup.on('closed', () => {
    groupMeetingChannelName = null;
    callVoiceWindowGroup = null;
    if (floatingBarWindow) {
      floatingBarWindow.hide();
    }
  });

  // callVoiceWindowGroup.once('ready-to-show', () => {
  //   callVoiceWindowGroup.show();
  // });

  // 页面加载完成后，发送群成员数据（必须是主叫情况下）。
  if (info.groupMembers) {
    callVoiceWindowGroup.webContents.on('did-finish-load', () => {
      callVoiceWindowGroup.webContents.send('group-members', info);
    });
  }

  callVoiceWindowGroup.on('enter-full-screen', () => {
    callVoiceWindowGroup.webContents.send('full-screen-state', true);
  });

  callVoiceWindowGroup.on('leave-full-screen', () => {
    callVoiceWindowGroup.webContents.send('full-screen-state', false);
  });

  if (development) {
    callVoiceWindowGroup.webContents.openDevTools();
  }
}

let settingsWindow;

function showSettingsWindow() {
  if (!mainWindow) {
    return;
  }
  mainWindow.webContents.send('event-open-user-setting');
}

let debugLogWindow;

async function showDebugLogWindow() {
  if (debugLogWindow) {
    debugLogWindow.show();
    return;
  }

  const theme = globalTheme;
  const size = mainWindow.getSize();
  const options = {
    width: Math.max(size[0] - 100, MIN_WIDTH),
    height: Math.max(size[1] - 100, MIN_HEIGHT),
    resizable: false,
    title: locale.messages.signalDesktopPreferences.message,
    autoHideMenuBar: true,
    backgroundColor: '#FFFFFF',
    show: false,
    modal: true,
    webPreferences: {
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      contextIsolation: false,
      preload: path.join(__dirname, 'debug_log_preload.js'),
      nativeWindowOpen: true,
      enableRemoteModule: true,
      sandbox: false,
    },
    acceptFirstMouse: true,
    parent: mainWindow,
  };

  debugLogWindow = new BrowserWindow(options);

  captureClicks(debugLogWindow);

  debugLogWindow.loadURL(prepareURL([__dirname, 'debug_log.html'], { theme }));

  debugLogWindow.on('closed', () => {
    removeDarkOverlay();
    debugLogWindow = null;
  });

  debugLogWindow.once('ready-to-show', () => {
    addDarkOverlay();
    debugLogWindow.show();
  });
}

let permissionsPopupWindow;

async function showPermissionsPopupWindow() {
  if (permissionsPopupWindow) {
    permissionsPopupWindow.show();
    return;
  }
  if (!mainWindow) {
    return;
  }

  const theme = globalTheme;
  const size = mainWindow.getSize();
  const options = {
    width: Math.min(400, size[0]),
    height: Math.min(150, size[1]),
    resizable: false,
    title: locale.messages.signalDesktopPreferences.message,
    autoHideMenuBar: true,
    backgroundColor: '#FFFFFF',
    show: false,
    modal: true,
    webPreferences: {
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      contextIsolation: false,
      preload: path.join(__dirname, 'permissions_popup_preload.js'),
      nativeWindowOpen: true,
      enableRemoteModule: true,
      sandbox: false,
    },
    acceptFirstMouse: true,
    parent: mainWindow,
  };

  permissionsPopupWindow = new BrowserWindow(options);

  captureClicks(permissionsPopupWindow);

  permissionsPopupWindow.loadURL(
    prepareURL([__dirname, 'permissions_popup.html'], { theme })
  );

  permissionsPopupWindow.on('closed', () => {
    removeDarkOverlay();
    permissionsPopupWindow = null;
  });

  permissionsPopupWindow.once('ready-to-show', () => {
    addDarkOverlay();
    permissionsPopupWindow.show();
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
let ready = false;
let BC_SESSION;
let GSUITE_SESSION;
app.on('ready', async () => {
  BC_SESSION = session.fromPartition('persist:beyondCorp', { cache: true });
  GSUITE_SESSION = session.fromPartition('persist:gsuite', { cache: true });

  const userDataPath = await getRealPath(app.getPath('userData'));
  const installPath = await getRealPath(app.getAppPath());

  if (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'test-lib') {
    installFileHandler({
      protocol: electronProtocol,
      userDataPath,
      installPath,
      isWindows: process.platform === 'win32',
    });
  }

  installWebHandler({
    protocol: electronProtocol,
  });

  installPermissionsHandler({ session, userConfig });

  await logging.initialize();
  logger = logging.getLogger();
  logger.info('app ready, disableHardwareAcceleration:', disableHardware);
  logger.info(`starting version ${packageJson.version}`);
  logger.info(`starting command line:${JSON.stringify(process.argv)}`);

  const { watchFileChange } = require('./ts/util/appChangeWatcher');
  const mainExePath = await getRealPath(app.getPath('exe'));
  watchFileChange(mainExePath, path => {
    logger.warn('app file changes detected', path);

    const response = dialog.showMessageBoxSync({
      buttons: ['Relaunch', 'Quit'],
      defaultId: 0,
      message:
        'App version changes detected, please relaunch or quit the application!',
      noLink: true,
      type: 'error',
    });

    logger.warn('click index(0-relaunch, 1-quit):', response);

    if (response === 0) {
      app.relaunch();
    }

    app.quit();
  });

  if (!locale) {
    // 中文测试
    // const appLocale = 'zh-CN'
    // const appLocale = process.env.NODE_ENV === 'test' ? 'en' : app.getLocale();
    const language = app.getLocale() === 'zh-CN' ? 'zh-CN' : 'en';
    appLocale = userConfig.get('userLanguage') || language;
    locale = loadLocale({ appLocale, logger });
    updateLocale(locale);
  }

  GlobalErrors.updateLocale(locale.messages);

  let key = userConfig.get('key');
  if (!key) {
    console.log(
      'key/initialize: Generating new encryption key, since we did not find it on disk'
    );
    // https://www.zetetic.net/sqlcipher/sqlcipher-api/#key
    key = crypto.randomBytes(32).toString('hex');
    userConfig.set('key', key);
  }

  try {
    await sql.initialize({ configDir: userDataPath, key, logger });
  } catch (error) {
    console.log('sqlMain.initialize was unsuccessful; returning early');
    onDatabaseError(error);
    return;
  }

  sqlChannels.initialize(sql);

  try {
    const IDB_KEY = 'indexeddb-delete-needed';
    const item = await sql.sqlCallEasy('getItemById', IDB_KEY);
    if (item && item.value) {
      await sql.removeIndexedDBFiles();
      await sql.sqlCallEasy('removeItemById', IDB_KEY);
    }
  } catch (error) {
    console.log(
      '(ready event handler) error deleting IndexedDB:',
      error && error.stack ? error.stack : error
    );
  }

  async function cleanupOrphanedAttachments() {
    const allAttachments = await attachments.getAllAttachments(userDataPath);

    const orphanedAttachments = await sql.sqlCallEasy(
      'removeKnownAttachments',
      allAttachments
    );

    // TODO:// current do not delete files
    // await attachments.deleteAll({
    //   userDataPath,
    //   attachments: orphanedAttachments,
    // });
  }

  await attachmentChannel.initialize({
    configDir: userDataPath,
    cleanupOrphanedAttachments,
  });

  ready = true;

  createWindow();

  if (usingTrayIcon) {
    tray = createTrayIcon(getMainWindow, locale.messages);
  }

  setupMenu();
});

async function onDatabaseError(error) {
  const { response: buttonIndex } = dialog.showMessageBoxSync({
    buttons: [
      locale.messages.copyErrorAndQuit.message,
      // locale.messages.deleteAndRestart.message,
    ],
    defaultId: 0,
    detail: redactAll(error?.message || error.stack),
    message: locale.messages.databaseError.message,
    noLink: true,
    type: 'error',
  });

  if (buttonIndex === 0) {
    clipboard.writeText(`Database startup error:\n\n${redactAll(error.stack)}`);
  } else {
    try {
      await sql.close(true);
    } catch (error) {
      console.log(
        'close db failed when database error.',
        error?.stack || error?.message
      );
    }

    // await removeDB();
    // removeUserConfig();
    // app.relaunch();
  }

  app.exit(1);
}

// 手动检查更新
async function manualCheckForUpdates() {
  try {
    await updater.manualCheckForUpdates(getMainWindow, locale.messages, logger);
  } catch (error) {
    const errorMessage = error?.message || error?.stack;

    console.log('manualCheckForUpdates exception', errorMessage);

    const options = {
      type: 'info',
      buttons: ['Ok'],
      message: errorMessage,
      defaultId: 0,
    };

    await dialog.showMessageBox(mainWindow, options);
  }
}

function setupMenu(options) {
  const { platform } = process;
  const menuOptions = Object.assign({}, options, {
    development,
    // showDebugLog: showDebugLogWindow,
    showWindow,
    showAbout,
    showSettings: showSettingsWindow,
    openReleaseNotes,
    openNewBugForm,
    openSupportPage,
    openForums,
    platform,
    setupWithImport,
    setupAsNewDevice,
    setupAsStandalone,
    manualCheckForUpdates,
  });
  const template = createTemplate(menuOptions, locale.messages);
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

async function requestShutdown() {
  if (!mainWindow || !mainWindow.webContents) {
    return;
  }

  console.log('requestShutdown: Requesting close of mainWindow...');
  const request = new Promise((resolve, reject) => {
    ipc.once('now-ready-for-shutdown', (_event, error) => {
      console.log('requestShutdown: Response received');

      if (error) {
        return reject(error);
      }

      return resolve();
    });
    mainWindow.webContents.send('get-ready-for-shutdown');

    // We'll wait two minutes, then force the app to go down. This can happen if someone
    //   exits the app before we've set everything up in preload() (so the browser isn't
    //   yet listening for these events), or if there are a whole lot of stacked-up tasks.
    // Note: two minutes is also our timeout for SQL tasks in data.js in the browser.
    setTimeout(() => {
      console.log(
        'requestShutdown: Response never received; forcing shutdown.'
      );
      resolve();
    }, 2 * 60 * 1000);
  });

  try {
    await request;
  } catch (error) {
    console.log(
      'requestShutdown error:',
      error && error.stack ? error.stack : error
    );
  }
}

app.on('before-quit', () => {
  console.log('before-quit event', {
    readyForShutdown: mainWindow ? mainWindow.readyForShutdown : null,
    shouldQuit: windowState.shouldQuit(),
  });

  windowState.markShouldQuit();
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // 偶尔会出现无法退出情况，多人语音页面直接CMD+Q
  app.quit();

  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (
    process.platform !== 'darwin' ||
    config.environment === 'test' ||
    config.environment === 'test-lib'
  ) {
    app.quit();
  }
});

app.on('activate', () => {
  if (!ready) {
    return;
  }

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow) {
    mainWindow.show();
  } else {
    // create window only is not quiting
    if (windowState.shouldQuit()) {
      console.log('app is quiting, do not re-create window when activate');
    } else {
      createWindow();
    }
  }

  // if callVoiceGroup exist, show it first
  if (callVoiceWindowGroup) {
    // 若窗口还未 ready-to-show 时调用show()方法， 则不会触发ready-to-show
    if (callVoiceWindowGroup.isVisible()) {
      callVoiceWindowGroup.show();
    }
    if (callVoiceWindowGroup.isMinimized()) {
      callVoiceWindowGroup.restore();
    }
  }
});

// Defense in depth. We never intend to open webviews or windows. Prevent it completely.
app.on('web-contents-created', (createEvent, contents) => {
  contents.on('will-attach-webview', attachEvent => {
    attachEvent.preventDefault();
  });
  contents.on('new-window', newEvent => {
    newEvent.preventDefault();
  });
});

let badgeCount = 0;
ipc.on('set-badge-count', (event, count) => {
  app.setBadgeCount(count);
  badgeCount = count;
});
ipc.on('query-badge-count', () => {
  if (mainWindow) {
    mainWindow.webContents.send('query-badge-count', badgeCount);
  }
});

ipc.on('remove-setup-menu-items', () => {
  setupMenu();
});

ipc.on('add-setup-menu-items', () => {
  setupMenu({
    includeSetup: true,
  });
});

ipc.on('draw-attention', () => {
  if (!mainWindow) {
    return;
  }
  if (process.platform === 'darwin') {
    // app.dock.bounce();
  } else if (process.platform === 'win32') {
    mainWindow.flashFrame(true);
  } else if (process.platform === 'linux') {
    mainWindow.flashFrame(true);
  }
});

ipc.on('restart', () => {
  app.relaunch();
  app.quit();
});

ipc.on('set-auto-hide-menu-bar', (event, autoHide) => {
  if (mainWindow) {
    mainWindow.setAutoHideMenuBar(autoHide);
  }
});

ipc.on('set-menu-bar-visibility', (event, visibility) => {
  if (mainWindow) {
    mainWindow.setMenuBarVisibility(visibility);
  }
});

// eslint-disable-next-line no-shadow
ipc.on('show-call-voice-group', async (event, info) => {
  if (callVoiceWindowGroup) {
    // 若窗口还未 ready-to-show 时调用show()方法， 则不会触发ready-to-show
    if (callVoiceWindowGroup.isVisible()) {
      callVoiceWindowGroup.show();
    }
    if (callVoiceWindowGroup.isMinimized()) {
      callVoiceWindowGroup.restore();
    }
    return;
  }

  if (info.isPrivate) {
    // 1v1 计时按钮快速入会（对方切换成群模式后）
    let { callerId } = info;
    if (info.callType === 'passive' && callerId) {
      await showCallVoiceGroupWindow({
        ...info,
        // meetingName: `+${callerId}`,
        id: callerId,
        callType: 'passive',
        channelName: info.channelName,
      });
      return;
    }

    // 如果已经有incoming call直接接通
    let shouldAcceptWindow;
    let channelName;
    incomingCallWindows.forEach((win, c) => {
      const winCallerId = win.caller.replace('mac', '').replace('ios', '');
      if (win.isPrivate && winCallerId === info.id.replace('+', '')) {
        shouldAcceptWindow = win;
        channelName = c;
      }
    });

    if (shouldAcceptWindow) {
      shouldAcceptWindow.close();
      return;
    }
  } else {
    // 发起多人会议需要二次确认，若groupMembers只有一个人是拉自己入会的情况，不需要弹框
    // eslint-disable-next-line no-lonely-if
    if (info.groupMembers && info.groupMembers.length > 1) {
      // const options = {
      //   type: 'info',
      //   buttons: [locale.messages.ok.message, locale.messages.cancel.message],
      //   message: 'Group Meeting',
      //   detail: 'Start a group meeting now?',
      // };
      //
      // const dialogRes = await dialog.showMessageBox(mainWindow, options);
      // // click OK button
      // if (dialogRes && dialogRes.response === 0) {
      //   await showCallVoiceGroupWindow(info);
      // }

      await showCallVoiceGroupWindow(info);
      return;
    }

    // 需要二次确认框
    // const options = {
    //   type: 'info',
    //   buttons: [locale.messages.ok.message, locale.messages.cancel.message],
    //   message: locale.messages.join_meeting_confirm_title.message,
    //   detail: locale.messages.join_meeting_confirm.message,
    // };
    // const confirmRes = await dialog.showMessageBox(mainWindow, options);
    // if (confirmRes && confirmRes.response === 0) {
    //   await showCallVoiceGroupWindow(info);
    //   return;
    // }

    await showCallVoiceGroupWindow(info);
    return;
  }

  await showCallVoiceGroupWindow(info);
});

ipc.on('close-call-voice-group', () => {
  if (callVoiceWindowGroup) {
    callVoiceWindowGroupSystemClose = false;
    callVoiceWindowGroup.close();
  }
});

ipc.on('meeting-window-max-min', () => {
  if (callVoiceWindowGroup && !callVoiceWindowGroup.isDestroyed()) {
    if (callVoiceWindowGroup.isFullScreen()) {
      callVoiceWindowGroup.setFullScreen(false);
    } else {
      callVoiceWindowGroup.setFullScreen(true);
    }
  }
});

// 将callWindow窗口数据转发到rtm窗口
ipc.on('rtm-method', (event, info) => {
  logger.info('main.js rtm-method:', info);
});

// 将rtm窗口数据转发到callWindow窗口
ipc.on('rtm-notify', (event, info) => {
  logger.info('main.js rtm-notify:', info);

  // 1v1被叫取消或出错, 关闭对应的incoming窗口
  if (info.event === 'remote-cancel' || info.event === 'failure') {
    const win = incomingCallWindows.get(info.channelName);
    if (win) {
      win.close();
    }
    return;
  }

  if (callVoiceWindowGroup) {
    callVoiceWindowGroup.webContents.send('rtm-notify', info);
  }
});

ipc.on('mute-other', (_, info) => {
  if (callVoiceWindowGroup) {
    callVoiceWindowGroup.webContents.send('mute-other', info);
  }
});

ipc.on('search-user', (event, info) => {
  if (mainWindow) {
    mainWindow.webContents.send('search-user', info);
  }
});

ipc.on('search-user-reply', (event, info) => {
  if (callVoiceWindowGroup) {
    callVoiceWindowGroup.webContents.send('search-user', info);
  }
  incomingCallWindows.forEach(win => {
    win.webContents.send('search-user', info);
  });
});

ipc.on('meeting-status', (event, info) => {
  logger.info('main.js meeting-status:', info);
  if (mainWindow) {
    mainWindow.webContents.send('meeting-status', info);
  } else {
    logger.info('main.js meeting-status mainWindow NOT EXIST!');
  }
  // if (
  //   callVoiceWindowGroup &&
  //   (info.event === 'create' || info.event === 'change') &&
  //   info.room
  // ) {
  //   callVoiceWindowGroup.webContents.send('update-meeting-user-count', {
  //     channelName: info.room.channelName,
  //     count: info.room.online,
  //   });
  // }
});

ipc.on('meeting-close', (event, info) => {
  logger.info('main.js meeting-close:', info);
  if (!mainWindow) {
    logger.info('main.js meeting-close mainWindow NOT EXIST!');
    return;
  }
  // meeting feedback
  if (info && info.channelName && info.channelName.startsWith('G-')) {
    mainWindow.webContents.send('meeting-feedback', info.channelName);
  }

  // destroy the meeting bar immediately (NOT group)
  if (info && info.channelName && !info.otherPeer) {
    const tempInfo = {
      event: 'destroy',
      room: {
        channelName: info.channelName,
      },
    };
    // G-开头的频道处理
    if (info.channelName.startsWith('G-')) {
      tempInfo.room.meetingType = 'group';
      mainWindow.webContents.send(
        'meeting-status-destroy-if-not-exist',
        tempInfo
      );
    } else {
      tempInfo.room.meetingType = 'private';
      mainWindow.webContents.send('meeting-status', tempInfo);
      tempInfo.room.meetingType = 'instant';
      mainWindow.webContents.send('meeting-status', tempInfo);
      tempInfo.room.meetingType = 'external';
      mainWindow.webContents.send('meeting-status', tempInfo);
    }
  }
});

ipc.on('start-meeting', (event, info) => {
  logger.info('main.js start-meeting:', info);
  if (mainWindow) {
    mainWindow.webContents.send('start-meeting', info);
  } else {
    logger.info('main.js start-meeting mainWindow NOT EXIST!');
  }
});

ipc.on('join-meeting-bar', (event, info) => {
  logger.info('main.js join-meeting-bar:', info);
  if (mainWindow) {
    mainWindow.webContents.send('join-meeting-bar', info);
  } else {
    logger.info('main.js join-meeting-bar mainWindow NOT EXIST!');
  }
});

ipc.on('schedule-meeting-popup', async (event, info) => {
  logger.info('main.js schedule-meeting-popup:', info);
  if (incomingCallWindows.has(info.channelName)) {
    logger.info(
      'main.js schedule-meeting-popup channelName already exist:',
      info.channelName
    );
    return;
  }
  if (info.channelName === groupMeetingChannelName) {
    logger.info(
      'main.js schedule-meeting-popup groupMeetingChannelName already exist:',
      info.channelName
    );
    return;
  }
  await showScheduleCallWindow(info);
});

// FOR DEBUG
// setTimeout(async () => {
//   await showScheduleCallWindow({
//     host: '+21152',
//     meetingName: 'x asdflkjasdf',
//     channelName: 'S-alsdjfkAAA',
//     lasting: 999999,
//   });
//   await showIncomingCallWindow({
//     meetingName: 'x asdflkjasdf',
//     channelName: 'S-alsdjfkAAA',
//     caller: '+10000',
//     isPrivate: true
//   });
// }, 8000);

let last_meeting_channel_info;
ipc.on('listen-rtm-channel', (event, info) => {
  last_meeting_channel_info = undefined;
  if (info && info.channelName) {
    last_meeting_channel_info = info;
  }
  logger.info('main.js listen-rtm-channel:', info);
});

ipc.on('request-join-rtm-channel', () => {
  logger.info('main.js request-join-rtm-channel');
});
ipc.on('meeting-version-low-warning', () => {
  mainWindow.webContents.send('meeting-version-low-warning');
});

ipc.on('send-rtm-message', (event, info) => {
  logger.info('main.js send-rtm-message:', info);
});

ipc.on('receive-rtm-message', (event, info) => {
  logger.info('main.js receive-rtm-message:', info);
  if (callVoiceWindowGroup) {
    callVoiceWindowGroup.webContents.send('receive-rtm-message', info);
  }
});

// ipc.on('update-channel-users', (event, info) => {
//   logger.info('main.js update-channel-users:', info);
//   if (callVoiceWindowGroup) {
//     callVoiceWindowGroup.webContents.send('update-channel-users', info);
//   }
// });

ipc.on('call-message', (event, info) => {
  logger.info('main.js call-message:', info);
  if (mainWindow) {
    mainWindow.webContents.send('voiceSendMessage', info);
  } else {
    logger.info('main.js call-message mainWindow NOT EXIST!');
  }
});

ipc.on('close-about', () => {
  if (aboutWindow) {
    aboutWindow.close();
  }
});

ipc.on('update-tray-icon', (event, unreadCount) => {
  if (tray) {
    tray.updateIcon(unreadCount);
  }
});

// Debug Log-related IPC calls

ipc.on('show-debug-log', showDebugLogWindow);
ipc.on('close-debug-log', () => {
  if (debugLogWindow) {
    debugLogWindow.close();
  }
});

// Permissions Popup-related IPC calls

ipc.on('show-permissions-popup', showPermissionsPopupWindow);
ipc.on('close-permissions-popup', () => {
  if (permissionsPopupWindow) {
    permissionsPopupWindow.close();
  }
});

// Settings-related IPC calls

function addDarkOverlay() {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('add-dark-overlay');
  }
}

function removeDarkOverlay() {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('remove-dark-overlay');
  }
}

ipc.on('show-settings', showSettingsWindow);
ipc.on('show-about', showAbout);
ipc.on('manual-check-for-updates', manualCheckForUpdates);
ipc.on('close-settings', () => {
  if (settingsWindow) {
    settingsWindow.close();
  }
});

// ipc.on('our-profile-change', () => {
//   if (settingsWindow) {
//     settingsWindow.webContents.send('our-profile-change');
//   }
// });

ipc.on(
  'open-add-meeting-members',
  async (
    event,
    channelName,
    meetingName,
    meetingId,
    meetingKey,
    meetingVersion
  ) => {
    logger.info('main.js open-add-meeting-members channelName:' + channelName);
    logger.info('main.js open-add-meeting-members meetingName:' + meetingName);
    logger.info('main.js open-add-meeting-members meetingId:' + meetingId);
    logger.info('main.js open-add-meeting-members meetingKey:' + meetingKey);
    logger.info(
      'main.js open-add-meeting-members meetingVersion:' + meetingVersion
    );
    if (mainWindow) {
      mainWindow.webContents.send('open-add-meeting-members', {
        channelName,
        meetingName,
        meetingId,
        meetingKey,
        meetingVersion,
      });
      showWindow();
    } else {
      logger.info('main.js open-add-meeting-members mainWindow NOT EXIST!');
    }
  }
);

ipc.on(
  'add-meeting-members',
  (
    event,
    members,
    channelName,
    meetingName,
    meetingId,
    meetingKey,
    meetingVersion
  ) => {
    if (members && members.length && channelName) {
      if (mainWindow) {
        const instantMeetingName = meetingName || 'Instant meeting';

        const joinUrl =
          'chative://meeting?v=1' +
          `&meetingname=${betterEncodeURIComponent(instantMeetingName)}` +
          `&channelname=${betterEncodeURIComponent(channelName)}` +
          (meetingId
            ? `&meetingid=${betterEncodeURIComponent(meetingId)}`
            : '');

        const message = `invited you to "${instantMeetingName}", [click to join the meeting](${joinUrl})`;
        members.forEach(item => {
          mainWindow.webContents.send('voiceSendMessage', {
            id: item,
            message,
            callAction: 'RING',
            meetingName: instantMeetingName,
            channelName,
            markdown: true,
          });
        });
      }

      if (callVoiceWindowGroup) {
        // 若窗口还未 ready-to-show 时调用show()方法， 则不会触发ready-to-show
        if (callVoiceWindowGroup.isVisible()) {
          callVoiceWindowGroup.show();
        }
        if (callVoiceWindowGroup.isMinimized()) {
          callVoiceWindowGroup.restore();
        }
      }
    }
  }
);

ipc.on('focus-meeting-window', () => {
  if (callVoiceWindowGroup) {
    if (callVoiceWindowGroup.isVisible()) {
      callVoiceWindowGroup.show();
    }
    if (callVoiceWindowGroup.isMinimized()) {
      callVoiceWindowGroup.restore();
    }
  }
});

ipc.on('instant-meeting', async (event, members, meetingName) => {
  if (!members || !members.length) {
    return;
  }

  if (callVoiceWindowGroup) {
    // 若窗口还未 ready-to-show 时调用show()方法， 则不会触发ready-to-show
    if (callVoiceWindowGroup.isVisible()) {
      callVoiceWindowGroup.show();
    }
    if (callVoiceWindowGroup.isMinimized()) {
      callVoiceWindowGroup.restore();
    }
    return;
  }

  const groupMembers = [];
  members.forEach(item => {
    groupMembers.push({
      self: false,
      id: item,
    });
  });

  await showCallVoiceGroupWindow({
    isPrivate: false,
    groupMembers,
    meetingName: meetingName || 'Instant Meeting',
    // channelName: '', 临时会议不要传channelName字段，多人语音页面做区分处理
  });
});

installSettingsGetter('device-name');

installSettingsGetter('theme-setting');
installSettingsGetter('system-theme');
installSettingsSetter('theme-setting');
installSettingsGetter('hide-menu-bar');
installSettingsSetter('hide-menu-bar');

installSettingsGetter('notification-setting');
installSettingsSetter('notification-setting');
installSettingsGetter('audio-notification');
installSettingsSetter('audio-notification');

installSettingsGetter('spell-check');
installSettingsSetter('spell-check');

installSettingsGetter('quit-topic-setting');
installSettingsSetter('quit-topic-setting');

// This one is different because its single source of truth is userConfig, not IndexedDB
ipc.on('get-media-permissions', event => {
  event.sender.send(
    'get-success-media-permissions',
    null,
    userConfig.get('mediaPermissions') || false
  );
});
ipc.on('set-media-permissions', (event, value) => {
  userConfig.set('mediaPermissions', value);

  // We reinstall permissions handler to ensure that a revoked permission takes effect
  installPermissionsHandler({ session, userConfig });

  event.sender.send('set-success-media-permissions', null);
});

ipc.on('get-disable-hardware-acceleration', event => {
  event.sender.send(
    'get-success-disable-hardware-acceleration',
    null,
    userConfig.get('disableHardwareAcceleration') || false
  );
});
ipc.on('get-original-disable-hardware-acceleration', event => {
  event.sender.send(
    'get-success-original-disable-hardware-acceleration',
    null,
    disableHardware
  );
});
ipc.on('set-disable-hardware-acceleration', (event, value) => {
  userConfig.set('disableHardwareAcceleration', value);
  event.sender.send('set-success-disable-hardware-acceleration', null);
});
ipc.on('set-user-language', (event, value) => {
  userConfig.set('userLanguage', value);
});
ipc.on('get-language', event => {
  const result = app.getLocale() === 'zh-CN' ? 'zh-CN' : 'en';
  const language = userConfig.get('userLanguage') || result;
  event.sender.send('get-success-language', null, language);
});
ipc.on('get-original-language', event => {
  event.sender.send('get-success-original-language', null, appLocale);
});

installSettingsGetter('is-primary');
// installSettingsGetter('sync-request');
// installSettingsGetter('sync-time');
// installSettingsSetter('sync-time');

ipc.on('delete-all-data', async () => {
  // if (mainWindow && mainWindow.webContents) {
  //   mainWindow.webContents.send('delete-all-data');
  // }

  const options = {
    type: 'info',
    buttons: ['Yes', 'Cancel'],
    message: 'Logout',
    detail: 'Log out of the current account now?',
    defaultId: 0,
  };

  const dialogRes = await dialog.showMessageBox(mainWindow, options);
  if (dialogRes?.response === 0) {
    try {
      if (!mainWindow?.webContents) {
        throw new Error('mainWindow is not avaliable!');
      }

      mainWindow.webContents.send('unlink-current-device');
    } catch (err) {
      console.error('logout failed', formatError(err));
      dialog.showErrorBox('Logout', 'Failed, please try again!');
    }
  }
});

function getDataFromMainWindow(name, callback) {
  ipc.once(`get-success-${name}`, (_event, error, value) =>
    callback(error, value)
  );
  mainWindow.webContents.send(`get-${name}`);
}

function installSettingsGetter(name) {
  ipc.on(`get-${name}`, event => {
    // 获取操作系统主题
    if (name === 'system-theme') {
      const contents = event.sender;
      if (contents.isDestroyed()) {
        return;
      }
      const systemTheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
      contents.send(`get-success-${name}`, undefined, systemTheme);
      return;
    }

    if (mainWindow && mainWindow.webContents) {
      getDataFromMainWindow(name, (error, value) => {
        const contents = event.sender;
        if (contents.isDestroyed()) {
          return;
        }

        contents.send(`get-success-${name}`, error, value);
      });
    }
  });
}

function changeTheme(name, value) {
  globalTheme = value;
  if (mainWindow) {
    mainWindow.webContents.send(`set-${name}`, value);
  }
  if (aboutWindow) {
    aboutWindow.webContents.send(`set-${name}`, value);
  }
  if (callVoiceWindowGroup) {
    callVoiceWindowGroup.webContents.send(`set-${name}`, value);
  }
  if (incomingCallWindows) {
    incomingCallWindows.forEach(item => {
      item.webContents.send(`set-${name}`, value);
    });
  }
  if (localSearchWindow) {
    localSearchWindow.webContents.send(`set-${name}`, value);
  }
  if (floatingBarWindow) {
    floatingBarWindow.webContents.send(`set-${name}`, value);
  }
  if (settingsWindow) {
    settingsWindow.webContents.send(`set-${name}`, value);
  }

  // update workspace globalTheme
  updateGlobalTheme(value);

  // independent window
  const openWindows = getIndependentMpWindow();
  if (openWindows) {
    openWindows.forEach(window => {
      if (windowIsAlive(window)) {
        window.webContents.send(`on_theme_change`, { theme: value });
      }
    });
  }

  // side browser view
  const sideBrowserView = getSideBrowser();
  if (sideBrowserView) {
    const { header } = sideBrowserView || {};
    if (browserIsAlive(header)) {
      header.webContents.send(`on_theme_change`, value);
    }
  }

  // inside browser view
  const webviewBrowser = getWebviewBrowser();
  if (webviewBrowser) {
    const { header } = webviewBrowser || {};
    if (browserIsAlive(header)) {
      header.webContents.send(`on_theme_change`, value);
    }
  }
}

function installSettingsSetter(name) {
  ipc.on(`set-${name}`, (event, value) => {
    if (mainWindow && mainWindow.webContents) {
      ipc.once(`set-success-${name}`, (_event, error) => {
        const contents = event.sender;
        if (contents.isDestroyed()) {
          return;
        }

        contents.send(`set-success-${name}`, error);
      });
      mainWindow.webContents.send(`set-${name}`, value);

      if (name === 'theme-setting') {
        changeTheme(name, value);
      }
    }
  });
}

ipc.on('storage-ready-notify', async (_, theme) => {
  globalTheme = theme;
  await createFloatingBarWindow(theme);
});

// 被叫展示窗口
const incomingCallWindowWidth = 384;
const incomingCallWindowHeight = 160;
const incomingCallPadding = 8;
const incomingCallWindows = new Map();

// {channelName, caller, meetingName, isPrivate}
async function showIncomingCallWindow(info) {
  const { screen } = electron;
  const theme = globalTheme;

  const heightOffset =
    incomingCallWindows.size * (incomingCallWindowHeight + incomingCallPadding);
  const options = {
    width: incomingCallWindowWidth,
    height: incomingCallWindowHeight,
    x:
      screen.getPrimaryDisplay().size.width -
      incomingCallWindowWidth -
      incomingCallPadding, // dock在右侧时，会挤在dock边上
    y:
      screen.getPrimaryDisplay().workAreaSize.height -
      incomingCallWindowHeight -
      heightOffset,
    autoHideMenuBar: true,
    backgroundColor: '#2090EA',
    show: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      contextIsolation: false,
      preload: path.join(__dirname, 'incoming_call_preload.js'),
      nativeWindowOpen: true,
      enableRemoteModule: true,
      sandbox: false,
    },
    acceptFirstMouse: true,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    fullscreenable: false,
  };

  let w = new BrowserWindow(options);
  w.caller = info.caller;
  w.isPrivate = info.isPrivate;
  incomingCallWindows.set(info.channelName, w);
  w.loadURL(prepareURL([__dirname, 'incoming_call.html'], { ...info, theme }));

  w.setAlwaysOnTop(true, 'screen-saver');
  w.setVisibleOnAllWorkspaces(true);

  w.on('closed', () => {
    // remove from map
    if (incomingCallWindows.has(info.channelName)) {
      incomingCallWindows.delete(info.channelName);
    }

    // reset position
    let index = 0;
    // eslint-disable-next-line no-restricted-syntax
    for (const item of incomingCallWindows.values()) {
      const offset = index * (incomingCallWindowHeight + incomingCallPadding);
      const [x] = item.getPosition();
      item.setPosition(
        x,
        screen.getPrimaryDisplay().workAreaSize.height -
          incomingCallWindowHeight -
          offset,
        true
      );
      index += 1;
    }
    w = null;
  });

  w.once('ready-to-show', () => {
    // 快速关闭可能会是空的
    if (!w) {
      return;
    }
    w.show();
  });
}

// {channelName, host, meetingName, lasting}
async function showScheduleCallWindow(info) {
  if (info.host) {
    info.caller = info.host;
  }
  const { screen } = electron;
  const theme = globalTheme;

  const heightOffset =
    incomingCallWindows.size * (incomingCallWindowHeight + incomingCallPadding);
  const options = {
    width: incomingCallWindowWidth,
    height: incomingCallWindowHeight,
    x:
      screen.getPrimaryDisplay().size.width -
      incomingCallWindowWidth -
      incomingCallPadding, // dock在右侧时，会挤在dock边上
    y:
      screen.getPrimaryDisplay().workAreaSize.height -
      incomingCallWindowHeight -
      heightOffset,
    autoHideMenuBar: true,
    backgroundColor: '#2090EA',
    show: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      contextIsolation: false,
      preload: path.join(__dirname, 'schedule_call_preload.js'),
      nativeWindowOpen: true,
      enableRemoteModule: true,
      sandbox: false,
    },
    acceptFirstMouse: true,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    fullscreenable: false,
  };

  let w = new BrowserWindow(options);
  w.caller = info.caller;
  incomingCallWindows.set(info.channelName, w);
  w.loadURL(prepareURL([__dirname, 'schedule_call.html'], { ...info, theme }));

  w.setAlwaysOnTop(true, 'screen-saver');
  w.setVisibleOnAllWorkspaces(true);

  w.on('closed', () => {
    // remove from map
    if (incomingCallWindows.has(info.channelName)) {
      incomingCallWindows.delete(info.channelName);
    }

    // reset position
    let index = 0;
    // eslint-disable-next-line no-restricted-syntax
    for (const item of incomingCallWindows.values()) {
      const offset = index * (incomingCallWindowHeight + incomingCallPadding);
      const [x] = item.getPosition();
      item.setPosition(
        x,
        screen.getPrimaryDisplay().workAreaSize.height -
          incomingCallWindowHeight -
          offset,
        true
      );
      index += 1;
    }
    w = null;
  });

  w.once('ready-to-show', () => {
    // 快速关闭可能会是空的
    if (!w) {
      return;
    }
    w.show();
  });
}

ipc.on('open-incoming-call-window', async (event, info) => {
  if (incomingCallWindows.has(info.channelName)) {
    return;
  }
  if (info.channelName === groupMeetingChannelName) {
    return;
  }
  await showIncomingCallWindow(info);
});

ipc.on('close-incoming-dialog', async (event, channelName) => {
  const win = incomingCallWindows.get(channelName);
  if (win) {
    win.close();
  }
});

ipc.on('want-close-self', event => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.close();
  }
});

ipc.on('check-permission', (event, mediaType) => {
  let hasPermission = true;
  const microphoneAccess = systemPreferences.getMediaAccessStatus(mediaType);
  if (microphoneAccess === 'denied') {
    hasPermission = false;
  }
  event.sender.send('check-permission', mediaType, hasPermission);
});

ipc.on('check-permission-screen-capture', () => {
  console.log('check-permission-screen-capture');
  if (process.platform === 'darwin') {
    desktopCapturer.getSources({
      fetchWindowIcons: true,
      thumbnailSize: { height: 1, width: 1 },
      types: ['window', 'screen'],
    });
  }
});

ipc.on('is-calling-exist', event => {
  // eslint-disable-next-line no-param-reassign
  event.returnValue = !!callVoiceWindowGroup;
  if (callVoiceWindowGroup) {
    if (callVoiceWindowGroup.isVisible()) {
      callVoiceWindowGroup.show();
    }
    if (callVoiceWindowGroup.isMinimized()) {
      callVoiceWindowGroup.restore();
    }
  }
});

ipc.on('passive-join-meeting', (event, info) => {
  // eslint-disable-next-line no-param-reassign
  event.returnValue = 0;

  setTimeout(async () => {
    let callerId = info.caller.replace('mac', '+');
    callerId = callerId.replace('ios', '+');
    if (info.isPrivate) {
      await showCallVoiceGroupWindow({
        meetingName: `${callerId}`,
        id: callerId,
        callType: 'passive',
        ...info,
      });
    } else {
      await showCallVoiceGroupWindow({ callType: 'passive', ...info });
    }
  }, 0);
});

ipc.on('browser-open-url', handleUrl);
ipc.on('get-meeting-global-config', () => {
  if (mainWindow) {
    mainWindow.webContents.send('get-meeting-global-config');
  }
});

ipc.on('set-meeting-global-config', (event, info) => {
  if (callVoiceWindowGroup) {
    callVoiceWindowGroup.webContents.send('set-meeting-global-config', info);
  }
});

const CAPTIVE_PORTAL_DETECTS = [
  {
    url: 'http://captive.apple.com',
    code: 200,
    body: '<HTML><HEAD><TITLE>Success</TITLE></HEAD><BODY>Success</BODY></HTML>',
  },
  {
    url: 'http://edge-http.microsoft.com/captiveportal/generate_204',
    code: 204,
  },
  { url: 'http://www.gstatic.com/generateq_204', code: 204 },
];

async function detectCaptivePortal(detected) {
  const { url, code, body } = detected;

  let response;
  try {
    response = await fetch(url, { timeout: 30 * 1000 });
  } catch (error) {
    const err = '[detect] fetch error';
    console.log(err, formatError(error));
    throw new Error(err);
  }

  const { status } = response;
  if (status !== code) {
    const err = '[detect] reponse status does not match';
    console.log(err, status, code);
    throw new Error(err);
  }

  if (!body) {
    return;
  }

  let text;
  try {
    text = await response.textConverted();
  } catch (error) {
    const err = '[detect] convert text failed';
    console.log(err, formatError(error));
    throw new Error(err);
  }

  if (!text?.startsWith(body)) {
    const err = '[detect] response text does not match';
    console.log(err, text);
    throw new Error(err);
  }

  return;
}

let handlingBadCert = false;
const certErrorList = [];

ipc.on('bad-self-signed-cert', async event => {
  const now = Date.now();
  const index = certErrorList.findIndex(time => now - time > 2 * 60 * 1000);
  const count = index === -1 ? certErrorList.length : index;

  // clear old & add new
  certErrorList.splice(count);
  certErrorList.unshift(now);

  if (count <= 2) {
    event.returnValue = 'lower below limitation';
    return;
  }

  if (handlingBadCert) {
    event.returnValue = 'already handled';
    return;
  }

  handlingBadCert = true;

  let anyAccessable = false;
  for (const detected of CAPTIVE_PORTAL_DETECTS) {
    try {
      await detectCaptivePortal(detected);
      anyAccessable = true;
      console.log('[detect] visit captive portal success', detected.url);
      break;
    } catch (error) {
      console.log(
        '[detect] visit captive portal failed',
        formatError(error),
        detected
      );
    }
  }

  if (anyAccessable) {
    // internet connection is ok, but has certificate error.
    dialog.showErrorBox(
      'Fatal Error',
      'Man-in-the-middle attack risk detected!'
    );

    if (mainWindow) {
      mainWindow.close();
    }

    event.returnValue = 'quiting';
    app.quit();
  } else {
    // internet connection is really bad.
    const options = {
      type: 'info',
      buttons: ['Open Browser', 'Quit Chative', 'Restart Chative'],
      message: 'Network Warning',
      detail:
        'The network you are using may require you to visit its login page,' +
        ' you can click "Open Browser" and continue to check the network.',
      defaultId: 0,
    };

    const { response } = await dialog.showMessageBox(mainWindow, options);
    if (response === 0) {
      console.log('[detect] click open browser.');
      event.returnValue = 'opening portal';

      const url = 'https://www.bing.com/?t=' + Date.now();
      await handleUrl(null, { target: url });

      handlingBadCert = false;
      certErrorList.splice(0);
    } else if (response === 1) {
      console.log('[detect] click quit Chative.');
      event.returnValue = 'quiting';
      app.quit();
    } else {
      console.log('[detect] click restart Chative.');
      event.returnValue = 'relaunching';
      app.relaunch();
      app.quit();
    }
  }
});

ipc.on('update-user-status', async (event, status, channelName) => {
  if (mainWindow) {
    mainWindow.webContents.send('update-user-status', status, channelName);
  }
});

let imageGalleryWindow;

ipc.on('show-image-gallery', async (event, { mediaFiles, selectedIndex }) => {
  if (imageGalleryWindow) {
    imageGalleryWindow.show();
    imageGalleryWindow.webContents.send('receive-images', {
      mediaFiles,
      selectedIndex,
    });
    return;
  }

  const theme = globalTheme;

  const options = {
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    resizable: true,
    autoHideMenuBar: true,
    backgroundColor: '#FFFFFF',
    show: false,
    modal: false,
    webPreferences: {
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      contextIsolation: false,
      preload: path.join(__dirname, 'image-gallery/image_gallery_preload.js'),
      nativeWindowOpen: true,
      enableRemoteModule: true,
      sandbox: false,
    },
    // parent: mainWindow,
    fullscreenable: false,
    minimizable: true,
    maximizable: true,
    titleBarStyle: 'hidden',
    acceptFirstMouse: true,
    // parent: mainWindow,
  };
  imageGalleryWindow = new BrowserWindow(options);
  remoteMain.enable(imageGalleryWindow.webContents);
  imageGalleryWindow.loadURL(
    prepareURL([__dirname, '/image-gallery/image_gallery.html'], { theme })
  );
  imageGalleryWindow.show();
  imageGalleryWindow.webContents.send('receive-images', {
    mediaFiles,
    selectedIndex,
  });

  imageGalleryWindow.on('closed', () => {
    imageGalleryWindow = null;
  });

  // Set a variable when the app is quitting.
  let isAppQuitting = false;
  app.on('before-quit', function (evt) {
    isAppQuitting = true;
  });

  imageGalleryWindow.on('close', function (evt) {
    if (!isAppQuitting) {
      evt.preventDefault();
      imageGalleryWindow.webContents.send('close-image-window');
      imageGalleryWindow.hide();
    }
  });
});
ipc.on('open-file-default', (e, absPath, fileName, contentType) => {
  if (mainWindow) {
    mainWindow.webContents.send(
      'open-file-default',
      absPath,
      fileName,
      contentType
    );
  }
});
// ipc.on('show-forward-image', async() => {
//   mainWindow.webContents.executeJavaScript(`
//     window.openForwardMessageDialog();
//     `
// );
// })

let localSearchWindow;
ipc.on('show-local-search', async (event, keywords, conversationId) => {
  if (localSearchWindow) {
    localSearchWindow.show();
    localSearchWindow.webContents.send(
      'receive-keywords',
      keywords,
      conversationId
    );
    return;
  }

  const theme = globalTheme;
  const options = {
    width: 800,
    height: 800,
    resizable: development,
    autoHideMenuBar: true,
    backgroundColor: '#FFFFFF',
    show: false,
    modal: false,
    webPreferences: {
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      contextIsolation: false,
      preload: path.join(__dirname, 'local_search_preload.js'),
      nativeWindowOpen: true,
      enableRemoteModule: true,
      sandbox: false,
    },
    // parent: mainWindow,
    fullscreenable: false,
    minimizable: true,
    maximizable: false,
    titleBarStyle: 'hidden',
    acceptFirstMouse: true,
  };
  localSearchWindow = new BrowserWindow(options);
  remoteMain.enable(localSearchWindow.webContents);
  localSearchWindow.loadURL(
    prepareURL([__dirname, 'local_search.html'], { theme })
  );
  localSearchWindow.once('ready-to-show', () => {
    localSearchWindow.show();
    localSearchWindow.webContents.send(
      'receive-keywords',
      keywords,
      conversationId
    );
  });
  localSearchWindow.on('closed', () => {
    localSearchWindow = null;
  });

  if (development) {
    localSearchWindow.webContents.openDevTools();
  }
});

ipc.on('jump-message', async (event, info) => {
  if (mainWindow) {
    mainWindow.show();
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.webContents.send('jump-message', info);
  }
});

ipc.on('show-voice-call-window', () => {
  if (callVoiceWindowGroup) {
    callVoiceWindowGroup.show();
    if (callVoiceWindowGroup.isMinimized()) {
      callVoiceWindowGroup.restore();
    }
  }
});

let floatingBarWindow;

async function createFloatingBarWindow(theme) {
  const { screen } = electron;
  const options = {
    x: screen.getPrimaryDisplay().size.width / 2 - 110,
    y: screen.getPrimaryDisplay().workAreaSize.height - 350,
    width: 256,
    height: 100,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      contextIsolation: false,
      preload: path.join(__dirname, 'floating_bar_preload.js'),
      nativeWindowOpen: true,
      enableRemoteModule: true,
      sandbox: false,
    },
    resizable: development,
    minimizable: false,
    maximizable: false,
    acceptFirstMouse: true,
    movable: true,
    alwaysOnTop: true,
    fullscreenable: false,
    frame: false,
  };
  floatingBarWindow = new BrowserWindow(options);
  remoteMain.enable(floatingBarWindow.webContents);
  floatingBarWindow.loadURL(
    prepareURL([__dirname, 'floating_bar.html'], {
      theme,
    })
  );

  floatingBarWindow.setAlwaysOnTop(true, 'screen-saver');
  // const version = os.release();
  // 小于 macOS 12.0.0
  // if (lt(version, '21.0.0')) {
  //    floatingBarWindow.setVisibleOnAllWorkspaces(true);
  // } else {
  //   mainWindow.setFullScreenable(false);
  //   app.dock.hide();
  //   floatingBarWindow.setVisibleOnAllWorkspaces(true, {
  //     visibleOnFullScreen: true,
  //   });
  //   floatingBarWindow.setFullScreenable(false);
  //   floatingBarWindow.showInactive();
  //   app.dock.show();
  //   floatingBarWindow.hide();
  //   mainWindow.setFullScreenable(true);
  // }
  floatingBarWindow.setVisibleOnAllWorkspaces(true);

  floatingBarWindow.on('closed', () => {
    floatingBarWindow = null;
  });

  // if (development) {
  //   floatingBarWindow.webContents.openDevTools();
  // }
}

ipc.on('show-floating-bar', async (event, speaker, isMuted, shareName) => {
  // 解决可能挂断后依然显示悬浮框的bug
  if (!callVoiceWindowGroup) {
    return;
  }

  if (floatingBarWindow) {
    if (!floatingBarWindow.isVisible()) {
      // 暂时无法做到不跳转workspace
      // https://github.com/electron/electron/issues/8734
      floatingBarWindow.showInactive();
    }
    floatingBarWindow.webContents.send(
      'receive-status',
      speaker,
      isMuted,
      shareName
    );
  }
});

ipc.on('floating-bar-set-muted', (_, muted) => {
  if (callVoiceWindowGroup) {
    callVoiceWindowGroup.webContents.send('floating-bar-set-muted', muted);
  }
});

ipc.on('floating-bar-want-close', () => {
  if (callVoiceWindowGroup) {
    callVoiceWindowGroup.webContents.send('floating-bar-want-close');
  }
});

ipc.on('update-will-reboot', () => {
  markShouldQuit();
  setImmediate(() => {
    app.removeAllListeners('window-all-closed');
    autoUpdater.quitAndInstall();
  });
});

let globalHardwareInfo;

ipc.on('set-beta-version', (_, info) => {
  if (info.isBeta) {
    isBeta = true;
  }
  if (info.isBetaSubtitle) {
    isBetaSubtitle = true;
  }
});

// 进入休眠前关闭语音对话框
powerMonitor.on('suspend', () => {
  logger.info('The computer suspend, will close callVoiceWindow.');
  if (callVoiceWindowGroup) {
    callVoiceWindowGroupSystemClose = false;
    callVoiceWindowGroup.webContents.send('system-close');
  }

  // 关闭右下角弹窗
  if (incomingCallWindows) {
    incomingCallWindows.forEach(win => {
      win.close();
    });
  }
});

// resume from sleep
powerMonitor.on('resume', () => {
  logger.info('The computer resume from sleep.');

  if (mainWindow) {
    mainWindow.webContents.send('power-monitor-resume');
  }
});

// 阻止/取消低功耗模式
let powerSaveBlockerId;

ipc.on('low-power-mode', (_, turnOn) => {
  logger.info('main.js The low-power-mode:', turnOn);
  if (powerSaveBlockerId !== undefined) {
    powerSaveBlocker.stop(powerSaveBlockerId);
    powerSaveBlockerId = undefined;
  }

  if (turnOn) {
    powerSaveBlockerId = powerSaveBlocker.start('prevent-display-sleep');
  }
});

// on-ac
powerMonitor.on('on-ac', () => {
  if (powerSaveBlockerId !== undefined) {
    powerSaveBlocker.stop(powerSaveBlockerId);
    powerSaveBlockerId = powerSaveBlocker.start('prevent-display-sleep');
  }
});

// on-battery
powerMonitor.on('on-battery', () => {
  if (powerSaveBlockerId !== undefined) {
    powerSaveBlocker.stop(powerSaveBlockerId);
    powerSaveBlockerId = powerSaveBlocker.start('prevent-display-sleep');
  }
});

nativeTheme.on('updated', () => {
  if (globalTheme === 'system') {
    changeTheme('theme-setting', 'system');
  }
});

ipc.on('meeting-get-all-contacts', () => {
  if (mainWindow) {
    mainWindow.webContents.send('meeting-get-all-contacts');
  }
});

ipc.on('reply-meeting-get-all-contacts', (_, info) => {
  if (callVoiceWindowGroup && !callVoiceWindowGroup.isDestroyed()) {
    callVoiceWindowGroup.webContents.send('meeting-get-all-contacts', info);
  }
});

ipc.on('open_mp_browser_view', async (event, params) => {
  handleWorkspace(params);
});
