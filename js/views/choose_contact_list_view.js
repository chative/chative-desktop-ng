/* global Whisper: false */
/* global textsecure: false */

// eslint-disable-next-line func-names
(function () {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.ChooseContactListView = Whisper.ListView.extend({
    tagName: 'div',
    itemView: Whisper.View.extend({
      tagName: 'div',
      className: 'contact',
      templateName: 'contact',
      initialize(options) {
        this.ourNumber = textsecure.storage.user.getNumber();
        this.listenBack = options.listenBack;
        this.showCloseBtn = options.showCloseBtn;
        this.listenTo(this.model, 'change', this.render);
      },
      render() {
        if (this.contactView) {
          this.contactView.remove();
          this.contactView = null;
        }

        const isMe = this.model.isMe();
        if (!this.model.isMe()) {
          this.contactView = new Whisper.ReactWrapperView({
            className: 'contact-wrapper',
            Component: window.Signal.Components.ChooseContactListItem,
            props: {
              isMe,
              showCloseBtn: this.showCloseBtn,
              color: this.model.getColor(),
              avatarPath: this.model.getAvatarPath(),
              phoneNumber: this.model.getNumber(),
              name: this.model.getName(),
              profileName: this.model.getProfileName(),
              verified: this.model.isVerified(),
              onClick: this.didChooseItem.bind(this),
              id: this.model.id,
              email: this.model.get('email'),
            },
          });
          this.$el.append(this.contactView.el);
        }

        return this;
      },
      didChooseItem() {
        this.listenBack(this.model);
      },
      remove() {
        if (this.contactView) {
          this.contactView.remove();
        }
        Backbone.View.prototype.remove.call(this);
      },
    }),
  });
})();
