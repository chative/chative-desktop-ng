/* global i18n: false */
/* global Whisper: false */
/* global $: false */

/* eslint-disable no-new */

// eslint-disable-next-line func-names
(function () {
  'use strict';

  window.Whisper = window.Whisper || {};
  const { Settings } = window.Signal.Types;

  // const InputEditorView = Whisper.View.extend({
  //   initialize(options) {
  //     this.name = options.name;
  //     this.setFn = options.setFn;
  //     this.value = options.value;
  //     this.disabled = options.disabled;
  //     this.populate();
  //     this.disable(this.disabled);
  //   },
  //   events: {
  //     change: 'change',
  //     // input: 'input',
  //   },
  //   change(e) {
  //     const value = this.$(e.target).val();
  //     this.setFn(value);
  //     window.log.info(this.name, 'changed to', value);
  //   },
  //   hide() {
  //     this.$('input').hide();
  //   },
  //   populate() {
  //     this.$('input').val(this.value);
  //   },
  //   input() {
  //     let input = this.$('input')[0];
  //     input.style.width = '0px';
  //     input.style.width = input.scrollWidth + 'px';
  //   },
  //   disable(disable) {
  //     this.$('input').prop('disabled', disable);
  //   },
  //   focus() {
  //     this.$('input').focus();
  //   },
  // });

  const CheckboxView = Whisper.View.extend({
    initialize(options) {
      this.name = options.name;
      this.setFn = options.setFn;
      this.value = options.value;
      this.populate();
    },
    events: {
      change: 'change',
    },
    change(e) {
      const value = e.target.checked;
      this.setFn(value);
      window.log.info(this.name, 'changed to', value);
    },
    populate() {
      this.$('input').prop('checked', !!this.value);
    },
  });

  const MediaPermissionsSettingView = Whisper.View.extend({
    initialize(options) {
      this.value = options.value;
      this.setFn = options.setFn;
      this.populate();
    },
    events: {
      change: 'change',
    },
    change(e) {
      this.value = e.target.checked;
      this.setFn(this.value);
      window.log.info('media-permissions changed to', this.value);
    },
    populate() {
      this.$('input').prop('checked', Boolean(this.value));
    },
  });

  const RadioButtonGroupView = Whisper.View.extend({
    initialize(options) {
      this.name = options.name;
      this.setFn = options.setFn;
      this.value = options.value;
      this.populate();
    },
    events: {
      change: 'change',
    },
    change(e) {
      const value = this.$(e.target).val();
      this.setFn(value);
      window.log.info(this.name, 'changed to', value);
    },
    populate() {
      this.$(`#${this.name}-${this.value}`).attr('checked', 'checked');
    },
  });

  Whisper.SettingsView = Whisper.View.extend({
    className: 'settings modal expand',
    templateName: 'settings',
    initialize() {
      this.render();

      this.$('.edit-button').hide();
      this.$('.cancel-button').hide();

      this.localNumber = window.textsecure.storage.user.getNumber();

      // this.canEdit = false;
      // this.$('.edit-button').on('click', this.onEditButtonClick.bind(this));
      // this.$('.cancel-button').on('click', this.onCancelButtonClick.bind(this));

      // this.loadOurProfile()
      //   .then(() => {
      //     this.$('.edit-button').show();
      //   })
      //   .catch(e => {
      //     log.error('load our conversation failed.', e);
      //   });

      // window.ourProfileChanged(async () => {
      //   try {
      //     await this.loadOurProfile();
      //   } catch (error) {
      //     log.error('update to load our profile failed.');
      //   }
      // });

      new RadioButtonGroupView({
        el: this.$('.notification-settings'),
        name: 'notification-setting',
        value: window.initialData.notificationSetting,
        setFn: window.setNotificationSetting,
      });

      new RadioButtonGroupView({
        el: this.$('.theme-settings'),
        name: 'theme-setting',
        value: window.initialData.themeSetting,
        setFn: async theme => {
          if (theme === 'system') {
            const temp = await window.getNativeSystemTheme();
            $(document.body)
              .removeClass('dark-theme')
              .removeClass('light-theme')
              .addClass(`${temp}-theme`);
          } else {
            $(document.body)
              .removeClass('dark-theme')
              .removeClass('light-theme')
              .addClass(`${theme}-theme`);
          }
          window.setThemeSetting(theme);
        },
      });
      if (Settings.isAudioNotificationSupported()) {
        new CheckboxView({
          el: this.$('.audio-notification-setting'),
          name: 'audio-notification-setting',
          value: window.initialData.audioNotification,
          setFn: window.setAudioNotification,
        });
      }
      new CheckboxView({
        el: this.$('.spell-check-setting'),
        name: 'spell-check-setting',
        value: window.initialData.spellCheck,
        setFn: window.setSpellCheck,
      });
      new CheckboxView({
        el: this.$('.hardware-acceleration-setting'),
        name: 'hardware-acceleration-setting',
        value: window.initialData.disableHardwareAcceleration,
        setFn: window.setDisableHardwareAcceleration,
      });
      if (Settings.isHideMenuBarSupported()) {
        new CheckboxView({
          el: this.$('.menu-bar-setting'),
          name: 'menu-bar-setting',
          value: window.initialData.hideMenuBar,
          setFn: window.setHideMenuBar,
        });
      }
      new MediaPermissionsSettingView({
        el: this.$('.media-permissions'),
        value: window.initialData.mediaPermissions,
        setFn: window.setMediaPermissions,
      });
      new CheckboxView({
        el: this.$('.quit-topic-setting'),
        name: 'quit-topic-setting',
        value: window.initialData.quitTopicSetting,
        setFn: window.setQuitTopicSetting,
      });
      // if (!window.initialData.isPrimary) {
      //   const syncView = new SyncView().render();
      //   this.$('.sync-setting').append(syncView.el);
      // }
    },
    // async loadOurProfile() {
    //   const conversation = await window.Signal.Data.getConversationById(
    //     this.localNumber,
    //     { Conversation: Whisper.Conversation }
    //   );

    //   if (!conversation) {
    //     throw new Error('get our conversation failed.');
    //   }

    //   this.conversation = conversation;

    //   let myIdEmail = this.localNumber;
    //   if (conversation.get('email')) {
    //     myIdEmail += ' | ' + conversation.get('email');
    //   }
    //   this.$('.account-id-email').text(myIdEmail);

    //   if (this.avatar) {
    //     this.avatar.update({
    //       i18n: window.i18n,
    //       size: 48,
    //       conversationType: 'direct',
    //       onDoubleClickAvatar: null,
    //       ...conversation.getProps(),
    //     });
    //   } else {
    //     this.avatar = new Whisper.ReactWrapperView({
    //       className: 'avatar-wrapper',
    //       Component: window.Signal.Components.Avatar,
    //       props: {
    //         i18n: window.i18n,
    //         size: 48,
    //         conversationType: 'direct',
    //         onDoubleClickAvatar: null,
    //         ...conversation.getProps(),
    //       },
    //     });
    //     this.$('.account-settings').prepend(this.avatar.el);

    //     this.$('.account-settings').hide();
    //   }

    //   if (this.inputEditor) {
    //     this.inputEditor.value = conversation.getName();
    //     this.inputEditor.populate();
    //   } else {
    //     this.inputEditor = new InputEditorView({
    //       el: this.$('.account-settings'),
    //       name: 'account-name',
    //       value: conversation.getName(),
    //       setFn: val => {
    //         this.newAccountName = val;
    //       },
    //       disabled: true,
    //     });
    //   }
    // },
    events: {
      'click .close': 'onClose',
      'click .clear-data': 'onClearData',
    },
    // onEditButtonClick() {
    //   if (this.canEdit) {
    //     if (!this.newAccountName || !this.newAccountName.length) {
    //       alert('Name can not be empty.');
    //       return;
    //     }

    //     if (this.conversation.getName() != this.newAccountName) {
    //       window.changeInternalName(
    //         this.newAccountName,
    //         () => {
    //           this.conversation.set({ name: this.newAccountName });
    //         },
    //         () => {
    //           alert('Save failed!');
    //         }
    //       );
    //     }
    //   }

    //   this.canEdit = !this.canEdit;
    //   this.inputEditor.disable(!this.canEdit);
    //   if (this.canEdit) {
    //     this.$('.edit-button').text(i18n('saveButtonTitle'));
    //     this.$('.cancel-button').show();
    //     this.inputEditor.focus();
    //   } else {
    //     this.$('.edit-button').text(i18n('editButtonTitle'));
    //     this.$('.cancel-button').hide();
    //   }
    // },
    // onCancelButtonClick() {
    //   this.inputEditor.value = this.conversation.getName();
    //   this.inputEditor.populate();
    //   this.canEdit = false;
    //   this.inputEditor.disable(!this.canEdit);

    //   this.$('.edit-button').text(i18n('editButtonTitle'));
    //   this.$('.cancel-button').hide();
    // },
    render_attributes() {
      return {
        deviceNameLabel: i18n('deviceName'),
        deviceName: window.initialData.deviceName,
        theme: i18n('theme'),
        notifications: i18n('notifications'),
        notificationSettingsDialog: i18n('notificationSettingsDialog'),
        settings: i18n('settings'),
        disableNotifications: i18n('disableNotifications'),
        nameAndMessage: i18n('nameAndMessage'),
        noNameOrMessage: i18n('noNameOrMessage'),
        nameOnly: i18n('nameOnly'),
        audioNotificationDescription: i18n('audioNotificationDescription'),
        isAudioNotificationSupported: Settings.isAudioNotificationSupported(),
        isHideMenuBarSupported: Settings.isHideMenuBarSupported(),
        themeLight: i18n('themeLight'),
        themeDark: i18n('themeDark'),
        themeSystem: i18n('themeSystem'),
        hideMenuBar: i18n('hideMenuBar'),
        clearDataHeader: i18n('clearDataHeader'),
        clearDataButton: i18n('clearDataButton'),
        clearDataExplanation: i18n('clearDataExplanation'),
        permissions: i18n('permissions'),
        mediaPermissionsDescription: i18n('mediaPermissionsDescription'),
        quitTopicDescription: i18n('quitTopicDescription'),
        generalHeader: i18n('general'),
        spellCheckDescription: i18n('spellCheckDescription'),
        hardwareAccelerationDescription: i18n(
          'hardwareAccelerationDescription'
        ),
        editButton: this.canEdit
          ? i18n('saveButtonTitle')
          : i18n('editButtonTitle'),
        cancelButton: i18n('cancel'),
      };
    },
    onClose() {
      window.closeSettings();
    },
    onClearData() {
      window.deleteAllData();
      window.closeSettings();
    },
  });

  const SyncView = Whisper.View.extend({
    templateName: 'syncSettings',
    className: 'syncSettings',
    events: {
      'click .sync': 'sync',
    },
    initialize() {
      this.lastSyncTime = window.initialData.lastSyncTime;
    },
    enable() {
      this.$('.sync').text(i18n('syncNow'));
      this.$('.sync').removeAttr('disabled');
    },
    disable() {
      this.$('.sync').attr('disabled', 'disabled');
      this.$('.sync').text(i18n('syncing'));
    },
    onsuccess() {
      window.setLastSyncTime(Date.now());
      this.lastSyncTime = Date.now();
      window.log.info('sync successful');
      this.enable();
      this.render();
    },
    ontimeout() {
      window.log.error('sync timed out');
      this.$('.synced_at').hide();
      this.$('.sync_failed').show();
      this.enable();
    },
    async sync() {
      this.$('.sync_failed').hide();
      if (window.initialData.isPrimary) {
        window.log.warn('Tried to sync from device 1');
        return;
      }

      this.disable();
      try {
        await window.makeSyncRequest();
        this.onsuccess();
      } catch (error) {
        this.ontimeout();
      }
    },
    render_attributes() {
      const attrs = {
        sync: i18n('sync'),
        syncNow: i18n('syncNow'),
        syncExplanation: i18n('syncExplanation'),
        syncFailed: i18n('syncFailed'),
      };
      let date = this.lastSyncTime;
      if (date) {
        date = new Date(date);
        attrs.lastSynced = i18n('lastSynced');
        attrs.syncDate = date.toLocaleDateString('en-GB');
        attrs.syncTime = date.toLocaleTimeString();
      }
      return attrs;
    },
  });
})();
