let luckInput = '';
function handleKeydown(e) {
  const { key, keyCode } = e || {};
  if (keyCode === 13 && luckInput.endsWith('showmethedev')) {
    window.GLOBAL_API.openDevtools(currentTabId);
    return;
  }
  if (keyCode === 13 && luckInput.endsWith('givemethetoken')) {
    window.GLOBAL_API.copyBcData();
    return;
  }
  luckInput += key?.toLowerCase();
}

window.onload = () => {
  window.addEventListener('on_control_action', handleControlAction);
  window.addEventListener('on_title_change', handleTitleChange);
  window.addEventListener('on_tab_title_change', handleTabTitleChange);
  window.addEventListener('on_theme_change', handleThemeChange);
  window.addEventListener('keydown', handleKeydown);
  window.addEventListener('on_new_tab', handleNewTab);
  window.addEventListener('on_close_page', handleClosePage);
  window.addEventListener('on_switch_tab', handleSwitchTab);
  window.addEventListener('on_adapt_tab_size', handleTabAverageWidth);
};
window.onclose = () => {
  window.removeEventListener('on_control_action', handleControlAction);
  window.removeEventListener('on_title_change', handleTitleChange);
  window.removeEventListener('on_tab_title_change', handleTabTitleChange);
  window.removeEventListener('on_theme_change', handleThemeChange);
  window.removeEventListener('keydown', handleKeydown);
  window.removeEventListener('on_new_tab', handleNewTab);
  window.removeEventListener('on_close_page', handleClosePage);
  window.removeEventListener('on_switch_tab', handleSwitchTab);
  window.removeEventListener('on_adapt_tab_size', handleTabAverageWidth);
};

let currentTabId;
let tabIdList = [];

function handleTabTitleChange(params) {
  const { tabId, title } = params?.detail || {};
  document.getElementById(`tab_item_title_${tabId}`).innerHTML = title;
}

function handleControlAction(params) {
  const { canGoBack, canGoForward, tabId } = params?.detail || {};

  // 不是当前展示的 tab，不处理
  if (currentTabId && tabId !== currentTabId) {
    return;
  }

  if (canGoBack) {
    document.getElementById('goBack').classList.remove(['forbidden_control']);
  } else {
    document.getElementById('goBack').classList.add(['forbidden_control']);
  }
  if (canGoForward) {
    document
      .getElementById('goForward')
      .classList.remove(['forbidden_control']);
  } else {
    document.getElementById('goForward').classList.add(['forbidden_control']);
  }
}

function handleTitleChange(params) {
  const { title } = params?.detail || {};
  if (!title) {
    return;
  }
  document.title = title;
}

async function handleThemeChange(params) {
  const { theme } = params?.detail || {};
  if (theme === 'system') {
    const native = await window.GLOBAL_API.getNativeSystemTheme();
    document.body.classList.remove(['dark-theme']);
    document.body.classList.remove(['light-theme']);
    document.body.classList.add([`${native}-theme`]);
    return;
  }
  document.body.classList.remove(['dark-theme']);
  document.body.classList.remove(['light-theme']);
  document.body.classList.add([`${theme}-theme`]);
}

function handleClosePage(params) {
  const { tabId, bridgeClose } = params?.detail || {};

  const e = document.getElementById(`tab_item_${tabId}`);
  document.getElementById('tab_box').removeChild(e);

  if (tabIdList.length === 1 && tabIdList[0] === tabId) {
    if (bridgeClose) {
      window.GLOBAL_API.closeTab({ tabId });
    }
    return;
  }

  const index = tabIdList.indexOf(tabId);

  // 当前关闭的 tab 不存在
  if (index === -1) {
    return;
  }

  let switchTabId;

  if (index === tabIdList.length - 1) {
    switchTabId = tabIdList[tabIdList.length - 2];
  } else {
    switchTabId = tabIdList[index + 1];
  }

  tabIdList = tabIdList.filter(item => item !== tabId);

  handleSwitchTab({ detail: { tabId: switchTabId } });

  window.GLOBAL_API.closeTab({ tabId });

  window.GLOBAL_API.switchTab({ tabId: switchTabId, inWindow: true });
}

function handleTabAverageWidth() {
  const tabItem = document.getElementsByClassName('tab_item');
  const tabBox = document.getElementById('tab_box');
  const reachLimit = tabBox.clientWidth <= 88 * tabIdList.length;

  Array.from(tabItem).forEach((item, index) => {
    const currentIndexTabId = item.id.split('_')[2];
    const closeBox = document.getElementById(
      `tab_item_close_box_${currentIndexTabId}`
    );
    const moreActionBox = document.getElementById(
      `tab_item_more_action_box_${currentIndexTabId}`
    );
    const title = document.getElementById(
      `tab_item_title_${currentIndexTabId}`
    );

    item.classList.remove(['focus_tab_limit_width']);

    if (tabIdList.length > 1) {
      if (reachLimit) {
        // 到达限定的长度
        if (item.id === `tab_item_${currentTabId}`) {
          // 当前 tab 固定长度 72 px，只展示 按钮
          item.classList.add(['focus_tab_limit_width']);
          title.style.display = 'none';
          closeBox.style.display = 'inline-flex';
          moreActionBox.style.display = 'inline-flex';
        } else {
          // 其他 tab，只展示 title
          moreActionBox.style.display = 'none';
          closeBox.style.display = 'none';
          title.style.display = 'inline-block';
          title.style.width = '100%';
          title.style.paddingRight = '16px';
          item.style.width = `${
            (tabBox.clientWidth - 72) / tabIdList.length
          }px`;
        }
      } else {
        if (item.id === `tab_item_${currentTabId}`) {
          // 当前 tab 展示 title 和 按钮
          closeBox.style.display = 'inline-flex';
          moreActionBox.style.display = 'inline-flex';
          title.style.display = 'inline-block';
          title.style.width = 'calc(100% - 56px)';
          title.style.paddingRight = '0';
        } else {
          // 其他 tab，只展示 title
          moreActionBox.style.display = 'none';
          closeBox.style.display = 'none';
          title.style.display = 'inline-block';
          title.style.width = '100%';
          title.style.paddingRight = '16px';
        }
        // 所有 tab 均分长度
        item.style.width = '100%';
      }
    } else {
      item.classList.remove(['focus_tab_min_width']);
      closeBox.style.display = 'inline-flex';
      moreActionBox.style.display = 'inline-flex';
      item.style.width = '100%';
    }
  });
}

function focusTabStyle(tabId) {
  // 只有一个 tab 的话，样式是固定的
  if (tabIdList.length <= 1) {
    const tabItem = document.getElementById(`tab_item_${tabIdList[0]}`);
    tabItem.classList.remove(['tab_item_bgc_now']);
    tabItem.classList.remove(['tab_item_bgc']);
    tabItem.classList.add(['tab_item_bgc']);
    return;
  }

  const tabItem = document.getElementsByClassName('tab_item');
  Array.from(tabItem).forEach((item, index) => {
    if (index === 0) {
      item.classList.remove(['tab_item_first']);
      item.classList.add(['tab_item_first']);
    }
    if (`tab_item_${tabId}` === item.id) {
      item.classList.remove(['tab_item_bgc_now']);
      item.classList.remove(['tab_item_bgc']);
      item.classList.add(['tab_item_bgc_now']);
    } else {
      item.classList.remove(['tab_item_bgc_now']);
      item.classList.remove(['tab_item_bgc']);
      item.classList.add(['tab_item_bgc']);
    }
  });
}

function adaptLonelyTab() {
  const tabItem = document.getElementById(`tab_item_${tabIdList[0]}`);
  const tabItemClose = document.getElementById(
    `tab_item_close_box_${tabIdList[0]}`
  );
  const tabItemTitle = document.getElementById(
    `tab_item_title_${tabIdList[0]}`
  );
  if (tabIdList.length > 1) {
    tabItem.classList.remove(['lonley_tab_item']);
    tabItemClose.classList.remove(['lonley_tab_item_close']);
    tabItemTitle.classList.remove(['lonley_tab_item_title']);
  } else if (tabIdList.length === 1) {
    // tabItem.classList.remove(['tab_item_bgc_now','tab_item_bgc']);
    tabItem.classList.add(['lonley_tab_item']);
    tabItemClose.classList.add(['lonley_tab_item_close']);
    tabItemTitle.classList.add(['lonley_tab_item_title']);
  }
}

function handleSwitchTab(params) {
  const { tabId } = params?.detail || {};

  if (currentTabId === tabId) {
    return;
  }

  currentTabId = tabId;

  tabIdList.push(tabId);
  // 数组去重复
  tabIdList = Array.from(new Set(tabIdList));

  adaptLonelyTab();

  focusTabStyle(tabId);

  handleTabAverageWidth();
}

function handleNewTab(params) {
  const { tabId, appName } = params?.detail || {};

  const tabItem = document.createElement('div');
  tabItem.classList.add(['tab_item']);
  tabItem.id = `tab_item_${tabId}`;

  const title = document.createElement('div');
  title.classList.add(['tab_item_title']);
  title.id = `tab_item_title_${tabId}`;
  title.innerHTML = appName;
  title.addEventListener('mousedown', event => {
    // 1-单击, 2-右击
    const { buttons, clientX, clientY } = event || {};
    if (buttons === 1 || buttons === 2) {
      if (currentTabId === tabId) {
        return;
      }
      handleSwitchTab({ detail: { tabId } });
      window.GLOBAL_API.switchTab({ tabId, inWindow: true });
    }
  });
  title.addEventListener('click', event => {
    window.GLOBAL_API.removeMenuView();
  });

  const closeBox = document.createElement('div');
  closeBox.classList.add(['tab_item_close_box']);
  closeBox.id = `tab_item_close_box_${tabId}`;
  const close = document.createElement('div');
  close.classList.add(['tab_item_close']);
  close.id = `tab_item_close_${tabId}`;
  closeBox.addEventListener('click', () => {
    handleClosePage({ detail: { tabId } });
  });
  closeBox.appendChild(close);

  const handleMoreAction = event => {
    const { clientX, clientY } = event || {};
    window.GLOBAL_API.showTabMenu({
      tabId,
      clientX,
      clientY,
    });
  };
  const moreActionBox = document.createElement('div');
  moreActionBox.classList.add(['tab_item_more_action_box']);
  moreActionBox.id = `tab_item_more_action_box_${tabId}`;
  const moreAction = document.createElement('div');
  moreAction.classList.add(['tab_item_more_action']);
  moreActionBox.addEventListener('click', handleMoreAction);
  moreActionBox.appendChild(moreAction);

  tabItem.appendChild(title);
  tabItem.appendChild(closeBox);
  tabItem.appendChild(moreActionBox);

  document.getElementById('tab_box').appendChild(tabItem);

  handleSwitchTab({ detail: { tabId } });
}

// 右侧下拉菜单
const downElement = document.getElementById('downAction');
if (downElement) {
  downElement.addEventListener('click', downAction);
}
function downAction(event) {
  const { clientX, clientY } = event || {};
  window.GLOBAL_API.showDownActionMenu({
    tabId: currentTabId,
    clientX,
    clientY,
  });
}
