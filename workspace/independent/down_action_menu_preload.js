const electron = require('electron');
const { ipcRenderer, contextBridge } = electron;

const dispatcher = (event, detail) => {
  if (!event) {
    return;
  }
  window.dispatchEvent(new CustomEvent(event, { detail }));
};

contextBridge.exposeInMainWorld('GLOBAL_API', {
  // API register
  getNativeSystemTheme: async () => {
    const theme = await ipcRenderer.invoke('get_global_theme');
    return theme;
  },
  openRecentLink: params => {
    ipcRenderer.send('open_recent_link', params);
  },
});

ipcRenderer.on('on_theme_change', (event, params) => {
  dispatcher('on_theme_change', params);
});
