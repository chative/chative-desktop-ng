/*
  window,
*/

// eslint-disable-next-line no-unused-vars
class MpTokenManager {
  constructor() {
    window.log.info('MpTokenManager constructor()');
    /*
            key: appId
            value:
            {
                expire: 1629367946, // 过期时间戳（是根据当前时间和过期时间算出来的）
                token: 'xxx', // token字符串
            }
        */
    this.appIdTokens = new Map();
  }

  // 获取token有效期，单位秒
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

  /*
        返回值定义：
        {
            status: 0,  // 0：成功，-1：当前网络故障（）
            token: 'xxx'
        }
    */
  async getAppToken(appId, forceWebApi) {
    window.log.info('getAppToken: appid=', appId);
    if (!appId) {
      throw Error('getAppToken bad param');
    }

    // 本地有缓存，并且还未过期. 如果是强制拉取一次最新的，就不用缓存的
    if (this.appIdTokens.has(appId) && !forceWebApi) {
      const item = this.appIdTokens.get(appId);
      if (item.expire > Date.now()) {
        window.log.info('getAppToken got cache, not expired');
        return { status: 0, token: item.token };
      }
    }

    // 网络没连上, 直接返回网络故障
    if (!window.textsecure.messaging) {
      window.log.info('getAppToken messaging is undefined, NOT CONNECTED');
      return { status: -1 };
    }

    window.log.info('getAppToken http request start.');
    // 主服务器请求token
    try {
      const data = await window.textsecure.messaging.getAppIdToken(appId);
      if (data && data.status === 0 && data.data && data.data.token) {
        const now = Date.now();
        const tokenExpiry = MpTokenManager.getAuthTimeout(data.data.token);
        if (!tokenExpiry) {
          throw Error('getAppToken bad token expire');
        }
        // 需要做个冗余，就8分钟吧
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
