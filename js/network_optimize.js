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

window.useGlobalConfigCache = () => {
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

    window.storage.put('tested-server-config', testedServerConfig);

    window.log.info('put tested-server-config', testedServerConfig);

    window.freshWebApiUrlCache(testedServerConfig);
    window.ipcFreshWebApiUrlCache(testedServerConfig);
  }, 0);
};

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
    if (fetchGlobalConfigStatus) {
      window.storage.put('global-config', globalConfig);
      window.log.info('put global-config', globalConfig);

      window.selectBestDomain();
    } else {
      window.log.error('load global config ALL failed');
    }
  }, 0);
};

window.getGlobalConfig = () => globalConfig;
window.getTestedServerConfig = () => testedServerConfig;

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

      if (isFirst) {
        setInterval(() => {
          window.fetchWBCConfig(false);
        }, 1000 * 60 * 60 * 3);
      }
    } else {
      window.log.error('load workspace beyondCorp config ALL failed');
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
