const electron = require('electron');
const { ipcRenderer, contextBridge } = electron;

window.displayType = 'independent';

const dispatcher = (event, detail) => {
  if (!event) {
    return;
  }
  window.dispatchEvent(new CustomEvent(event, { detail }));
};

window.GLOBAL_API = {
  // API register
  tryAgain: params => ipcRenderer.send('try_again', params),
  contactDeveloper: supportBot =>
    ipcRenderer.send('contact_developer', supportBot),
  showCommonToast,
  getPrivateContacts: async () => {
    console.log('getPrivateContacts start', Date.now());
    const privateContact = await ipcRenderer.invoke('get_private_contact');
    console.log('getPrivateContacts end', Date.now());
    return privateContact;
  },
};

window.BC_API = {
  // API register
  webApiSendCode: params =>
    ipcRenderer.send('beyondCorp_ssl_send_code', params),
  verifyCode: params => ipcRenderer.send('beyondCorp_ssl_verify_code', params),
};

ipcRenderer.on('beyondCorp_ssl_send_code_callback', (event, statusCode) => {
  dispatcher('on_ssl_send_code_result', { statusCode });
});
ipcRenderer.on('beyondCorp_ssl_verify_code_callback', (event, statusCode) => {
  dispatcher('on_ssl_verify_code_result', { statusCode });
});

// ------------------ JS BRIDGE ------------------
window.WKWVJBCallbacks = {};
window.localMaxTimer = {};
window.macOsInjectWKWebViewJavascriptBridge = () => {
  console.log('workspace browserView');
};
window.WKWebViewJavascriptBridge = {
  callHandler,
};
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
ipcRenderer.on('final_check', (_, params) => {
  ipcRenderer.send('final_check_callback', params);
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
  }, 2000);
}

window.getOurNumber = async () => {
  const uid = await ipcRenderer.invoke('get_our_number');
  return uid;
};

window.sendDotMessage = (channelName, toPrivateUser, mdText) => {
  ipcRenderer.send('send_dot_message', channelName, toPrivateUser, mdText);
};

ipcRenderer.on('navigate_share_note', event => {
  dispatcher('on_navigate_share_note', {});
});

ipcRenderer.on('on_open_new_window', (event, params) => {
  const { url } = params || {};
  if (!url) {
    return;
  }
  window.open(url);
});

window.addEventListener('mousedown', event => {
  ipcRenderer.send('close_menus');
});

window.onmousewheel = function (event) {
  ipcRenderer.send('close_menus');
};
