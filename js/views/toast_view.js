/* global Whisper, Mustache, _ */

// eslint-disable-next-line func-names
(function () {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.ToastView = Whisper.View.extend({
    className: 'toast',
    templateName: 'toast',
    initialize() {
      this.$el.hide();
    },

    close() {
      this.$el.fadeOut(this.remove.bind(this));
    },

    render() {
      this.$el.html(
        Mustache.render(
          _.result(this, 'template', ''),
          _.result(this, 'render_attributes', '')
        )
      );
      this.$el.show();
      setTimeout(this.close.bind(this), 2000);
    },
  });

  Whisper.CenterToastView = Whisper.View.extend({
    className: 'center-toast',
    templateName: 'toast',
    initialize() {
      this.$el.hide();
    },

    close() {
      this.$el.fadeOut(this.remove.bind(this));
    },

    render() {
      this.$el.html(
        Mustache.render(
          _.result(this, 'template', ''),
          _.result(this, 'render_attributes', '')
        )
      );
      this.$el.show();
      setTimeout(this.close.bind(this), 2000);
    },
  });

  Whisper.BlockToastView = Whisper.View.extend({
    className: 'block-bot-toast',
    templateName: 'toast',
    initialize() {
      this.$el.hide();
    },

    close() {
      this.$el.remove();
    },

    render() {
      this.$el.html(
        Mustache.render(
          _.result(this, 'template', ''),
          _.result(this, 'render_attributes', '')
        )
      );
      this.$el.show();
    },
  });
})();
