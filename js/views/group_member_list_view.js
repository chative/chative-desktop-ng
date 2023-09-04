/* global Whisper, i18n */

// eslint-disable-next-line func-names
(function () {
  'use strict';

  window.Whisper = window.Whisper || {};

  // TODO: take a title string which could replace the 'members' header
  Whisper.GroupMemberList = Whisper.View.extend({
    className: 'group-member-list panel',
    templateName: 'group-member-list',
    initialize(options) {
      this.needVerify = options.needVerify;

      this.render();

      this.member_list_view = new Whisper.ContactListView({
        collection: this.model,
        className: 'members',
        toInclude: {
          listenBack: options.listenBack,
        },
      });
      this.member_list_view.render();

      this.listenTo(this.model, 'update reset', this.render_list);

      this.$('.container').append(this.member_list_view.el);
    },
    render_attributes() {
      let summary;
      if (this.needVerify) {
        summary = i18n('membersNeedingVerification');
      }

      return {
        members: i18n('groupMembers'),
        summary,
      };
    },
    render_list() {
      this.member_list_view.render();
    },
    remove() {
      if (this.member_list_view) {
        this.member_list_view.remove();
      }
      Backbone.View.prototype.remove.call(this);
    },
  });
})();
