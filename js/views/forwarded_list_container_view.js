/* global Whisper, i18n */

// eslint-disable-next-line func-names
(function () {
  'use strict';

  window.Whisper = window.Whisper || {};

  // TODO: take a title string which could replace the 'members' header
  Whisper.ForwardedListContainerView = Whisper.View.extend({
    className: 'forwarded-list-container panel forward',
    templateName: 'forwarded-list-container',
    initialize() {
      this.render();

      this.member_list_view = new Whisper.ForwardedMessageListView({
        collection: this.model,
      });
      this.member_list_view.render();

      this.$('.forwarded-message-container').append(this.member_list_view.el);
    },
    remove() {
      if (this.member_list_view) {
        this.member_list_view.remove();
      }
      Backbone.View.prototype.remove.call(this);
    },
  });
})();
