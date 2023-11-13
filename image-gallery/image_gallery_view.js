/*
  global
  window,
  document,
  Whisper,
  $,
*/
(() => {
  window.Whisper = window.Whisper || {};

  Whisper.ImageGalleryView = new Whisper.ReactWrapperView({
    Component: window.getImageGalleryView(),
    props: {},
  });

  const $body = $(document.body);
  window.setImmediate = window.nodeSetImmediate;
  Whisper.ImageGalleryView.$el.appendTo($body);
})();
