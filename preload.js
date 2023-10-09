/* global Whisper: false */
/* global window: false */

const process = require('process');
const electron = require('electron');
const path = require('path');
const url = require('url');
const fse = require('fs-extra');
const shell = require('electron').shell;
const semver = require('semver');
window._lodash = require('lodash');
const os = require('os');
const fs = require('fs');
const chokidar = require('chokidar');
const { deferredToPromise } = require('./js/modules/deferred_to_promise');
const { isFileRegular } = require('./ts/util/isFileRegular');
const MIME = require('./ts/types/MIME');
const bs58 = require('bs58');

if (process.platform === 'linux') {
  // for linux
  window.libCryptClient = require('./lib-chative-client/linux-x64');
} else if (process.arch === 'x64') {
  // for macOS intel chip
  window.libCryptClient = require('./lib-chative-client');
} else if (process.arch === 'arm64') {
  // for macOS m1/m2 chip
  window.libCryptClient = require('./lib-chative-client/arm64');
}

const { app, getCurrentWindow, dialog } = require('@electron/remote');
window.getLocalLanguage = () => app.getLocale();
window.base58_encode = str => {
  let bytes = Buffer.from(str);
  let address = bs58.encode(bytes);
  return address;
};
// electron.webFrame.setZoomFactor(1);

const {
  globalConfig: globalConfigDefault,
  globalConfigURLs: globalConfigURLsDefault,
} = require('./config/default.json');
const {
  globalConfig: globalConfigProduction,
  globalConfigURLs: globalConfigURLsProduction,
} = require('./config/production.json');

window.globalConfig = globalConfigProduction || globalConfigDefault;
window.globalConfigURLs = globalConfigURLsProduction || globalConfigURLsDefault;

const {
  WBCConfig: WBCConfigDefault,
  WBCConfigUrls: WBCConfigUrlsDefault,
} = require('./config/default.json');
const { WBCConfig, WBCConfigUrls } = require('./config/production.json');
window.WBCConfig = WBCConfig || WBCConfigDefault;
window.WBCConfigUrls = WBCConfigUrls || WBCConfigUrlsDefault;

window.PROTO_ROOT = 'protos';
const config = require('url').parse(window.location.toString(), true).query;
if (config.environment === 'development') {
  const {
    globalConfig: globalConfigDev,
    globalConfigURLs: globalConfigURLsDev,
  } = require('./config/development.json');
  window.globalConfig = globalConfigDev || globalConfigDefault;
  window.globalConfigURLs = globalConfigURLsDev || globalConfigURLsDefault;

  const {
    WBCConfig: WBCConfigDev,
    WBCConfigUrls: WBCConfigUrlsDev,
  } = require('./config/development.json');
  window.WBCConfig = WBCConfigDev || WBCConfigDefault;
  window.WBCConfigUrls = WBCConfigUrlsDev || WBCConfigUrlsDefault;
}

let title = config.name;
if (config.environment !== 'production') {
  title += ` - ${config.environment}`;
}
if (config.appInstance) {
  title += ` - ${config.appInstance}`;
}

window.platform = process.platform;
window.getTitle = () => title;
window.getEnvironment = () => config.environment;
window.getAppInstance = () => config.appInstance;
window.getVersion = () => config.version;
window.isImportMode = () => config.importMode;
window.getExpiration = () => config.buildExpiration;
window.getNodeVersion = () => config.node_version;
window.getHostName = () => config.hostname;
window.getSystemTheme = () => config.systemTheme;
window.getApprovalAppId = () => config.approvalAppid;
window.getWebMeetingURL = () => config.webMeetingURL;

window.copyText = async text => {
  await navigator.clipboard.writeText(text).catch(() => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.setAttribute('value', text);
    input.select();
    if (document.execCommand('copy')) {
      document.execCommand('copy');
    }
    document.body.removeChild(input);
  });
};

window.isBeforeVersion = (toCheck, baseVersion) => {
  try {
    return semver.lt(toCheck, baseVersion);
  } catch (error) {
    window.log.error(
      `isBeforeVersion error: toCheck: ${toCheck}, baseVersion: ${baseVersion}`,
      error && error.stack ? error.stack : error
    );
    return true;
  }
};

var watcher = chokidar.watch(os.homedir() + '/chative', {
  ignored: /[\/\\]\./,
  persistent: true,
});

watcher.on('change', path => {
  Whisper.events.trigger('botReplyChanged');
});

window.jsonFile = async fileName => {
  let data = await getImgFile(fileName).then(data => {
    return data;
  });
  let file = new File([data], fileName, { type: 'image/png' });
  return file;
};

window.getBotReplyJson = async () => {
  const fileNames = await fs.promises.readdir(
    os.homedir() + '/chative/template'
  );
  let jsonArr = [];
  for (let file of fileNames) {
    if (file.substring(file.lastIndexOf('.')) === '.json') {
      let data = await getFileData(file).then(data => {
        return data;
      });
      jsonData = {
        data: data,
        fileName: file.substring(0, file.lastIndexOf('.')),
      };
      jsonArr.push(jsonData);
    }
  }
  return jsonArr;
};

const getImgFile = function (fileName) {
  let promise = new Promise((resolve, reject) => {
    fs.readFile(os.homedir() + '/chative/img/' + fileName, (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(data);
    });
  });
  return promise;
};

const getFileData = function (fileName) {
  let promise = new Promise((resolve, reject) => {
    fs.readFile(os.homedir() + '/chative/template/' + fileName, (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(JSON.parse(data));
    });
  });
  return promise;
};

window.betterEncodeURIComponent = param => {
  if (typeof param === 'number') {
    return '' + param;
  }
  if (!param || typeof param !== 'string') {
    throw Error('preload.js betterEncodeURIComponent bad param!');
  }
  const queryParams = { a: param };
  let queryString = new URLSearchParams(queryParams).toString();
  queryString = queryString.substring(2);
  queryString = queryString.replace(/\+/g, '%20');
  return queryString;
};

window.wrapDeferred = deferredToPromise;

const ipc = electron.ipcRenderer;
const localeMessages = ipc.sendSync('locale-data');

window.noticeInfo = (message, expireTime) => {
  window.showNotice('info', message, expireTime);
};
window.noticeError = (message, expireTime) => {
  window.showNotice('error', message, expireTime);
};
window.noticeSuccess = (message, expireTime) => {
  window.showNotice('success', message, expireTime);
};
window.noticeWarning = (message, expireTime) => {
  window.showNotice('warning', message, expireTime);
};
window.noticeWithoutType = (message, expireTime) => {
  window.showNotice('none-type', message, expireTime);
};

window.showNotice = (type, message, expireTime) => {
  const obj = { type, message, expireTime };
  const ev = new CustomEvent('main-menu-show-notice', { detail: obj });
  window.dispatchEvent(ev);
};

window.setBadgeCount = (redCount, greyCount) => {
  ipc.send('set-badge-count', redCount);
  const ev = new CustomEvent('main-header-set-badge-count', {
    detail: {
      redCount,
      greyCount,
    },
  });
  window.dispatchEvent(ev);
};
window.queryBadgeCount = () => ipc.send('query-badge-count');
ipc.on('query-badge-count', (_, count) => {
  const ev = new CustomEvent('main-header-set-badge-count', { detail: count });
  window.dispatchEvent(ev);
});

window.ipcFreshWebApiUrlCache = info => ipc.send('freshWebApiUrlCache', info);
window.fetchMeetingStatus = () => ipc.send('fetch-meeting-status');
window.badSelfSignedCert = () => ipc.sendSync('bad-self-signed-cert');

window.sendSearchUser = info => {
  ipc.send('search-user-reply', info);
};
window.handleOnCopy = () => {
  ipc.send('copy');
};
window.registerSearchUser = fn => {
  if (!fn) {
    ipc.removeAllListeners('search-user');
  } else {
    ipc.on('search-user', (_, info) => {
      fn(info);
    });
  }
};

window.sendSetBetaVersion = info => {
  ipc.send('set-beta-version', info);
};

window.dispatchBeforeJoinMeeting = info => {
  const existMeeting = ipcRenderer.sendSync('is-calling-exist');
  if (existMeeting) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent('before-join-meeting', { detail: info })
  );
};

ipc.on('prepare-join-meeting', (_, info) => {
  window.dispatchBeforeJoinMeeting(info);
});

ipc.on('meeting-version-low-warning', () => {
  window.alert(window.i18n('meetingVersionLowWarning'));
});
ipc.on('unlink-current-device', async () => {
  try {
    const result = await window.getAccountManager().unlinkCurrentDevice();
    window.log.info('unlink-current-device result:', result);
  } catch (error) {
    window.log.error(
      'preload.js: unlink-current-device failed:',
      error && error.stack ? error.stack : error
    );

    dialog.showErrorBox('Logout Warning', 'Log out from server failed!');
  } finally {
    // always clear configuration data
    Whisper.events.trigger('manual-logout', {
      manualLogout: true,
      error: 'manual logout',
    });
  }
});

ipc.on('update-user-status', (event, status, channelName) => {
  if (status === 0) {
    window.currentMeetingChannelName = '';
  } else {
    window.currentMeetingChannelName = channelName;
  }

  if (window.userStatusReceiver) {
    window.userStatusReceiver.UpdateMyStatus(status);
  }
});

window.updateNoDisturbStatus = (status, expired) => {
  if (window.userStatusReceiver) {
    window.userStatusReceiver.UpdateNoDisturbStatus(status, expired);
  }
};

window.clearUserStatus = () => {
  if (window.userStatusReceiver) {
    window.userStatusReceiver.clearMyStatus();
  }
};

// We never do these in our code, so we'll prevent it everywhere
window.open = () => null;
// eslint-disable-next-line no-eval, no-multi-assign
window.eval = global.eval = () => null;

window.drawAttention = () => {
  window.log.info('draw attention');
  ipc.send('draw-attention');
};
window.showWindow = () => {
  window.log.info('show window');
  ipc.send('show-window');
};

window.setAutoHideMenuBar = autoHide =>
  ipc.send('set-auto-hide-menu-bar', autoHide);

window.setMenuBarVisibility = visibility =>
  ipc.send('set-menu-bar-visibility', visibility);

window.restart = () => {
  window.log.info('restart');
  ipc.send('restart');
};

window.forceUpdateAlert = () => {
  const options = {
    type: 'error',
    buttons: [window.i18n('downloadTooltip')],
    message: window.i18n('forceUpdateLatestVersion'),
    detail: '',
  };

  return dialog.showMessageBox(getCurrentWindow(), options);
};

window.wantQuit = () => {
  window.log.info('want quit!');
  app.quit();
};

window.relaunch = () => {
  window.log.info('relaunching ...');
  ipc.send('restart');
};

window.closeAbout = () => ipc.send('close-about');
window.readyForUpdates = () => ipc.send('ready-for-updates');

window.updateTrayIcon = unreadCount =>
  ipc.send('update-tray-icon', unreadCount);

ipc.on('set-up-with-import', () => {
  Whisper.events.trigger('setupWithImport');
});

ipc.on('set-up-as-new-device', () => {
  Whisper.events.trigger('setupAsNewDevice');
});

ipc.on('set-up-as-standalone', () => {
  Whisper.events.trigger('setupAsStandalone');
});

ipc.on('show-update-button', () => {
  window.dispatchEvent(new Event('event-show-update-button'));
});

window.updateWillReboot = () => {
  ipc.send('update-will-reboot');
};

window.uploadDeviceInfo = () => {
  ipc.send('upload-device-info');
};

ipc.on('upload-device-info', async (_, info) => {
  return;
});

ipc.on('meeting-get-all-contacts', () => {
  if (!window.ConversationController) {
    ipc.send('reply-meeting-get-all-contacts', []);
    return;
  }
  let info;
  try {
    info = window.ConversationController.getAllPrivateConversations();
    info = info.models.map(model => {
      const item = model.cachedProps;
      if (item.type === 'direct') {
        return {
          id: item.id,
          avatarPath: item.avatarPath,
          name: item.name || item.id,
        };
      }
      return undefined;
    });
    info = info.filter(item => item);
  } catch (e) {
    window.info(
      'preload.js meeting-get-all-contacts exception:',
      JSON.stringify(e)
    );
  }

  if (info) {
    ipc.send('reply-meeting-get-all-contacts', info);
  } else {
    ipc.send('reply-meeting-get-all-contacts', []);
  }
});

// Settings-related events
window.showSettings = () => ipc.send('show-settings');
window.showAbout = () => ipc.send('show-about');
window.manualCheckForUpdates = () => ipc.send('manual-check-for-updates');
window.showPermissionsPopup = () => ipc.send('show-permissions-popup');
// window.ourProfileChange = () => ipc.send('our-profile-change');

window.showCallVoiceGroup = info => ipc.send('show-call-voice-group', info);
window.closeRtmWindow = () => ipc.send('rtm-close-by-unlink');
window.closeCallVoice = () => ipc.send('close-call-voice-group');

function bufferToArrayBufferSlice(buffer) {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  );
}

// return NodeJs Buffer
window.digestMD5 = arrayBuffer => {
  const md5 = require('crypto').createHash('md5');
  return md5.update(Buffer.from(arrayBuffer)).digest();
};

ipc.on('voiceSendMessage', (_, info) => {
  const { voiceSendMessage } = window.Events;
  if (voiceSendMessage) {
    voiceSendMessage(info);
  }
});

ipc.on('jump-message', (_, info) => {
  const { conversationId, messageId, recentConversationSwitch, type } = info;
  if (conversationId) {
    // 关闭名片对话框
    window.dispatchEvent(new Event('event-close-user-profile'));

    // 关闭任务对话框
    const ev = new Event('close-task-dialog');
    window.dispatchEvent(ev);
    Whisper.events.trigger(
      'showConversation',
      conversationId,
      messageId,
      recentConversationSwitch,
      type
    );
    const myEvent = new Event('event-toggle-switch-chat');
    window.dispatchEvent(myEvent);
  }
});

ipc.on('event-open-user-setting', () => {
  const myEvent = new Event('event-open-user-setting');
  window.dispatchEvent(myEvent);
});

async function webviewUrlVerify(_appId, httpUrl) {
  let miniProgramList;
  if (window.getMiniProgramList) {
    miniProgramList = window.getMiniProgramList();
  }
  if (miniProgramList) {
    for (let i = 0; i < miniProgramList.length; i += 1) {
      const { allowedUrls, appId } = miniProgramList[i];
      // 校验通过
      if (_appId === appId) {
        console.log('find appid: ' + appId);
        for (let j = 0; j < allowedUrls.length; j += 1) {
          const re = new RegExp(allowedUrls[j]);
          if (re.test(httpUrl)) {
            console.log(
              'url 正则校验通过, 正则：' + allowedUrls[j] + ', url: ' + httpUrl
            );
            return true;
          }
        }
        console.log(
          'url 正则校验不通过, 正则：' +
            allowedUrls.toString() +
            ', url: ' +
            httpUrl
        );
        window.noticeError('Bad request url!');
        return false;
      }
    }
    window.noticeError('Bad miniProgram service!');
    return false;
  } else {
    // 本地缓存中没有 miniProgramList， 网络拉取一下
    if (!window.navigator.onLine) {
      window.noticeError('Network Error!');
      return false;
    }
    try {
      if (window.fetchMiniProgramList) {
        miniProgramList = await window.fetchMiniProgramList();
      }
      if (!miniProgramList || miniProgramList.length === 0) {
        window.noticeError('there is no miniProgram service');
        return false;
      }
      for (let i = 0; i < miniProgramList.length; i += 1) {
        const { allowedUrls, appId } = miniProgramList[i];
        // 校验通过
        if (_appId === appId) {
          console.log('find appid: ' + appId);
          for (let j = 0; j < allowedUrls.length; j += 1) {
            const re = new RegExp(allowedUrls[j]);
            if (re.test(httpUrl)) {
              console.log(
                'url 正则校验通过, 正则：' +
                  allowedUrls[j] +
                  ', url: ' +
                  httpUrl
              );
              return true;
            }
          }
          console.log(
            'url 正则校验不通过, 正则：' +
              allowedUrls.toString() +
              ', url: ' +
              httpUrl
          );
          window.noticeError('Bad request url');
          return false;
        }
      }
      window.noticeError('Bad miniProgram service!');
      return false;
    } catch (error) {
      console.log(error);
      window.noticeError('Fetch miniProgram service list failed');
      return false;
    }
  }
}

ipc.on('open-full-webview', async (_, params) => {
  const { httpUrl, appId } = params || {};
  window.dispatchEvent(
    new CustomEvent('operation-full-view', {
      detail: {
        type: 'show',
        operation: 'showWebview',
        params: { httpUrl, appId },
      },
    })
  );
});

ipc.on('open-half-webview', async (_, params) => {
  const { httpUrl, appId, cid } = params || {};

  // 检测会话正否正常，跟 approval 无关
  let _cid = cid;
  const forwardListCid = window.forwardCurrentConversationId;
  if (!_cid || _cid.length === 0) {
    if (forwardListCid && forwardListCid.length > 0) {
      const c = window.ConversationController.get(forwardListCid);
      if (c) {
        _cid = forwardListCid;
      } else {
        window.noticeError(window.i18n('markdown_conversation_not_exist'));
        return;
      }
    } else {
      window.noticeError(window.i18n('markdown_conversation_not_exist'));
      return;
    }
  }
  const conversation = window.ConversationController.get(_cid);
  if (!conversation) {
    window.noticeError(window.i18n('markdown_conversation_not_exist'));
    return;
  }

  conversation.trigger('open-half-webview', { httpUrl, appId });
});

ipc.on('open-external-conversation', (_, cid) => {
  let conversationId = cid;
  if (conversationId) {
    if (conversationId.startsWith('WEEK')) {
      conversationId = window.Signal.ID.convertIdToV1(conversationId);
    }
    const c = window.ConversationController.get(conversationId);

    if (!c) {
      window.noticeError(window.i18n('markdown_conversation_not_exist'));
      return;
    }

    // 关闭名片对话框
    window.dispatchEvent(new Event('event-close-user-profile'));

    // 关闭任务对话框
    const ev = new Event('close-task-dialog');
    window.dispatchEvent(ev);
    Whisper.events.trigger('showConversation', conversationId);
    const myEvent = new Event('event-toggle-switch-chat');
    window.dispatchEvent(myEvent);
  }
});

ipc.on('open-profile', (_, uid, pos) => {
  // 检查此会话是否存在
  const c = window.ConversationController.get(uid);
  if (!c) {
    window.noticeError(window.i18n('number_not_register_error'));
    return;
  }
  const ev = new CustomEvent('open-profile-with-position', {
    detail: { uid, pos },
  });
  window.dispatchEvent(ev);
});

ipc.on('external-submit', async (_, params) => {
  const { httpUrl, appId, cid } = params;
  if (!httpUrl || httpUrl.length === 0) {
    window.noticeError(window.i18n('webview_url_not_allow'));
    return;
  }

  let _cid = cid;
  const forwardListCid = window.forwardCurrentConversationId;
  if (!_cid || _cid.length === 0) {
    if (forwardListCid && forwardListCid.length > 0) {
      const c = window.ConversationController.get(forwardListCid);
      if (c) {
        _cid = forwardListCid;
      } else {
        window.noticeError('Bad Conversation');
        return;
      }
    } else {
      window.noticeError('Bad Conversation');
      return;
    }
  }

  // 核对url
  const isLegal = await webviewUrlVerify(appId, httpUrl);
  if (isLegal) {
    // 检查此会话是否存在
    const conversation = window.ConversationController.get(_cid);
    if (!conversation) {
      window.noticeError(window.i18n('markdown_conversation_not_exist'));
      return;
    }
    conversation.trigger('approval-submit', httpUrl, appId);
  }
});

ipc.on('local-action', async (_, params) => {
  const { action } = params;
  if (action === 'groupMeetingDetails') {
    const { groupMeetingId, conversationId } = params;
    const c = window.ConversationController.get(
      window.Signal.ID.convertIdToV1(conversationId)
    );
    if (!c) {
      window.noticeError(window.i18n('markdown_conversation_not_exist'));
      return;
    }
    c.trigger('open-meeting-detail', groupMeetingId);
  }
});

ipc.on('meeting-status-destroy-if-not-exist', (_, info) => {
  // 先判断这个群本地存在不存在
  const { channelName } = info.room;
  let conversationId = channelName.substr(2);
  conversationId = conversationId.replace(/-/g, '/');
  try {
    conversationId = window.atob(conversationId);
  } catch (e) {}

  const conversation = window.ConversationController.get(conversationId);
  if (!conversation) {
    console.log(
      `preload.js meeting-status-destroy-if-not-exist conversation not exist:${conversationId}`
    );
    Whisper.events.trigger('meetingRemove', info.room.channelName, info.room);
    return;
  }
  console.log(
    'preload.js meeting-status-destroy-if-not-exist conversation exist, DO NOTHING!'
  );
});

ipc.on('meeting-status', (_, info) => {
  // 0-创建频道 1-销毁频道 2-频道人员变化
  setTimeout(() => {
    if (info.event === 'removeAll') {
      Whisper.events.trigger('meetingRemoveAll');
    }
    if (info.event === 'create') {
      Whisper.events.trigger('meetingAdd', info.room.channelName, info.room);
    }
    if (info.event === 'destroy') {
      Whisper.events.trigger('meetingRemove', info.room.channelName, info.room);
    }
    if (info.event === 'change') {
      Whisper.events.trigger('meetingUpdate', info.room.channelName, info.room);
    }
  }, 0);
});

ipc.on('meeting-feedback', async (_, channelName) => {
  console.log('preload.js meeting-feedback param:' + channelName);
  if (!channelName || !channelName.startsWith('G-')) {
    console.log('preload.js meeting-feedback bad param:' + channelName);
    return;
  }

  let conversationId = channelName.substr(2);
  conversationId = conversationId.replace(/-/g, '/');
  try {
    conversationId = window.atob(conversationId);
  } catch (e) {}

  const conversation = window.ConversationController.get(conversationId);
  if (!conversation) {
    console.log(
      'preload.js meeting-feedback conversation not exist:' + conversationId
    );
    return;
  }

  window['meeting-feedback:' + conversationId] = true;
});

ipc.on('join-meeting-bar', async (_, info) => {
  const { channelName, meetingName, join } = info;
  console.log(`preload.js join-meeting-bar param:${JSON.stringify(info)}`);
  setTimeout(() => {
    Whisper.events.trigger('meetingJoinUpdate', channelName, {
      channelName,
      name: meetingName,
      shouldJoin: join,
    });
  }, 0);
});

ipc.on('start-meeting', async (_, info) => {
  const { channelName, groupMeetingId } = info;
  console.log(`preload.js start-meeting param:${JSON.stringify(info)}`);
  if (!channelName || !channelName.startsWith('G-')) {
    console.log(`preload.js start-meeting bad param:${channelName}`);
    return;
  }

  let conversationId = channelName.substr(2);
  conversationId = conversationId.replace(/-/g, '/');
  try {
    conversationId = window.atob(conversationId);
  } catch (e) {}

  const conversation = window.ConversationController.get(conversationId);
  if (!conversation) {
    console.log(
      `preload.js start-meeting conversation not exist:${conversationId}`
    );
    return;
  }

  const v2Id = window.Signal.ID.convertIdToV2(conversationId);

  console.log('preload.js start-meeting conversation will send');
  const ourNumber = textsecure.storage.user.getNumber();
  const myInfo = ConversationController.get(ourNumber);
  const myName = myInfo?.get('name') || ourNumber;
  const meetingname = betterEncodeURIComponent(conversation.get('name'));
  const link =
    myName +
    ' has started a meeting. \n[Join](chative://meeting?v=1&meetingname=' +
    meetingname +
    '&channelname=' +
    betterEncodeURIComponent(channelName) +
    '&meetingid=' +
    betterEncodeURIComponent(groupMeetingId) +
    ') | [View details](chative://localAction/groupMeetingDetails?groupMeetingId=' +
    betterEncodeURIComponent(groupMeetingId) +
    '&conversationId=' +
    v2Id +
    ')';

  console.log('preload.js start-meeting conversation send link=' + link);
  const card = { appId: '', content: link };
  conversation.forceSendMessageAuto(
    link,
    null,
    [],
    null,
    null,
    {
      callAction: 'RING',
      meetingName: conversation.get('name'),
      channelName,
    },
    null,
    null,
    null,
    { card }
  );
});

ipc.on('add-dark-overlay', () => {
  const { addDarkOverlay } = window.Events;
  if (addDarkOverlay) {
    addDarkOverlay();
  }
});
ipc.on('remove-dark-overlay', () => {
  const { removeDarkOverlay } = window.Events;
  if (removeDarkOverlay) {
    removeDarkOverlay();
  }
});

window.displayMpSideView = display => {
  ipc.send('display-mp-side-view', display);
};

window.displayMpInSideView = display => {
  ipc.send('display-mp-inside-view', display);
};

window.sendBrowserOpenUrl = async (link, appId, pos, cid) => {
  // 普通链接直接打开即可
  if (!appId) {
    ipc.send('browser-open-url', { target: link, pos, cid });
    return;
  }
  // 这边提前先检测一下是不是打开名片，不是名片的话，如果小程序为空或者 undefined，就给个提示信息不要操作了。
  let isOpenAppView;
  const { host, protocol, pathname } = url.parse(link);
  if (
    protocol === 'chative:' &&
    host === 'openapi' &&
    (pathname === '/webview' || pathname === '/miniprogram')
  ) {
    isOpenAppView = true;
  }

  const did = window.textsecure.storage.user.getDeviceId();
  const uid = window.textsecure.storage.user.getNumber();
  if (!window.mpTokenManager) {
    window.mpTokenManager = new MpTokenManager();
  }

  let apps = [];
  let app;
  if (window?.getMiniProgramList) {
    apps = window?.getMiniProgramList() || [];
  }
  if (!apps.length && isOpenAppView) {
    window.noticeError('Permission denied!');
    return;
  }
  for (let i = 0; i < apps.length; i++) {
    if (apps[i].appId === appId) {
      app = apps[i];
      break;
    }
  }
  if (!app && isOpenAppView) {
    window.noticeError('Permission denied!');
    return;
  }

  let beyondCorpToken;
  if (app?.beyondCorp) {
    const { token } = await getAppToken(appId);
    if (!token) {
      window.noticeError('Get app token failed, try again later');
      return;
    }
    beyondCorpToken = token;
  }

  const params = {
    ...app,
    target: link,
    appId,
    pos,
    cid,
    did,
    uid,
    token: beyondCorpToken,
  };
  ipc.send('browser-open-url', params);
};

window.showNewGroupWindow = () => {
  // ipc.send('show-group-editor', 'new-group');
  const ev = new CustomEvent('global-components-members-change', {
    detail: { type: 'new-group' },
  });
  window.dispatchEvent(ev);
};

window.showImageGallery = ({ mediaFiles, selectedIndex }) => {
  ipc.send('show-image-gallery', { mediaFiles, selectedIndex });
};

window.RapidCreateGroup = id => {
  // ipc.send('show-group-editor', 'rapid-group', id);
  const ev = new CustomEvent('global-components-members-change', {
    detail: { type: 'rapid-group', id },
  });
  window.dispatchEvent(ev);
};

window.RapidCreateGroupFromGroup = (name, groupId) => {
  const ev = new CustomEvent('global-components-members-change', {
    detail: { type: 'group-rapid-group', name, groupId },
  });
  window.dispatchEvent(ev);
};

window.showInstantMeeting = () => {
  // ipc.send('show-group-editor', 'instant-meeting');
  const ev = new CustomEvent('global-components-members-change', {
    detail: { type: 'instant-meeting' },
  });
  window.dispatchEvent(ev);
};

window.showAddGroupMembersWindow = groupId => {
  // ipc.send('show-group-editor', 'add-group-members', groupId);
  const ev = new CustomEvent('global-components-members-change', {
    detail: { type: 'add-group-members', groupId },
  });
  window.dispatchEvent(ev);
};

window.showRemoveGroupMembersWindow = groupId => {
  // ipc.send('show-group-editor', 'remove-group-members', groupId);
  const ev = new CustomEvent('global-components-members-change', {
    detail: { type: 'remove-group-members', groupId },
  });
  window.dispatchEvent(ev);
};

window.showAddGroupAdminsWindow = groupId => {
  // ipc.send('show-group-editor', 'add-group-members', groupId);
  const ev = new CustomEvent('global-components-members-change', {
    detail: { type: 'add-group-admins', groupId },
  });
  window.dispatchEvent(ev);
};

window.showRemoveGroupAdminsWindow = groupId => {
  // ipc.send('show-group-editor', 'add-group-members', groupId);
  const ev = new CustomEvent('global-components-members-change', {
    detail: { type: 'remove-group-admins', groupId },
  });
  window.dispatchEvent(ev);
};

// window.showGroupEditorWindow = (options) => {
//   ipc.send('show-group-editor', options);
// }

window.sendOperationResult = (operation, targetWinId, result) => {
  if (!targetWinId) {
    return;
  }
  const { BrowserWindow } = require('@electron/remote');
  const targetWin = BrowserWindow.fromId(targetWinId);

  if (targetWin) {
    targetWin.webContents.send(operation, result);
  } else {
    window.log.info('window does not exists for window ID:', targetWinId);
  }
};

// window.sendGroupOperationResult = (targetWinId, result) => {
//   sendOperationResult('group-operation-result', targetWinId, result);
// }

window.sendEditResult = (targetWinId, result) => {
  sendOperationResult('edit-result', targetWinId, result);
};

// create or edit group
// this channel usually triggerred by group editor window.
// and this listener usually transfer it to the whisper events
// to make networking and interfacing operations
ipc.on('create-or-edit-group', (e, fromWinId, editInfo) => {
  Whisper.events.trigger('create-or-edit-group', fromWinId, editInfo);
});

ipc.on(
  'open-add-meeting-members',
  (_, { channelName, meetingName, meetingId, meetingKey, meetingVersion }) => {
    const ev = new CustomEvent('global-components-members-change', {
      detail: {
        type: 'meeting-add',
        channelName,
        meetingName,
        meetingId,
        meetingKey,
        meetingVersion,
      },
    });
    window.dispatchEvent(ev);
  }
);

window.instantMeeting = (members, meetingName) => {
  ipc.send('instant-meeting', members, meetingName);
};

window.addMeetingMembers = (
  members,
  channelName,
  meetingName,
  meetingId,
  meetingKey,
  meetingVersion
) => {
  ipc.send(
    'add-meeting-members',
    members,
    channelName,
    meetingName,
    meetingId,
    meetingKey,
    meetingVersion
  );
};

window.focusMeetingDialog = () => {
  ipc.send('focus-meeting-window');
};

window.openFileDefault = async (absPath, fileName, contentType) => {
  let extension = '';
  if (fileName && fileName.indexOf('.') >= 0) {
    const lastPeriod = fileName.lastIndexOf('.');
    extension = fileName.slice(lastPeriod + 1);
  }

  const ext = isFileRegular(extension);
  const cacheDir = path.join(app.getPath('userData'), 'tempFiles/');
  const newFileName = path.join(cacheDir, fileName);
  try {
    await fse.ensureDir(cacheDir);
    await fse.copy(absPath, newFileName);
    if (
      (!ext || ext === 'zip') &&
      !MIME.isImage(contentType) &&
      !MIME.isVideo(contentType)
    ) {
      await shell.showItemInFolder(newFileName);
    } else {
      await shell.openPath(newFileName);
    }
  } catch (error) {
    window.log.error('preload window.openFileDefault error:', error);
    window.noticeError(`Open ${fileName} failed!`);
  }
};

ipc.on('open-file-default', (e, absPath, fileName, contentType) => {
  window.openFileDefault(absPath, fileName, contentType);
});

ipc.on('change-internal-name', (e, fromWinId, newName) => {
  Whisper.events.trigger('change-internal-name', fromWinId, newName);
});

ipc.on('get-meeting-global-config', () => {
  let maxVideoPushStreamCount;
  let maxAudioPushStreamCount;
  let meetingPreset;
  let openMuteOther;
  let messageDisappearTime;

  const gl = window.getGlobalConfig();
  if (gl && gl.meeting && gl.meeting.maxVideoPushStreamCount) {
    maxVideoPushStreamCount = gl.meeting.maxVideoPushStreamCount;
  }
  if (gl && gl.meeting && gl.meeting.maxAudioPushStreamCount) {
    maxAudioPushStreamCount = gl.meeting.maxAudioPushStreamCount;
  }
  if (gl && gl.meeting && gl.meeting.meetingPreset) {
    meetingPreset = gl.meeting.meetingPreset;
  }
  if (gl && gl.meeting && gl.meeting.openMuteOther) {
    openMuteOther = true;
  }
  if (gl && gl.meeting && gl.meeting.messageDisappearTime) {
    messageDisappearTime = gl.meeting.messageDisappearTime;
  }
  ipc.send('set-meeting-global-config', {
    maxAudioPushStreamCount,
    maxVideoPushStreamCount,
    meetingPreset,
    openMuteOther,
    messageDisappearTime,
  });
});

ipc.on('fast-join-group', (e, joinUrl) => {
  Whisper.events.trigger('fast-join-group', joinUrl);
});

ipc.on('power-monitor-resume', () => {
  Whisper.events.trigger('power-monitor-resume');
});

ipc.on('event-share-mini-program', (e, card) => {
  // 分享小程序，弹出选择人员的 dialog，关闭 fullview 或者 halfview
  window.forceCloseWebview();

  // 关闭其他可能存在的 dialog
  window.dispatchEvent(new CustomEvent('close-all-load-dialog'));

  const myEvent = new CustomEvent('event-share-mini-program', {
    detail: card,
  });
  window.dispatchEvent(myEvent);
});

installGetter('global-config', 'getGlobalConfig');

installGetter('device-name', 'getDeviceName');

installGetter('theme-setting', 'getThemeSetting');
installSetter('theme-setting', 'setThemeSetting');
installGetter('hide-menu-bar', 'getHideMenuBar');
installSetter('hide-menu-bar', 'setHideMenuBar');

installGetter('notification-setting', 'getNotificationSetting');
installSetter('notification-setting', 'setNotificationSetting');
installGetter('audio-notification', 'getAudioNotification');
installSetter('audio-notification', 'setAudioNotification');

installGetter('spell-check', 'getSpellCheck');
installSetter('spell-check', 'setSpellCheck');

installGetter('quit-topic-setting', 'getQuitTopicSetting');
installSetter('quit-topic-setting', 'setQuitTopicSetting');

window.getThemeSetting = makeSettingGetter('theme-setting');
window.setThemeSetting = makeSettingSetter('theme-setting');
window.getNativeSystemTheme = makeSettingGetter('system-theme');

window.getNotificationSetting = makeSettingGetter('notification-setting');
window.setNotificationSetting = makeSettingSetter('notification-setting');
window.getAudioNotification = makeSettingGetter('audio-notification');
window.setAudioNotification = makeSettingSetter('audio-notification');

window.getDeviceName = makeSettingGetter('device-name');

window.getSpellCheck = makeSettingGetter('spell-check');
window.setSpellCheck = makeSettingSetter('spell-check');

window.getQuitTopicSetting = makeSettingGetter('quit-topic-setting');
window.setQuitTopicSetting = makeSettingSetter('quit-topic-setting');

window.getMediaPermissions = makeSettingGetter('media-permissions');
window.setMediaPermissions = makeSettingSetter('media-permissions');

window.getDisableHardwareAcceleration = makeSettingGetter(
  'disable-hardware-acceleration'
);
window.setDisableHardwareAcceleration = v => {
  makeSettingSetter('disable-hardware-acceleration')(v);
};
window.getOriginalDisableHardwareAcceleration = makeSettingGetter(
  'original-disable-hardware-acceleration'
);

window.setLanguage = v => {
  makeSettingSetter('user-language')(v);
};
window.getLanguage = makeSettingGetter('language');
window.getOriginalLanguage = makeSettingGetter('original-language');

function makeSettingGetter(name) {
  return () =>
    new Promise((resolve, reject) => {
      ipc.once(`get-success-${name}`, (event, error, value) => {
        if (error) {
          return reject(error);
        }

        return resolve(value);
      });
      ipc.send(`get-${name}`);
    });
}

function makeSettingSetter(name) {
  return value =>
    new Promise((resolve, reject) => {
      ipc.once(`set-success-${name}`, (event, error) => {
        if (error) {
          return reject(error);
        }

        return resolve();
      });
      ipc.send(`set-${name}`, value);
    });
}

installGetter('is-primary', 'isPrimary');
// installGetter('sync-request', 'getSyncRequest');
// installGetter('sync-time', 'getLastSyncTime');
// installSetter('sync-time', 'setLastSyncTime');

window.deleteAllData = () => ipc.send('delete-all-data');
ipc.on('delete-all-data', () => {
  const { deleteAllData } = window.Events;
  if (deleteAllData) {
    deleteAllData();
  }
});

ipc.on('get-ready-for-shutdown', async () => {
  const { shutdown } = window.Events || {};
  if (!shutdown) {
    window.log.error('preload shutdown handler: shutdown method not found');
    ipc.send('now-ready-for-shutdown');
    return;
  }

  try {
    await shutdown();
    ipc.send('now-ready-for-shutdown');
  } catch (error) {
    ipc.send(
      'now-ready-for-shutdown',
      error && error.stack ? error.stack : error
    );
  }
});

function installGetter(name, functionName) {
  ipc.on(`get-${name}`, async () => {
    const getFn = window.Events[functionName];
    if (!getFn) {
      ipc.send(
        `get-success-${name}`,
        `installGetter: ${functionName} not found for event ${name}`
      );
      return;
    }
    try {
      ipc.send(`get-success-${name}`, null, await getFn());
    } catch (error) {
      ipc.send(
        `get-success-${name}`,
        error && error.stack ? error.stack : error
      );
    }
  });
}

function installSetter(name, functionName) {
  ipc.on(`set-${name}`, async (_event, value) => {
    const setFn = window.Events[functionName];
    if (!setFn) {
      ipc.send(
        `set-success-${name}`,
        `installSetter: ${functionName} not found for event ${name}`
      );
      return;
    }
    try {
      await setFn(value);
      ipc.send(`set-success-${name}`);
    } catch (error) {
      ipc.send(
        `set-success-${name}`,
        error && error.stack ? error.stack : error
      );
    }
  });
}

function makeGetter(name) {
  return () =>
    new Promise((resolve, reject) => {
      ipc.once(`get-success-${name}`, (event, error, value) => {
        if (error) {
          return reject(error);
        }

        if (name === 'system-theme') {
          window.systemTheme = value;
        }

        return resolve(value);
      });
      ipc.send(`get-${name}`);
    });
}

window.getNativeSystemTheme = makeGetter('system-theme');
window.addSetupMenuItems = () => ipc.send('add-setup-menu-items');
window.removeSetupMenuItems = () => ipc.send('remove-setup-menu-items');
window.storageReadyNotify = theme => ipc.send('storage-ready-notify', theme);

window.showLocalSearch = (keywords, conversationId) => {
  return ipc.send('show-local-search', keywords, conversationId);
};
window.jumpMessage = info => {
  ipc.send('jump-message', info);
};

// We pull these dependencies in now, from here, because they have Node.js dependencies

require('./js/logging');

if (config.proxyUrl) {
  window.log.info('Using provided proxy url');
}

window.nodeSetImmediate = setImmediate;

const { initialize: initializeWebAPI } = require('./js/modules/web_api');

window.WebAPI = initializeWebAPI({
  certificateAuthority: config.certificateAuthority,
  proxyUrl: config.proxyUrl,
});

// Linux seems to periodically let the event loop stop, so this is a global workaround
setInterval(() => {
  window.nodeSetImmediate(() => {});
}, 1000);

const { copyImage } = require('./js/modules/copy_image');
window.copyImage = copyImage;

const { autoOrientImage } = require('./js/modules/auto_orient_image');

window.autoOrientImage = autoOrientImage;
window.dataURLToBlobSync = require('blueimp-canvas-to-blob');
window.filesize = require('filesize');
window.libphonenumber =
  require('google-libphonenumber').PhoneNumberUtil.getInstance();
window.libphonenumber.PhoneNumberFormat =
  require('google-libphonenumber').PhoneNumberFormat;
window.loadImage = require('blueimp-load-image');
window.getGuid = require('uuid/v4');

window.React = require('react');
window.ReactDOM = require('react-dom');
window.moment = require('moment');
window.PQueue = require('p-queue').default;
window.windowName = 'mainWindow';

const Signal = require('./js/modules/signal');
const i18n = require('./js/modules/i18n');
const Attachments = require('./app/attachments');

window.csv_parse = require('csv-parse').parse;
window.fs = require('fs');

const { AuthFlow, AuthStateEmitter } = require('./ts/open_id/flow');
window.OpenIdAuthFlow = AuthFlow;
window.OpenIdAuthStateEmitter = AuthStateEmitter;

const { locale } = config;
window.i18n = i18n.setup(locale, localeMessages);
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

// Pulling these in separately since they access filesystem, electron
window.Signal.Backup = require('./js/modules/backup');
window.Signal.Debug = require('./js/modules/debug');
window.Signal.Logs = require('./js/modules/logs');

window.electronDialogConfirm = async text => {
  const options = {
    type: 'warning',
    buttons: [window.i18n('audit-send'), window.i18n('cancel')],
    message: text,
    detail: '',
    defaultId: 0,
  };

  return dialog.showMessageBox(getCurrentWindow(), options);
};

// We pull this in last, because the native module involved appears to be sensitive to
//   /tmp mounted as noexec on Linux.
require('./js/spell_check');
const { ipcRenderer } = require('electron');

if (config.environment === 'test') {
  /* eslint-disable global-require, import/no-extraneous-dependencies */
  window.test = {
    glob: require('glob'),
    fse: require('fs-extra'),
    tmp: require('tmp'),
    path: require('path'),
    basePath: __dirname,
    attachmentsPath: window.Signal.Migrations.attachmentsPath,
  };
  /* eslint-enable global-require, import/no-extraneous-dependencies */
}

let defaultUserAgent;
window.getCustomUserAgent = appId => {
  if (!defaultUserAgent) {
    defaultUserAgent = ipc.sendSync('default-user-agent', appId);
  }
  return defaultUserAgent;
};

// ###################### recent conversation switch ######################
const MAX_RECENT_LENGTH = 20;
let recentConversation = [];
let recentConversationCurrentIndex = 0;
window.getConversationSwitchStatus = () => {
  if (recentConversation?.length < 2) {
    noticeConversationSwitchEnabled(false, false);
    return;
  }
  return {
    goBackEnabled: recentConversationCurrentIndex > 0,
    goForwardEnabled:
      recentConversationCurrentIndex < recentConversation.length - 1,
  };
};
window.conversationJoinQueue = async cid => {
  const idv1 = window.Signal.ID.convertIdToV1(cid);
  // 点击的是当前的，直接返回即可
  if (recentConversation[recentConversationCurrentIndex] === idv1) {
    return;
  }
  const filter = recentConversation?.filter(id => id !== idv1) || [];
  if (filter.length >= MAX_RECENT_LENGTH) {
    filter.shift();
    filter.push(idv1);
  } else {
    filter.push(idv1);
  }
  recentConversation = [...filter];
  recentConversationCurrentIndex = filter.length - 1;
  noticeConversationSwitchEnabled(recentConversation.length >= 2, false);

  // 打开一个新会话，这边判断是否为通讯录的人，不是通讯录的，拉一次获取 extId 的接口。
  const conversation = await ConversationController.getOrCreateAndWait(
    cid,
    'private'
  );
  if (conversation.isPrivate() && !conversation.get('directoryUser')) {
    try {
      const userExtInfo =
        (await window.textsecure.messaging.getUserExtInfo(cid)) || {};
      const { extId } = userExtInfo?.data || {};
      conversation.set({ extId });
      await window.Signal.Data.updateConversation(conversation.attributes, {
        Conversation: Whisper.Conversation,
      });
      conversation.trigger('update_view');
    } catch (error) {
      window.log.error(error && error.stack ? error.stack : error);
    }
  }
};
window.conversationGoForward = () => {
  if (
    recentConversation?.length < 2 ||
    recentConversationCurrentIndex === recentConversation.length - 1
  ) {
    noticeConversationSwitchEnabled(false, false);
    return;
  }
  window.jumpMessage({
    conversationId: recentConversation[recentConversationCurrentIndex + 1],
    recentConversationSwitch: true,
  });
  recentConversationCurrentIndex += 1;
  noticeConversationSwitchEnabled(
    true,
    recentConversationCurrentIndex < recentConversation.length - 1
  );
};
window.conversationGoBack = () => {
  if (recentConversation?.length < 2 || recentConversationCurrentIndex === 0) {
    noticeConversationSwitchEnabled(false, false);
    return;
  }
  window.jumpMessage({
    conversationId: recentConversation[recentConversationCurrentIndex - 1],
    recentConversationSwitch: true,
  });
  recentConversationCurrentIndex -= 1;
  noticeConversationSwitchEnabled(recentConversationCurrentIndex > 0, true);
};
const noticeConversationSwitchEnabled = (goBackEnabled, goForwardEnabled) => {
  window.dispatchEvent(
    new CustomEvent('conversation-switch-enabled', {
      detail: { goBackEnabled, goForwardEnabled },
    })
  );
};
window.getCurrentOpenConversation = () => {
  if (!recentConversation || recentConversation.length === 0) {
    return null;
  }
  return recentConversation[recentConversationCurrentIndex];
};
// ###################### recent conversation switch ######################

window.getAppToken = async (appId, forceWebApi) => {
  if (!window.mpTokenManager) {
    window.mpTokenManager = new MpTokenManager();
  }
  const { token, tokenExpiry } =
    (await window.mpTokenManager.getAppToken(appId, forceWebApi)) || {};
  return { token, tokenExpiry };
};

// ----------------- Js Bridge -----------------
ipc.on('on_js_bridge', async (_, data) => {
  const { methodName, params, appId, callbackid, browserType, tabId } =
    data || {};
  let response = {
    ver: '1.0',
    action: '',
    status: 200,
    reason: 'OK',
    data: {},
  };
  response.action = methodName;
  switch (methodName) {
    case 'getMiniProgramToken':
      response = await getMiniProgramToken(response, appId);
      break;
    case 'removeMiniProgramToken':
      response = await removeMiniProgramToken(response, appId);
      break;
    case 'closePage':
      console.log('Close Page');
      break;
    case 'setTitle':
      console.log('Set Title');
      break;
    case 'getTheme':
      let theme = window.Events.getThemeSetting();
      if (theme === 'system') {
        theme = window.systemTheme;
      }
      response.data.theme = theme;
      break;
    case 'jumpConversation':
      const { cid, type } = params || {};
      window.log.info('webview jump conversation', cid, type);
      if (!cid || !type || !['private', 'group'].includes(type)) {
        response.status = 5008;
        response.reason = 'Parameter exception';
      } else {
        const c = window.ConversationController.get(cid);
        if (!c) {
          // 对于外部 webview 打开会话， 如果本地没有 id 对应的会话， 直接返回错误。
          const status = type === 'private' ? 5013 : 5014;
          const reason =
            type === 'private'
              ? 'Personal session jump failed'
              : 'Group session jump failed';
          response.status = status;
          response.reason = reason;
        } else {
          window.jumpMessage({ conversationId: cid, type });
        }
      }
      break;
    case 'installCert':
      console.log('Install Cert');
      break;
    case 'reload':
      console.log('Reload');
      break;
    case 'share':
      const info = {
        response,
        appId,
        params,
        callbackid,
        browserType,
        tabId,
      };
      await getShareInfo(info);
      break;
    case 'getGroupInfo':
      const newInfo = {
        response,
        appId,
        params,
        callbackid,
        browserType,
        tabId,
      };
      await getGroupInfo(newInfo);
      break;
    case 'getGroups':
      const conversations = window.getConversations();
      const filterConversations = [];
      const groups = [];
      const { length } = conversations.models;
      for (let i = 0; i < length; i += 1) {
        filterConversations.push(conversations.models[i].cachedProps);
      }
      for (let i = 0; i < filterConversations.length; i++) {
        if (
          // filterConversations[i].activeAt &&
          filterConversations[i].type === 'group'
        ) {
          groups.push({
            //兼容老群，用v2id
            groupId: window.Signal.ID.convertIdToV2(filterConversations[i].id),
            groupName: filterConversations[i].name,
          });
        }
      }
      response.data = { groups };
      break;
    case 'getUserInfo':
      const ourNumber = window.textsecure.storage.user.getNumber();
      const Info = ConversationController.get(ourNumber).attributes;
      response.data = { Info };
      break;
    case 'getContacts':
      try {
        const result = await textsecure.messaging.fetchDirectoryContacts();
        let contacts = result['contacts'];
        contacts = contacts.map(item => {
          return {
            id: item.number,
            avatarPath: item.avatar,
            name: item.name || item.number,
          };
        });
        contacts = contacts.filter(item => item);
        response.data = { contacts };
        break;
      } catch (e) {
        window.log.error('load directory contacts failed.', error);
        break;
      }
    case 'shareNote':
      console.log('shareNote');
      break;
    default:
      response.status = 5011;
      response.reason = 'not supported';
      console.log('Empty or undefined methodName' + methodName);
  }
  if (methodName !== 'share' && methodName !== 'getGroupInfo') {
    ipc.send('on_js_bridge_callback', {
      response,
      appId,
      params,
      callbackid,
      browserType,
      tabId,
    });
  }
});
const getMiniProgramToken = async (response, appId) => {
  if (!window.mpTokenManager) {
    window.mpTokenManager = new MpTokenManager();
  }
  try {
    const { status, token: cacheToken } =
      (await window.mpTokenManager.getAppToken(appId)) || {};
    const token = (status === 0 && cacheToken) || '';
    response.data = { token };
  } catch (e) {
    if (e.name === 'HTTPError') {
      response.status = e.code;
      response.reason = e.message;
    } else {
      response.reason = 'getToken failed';
    }
  }
  return response;
};
const removeMiniProgramToken = async (response, appId) => {
  if (!window.mpTokenManager) {
    window.mpTokenManager = new MpTokenManager();
  }
  try {
    window.mpTokenManager.removeAppToken(appId);
  } catch (e) {
    if (e.name === 'HTTPError') {
      response.status = e.code;
      response.reason = e.message;
    } else {
      response.reason = 'removeToken failed';
    }
  }
  return response;
};
const getGroupInfo = async info => {
  window.showWindow();
  const myEvent = new CustomEvent('event-share-mini-program', {
    detail: { isGetGroupInfo: true, info },
  });
  window.dispatchEvent(myEvent);

  window.addEventListener('event-get-groupInfo-bridge', ev => {
    const { selectedGroupInfo, card } = ev.detail;
    const { response, appId, params, callbackid, browserType, tabId } =
      card.info;
    response.data = { selectedGroupInfo };

    ipc.send('on_js_bridge_callback', {
      response,
      appId,
      params,
      callbackid,
      browserType,
      tabId,
    });
  });
};
const getShareInfo = async info => {
  window.showWindow();
  window.forceCloseWebview();
  const myEvent = new CustomEvent('event-share-mini-program', {
    detail: { isShareBridge: true, info },
  });
  window.dispatchEvent(myEvent);

  window.addEventListener('event-share-mini-program-bridge', ev => {
    const { selectedInfo, card } = ev.detail;
    const { response, appId, params, callbackid, browserType, tabId } =
      card.info;
    response.data = { selectedInfo };
    ipc.send('on_js_bridge_callback', {
      response,
      appId,
      params,
      callbackid,
      browserType,
      tabId,
    });
  });
};
// ----------------- Js Bridge -----------------

window.getAppToken = async (appId, forceWebApi) => {
  if (!window.mpTokenManager) {
    window.mpTokenManager = new MpTokenManager();
  }
  const { token, tokenExpiry } =
    (await window.mpTokenManager.getAppToken(appId, forceWebApi)) || {};
  return { token, tokenExpiry };
};

window.forceCloseWebview = () => {
  ipc.send('web_view_close');
};

window.cacheGlobalConfig = globalConfig => {
  if (!globalConfig) {
    return;
  }
  ipc.send('cache_globalConfig', globalConfig);
};

window.cacheWBCConfigInMainThread = WBCConfig => {
  ipc.send('cache_wbc_config', WBCConfig);
};

window.cacheMpList = mpList => {
  ipc.send('cache_mp_list', mpList);
};

window.checkWeaApp = async path => {
  const existApp = await ipc.invoke('check_wea_app', path);
  return existApp;
};

ipc.on('link_open_webview', async (_, appId, jumpUrl, layout) => {
  if (!jumpUrl || !appId) {
    window.noticeError(window.i18n('url_not_valid'));
    return;
  }
  let app;
  const { getMiniProgramList } = window || {};
  if (getMiniProgramList) {
    const apps = getMiniProgramList() || [];
    for (let i = 0; i < apps.length; i++) {
      if (apps[i].appId === appId) {
        app = apps[i];
        break;
      }
    }
  }
  // 该用户没有 该应用的权限!
  if (!app) {
    window.noticeError(window.i18n('authentication-failed'));
    return;
  }

  const { allowedUrls } = app || {};
  if (!allowedUrls || !Array.isArray(allowedUrls) || !allowedUrls.length) {
    // allowedUrls 为空，不允许通过链接的形式去打开
    window.noticeError(window.i18n('url_not_valid'));
    return;
  }

  let flag;
  for (let i = 0; i < allowedUrls.length; i++) {
    const reg = new RegExp(allowedUrls[i]);
    if (reg.test(jumpUrl)) {
      flag = true;
      break;
    }
  }
  if (!flag) {
    // allowedUrls 不放行该链接
    window.noticeError(window.i18n('url_not_valid'));
    return;
  }

  const type = layout === '1' ? 'halfview' : 'fullview';
  window.openMiniProgramView({ app, type, target: jumpUrl });
});

ipc.on('jump_other_app', (event, detail) => {
  const { app, type, jumpUrl } = detail || {};
  window.openMiniProgramView({ app, type, target: jumpUrl });
});

window.openMiniProgramView = async params => {
  const { app, type, target, onlyDisplay } = params || {};
  if (type !== 0 && type !== 2 && type !== 'fullview' && type !== 'halfview') {
    return;
  }

  let jumpUrl = target;
  if (
    target?.startsWith('https://webmeeting.chative.im') ||
    target?.startsWith('https://webmeeting.test.chative.im')
  ) {
    jumpUrl += '&t=' + Date.now();
    // get self name
    const ourNumber = textsecure.storage.user.getNumber();
    const me = ConversationController.getOrCreate(ourNumber, 'private');
    jumpUrl += '&nickname=' + window.betterEncodeURIComponent(me.getName());
  }

  // 0-独立窗口打开，2-workspace 侧边打开
  let browserType = type;
  if (type === 0) {
    browserType = 'independent';
  }
  if (type === 2) {
    browserType = 'side';
  }

  let {
    h5url,
    appId,
    name,
    supportBot,
    beyondCorp,
    urlWhiteList,
    picture,
    displayType,
    config,
  } = app || {};
  const { firstOpenJumpUrl } = config || {};
  const did = window.textsecure.storage.user.getDeviceId();
  const uid = window.textsecure.storage.user.getNumber();
  let email;
  try {
    const { email: userEmail } =
      window.ConversationController.get(uid)?.attributes || {};
    email = userEmail;
  } catch (e) {
    console.error('get our email catch error', e);
  }

  let hostname;
  try {
    hostname = new URL(h5url)?.hostname;
  } catch (e) {
    console.error('get app hostname catch error', e);
  }

  let tokenDetail;
  let certDetail;
  let certinstallsign;
  if (beyondCorp) {
    const { token, tokenExpiry } = await getAppToken(appId, true);
    if (!token || !tokenExpiry) {
      window.noticeError('Get app token failed, try again later');
      return;
    }

    // token
    tokenDetail = { appId, token, tokenExpiry };

    // 证书
    const certificate = window.textsecure.storage.get('certificate');
    const privateKey = window.textsecure.storage.get('privateKey');
    const expire = window.textsecure.storage.get('expire');
    certDetail = { certificate, key: privateKey, expire };

    // 证书安装签名
    certinstallsign = window.textsecure.storage.get('certinstallsign');
  }

  // Vega 根据展示大小做了下样式的区分，大屏展示的带上 workspace 路径，这边是给他们做了个适配
  if (
    (appId === '2f2bfb4316100e9ea997' || appId === 'b4933e7b0c12f9c16a') &&
    (browserType === 'fullview' || browserType === 'independent')
  ) {
    if (h5url.endsWith('/')) {
      h5url += 'workspace';
    } else {
      h5url += '/workspace';
    }
  }

  // 独立窗口展示的应用，有些应用无法通过 h5url 打开，需要先通过 jumpUrl 去打开
  if (
    browserType === 'independent' &&
    firstOpenJumpUrl &&
    firstOpenJumpUrl?.length
  ) {
    const result = await ipc.invoke('check_app_opened', { appId });
    // 应用尚未打开，通过 firstOpenJumpUrl || jumpUrl 去打开
    if (!result) {
      jumpUrl = firstOpenJumpUrl || jumpUrl;
    }
  }

  const options = {
    h5url,
    jumpUrl,
    appId,
    appName: name,
    supportBot,
    did,
    uid,
    beyondCorp,
    urlWhiteList,
    tokenDetail,
    certDetail,
    certinstallsign,
    browserType,
    email,
    picture,
    type,
    displayType,
    hostname,
    onlyDisplay,
    config,
  };

  ipc.send('open_mp_browser_view', options);
};

window.displaySideview = display => {
  ipc.send('display_mp_sideview', display);
};

window.displayWebview = display => {
  ipc.send('display_mp_webview', display);
};

window.cacheGlobalPrivateContacts = privateContact => {
  ipc.send('cache_private_contact', privateContact);
};
