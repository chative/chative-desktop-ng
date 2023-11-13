/* global $, Whisper */

('use strict');

Whisper.EmailVerifyView = new Whisper.ReactWrapperView({
  Component: window.getEmailVerifyView(),
  props: {
    i18n: window.i18n,
  },
});

const $body = $(document.body);
window.setImmediate = window.nodeSetImmediate;
Whisper.EmailVerifyView.$el.appendTo($body);
