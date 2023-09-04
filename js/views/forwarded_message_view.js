/* global Whisper: false */

// eslint-disable-next-line func-names
(function () {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.ForwardedMessageView = Whisper.View.extend({
    tagName: 'li',
    id() {
      return this.model.id;
    },
    events: {
      onShow: 'onShow',
      destroy: 'onDestroy',
    },
    initialize(options) {
      this.observer = options.observer;

      this.listenTo(this.model, 'destroy', this.onDestroy);
      this.listenTo(this.model, 'unload', this.onUnload);

      if (this.observer) {
        this.observer.observe(this.el);
      }

      this.triggerCheckUrl = _.debounce(
        () => {
          this.model.attributes.riskCheck(this.model);
        },
        5000,
        true
      );
    },
    onChange() {
      this.addId();
    },
    onShow() {
      if (this.childView) {
        this.triggerCheckUrl();
      }
    },
    addId() {
      // The ID is important for other items inserting themselves into the DOM. Because
      //   of ReactWrapperView and this view, there are two layers of DOM elements
      //   between the parent and the elements returned by the React component, so this is
      //   necessary.
      const { id } = this.model;
      this.$el.attr('id', id);
    },
    onUnload() {
      if (this.observer) {
        this.observer.unobserve(this.el);
      }

      if (this.childView) {
        this.childView.remove();
      }

      this.remove();
    },
    onDestroy() {
      this.onUnload();
    },

    render() {
      this.addId();

      if (this.childView) {
        this.childView.remove();
        this.childView = null;
      }

      const update = () => {
        this.childView.update(this.model.attributes);
      };

      this.listenTo(this.model, 'change', update);

      this.childView = new Whisper.ReactWrapperView({
        className: 'message-wrapper-outer',
        Component: window.Signal.Components.Message,
        props: this.model.attributes,
      });

      this.$el.append(this.childView.el);

      return this;
    },
  });
})();
