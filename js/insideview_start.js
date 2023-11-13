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

Whisper.MiniProgramInsideView = new Whisper.ReactWrapperView({
  Component: window.getMiniProgramInsideView(),
  props: {
    i18n: window.i18n,
    type: window.getInsideViewType(),
  },
});

const $body = $(document.body);
window.setImmediate = window.nodeSetImmediate;
Whisper.MiniProgramInsideView.$el.appendTo($body);
document.getElementById('inside-view-navigator').remove();
