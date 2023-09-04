/*
  主窗口引用此文件
  功能：
  1.[全局配置] 和 [域名测速结果] 缓存设置读取
  2.网络测速，选择最优域名
* */

let { globalConfig, WBCConfig } = window;
let testedServerConfig = {};

{
  const _domainTypes = window.dynamicDomainTypes;
  for (let i = 0; i < _domainTypes.length; i += 1) {
    const itemType = _domainTypes[i];
    testedServerConfig[itemType] = [];
    for (let j = 0; j < globalConfig.servers[itemType].length; j += 1) {
      testedServerConfig[itemType].push({
        url: globalConfig.servers[itemType][j],
        ms: 1,
      });
    }
  }
}

// 有缓存则使用缓存，否则使用写死的配置
window.useGlobalConfigCache = () => {
  // 新增字段, 本地缓存若没有这些域名，丢弃本地缓存
  function hasAllServers(servers) {
    const newItems = [
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
    for (let i = 0; i < newItems.length; i += 1) {
      if (!servers[newItems[i]]) {
        return false;
      }
    }
    return true;
  }

  let tmp = window.storage.get('global-config');
  if (tmp && hasAllServers(tmp)) {
    globalConfig = tmp;
  }

  tmp = window.storage.get('tested-server-config');
  if (tmp && hasAllServers(tmp)) {
    testedServerConfig = tmp;
  }

  window.log.info('global-config cache get:', globalConfig);
  window.log.info('tested-server-config cache get:', testedServerConfig);
  window.freshWebApiUrlCache(testedServerConfig);
};

async function promiseAllTestUrlGet(theServers, mainDomain) {
  if (theServers.length === 1) {
    return [{ url: theServers[0], ms: 1 }];
  }
  const testUrlGet = async (url, isChat) =>
    new Promise(resolve => {
      resolve(
        (async () => {
          const reqStart = Date.now();
          try {
            await window
              .getAccountManager()
              .pingURL(`${url}?t=${Date.now()}`, isChat);
            return Date.now() - reqStart;
          } catch (err) {
            if (err && err.code >= 100 && err.code <= 599) {
              return Date.now() - reqStart;
            }
          }
          return 0;
        })()
      );
    });

  const reqs = [];
  for (let i = 0; i < theServers.length; i += 1) {
    reqs.push(testUrlGet(theServers[i], mainDomain));
  }
  const result = await Promise.allSettled(reqs);
  const ms = [];
  for (let i = 0; i < reqs.length; i += 1) {
    if (result[i].status === 'fulfilled') {
      ms.push({ url: theServers[i], ms: result[i].value });
    }
  }

  ms.sort((a, b) => a.ms - b.ms);
  return ms;
}

// 选取最优域名, 每30分钟最多做一次
let lastSelectBestDomainTimestamp = 0;
window.selectBestDomain = () => {
  if (
    lastSelectBestDomainTimestamp &&
    Date.now() - lastSelectBestDomainTimestamp < 30 * 60 * 1000
  ) {
    return;
  }
  lastSelectBestDomainTimestamp = Date.now();
  const { servers } = globalConfig;

  // 网速测试
  setTimeout(async () => {
    const _domainTypes = window.dynamicDomainTypes;
    for (let index = 0; index < _domainTypes.length; index += 1) {
      const domain = _domainTypes[index];
      // eslint-disable-next-line no-await-in-loop
      testedServerConfig[domain] = await promiseAllTestUrlGet(
        servers[domain],
        index === 0
      );
    }

    // 存储过滤后的域名
    window.storage.put('tested-server-config', testedServerConfig);

    window.log.info('put tested-server-config', testedServerConfig);

    // 刷新web_api.js缓存
    window.freshWebApiUrlCache(testedServerConfig);
    window.ipcFreshWebApiUrlCache(testedServerConfig);
  }, 0);
};

// 网络请求全局
window.fetchGlobalConfig = () => {
  setTimeout(async () => {
    let fetchGlobalConfigStatus = false;
    const { globalConfigURLs } = window;
    for (let i = 0; i < globalConfigURLs.length; i += 1) {
      const url = globalConfigURLs[i];
      try {
        // eslint-disable-next-line no-await-in-loop
        const config = await window.getAccountManager().getGlobalConfig(url);
        if (config.code === 0 && config.data) {
          globalConfig = config.data;
          fetchGlobalConfigStatus = true;
          break;
        }
      } catch (e) {
        window.log.error(`load global config failed: ${url}, e=`, e);
      }
    }
    // 刷新内存数据，使用最新的
    if (fetchGlobalConfigStatus) {
      // 存储全局配置缓存
      window.storage.put('global-config', globalConfig);
      window.log.info('put global-config', globalConfig);

      // 选取速度最快的服务器（排序）
      window.selectBestDomain();
    } else {
      window.log.error('load global config ALL failed');
    }
  }, 0);
};

window.getGlobalConfig = () => globalConfig;
window.getTestedServerConfig = () => testedServerConfig;

// 预加载缓存或者本地数据库中的配置
window.preloadWBCConfig = () => {
  try {
    window.WBCConfig = window.storage.get('wbc_config') || {};
    window.log.info('preload workspaceBeyondCorpConfig', window.WBCConfig);
    window.cacheWBCConfigInMainThread(window.WBCConfig);
  } catch (e) {
    window.log.error('preload workspaceBeyondCorpConfig error', e);
  }
};

window.fetchWBCConfig = async (isFirst = true) => {
  try {
    let fetchStatus = false;
    const { WBCConfigUrls } = window || {};
    for (let i = 0; i < WBCConfigUrls?.length; i += 1) {
      const url = WBCConfigUrls[i];
      try {
        // eslint-disable-next-line no-await-in-loop
        const config = await window.getAccountManager().getWBCConfig(url);
        if (config) {
          window.WBCConfig = config;
          fetchStatus = true;
          break;
        }
      } catch (e) {
        window.log.error(
          `load workspace beyondCorp config failed: ${url}, e=`,
          e
        );
      }
    }

    if (fetchStatus) {
      window.storage.put('wbc_config', window.WBCConfig);
      window.log.info('put wbc_config', window.WBCConfig);
      window.cacheWBCConfigInMainThread(window.WBCConfig);

      // 如果是第一次并且成功了，那么就启动定时器，每 3 小时拉取一次
      if (isFirst) {
        setInterval(() => {
          window.fetchWBCConfig(false);
        }, 1000 * 60 * 60 * 3);
      }
    } else {
      window.log.error('load workspace beyondCorp config ALL failed');
      // 如果时第一次拉去失败了，那么就每间隔 15 秒重复拉，直到成功为止
      if (isFirst) {
        setTimeout(() => {
          window.fetchWBCConfig(true);
        }, 1000 * 15);
      }
    }
  } catch (e) {
    window.log.info('fetch workspaceBeyondCorpConfig error', e);
  }
};
