/* global Whisper: false */
/* global textsecure: false */

// eslint-disable-next-line func-names
(function () {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.ContactListView = Whisper.ListView.extend({
    tagName: 'div',
    itemView: Whisper.View.extend({
      tagName: 'div',
      className: 'contact',
      templateName: 'contact',
      initialize(options) {
        this.ourNumber = textsecure.storage.user.getNumber();
        this.listenBack = options.listenBack;

        this.listenTo(this.model, 'change', this.render);
      },
      render() {
        if (this.contactView) {
          this.contactView.remove();
          this.contactView = null;
        }

        // const isMe = this.ourNumber === this.model.id;

        this.contactView = new Whisper.ReactWrapperView({
          className: 'contact-wrapper',
          Component: window.Signal.Components.ContactListItem,
          props: {
            // isMe,
            id: this.model.id,
            color: this.model.getColor(),
            avatarPath: this.model.getAvatarPath(),
            phoneNumber: this.model.getNumber(),
            name: this.model.getName(),
            profileName: this.model.getProfileName(),
            verified: this.model.isVerified(),
            onClick: this.openConversation.bind(this),
          },
        });
        this.$el.append(this.contactView.el);
        return this;
      },
      showIdentity() {
        if (this.model.id === this.ourNumber) {
          return;
        }
        const view = new Whisper.KeyVerificationPanelView({
          model: this.model,
        });
        this.listenBack(view);
      },
      remove() {
        if (this.contactView) {
          this.contactView.remove();
        }
        Backbone.View.prototype.remove.call(this);
      },
      openConversation() {
        const number = this.model.getNumber();
        if (number && number.length > 0) {
          window.Whisper.events.trigger('showConversation', number);
        } else {
          log.error('open conversation failed, invalid model number.');
        }
      },
    }),
  });
})();
