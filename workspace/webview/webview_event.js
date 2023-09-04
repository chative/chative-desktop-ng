window.onload = () => {
  window.addEventListener('on_title_change', handleTitleChange);
  window.addEventListener('on_theme_change', handleThemeChange);
};
window.onclose = () => {
  window.removeEventListener('on_title_change', handleTitleChange);
  window.removeEventListener('on_theme_change', handleThemeChange);
};

function handleTitleChange(params) {
  const { title } = params?.detail || {};
  if (!title) {
    return;
  }
  const e = document.getElementById('app_title');
  e.innerText = title;
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
