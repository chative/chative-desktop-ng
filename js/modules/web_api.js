const WebSocket = require('websocket').w3cwebsocket;
const fetch = require('node-fetch');
const ProxyAgent = require('proxy-agent');
const { Agent } = require('https');
const is = require('@sindresorhus/is');
const { getApiUserAgent } = require('../../ts/web_api/util');

// const { redactAll } = require('./privacy');

/* global Buffer: false */
/* global setTimeout: false */
/* global log: false */

let globalWebApiUrls = {};
const websocketUrlSelect = {
  chat: [],
  last_chat: '',
  userStatus: [],
  last_userStatus: '',
};
window.dynamicDomainTypes = [
  'chat',
  'voice',
  // 'userStatus',
  'fileSharing',
  'avatarStorage',
  'translate',
  // 'task',
  // 'vote',
  'miniProgram',
  // 'device',
  // 'ldap',
  // 'risk',
  // 'recording',
  'caption',
];

function disableNetwork(type, url) {
  const items = globalWebApiUrls[type];
  if (items) {
    for (let i = 0; i < items.length; i += 1) {
      if (url.startsWith(items[i].url) && items[i].ms) {
        items[i].ms = 0;
        log.info(`[network optimize] disable [${type}] ${items[i].url}.`);

        // 非主窗口先不触发测速，先轮询换域名尝试
        if (window.selectBestDomain) {
          window.selectBestDomain();
        }
        return;
      }
    }
  }
}

window.freshWebApiUrlCache = c => {
  globalWebApiUrls = c;
};

const resetWebsocketUrlSelect = () => {
  websocketUrlSelect.chat = [];
  websocketUrlSelect.userStatus = [];
  websocketUrlSelect.last_chat = '';
  websocketUrlSelect.last_userStatus = '';
};

function _btoa(str) {
  let buffer;

  if (str instanceof Buffer) {
    buffer = str;
  } else {
    buffer = Buffer.from(str.toString(), 'binary');
  }

  return buffer.toString('base64');
}

const _call = object => Object.prototype.toString.call(object);

const ArrayBufferToString = _call(new ArrayBuffer());
const Uint8ArrayToString = _call(new Uint8Array());

function _getString(thing) {
  if (typeof thing !== 'string') {
    if (_call(thing) === Uint8ArrayToString)
      return String.fromCharCode.apply(null, thing);
    if (_call(thing) === ArrayBufferToString)
      return _getString(new Uint8Array(thing));
  }
  return thing;
}

function _b64ToUint6(nChr) {
  return nChr > 64 && nChr < 91
    ? nChr - 65
    : nChr > 96 && nChr < 123
    ? nChr - 71
    : nChr > 47 && nChr < 58
    ? nChr + 4
    : nChr === 43
    ? 62
    : nChr === 47
    ? 63
    : 0;
}

function _getStringable(thing) {
  return (
    typeof thing === 'string' ||
    typeof thing === 'number' ||
    typeof thing === 'boolean' ||
    (thing === Object(thing) &&
      (_call(thing) === ArrayBufferToString ||
        _call(thing) === Uint8ArrayToString))
  );
}

function _ensureStringed(thing) {
  if (_getStringable(thing)) {
    return _getString(thing);
  } else if (thing instanceof Array) {
    const res = [];
    for (let i = 0; i < thing.length; i += 1) {
      res[i] = _ensureStringed(thing[i]);
    }
    return res;
  } else if (thing === Object(thing)) {
    const res = {};
    // eslint-disable-next-line guard-for-in, no-restricted-syntax
    for (const key in thing) {
      res[key] = _ensureStringed(thing[key]);
    }
    return res;
  } else if (thing === null) {
    return null;
  } else if (thing === undefined) {
    return undefined;
  }
  throw new Error(`unsure of how to jsonify object of type ${typeof thing}`);
}

function _jsonThing(thing) {
  return JSON.stringify(_ensureStringed(thing));
}

function _base64ToBytes(sBase64, nBlocksSize) {
  const sB64Enc = sBase64.replace(/[^A-Za-z0-9+/]/g, '');
  const nInLen = sB64Enc.length;
  const nOutLen = nBlocksSize
    ? Math.ceil(((nInLen * 3 + 1) >> 2) / nBlocksSize) * nBlocksSize
    : (nInLen * 3 + 1) >> 2;
  const aBBytes = new ArrayBuffer(nOutLen);
  const taBytes = new Uint8Array(aBBytes);

  for (
    let nMod3, nMod4, nUint24 = 0, nOutIdx = 0, nInIdx = 0;
    nInIdx < nInLen;
    nInIdx += 1
  ) {
    nMod4 = nInIdx & 3;
    nUint24 |= _b64ToUint6(sB64Enc.charCodeAt(nInIdx)) << (18 - 6 * nMod4);
    if (nMod4 === 3 || nInLen - nInIdx === 1) {
      for (
        nMod3 = 0;
        nMod3 < 3 && nOutIdx < nOutLen;
        nMod3 += 1, nOutIdx += 1
      ) {
        taBytes[nOutIdx] = (nUint24 >>> ((16 >>> nMod3) & 24)) & 255;
      }
      nUint24 = 0;
    }
  }
  return aBBytes;
}

function _validateResponse(response, schema) {
  try {
    // eslint-disable-next-line guard-for-in, no-restricted-syntax
    for (const i in schema) {
      switch (schema[i]) {
        case 'object':
        case 'string':
        case 'number':
          // eslint-disable-next-line valid-typeof
          if (typeof response[i] !== schema[i]) {
            return false;
          }
          break;
        default:
      }
    }
  } catch (ex) {
    return false;
  }
  return true;
}

function _createSocket(url, { certificateAuthority, proxyUrl }) {
  const requestOptions = {
    ca: certificateAuthority,
    maxReceivedFrameSize: 0x410000,
  };

  if (proxyUrl) {
    Object.assign(requestOptions, { agent: new ProxyAgent(proxyUrl) });
  }

  // 添加 User-Agent
  const headers = { 'user-agent': getApiUserAgent() };

  // eslint-disable-next-line new-cap
  return new WebSocket(url, null, null, headers, requestOptions);
}

const FIVE_MINUTES = 1000 * 60 * 5;
const agents = {
  unauth: null,
  auth: null,
};

const CERT_ERRORS = [
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_CRL',
  'UNABLE_TO_DECRYPT_CERT_SIGNATURE',
  'UNABLE_TO_DECRYPT_CRL_SIGNATURE',
  'UNABLE_TO_DECODE_ISSUER_PUBLIC_KEY',

  'CERT_SIGNATURE_FAILURE',
  'CRL_SIGNATURE_FAILURE',
  'CERT_NOT_YET_VALID',
  'CERT_HAS_EXPIRED',
  'CRL_NOT_YET_VALID',

  'CRL_HAS_EXPIRED',
  'ERROR_IN_CERT_NOT_BEFORE_FIELD',
  'ERROR_IN_CERT_NOT_AFTER_FIELD',
  'ERROR_IN_CRL_LAST_UPDATE_FIELD',
  'ERROR_IN_CRL_NEXT_UPDATE_FIELD',

  'OUT_OF_MEM',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',

  'CERT_CHAIN_TOO_LONG',
  'CERT_REVOKED',
  'INVALID_CA',
  'PATH_LENGTH_EXCEEDED',
  'INVALID_PURPOSE',

  'CERT_UNTRUSTED',
  'CERT_REJECTED',
  'ERR_TLS_CERT_ALTNAME_FORMAT',
  'ERR_TLS_CERT_ALTNAME_INVALID',
];

function _promiseAjax(providedUrl, options) {
  return new Promise((resolve, reject) => {
    const url = providedUrl || `${options.host}/${options.path}`;
    log.info(
      `${options.type} ${url}${options.unauthenticated ? ' (unauth)' : ''}`
    );
    const timeout =
      typeof options.timeout !== 'undefined' ? options.timeout : 30000;

    let hostKey = url;
    try {
      hostKey = new URL(url).host;
    } catch (error) {
      log.error('failt to parse url', url, error);
    }

    const proxyUrl = options.proxyUrl || '';
    const agentType = options.unauthenticated ? 'unauth' : 'auth';
    const cacheKey = `${hostKey}-${proxyUrl}-${agentType}`;

    const { timestamp } = agents[cacheKey] || {};
    if (!timestamp || timestamp + FIVE_MINUTES < Date.now()) {
      if (timestamp) {
        log.info(`Cycling agent for type ${cacheKey}`);
      }

      const rejectUnauthorized =
        options.rejectUnauthorized !== false
          ? true
          : options.rejectUnauthorized;

      // proxy cannot use rejectUnauthorized ???
      const agentOptions = {
        keepAlive: true,
        rejectUnauthorized,
      };

      agents[cacheKey] = {
        agent: proxyUrl ? new ProxyAgent(proxyUrl) : new Agent(agentOptions),
        timestamp: Date.now(),
      };
    }
    const { agent } = agents[cacheKey];

    if (!agent.defaultPort) {
      agent.defaultPort = 443;
    }

    const fetchOptions = {
      method: options.type,
      body: options.data || null,
      headers: { 'X-Difft-Agent': 'OWD', 'user-agent': getApiUserAgent() },
      agent,
      ca: options.certificateAuthority,
      timeout,
    };

    if (fetchOptions.body instanceof ArrayBuffer) {
      // node-fetch doesn't support ArrayBuffer, only node Buffer
      const contentLength = fetchOptions.body.byteLength;
      fetchOptions.body = Buffer.from(fetchOptions.body);

      // node-fetch doesn't set content-length like S3 requires
      fetchOptions.headers['Content-Length'] = contentLength;
    }

    // for voice
    if (options.authorization) {
      fetchOptions.headers.Authorization = options.authorization;
    }

    // for light task
    if (options.token) {
      fetchOptions.headers.token = options.token;
    }

    if (options.cacheControl) {
      fetchOptions.headers['Cache-Control'] = options.cacheControl;
    }

    if (options.userAgent) {
      fetchOptions.headers['user-agent'] = options.userAgent;
    }

    if (options.user && options.password) {
      const user = _getString(options.user);
      const password = _getString(options.password);
      const auth = _btoa(`${user}:${password}`);
      fetchOptions.headers.Authorization = `Basic ${auth}`;
    }

    if (options.contentType) {
      fetchOptions.headers['Content-Type'] = options.contentType;
    }
    //配置head头Accept-Language alert(window.getLocalLanguage());
    if (options.localLanguage) {
      fetchOptions.headers['Accept-Language'] = options.localLanguage;
    }

    fetch(url, fetchOptions)
      .then(response => {
        let resultPromise;
        if (
          options.responseType === 'json' &&
          /^application\/json(;.*)?$/.test(
            response.headers.get('Content-Type') || ''
          )
        ) {
          resultPromise = response.json();
        } else if (options.responseType === 'arraybuffer') {
          resultPromise = response.buffer();
        } else {
          resultPromise = response.textConverted();
        }
        return resultPromise.then(result => {
          if (options.responseType === 'arraybuffer') {
            // eslint-disable-next-line no-param-reassign
            result = result.buffer.slice(
              result.byteOffset,
              result.byteOffset + result.byteLength
            );
          }
          if (options.responseType === 'json') {
            if (options.validateResponse) {
              if (!_validateResponse(result, options.validateResponse)) {
                log.error(options.type, url, response.status, 'Error');
                return reject(
                  HTTPError(
                    'promiseAjax: invalid response',
                    response.status,
                    result,
                    options.stack
                  )
                );
              }
            }

            // new APIs, should check more
            if (options.newAPI) {
              //check 'status' field
              if (result.status != 0) {
                log.error(
                  options.type,
                  url,
                  response.status,
                  'NewAPI Error:',
                  JSON.stringify(result)
                );

                const copyResult = { ...result };
                if (response.status === 401 && result.status === undefined) {
                  // if response code === 401 and
                  // response body has no status, set status = 5
                  // to indicate token is invalid.
                  copyResult.status = 5;
                }

                // use code 400 to indicate an error response from server.
                return reject(
                  HTTPError(
                    'promiseAjax: server response error status',
                    400,
                    copyResult,
                    options.stack
                  )
                );
              }
            }
          }
          if (response.status >= 0 && response.status < 400) {
            log.info(options.type, url, response.status, 'Success');
            return resolve(result, response.status);
          } else {
            log.error(options.type, url, response.status, 'Error');
            return reject(
              HTTPError(
                'promiseAjax: error response',
                response.status === 502 ? -1 : response.status,
                result,
                options.stack
              )
            );
          }
        });
      })
      .catch(e => {
        log.error(options.type, url, 0, 'Error');
        const stack = `${e.stack}\nInitial stack:\n${options.stack}`;

        log.error('error=' + JSON.stringify(e));
        log.error('stack=' + stack);

        // remove cached agent
        if (agent === agents[cacheKey]?.agent) {
          agents[cacheKey] = null;
        }

        if (CERT_ERRORS.includes(e?.code) || CERT_ERRORS.includes(e?.errno)) {
          log.error('x509 certificate verification failed.');

          window.badSelfSignedCert();
        }

        return reject(HTTPError('promiseAjax catch', 0, e.toString(), stack));
      });
  });
}

function _retryAjax(url, options, providedLimit, providedCount) {
  const count = (providedCount || 0) + 1;
  const limit = providedLimit || 2;
  return _promiseAjax(url, options).catch(e => {
    if (e.name === 'HTTPError' && e.code === -1 && count < limit) {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve(_retryAjax(url, options, limit, count));
        }, 1000);
      });
    }

    if (e.name === 'HTTPError' && e.code === -1 && count === limit) {
      // 标记网络状态不可用
      if (window.dynamicDomainTypes.includes(options.domainUse)) {
        disableNetwork(options.domainUse, url);
      }
    }
    throw e;
  });
}

function _retryDomain(options, domains, index) {
  const currentIndex = index || 0;
  return _retryAjax(domains[currentIndex], options).catch(e => {
    if (
      e.name === 'HTTPError' &&
      e.code === -1 &&
      currentIndex < domains.length - 1
    ) {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve(_retryDomain(options, domains, currentIndex + 1));
        }, 0);
      });
    }
    throw e;
  });
}

function _outerAjax(url, options) {
  // 挑选合适的urls
  const domains = [];
  if (options.domainUse === 'out') {
    return _retryAjax(url, options);
  }

  if (window.dynamicDomainTypes.includes(options.domainUse)) {
    const items = globalWebApiUrls[options.domainUse];
    for (let i = 0; i < items.length; i += 1) {
      if (items[i].url && items[i].ms) {
        domains.push(`${items[i].url}/${options.path}`);
      }
    }
    // 都不可用
    if (domains.length === 0) {
      for (let i = 0; i < items.length; i += 1) {
        if (items[i].url) {
          items[i].ms = 1;
          log.info(
            `[network optimize] rest network status [${options.domainUse}] ${items[i].url}.`
          );
          domains.push(`${items[i].url}/${options.path}`);
        }
      }
    }
  } else {
    throw 'Bad options.domainUse';
  }

  if (domains.length === 0) {
    throw 'Bad domains list';
  }

  // eslint-disable-next-line no-param-reassign
  options.stack = new Error().stack; // just in case, save stack here.
  return _retryDomain(options, domains);
}

function HTTPError(message, providedCode, response, stack) {
  const code = providedCode > 999 || providedCode < 100 ? -1 : providedCode;
  const e = new Error(`${message}; code: ${code}`);
  e.name = 'HTTPError';
  e.code = code;
  e.stack += `\nOriginal stack:\n${stack}`;
  if (response) {
    e.response = response;
  }
  return e;
}

const URL_CALLS = {
  accounts: 'v1/accounts',
  devices: 'v1/devices',
  keys: 'v2/keys',
  identity: 'v3/keys/identity/bulk',
  signed: 'v2/keys/signed',
  messages: 'v1/messages',
  messagesV3: 'v3/messages',
  attachment: 'v1/attachments',
  profile: 'v1/profile',
  avatarAttachment: 'v1/profile/avatar/attachment',
  directory: 'v1/directory',
  auth: 'v1/auth',
  authV2: 'v2/auth',
  token: 'v1/authorize',
  groups: 'v1/groups',
  applications: 'v1/applications',
  reportException: 'v1/cltlog',
  conversation: 'v1/conversation',
  thumbsUp: 'v1/interacts',
  extInfo: 'v1/directory/extInfo',
  accessedList: 'v1/bu/accessedList',
  accessedLeaderList: 'v1/user/accessedLeaderList',
  readPositions: 'v1/readReceipt',
  riskCheck: 'v1/content',
  conversationSharedConfig: 'v1/conversationconfig/share',
  report: '/v3/accounts/report',
};

module.exports = {
  initialize,
};

// We first set up the data that won't change during this session of the app
function initialize({ certificateAuthority, proxyUrl }) {
  if (!is.string(certificateAuthority)) {
    throw new Error('WebAPI.initialize: Invalid certificateAuthority');
  }

  // Thanks to function-hoisting, we can put this return statement before all of the
  //   below function definitions.
  return {
    connect,
  };

  // Then we connect to the server with user-specific information. This is the only API
  //   exposed to the browser context, ensuring that it can't connect to arbitrary
  //   locations.
  function connect({
    username: initialUsername,
    password: initialPassword,
    firstRun,
  }) {
    let username = initialUsername;
    let password = initialPassword;

    let fileServerToken;
    let refreshTokenTimer;
    let tokenValidityPeriod = 45 * 60 * 1000;

    if (firstRun) {
      resetWebsocketUrlSelect();
    }

    // Thanks, function hoisting!
    return {
      confirmCode,
      getAttachment,
      getAvatarUploadId,
      getAvatar,
      getDevices,
      getKeysForNumber,
      getMessageSocket,
      getUserStatusSocket,
      getMyKeys,
      getProfile,
      setProfile,
      getProvisioningSocket,
      putAttachment,
      registerKeys,
      requestVerificationSMS,
      requestVerificationVoice,
      sendMessages,
      setSignedPreKey,
      // getInternalContacts,
      redeemAccount,
      getOpenIdLoginAddress,
      authWithOktaTokensV2,
      authWithOktaTokens,
      authCheckEmail,
      getUserInfoFromOkta,
      getToken,
      getServerTokenDirect,
      setInternalName,
      getGlobalConfig,
      getWBCConfig,
      createGroupV2,
      upgradeGroupToV2,
      editGroupV2,
      queryGroupV2,
      getGroupV2List,
      addGroupV2Members,
      removeGroupV2Members,
      addGroupAdmin,
      removeGroupAdmin,
      transferGroupOwner,
      editGroupV2Member,
      getGroupV2Member,
      disbandGroupV2,
      getGroupV2InviteCode,
      getGroupV2InfoByInviteCode,
      joinGroupV2ByInviteCode,
      editGroupV2OnlyOwner,
      reportException,
      unlinkCurrentDevice,
      fetchDirectoryContacts,
      getAttachmentNew,
      putAttachmentNew,
      rapidUpload,
      reportFileBroken,
      putAvatar,
      putGroupAvatar,
      getVoiceResponse,
      pingURL,
      deleteAuthorization,
      translateContent,
      securityCheck,
      createLightTask,
      deleteLightTask,
      updateLightTask,
      getLightTask,
      getLightTaskOperationLog,
      getTaskList,
      createExternalMeeting,
      getMeetingOnlineUsers,
      getExternalGroupMeeting,
      uploadDeviceInfo,

      // vote
      createVote,
      voteItems,
      getVoteResult,

      // send tunnel security messages
      // sendMessageToGroup,
      // sendMessageToNumber,

      sendMessageV3ToGroup,
      sendMessageV3ToNumber,

      // conversation to front
      conversationToFront,

      // pin
      createGroupPin,
      removeGroupPin,
      getGroupPins,
      // mini program
      getMpList,
      getAppIdToken,
      postExternalUrl,
      requestThumbsUp,

      getGroupMeetingDetails,
      getUserExtInfo,
      getUserAccessedBUList,
      getMemberByBU,
      getUserAccessedLeaderList,
      getMemberByLeader,
      getRemoteConversations,
      getRemoteMessages,
      getRemoteReadPositions,
      getCaptionSubtitles,

      meetingNotifyGroupLeave,
      meetingNotifyGroupInvite,
      meetingNotifyGroupKick,

      getConversationSharedConfig,
      setConversationSharedConfig,

      setConversationConfig,
      getConversationConfig,

      //confident meeting
      getUserSessionsV2KeyByUid,
      getEncinfosByGroupId,
      //举报，申请好友，接受好友
      reportByUid,
      agreeFriendByUid,
      applyFriendByUid,
    };

    function _ajax(param) {
      if (!param.urlParameters) {
        // eslint-disable-next-line no-param-reassign
        param.urlParameters = '';
      }

      return _outerAjax(null, {
        domainUse: 'chat',
        certificateAuthority,
        contentType: 'application/json; charset=utf-8',
        data: param.jsonData && _jsonThing(param.jsonData),
        // host: url, // 因为域名自动选择，这个字段用不到了
        password,
        localLanguage: param.localLanguage,
        path: URL_CALLS[param.call] + param.urlParameters,
        proxyUrl,
        responseType: param.responseType,
        timeout: param.timeout,
        type: param.httpType,
        user: username,
        validateResponse: param.validateResponse,
        newAPI: param.newAPI,
      }).catch(e => {
        const { code } = e;
        if (code === 200) {
          // happens sometimes when we get no response
          // (TODO: Fix server to return 204? instead)
          return null;
        }
        let message;
        switch (code) {
          case -1:
            message =
              'Failed to connect to the server, please check your network connection.';
            break;
          case 413:
            message = 'Rate limit exceeded, please try again later.';
            break;
          case 403:
            message = 'Invalid code, please try again.';
            break;
          case 417:
            // TODO: This shouldn't be a thing?, but its in the API doc?
            message = 'Number already registered.';
            break;
          case 401:
            message =
              'Invalid authentication, most likely someone re-registered and invalidated our registration.';
            break;
          case 404:
            message = 'Number is not registered.';
            break;
          case 430:
            message = 'Sending messages to this user is forbidden.';
            break;
          default:
            message =
              'The server rejected our query, please file a bug report.';
        }
        e.message = `${message} (original: ${e.message})`;
        throw e;
      });
    }

    function getProfile(number) {
      return _ajax({
        call: 'profile',
        httpType: 'GET',
        urlParameters: `/${number}`,
        responseType: 'json',
      });
    }

    function setProfile(obj) {
      log.info('web_api.js setProfile param=' + JSON.stringify(obj));
      return _ajax({
        call: 'profile',
        httpType: 'PUT',
        responseType: 'json',
        jsonData: obj,
        contentType: 'application/json; charset=utf-8',
      });
    }

    function getAvatarUploadId() {
      log.info('web_api.js getAvatarUploadId');
      return _ajax({
        call: 'avatarAttachment',
        httpType: 'GET',
        responseType: 'json',
        contentType: 'application/json; charset=utf-8',
      });
    }

    function getAvatar(attachmentId) {
      return _outerAjax(null, {
        path: attachmentId,
        domainUse: 'avatarStorage',
        proxyUrl,
        responseType: 'arraybuffer',
        timeout: 60 * 1000,
        type: 'GET',
      });
    }

    function requestVerificationSMS(number) {
      return _ajax({
        call: 'accounts',
        httpType: 'GET',
        responseType: 'json',
        urlParameters: `/sms/code/${number}`,
      });
    }

    function requestVerificationVoice(number) {
      return _ajax({
        call: 'accounts',
        httpType: 'GET',
        urlParameters: `/voice/code/${number}`,
      });
    }

    async function confirmCode(
      number,
      code,
      newPassword,
      signalingKey,
      registrationId,
      deviceName,
      pinCode,
      meetingVersion = null
    ) {
      const jsonData = {
        signalingKey: _btoa(_getString(signalingKey)),
        supportsSms: false,
        fetchesMessages: true,
        registrationId,
        pin: pinCode,
      };

      let call;
      let urlPrefix;
      let schema;
      let responseType;

      if (deviceName) {
        jsonData.name = deviceName;
        if (meetingVersion) {
          jsonData.meetingVersion = meetingVersion;
        }

        call = 'devices';
        urlPrefix = '/';
        schema = { deviceId: 'number' };
        responseType = 'json';
      } else {
        call = 'accounts';
        urlPrefix = '/code/';
      }

      // We update our saved username and password, since we're creating a new account
      username = number;
      password = newPassword;

      const response = await _ajax({
        call,
        httpType: 'PUT',
        urlParameters: urlPrefix + code,
        jsonData,
        responseType,
        validateResponse: schema,
      });

      // From here on out, our username will be our phone number combined with device
      username = `${number}.${response.deviceId || 1}`;

      return response;
    }

    function getDevices() {
      return _ajax({
        call: 'devices',
        httpType: 'GET',
      });
    }

    function registerKeys(genKeys) {
      const keys = {};
      keys.identityKey = _btoa(_getString(genKeys.identityKey));
      keys.signedPreKey = {
        keyId: genKeys.signedPreKey.keyId,
        publicKey: _btoa(_getString(genKeys.signedPreKey.publicKey)),
        signature: _btoa(_getString(genKeys.signedPreKey.signature)),
      };

      keys.preKeys = [];
      let j = 0;
      // eslint-disable-next-line guard-for-in, no-restricted-syntax
      for (const i in genKeys.preKeys) {
        keys.preKeys[j] = {
          keyId: genKeys.preKeys[i].keyId,
          publicKey: _btoa(_getString(genKeys.preKeys[i].publicKey)),
        };
        j += 1;
      }

      // This is just to make the server happy
      // (v2 clients should choke on publicKey)
      keys.lastResortKey = { keyId: 0x7fffffff, publicKey: _btoa('42') };

      return _ajax({
        call: 'keys',
        httpType: 'PUT',
        jsonData: keys,
        timeout: 60000,
      });
    }

    function setSignedPreKey(signedPreKey) {
      return _ajax({
        call: 'signed',
        httpType: 'PUT',
        jsonData: {
          keyId: signedPreKey.keyId,
          publicKey: _btoa(_getString(signedPreKey.publicKey)),
          signature: _btoa(_getString(signedPreKey.signature)),
        },
      });
    }

    function getMyKeys() {
      return _ajax({
        call: 'keys',
        httpType: 'GET',
        responseType: 'json',
        validateResponse: { count: 'number' },
      }).then(res => res.count);
    }

    function requestThumbsUp(number) {
      return _ajax({
        call: 'thumbsUp',
        httpType: 'POST',
        responseType: 'json',
        jsonData: {
          number: number,
          comment: '',
        },
        urlParameters: `/thumbsUp`,
      });
    }

    function extractKeysFromRes(res) {
      if (!Array.isArray(res?.devices)) {
        throw new Error('Invalid response');
      }
      res.identityKey = _base64ToBytes(res.identityKey);
      res.devices.forEach(device => {
        if (
          !_validateResponse(device, { signedPreKey: 'object' }) ||
          !_validateResponse(device.signedPreKey, {
            publicKey: 'string',
            signature: 'string',
          })
        ) {
          throw new Error('Invalid signedPreKey');
        }
        if (device.preKey) {
          if (
            !_validateResponse(device, { preKey: 'object' }) ||
            !_validateResponse(device.preKey, { publicKey: 'string' })
          ) {
            throw new Error('Invalid preKey');
          }
          // eslint-disable-next-line no-param-reassign
          device.preKey.publicKey = _base64ToBytes(device.preKey.publicKey);
        }
        // eslint-disable-next-line no-param-reassign
        device.signedPreKey.publicKey = _base64ToBytes(
          device.signedPreKey.publicKey
        );
        // eslint-disable-next-line no-param-reassign
        device.signedPreKey.signature = _base64ToBytes(
          device.signedPreKey.signature
        );
      });
      return res;
    }

    function getKeysForNumber(number, deviceId = '*') {
      return _ajax({
        call: 'keys',
        httpType: 'GET',
        urlParameters: `/${number}/${deviceId}`,
        responseType: 'json',
        validateResponse: { identityKey: 'string', devices: 'object' },
      }).then(extractKeysFromRes);
    }

    //获取群组所有用户信息包含meetingInfo
    function getEncinfosByGroupId(gid) {
      return _ajax({
        call: 'groups',
        newAPI: true,
        httpType: 'GET',
        responseType: 'json',
        urlParameters: `/meetingencinfo/${gid}`,
      });
    }
    //举报
    async function reportByUid(uid, type, reason, block) {
      const path = 'v3/accounts/report';
      const jsonData = {
        uid: uid,
        type: type,
        reason: reason,
      };
      if (typeof block !== 'undefined') {
        jsonData.block = block;
      }

      return requestFileServer(path, jsonData, {
        domainUse: 'chat',
        type: 'POST',
        certificateAuthority,
      });
    }
    //申请加好友
    async function applyFriendByUid(uid, source = null, action = null) {
      const path = 'v3/friend/ask';
      const jsonData = {
        uid: uid,
        //source:source
      };
      if (source) {
        jsonData.source = source;
      }
      if (action) {
        jsonData.action = action;
      }
      return requestFileServer(path, jsonData, {
        domainUse: 'chat',
        type: 'POST',
        certificateAuthority,
      });
    }
    //同意加好友
    async function agreeFriendByUid(uid) {
      const path = 'v3/friend/ask/' + uid + '/agree';
      return requestFileServer(
        path,
        {},
        {
          domainUse: 'chat',
          type: 'PUT',
          certificateAuthority,
        }
      );
    }

    //获取某个用户的公钥以及meetingVersion
    async function getUserSessionsV2KeyByUid(uids) {
      const path = 'v3/keys/identity/bulk';
      const jsonData = {
        uids,
      };
      return requestFileServer(path, jsonData, {
        domainUse: 'chat',
        type: 'POST',
        certificateAuthority,
      });
    }

    function sendMessages(destination, messageArray, timestamp, silent) {
      const jsonData = { messages: messageArray, timestamp };

      if (silent) {
        jsonData.silent = true;
      }

      return _ajax({
        call: 'messages',
        httpType: 'PUT',
        urlParameters: `/${destination}`,
        jsonData,
        responseType: 'json',
      });
    }

    function getAttachment(id) {
      return _ajax({
        call: 'attachment',
        httpType: 'GET',
        urlParameters: `/${id}`,
        responseType: 'json',
        validateResponse: { location: 'string' },
      }).then(response =>
        // Using _outerAJAX, since it's not hardcoded to the Signal Server
        _outerAjax(response.location, {
          domainUse: 'out',
          // contentType: 'application/octet-stream',
          proxyUrl,
          responseType: 'arraybuffer',
          timeout: 15 * 60 * 1000, // 15 mins
          type: 'GET',
        })
      );
    }

    function putAttachment(encryptedBin) {
      return _ajax({
        call: 'attachment',
        httpType: 'GET',
        responseType: 'json',
      }).then(response =>
        // Using _outerAJAX, since it's not hardcoded to the Signal Server
        _outerAjax(response.location, {
          domainUse: 'out',
          // contentType: 'application/octet-stream',
          data: encryptedBin,
          processData: false,
          proxyUrl,
          timeout: 15 * 60 * 1000,
          type: 'PUT',
        }).then(() => response.idString)
      );
    }

    function selectWebsocketUrl(type) {
      // 设置上次url不可用，然后触发测速
      const lastURL = websocketUrlSelect['last_' + type];
      if (lastURL) {
        disableNetwork(type, lastURL);
      }

      // 挑选可用域名
      if (websocketUrlSelect[type].length === 0) {
        const items = globalWebApiUrls[type];
        for (let i = 0; i < items.length; i += 1) {
          if (items[i].url && items[i].ms) {
            websocketUrlSelect[type].push(items[i].url);
          }
        }
      }

      // 都不可用，重置网络
      if (websocketUrlSelect[type].length === 0) {
        const items = globalWebApiUrls[type];
        for (let i = 0; i < items.length; i += 1) {
          if (items[i].url) {
            items[i].ms = 1;
            log.info(
              `[network optimize] rest network status [${type}] ${items[i].url}.`
            );
            websocketUrlSelect[type].push(items[i].url);
          }
        }
      }

      if (websocketUrlSelect[type].length === 0) {
        throw Error(`selectWebsocketUrl fatal error ${type} length === 0.`);
      }

      const select_url = websocketUrlSelect[type][0];
      websocketUrlSelect[type].splice(0, 1);
      websocketUrlSelect['last_' + type] = select_url;
      return select_url;
    }

    function getMessageSocket() {
      log.info('opening message socket start');
      const select_url = selectWebsocketUrl('chat');
      log.info('opening message socket:', select_url);

      const fixedScheme = select_url
        .replace('https://', 'wss://')
        .replace('http://', 'ws://');
      const login = betterEncodeURIComponent(username);
      const pass = betterEncodeURIComponent(password);

      return _createSocket(
        `${fixedScheme}/v1/websocket/?login=${login}&password=${pass}&agent=OWD`,
        { certificateAuthority, proxyUrl }
      );
    }

    function getUserStatusSocket(AuthToken) {
      log.info('opening user status socket start');
      const select_url = selectWebsocketUrl('userStatus');
      log.info('opening userStatus socket:', select_url);

      const fixedScheme = (select_url + '/ws')
        .replace('https://', 'wss://')
        .replace('http://', 'ws://');
      const token = betterEncodeURIComponent(AuthToken);

      return new window.WebSocket(
        `${fixedScheme}/?token=${token}&origin=macOS`
      );
      // return _createSocket(`${fixedScheme}/?token=${token}&origin=macOS`, {});
    }

    function getProvisioningSocket() {
      log.info('opening provisioning socket start');
      const select_url = selectWebsocketUrl('chat');
      log.info('opening provisioning socket:', select_url);

      const fixedScheme = select_url
        .replace('https://', 'wss://')
        .replace('http://', 'ws://');

      return _createSocket(
        `${fixedScheme}/v1/websocket/provisioning/?agent=OWD`,
        { certificateAuthority, proxyUrl }
      );
    }

    // deprecated with new interface
    // function getInternalContacts() {
    //   log.info('try to get internal contacts from server');
    //   return _ajax({
    //     call: 'directory',
    //     urlParameters: '/internal/accounts',
    //     httpType: 'GET',
    //     responseType: 'json',
    //   });
    // }

    /*
      numbers: if null, get all contacts(include myself)
        else some numbers
      properties: if null, get basic properties
                  (number, name, email, avatar, avatarKey and signature)
        else is all, get all properties
    */
    function fetchDirectoryContacts(numbers, properties = 'all') {
      log.info(
        'fetch directory contact(s) from server for',
        numbers?.length ? numbers : 'all',
        'with properties:',
        properties
      );

      const uids = numbers;
      const jsonData = uids && uids.length > 0 ? { uids } : undefined;
      const urlParams = `?properties=${betterEncodeURIComponent(properties)}`;

      return _ajax({
        call: 'directory',
        newAPI: true,
        urlParameters: `/contacts${urlParams}`,
        httpType: 'POST',
        responseType: 'json',
        jsonData,
        localLanguage: window.getLocalLanguage(),
      });
    }

    function getToken() {
      return _ajax({
        call: 'token',
        urlParameters: '/token',
        httpType: 'PUT',
        responseType: 'json',
      });
    }

    function redeemAccount(invitationCode) {
      log.info('redeem account by invite code.');
      return _ajax({
        call: 'accounts',
        httpType: 'GET',
        responseType: 'json',
        urlParameters: `/invitation/${invitationCode}`,
      });
    }

    function getOpenIdLoginAddress(domain) {
      log.info('get login address with for,', domain);

      const jsonData = { domain };

      return _ajax({
        call: 'authV2',
        httpType: 'POST',
        responseType: 'json',
        urlParameters: `/login/address`,
        jsonData,
      });
    }

    function authWithOktaTokensV2(accessToken, idToken, nonce, domain) {
      log.info('auth with okta tokens,', domain);

      const jsonData = {
        accessToken: accessToken,
        idToken: idToken,
        nonce: nonce,
        domain: domain,
      };

      return _ajax({
        call: 'authV2',
        httpType: 'POST',
        responseType: 'json',
        urlParameters: '/okta',
        jsonData,
      });
    }

    function authWithOktaTokens(accessToken, idToken, nonce) {
      log.info('auth with okta tokens.');
      const jsonData = {
        accessToken: accessToken,
        idToken: idToken,
        nonce: nonce,
      };

      return _ajax({
        call: 'auth',
        httpType: 'POST',
        responseType: 'json',
        urlParameters: '/okta',
        jsonData,
      });
    }

    function authCheckEmail(email) {
      log.info('auth check email.');
      const jsonData = {
        email,
      };

      return _ajax({
        call: 'auth',
        httpType: 'POST',
        responseType: 'json',
        jsonData,
      });
    }

    function getUserInfoFromOkta(userInfoUrl, accessToken) {
      return _outerAjax(userInfoUrl, {
        domainUse: 'out',
        proxyUrl,
        authorization: `Bearer ${accessToken}`,
        responseType: 'json',
        // timeout: 0, // using default timeout
        type: 'GET',
      });
    }

    function setInternalName(profileName) {
      return _ajax({
        call: 'directory',
        httpType: 'PUT',
        responseType: 'json',
        urlParameters: `/internal/name/${profileName}`,
      });
    }

    function getGlobalConfig(globalConfigUrl) {
      return _outerAjax(globalConfigUrl, {
        domainUse: 'out',
        proxyUrl,
        responseType: 'json',
        type: 'GET',
        timeout: 5000,
        cacheControl: 'no-cache',
      });
    }

    function getWBCConfig(WBCConfigUrl) {
      return _outerAjax(WBCConfigUrl, {
        domainUse: 'out',
        proxyUrl,
        responseType: 'json',
        type: 'GET',
        timeout: 5000,
        cacheControl: 'no-cache',
      });
    }

    function createGroupV2(groupName, groupAvatar, expiration, members) {
      const jsonData = {
        name: groupName,
        avatar: groupAvatar,
        messageExpiry: expiration,
        numbers: members,
      };

      return _ajax({
        call: 'groups',
        newAPI: true,
        httpType: 'PUT',
        responseType: 'json',
        jsonData,
      });
    }

    function upgradeGroupToV2(
      groupId,
      groupName,
      groupAvatar,
      expiration,
      members
    ) {
      const jsonData = {
        name: groupName,
        avatar: groupAvatar,
        messageExpiry: expiration,
        numbers: members,
      };

      return _ajax({
        call: 'groups',
        newAPI: true,
        httpType: 'PUT',
        responseType: 'json',
        urlParameters: `/${groupId}`,
        jsonData,
      });
    }

    function editGroupV2(
      groupId,
      groupName,
      groupOwner,
      groupAvatar,
      expiration,
      remindCycle
    ) {
      let jsonData = {};

      if (groupName) {
        jsonData.name = groupName;
      }

      if (groupOwner) {
        jsonData.owner = groupOwner;
      }

      if (groupAvatar) {
        jsonData.avatar = groupAvatar;
      }

      if (typeof expiration === 'number') {
        jsonData.messageExpiry = expiration;
      }

      if (remindCycle) {
        jsonData.remindCycle = remindCycle;
      }
      return _ajax({
        call: 'groups',
        newAPI: true,
        httpType: 'POST',
        responseType: 'json',
        jsonData,
        urlParameters: `/${groupId}`,
      });
    }

    function queryGroupV2(groupId) {
      return _ajax({
        call: 'groups',
        newAPI: true,
        httpType: 'GET',
        responseType: 'json',
        urlParameters: `/${groupId}`,
      });
    }

    function getGroupV2List() {
      return _ajax({
        call: 'groups',
        newAPI: true,
        httpType: 'GET',
        responseType: 'json',
      });
    }

    function addGroupV2Members(groupId, members) {
      let jsonData = {
        numbers: members,
      };

      return _ajax({
        call: 'groups',
        newAPI: true,
        httpType: 'PUT',
        responseType: 'json',
        urlParameters: `/${groupId}/members`,
        jsonData,
      });
    }

    function removeGroupV2Members(groupId, members) {
      let jsonData = {
        numbers: members,
      };

      return _ajax({
        call: 'groups',
        newAPI: true,
        httpType: 'DELETE',
        responseType: 'json',
        urlParameters: `/${groupId}/members`,
        jsonData,
      });
    }

    function addGroupAdmin(groupId, member) {
      let jsonData = {
        role: 1,
      };

      return _ajax({
        call: 'groups',
        newAPI: true,
        httpType: 'POST',
        responseType: 'json',
        urlParameters: `/${groupId}/members/${member}`,
        jsonData,
      });
    }

    function removeGroupAdmin(groupId, member) {
      let jsonData = {
        role: 2,
      };

      return _ajax({
        call: 'groups',
        newAPI: true,
        httpType: 'POST',
        responseType: 'json',
        urlParameters: `/${groupId}/members/${member}`,
        jsonData,
      });
    }

    function transferGroupOwner(groupId, member) {
      let jsonData = {
        owner: member,
      };

      return _ajax({
        call: 'groups',
        newAPI: true,
        httpType: 'POST',
        responseType: 'json',
        urlParameters: `/${groupId}`,
        jsonData,
      });
    }

    function editGroupV2Member(
      groupId,
      number,
      role,
      displayName,
      remark,
      notification,
      rapidRole
    ) {
      let jsonData = {};

      if (role) {
        jsonData.role = role;
      }

      if (displayName) {
        jsonData.displayName = displayName;
      }

      if (remark) {
        jsonData.remark = remark;
      }

      if (typeof notification === 'number') {
        jsonData.notification = notification;
      }

      if (typeof rapidRole === 'number') {
        jsonData.rapidRole = rapidRole;
      }
      return _ajax({
        call: 'groups',
        newAPI: true,
        httpType: 'POST',
        responseType: 'json',
        urlParameters: `/${groupId}/members/${number}`,
        jsonData,
      });
    }

    function getGroupV2Member(groupId, number) {
      return _ajax({
        call: 'groups',
        newAPI: true,
        httpType: 'GET',
        responseType: 'json',
        urlParameters: `/${groupId}/members`,
      });
    }

    function disbandGroupV2(groupId) {
      return _ajax({
        call: 'groups',
        newAPI: true,
        httpType: 'DELETE',
        responseType: 'json',
        urlParameters: `/${groupId}`,
      });
    }

    function getGroupV2InviteCode(groupId) {
      return _ajax({
        call: 'groups',
        newAPI: true,
        httpType: 'GET',
        responseType: 'json',
        urlParameters: `/invitation/${groupId}`,
      });
    }

    function getGroupV2InfoByInviteCode(groupInviteCode) {
      return _ajax({
        call: 'groups',
        newAPI: true,
        httpType: 'GET',
        responseType: 'json',
        urlParameters: `/invitation/groupInfo/${groupInviteCode}`,
      });
    }

    function joinGroupV2ByInviteCode(groupInviteCode) {
      return _ajax({
        call: 'groups',
        newAPI: true,
        httpType: 'PUT',
        responseType: 'json',
        urlParameters: `/invitation/join/${groupInviteCode}`,
      });
    }

    function editGroupV2OnlyOwner(groupId, data) {
      const {
        invitationRule,
        anyoneRemove,
        rejoin,
        publishRule,
        anyoneChangeName,
        linkInviteSwitch,
      } = data;
      const jsonData = {};

      if (invitationRule) {
        jsonData.invitationRule = invitationRule;
      }

      if (anyoneRemove !== undefined) {
        jsonData.anyoneRemove = anyoneRemove;
      }

      if (rejoin !== undefined) {
        jsonData.rejoin = rejoin;
      }

      if (publishRule) {
        jsonData.publishRule = publishRule;
      }

      if (anyoneChangeName !== undefined) {
        jsonData.anyoneChangeName = anyoneChangeName;
      }

      if (linkInviteSwitch) {
        jsonData.linkInviteSwitch = linkInviteSwitch;
      }

      return _ajax({
        call: 'groups',
        newAPI: true,
        httpType: 'POST',
        responseType: 'json',
        jsonData,
        urlParameters: `/${groupId}`,
      });
    }

    function unlinkCurrentDevice() {
      return _ajax({
        call: 'devices',
        httpType: 'DELETE',
        responseType: 'json',
      });
    }

    function reportException(exception) {
      return _ajax({
        call: 'reportException',
        httpType: 'POST',
        responseType: 'json',
        jsonData: exception,
        urlParameters: `?level=ERROR`,
      });
    }

    async function getFileServerToken(forceRefresh) {
      if (fileServerToken && !forceRefresh) {
        return fileServerToken;
      }

      if (refreshTokenTimer) {
        clearTimeout(refreshTokenTimer);
        refreshTokenTimer = undefined;
      }

      const result = await getToken();
      fileServerToken = result?.data?.token;
      if (!fileServerToken) {
        log.error('server response token is invalid.');
        throw new Error('server response invalid token.');
      }

      // 解析token有效期
      const items = fileServerToken.split('.');
      if (items.length >= 3) {
        try {
          const item = window.atob(items[1]);
          const obj = JSON.parse(item);
          if (obj.iat && obj.exp) {
            // 冗余10分钟吧
            tokenValidityPeriod = (obj.exp - obj.iat - 10 * 60) * 1000;
          }
        } catch (e) {}
      }

      if (refreshTokenTimer) {
        clearTimeout(refreshTokenTimer);
      }

      refreshTokenTimer = setTimeout(async () => {
        refreshTokenTimer = undefined;
        await getFileServerToken(true);
      }, tokenValidityPeriod);

      return fileServerToken;
    }

    // maybe undefined
    function getServerTokenDirect() {
      if (!fileServerToken) {
        setTimeout(async () => {
          await getFileServerToken();
        }, 0);
      }
      return fileServerToken;
    }

    async function requestFileServer(
      path,
      jsonData = {},
      options = {},
      returnData = true
    ) {
      const token = await getFileServerToken();
      const bodyJson = { ...jsonData };

      const upperType = options.type ? options.type.toUpperCase() : 'POST';

      const hasBody =
        Object.keys(bodyJson).length > 0 ||
        upperType === 'POST' ||
        upperType === 'PUT';

      if (hasBody) {
        bodyJson.token = token;
      }

      const useAuthorization =
        options.domainUse === 'voice' ||
        options.domainUse === 'miniProgram' ||
        // options.domainUse === 'device' ||
        // options.domainUse === 'ldap' ||
        options.domainUse === 'caption' ||
        // options.domainUse === 'risk' ||
        options.domainUse === 'chat';

      options = {
        path,
        domainUse: 'fileSharing',
        // certificateAuthority,
        contentType: 'application/json; charset=utf-8',
        proxyUrl,
        responseType: 'json',
        type: 'POST',
        // timeout: 0, // using default timeout
        newAPI: true,
        ...options,
        data: hasBody ? _jsonThing(bodyJson) : null,
        token,
        authorization: useAuthorization ? token : undefined,
      };

      let result;
      try {
        result = await _outerAjax(null, options);
      } catch (error) {
        const { response, name, code } = error;
        if (name === 'HTTPError' && code === 400) {
          const { status } = response;
          if (status === 2) {
            log.error('have no permission');
            error.code = 403;
            throw error;
          } else if (status === 5) {
            // invalid token
            // force refresh token and retry
            const retryToken = await getFileServerToken(true);
            if (hasBody) {
              bodyJson.token = retryToken;
            }

            options = {
              ...options,
              data: hasBody ? _jsonThing(bodyJson) : null,
              token: retryToken,
              authorization: useAuthorization ? retryToken : undefined,
            };
            result = await _outerAjax(null, options);
          } else if (
            status === 26002 ||
            status === 26003 ||
            status === 26004 ||
            status === 26005 ||
            status === 26006
          ) {
            if (status === 26006) {
              log.info(jsonData);
              throw error;
            }
            return response;
          } else {
            log.info(jsonData);
            throw error;
          }
        } else {
          throw error;
        }
      }

      if (returnData) {
        const { data } = result;
        if (!data) {
          log.error('there is no data field in response.');
          throw new Error('server response invalid data.');
        }
        if (options.domainUse === 'risk') {
          return result;
        }

        return data;
      }
    }

    function rapidUpload(rapidHash, numbers) {
      const path = 'v1/file/isExists';

      const jsonData = {
        fileHash: rapidHash,
        numbers,
      };
      return requestFileServer(path, jsonData);
    }

    function reportFileBroken(rapidHash, authorizeId) {
      const path = 'v1/file/delete';

      const jsonData = {
        fileHash: rapidHash,
        authorizeId,
      };
      return requestFileServer(path, jsonData);
    }

    function uploadData(requestUrl, data) {
      return _outerAjax(requestUrl, {
        domainUse: 'out',
        data,
        processData: false,
        proxyUrl,
        timeout: 15 * 60 * 1000,
        type: 'PUT',
      });
    }

    // attachment
    // {
    //   "fileHash":"11211131",
    //   "attachmentId":"eccb9bb4546f430989b3ee4b6f6a37c2",
    //   "fileSize":100,
    //   "hashAlg":"sha256",
    //   "keyAlg":"sha256",
    //   "encAlg":"sha256",
    // }
    function informUpload(attachment, numbers) {
      const path = 'v1/file/uploadInfo';
      const jsonData = {
        ...attachment,
        numbers,
      };
      return requestFileServer(path, jsonData);
    }

    function requestDownloadInfo(rapidHash, authorizeId, gid) {
      const path = 'v1/file/download';
      const jsonData = {
        fileHash: rapidHash,
        authorizeId,
        gid,
      };
      return requestFileServer(path, jsonData);
    }

    function downloadData(downloadUrl) {
      return _outerAjax(downloadUrl, {
        domainUse: 'out',
        // contentType: 'application/octet-stream',
        proxyUrl,
        responseType: 'arraybuffer',
        timeout: 15 * 60 * 1000,
        type: 'GET',
      });
    }

    async function getAttachmentNew(rapidHash, authorizeId, gid) {
      try {
        const dlInfo = await requestDownloadInfo(rapidHash, authorizeId, gid);

        const { fileSize, url } = dlInfo;
        const encryptedBin = await downloadData(url);

        log.info(
          'download fileSize, originalSize:',
          encryptedBin.byteLength,
          fileSize
        );

        return {
          ...dlInfo,
          encryptedBin,
        };
      } catch (error) {
        log.error('get attachment failed, ', error);
        throw error;
      }
    }

    async function putAttachmentNew(
      encryptedBin,
      binMD5,
      plaintextLen,
      ossUrl,
      attachmentId,
      rapidHash,
      numbers
    ) {
      try {
        // 1 upload data
        await uploadData(ossUrl, encryptedBin, binMD5);

        // 2 inform server a new uploaded file
        const attachment = {
          fileHash: rapidHash,
          attachmentId,
          fileSize: plaintextLen,
          hashAlg: 'SHA-256',
          keyAlg: 'SHA-512',
          encAlg: 'AES-CBC-256',
          cipherHash: binMD5,
          cipherHashType: 'MD5',
        };
        return await informUpload(attachment, numbers);
      } catch (error) {
        log.error('put attachment failed,', error);
        throw error;
      }
    }

    async function deleteAuthorization(rapidFiles) {
      if (!(rapidFiles instanceof Array && rapidFiles.length > 0)) {
        throw new Error('invalid rapid files array.');
      }

      const path = 'v1/file/delAuthorize';
      const jsonData = {
        delAuthorizeInfos: rapidFiles,
      };

      return requestFileServer(path, jsonData, {}, false);
    }

    async function putGroupAvatar(
      attachmentId,
      b64Key,
      b64Digest,
      groupIdV2,
      imageByteCount
    ) {
      const orign = {
        byteCount: imageByteCount + '',
        digest: b64Digest,
        encryptionKey: b64Key,
        serverId: attachmentId,
        attachmentType: 0,
        contentType: 'image/png',
      };
      let b64Avatar = window.Signal.Crypto.base64Encode(JSON.stringify(orign));
      return editGroupV2(
        groupIdV2,
        undefined,
        undefined,
        JSON.stringify({ data: b64Avatar })
      );
    }

    async function putAvatar(
      ossUrl,
      encryptedBin,
      attachmentId,
      encAlgo,
      encKey
    ) {
      try {
        await uploadData(ossUrl, encryptedBin);
        return await setProfile({
          avatar: JSON.stringify({ attachmentId, encAlgo, encKey }),
        });
      } catch (error) {
        log.error('put avatar failed,', error);
        throw error;
      }
    }

    async function getVoiceResponse(path, { type, authorization, data }) {
      const options = {
        path,
        domainUse: 'voice',
        contentType: 'application/json; charset=utf-8',
        responseType: 'json',
        type,
        authorization,
        data,
      };
      return _outerAjax(null, options);
    }
    function pingURL(requestUrl, mainDomain, userAgent) {
      return _outerAjax(requestUrl, {
        domainUse: 'out',
        certificateAuthority: mainDomain ? certificateAuthority : undefined,
        userAgent,
        type: 'GET',
      });
    }

    function securityCheck(content, contentType, messageId, senderId) {
      let jsonData = {};
      jsonData = {
        content: content,
        content_type: contentType,
        msg_sender_uid: senderId,
        msg_id: messageId,
      };
      const path = 'v2/content/riskCheck';
      return requestFileServer(path, jsonData, {
        domainUse: 'risk',
      });
    }

    async function translateContent(contents, targetLang, sourceLang) {
      const path = 'v1/translate';
      const jsonData = {
        sourceLang,
        targetLang,
        contents,
      };

      log.info('targetLang:', targetLang);

      return requestFileServer(path, jsonData, {
        domainUse: 'translate',
      });
    }

    function createLightTask(data) {
      return requestFileServer('api/v1/task/create', data, {
        domainUse: 'task',
      });
    }

    function deleteLightTask(data) {
      return requestFileServer(
        'api/v1/task/delete',
        data,
        { domainUse: 'task' },
        false
      );
    }

    function updateLightTask(data) {
      return requestFileServer('api/v1/task/update', data, {
        domainUse: 'task',
        type: 'PUT',
      });
    }

    function getLightTask(taskId) {
      return requestFileServer('api/v1/task/get/' + taskId, undefined, {
        domainUse: 'task',
        type: 'GET',
      });
    }

    function getLightTaskOperationLog(taskId, pageNumber, pageSize) {
      const path = 'api/v1/task/getOperLogs';

      if (typeof pageNumber != 'number') {
        pageNumber = 1;
      }

      if (typeof pageSize != 'number') {
        pageSize = 100;
      }

      const pathWithParams = `${path}?pageNum=${pageNumber}&pageSize=${pageSize}&tid=${taskId}`;

      return requestFileServer(
        pathWithParams,
        {},
        {
          domainUse: 'task',
          type: 'GET',
        }
      );
    }

    function getTaskList(pageNum, pageSize) {
      return requestFileServer(
        `api/v1/task/list?pageNum=${pageNum}&pageSize=${pageSize}`,
        undefined,
        { domainUse: 'task', type: 'GET' }
      );
    }

    function createExternalMeeting() {
      return requestFileServer(
        'v1/create-external-meeting',
        {},
        { domainUse: 'voice', type: 'POST' }
      );
    }

    function getMeetingOnlineUsers(channelName) {
      const cn = betterEncodeURIComponent(channelName);
      return requestFileServer(
        `v1/get-meeting-online-users?channelName=${cn}&t=${Date.now()}`,
        {},
        { domainUse: 'voice', type: 'GET' }
      );
    }

    function getExternalGroupMeeting(channelName, meetingName, invite) {
      return requestFileServer(
        'v1/get-external-group-rtc-token',
        { channelName, meetingName, invite },
        { domainUse: 'voice', type: 'PUT' }
      );
    }

    function uploadDeviceInfo(info) {
      return requestFileServer(
        'v1/uploadDeviceInfo',
        info,
        {
          domainUse: 'device',
          type: 'POST',
        },
        false
      );
    }

    function createVote(data) {
      return requestFileServer('api/v1/vote/create', data, {
        domainUse: 'vote',
      });
    }

    function voteItems(data) {
      return requestFileServer('api/v1/vote/user/add', data, {
        domainUse: 'vote',
      });
    }

    function getVoteResult(vid) {
      return requestFileServer('api/v1/vote/' + vid, undefined, {
        domainUse: 'vote',
        type: 'GET',
      });
    }

    // function sendMessageToGroup(destination, message, timestamp, silent) {
    //   const jsonData = { messages: [message], timestamp };
    //
    //   if (silent) {
    //     jsonData.silent = true;
    //   }
    //
    //   return _ajax({
    //     call: 'messages',
    //     httpType: 'PUT',
    //     urlParameters: `/group/${destination}`,
    //     jsonData,
    //     responseType: 'json',
    //   });
    // }
    //
    // function sendMessageToNumber(destination, message, timestamp, silent) {
    //   const jsonData = { messages: [message], timestamp };
    //
    //   if (silent) {
    //     jsonData.silent = true;
    //   }
    //
    //   return _ajax({
    //     call: 'messages',
    //     httpType: 'PUT',
    //     urlParameters: `/destination/${destination}`,
    //     jsonData,
    //     responseType: 'json',
    //   });
    // }

    function sendMessageV3ToNumber(destination, message, timestamp, silent) {
      const jsonData = { ...message };
      if (silent) {
        jsonData.silent = true;
      }
      if (timestamp) {
        jsonData.timestamp = timestamp;
      }
      return _ajax({
        call: 'messagesV3',
        httpType: 'PUT',
        urlParameters: `/${destination}`,
        jsonData,
        responseType: 'json',
      });
    }

    function sendMessageV3ToGroup(destination, message, timestamp, silent) {
      const jsonData = { ...message };
      if (silent) {
        jsonData.silent = true;
      }
      if (timestamp) {
        jsonData.timestamp = timestamp;
      }
      return _ajax({
        call: 'messagesV3',
        httpType: 'PUT',
        urlParameters: `/group/${destination}`,
        jsonData,
        responseType: 'json',
      });
    }

    /*
     * PIN功能相关错误码
     * status 2，不是群成员
     * status 3，群不存在（大概率群id传错了）
     * status 19，pinID不存在或者已经删除（大概率是传错了，或者已经被unpin了）
     * */
    // pin
    function createGroupPin(groupId, content, source) {
      return _ajax({
        call: 'groups',
        newAPI: true,
        httpType: 'PUT',
        responseType: 'json',
        // 服务端定的名字conversationId， 意义是唯一标识一个消息
        jsonData: { content, conversationId: source },
        urlParameters: `/${groupId}/pin`,
      });
    }

    function removeGroupPin(groupId, pins) {
      return _ajax({
        call: 'groups',
        newAPI: true,
        httpType: 'DELETE',
        responseType: 'json',
        jsonData: { pins },
        urlParameters: `/${groupId}/pin`,
      });
    }

    // 先不处理分页加载逻辑，以后再说
    function getGroupPins(groupId) {
      return _ajax({
        call: 'groups',
        newAPI: true,
        httpType: 'GET',
        responseType: 'json',
        urlParameters: `/${groupId}/pin`,
      });
    }

    // 获取小程序列表
    function getMpList() {
      return requestFileServer('v1/applications', undefined, {
        domainUse: 'miniProgram',
        type: 'GET',
      });
    }

    // 获取小程序token
    function getAppIdToken(appId) {
      return _ajax({
        call: 'token',
        urlParameters: `/token?appid=${appId}&scope=NameRead,EmailRead`,
        httpType: 'PUT',
        responseType: 'json',
      });
    }

    // 提交外部数据
    function postExternalUrl(httpUrl, token) {
      return _outerAjax(httpUrl, {
        domainUse: 'out',
        type: 'POST',
        responseType: 'json',
        token,
      });
    }

    function conversationToFront(conversationId) {
      const { number, groupId: gid } = conversationId || {};

      const jsonData = { number, gid };

      return _ajax({
        call: 'messages',
        httpType: 'POST',
        urlParameters: `/setPriorConversation`,
        responseType: 'json',
        jsonData,
      });
    }

    // 获取会议详情
    function getGroupMeetingDetails(meetingId) {
      return requestFileServer(
        'v1/get-group-meeting-detail?groupMeetingId=' + meetingId,
        undefined,
        {
          domainUse: 'voice',
          type: 'GET',
        }
      );
    }

    // 获取用户 extId
    function getUserExtInfo(number) {
      return _ajax({
        call: 'extInfo',
        httpType: 'GET',
        responseType: 'json',
        urlParameters: `/${number}`,
      });
    }

    // 获取当前登录者有权限的相关的所有的bu
    function getUserAccessedBUList() {
      return requestFileServer('v1/bu/accessedList', undefined, {
        domainUse: 'ldap',
        type: 'GET',
      });
    }

    // 获取当前登录者有权限的相关的所有的bu下的人
    function getMemberByBU(dn) {
      return requestFileServer(`v1/bu/members?dn=${dn}`, undefined, {
        domainUse: 'ldap',
        type: 'GET',
      });
    }

    // 获取有权搜索到的所有leader
    function getUserAccessedLeaderList() {
      return requestFileServer('v1/user/accessedLeaderList', undefined, {
        domainUse: 'ldap',
        type: 'GET',
      });
    }

    // 获取有权搜索到的所有leader下的人
    function getMemberByLeader(email) {
      return requestFileServer(
        `v1/user/membersByLeader?email=${email}`,
        undefined,
        {
          domainUse: 'ldap',
          type: 'GET',
        }
      );
    }

    function getRemoteConversations() {
      return _ajax({
        call: 'messages',
        httpType: 'GET',
        responseType: 'json',
        urlParameters: '/getConversationMsg',
      });
    }

    function getRemoteMessages(conversationId, seqIds, minSeqId, maxSeqId) {
      const { number, groupId: gid } = conversationId || {};

      const jsonData = {
        gid,
        number,
        sequenceIds: seqIds?.length ? seqIds : undefined,
        minSequenceId: minSeqId,
        maxSequenceId: maxSeqId,
      };

      return _ajax({
        call: 'messages',
        httpType: 'POST',
        responseType: 'json',
        urlParameters: '/getHotMsg',
        jsonData,
      });
    }

    function getRemoteReadPositions(
      conversationId,
      minServerTimestamp,
      maxServerTimestamp,
      self,
      page
    ) {
      const { number, groupId: gid } = conversationId || {};

      const jsonData = {
        gid,
        number,
        minServerTimestamp,
        maxServerTimestamp,
        self: !!self,
      };

      if (page) {
        jsonData.page = page;
      }

      return _ajax({
        call: 'readPositions',
        httpType: 'POST',
        responseType: 'json',
        urlParameters: '/getReadPosition',
        jsonData,
      });
    }

    function getCaptionSubtitles(channelName, meetingId, lang) {
      const path = `api/v1/caption/subtitles?channelName=${channelName}&meetingId=${meetingId}&lang=${lang}`;
      console.log('getCaptionSubtitles', path);
      return requestFileServer(
        path,
        undefined,
        {
          domainUse: 'caption',
          type: 'GET',
          newAPI: false,
        },
        true
      );
    }

    // 会议通知 - 用户退群
    function meetingNotifyGroupLeave(channelName) {
      return requestFileServer(
        'v1/group/leave',
        { channelName },
        {
          domainUse: 'voice',
          type: 'PUT',
        }
      );
    }

    // 会议通知 - 邀请用户入群
    function meetingNotifyGroupInvite(channelName) {
      return requestFileServer(
        'v1/group/invite',
        { channelName },
        {
          domainUse: 'voice',
          type: 'PUT',
        }
      );
    }

    // 会议通知 - 删除群成员
    function meetingNotifyGroupKick(channelName, users) {
      return requestFileServer(
        'v1/group/kick',
        { channelName, users },
        {
          domainUse: 'voice',
          type: 'PUT',
        }
      );
    }

    function getConversationSharedConfig() {
      return _ajax({
        call: 'conversationSharedConfig',
        httpType: 'GET',
        responseType: 'json',
      });
    }

    function getConversationSharedConfig(ourNumber, conversationId) {
      const { number, groupId } = conversationId || {};
      const jsonData = {};

      if (number) {
        if (number > ourNumber) {
          jsonData.conversations = [`${ourNumber}:${number}`];
        } else {
          jsonData.conversations = [`${number}:${ourNumber}`];
        }
      } else if (groupId) {
        jsonData.conversations = [groupId];
      } else {
        throw new Error('invalid conversationId');
      }

      // return _ajax({
      //   call: 'conversationSharedConfig',
      //   httpType: 'POST',
      //   responseType: 'json',
      //   jsonData,
      // });

      return requestFileServer(
        URL_CALLS['conversationSharedConfig'],
        jsonData,
        {
          domainUse: 'chat',
          type: 'POST',
          certificateAuthority,
        }
      );
    }

    function setConversationSharedConfig(ourNumber, conversationId, config) {
      const { number, groupId } = conversationId || {};

      let id;

      if (number) {
        if (number < ourNumber) {
          id = `${number}:${ourNumber}`;
        } else {
          id = `${ourNumber}:${number}`;
        }
      } else if (groupId) {
        id = groupId;
      } else {
        throw new Error('invalid conversationId');
      }

      // return _ajax({
      //   call: 'conversationSharedConfig',
      //   httpType: 'PUT',
      //   responseType: 'json',
      //   urlParameters: `${id}`,
      //   jsonData: config,
      // });

      return requestFileServer(
        `${URL_CALLS['conversationSharedConfig']}/${id}`,
        config,
        {
          domainUse: 'chat',
          type: 'PUT',
          certificateAuthority,
        }
      );
    }

    function getConversationConfig(idOrIds) {
      const jsonData = {};
      let ids = [];
      if (typeof idOrIds === 'object') {
        ids = [idOrIds];
      } else if (idOrIds instanceof Array && idOrIds?.length) {
        ids = idOrIds;
      }

      if (ids.length) {
        const conversations = [];

        ids.forEach(id => {
          if (!id) {
            return;
          }

          const { number, groupId } = id;
          const conversation = number || groupId;

          if (conversation) {
            conversations.push(conversation);
          }
        });

        Object.assign(jsonData, { conversations });
      }
      return _ajax({
        call: 'conversation',
        newAPI: true,
        httpType: 'POST',
        responseType: 'json',
        jsonData,
        urlParameters: `/get`,
        localLanguage: window.getLocalLanguage(),
      });
    }

    function setConversationConfig(conversationId, config) {
      const { number, groupId } = conversationId || {};
      const jsonData = {};

      const conversation = number || groupId;
      if (!conversation) {
        throw new Error('invalid conversationId');
      }

      const { muteStatus, blockStatus, confidentialMode } = config || {};
      if (typeof muteStatus === 'number') {
        Object.assign(jsonData, { muteStatus });
      }

      if (typeof blockStatus === 'number') {
        Object.assign(jsonData, { blockStatus });
      }

      if (typeof confidentialMode === 'number') {
        Object.assign(jsonData, { confidentialMode });
      }

      if (!Object.keys(jsonData).length) {
        throw new Error('emtpy valid config to set');
      }

      // set conversation
      Object.assign(jsonData, { conversation });

      return _ajax({
        call: 'conversation',
        newAPI: true,
        httpType: 'POST',
        responseType: 'json',
        jsonData,
        urlParameters: `/set`,
      });
    }
  }
}
