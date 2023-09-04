const electron = require('electron');
const { ipcRenderer, contextBridge } = electron;

contextBridge.exposeInMainWorld('displayType', 'half');

const dispatcher = (event, detail) => {
  if (!event) {
    return;
  }
  window.dispatchEvent(new CustomEvent(event, { detail }));
};

contextBridge.exposeInMainWorld('GLOBAL_API', {
  // API register
  tryAgain: params => ipcRenderer.send('try_again', params),
  contactDeveloper: supportBot =>
    ipcRenderer.send('contact_developer', supportBot),
  showCommonToast,
});

contextBridge.exposeInMainWorld('BC_API', {
  // API register
  webApiSendCode: params =>
    ipcRenderer.send('beyondCorp_ssl_send_code', params),
  verifyCode: params => ipcRenderer.send('beyondCorp_ssl_verify_code', params),
});
ipcRenderer.on('beyondCorp_ssl_send_code_callback', (event, statusCode) => {
  dispatcher('on_ssl_send_code_result', { statusCode });
});
ipcRenderer.on('beyondCorp_ssl_verify_code_callback', (event, statusCode) => {
  dispatcher('on_ssl_verify_code_result', { statusCode });
});

// ------------------ JS BRIDGE ------------------
window.WKWVJBCallbacks = {};
window.localMaxTimer = {};
contextBridge.exposeInMainWorld(
  'macOsInjectWKWebViewJavascriptBridge',
  func => {
    console.log('workspace browserView');
  }
);
contextBridge.exposeInMainWorld('WKWebViewJavascriptBridge', {
  callHandler,
});
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
async function callHandler(methodName, params, callback) {
  const callbackid = uuid();
  callback(await bridgeRequest(methodName, params, callbackid));
}
async function bridgeRequest(methodName, params, callbackid) {
  ipcRenderer.send('on_js_bridge', {
    methodName,
    params,
    callbackid,
    isWebview: true,
  });
  return new Promise(resolve => {
    ipcRenderer.once(`on_js_bridge_callback_${callbackid}`, (event, info) => {
      if (window.localMaxTimer[callbackid]) {
        clearTimeout(window.localMaxTimer[callbackid]);
      }
      resolve(info);
    });
    if (methodName !== 'share') {
      window.localMaxTimer[callbackid] = setTimeout(() => {
        ipcRenderer.removeListener(
          `on_js_bridge_callback_${callbackid}`,
          () => {
            console.log(
              'js bridge callback timeout, remove listener',
              callbackid
            );
          }
        );
        resolve({
          ver: '1.0',
          action: methodName,
          status: 5012,
          reason: 'timeout',
          data: {},
        });
      }, 1000 * 30);
    }
  });
}
// ------------------ JS BRIDGE ------------------

// healthCheck
ipcRenderer.on('final_check', (_, browserType) => {
  ipcRenderer.send('final_check_callback', { browserType });
});

// toast
let toast;
let toastTimer;
ipcRenderer.on('on_toast', (_, message) => {
  showCommonToast(message);
});
function showCommonToast(message) {
  if (toast) {
    window.document.body.removeChild(toast);
  }
  if (toastTimer) {
    clearTimeout(toastTimer);
  }
  toast = window.document.createElement('div');
  toast.innerHTML = message;
  toast.style.position = 'fixed';
  toast.style.width = 'fit-content';
  toast.style.height = 'auto';
  toast.style.margin = 'auto';
  toast.style.top = '70px';
  toast.style.left = '0';
  toast.style.right = '0';
  toast.style.backgroundColor = '#2a2929';
  toast.style.color = '#fff';
  toast.style.padding = '8px 16px';
  toast.style.zIndex = '100';
  toast.style.borderRadius = '4px';
  window.document.body.appendChild(toast);
  toastTimer = setTimeout(() => {
    window.document.body.removeChild(toast);
    toast = undefined;
  }, 1500);
}
