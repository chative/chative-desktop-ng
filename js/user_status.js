/* global
  window,
  log,
  _,
*/

let GLOBAL_TOKEN_TIMEOUT = 45 * 60 * 1000;
const enableUserStatusLogging = false;

// eslint-disable-next-line no-unused-vars
class UserStatus {
  constructor(username, password) {
    this.username = username;
    this.password = password;
    this.token = undefined;
    this.tokenTimestamp = 0;

    // {times: 1, status: -1}
    this.userStatusMap = new Map();

    this.webapiServer = window.WebAPI.connect({ username, password });
    this.socket = undefined;
    this.socketConnected = false;

    this.fireChangeListenListBound = _.debounce(
      this.fireChangeListenList,
      5 * 1000
    );

    this.userStatus = 0; // 0-active 1-nodisturb 2-leave 3-calling 5-meeting
    this.setupMyStatusInterval = setInterval(() => {
      this.setupMyStatus();
    }, 5 * 60 * 1000);

    this.pingInterval = setInterval(() => {
      this.send('ping');
    }, 50 * 1000);

    this.reconnectInterval = setInterval(async () => {
      if (!this.socket || !this.socketConnected) {
        await this.connect();
        return;
      }

      if (this.socket.readyState !== 1) {
        await this.connect();
      }
    }, 45 * 1000);
  }

  UpdateMyStatus(status) {
    this.userStatus = status;
    const UserActive = {
      ver: '1',
      service: 'userStatusService',
      action: 'changeUserStatus',
      requestId: window.getGuid(),
      params: {
        status: this.userStatus,
      },
    };
    this.send(JSON.stringify(UserActive));
    log.info(`user_status.js changeUserStatus:${JSON.stringify(UserActive)}`);
  }

  UpdateNoDisturbStatus(status, expired) {
    const UserActive = {
      ver: '1',
      service: 'userStatusService',
      action: 'changeUserStatus',
      requestId: window.getGuid(),
      params: {
        status: status,
        expire: expired,
      },
    };
    this.send(JSON.stringify(UserActive));
    log.info(`user_status.js changeUserStatus:${JSON.stringify(UserActive)}`);
  }

  setupMyStatus() {
    const UserActive = {
      ver: '1',
      service: 'userStatusService',
      action: 'setUserActive',
      requestId: window.getGuid(),
      params: {
        status: this.userStatus,
      },
    };
    this.send(JSON.stringify(UserActive));
    log.info(`user_status.js setUserActive:${JSON.stringify(UserActive)}`);
  }

  fireChangeListenList() {
    const userArray = [];
    this.userStatusMap.forEach((v, k) => {
      if (v.times > 0) {
        userArray.push(k);
      }
    });

    if (userArray.length === 0) {
      const myEvent = new CustomEvent('event-user-status-changed', {
        detail: {},
      });
      window.dispatchEvent(myEvent);
      return;
    }

    const queryUser = {
      params: {
        numbers: userArray,
      },
      ver: '1',
      service: 'userStatusService',
      action: 'getUserStatus',
      requestId: window.getGuid(),
    };
    this.send(JSON.stringify(queryUser));
    if (enableUserStatusLogging)
      log.info(`user_status.js getUserStatus:${JSON.stringify(queryUser)}`);

    const listenList = {
      params: {
        numbers: userArray,
      },
      ver: '1',
      service: 'userStatusService',
      action: 'addListenUserStatus',
      requestId: window.getGuid(),
    };
    this.send(JSON.stringify(listenList));
    if (enableUserStatusLogging)
      log.info(
        `user_status.js addListenUserStatus:${JSON.stringify(listenList)}`
      );
  }

  addUserListen(user) {
    if (this.userStatusMap.has(user)) {
      const v = this.userStatusMap.get(user);
      v.times += 1;
      this.userStatusMap.set(user, v);

      if (v.times === 1) {
        this.fireChangeListenListBound();
      }

      if (v.status === -1) {
        return null;
      }

      let ts;
      if (v.status === 2 && v.timestamp && v.ts) {
        ts = v.ts + Math.floor((Date.now() - v.timestamp) / 1000);
      }
      return { detail: { user, status: v.status, ts, expire: v.expire } };
    }
    this.userStatusMap.set(user, { times: 1, status: -1, expire: -1 });
    this.fireChangeListenListBound();
    return null;
  }

  removeUserListen(user) {
    if (this.userStatusMap.has(user)) {
      const v = this.userStatusMap.get(user);
      v.times -= 1;
      this.userStatusMap.set(user, v);

      if (v.times <= 0 && v.status === -1) {
        this.userStatusMap.delete(user);
      }
    }
  }

  async getToken() {
    if (
      this.token &&
      this.tokenTimestamp &&
      Date.now() - this.tokenTimestamp < GLOBAL_TOKEN_TIMEOUT
    ) {
      return;
    }

    this.token = undefined;
    try {
      const tk = await this.webapiServer.getToken();
      if (tk && tk.status === 0 && tk.data && tk.data.token) {
        this.token = tk.data.token;
        this.tokenTimestamp = Date.now();

        const items = this.token.split('.');
        if (items.length >= 3) {
          try {
            const item = window.atob(items[1]);
            const obj = JSON.parse(item);
            if (obj.iat && obj.exp) {
              GLOBAL_TOKEN_TIMEOUT = (obj.exp - obj.iat - 10 * 60) * 1000;
            }
          } catch (e) {}
        }
        return;
      }
      // eslint-disable-next-line no-empty
    } catch (e) {}

    log.info('user_status.js getToken failed.');
  }

  onclose(event) {
    log.info(
      `user_status.js websocket onclose, code=${event.code} reason:${event.reason}`
    );
    this.socketConnected = false;
  }

  onerror() {
    log.info('user_status.js websocket onerror');
    this.socketConnected = false;
  }

  onopen() {
    log.info('user_status.js websocket connected!');
    this.socketConnected = true;

    this.setupMyStatus();
    this.fireChangeListenListBound();
  }

  dispatch(item, ct) {
    let ts;
    if (item.status === 2 && ct && item.timeStamp) {
      ts = Math.floor((ct - item.timeStamp) / 1000);
    }

    if (this.userStatusMap.has(item.number)) {
      const v = this.userStatusMap.get(item.number);
      v.status = item.status;
      v.expire = item.timeStamp;
      if (ts) {
        v.timestamp = Date.now();
        v.ts = ts;
      }
      this.userStatusMap.set(item.number, v);

      const ourNumber = textsecure.storage.user.getNumber();
      if (ourNumber === item.number) {
        Whisper.Notifications.setDontDistrub(item.status === 1);
        log.info(`user_status.js my status changed:${JSON.stringify(item)}`);
      }

      const myEvent = new CustomEvent('event-user-status-changed', {
        detail: {
          user: item.number,
          status: item.status,
          ts,
          expire: item.timeStamp,
        },
      });
      window.dispatchEvent(myEvent);
    }
  }

  onmessage(socketMessage) {
    if (socketMessage.data && !socketMessage.data.includes('param error!')) {
      if (enableUserStatusLogging)
        log.info('user_status.js onmessage', socketMessage.data);
    }

    let jsonObj;
    if (
      socketMessage &&
      socketMessage.type === 'message' &&
      socketMessage.data
    ) {
      try {
        jsonObj = JSON.parse(socketMessage.data);
        // eslint-disable-next-line no-empty
      } catch (e) {}
    }

    if (
      !jsonObj ||
      jsonObj.code !== 200 ||
      jsonObj.status !== 0 ||
      !jsonObj.data
    ) {
      return;
    }

    if (jsonObj.action === 'getUserStatus') {
      if (jsonObj.data.userStatus) {
        jsonObj.data.userStatus.forEach(item => {
          if (item.number && item.status >= 0) {
            this.dispatch(item, jsonObj.time);
          }
        });
      }
    }

    if (jsonObj.action === 'updateUserStatus') {
      const item = jsonObj.data;
      if (item && item.number && item.status >= 0) {
        this.dispatch(item, jsonObj.time);
      }
    }
  }

  send(data) {
    if (!this.socket || !this.socketConnected) {
      log.info(`user_status.js send failed, WEBSOCKET NOT CONNECTED${data}`);
      return;
    }

    // for some unknown reason, the onerror or onclose not fired.
    if (this.socket.readyState !== 1) {
      this.socketConnected = false;
      log.info(
        `user_status.js send failed, WEBSOCKET BAD readyState=${this.socket.readyState}`
      );
      return;
    }

    this.socket.send(data);
  }

  async connect() {
    log.info('user_status.js websocket connecting...');

    await this.getToken();
    if (!this.token) {
      return;
    }

    if (this.socket) {
      this.socket.onclose = null;
      this.socket.onerror = null;
      this.socket.onopen = null;
      this.socket.close();
      this.socket = null;
    }

    this.socket = this.webapiServer.getUserStatusSocket(this.token);
    this.socket.onclose = this.onclose.bind(this);
    this.socket.onerror = this.onerror.bind(this);
    this.socket.onopen = this.onopen.bind(this);
    this.socket.onmessage = this.onmessage.bind(this);
  }

  close() {
    log.info('user_status.js close.');

    const myEvent = new CustomEvent('event-user-status-changed', {
      detail: { clear: 'clear' },
    });
    window.dispatchEvent(myEvent);

    clearInterval(this.setupMyStatusInterval);
    clearInterval(this.pingInterval);
    clearInterval(this.reconnectInterval);

    if (this.socket) {
      this.socket.close();
      this.socket.onclose = null;
      this.socket.onerror = null;
      this.socket.onopen = null;
      this.socket = null;
    }
  }
}
