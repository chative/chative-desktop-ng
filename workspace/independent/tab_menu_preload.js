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
  tabMenuAction: params => {
    ipcRenderer.send('independent_view_navigate_control', params);
  },
});

ipcRenderer.on('on_theme_change', (event, params) => {
  dispatcher('on_theme_change', params);
});
