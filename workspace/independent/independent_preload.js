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
  navigateControl: params => {
    ipcRenderer.send('independent_view_navigate_control', params);
  },
  maximizedWindow: () => ipcRenderer.send('maximized_window'),
  openDevtools: currentTabId => {
    ipcRenderer.send('open_devtools', currentTabId);
  },
  copyBcData: () => {
    ipcRenderer.send('copy_bc_data');
  },
  switchTab: params => ipcRenderer.send('switch_tab', params),
  removeMenuView: () => ipcRenderer.send('remove_menu_view'),
  closeTab: params => ipcRenderer.send('close_tab', params),
  showTabMenu: params => ipcRenderer.send('show_tab_menu', params),
  showDownActionMenu: params =>
    ipcRenderer.send('show_down_action_menu', params),
});

ipcRenderer.on('on_theme_change', (event, params) => {
  dispatcher('on_theme_change', params);
});

ipcRenderer.on('on_control_action', (event, params) => {
  dispatcher('on_control_action', params);
});

ipcRenderer.on('on_title_change', (event, params) => {
  dispatcher('on_title_change', params);
});

ipcRenderer.on('on_tab_title_change', (event, params) => {
  dispatcher('on_tab_title_change', params);
});

ipcRenderer.on('on_new_tab', (event, params) => {
  dispatcher('on_new_tab', params);
});

ipcRenderer.on('on_close_page', (event, params) => {
  dispatcher('on_close_page', params);
});

ipcRenderer.on('on_switch_tab', (event, params) => {
  dispatcher('on_switch_tab', params);
});

ipcRenderer.on('on_adapt_tab_size', (event, params) => {
  dispatcher('on_adapt_tab_size', params);
});
