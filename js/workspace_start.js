/* global $, Whisper */

const setTheme = async theme => {
  if (theme === 'system') {
    const native = await window.getNativeSystemTheme();
    $(document.body)
      .removeClass('dark-theme')
      .removeClass('light-theme')
      .addClass(`${native}-theme`);
    return;
  }

  $(document.body)
    .removeClass('dark-theme')
    .removeClass('light-theme')
    .addClass(`${theme}-theme`);
};
setTheme(window.theme);

('use strict');

Whisper.MiniProgramView = new Whisper.ReactWrapperView({
  Component: window.getMiniProgramView(),
  props: {
    i18n: window.i18n,
  },
});

const $body = $(document.body);
window.setImmediate = window.nodeSetImmediate;
Whisper.MiniProgramView.$el.appendTo($body);
document.getElementById('php').remove();
