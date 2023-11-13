/*
  window,
*/

// eslint-disable-next-line no-unused-vars
class MpTokenManager {
  constructor() {
    window.log.info('MpTokenManager constructor()');
    this.appIdTokens = new Map();
  }

  static getAuthTimeout(authorization) {
    const items = authorization.split('.');
    if (items.length >= 3) {
      try {
        const item = window.atob(items[1]);
        const obj = JSON.parse(item);
        if (obj.exp && obj.iat) {
          return obj.exp - obj.iat;
        }
        // eslint-disable-next-line no-empty
      } catch (e) {}
    }
    return undefined;
  }

  async getAppToken(appId, forceWebApi) {
    window.log.info('getAppToken: appid=', appId);
    if (!appId) {
      throw Error('getAppToken bad param');
    }

    if (this.appIdTokens.has(appId) && !forceWebApi) {
      const item = this.appIdTokens.get(appId);
      if (item.expire > Date.now()) {
        window.log.info('getAppToken got cache, not expired');
        return { status: 0, token: item.token };
      }
    }

    if (!window.textsecure.messaging) {
      window.log.info('getAppToken messaging is undefined, NOT CONNECTED');
      return { status: -1 };
    }

    window.log.info('getAppToken http request start.');
    try {
      const data = await window.textsecure.messaging.getAppIdToken(appId);
      if (data && data.status === 0 && data.data && data.data.token) {
        const now = Date.now();
        const tokenExpiry = MpTokenManager.getAuthTimeout(data.data.token);
        if (!tokenExpiry) {
          throw Error('getAppToken bad token expire');
        }
        const expire = now + tokenExpiry * 1000 - 8 * 60 * 1000;
        this.appIdTokens.set(appId, { token: data.data.token, expire });

        window.log.info('getAppToken http request successfully.');
        return {
          status: 0,
          token: data.data.token,
          tokenExpiry: now + tokenExpiry * 1000,
        };
      }
    } catch (e) {
      window.log.info('getAppToken http request failed:', JSON.stringify(e));
    }

    return { status: -1 };
  }

  removeAppToken(appId) {
    window.log.info('removeAppToken: appid=', appId);
    if (this.appIdTokens.has(appId)) {
      this.appIdTokens.delete(appId);
    }
  }
}
window.MpTokenManager = new MpTokenManager();
