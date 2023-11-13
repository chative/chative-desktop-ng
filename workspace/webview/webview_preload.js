const electron = require('electron');
const { ipcRenderer, contextBridge } = electron;

const dispatcher = (event, detail) => {
  if (!event) {
    return;
  }
  window.dispatchEvent(new CustomEvent(event, { detail }));
};

// healthCheck
ipcRenderer.on('final_check', (_, browserType) => {
  ipcRenderer.send('final_check_callback', { browserType });
});

contextBridge.exposeInMainWorld('GLOBAL_API', {
  // API register
  getNativeSystemTheme: async () => {
    const theme = await ipcRenderer.invoke('get_global_theme');
    return theme;
  },
  navigateControl: action => {
    ipcRenderer.send('web_view_navigate_control', action);
  },
});

ipcRenderer.on('on_theme_change', (event, theme) => {
  if (!theme) {
    return;
  }
  dispatcher('on_theme_change', { theme });
});

ipcRenderer.on('on_title_change', (event, title) => {
  dispatcher('on_title_change', { title });
});
