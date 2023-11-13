/* global
  $,
  _,
  Backbone,
  ConversationController,
  getAccountManager,
  Signal,
  storage,
  textsecure,
  Whisper,
  UserStatus,
  watermark,
*/

const MAC_MEETINGVERSION = 3;
const LINUX_MEETINGVERSION = 1;
const meetingVersion = window.Signal.OS.isMacOS()
  ? MAC_MEETINGVERSION
  : LINUX_MEETINGVERSION;

window.setupWaterMark = () => {
  'use strict';

  let user = storage.get('number_id');
  if (user) {
    user = user.replace('+', '');
    if (user.indexOf('.') !== -1) {
      user = user.substr(0, user.indexOf('.'));
    }

    $('.simple_blind_watermark').remove();
    watermark({ watermark_txt: user });
    window.addEventListener('resize', () => {
      $('.simple_blind_watermark').remove();
      watermark({ watermark_txt: user });
    });
  }
};

// eslint-disable-next-line func-names
(async function () {
  'use strict';

  // Globally disable drag and drop
  document.body.addEventListener(
    'dragover',
    e => {
      e.preventDefault();
      e.stopPropagation();
    },
    false
  );
  document.body.addEventListener(
    'drop',
    e => {
      e.preventDefault();
      e.stopPropagation();
    },
    false
  );

  // Load these images now to ensure that they don't flicker on first use
  const images = [];

  function preload(list) {
    for (let index = 0, max = list.length; index < max; index += 1) {
      const image = new Image();
      image.src = `./images/${list[index]}`;
      images.push(image);
    }
  }

  preload([
    'alert-outline.svg',
    'android.svg',
    'apple.svg',
    'audio.svg',
    'back.svg',
    'chat-bubble-outline.svg',
    'chat-bubble.svg',
    'check-circle-outline.svg',
    'check.svg',
    'clock.svg',
    'close-circle.svg',
    'complete.svg',
    'delete.svg',
    'dots-horizontal.svg',
    'double-check.svg',
    'down.svg',
    'download.svg',
    'ellipsis.svg',
    'error.svg',
    'error_red.svg',
    'file-gradient.svg',
    'file.svg',
    'folder-outline.svg',
    'forward.svg',
    'gear.svg',
    'group-chats.svg',
    'group_default.png',
    'hourglass_empty.svg',
    'hourglass_full.svg',
    'icon_128.png',
    'icon_16.png',
    'icon_256.png',
    'icon_32.png',
    'icon_48.png',
    'image.svg',
    'import.svg',
    'lead-pencil.svg',
    'menu.svg',
    'microphone.svg',
    'movie.svg',
    'open_link.svg',
    'paperclip.svg',
    'atpersons.svg',
    'play.svg',
    'plus.svg',
    'plus-36.svg',
    'read.svg',
    'reply.svg',
    'save.svg',
    'search.svg',
    'sending.svg',
    'shield.svg',
    'smile.svg',
    'sync.svg',
    'timer-00.svg',
    'timer-05.svg',
    'timer-10.svg',
    'timer-15.svg',
    'timer-20.svg',
    'timer-25.svg',
    'timer-30.svg',
    'timer-35.svg',
    'timer-40.svg',
    'timer-45.svg',
    'timer-50.svg',
    'timer-55.svg',
    'timer-60.svg',
    'timer.svg',
    'verified-check.svg',
    'video.svg',
    'voice.svg',
    'warning.svg',
    'x.svg',
    'x_white.svg',
    'LOGO.svg',
    'tabbar_difft.svg',
    'tabbar_difft_blue.svg',
    'tabbar_contact.svg',
    'tabbar_contact_blue.svg',
    'tabbar_task.svg',
    'tabbar_task_blue.svg',
    'tabbar_calendar.svg',
    'tabbar_workspace.svg',
    'tabbar_workspace_blue.svg',
    'tabbar_setting.svg',
    'task-close-hover.png',
  ]);

  // We add this to window here because the default Node context is erased at the end
  //   of preload.js processing
  window.setImmediate = window.nodeSetImmediate;

  const { IdleDetector, MessageDataMigrator } = Signal.Workflow;
  const {
    mandatoryMessageUpgrade,
    migrateAllToSQLCipher,
    removeDatabase,
    runMigrations,
    doesDatabaseExist,
  } = Signal.IndexedDB;
  const { Errors, Message, APIStatus } = window.Signal.Types;
  const { upgradeMessageSchema, writeNewAttachmentData, deleteAttachmentData } =
    window.Signal.Migrations;
  const { Views } = window.Signal;

  // Implicitly used in `indexeddb-backbonejs-adapter`:
  // https://github.com/signalapp/Signal-Desktop/blob/4033a9f8137e62ed286170ed5d4941982b1d3a64/components/indexeddb-backbonejs-adapter/backbone-indexeddb.js#L569
  window.onInvalidStateError = error =>
    window.log.error(error && error.stack ? error.stack : error);

  window.log.info('background page reloaded');
  window.log.info('environment:', window.getEnvironment());

  let idleDetector;
  let initialLoadComplete = false;
  let newVersion = false;
  let offlineMessageLoaded = false;

  window.isOfflineMessageLoaded = () => offlineMessageLoaded;

  window.owsDesktopApp = {};
  window.document.title = window.getTitle();

  // start a background worker for ecc
  textsecure.startWorker('js/libsignal-protocol-worker.js');
  // Whisper.KeyChangeListener.init(textsecure.storage.protocol);
  textsecure.storage.protocol.on('removePreKey', () => {
    getAccountManager().refreshPreKeys();
  });

  let messageReceiver;
  window.getSocketStatus = () => {
    if (messageReceiver) {
      return messageReceiver.getStatus();
    }
    return -1;
  };
  Whisper.events = _.clone(Backbone.Events);

  if (Whisper.RegisterMeetingStatusCallback) {
    Whisper.RegisterMeetingStatusCallback();
  }

  let accountManager;
  window.getAccountManager = () => {
    if (!accountManager) {
      const USERNAME = storage.get('number_id');
      const PASSWORD = storage.get('password');
      accountManager = new textsecure.AccountManager(USERNAME, PASSWORD);
      accountManager.addEventListener('registration', () => {
        const user = {
          regionCode: window.storage.get('regionCode'),
          ourNumber: textsecure.storage.user.getNumber(),
        };
        Whisper.events.trigger('userChanged', user);

        Whisper.Registration.markDone();
        window.log.info('dispatching registration event');
        Whisper.events.trigger('registration_done');
      });
    }
    return accountManager;
  };

  const cancelInitializationMessage = Views.Initialization.setMessage();

  const isIndexedDBPresent = await doesDatabaseExist();
  if (isIndexedDBPresent) {
    window.installStorage(window.legacyStorage);
    window.log.info('Start IndexedDB migrations');
    await runMigrations();
  }

  window.log.info('Storage fetch');
  storage.fetch();

  // async function mapOldThemeToNew(theme) {
  //   switch (theme) {
  //     case 'system':
  //       return await window.getNativeSystemTheme();
  //     case 'dark':
  //     case 'light':
  //       return theme;
  //     case 'android-dark':
  //       return 'dark';
  //     case 'android':
  //     case 'ios':
  //     default:
  //       return 'light';
  //   }
  // }

  // We need this 'first' check because we don't want to start the app up any other time
  //   than the first time. And storage.fetch() will cause onready() to fire.
  let first = true;
  storage.onready(async () => {
    if (!first) {
      return;
    }
    first = false;

    window.updateName = async name => {
      // const nameLengthMax = 30;
      window.log.info('updateName name:', name);
      if (!name) {
        window.log.error('updateName name is empty.');
        alert(i18n('changeNameCannotBeEmpty'));
        return;
      }

      // if (name && name.length > nameLengthMax) {
      //   window.log.error('updateName param too long.');
      //   alert(i18n('changeNameTooLong'));
      //   return;
      // }

      // can't include '=', ',', '<', '>'
      // if (
      //   name.includes('=') ||
      //   name.includes(',') ||
      //   name.includes('<') ||
      //   name.includes('>')
      // ) {
      //   window.log.error('updateName include invalid chars.');
      //   alert(i18n('changeNameUnsupportedChars'));
      //   return;
      // }

      try {
        const res = await window.getAccountManager().setProfile({ name });
        if (res && res.status === 10100) {
          alert(i18n('changeNameUnsupportedChars'));
          return;
        }
        if (res && res.status === 10101) {
          alert(i18n('changeNameBadFormat', res.reason));
          return;
        }
        if (res && res.status === 10102) {
          alert(i18n('changeNameTooLong'));
          return;
        }
        if (res && res.status === 10103) {
          alert(i18n('changeNameAlreadyExist'));
          return;
        }
        if (res && res.status === 10104) {
          alert(i18n('changeNameInterError'));
          return;
        }
        if (!res || res.status !== 0) {
          alert(i18n('changeNameOtherError'));
          return;
        }

        const ourNumber = textsecure.storage.user.getNumber();
        const conversation = ConversationController.get(ourNumber);
        conversation.set({ name });
        await window.Signal.Data.updateConversation(conversation.attributes);
        return true;
      } catch (e) {
        window.log.error('updateName error', e);
        setImmediate(() => {
          const { code } = e || {};
          switch (code) {
            case 403:
              alert(i18n('forbiddenOperation'));
              return;
            case 413:
              alert(i18n('profile_too_frequent'));
              return;
          }
        });
      }
    };

    window.updateSignature = async signature => {
      const signLengthMax = 80;

      window.log.info('updateSignature signature:', signature);
      if (signature && signature.length > signLengthMax) {
        window.log.error('updateSignature param too long.');
        return;
      }
      try {
        await window
          .getAccountManager()
          .setProfile({ signature: signature || '' });

        const ourNumber = textsecure.storage.user.getNumber();
        const conversation = ConversationController.get(ourNumber);
        conversation.set({ signature: signature || '' });
        await window.Signal.Data.updateConversation(conversation.attributes);
        return true;
      } catch (e) {
        window.log.error('updateSignature error', e);
        setImmediate(() => {
          if (e && e.code === 413) {
            alert(i18n('profile_too_frequent'));
            return;
          }
          alert('Update signature error:' + e?.message);
        });
      }
    };

    window.uploadGroupAvatar = async (imageDataStr, groupConversationId) => {
      let imageData = imageDataStr;
      if (
        imageData.startsWith('data:image') &&
        imageData.includes(';base64,')
      ) {
        const pos = imageData.indexOf(';base64,');
        imageData = imageData.substr(pos + 8);
      }
      const avatar = window.Signal.Crypto.base64ToArrayBuffer(imageData);
      const imageByteCount = avatar.byteLength;

      // encrypt
      const keys = libsignal.crypto.getRandomBytes(64);
      const encryptedGroupAvatarBin = await textsecure.crypto.encryptAttachment(
        avatar,
        keys,
        libsignal.crypto.getRandomBytes(16),
        32
      );

      const key = window.Signal.Crypto.arrayBufferToBase64(keys);
      const digest = window.Signal.Crypto.arrayBufferToBase64(
        encryptedGroupAvatarBin.digest
      );

      const conversation = ConversationController.get(groupConversationId);
      if (conversation) {
        await conversation.updateGroupAvatar(
          { id: '', uploadData: avatar, digest, key, size: imageByteCount },
          encryptedGroupAvatarBin.ciphertext,
          key,
          digest,
          imageByteCount
        );

        const groupUpdate = {
          avatar: avatar,
        };
        await conversation.updateGroup(groupUpdate);
      }
    };

    window.uploadAvatar = async imageDataStr => {
      try {
        let imageData = imageDataStr;
        if (
          imageData.startsWith('data:image') &&
          imageData.includes(';base64,')
        ) {
          const pos = imageData.indexOf(';base64,');
          imageData = imageData.substr(pos + 8);
        }

        const avatar = window.Signal.Crypto.base64ToArrayBuffer(imageData);
        let key;
        const pk = textsecure.storage.get('profileKey');
        if (pk && pk.byteLength === 32) {
          key = pk;
        } else {
          key = window.getGuid().replace(/-/g, '');
        }

        // encrypt
        const encryptedBin = await textsecure.crypto.encryptProfile(
          avatar,
          window.Signal.Crypto.bytesFromString(key)
        );

        // get oss url
        const ossInfo = await window.getAccountManager().getAvatarUploadId();

        // upload avatar
        const b64Key = window.Signal.Crypto.arrayBufferToBase64(key);
        await window
          .getAccountManager()
          .putAvatar(
            ossInfo.location,
            encryptedBin,
            ossInfo.idString,
            'AESGCM256',
            b64Key
          );

        // success，update local
        const conversation = ConversationController.get(
          textsecure.storage.user.getNumber()
        );
        if (conversation) {
          conversation.updatePrivateAvatar({
            attachmentId: ossInfo.idString,
            uploadData: avatar,
          });
        }
      } catch (e) {
        window.log.error('update avatar error', e);
        setImmediate(() => {
          if (e && e.code === 413) {
            alert(i18n('profile_too_frequent'));
            return;
          }
          alert('Update avatar error:' + e?.message);
        });
      }
    };

    // set Group Notify Type
    window.setGroupNotifyType = async (type, cid, ourNumber) => {
      window.Signal.ID.convertIdToV2(cid);
      const conversation = window.ConversationController.get(cid);
      await conversation.apiEditGroupV2Member(ourNumber, {
        notification: type,
      });

      window.getInboxCollection().updateUnreadCount();
    };

    window.useGlobalConfigCache();
    // fetch global config
    window.fetchGlobalConfig();

    // preload workspace & beyondCorp config
    window.preloadWBCConfig();
    // fetch workspace & beyondCorp config
    window.fetchWBCConfig(true);

    setInterval(() => {
      window.fetchGlobalConfig();
    }, 6 * 60 * 60 * 1000);

    // These make key operations available to IPC handlers created in preload.js
    window.Events = {
      getDeviceName: () => textsecure.storage.user.getDeviceName(),

      getThemeSetting: () => storage.get('theme-setting', 'system'),
      setThemeSetting: value => {
        storage.put('theme-setting', value);
        onChangeTheme();
      },
      getHideMenuBar: () => storage.get('hide-menu-bar'),
      setHideMenuBar: value => {
        storage.put('hide-menu-bar', value);
        window.setAutoHideMenuBar(value);
        window.setMenuBarVisibility(!value);
      },

      getNotificationSetting: () =>
        storage.get('notification-setting', 'message'),
      setNotificationSetting: value =>
        storage.put('notification-setting', value),
      getAudioNotification: () => storage.get('audio-notification'),
      setAudioNotification: value => storage.put('audio-notification', value),

      getSpellCheck: () => storage.get('spell-check', false),
      setSpellCheck: value => {
        storage.put('spell-check', value);
        startSpellCheck();
      },
      getQuitTopicSetting: () => storage.get('quit-topic-setting', true),
      setQuitTopicSetting: value => {
        storage.put('quit-topic-setting', value);
      },

      // eslint-disable-next-line eqeqeq
      isPrimary: () => textsecure.storage.user.getDeviceId() == '1',
      // getSyncRequest: () =>
      //   new Promise((resolve, reject) => {
      //     const syncRequest = window.getSyncRequest();
      //     syncRequest.addEventListener('success', resolve);
      //     syncRequest.addEventListener('timeout', reject);
      //   }),
      // getLastSyncTime: () => storage.get('synced_at'),
      // setLastSyncTime: value => storage.put('synced_at', value),

      addDarkOverlay: () => {
        if ($('.dark-overlay').length) {
          return;
        }
        $(document.body).prepend('<div class="dark-overlay"></div>');
        $('.dark-overlay').on('click', () => $('.dark-overlay').remove());
      },
      removeDarkOverlay: () => $('.dark-overlay').remove(),
      deleteAllData: () => {
        const clearDataView = new window.Whisper.ClearDataView().render();
        $('body').append(clearDataView.el);
      },

      shutdown: async () => {
        // Stop background processing
        window.Signal.AttachmentDownloads.stop();
        if (idleDetector) {
          idleDetector.stop();
        }

        // Stop processing incoming messages
        if (messageReceiver) {
          await messageReceiver.stopProcessing();
          await window.waitForAllBatchers();
        }

        if (messageReceiver) {
          messageReceiver.unregisterBatchers();
          messageReceiver = null;
        }

        // Shut down the data interface cleanly
        await window.Signal.Data.shutdown();
      },
      voiceSendMessage: info => sendVoiceMessage(info),
      getGlobalConfig: () => window.getGlobalConfig(),
    };

    const currentVersion = window.getVersion();
    const lastVersion = storage.get('version');
    newVersion = !lastVersion || currentVersion !== lastVersion;
    await storage.put('version', currentVersion);

    if (newVersion) {
      // do not restart.
      // if (
      //   lastVersion &&
      //   window.isBeforeVersion(lastVersion, 'v1.15.0-beta.5')
      // ) {
      //   await window.Signal.Logs.deleteAll();
      //   window.restart();
      // }

      window.log.info(
        `Newer installed version detected: ${currentVersion}; previous: ${lastVersion}`
      );
    }

    if (isIndexedDBPresent) {
      await mandatoryMessageUpgrade({ upgradeMessageSchema });
      await migrateAllToSQLCipher({ writeNewAttachmentData, Views });
      await removeDatabase();
      try {
        await window.Signal.Data.removeIndexedDBFiles();
      } catch (error) {
        window.log.error(
          'Failed to remove IndexedDB files:',
          error && error.stack ? error.stack : error
        );
      }

      window.installStorage(window.newStorage);
      await window.storage.fetch();
      await storage.put('indexeddb-delete-needed', true);
    }

    Views.Initialization.setMessage(window.i18n('optimizingApplication'));

    if (newVersion) {
      try {
        await window.Signal.Data.rebuildMessagesMeta();
      } catch (error) {
        window.log.error(
          'rebuildMessagesMeta failed,',
          error && error.stack ? error.stack : error
        );
      }

      try {
        // cleanup expired messages
        await window.Signal.Data.cleanupExpiredMessagesAtStartup();
      } catch (error) {
        window.log.error(
          'cleanupExpiredMessagesAtStartup failed,',
          error && error.stack ? error.stack : error
        );
      }

      try {
        // cleanup orphaned attachments
        await window.Signal.Data.cleanupOrphanedAttachments();
      } catch (error) {
        window.log.error(
          'cleanupOrphanedAttachments error,',
          error && error.stack ? error.stack : error
        );
      }
    }

    // const mentionsIntegrated = storage.get('mentionsIntegrated');
    // if (!mentionsIntegrated) {
    //   window.log.info('Mentions integrating: start');

    //   try {
    //     const ourNumber = textsecure.storage.user.getNumber();

    //     await window.Signal.Data.integrateMentions(ourNumber);

    //     storage.put('mentionsIntegrated', true);
    //   } catch (error) {
    //     window.log.error('integrateMentions error,', error);
    //   }

    //   window.log.info('Mentions integrating: complete');
    // }

    Views.Initialization.setMessage(window.i18n('loading'));

    idleDetector = new IdleDetector();
    let isMigrationProcessing = false;
    let isMigrationWithIndexComplete = false;
    window.log.info(
      `Starting background data migration. Target version: ${Message.CURRENT_SCHEMA_VERSION}`
    );
    idleDetector.on('idle', async () => {
      window.log.info('Starting idle handler.');

      const NUM_MESSAGES_PER_BATCH = 1;

      if (!isMigrationWithIndexComplete) {
        if (isMigrationProcessing) {
          window.log.info('Duplicated idle handler, just skip.');
          return;
        }

        isMigrationProcessing = true;

        const batchWithIndex = await MessageDataMigrator.processNext({
          BackboneMessage: Whisper.Message,
          BackboneMessageCollection: Whisper.MessageCollection,
          numMessagesPerBatch: NUM_MESSAGES_PER_BATCH,
          upgradeMessageSchema,
          getMessagesNeedingUpgrade:
            window.Signal.Data.getMessagesNeedingUpgrade,
          saveMessage: window.Signal.Data.saveMessage,
        });

        window.log.info('Upgrade message schema (with index):', batchWithIndex);

        isMigrationWithIndexComplete = batchWithIndex.done;
        isMigrationProcessing = false;
      }

      if (isMigrationWithIndexComplete) {
        window.log.info(
          'Background migration complete. Stopping idle detector.'
        );
        idleDetector.stop();
      }
    });

    const startSpellCheck = () => {
      window.log.info('Starting spell check configuration.');

      if (!window.enableSpellCheck || !window.disableSpellCheck) {
        return;
      }

      if (window.Events.getSpellCheck()) {
        window.enableSpellCheck();
      } else {
        window.disableSpellCheck();
      }

      window.log.info('Spell check configuration Complete.');
    };
    startSpellCheck();

    const themeSetting = window.Events.getThemeSetting();
    window.storageReadyNotify(themeSetting);
    window.Events.setThemeSetting(themeSetting);

    // const newThemeSetting = await mapOldThemeToNew(themeSetting);
    // window.Events.setThemeSetting(newThemeSetting);
    // window.storageReadyNotify(newThemeSetting);

    try {
      await Promise.all([
        ConversationController.load(),
        textsecure.storage.protocol.hydrateCaches(),
      ]);
    } catch (error) {
      window.log.error(
        'background.js: ConversationController failed to load:',
        error && error.stack ? error.stack : error
      );
    } finally {
      // if (!mentionsIntegrated) {
      //   const conversations = window.getConversations();
      //   const unreadConversations = conversations.filter(c =>
      //     c.get('unreadCount')
      //   );

      //   for (const conversation of unreadConversations) {
      //     await conversation.debouncedUpdateLastMessage();
      //   }
      // }

      start();
    }
  });

  Whisper.events.on('setupWithImport', () => {
    const { appView } = window.owsDesktopApp;
    if (appView) {
      appView.openImporter();
    }
  });

  Whisper.events.on('setupAsNewDevice', () => {
    const { appView } = window.owsDesktopApp;
    if (appView) {
      appView.openInstaller();
    }
  });

  Whisper.events.on('setupAsStandalone', () => {
    const { appView } = window.owsDesktopApp;
    if (appView) {
      appView.openStandalone();
    }
  });

  Whisper.events.on('botReplyChanged', async () => {
    window.jsonFileData = await window.getBotReplyJson();
  });

  // define connectCount before connect() was called.
  let connectCount = 0;

  async function start() {
    window.dispatchEvent(new Event('storage_ready'));

    window.log.info('Cleanup: starting...');
    const messagesForCleanup =
      await window.Signal.Data.getOutgoingWithoutExpiresAt({
        MessageCollection: Whisper.MessageCollection,
      });
    window.log.info(
      `Cleanup: Found ${messagesForCleanup.length} messages for cleanup`
    );
    await Promise.all(
      messagesForCleanup.map(async message => {
        const delivered = message.get('delivered');
        const sentAt = message.get('sent_at');
        const expirationStartTimestamp = message.get(
          'expirationStartTimestamp'
        );

        if (message.hasErrors()) {
          return;
        }

        if (delivered) {
          window.log.info(
            `Cleanup: Starting timer for delivered message ${sentAt}`
          );
          message.set(
            'expirationStartTimestamp',
            expirationStartTimestamp || sentAt
          );
          await message.setToExpire();
          return;
        }

        window.log.info(`Cleanup: Deleting unsent message ${sentAt}`);
        await window.Signal.Data.removeMessage(message.id, {
          Message: Whisper.Message,
        });
        const conversation = message.getConversation();
        if (conversation) {
          conversation.debouncedUpdateLastMessage();
        }
      })
    );
    window.log.info('Cleanup: complete');

    // const processQuoteMessages = async offset => {
    //   const quoteMessages = await window.Signal.Data.getQuoteMessages(
    //     offset,
    //     Whisper.MessageCollection
    //   );

    //   const messagesInConversations = quoteMessages.groupBy(model =>
    //     model.get('conversationId')
    //   );

    //   for (const conversationId of Object.keys(messagesInConversations)) {
    //     const conversation = ConversationController.get(conversationId);
    //     if (conversation) {
    //       const messages = messagesInConversations[conversationId];
    //       await conversation.onThreadChange(
    //         messages.map(m => MessageController.register(m.id, m))
    //       );
    //     }
    //   }

    //   return quoteMessages.length;
    // };

    // const threadIntegrated = storage.get('threadIntegrated');
    // if (!threadIntegrated) {
    //   window.log.info('MakeThread: start');

    //   let offset = 0;
    //   do {
    //     const count = await processQuoteMessages(offset);
    //     if (count === 0) {
    //       break;
    //     }
    //     offset += count;

    //     window.log.info('Handling quote messages ', offset);
    //   } while (true);

    //   storage.put('threadIntegrated', true);
    //   window.log.info('MakeThread: complete');
    // }

    await Whisper.Recalls.loadByDB();

    window.log.info('listening for registration events');
    Whisper.events.on('registration_done', () => {
      window.log.info('handling registration event');

      // listeners
      Whisper.RotateSignedPreKeyListener.init(Whisper.events, newVersion);
      connect(true);
    });

    cancelInitializationMessage();
    const appView = new Whisper.AppView({
      el: $('body'),
    });
    window.owsDesktopApp.appView = appView;

    Whisper.WallClockListener.init(Whisper.events);
    Whisper.ExpiringMessagesListener.init(Whisper.events);

    if (!storage.get('number_id') || !storage.get('password')) {
      appView.openInstaller();
    } else if (Whisper.Import.isIncomplete()) {
      window.log.info('Import was interrupted, showing import error screen');
      appView.openImporter();
    } else if (Whisper.Registration.everDone()) {
      // listeners
      Whisper.RotateSignedPreKeyListener.init(Whisper.events, newVersion);
      connect();
      appView.openInbox({
        initialLoadComplete,
      });
    } else if (window.isImportMode()) {
      appView.openImporter();
    } else {
      appView.openInstaller();
    }

    Whisper.events.on('showDebugLog', () => {
      appView.openDebugLog();
    });
    Whisper.events.on('unauthorized', () => {
      appView.inboxView.networkStatusView.update();
    });
    Whisper.events.on('reconnectTimer', millis => {
      appView.inboxView.networkStatusView.onReconnectTimer(millis);
    });
    Whisper.events.on('contactsync', () => {
      if (appView.installView) {
        appView.openInbox();
      }
    });

    window.addEventListener('focus', () => Whisper.Notifications.clear());
    window.addEventListener('unload', () => Whisper.Notifications.fastClear());

    let lastOpenedId;
    window.conversationFrom;
    window.isClickCommonGroup = false;
    Whisper.events.on(
      'showConversation',
      (
        id,
        messageId,
        recentConversationSwitch,
        type,
        conversationFrom = null,
        isClickCommonGroup = null
      ) => {
        if (lastOpenedId && lastOpenedId != id) {
          const conversation = ConversationController.get(lastOpenedId);
          window.conversationFrom = {
            id: conversation.id,
            type: 'fromGroup',
            isSend: !conversation.isPrivate(),
          };
          if (conversation) {
            conversation.clearReadConfidentialMessages();
          }
        }
        if (conversationFrom) {
          window.conversationFrom = conversationFrom;
        }
        if (isClickCommonGroup) {
          window.isClickCommonGroup = isClickCommonGroup;
        }

        // update
        lastOpenedId = id;

        if (appView) {
          appView.openConversation(
            id,
            messageId,
            recentConversationSwitch,
            type
          );
        }
      }
    );

    Whisper.events.on('showGroupChats', () => {
      if (appView) {
        appView.openGroupChats();
      }
    });

    Whisper.events.on('showAllBots', () => {
      if (appView) {
        appView.openAllBots();
      }
    });

    Whisper.events.on('deleteMessages', (id, type, deleteInFolder) => {
      if (appView) {
        appView.deleteMessages(id, type, deleteInFolder);
      }
    });

    Whisper.events.on('conversationStick', (id, stick) => {
      if (appView) {
        appView.conversationStick(id, stick);
      }
    });

    Whisper.events.on('conversationMute', (id, mute) => {
      if (appView) {
        appView.conversationMute(id, mute);
      }
    });
    Whisper.events.on('conversationLeaveGroup', id => {
      if (appView) {
        appView.conversationLeaveGroup(id);
      }
    });
    Whisper.events.on('conversationDisbandGroup', id => {
      if (appView) {
        appView.conversationDisbandGroup(id);
      }
    });

    Whisper.events.on('conversationArchived', id => {
      if (appView) {
        appView.conversationArchived(id);
      }
    });

    Whisper.Notifications.on('click', (id, messageId) => {
      window.showWindow();
      if (id) {
        appView.openConversation(id, messageId);
      } else {
        appView.openInbox({
          initialLoadComplete,
        });
      }
    });

    Whisper.events.on('create-or-edit-group', async (fromWinId, editInfo) => {
      const { mode, groupInfo, fromGroup } = editInfo;

      log.info('create-or-edit-group, fromWindowId:' + fromWinId);

      let result;

      if (mode === 'new-group') {
        result = await createGroupV2(groupInfo);
        if (!result.result) {
          Whisper.events.trigger('result-of-create-or-edit', false);
          alert(result.errorMessage);
        } else {
          if (fromGroup) {
            // new group from exists group
            try {
              // send group link to fromGroup conversation
              const newGroupConv = ConversationController.get(result.groupId);
              const fromGroupConv = ConversationController.get(fromGroup);
              if (newGroupConv && fromGroupConv) {
                const inviteMessage =
                  await newGroupConv.getGroupV2InviteMessage();
                if (inviteMessage && inviteMessage.length === 2) {
                  const card = { appId: '', content: inviteMessage[0] };
                  await fromGroupConv.forceSendMessageAuto(
                    inviteMessage[0],
                    null,
                    [],
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    { card }
                  );
                } else {
                  log.error('get invite message for group failed.');
                }
              } else {
                log.error('group conversation not found.');
              }
            } catch (error) {
              log.error('send group invite message to group failed.');
            }
            Whisper.events.trigger('result-of-create-or-edit', true);
          } else {
            Whisper.events.trigger('result-of-create-or-edit', true);
            // open new conversation
            Whisper.events.trigger('showConversation', result.groupId);
          }
        }
      } else if (mode === 'add-group-members') {
        result = await addMembersV2(groupInfo);
        Whisper.events.trigger('result-of-create-or-edit', result.result);
        if (!result.result) {
          alert(result.errorMessage);
        }
      } else if (mode === 'remove-group-members') {
        result = await removeMembersV2(groupInfo);
        Whisper.events.trigger('result-of-create-or-edit', result.result);
        if (!result.result) {
          alert(window.i18n('group_editor_remove_members_failed'));
        }
      } else if (mode === 'add-group-admins') {
        result = await moveAdmins(groupInfo, true);
        Whisper.events.trigger('result-of-create-or-edit', result.result);
        if (!result.result) {
          alert(window.i18n('group_editor_add_admin_failed'));
        }
      } else if (mode === 'remove-group-admins') {
        result = await moveAdmins(groupInfo, false);
        Whisper.events.trigger('result-of-create-or-edit', result.result);
        if (!result.result) {
          alert(window.i18n('group_editor_remove_admin_failed'));
        }
      }

      // sendGroupOperationResult(fromWinId, {...result});
    });

    Whisper.events.on('change-internal-name', async (fromWinId, newName) => {
      log.info('change-internal-name, fromWindowId:' + fromWinId);

      let result;

      let accountManager = window.getAccountManager();

      try {
        await accountManager.setInternalName(newName);

        const ourNumber = textsecure.storage.user.getNumber();
        const conversation = ConversationController.get(ourNumber);

        conversation.set({ name: newName });
        await window.Signal.Data.updateConversation(conversation.attributes);

        result = true;
      } catch (error) {
        log.error('setInternalName failed.', error);
      }

      sendEditResult(fromWinId, { result });
    });

    Whisper.events.on('update-avatar', async id => {
      const conversation = ConversationController.get(id);
      if (!conversation) {
        return;
      }

      await conversation.debouncedUpdateCommonAvatar();
    });

    Whisper.events.on('fast-join-group', (joinUrl, rejoin) => {
      if (appView) {
        appView.fastJoinGroup(joinUrl, rejoin);
      }
    });

    Whisper.events.on('power-monitor-resume', () => {
      if (isSocketOnline()) {
        messageReceiver.checkStatus();
      }
    });

    Whisper.events.on('manual-logout', onError);
  }

  async function createGroupV2(groupInfo) {
    const { name, members } = groupInfo;

    // create groupv2
    // 1 call server create group API, get group id
    // 2 if there are members, call server addmembers API
    // 3 create conversation of groupv2
    // 4 groupv2 created.
    // 5 messages in groupv2 should be handled seperately.

    // because group id returned from server,
    // conversation must created after createGroupV2 API was called.

    let groupId;

    try {
      // call GroupV2API
      // expiration -1: globalConfig
      const result = await textsecure.messaging.createGroupV2(
        name,
        null,
        -1,
        members
      );
      groupId = result.data.gid;
    } catch (error) {
      log.info('createGroupV2: ', error);

      const defaultKey = 'group_editor_create_failed';
      let i18nKey = defaultKey;
      const { response, name, code } = error;
      if (name === 'HTTPError' && code === 400) {
        const { API_STATUS } = APIStatus;
        const { status } = response;
        switch (status) {
          case API_STATUS.InvalidParameter:
            i18nKey = 'invalidArgument';
            break;
          case API_STATUS.GroupMemberCountExceeded:
            // group is full or member count exceeded
            i18nKey = 'groupMemberCountExceeded';
            break;
        }
      }

      return {
        result: false,
        errorMessage: i18n(i18nKey) || i18n(defaultKey),
      };
    }

    const ourNumber = textsecure.storage.user.getNumber();

    // should add our number into members list
    members.push(ourNumber);

    // de-duplication
    let membersArray = Array.from(new Set(members));

    // initial V2 members
    const membersV2 = membersArray.map(m => {
      if (m === ourNumber) {
        // role owner
        return { id: m, role: 0 };
      } else {
        // role member
        return { id: m, role: 2 };
      }
    });

    // create & update conversation
    let conversation = await ConversationController.getOrCreateAndWait(
      groupId,
      'group'
    );

    const updates = {
      name: name,
      members: membersArray,
      membersV2: membersV2,
      type: 'group',
      left: false,
      // active_at: Date.now(),
      group_version: 2,
    };
    conversation.set(updates);
    await window.Signal.Data.updateConversation(conversation.attributes);

    // call conversation createGroup to update UI notification
    const groupUpdate = {
      name: name,
      members: membersArray,
    };
    await conversation.createGroup(groupUpdate);
    await conversation.debouncedUpdateLastMessage();

    return { result: true, groupId };
  }

  async function addMembersV2(groupInfo) {
    const { id, members, operator } = groupInfo;
    let conversation = await ConversationController.getOrCreateAndWait(
      id,
      'group'
    );

    try {
      // call GroupV2API and update membersV2 in conversation
      await conversation.apiAddGroupV2Members(members);
    } catch (error) {
      log.error('call addGroupV2Members failed, ', error);

      const defaultKey = 'group_editor_add_members_failed';
      let i18nKey = defaultKey;
      const { response, name, code } = error;
      if (name === 'HTTPError' && code === 400) {
        const { API_STATUS } = APIStatus;
        const { status } = response;
        switch (status) {
          case API_STATUS.InvalidParameter:
            i18nKey = 'invalidArgument';
            break;
          case API_STATUS.NoSuchGroup:
            i18nKey = 'noSuchGroup';
            break;
          case API_STATUS.GroupMemberCountExceeded:
            // group is full or member count exceeded
            i18nKey = 'groupMemberCountExceeded';
            break;
        }
      }

      return {
        result: false,
        errorMessage: i18n(i18nKey) || i18n(defaultKey),
      };
    }

    const oldMembers = conversation.get('members') || [];
    const latestMembers = oldMembers.concat(members);
    // update groups
    const updates = {
      members: latestMembers,
      type: 'group',
      left: false,
      // active_at: activeAt,
      isArchived: false,
      group_version: 2,
    };

    conversation.set(updates);
    await window.Signal.Data.updateConversation(conversation.attributes);

    // send signal add members message
    const groupUpdate = {
      joined: members,
      joinOperator: operator,
    };
    await conversation.updateGroup(groupUpdate);

    // should notify UI success
    return { result: true };
  }

  async function removeMembersV2(groupInfo) {
    const { id, members } = groupInfo;

    const conversation = await ConversationController.getOrCreateAndWait(
      id,
      'group'
    );

    try {
      // call GroupV2API and update membersV2 in conversation
      await conversation.apiRemoveGroupV2Members(members);
    } catch (error) {
      log.error('call apiRemoveGroupV2Members failed, ', error);
      let errorMessage;
      return { result: false, errorMessage };
    }

    const oldMembers = conversation.get('members');
    const updates = {
      members: oldMembers.filter(m => !members.includes(m)),
      type: 'group',
      left: false,
      // active_at: activeAt,
      isArchived: false,
    };
    conversation.set(updates);
    await window.Signal.Data.updateConversation(conversation.attributes);

    // send signal remove members message
    const groupUpdate = {
      removed: members,
    };
    await conversation.updateGroup(groupUpdate, updates.members, oldMembers);

    return { result: true };
  }

  async function moveAdmins(groupInfo, add) {
    const { id, members } = groupInfo;

    const conversation = await ConversationController.getOrCreateAndWait(
      id,
      'group'
    );

    try {
      // call GroupV2API and update membersV2 in conversation
      await conversation.apiMoveAdmins(members, add);
    } catch (error) {
      log.error('call apiMoveAdmins failed, ', error);
      let errorMessage;
      return { result: false, errorMessage };
    }

    const updates = {
      type: 'group',
      left: false,
      // active_at: Date.now(),
      isArchived: false,
    };
    conversation.set(updates);
    await window.Signal.Data.updateConversation(conversation.attributes);

    // send signal remove members message
    const groupUpdate = {
      removeAdmins: add ? undefined : members,
      addAdmins: add ? members : undefined,
    };
    await conversation.updateGroup(groupUpdate);

    return { result: true };
  }

  // window.getSyncRequest = () =>
  //   new textsecure.SyncRequest(textsecure.messaging, messageReceiver);

  let disconnectTimer = null;

  function onOffline() {
    window.log.info('offline');

    offlineMessageLoaded = false;

    window.removeEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);

    // We've received logs from Linux where we get an 'offline' event, then 30ms later
    //   we get an online event. This waits a bit after getting an 'offline' event
    //   before disconnecting the socket manually.
    disconnectTimer = setTimeout(disconnect, 1000);
  }

  function onOnline() {
    window.log.info('online');

    window.removeEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    if (disconnectTimer && isSocketOnline()) {
      window.log.warn('Already online. Had a blip in online/offline status.');
      clearTimeout(disconnectTimer);
      disconnectTimer = null;
      return;
    }
    if (disconnectTimer) {
      clearTimeout(disconnectTimer);
      disconnectTimer = null;
    }

    connect();
  }

  function isSocketOnline() {
    const socketStatus = window.getSocketStatus();
    return (
      socketStatus === WebSocket.CONNECTING || socketStatus === WebSocket.OPEN
    );
  }

  function disconnect() {
    window.log.info('disconnect');

    // Clear timer, since we're only called when the timer is expired
    disconnectTimer = null;

    if (messageReceiver) {
      messageReceiver.close();
    }
    window.Signal.AttachmentDownloads.stop();
  }

  async function connect(firstRun) {
    window.log.info('connect');

    offlineMessageLoaded = false;

    // Bootstrap our online/offline detection, only the first time we connect
    if (connectCount === 0 && navigator.onLine) {
      window.addEventListener('offline', onOffline);
    }
    if (connectCount === 0 && !navigator.onLine) {
      window.log.warn(
        'Starting up offline; will connect when we have network access'
      );
      window.addEventListener('online', onOnline);
      onEmpty(); // this ensures that the loading screen is dismissed
      return;
    }

    if (!Whisper.Registration.everDone()) {
      return;
    }
    if (Whisper.Import.isIncomplete()) {
      return;
    }

    if (messageReceiver) {
      window.log.info('starting for existing messageRecveiver clear.');

      const oldMessageReceiver = messageReceiver;
      messageReceiver = null;

      await oldMessageReceiver.stopProcessing();

      // only should wait for batchers in message receiver when connecting
      await oldMessageReceiver.waitForBatchers();
      oldMessageReceiver.unregisterBatchers();

      window.log.info('clear for existing messageRecveiver done.');
    }

    if (messageReceiver) {
      window.log.info('already connected in another connect, just return');
      return;
    }

    const USERNAME = storage.get('number_id');
    const PASSWORD = storage.get('password');
    const mySignalingKey = storage.get('signaling_key');

    if (USERNAME && PASSWORD) {
      const urls = window.getTestedServerConfig();

      // fetch meeting-status
      window.fetchMeetingStatus();

      // // user status websocket
      // if (!window.userStatusReceiver) {
      //   window.userStatusReceiver = new UserStatus(USERNAME, PASSWORD);
      //   window.setImmediate(async () => {
      //     await window.userStatusReceiver.connect();
      //   });
      // }
    }

    connectCount += 1;
    const options = {
      firstRun,
    };

    Whisper.Notifications.disable(); // avoid notification flood until empty

    // initialize the socket and start listening for messages
    messageReceiver = new textsecure.MessageReceiver(
      USERNAME,
      PASSWORD,
      mySignalingKey,
      options
    );
    messageReceiver.addEventListener('message', onMessageReceived);
    // messageReceiver.addEventListener('delivery', onDeliveryReceipt);
    // messageReceiver.addEventListener('contact', onContactReceived);
    // messageReceiver.addEventListener('group', onGroupReceived);
    messageReceiver.addEventListener('sent', onSentMessage);
    messageReceiver.addEventListener('readSync', onReadSync);
    messageReceiver.addEventListener('read', onReadReceipt);
    messageReceiver.addEventListener('verified', onVerified);
    messageReceiver.addEventListener('error', onError);
    messageReceiver.addEventListener('empty', onEmpty);
    messageReceiver.addEventListener('reconnect', onReconnect);
    messageReceiver.addEventListener('progress', onProgress);
    // messageReceiver.addEventListener('configuration', onConfiguration);
    // messageReceiver.addEventListener('typing', onTyping);
    messageReceiver.addEventListener('notification', onChangeNotification);
    messageReceiver.addEventListener('taskSync', onTaskSync);
    messageReceiver.addEventListener('externalMessage', onExternalMessage);
    messageReceiver.addEventListener('markAsUnread', onMarkAsUnread);
    messageReceiver.addEventListener('conversationInfo', onConversationInfo);
    messageReceiver.addEventListener('onArchive', onArchive);
    messageReceiver.addEventListener('latestReads', onLatestReads);
    messageReceiver.addEventListener('pullUnreads', onPullUnreads);

    window.Signal.AttachmentDownloads.start({
      getMessageReceiver: () => messageReceiver,
      logger: window.log,
    });

    window.textsecure.messaging = new textsecure.MessageSender(
      USERNAME,
      PASSWORD
    );

    const deviceId = textsecure.storage.user.getDeviceId();
    window.log.info('current deviceId:', deviceId);

    // send sync request as soon as possible.
    if (firstRun === true) {
      // standalone mode also should set theme.
      const hasThemeSetting = Boolean(storage.get('theme-setting'));
      if (
        !hasThemeSetting /* && textsecure.storage.get('userAgent') === 'OWI' */
      ) {
        storage.put('theme-setting', window.getSystemTheme());
        onChangeTheme();
      }

      if (deviceId !== '1') {
        Whisper.events.trigger('contactsync:begin');
        Whisper.events.trigger('contactsync');

        //   const syncRequest = new textsecure.SyncRequest(
        //     textsecure.messaging,
        //     messageReceiver
        //   );
        //   Whisper.events.trigger('contactsync:begin');
        //   syncRequest.addEventListener('success', () => {
        //     window.log.info('sync successful');
        //     storage.put('synced_at', Date.now());
        //     Whisper.events.trigger('contactsync');
        //   });
        //   syncRequest.addEventListener('timeout', () => {
        //     window.log.error('sync timed out');
        //     Whisper.events.trigger('contactsync');
        //   });
      }
    }

    // // On startup after upgrading to a new version, request a contact sync
    // //   (but only if we're not the primary device)
    // if (
    //   !firstRun &&
    //   connectCount === 1 &&
    //   newVersion &&
    //   // eslint-disable-next-line eqeqeq
    //   deviceId != '1'
    // ) {
    //   window.getSyncRequest();
    // }

    // window.uploadDeviceInfo();

    if (connectCount === 1) {
      // On startup after upgrading to a new version, or running first time
      // set read-receipt-setting true
      if (deviceId === '1' && (firstRun || newVersion)) {
        // if our device is primary, set read-receipt-setting true
        storage.put('read-receipt-setting', true);
        log.info('put read receipt setting');
      }

      window.fetchMiniProgramList = async (fources = false) => {
        if (window.miniProgramList && !fources) {
          return;
        }
        if (!textsecure.messaging) {
          const ev = new CustomEvent('got-mini-program-list', {
            detail: undefined,
          });
          window.dispatchEvent(ev);
          return;
        }
        try {
          const result = await textsecure.messaging.getMpList();
          if (result && Array.isArray(result)) {
            window.log.info(
              'get mini program list result:' + JSON.stringify(result)
            );
            window.miniProgramList = result;
            window.cacheMpList(result);

            for (let i = 0; i < result.length; i++) {
              if (
                result[i].appId === 'a9e3767bf614820d5c' ||
                result[i].appId === '8b4f99def0bebeda07204'
              ) {
                window.isBeta = true;
                window.sendSetBetaVersion({ isBeta: true });
              }
              if (
                result[i].appId === '122c379c68bc1d5b44' ||
                result[i].appId === '0d83e2abffc2344cae208'
              ) {
                window.isBetaSubtitle = true;
                window.sendSetBetaVersion({ isBetaSubtitle: true });
              }
              // if (
              //   result[i].appId === '89e877273eb1b73f7e0c' ||
              //   result[i].appId === 'a2d14e652f2b1dd8714e'
              // ) {
              //   window.isBetaDot = true;
              //   window.sendSetBetaVersion({ isBetaDot: true });
              // }
            }

            // window.fetchMpDNS();

            // const ev = new CustomEvent('got-mini-program-list', {
            //   detail: result,
            // });
            // window.dispatchEvent(ev);
            return window.miniProgramList;
          }
        } catch (error) {
          window.log.error('load mini program list failed.', error);
        }
        // const ev = new CustomEvent('got-mini-program-list', {
        //   detail: undefined,
        // });
        // window.dispatchEvent(ev);
      };

      window.fetchMpDNS = async () => {
        return;
      };

      window.fetchUserAccessed = async () => {
        return;
      };

      // window.fetchUserAccessed();
      // setInterval(() => {
      //   window.fetchUserAccessed();
      // }, 6 * 60 * 60 * 1000);

      window.getMiniProgramList = () => {
        return window.miniProgramList;
      };

      // const updateTimeZone = async forceUpdate => {
      //   try {
      //     alert("csda");
      //     const timeZone = -new Date().getTimezoneOffset() / 60;
      //     window.log.info('updateTimeZone timeZone:', timeZone);
      //     if (forceUpdate) {
      //       await window.getAccountManager().setProfile({ timeZone });
      //       window.storage.put('local-time-zone', timeZone);
      //       return;
      //     }
      //     if (window.storage.get('local-time-zone') !== timeZone) {
      //       await window.getAccountManager().setProfile({ timeZone });
      //       window.storage.put('local-time-zone', timeZone);
      //     }
      //   } catch (e) {
      //     window.log.error('updateTimeZone error', e);
      //   }
      // };
      // setInterval(updateTimeZone, 10 * 60 * 1000);
      // await updateTimeZone(true);
      // window.setMeetingVersion = () => {
      //   var isMac = /macintosh|mac os x/i.test(
      //     navigator.userAgent.toLowerCase()
      //   );
      //   //alert(JSON.stringify(window.navigator.userAgent.toLowerCase()));
      //   if (isMac) {
      //      alert("is mac");
      //     window
      //       .getAccountManager()
      //       .setProfile({ meetingVersion: MAC_MEETINGVERSION });
      //   } else {
      //     window.getAccountManager().setProfile({ meetingVersion: 1 });
      //   }
      // };
      window.getAccountManager().setProfile({
        meetingVersion,
        msgEncVersion: window.MESSAGE_CURRENT_VERSION,
      });
      //window.setMeetingVersion();

      try {
        window.jsonFileData = await window.getBotReplyJson();
      } catch (error) {
        window.log.error('no such file or directory.', error);
      }

      let directoryVersion;
      let contacts;
      try {
        const result = await textsecure.messaging.fetchDirectoryContacts();
        contacts = result['contacts'];
        directoryVersion = result['directoryVersion'];
      } catch (error) {
        window.log.error('load directory contacts failed.', error);
      }

      if (directoryVersion) {
        storage.put('directoryVersion', directoryVersion);
      }

      let groupContacts;
      try {
        const result = await textsecure.messaging.getGroupV2List();
        groupContacts = result.data.groups || [];
      } catch (error) {
        window.log.error('load group contacts failed.', error);
      }

      // if contacts/groupContacts is undefined, do not update it
      await ConversationController.bulkCreateContactConversations(
        contacts,
        groupContacts
      );

      try {
        const result = await textsecure.messaging.getConversationConfig();

        const { conversations: configArray } = result?.data || {};
        if (configArray?.length) {
          await ConversationController.updateConversationConfigs(configArray);
        }
      } catch (error) {
        window.log.error('load conversations failed.', error);
      }

      await window.fetchMiniProgramList();
      setInterval(() => {
        window.fetchMiniProgramList();
      }, 30 * 1000);
    }

    storage.onready(async () => {
      idleDetector.start();
    });
  }

  function onChangeTheme() {
    const view = window.owsDesktopApp.appView;
    if (view) {
      view.applyTheme();
    }
  }

  function onEmpty(ev) {
    const { incomingQueueEmpty } = ev || {};

    if (incomingQueueEmpty) {
      initialLoadComplete = true;
      offlineMessageLoaded = true;
    }

    window.readyForUpdates();

    let interval = setInterval(() => {
      const view = window.owsDesktopApp.appView;
      if (view) {
        clearInterval(interval);
        interval = null;
        view.onEmpty();
      }
    }, 500);

    Whisper.Notifications.enable();
  }

  function onReconnect() {
    // We disable notifications on first connect, but the same applies to reconnect. In
    //   scenarios where we're coming back from sleep, we can get offline/online events
    //   very fast, and it looks like a network blip. But we need to suppress
    //   notifications in these scenarios too. So we listen for 'reconnect' events.
    Whisper.Notifications.disable();
  }

  function onProgress(ev) {
    const { count } = ev;
    window.log.info(`onProgress: Message count is ${count}`);

    const view = window.owsDesktopApp.appView;
    if (view) {
      view.onProgress(count);
    }
  }

  // function onConfiguration(ev) {
  //   const { configuration } = ev;
  //   const { readReceipts, typingIndicators } = configuration;

  //   storage.put('read-receipt-setting', readReceipts);

  //   if (typingIndicators === true || typingIndicators === false) {
  //     storage.put('typingIndicators', typingIndicators);
  //   }

  //   ev.confirm();
  // }

  // function onTyping(ev) {
  //   const { typing, sender, senderDevice } = ev;
  //   const { groupId, started } = typing || {};

  //   // We don't do anything with incoming typing messages if the setting is disabled
  //   if (!storage.get('typingIndicators')) {
  //     return;
  //   }

  //   const conversation = ConversationController.get(groupId || sender);

  //   if (conversation) {
  //     conversation.notifyTyping({
  //       isTyping: started,
  //       sender,
  //       senderDevice,
  //     });
  //   }
  // }

  // async function onContactReceived(ev) {
  //   const details = ev.contactDetails;
  //   const source = ev.contactSource;

  //   const id = details.number;
  //   const ourNumber = textsecure.storage.user.getNumber();

  //   if (id === ourNumber) {
  //     // special case for syncing details about ourselves
  //     if (details.profileKey) {
  //       window.log.info('Got sync message with our own profile key');
  //       storage.put('profileKey', details.profileKey);
  //     } else {
  //       // perfer reading profielKey from provisoning when update selfcontacts
  //       // ios app may not sync profileKey value.
  //       details.profileKey = storage.get('profileKey');
  //     }
  //   } else {
  //     return;
  //   }

  //   const c = new Whisper.Conversation({
  //     id,
  //   });
  //   const validationError = c.validateNumber();
  //   if (validationError) {
  //     window.log.error(
  //       'Invalid contact received:',
  //       Errors.toLogFormat(validationError)
  //     );
  //     return;
  //   }

  //   try {
  //     const { blocked, avatar, verified } = details;

  //     if (typeof blocked !== 'undefined') {
  //       if (blocked) {
  //         storage.addBlockedNumber(id);
  //       } else {
  //         storage.removeBlockedNumber(id);
  //       }
  //     }

  //     if (
  //       id !== ourNumber &&
  //       source == 'contactsync' &&
  //       (!avatar || !avatar.data || !verified)
  //     ) {
  //       // skipping contactsync contact on some condition.
  //       return;
  //     }

  //     const conversation = await ConversationController.getOrCreateAndWait(
  //       id,
  //       'private'
  //     );
  //     let activeAt = conversation.get('active_at');

  //     // The idea is to make any new contact show up in the left pane. If
  //     //   activeAt is null, then this contact has been purposefully hidden.
  //     if (activeAt === undefined && source == 'internalcontacts') {
  //       activeAt = null;
  //     } else if (activeAt == null) {
  //       // contact from sync, change activeAt to now for show contact.
  //       // if (source == 'contactsync') {
  //       //   activeAt = Date.now();
  //       // }
  //       activeAt;
  //     } else {
  //       activeAt = activeAt || Date.now();
  //     }

  //     if (details.profileKey) {
  //       const profileKey = window.Signal.Crypto.arrayBufferToBase64(
  //         details.profileKey
  //       );
  //       conversation.setProfileKey(profileKey);
  //     }

  //     conversation.set({
  //       name: details.name,
  //       color: details.color,
  //       active_at: activeAt,
  //     });

  //     if (id === ourNumber) {
  //       await conversation.forceUpdatePrivateContact();
  //       await conversation.updateCommonAvatar();

  //       // force trigger events.
  //       conversation.trigger('change change:commonAvatar', conversation);
  //     } else {
  //       // Update the conversation avatar only if new avatar exists and hash differs
  //       if (avatar && avatar.data) {
  //         const maybeUpdateAvatar = conversation.isPrivate()
  //           ? window.Signal.Types.Conversation.maybeUpdateProfileAvatar
  //           : window.Signal.Types.Conversation.maybeUpdateAvatar;

  //         const idName = conversation.isPrivate() ? 'attachmentId' : 'id';

  //         let commonAvatar = {};
  //         commonAvatar[idName] = 'avatar-from-sync-' + Date.now();

  //         const newAttributes = await maybeUpdateAvatar(
  //           conversation.attributes,
  //           avatar.data,
  //           {
  //             writeNewAttachmentData,
  //             deleteAttachmentData,
  //           }
  //         );

  //         conversation.set({
  //           ...newAttributes,
  //           commonAvatar,
  //         });
  //       }
  //     }
  //     await window.Signal.Data.updateConversation(conversation.attributes);

  //     // modified: do not update expiration timer here
  //     // const { expireTimer } = details;
  //     // const isValidExpireTimer = typeof expireTimer === 'number';
  //     // if (isValidExpireTimer) {
  //     //   const source = textsecure.storage.user.getNumber();
  //     //   const receivedAt = Date.now();

  //     //   await conversation.updateExpirationTimer(
  //     //     expireTimer,
  //     //     source,
  //     //     receivedAt,
  //     //     { fromSync: true }
  //     //   );
  //     // }

  //     if (verified) {
  //       const verifiedEvent = new Event('verified');
  //       verifiedEvent.verified = {
  //         state: verified.state,
  //         destination: verified.destination,
  //         identityKey: verified.identityKey.toArrayBuffer(),
  //       };
  //       verifiedEvent.viaContactSync = true;
  //       await onVerified(verifiedEvent);
  //     }
  //   } catch (error) {
  //     window.log.error('onContactReceived error:', Errors.toLogFormat(error));
  //   }
  // }

  // async function onGroupReceived(ev) {
  //   const details = ev.groupDetails;
  //   const { id } = details;

  //   const conversation = await ConversationController.getOrCreateAndWait(
  //     id,
  //     'group'
  //   );

  //   const updates = {
  //     // members: details.members,
  //     color: details.color,
  //     type: 'group',
  //   };

  //   if (details.name) {
  //     updates.name = details.name;
  //   }

  //   if (details.active) {
  //     const activeAt = conversation.get('active_at');

  //     // The idea is to make any new group show up in the left pane. If
  //     //   activeAt is null, then this group has been purposefully hidden.
  //     if (activeAt !== null) {
  //       updates.active_at = activeAt || Date.now();
  //     }
  //   }

  //   if (details.blocked) {
  //     storage.addBlockedGroup(id);
  //   } else {
  //     storage.removeBlockedGroup(id);
  //   }

  //   conversation.set(updates);

  //   // do not update avatar from sync
  //   // // Update the conversation avatar only if new avatar exists and hash differs
  //   // const { avatar } = details;
  //   // if (avatar && avatar.data) {
  //   //   const newAttributes =
  //   //     await window.Signal.Types.Conversation.maybeUpdateAvatar(
  //   //       conversation.attributes,
  //   //       avatar.data,
  //   //       {
  //   //         writeNewAttachmentData,
  //   //         deleteAttachmentData,
  //   //       }
  //   //     );
  //   //   conversation.set(newAttributes);
  //   // }

  //   // try to upgrade group
  //   if (conversation.isGroupNeedUpgrade()) {
  //     await conversation.tryUpgradeGroupIfNeeded();
  //   } else {
  //     if (!conversation.syncedGroupWithApiLoad) {
  //       try {
  //         await conversation.apiLoadGroupV2();
  //         conversation.syncedGroupWithApiLoad = true;
  //       } catch (error) {
  //         log.error('sync groupV2 info failed,', conversation.getGroupV2Id());
  //       }
  //     }
  //   }
  //   await window.Signal.Data.updateConversation(conversation.attributes);
  //   // const { expireTimer } = details;
  //   // const isValidExpireTimer = typeof expireTimer === 'number';
  //   // if (!isValidExpireTimer) {
  //   //   return;
  //   // }

  //   // const source = textsecure.storage.user.getNumber();
  //   // const receivedAt = Date.now();
  //   // await conversation.updateExpirationTimer(expireTimer, source, receivedAt, {
  //   //   fromSync: true,
  //   // });

  //   ev.confirm();
  // }

  // Descriptors
  const getGroupDescriptor = group => ({
    type: Message.GROUP,
    id: group.id,
  });

  // Matches event data from `libtextsecure` `MessageReceiver::handleSentMessage`:
  const getDescriptorForSent = ({ message, destination }) =>
    message.group
      ? getGroupDescriptor(message.group)
      : { type: Message.PRIVATE, id: destination };

  // Matches event data from `libtextsecure` `MessageReceiver::handleDataMessage`:
  const getDescriptorForReceived = ({ message, source }) =>
    message.group
      ? getGroupDescriptor(message.group)
      : { type: Message.PRIVATE, id: source };

  function createMessageHandler({
    createMessage,
    getMessageDescriptor,
    handleProfileUpdate,
  }) {
    return async event => {
      const { data, confirm } = event;

      const messageDescriptor = getMessageDescriptor(data);

      const { PROFILE_KEY_UPDATE } = textsecure.protobuf.DataMessage.Flags;
      // eslint-disable-next-line no-bitwise
      const isProfileUpdate = Boolean(data.message.flags & PROFILE_KEY_UPDATE);
      if (isProfileUpdate) {
        return handleProfileUpdate({ data, confirm, messageDescriptor });
      }

      const conversation = await ConversationController.getOrCreateAndWait(
        messageDescriptor.id,
        messageDescriptor.type
      );

      let message = await createMessage(data, conversation.id);

      if (data.message?.reaction) {
        // we use this message, but we DO NOT save it laterly.
        const { source = {} } = data.message.reaction;

        if (data.message.group) {
          message.set({ conversationId: messageDescriptor.id });
        }

        const reactionMessage = Whisper.EmojiReactions.add({
          initialMessage: data.message,
          whisperMessage: message,
          ...source,
        });

        // set as read here when received some one's reaction
        setTimeout(() => {
          if (
            !conversation.isLargeGroup() ||
            !conversation.isChatWithoutReceipt()
          ) {
            Whisper.ReadReceipts.forMessage(message);
          }
        }, 0);

        return Whisper.EmojiReactions.onEmojiReaction(reactionMessage, confirm);
      }

      const filterDuplicate = async () => {
        const duplicate = await getMessageDuplicate(conversation, message);
        if (duplicate) {
          if (duplicate.isUnsupportedMessage()) {
            // rehandle duplicated unsupported message when app has been updated
            log.info(
              `rehandle unsupported message ${duplicate.idForLogging()}`
            );

            const registered = MessageController.register(
              duplicate.id,
              duplicate
            );

            // reaction unsupported messages should be deleted
            if (registered.isReactionUnsupportedMessage()) {
              return null;
            }

            return registered;
          } else {
            window.log.warn(
              'Received duplicate message',
              duplicate.idForLogging(),
              duplicate.get('received_at')
            );
          }
        } else {
          return message;
        }
      };

      message = await filterDuplicate();
      if (!message) {
        // has duplicated
        return event.confirm();
      }

      // break task
      await new Promise(r => setTimeout(r, 0));

      return message.handleDataMessage(
        data.message,
        event.confirm,
        filterDuplicate,
        data.conversationPushedAt
      );
    };
  }

  // Received:
  async function handleMessageReceivedProfileUpdate({
    data,
    confirm,
    messageDescriptor,
  }) {
    const profileKey = data.message.profileKey.toString('base64');
    const sender = await ConversationController.getOrCreateAndWait(
      messageDescriptor.id,
      'private'
    );

    // Will do the save for us
    await sender.setProfileKey(profileKey);

    return confirm();
  }

  const onMessageReceived = createMessageHandler({
    handleProfileUpdate: handleMessageReceivedProfileUpdate,
    getMessageDescriptor: getDescriptorForReceived,
    createMessage: initIncomingMessage,
  });

  // Sent:
  async function handleMessageSentProfileUpdate({
    data,
    confirm,
    messageDescriptor,
  }) {
    // First set profileSharing = true for the conversation we sent to
    const { id, type } = messageDescriptor;
    const conversation = await ConversationController.getOrCreateAndWait(
      id,
      type
    );

    conversation.set({ profileSharing: true });
    await window.Signal.Data.updateConversation(conversation.attributes);

    // Then we update our own profileKey if it's different from what we have
    const ourNumber = textsecure.storage.user.getNumber();
    const profileKey = data.message.profileKey.toString('base64');
    const me = ConversationController.getOrCreate(ourNumber, 'private');

    // Will do the save for us if needed
    await me.setProfileKey(profileKey);

    return confirm();
  }

  function createSentMessage(data, conversationId) {
    const now = Date.now();

    return new Whisper.Message({
      source: textsecure.storage.user.getNumber(),
      sourceDevice: data.device,
      sent_at: data.timestamp,
      received_at: now,
      conversationId,
      type: 'outgoing',
      sent: true,
      expirationStartTimestamp: Math.min(
        data.expirationStartTimestamp || data.timestamp || Date.now(),
        Date.now()
      ),
      rapidFiles: data.rapidFiles,
      serverTimestamp: data.serverTimestamp || data.timestamp,
      sequenceId: data.sequenceId,
      notifySequenceId: data.notifySequenceId,
    });
  }

  const onSentMessage = createMessageHandler({
    handleProfileUpdate: handleMessageSentProfileUpdate,
    getMessageDescriptor: getDescriptorForSent,
    createMessage: createSentMessage,
  });

  async function getMessageDuplicate(conversation, message) {
    if (conversation) {
      const collection = conversation.messageCollection;

      const sent_at = message.get('sent_at');
      const source = message.getSource();
      const sourceDevice = message.getSourceDevice();

      let founds = collection.where({ sent_at });
      if (founds?.length) {
        const isMatch = model =>
          model.getSource() === source &&
          model.getSourceDevice() === sourceDevice;

        const found = founds.find(isMatch);
        if (found) {
          return found;
        }
      }

      try {
        const condition = {
          sent_at,
          source,
          sourceDevice,
          fromOurDevice: message.maybeFromOurDevice(),
        };

        return await window.Signal.Data.getMessageBySender(condition, {
          Message: Whisper.Message,
        });
      } catch (error) {
        window.log.error(
          'getMessageDuplicate error:',
          Errors.toLogFormat(error)
        );
        return false;
      }
    }
  }

  async function initIncomingMessage(data, conversationId) {
    const message = new Whisper.Message({
      source: data.source,
      sourceDevice: data.sourceDevice,
      sent_at: data.timestamp,
      received_at: data.receivedAt || Date.now(),
      conversationId,
      type: 'incoming',
      unread: 1,
      envelopeType: data.envelopeType,
      serverTimestamp: data.serverTimestamp || data.timestamp,
      sequenceId: data.sequenceId,
      notifySequenceId: data.notifySequenceId,
    });

    return message;
  }

  const onExternalMessage = async event => {
    const { data, confirm } = event;

    if (data.external?.type === 'PIN') {
      const pinId = data.external?.pinId;
      if (!pinId) {
        log.error('pinId was not found for external PIN');
        return confirm();
      }

      const ourNumber = textsecure.storage.user.getNumber();
      const message = new Whisper.Message({
        id: pinId,
        pinId: pinId,
        pin: pinId,
        source: data.source,
        sourceDevice: data.sourceDevice,
        sent_at: data.timestamp,
        received_at: data.timestamp,
        timestamp: data.timestamp,
        type: data.source === ourNumber ? 'outgoing' : 'incoming',
        conversationId: data.external?.conversationId,
        serverTimestamp: data.serverTimestamp || data.timestamp,
        sequenceId: data.sequenceId,
        notifySequenceId: data.notifySequenceId,
      });

      const messageDescriptor = getDescriptorForReceived(data);
      await ConversationController.getOrCreateAndWait(
        messageDescriptor.id,
        messageDescriptor.type
      );

      return message.handleExternalPinMessage(
        data.message,
        confirm,
        data.external?.notifyOperator
      );
    } else {
      log.error('Invalid external:', data.external);
      return confirm();
    }
  };

  const onArchive = async ev => {
    const { conversationArchive } = ev;

    if (!conversationArchive) {
      return;
    }

    const { conversationId, flag, timestamp } = conversationArchive;
    const conversation = ConversationController.get(conversationId);
    if (!conversation) {
      return;
    }
    const onArchiveAt = conversation.get('onArchiveAt');
    if (!onArchiveAt || onArchiveAt < timestamp) {
      conversation.set({ onArchiveAt: timestamp });
      if (
        flag ===
        textsecure.protobuf.SyncMessage.ConversationArchive.Flag.ARCHIVE
      ) {
        await conversation.setArchived(true);
        await conversation.markAsRead();
      }
    }
  };

  const onMarkAsUnread = async ev => {
    const { markAsUnread } = ev;

    if (!markAsUnread) {
      return;
    }

    const { conversationId, flag, timestamp } = markAsUnread;
    const conversation = ConversationController.get(conversationId);
    if (!conversation) {
      return;
    }

    const markAsAt = conversation.get('markAsAt');
    if (!markAsAt || markAsAt < timestamp) {
      conversation.set({ markAsAt: timestamp });

      const lastReadPosition = await conversation.getLastReadPosition();
      if (lastReadPosition?.maxServerTimestamp > timestamp) {
        conversation.unset('markAsFlag');
        return;
      }

      conversation.set({ markAsFlag: flag });

      if (flag === textsecure.protobuf.SyncMessage.MarkAsUnread.Flag.READ) {
        await conversation.markAsRead();
      }
    }
  };

  window.pullRemoteMessages = (
    uniformId,
    seqIdArray,
    seqIdRange,
    providedOptions
  ) => {
    if (!messageReceiver) {
      throw new Error('message receiver was not ready.');
    }

    return new Promise((resolve, reject) => {
      if (!messageReceiver) {
        window.log.error('message receiver was not ready.');
        reject();
        return;
      }

      const options = providedOptions || {};
      _.defaults(options, { pullDone: () => resolve() });

      messageReceiver
        .pullRemoteMessages(uniformId, seqIdArray, seqIdRange, options)
        .catch(error => {
          log.error('pulling remote messages failed', error);
          reject();
        });
    });
  };

  const onConversationInfo = async ev => {
    const { conversationInfo = {} } = ev;

    log.info('on received conversation info', conversationInfo);

    const { conversationPreview, conversationExtern } = conversationInfo;
    if (!conversationPreview) {
      log.error('invalid conversation preview.');
      return;
    }

    const { conversationId = {} } = conversationPreview;
    const { number, groupId } = conversationId;

    if (!number && !groupId) {
      log.error('Invalid conversationId for conversationPreview');
      return;
    }

    const id = number || groupId;
    if (id === 'server') {
      log.warn('skip server notifications.');
      return;
    }

    const type = number ? 'private' : 'group';
    const conversation = await ConversationController.getOrCreateAndWait(
      id,
      type
    );
    if (!conversation) {
      log.error('Can not find conversation for id', id);
      return;
    }

    // handle preview latest self read position
    const { readPosition } = conversationPreview;
    if (readPosition?.maxServerTimestamp && readPosition?.readAt) {
      conversation.onReadPosition({ ...readPosition, conversationId: id });
    } else {
      log.warn('skip invalid read position', readPosition);
    }

    // conversation hot data
    // when has conversationExtern
    // we should try to load remote information
    if (conversationExtern) {
      const { oldestMsgSeqId, latestMsgSeqId } = conversationExtern;

      // try to find latest message that has been read.
      // 1 from read position
      const { maxSequenceId = 0 } = readPosition || {};

      // 2 maxOutgoingMsgSeqId
      const { maxOutgoingMsgSeqId = 0 } = conversationPreview;

      // sequence id of latest message that is treated as read
      const latestAsReadMsgSeqId = conversation.isMe()
        ? latestMsgSeqId
        : Math.max(maxSequenceId, maxOutgoingMsgSeqId);

      // the oldest sequence id of already loaded remote messages
      let oldestLoadedMsgSeqId = conversation.get('oldestLoadedMsgSeqId');
      // the newest sequence id of already loaded remote messages
      let latestLoadedMsgSeqId = conversation.get('latestLoadedMsgSeqId');

      let lastUserMsgSeqId;
      try {
        const message = await window.Signal.Data.findLastUserMessage(
          conversation.id,
          {
            Message: Whisper.Message,
          }
        );

        if (message) {
          lastUserMsgSeqId = message.get('sequenceId');
        }
      } catch (error) {
        log.error('findLastUserMessage failed,', error);
      }

      if (
        lastUserMsgSeqId &&
        (!latestLoadedMsgSeqId || lastUserMsgSeqId > latestLoadedMsgSeqId)
      ) {
        latestLoadedMsgSeqId = lastUserMsgSeqId;
        if (!latestLoadedMsgSeqId) {
          oldestLoadedMsgSeqId = lastUserMsgSeqId;
        }
      }

      if (!latestLoadedMsgSeqId || oldestMsgSeqId > latestLoadedMsgSeqId) {
        oldestLoadedMsgSeqId = null;
        latestLoadedMsgSeqId = null;
      } else {
        // remain unchanged
      }

      log.info(
        'update conversation msgSeqId:',
        [
          latestLoadedMsgSeqId,
          oldestLoadedMsgSeqId,
          latestLoadedMsgSeqId,
          oldestMsgSeqId,
          latestMsgSeqId,
          latestAsReadMsgSeqId,
        ],
        conversation.idForLogging()
      );

      conversation.set({
        oldestLoadedMsgSeqId,
        latestLoadedMsgSeqId,
        oldestRemoteMsgSeqId: oldestMsgSeqId,
        latestRemoteMsgSeqId: latestMsgSeqId,
        latestAsReadMsgSeqId,
      });

      await window.Signal.Data.updateConversation(conversation.attributes);

      // if has unread message
      // may be we should use notify sequence id ?
      if (latestAsReadMsgSeqId < latestMsgSeqId) {
        // load one page per conversation
        await conversation.pullRemoteMessages(true, false);
      } else {
        window.log.info(
          'skipping, there is no unread message',
          conversation.idForLogging()
        );
        return;
      }
    }
  };

  const onLatestReads = async ev => {
    const { conversationId, readPositions } = ev;

    const { number, groupId } = conversationId;

    if (!number && !groupId) {
      log.error('Invalid conversationId for conversationPreview');
      return;
    }

    const id = number || groupId;
    if (id === 'server') {
      log.warn('skip server notifications.');
      return;
    }

    const type = number ? 'private' : 'group';
    const conversation = await ConversationController.getOrCreateAndWait(
      id,
      type
    );

    if (!conversation) {
      log.error('Can not find conversation for id', id);
      return;
    }

    const readByAtMapping = conversation.get('read_by_at') || {};
    const newReadByAtMapping = {};

    let changed = false;
    for (const position of readPositions) {
      const { source, maxServerTimestamp, maxNotifySequenceId } = position;
      const oldPosition = readByAtMapping[source];
      if (!oldPosition || maxServerTimestamp > oldPosition.maxServerTimestamp) {
        changed = true;
        newReadByAtMapping[source] = {
          reader: source,
          conversationId: conversation.id,
          readAt: position.readAt,
          maxServerTimestamp,
          maxNotifySequenceId,
        };
      }
    }

    if (changed) {
      conversation.set({
        read_by_at: { ...readByAtMapping, ...newReadByAtMapping },
      });
      await window.Signal.Data.updateConversation(conversation.attributes);
    }
  };

  async function onPullUnreads() {
    const conversations = window.getConversations();

    for (const conversation of conversations.models) {
      if (!conversation.hasNewerUnloadedRemoteMessages()) {
        continue;
      }

      await conversation.pullAllRemoteUnreadMessages();
    }
  }

  let isLoggedOut = false;
  async function onError(ev) {
    const { error, manualLogout } = ev;
    window.log.error('background onError:', Errors.toLogFormat(error));

    // the client version too old
    if (error && error.code === 450) {
      await window.forceUpdateAlert();
      window.sendBrowserOpenUrl('https://chative.difft.org');
      window.wantQuit();
      return;
    }

    if (
      manualLogout ||
      (error &&
        error.name === 'HTTPError' &&
        (error.code === 401 || error.code === 403))
    ) {
      if (isLoggedOut) {
        window.log.info('background logging out');
        return;
      }

      isLoggedOut = true;

      const oldTheme = storage.get('theme-setting');
      Whisper.events.trigger('unauthorized');
      window.closeRtmWindow();
      window.closeCallVoice();

      // if (window.userStatusReceiver) {
      //   window.userStatusReceiver.close();
      //   window.userStatusReceiver = undefined;
      // }

      if (messageReceiver) {
        await messageReceiver.stopProcessing();
        await window.waitForAllBatchers();
        messageReceiver.unregisterBatchers();
      }

      onEmpty();

      window.log.warn(
        'Client is no longer authorized; deleting local configuration'
      );
      Whisper.Registration.remove();

      const NUMBER_ID_KEY = 'number_id';
      const VERSION_KEY = 'version';
      const LAST_PROCESSED_INDEX_KEY = 'attachmentMigration_lastProcessedIndex';
      const IS_MIGRATION_COMPLETE_KEY = 'attachmentMigration_isComplete';
      const THREAD_INTEGRATED = 'threadIntegrated';
      const MENTIONS_INTEGRATED = 'mentionsIntegrated';

      const previousNumberId = textsecure.storage.get(NUMBER_ID_KEY);
      const lastProcessedIndex = textsecure.storage.get(
        LAST_PROCESSED_INDEX_KEY
      );
      const isMigrationComplete = textsecure.storage.get(
        IS_MIGRATION_COMPLETE_KEY
      );

      try {
        const threadIntegrated = textsecure.storage.get(THREAD_INTEGRATED);
        const mentionsIntegrated = textsecure.storage.get(MENTIONS_INTEGRATED);

        await textsecure.storage.protocol.removeAllConfiguration();

        if (threadIntegrated) {
          textsecure.storage.put(THREAD_INTEGRATED, threadIntegrated);
        }

        if (mentionsIntegrated) {
          textsecure.storage.put(MENTIONS_INTEGRATED, mentionsIntegrated);
        }

        // These two bits of data are important to ensure that the app loads up
        //   the conversation list, instead of showing just the QR code screen.
        Whisper.Registration.markEverDone();
        textsecure.storage.put(NUMBER_ID_KEY, previousNumberId);

        // These two are important to ensure we don't rip through every message
        //   in the database attempting to upgrade it after starting up again.
        textsecure.storage.put(
          IS_MIGRATION_COMPLETE_KEY,
          isMigrationComplete || false
        );
        textsecure.storage.put(
          LAST_PROCESSED_INDEX_KEY,
          lastProcessedIndex || null
        );
        textsecure.storage.put(VERSION_KEY, window.getVersion());

        window.log.info('Successfully cleared local configuration');
      } catch (eraseError) {
        window.log.error(
          'Something went wrong clearing local configuration',
          eraseError && eraseError.stack ? eraseError.stack : eraseError
        );
      }

      if (oldTheme) {
        storage.put('theme-setting', oldTheme);
      }

      window.relaunch();
      return;
    }

    if (
      error &&
      error.name === 'HTTPError' &&
      (error.code === -1 ||
        error.code === 429 ||
        (error.code >= 500 && error.code <= 599))
    ) {
      // Failed to connect to server
      if (navigator.onLine) {
        window.log.info('retrying in 15s');
        setTimeout(connect, 15000);

        Whisper.events.trigger('reconnectTimer', 15000);
      }
      return;
    }

    // clear reconnect timer displays
    Whisper.events.trigger('reconnectTimer', null);

    if (ev.proto) {
      if (error && error.name === 'MessageCounterError') {
        if (ev.confirm) {
          ev.confirm();
        }
        // Ignore this message. It is likely a duplicate delivery
        // because the server lost our ack the first time.
        return;
      }
      const envelope = ev.proto;

      // just do not show error message.
      window.log.warn(
        'background onError: Doing nothing with incoming error:',
        _.pick(envelope, ['source', 'sourceDevice', 'timestamp', 'receivedAt'])
      );

      if (ev.confirm) {
        ev.confirm();
      }

      // // there will be a empty message while envelope.source is null.
      // if (envelope.source) {
      //   const message = await initIncomingMessage(envelope, {isError: true});

      //   await message.saveErrors(error || new Error('Error was null'));
      //   const id = message.get('conversationId');
      //   const conversation = await ConversationController.getOrCreateAndWait(
      //     id,
      //     'private'
      //   );
      //   conversation.set({
      //     active_at: Date.now(),
      //     unreadCount: conversation.get('unreadCount') + 1,
      //   });

      //   const conversationTimestamp = conversation.get('timestamp');
      //   const messageTimestamp = message.get('timestamp');
      //   if (!conversationTimestamp || messageTimestamp > conversationTimestamp) {
      //     conversation.set({timestamp: message.get('sent_at')});
      //   }

      //   conversation.trigger('newmessage', message);
      //   conversation.notify(message);

      //   if (ev.confirm) {
      //     ev.confirm();
      //   }

      //   await window.Signal.Data.updateConversation(id, conversation.attributes, {
      //     Conversation: Whisper.Conversation,
      //   });
      // } else {
      //   // we just delete this from cache and return to fix this empty message.
      //   window.log.info('envelope has invalid source, just drop this envelope');
      //   if (ev.confirm) {
      //     ev.confirm();
      //   }
      //   return;
      // }
    }

    throw error;
  }

  function onReadReceipt(ev) {
    const reads = ev.reads || [];
    const readPosition = ev.readPosition;

    window.log.info('read receipt', reads, readPosition, 'at', ev.timestamp);

    // if (!storage.get('read-receipt-setting')) {
    //   return ev.confirm();
    // }

    // Calling this directly so we can wait for completion
    return Whisper.ReadReceipts.onReceipt(reads, readPosition, ev.confirm);
  }

  function onReadSync(ev) {
    const reads = ev.reads || [];
    window.log.info('read sync', reads, 'at', ev.timestamp);

    // Calling this directly so we can wait for completion
    return Whisper.ReadSyncs.onReceipt(reads, ev.confirm);
  }

  async function onVerified(ev) {
    const number = ev.verified.destination;
    const key = ev.verified.identityKey;
    let state;

    const c = new Whisper.Conversation({
      id: number,
    });
    const error = c.validateNumber();
    if (error) {
      window.log.error(
        'Invalid verified sync received:',
        Errors.toLogFormat(error)
      );
      return;
    }

    switch (ev.verified.state) {
      case textsecure.protobuf.Verified.State.DEFAULT:
        state = 'DEFAULT';
        break;
      case textsecure.protobuf.Verified.State.VERIFIED:
        state = 'VERIFIED';
        break;
      case textsecure.protobuf.Verified.State.UNVERIFIED:
        state = 'UNVERIFIED';
        break;
      default:
        window.log.error(`Got unexpected verified state: ${ev.verified.state}`);
    }

    window.log.info(
      'got verified sync for',
      number,
      state,
      ev.viaContactSync ? 'via contact sync' : ''
    );

    const contact = await ConversationController.getOrCreateAndWait(
      number,
      'private'
    );
    const options = {
      viaSyncMessage: true,
      viaContactSync: ev.viaContactSync,
      key,
    };

    if (state === 'VERIFIED') {
      await contact.setVerified(options);
    } else if (state === 'DEFAULT') {
      await contact.setVerifiedDefault(options);
    } else {
      await contact.setUnverified(options);
    }

    if (ev.confirm) {
      ev.confirm();
    }
  }

  // function onDeliveryReceipt(ev) {
  //   const { deliveryReceipt } = ev;
  //   window.log.info(
  //     'delivery receipt from',
  //     `${deliveryReceipt.source}.${deliveryReceipt.sourceDevice}`,
  //     deliveryReceipt.timestamp
  //   );

  //   const receipt = Whisper.DeliveryReceipts.add({
  //     timestamp: deliveryReceipt.timestamp,
  //     source: deliveryReceipt.source,
  //   });

  //   ev.confirm();

  //   // Calling this directly so we can wait for completion
  //   return Whisper.DeliveryReceipts.onReceipt(receipt);
  // }

  // async function onInternalContactsReceived(details) {
  //   var ev = { contactDetails: details, contactSource: 'internalcontacts' };
  //   await onContactReceived(ev);
  // }

  async function sendVoiceMessage(info) {
    let contact;
    if (info.groupId) {
      contact = await ConversationController.getOrCreateAndWait(
        info.groupId,
        'group'
      );
    } else {
      contact = await ConversationController.getOrCreateAndWait(
        info.id,
        'private'
      );
    }

    if (!contact) {
      return;
    }

    if (!info.markdown) {
      await contact.forceSendMessageAuto(info.message, null, [], null, null, {
        callAction: info.callAction,
        channelName: info.channelName,
        meetingName: info.meetingName,
        freeConfidential: true,
      });
      return;
    }

    const ourNumber = textsecure.storage.user.getNumber();
    const conversation = ConversationController.get(ourNumber);
    const name = conversation.getName() || ourNumber;

    let message = name + ' ' + info.message;
    const pos = message.indexOf('[click to');
    if (pos !== -1) {
      let left = message.substring(0, pos);
      const right = message.substring(pos);
      const keys = '*_~[]()#!-<>|`';
      for (let i = 0; i < keys.length; i += 1) {
        const re = new RegExp('\\' + keys[i], 'g');
        left = left.replaceAll(re, '\\' + keys[i]);
      }
      message = left + right;
    }

    const card = { appId: '', content: message };
    await contact.forceSendMessageAuto(
      message,
      null,
      [],
      null,
      null,
      {
        callAction: info.callAction,
        channelName: info.channelName,
        meetingName: info.meetingName,
      },
      null,
      null,
      null,
      { card, freeConfidential: true }
    );
  }

  const NOTIFY_TYPE = {
    CHANGE_BASIC: 0,
    CHANGE_MEMBERS: 1,
    CHANGE_MEMBER_INFO: 2,
    CHANGE_ANNOUNCEMENT: 3,
    CHANGE_MY_SETTINGS: 4,
    CHANGE_PIN: 5,
    CHANGE_MEETING_FEEDBACK: 6,
    CHANGE_MEETING_USER_JOIN_LEAVE: 7,
    CHANGE_GROUP_REMIND_CYCLE: 8,
    CHANGE_GROUP_MEETING_REMIND: 9,

    CHANGE_MEMBER_INFO_RAPID: 100,
  };

  const NOTIFY_DETAILED_TYPE = {
    CREATE_GROUP: 0,
    JOIN_GROUP: 1,
    LEAVE_GROUP: 2,
    INVITE_JOIN_GROUP: 3,
    KICKOUT_GROUP: 4,
    DISMISS_GROUP: 5,
    GROUP_NAME_CHANGE: 6,
    GROUP_AVATAR_CHANGE: 7,
    GROUP_MSG_EXPIRY_CHANGE: 8,
    GROUP_ADD_ADMIN: 9,
    GROUP_DEL_ADMIN: 10,
    GROUP_MEMBERINFO_CHANGE: 11,
    GROUP_CHANGE_OWNER: 12,
    GROUP_ADD_ANNOUNCEMENT: 13,
    GROUP_UPDATE_ANNOUNCEMENT: 14,
    GROUP_DEL_ANNOUNCEMENT: 15,
    GROUP_OTHER_CHANGE: 16,
    GROUP_MEMBERINFO_CHANGE_PRIVATE: 17,
    GROUP_ADD_PIN: 18,
    GROUP_DEL_PIN: 19,
    GROUP_INVITATION_RULE_CHANGE: 20,
    GROUP_REMIND_CHANGE: 21,
    GROUP_REMIND: 22,
    GROUP_CHANGE_RAPID_ROLE: 23,
    GROUP_ANYONE_REMOVE_CHANGE: 24,
    GROUP_REJOIN_CHANGE: 25,
    GROUP_EXT_CHANGE_ACCOUNT: 26,
    GROUP_PUBLISH_ONLY_GROUP_RULE_CHANGE: 27,
    GROUP_DESTROY: 35,
  };

  const CHANGE_ACTION = {
    ADD: 0,
    UPDATE: 1,
    LEAVE: 2,
    DELETE: 3,
    NONE: 4,
  };

  const MEMBER_ROLE = {
    OWNER: 0,
    ADMIN: 1,
    MEMBER: 2,
  };

  async function mergeMembers(conversation, changedMembers, operator) {
    if (!changedMembers?.length) {
      log.info('There is no changed members.');
      return {};
    }
    // notification changed members
    const addedMembers = changedMembers.filter(
      m => m.action === CHANGE_ACTION.ADD
    );
    const leftMembers = changedMembers.filter(
      m => m.action === CHANGE_ACTION.LEAVE
    );
    const removedMembers = changedMembers.filter(
      m => m.action === CHANGE_ACTION.DELETE
    );
    const updatedMembers = changedMembers.filter(
      m => m.action === CHANGE_ACTION.UPDATE
    );

    // changed numbers array
    const addedArray = addedMembers.map(m => m.uid) || [];
    const leftArray = leftMembers.map(m => m.uid) || [];
    const removedArray = removedMembers.map(m => m.uid) || [];
    const changedArray = changedMembers.map(m => m.uid) || [];

    const existMembersV2 = conversation.get('membersV2') || [];
    const existMembers = existMembersV2.map(m => m.id) || [];

    // {
    //   "uid":"+72212204429",
    //   "role":0,
    //   "displayName":"",
    //   "notification":1,
    //   "action":0
    // }
    const addedMembersV2 =
      addedMembers.map(m => {
        return {
          id: m.uid,
          role: m.role,
          rapidRole: m.rapidRole,
          displayName: m.displayName,
          extId: m.extId,
        };
      }) || [];

    const updatedMembersV2 = updatedMembers.map(m => ({
      id: m.uid,
      role: m.role,
      rapidRole: m.rapidRole,
      displayName: m.displayName,
      extId: m.extId,
    }));

    // added members may already exists, members should respect data from server
    let changedMembersV2 =
      existMembersV2.filter(m => !changedArray.includes(m.id)) || [];
    changedMembersV2 = changedMembersV2.concat(addedMembersV2);
    changedMembersV2 = changedMembersV2.concat(updatedMembersV2);

    const changedMembersV1 = changedMembersV2.map(m => m.id);

    let update = {
      members: changedMembersV1,
      membersV2: changedMembersV2,
    };

    const ourNumber = textsecure.storage.user.getNumber();

    let hasOwner;
    for (let i = 0; i < changedMembers.length; i += 1) {
      if (changedMembers[i].role === 0) {
        hasOwner = changedMembers[i].uid;
        break;
      }
    }
    if (hasOwner) {
      for (let i = 0; i < existMembersV2.length; i += 1) {
        if (existMembersV2[i].id !== hasOwner && existMembersV2[i].role === 0) {
          conversation.set(update);
          const groupUpdate = {
            changeOwner: hasOwner,
          };
          return groupUpdate;
        }
      }
    }

    let hasAdmin;
    let hasUser;
    if (changedMembers.length === 1) {
      for (let i = 0; i < changedMembers.length; i += 1) {
        if (changedMembers[i].role === 1) {
          hasAdmin = changedMembers[i].uid;
        }
        if (changedMembers[i].role === 2) {
          hasUser = changedMembers[i].uid;
        }
      }
      if (hasAdmin) {
        for (let i = 0; i < existMembersV2.length; i += 1) {
          if (
            existMembersV2[i].id === hasAdmin &&
            existMembersV2[i].role === 2
          ) {
            conversation.set(update);
            const groupUpdate = {
              addAdmins: [hasAdmin],
            };
            return groupUpdate;
          }
        }
      }
      if (hasUser) {
        for (let i = 0; i < existMembersV2.length; i += 1) {
          if (
            existMembersV2[i].id === hasUser &&
            existMembersV2[i].role === 1
          ) {
            conversation.set(update);
            const groupUpdate = {
              removeAdmins: [hasUser],
            };
            return groupUpdate;
          }
        }
      }
    }

    // add / leave / remove should not come together.
    let changeArrayExcludeUpdate = {};
    let groupUpdate = {};
    const realAddedArray = addedArray.filter(m => !existMembers.includes(m));
    if (realAddedArray.length > 0) {
      groupUpdate.joined = realAddedArray;
      groupUpdate.joinOperator = operator;
    }

    // leftArray length is 0 or 1
    if (leftArray.length > 0) {
      if (leftArray[0] === ourNumber) {
        groupUpdate.left = 'You';
        await conversation.destroyMessages();
      } else {
        groupUpdate.left = leftArray[0];
      }
      if (leftArray.includes(ourNumber)) {
        update.left = true;
      }
    }

    if (removedArray.length > 0) {
      groupUpdate.removed = removedArray;
      if (removedArray.includes(ourNumber)) {
        await conversation.destroyMessages();
        update.left = true;

        let me;
        for (let i = 0; i < removedMembers.length; i++) {
          if (removedMembers[i].uid === ourNumber) {
            me = removedMembers[i];
            break;
          }
        }
        const { inviteCode } = me || {};
        if (inviteCode) {
          const rejoin = conversation.get('rejoin');

          // 1-only admin //2-everyone
          const invitationRule = conversation.get('invitationRule');

          // 0-owner,1-admin,2-member
          let operatorRole;
          const membersV2 = conversation.get('membersV2');
          for (let i = 0; i < membersV2.length; i++) {
            if (membersV2[i].id === operator) {
              operatorRole = membersV2[i].role;
              break;
            }
          }
          log.info(
            'current rejoin role: ' + rejoin,
            'operatorRole:' + operatorRole,
            'invitationRule: ' + invitationRule
          );

          if (rejoin) {
            if (invitationRule === 1) {
              if (operatorRole === 0 || operatorRole === 1) {
                groupUpdate.inviteCode = inviteCode;
              }
            } else {
              groupUpdate.inviteCode = inviteCode;
            }
          }
        }
      }
    }

    conversation.set(update);
    return groupUpdate;
  }

  function onChangeNotification(ev) {
    const { notification } = ev;
    ev.confirm();
    log.info('notification for coversation:', notification);
    const { notifyType, notifyTime, display, content, data } = notification;
    switch (notifyType) {
      case 0:
        return queueGroupChangeHandler(notifyTime, data, display);
      case 1:
        return queueDirectoryChangeHandler(notifyTime, data);
      case 2:
        return queueTaskChangeHandler(data, content, notifyTime);
      case 3:
        return queueVoteChangeHandler(data);
      case 4:
        return queueConversationChangeHandler(notifyTime, data, display);
      case 5:
        return queueConversationShareChangeHandler(notifyTime, data, display);
      case 6:
        return queueFriendshipChangeHandler(notifyTime, data);
      case 8:
        return queueReminderChangeHandler(notifyTime, data);
      default:
        log.warn('unknown notify type,', notifyType);
        return;
    }
  }

  function queueReminderChangeHandler(notifyTime, data) {
    // type: group | private
    // conversation: uid | gid
    const { type, conversation: cid } = data || {};
    if (type !== 'private' && type !== 'group') {
      log.info('Reminder notify unknown type:', type);
      return;
    }

    const id = type === 'group' ? window.Signal.ID.convertIdToV1(cid) : cid;
    return ConversationController.getOrCreateAndWait(id, type).then(
      conversation => {
        conversation.queueJob(() =>
          handleReminderChange(
            notifyTime,
            {
              ...data,
              idV1: cid,
              idV2: id,
            },
            conversation
          )
        );
      }
    );
  }

  function queueGroupChangeHandler(notifyTime, data, display) {
    const { gid, ver, groupNotifyType, groupVersion } = data;
    if (ver !== 1) {
      log.error(
        '[',
        ver,
        notifyTime,
        '] group notification version must be 1.'
      );
      return;
    }

    const isMeetingNotify =
      groupNotifyType === NOTIFY_TYPE.CHANGE_MEETING_FEEDBACK ||
      groupNotifyType === NOTIFY_TYPE.CHANGE_MEETING_USER_JOIN_LEAVE ||
      groupNotifyType === NOTIFY_TYPE.CHANGE_GROUP_MEETING_REMIND;

    const isGroupCycleNotify =
      groupNotifyType === NOTIFY_TYPE.CHANGE_GROUP_REMIND_CYCLE;
    const idV2 = gid;
    if (
      !idV2 ||
      typeof groupNotifyType != 'number' ||
      (typeof groupVersion != 'number' &&
        !isMeetingNotify &&
        !isGroupCycleNotify)
    ) {
      log.error('[', idV2, notifyTime, '] invalid notification.');
      return;
    }

    const idV1 = window.Signal.ID.convertIdToV1(idV2);
    return ConversationController.getOrCreateAndWait(idV1, 'group').then(
      conversation => {
        conversation.queueJob(() =>
          handleGroupChangeNotification(
            idV1,
            idV2,
            groupNotifyType,
            conversation,
            notifyTime,
            groupVersion,
            data,
            display
          )
        );
      }
    );
  }

  const directoryChangeQueue = new window.PQueue({ concurrency: 1 });
  function queueDirectoryChangeHandler(notifyTime, data) {
    // just add handler to queue
    directoryChangeQueue.add(() => handleDirectoryChange(notifyTime, data));
  }

  function queueFriendshipChangeHandler(notifyTime, data) {
    directoryChangeQueue.add(() => handleFriendshipChange(notifyTime, data));
  }

  let queueConversation;
  function queueTaskChangeHandler(data, content, notifyTime) {
    if (!queueConversation) {
      queueConversation = new Whisper.Conversation({
        id: 'conversation-for-queue',
      });
    }
    return queueConversation.queueJob(() =>
      handleTaskChange(data, content, notifyTime)
    );
  }

  function queueVoteChangeHandler(data) {
    if (!queueConversation) {
      queueConversation = new Whisper.Conversation({
        id: 'conversation-for-queue',
      });
    }
    return queueConversation.queueJob(() => handleVoteChange(data));
  }

  async function fullLoadGroup(notifyTime, conversation) {
    // full load group
    try {
      const existingExpiry = conversation.get('messageExpiry');
      const exsitingName = conversation.get('name');
      const existingMembers = conversation.get('members') || [];
      const existingPublishRule = conversation.get('publishRule');

      await conversation.apiLoadGroupV2();
      await window.Signal.Data.updateConversation(conversation.attributes);

      let groupUpdate = {};

      if (conversation.get('disbanded')) {
        groupUpdate.disbanded = true;
      } else {
        if (exsitingName != conversation.get('name')) {
          groupUpdate.name = conversation.get('name');
        }

        if (existingPublishRule !== conversation.get('publishRule')) {
          if (conversation.get('publishRule') === 1) {
            groupUpdate.publishRule = conversation.get('publishRule');
          }
        }
        const joined = _.difference(
          conversation.get('members'),
          existingMembers
        );
        if (joined.length > 0) {
          groupUpdate.joined = joined;
        }

        // left
        const left = _.difference(existingMembers, conversation.get('members'));
        if (left.length > 0) {
          if (left.includes(ourNumber)) {
            // myself was removed
            conversation.set({ left: true });
          }
          groupUpdate.left = left;
        }
      }

      await conversation.saveNewLocalMessage({
        sent_at: notifyTime,
        group_update: groupUpdate,
        serverTimestamp: notifyTime,
      });

      const currentExpiry = conversation.get('messageExpiry');
      if (existingExpiry != currentExpiry && currentExpiry > 0) {
        await conversation.saveNewLocalMessage({
          sent_at: notifyTime,
          serverTimestamp: notifyTime,
          messageExpiryUpdate: { messageExpiry: currentExpiry },
        });
      }
    } catch (error) {
      log.error('[', notifyTime, '] load groupV2 failed, ', error);
    }
  }

  async function findMessage(messageId) {
    let found = MessageController.getById(messageId);
    if (!found) {
      const fetched = await window.Signal.Data.getMessageById(messageId, {
        Message: Whisper.Message,
      });

      if (fetched) {
        found = MessageController.register(fetched.id, fetched);
      } else {
        window.log.error('message not found in database for ', messageId);
      }
    }

    return found;
  }

  window.messageReceiverHandleExternalEnvelope = (
    content,
    pinId,
    conversationId
  ) => {
    const ourNumber = textsecure.storage.user.getNumber();

    if (messageReceiver) {
      // no need to await
      messageReceiver.handleExternalEnvelope(content, {
        type: 'PIN',
        pinId,
        conversationId,
        notifyOperator: ourNumber,
      });
    } else {
      log.error('websocket is not ready, cannot handle pin messages.');
    }
  };

  async function setMessagePin(timestamp, source, sourceDevice, pinId) {
    // update message pin status
    const collection = await window.Signal.Data.getMessagesBySentAt(timestamp, {
      MessageCollection: Whisper.MessageCollection,
    });
    const found = Boolean(
      collection.find(item => {
        const messageAuthor = item.getContact();
        return (
          source === messageAuthor.id && sourceDevice === item.getSourceDevice()
        );
      })
    );
    if (found) {
      const fm = await findMessage(collection.models[0].id);
      if (fm) {
        fm.set({
          pinId,
        });
        await window.Signal.Data.saveMessage(fm.attributes, {
          Message: Whisper.Message,
        });
      }
    }
  }

  const fullLoadPinMessages = async idV1 => {
    const conversation = await ConversationController.getOrCreateAndWait(
      idV1,
      'group'
    );
    let pins;
    try {
      pins = await conversation.apiGetGroupPins();
    } catch (error) {
      log.error('fullLoadPinMessages apiGetGroupPins failed.', error);
    }
    if (!pins) {
      return;
    }

    const pinedMessages =
      await window.Signal.Data.getPinMessagesByConversationId(idV1);
    const equal = (value, other) => value.pinId === other.pinId;

    const addedArray = _lodash.differenceWith(pins, pinedMessages, equal);
    const removedArray = _lodash.differenceWith(pinedMessages, pins, equal);

    for (const added of addedArray) {
      if (messageReceiver) {
        // no need to await
        messageReceiver.handleExternalEnvelope(added.content, {
          type: 'PIN',
          pinId: added.pinId,
          conversationId: idV1,
        });
      } else {
        log.error('websocket is not ready, cannot handle pin messages.');
      }
    }

    for (let i = 0; i < removedArray.length; i++) {
      const willRemovePinMessage = await window.Signal.Data.getPinMessageById(
        removedArray[i].pinId
      );
      if (willRemovePinMessage) {
        await setMessagePin(
          willRemovePinMessage.timestamp,
          willRemovePinMessage.source,
          willRemovePinMessage.sourceDevice,
          null
        );
      }
      conversation.trigger('unpin-message', removedArray[i].pinId);
    }
    if (removedArray.length) {
      await window.Signal.Data._removeMessages(
        removedArray.map(item => item.pinId)
      );
    }
  };

  window.fullLoadPinMessages = fullLoadPinMessages;

  function formatDurationSeconds(sec) {
    let t = sec;
    let minutes = 0;
    if (t >= 60) {
      minutes = Math.floor(t / 60);
      t %= 60;
    }

    if (minutes) {
      return `${minutes}m ${t}s`;
    }
    if (t) {
      return `${t}s`;
    }
    return '1s';
  }

  function conversationUnSticky(conversation) {
    if (!conversation) return;
    const id = conversation.get('id');
    const isStick = conversation.get('isStick');
    if (isStick) Whisper.events.trigger('conversationStick', id, !isStick);
  }

  const commonNoActiveNotifyTypes = [
    NOTIFY_DETAILED_TYPE.LEAVE_GROUP,
    NOTIFY_DETAILED_TYPE.GROUP_ADD_ADMIN,
    NOTIFY_DETAILED_TYPE.GROUP_DEL_ADMIN,
    NOTIFY_DETAILED_TYPE.GROUP_CHANGE_RAPID_ROLE,
    NOTIFY_DETAILED_TYPE.GROUP_MSG_EXPIRY_CHANGE,
    NOTIFY_DETAILED_TYPE.GROUP_PUBLISH_ONLY_GROUP_RULE_CHANGE,
    NOTIFY_DETAILED_TYPE.GROUP_ADD_PIN,
    NOTIFY_DETAILED_TYPE.GROUP_DEL_PIN,
    NOTIFY_DETAILED_TYPE.GROUP_AVATAR_CHANGE,
    NOTIFY_DETAILED_TYPE.GROUP_REMIND_CHANGE,
    NOTIFY_DETAILED_TYPE.DISMISS_GROUP,
  ];

  const specialNoActiveNotifyTypes = [
    NOTIFY_DETAILED_TYPE.INVITE_JOIN_GROUP,
    NOTIFY_DETAILED_TYPE.KICKOUT_GROUP,
    NOTIFY_DETAILED_TYPE.GROUP_CHANGE_OWNER,
  ];

  // https://github.com/difftim/server-docs/blob/master/apis/managed_group_notifyMsg.md
  async function handleGroupChangeNotification(
    idV1,
    idV2,
    groupNotifyType,
    conversation,
    notifyTime,
    groupVersion,
    data,
    display
  ) {
    log.info('[', idV2, notifyTime, '] handle begin for notifcation');

    const {
      group,
      groupPins,
      members,
      operator,
      operatorDeviceId,
      duration,
      groupRemind,
      groupNotifyDetailedType,
    } = data;
    const expireTimer = conversation.getConversationMessageExpiry();
    const changeVersion = groupVersion;
    const ourNumber = textsecure.storage.user.getNumber();
    const deviceId = textsecure.storage.user.getDeviceId();

    if (operator === ourNumber && operatorDeviceId.toString() === deviceId) {
      // this change notfication caused by our some operations,
      // and all updates have been handle by ourself already,
      // so, we do not need to handle this.
      log.warn(
        '[',
        idV2,
        notifyTime,
        '] notfication caused by ourself operation, skipping...'
      );

      const updateAttributes = { changeVersion };

      const latestMessageTimestamp = conversation.get('latestMessageTimestamp');
      if (!latestMessageTimestamp || latestMessageTimestamp < notifyTime) {
        // updateAttributes.active_at = notifyTime;
        if (
          commonNoActiveNotifyTypes.includes(groupNotifyDetailedType) ||
          specialNoActiveNotifyTypes.includes(groupNotifyDetailedType)
        ) {
        } else {
          updateAttributes.active_at = notifyTime;
        }
      }

      conversation.set(updateAttributes);

      // group member rapid role update by self
      if (
        groupNotifyDetailedType === NOTIFY_DETAILED_TYPE.GROUP_CHANGE_RAPID_ROLE
      ) {
        for (let i = 0; i < members.length; i++) {
          const operatorName = ConversationController.get(operator)?.getName();
          const updateMemberName = ConversationController.get(
            members[i].uid
          )?.getName();
          log.info(
            'group member rapid role update',
            operator,
            members[i].uid,
            members[i].rapidRole
          );
          await conversation.saveNewLocalMessage({
            sent_at: notifyTime,
            serverTimestamp: notifyTime,
            groupMemberRapidUpdate: {
              rapidRoleName:
                members[i].rapidRole === 0
                  ? 'none'
                  : i18n('rapid_' + members[i].rapidRole),
              operatorName,
              updateMemberName,
            },
          });
        }
      }

      const { ext } = group || {};
      if (
        ext !== undefined &&
        (groupNotifyDetailedType === NOTIFY_DETAILED_TYPE.KICKOUT_GROUP ||
          groupNotifyDetailedType === NOTIFY_DETAILED_TYPE.INVITE_JOIN_GROUP) &&
        conversation.get('ext') !== ext
      ) {
        conversation.setExt(ext);
      }

      if (members && members.length > 0) {
        const addedMembers = members.filter(
          m => m.action === CHANGE_ACTION.ADD
        );
        const updatedMembers = members.filter(
          m => m.action === CHANGE_ACTION.UPDATE
        );

        // changed numbers array
        const changedArray = members.map(m => m.uid) || [];
        const existMembersV2 = conversation.get('membersV2') || [];
        const addedMembersV2 =
          addedMembers.map(m => {
            return {
              id: m.uid,
              role: m.role,
              rapidRole: m.rapidRole,
              displayName: m.displayName,
              extId: m.extId,
            };
          }) || [];
        const updatedMembersV2 = updatedMembers.map(m => ({
          id: m.uid,
          role: m.role,
          rapidRole: m.rapidRole,
          displayName: m.displayName,
          extId: m.extId,
        }));

        // added members may already exists, members should respect data from server
        let changedMembersV2 =
          existMembersV2.filter(m => !changedArray.includes(m.id)) || [];
        changedMembersV2 = changedMembersV2.concat(addedMembersV2);
        changedMembersV2 = changedMembersV2.concat(updatedMembersV2);

        changedMembersV2.forEach(u => {
          const c = ConversationController.get(u.uid);
          if (
            c &&
            c.isPrivate() &&
            !c.get('directoryUser') &&
            c.get('extId') !== u.extId
          ) {
            c.set({ extId: u.extId });
          }
        });
        conversation.set({ membersV2: changedMembersV2 });
      }
      if (conversation.hasChanged()) {
        await window.Signal.Data.updateConversation(conversation.attributes);
      }
      return;
    }

    // meeting user join leave
    if (groupNotifyType === NOTIFY_TYPE.CHANGE_MEETING_USER_JOIN_LEAVE) {
      const { uid, event, timeStamp } = data;
      let self = false;
      if (uid === ourNumber) {
        self = true;
      }

      // message middle
      const notifyMiddle =
        event === 'join'
          ? i18n('groupNotifyMeetingUserJoin')
          : i18n('groupNotifyMeetingUserLeave');

      let notifyString = '';
      if (self) {
        notifyString = i18n('you') + notifyMiddle;
      } else {
        let theName = uid;
        const user = ConversationController.get(uid);
        if (user && user.get('name')) {
          theName = user.get('name');
        }
        notifyString = theName + notifyMiddle;
      }

      // timestamp format
      const d = new Date(timeStamp);
      const intToFix = (num, length) => {
        return ('' + num).length < length
          ? (new Array(length + 1).join('0') + num).slice(-length)
          : '' + num;
      };
      notifyString += ` ${d.getHours()}:${intToFix(
        d.getMinutes(),
        2
      )}:${intToFix(d.getSeconds(), 2)}`;

      await conversation.saveNewLocalMessage({
        sent_at: notifyTime,
        group_update: { normalString: notifyString },
        serverTimestamp: notifyTime,
      });

      return;
    }

    // meeting feedback
    if (groupNotifyType === NOTIFY_TYPE.CHANGE_MEETING_FEEDBACK) {
      if (!window['meeting-feedback:' + idV1]) {
        return;
      }
      window['meeting-feedback:' + idV1] = undefined;

      // format duration time string
      let formatTime = '###';
      if (Number.isInteger(duration) && duration > 0) {
        formatTime = formatDurationSeconds(duration);
      }

      await conversation.saveNewLocalMessage({
        sent_at: notifyTime,
        group_update: { feedback: formatTime },
        serverTimestamp: notifyTime,
      });

      return;
    }

    // group remindCycle
    if (groupNotifyType === NOTIFY_TYPE.CHANGE_GROUP_REMIND_CYCLE) {
      const { remindCycle } = groupRemind || {};
      await conversation.saveNewLocalMessage({
        sent_at: notifyTime,
        serverTimestamp: notifyTime,
        active_at: notifyTime,
        remindCycleUpdate: {
          remindCycle,
          type: 'cycle',
        },
      });

      const currentConversation = window.getCurrentOpenConversation();
      if (currentConversation?.id !== conversation.get('id')) {
        conversation.markAsUnread();
      }

      return;
    }

    // group meeting remind
    if (groupNotifyType === NOTIFY_TYPE.CHANGE_GROUP_MEETING_REMIND) {
      const {
        type,
        reminder,
        startAt,
        organizer,
        meetingName,
        link,
        isRecurrence,
      } = data;

      let theName = organizer;
      if (organizer !== ourNumber) {
        const user = ConversationController.get(organizer);
        if (user && user.get('name')) {
          theName = user.get('name');
        }
      } else {
        theName = 'You';
      }

      let channelName = window.btoa(idV1);
      const re = new RegExp('/', 'g');
      channelName = `G-${channelName.replace(re, '-')}`;
      const meetingname = betterEncodeURIComponent(conversation.get('name'));
      const joinMeetUrl =
        'chative://meeting?v=1&meetingname=' +
        meetingname +
        '&channelname=' +
        betterEncodeURIComponent(channelName);

      const meetingReminder = {
        type,
        reminder,
        startAt,
        organizer: theName,
        meetingName,
        link,
        isRecurrence,
        joinMeetUrl,
      };

      await conversation.saveNewLocalMessage({
        sent_at: notifyTime,
        group_update: { meetingReminder },
        serverTimestamp: notifyTime,
      });

      return;
    }

    if (groupNotifyType === NOTIFY_TYPE.CHANGE_MY_SETTINGS) {
      // myself group settings changed
      // this change do not lead to group version changed,
      // so we handle this before group version checking.
      // get latest info from server.
      try {
        await conversation.apiGetGroupV2Member(ourNumber);
        await window.Signal.Data.updateConversation(conversation.attributes);

        window.getInboxCollection().updateUnreadCount();
      } catch (error) {
        log.error(
          '[',
          idV2,
          notifyTime,
          '] get me group member info failed,',
          error
        );
      }

      log.info('[', idV2, notifyTime, '] MY Settings changed.');
      return;
    }

    const lastChangeVersion = conversation.get('changeVersion') || 0;
    if (changeVersion <= lastChangeVersion) {
      log.warn(
        '[',
        idV2,
        notifyTime,
        '] skipping, local:',
        lastChangeVersion,
        'coming:',
        changeVersion
      );
      return;
    } else if (changeVersion > lastChangeVersion + 1) {
      log.warn(
        '[',
        idV2,
        notifyTime,
        '] full load, local:',
        lastChangeVersion,
        'coming:',
        changeVersion
      );

      if (display) {
        // should set group conversation active,
        // to make group conversation to be shown in conversation list
        const latestMessageTimestamp = conversation.get(
          'latestMessageTimestamp'
        );
        if (!latestMessageTimestamp || latestMessageTimestamp < notifyTime) {
          conversation.set({
            active_at: notifyTime,
            isArchived: false,
          });
        }
      }

      await fullLoadGroup(notifyTime, conversation);

      log.error('[', idV2, notifyTime, '] group notification handle done 1.');

      await fullLoadPinMessages(idV1);
      return;
    }

    // update for conversation
    let update = {
      changeVersion,
      group_version: 2,
      type: 'group',
    };

    // update  for group, used for message showing.
    let groupUpdate = {};
    let groupApiLoaded = false;

    switch (groupNotifyType) {
      case NOTIFY_TYPE.CHANGE_BASIC:
        // * create group (show message)
        // * disband group (show message)
        // * group basic info changed (show message)
        const groupAction = group.action;
        switch (groupAction) {
          case CHANGE_ACTION.ADD:
            if (group.name != conversation.get('name')) {
              update.name = group.name;
            }

            groupUpdate = await mergeMembers(conversation, members);
          // ADD may include UPDATE infos, so do not break here
          // break;
          case CHANGE_ACTION.UPDATE:
            const testAttributes = {
              ...group,
              commonAvatar: conversation.parseGroupAvatar(group.avatar),
            };

            const updatedAttributes = conversation.updateAttributesGroup(
              testAttributes,
              true
            );

            if (updatedAttributes) {
              update = {
                ...update,
                ...updatedAttributes,
              };
              if (groupAction === CHANGE_ACTION.UPDATE) {
                if (update.publishRule) {
                  groupUpdate.publishRule = update.publishRule;
                }
              }
            }
            break;
          case CHANGE_ACTION.DELETE:
            groupUpdate.disbanded = true;
            groupUpdate.isDisbandByOwner = false;

            update = {
              ...update,
              disbanded: true,
              isDisbandByOwner: false,
              left: true,
              members: [],
              membersV2: [],
            };

            break;
          default:
            log.error(
              '[',
              idV2,
              notifyTime,
              '] unsupported action:',
              groupAction
            );
            break;
        }

        break;
      case NOTIFY_TYPE.CHANGE_MEMBERS:
        // * add members (show message)
        // * remove members (show message)
        const me = members.filter(m => m.uid === ourNumber);
        if (me && me.length > 0 && me[0].action === CHANGE_ACTION.ADD) {
          // me was added, fully load group.
          try {
            await conversation.apiLoadGroupV2();
            groupApiLoaded = true;
          } catch (error) {
            log.error('[', idV2, notifyTime, '] load groupV2 failed, ', error);
            return;
          }

          groupUpdate.joined = [ourNumber];

          const publishRule = conversation.get('publishRule');
          if (publishRule === 1) {
            groupUpdate.publishRule = publishRule;
          }

          if (conversation.isMeLeftGroup()) {
            log.warn('[', idV2, notifyTime, '] re-added to a left group');
            update.left = false;
          }
        } else {
          groupUpdate = await mergeMembers(conversation, members, operator);
        }
        break;
      case NOTIFY_TYPE.CHANGE_MEMBER_INFO_RAPID:
      case NOTIFY_TYPE.CHANGE_MEMBER_INFO:
        // * member basic info changed
        // * member role changed (show message)
        // only when myself info changed should show message
        log.info('members info changed for group:', idV2);
        groupUpdate = await mergeMembers(conversation, members);
        break;
      case NOTIFY_TYPE.CHANGE_ANNOUNCEMENT:
        // new announcement
        // announcement changed

        break;
      case NOTIFY_TYPE.CHANGE_PIN:
        const addedArray = groupPins.filter(
          pined => pined.action === 0 && pined.id
        );
        const removedArray = groupPins.filter(
          pined => pined.action === 3 && pined.id
        );

        for (const pined of addedArray) {
          if (messageReceiver) {
            // maybe we do not need to wait for this
            messageReceiver.handleExternalEnvelope(pined.content, {
              type: 'PIN',
              pinId: pined.id,
              conversationId: idV1,
              notifyOperator: operator,
            });
          } else {
            log.error('websocket is not ready, cannot handle pin messages.');
          }
        }

        for (let i = 0; i < removedArray.length; i++) {
          const willRemovePinMessage =
            await window.Signal.Data.getPinMessageById(removedArray[i].id);
          if (willRemovePinMessage) {
            await setMessagePin(
              willRemovePinMessage.timestamp,
              willRemovePinMessage.source,
              willRemovePinMessage.sourceDevice,
              null
            );
          }
          conversation.trigger('unpin-message', removedArray[i].id);
        }
        if (removedArray.length) {
          await window.Signal.Data._removeMessages(
            removedArray.map(item => item.id)
          );
        }
        break;
      default:
        log.error(
          '[',
          idV2,
          notifyTime,
          '] unknown notify type: ',
          groupNotifyType
        );
        return;
    }

    if (update.name) {
      groupUpdate.name = update.name;
    }
    if (update.commonAvatar) {
      groupUpdate.avatar = update.commonAvatar;
    }
    // update.expireTimer = expireTimer;

    // update active_at only when display is true
    // this will controll whether conversation should be shown
    // or what the sequence the conversion is shown.
    if (display) {
      const isIncludeMe = (members || []).filter(m => m.uid === ourNumber);
      const latestMessageTimestamp = conversation.get('latestMessageTimestamp');
      if (!latestMessageTimestamp || latestMessageTimestamp < notifyTime) {
        if (
          commonNoActiveNotifyTypes.includes(groupNotifyDetailedType) ||
          (specialNoActiveNotifyTypes.includes(groupNotifyDetailedType) &&
            !members?.some(m => m.uid === ourNumber)) ||
          (groupNotifyDetailedType ===
            NOTIFY_DETAILED_TYPE.GROUP_CHANGE_OWNER &&
            isIncludeMe &&
            isIncludeMe.length > 0 &&
            isIncludeMe[0].role !== 0)
        ) {
        } else {
          update.active_at = notifyTime;
        }
        update.isArchived = false;
      }
    }

    // update member's group display name for echo one's changes
    if (!groupApiLoaded) {
      await conversation.updateGroupContact();
    }

    if (update.messageExpiry > 0) {
      await conversation.saveNewLocalMessage({
        sent_at: notifyTime,
        serverTimestamp: notifyTime,
        messageExpiryUpdate: {
          messageExpiry: update.messageExpiry,
        },
      });
    }

    if (
      update.remindCycle &&
      group?.action === CHANGE_ACTION.UPDATE &&
      groupNotifyDetailedType === NOTIFY_DETAILED_TYPE.GROUP_REMIND_CHANGE
    ) {
      const _conversation = ConversationController.get(operator);
      const name = _conversation.getName() || _conversation.getNumber();
      await conversation.saveNewLocalMessage({
        sent_at: notifyTime,
        serverTimestamp: notifyTime,
        active_at: notifyTime,
        remindCycleUpdate: {
          remindCycle: update.remindCycle,
          name,
          type: 'immediate',
        },
      });
    }

    if (display && Object.keys(groupUpdate).length > 0) {
      if (groupUpdate.disbanded) {
        await conversation.destroyMessages();
      }
      await conversation.saveNewLocalMessage({
        sent_at: notifyTime,
        group_update: { ...groupUpdate, operator, operatorDeviceId },
        serverTimestamp: notifyTime,
      });
    }

    // group member rapid role update by others
    if (
      groupNotifyDetailedType === NOTIFY_DETAILED_TYPE.GROUP_CHANGE_RAPID_ROLE
    ) {
      for (let i = 0; i < members.length; i++) {
        const operatorName = ConversationController.get(operator)?.getName();
        const updateMemberName = ConversationController.get(
          members[i].uid
        )?.getName();
        log.info(
          'group member rapid role update',
          operator,
          members[i].uid,
          members[i].rapidRole
        );
        await conversation.saveNewLocalMessage({
          sent_at: notifyTime,
          serverTimestamp: notifyTime,
          groupMemberRapidUpdate: {
            rapidRoleName:
              members[i].rapidRole === 0
                ? 'none'
                : i18n('rapid_' + members[i].rapidRole),
            operatorName,
            updateMemberName,
          },
        });
      }
    }

    if (groupNotifyDetailedType === NOTIFY_DETAILED_TYPE.GROUP_DESTROY) {
      await conversation.destroyMessages(true);
    }
    const { ext } = group || {};
    const oldGroupExt = conversation.get('ext');
    if (ext !== undefined && ext !== oldGroupExt) {
      update.ext = ext;
    }

    if (
      update.disbanded ||
      update.left ||
      (groupUpdate.removed && groupUpdate.removed.includes(ourNumber)) ||
      (groupUpdate.left && groupUpdate.left === 'You')
    ) {
      await window.Signal.Data.deletePinMessagesByConversationId(idV1);
      conversation.trigger('clear-pin-messages');

      conversationUnSticky(conversation);
      conversation.setExt(false);
    }

    // update conversation and save to database
    conversation.set(update);
    await window.Signal.Data.updateConversation(conversation.attributes);

    if (groupUpdate.joined && groupUpdate.joined.includes(ourNumber)) {
      await fullLoadPinMessages(idV1);
    }

    log.error('[', idV2, notifyTime, '] group notification handle done.');
  }

  async function handleDirectoryChange(notifyTime, data) {
    const { ver, directoryVersion, members } = data;

    if (ver != 1) {
      log.error(
        '[',
        idV2,
        notifyTime,
        '] directory notification version must be 1.'
      );
      return;
    }

    const oldDirectoryVersion = storage.get('directoryVersion', -1);
    if (oldDirectoryVersion + 1 === directoryVersion) {
      log.info('update by step');
    } else if (oldDirectoryVersion >= directoryVersion) {
      log.info('skipping smaller version.');
      return;
    } else {
      log.info('incoming version bigger then local， full load contact list.');

      // full load contact list.
      let fullLoadVersion = -1;
      try {
        const result = await textsecure.messaging.fetchDirectoryContacts();
        const contacts = result['contacts'];
        fullLoadVersion = result['directoryVersion'];

        await ConversationController.bulkCreateContactConversations(contacts);
      } catch (error) {
        window.log.error('full load directory contacts failed.', error);
        return;
      }

      if (fullLoadVersion) {
        storage.put('directoryVersion', fullLoadVersion);
      }

      return;
    }

    if (!(members instanceof Array)) {
      log.error('incoming directory change members is not array.');
      return;
    }

    await ConversationController.bulkFreshContactConversation(members);
    storage.put('directoryVersion', directoryVersion);

    if (members && members.length > 0) {
      for (let i = 0; i < members.length; i++) {
        const { chatFolder } = members[i].privateConfigs || {};
        const { value, version } = chatFolder || {};
        if (value && version) {
          const localFolder = window.textsecure.storage.get('chatFolder') || {};
          if (!localFolder?.value || version >= localFolder?.version) {
            const _value =
              value?.map(f => {
                const { cIds, type, folderType, name } = f || {};
                f.cIds = cIds?.filter(c => c.id) || [];
                if (type === undefined) {
                  f.type = folderType;
                }
                const recommends = ['Unread', '@Me', 'Private'];
                if (recommends.includes(name)) {
                  f.type = 0;
                }
                return f;
              }) || [];
            textsecure.storage.put('chatFolder', {
              version: chatFolder.version,
              value: _value,
            });

            chatFolder.value = _value;
            const ev = new CustomEvent('chat-folder-notice-change', {
              detail: chatFolder,
            });
            window.dispatchEvent(ev);
            break;
          }
        }
      }
    }

    if (members.length === 1 && members[0].action === 2) {
      const conversation = await ConversationController.getOrCreateAndWait(
        members[0].number,
        'private'
      );
      await conversation.destroyMessages(false, true);
    }
  }

  //
  // {
  //   "notifyType": 6,
  //   "notifyTime": 1677832044693,
  //   "data": {
  //       "operatorInfo": {
  //           "operatorId": "+77041843643",
  //           "operatorDeviceId": 0,
  //           "operatorName": "ian",
  //           "avatar": "{\"encAlgo\":\"AESGCM256\",\"encKey\":\"8QA1IyST+1xURTaJ+LfhtFmaPy7NkOMKUh\\/e8lxkQEI=\",\"attachmentId\":\"2247606417629722587\"}",
  //           "publicConfigs": {
  //               "publicName": "ian",
  //               "meetingVersion": 2
  //           }
  //       },
  //       "askID": 716,
  //       "actionType": 2,
  //       "directoryVersion": 49
  //   }
  // }
  const FRIENDSHIP_ACTION = {
    REQUEST: 1,
    CONFIRM: 2,
  };

  async function handleFriendshipChange(notifyTime, data) {
    const { directoryVersion, actionType, operatorInfo } = data;

    const oldDirectoryVersion = storage.get('directoryVersion', -1);
    if (oldDirectoryVersion + 1 === directoryVersion) {
      log.info('update by step');
    } else if (oldDirectoryVersion >= directoryVersion) {
      log.info('skipping smaller version.');
      return;
    } else {
      log.info('incoming version bigger then local， full load contact list.');

      // full load contact list.
      let fullLoadVersion = -1;
      try {
        const result = await textsecure.messaging.fetchDirectoryContacts();
        const contacts = result['contacts'];
        fullLoadVersion = result['directoryVersion'];

        await ConversationController.bulkCreateContactConversations(contacts);
      } catch (error) {
        window.log.error('full load directory contacts failed.', error);
        return;
      }

      if (fullLoadVersion) {
        storage.put('directoryVersion', fullLoadVersion);
      }

      return;
    }

    const { operatorId, operatorName, avatar } = operatorInfo || {};
    if (!operatorId) {
      log.error('invalid operator id', operatorId);
      return;
    }

    switch (actionType) {
      case FRIENDSHIP_ACTION.CONFIRM:
        try {
          const conversation = await ConversationController.getOrCreateAndWait(
            operatorId,
            'private'
          );

          conversation.set({
            name: operatorName,
            directoryUser: true,
            commonAvatar: conversation.parsePrivateAvatar(avatar),
          });

          await window.Signal.Data.updateConversation(conversation.attributes);

          storage.put('directoryVersion', directoryVersion);

          setTimeout(() => conversation.forceUpdatePrivateContact(), 0);
        } catch (error) {
          log.error(
            'handle new friendship error',
            operatorId,
            Error.toLogFormat(error)
          );
        }
        break;
      case FRIENDSHIP_ACTION.REQUEST:
        log.info('Unimplemented action type', actionType, operatorId);
        break;
      default:
        log.info('Unknown action type', actionType, operatorId);
        break;
    }
  }

  async function queueConversationChangeHandler(notifyTime, data, display) {
    const { operator, operatorDeviceId, ver, changeType, conversation } = data;

    if (ver != 1) {
      log.error(
        '[',
        idV2,
        notifyTime,
        '] conversation notification version must be 1.'
      );
      return;
    }

    if (!conversation || !(conversation instanceof Object)) {
      window.log.info(
        'background queueConversationChangeHandler BAD DATA:',
        data
      );
      return;
    }

    const { version, conversation: conversationId } = conversation;
    if (!conversationId || !version) {
      window.log.info(
        'background queueConversationChangeHandler BAD conversation DATA:',
        conversation
      );
      return;
    }

    let conversationType;
    let id;

    if (conversationId.startsWith('+')) {
      conversationType = 'private';
      id = conversationId;
    } else {
      conversationType = 'group';
      id = window.Signal.ID.convertIdToV1(conversationId);
    }

    return ConversationController.getOrCreateAndWait(id, conversationType).then(
      conversation => {
        handleChangeConversationNotification(
          conversationId,
          conversation,
          notifyTime,
          ver,
          data,
          display
        );
      }
    );
  }

  async function handleChangeConversationNotification(
    id,
    conversation,
    notifyTime,
    ver,
    data,
    display
  ) {
    log.info(
      `[${id} ${notifyTime}]`,
      'handle begin for ConversationNotifcation'
    );
    const { operator, operatorDeviceId, changeType } = data;

    const ourNumber = textsecure.storage.user.getNumber();
    const deviceId = textsecure.storage.user.getDeviceId();
    if (operator === ourNumber && operatorDeviceId.toString() === deviceId) {
      log.warn(
        `[${id} ${notifyTime}]`,
        'ConversationNotfication caused by ourself operation, skipping...'
      );

      return;
    }

    // // changeType === 0: muteStatus change
    // if (changeType != 0 && changeType != 1 && changeType != 2) {
    //   window.log.info(
    //     `[${id} ${notifyTime}]`,
    //     'background queueConversationChangeHandler BAD BAD CHANGE TYPE!',
    //     changeType
    //   );
    //   return;
    // }

    const { version: settingVersion } = data.conversation;

    let updated;

    const lastSettingVersion = conversation.get('settingVersion') || 0;
    if (settingVersion <= lastSettingVersion) {
      log.warn(
        `[${id} ${notifyTime}]`,
        'skipping, local:',
        lastSettingVersion,
        'coming:',
        settingVersion
      );
      return;
    } else if (settingVersion === lastSettingVersion + 1) {
      log.warn(
        `[${id} ${notifyTime}]`,
        'update config by step, local:',
        lastSettingVersion,
        'coming:',
        settingVersion
      );

      updated = await conversation.updateConfig(data.conversation, true);
    } else if (settingVersion > lastSettingVersion + 1) {
      try {
        updated = await conversation.apiGetConfig();
      } catch (error) {
        window.log.error(
          `[${id} ${notifyTime}]`,
          'get conversation setting failed, ',
          error
        );
      }
    }

    if (updated && Object.hasOwn(updated, 'muteStatus')) {
      window.getInboxCollection().updateUnreadCount();
    }
  }

  async function handleTaskChange(data, content, notifyTime) {
    window.log.info('background handleTaskChange task content:' + content);

    const { changeType, taskInfos, operator, ver } = data;
    if (ver !== 1) {
      window.log.info(
        'background handleTaskChange DO NOT HANDLE ver > 1.',
        data
      );
      return;
    }
    if (!taskInfos || !(taskInfos instanceof Array) || !taskInfos.length) {
      window.log.info('background handleTaskChange task BAD DATA:', data);
      return;
    }
    if (changeType !== 0 && changeType !== 1 && changeType !== 2) {
      window.log.info(
        'background handleTaskChange task BAD CHANGE TYPE!',
        changeType
      );
      return;
    }

    const isChangeByMySelf = textsecure.storage.user.getNumber() === operator;

    for (let t = 0; t < taskInfos.length; t += 1) {
      let { task, users } = taskInfos[t];
      if (!task || !task.tid || !task.version) {
        window.log.info(
          'background handleTaskChange task BAD taskInfos DATA:',
          task
        );
        continue;
      }

      if (changeType === 1 || task.action === 2) {
        window.log.info(
          'background handleTaskChange task archived(deleted).',
          task
        );
        await window.Whisper.Task.deleteTaskLinkedMessages(task.tid);
        await window.Signal.Data.deleteLightTask(task.tid);
        continue;
      }

      if (changeType === 2) {
        await window.Whisper.Task.shouldFetchLatestTask(task.tid, {
          notifyTime,
        });
        continue;
      }

      const localTask = await window.Signal.Data.getLightTask(task.tid);
      // changeType === 0
      if (localTask) {
        if (localTask.version >= task.version) {
          continue;
        }
      }

      if (localTask?.version === task.version - 1 || task.version === 1) {
        const mergeTask = {
          ...localTask,
          taskId: task.tid,
          version: task.version,
        };

        if (task.name) {
          mergeTask.name = task.name;
        }
        if (task.creator) {
          mergeTask.creator = task.creator;
        }
        if (task.updater) {
          mergeTask.updater = task.updater;
        }
        if (typeof task.updateTime === 'number' && task.updateTime > 0) {
          mergeTask.updateTime = task.updateTime;
        }
        if (typeof task.dueTime === 'number' && task.dueTime >= 0) {
          mergeTask.dueTime = task.dueTime;
        }
        if (typeof task.createTime === 'number' && task.createTime > 0) {
          mergeTask.timestamp = task.createTime;
        }
        if (typeof task.priority === 'number' && task.priority > 0) {
          mergeTask.priority = task.priority;
        }
        if (typeof task.status === 'number' && task.status > 0) {
          mergeTask.status = task.status;
        }
        if (typeof task.uid === 'string' && task.uid) {
          mergeTask.uid = task.uid;
        }
        if (typeof task.gid === 'string' && task.gid) {
          mergeTask.gid = task.gid;
        }

        const localUsers = await window.Signal.Data.getTaskRoles(
          mergeTask.taskId,
          2
        );
        const removedUsers = []; // [id1, id2...]

        if (users && users.length) {
          for (let index = 0; index < users.length; index += 1) {
            const userRole = users[index];
            if (userRole.action === 0 && userRole.role === 2) {
              localUsers.push(userRole);
            }
            if (userRole.action === 2 && userRole.role === 2) {
              removedUsers.push(userRole.uid);
            }
          }
        }

        const roles = [];
        const assignees = [];
        for (let i = 0; i < localUsers.length; i += 1) {
          const uid = localUsers[i].uid;
          if (!assignees.includes(uid) && !removedUsers.includes(uid)) {
            assignees.push(uid);
            roles.push({ uid, role: 2 });
          }
        }

        await window.Signal.Data.createOrUpdateLightTask({
          ...mergeTask,
          roles,
        });
        await window.Whisper.Task.updateTaskLinkedMessages({
          ...mergeTask,
          assignees,
          // message: localTask?.message,
          selfOperator: isChangeByMySelf ? 1 : 0,
        });
      } else {
        await window.Whisper.Task.shouldFetchLatestTask(task.tid);
      }
    }
    window.log.info('background handleTaskChange END.');
  }

  async function onTaskSync(ev) {
    console.log('receving task sync for ', ev);

    const { task } = ev;
    const { type, taskId, version, timestamp } = task || {};

    // find task by taskId, and mark it as read.
    // task should has field 'readAtVersion' to show at which version it was read.
    // when making as read, should compare readAtVersion and incoming read version,
    // should really mark as read only when comming version bigger then readAtVersion
    if (
      type !== textsecure.protobuf.SyncMessage.Task.Type.READ ||
      !taskId ||
      !timestamp
    ) {
      log.error('invalid task sync message.');
      return;
    }

    // update database
    await window.Signal.Data.updateTaskReadAtVersion(
      taskId,
      timestamp,
      version
    );

    // notify task update on UI
    const detail = { updateReadVersion: version, taskId };
    const cev = new CustomEvent('task-pane-update', { detail });
    window.dispatchEvent(cev);
  }

  async function handleVoteChange(data) {
    window.log.info('background handleVoteChange vote data', data);
    if (!data || !data.vote) {
      return;
    }

    let { vote } = data;
    vote = {
      ...vote,
      voteId: vote.id,
      optionsCount: vote.options,
    };
    const localVote = await window.Signal.Data.getVote(vote.voteId);
    if (localVote) {
      if (localVote.version && localVote.version < vote.version) {
        await window.Signal.Data.createOrUpdateChangeableVote({
          ...vote,
          selected: vote.selected || localVote.selected,
        });
        const voteUpdate = {
          voteId: vote.id,
          version: vote.version,
          selected: vote.selected || localVote.selected,
          optionsCount: vote.options,
          votersCount: vote.votersCount,
          totalVotes: vote.totalVotes,
          status: vote.status,
        };
        await window.Whisper.Vote.updateVoteLinkedMessages({ ...voteUpdate });
      }
    } else {
      await window.Signal.Data.createOrUpdateChangeableVote({ ...vote });
    }
  }

  async function handleSharedConfigChangeNotification(
    conversation,
    notifyTime,
    data
  ) {
    const { messageExpiry, ver: newVersion } = data;

    const sharedVersion = conversation.get('sharedSettingVersion');

    if (sharedVersion >= newVersion) {
      window.log.info(
        'handleSharedConfigChangeNotification new version smaller than exists',
        sharedVersion,
        newVersion
      );
      return;
    } else if (sharedVersion + 1 === newVersion) {
      if (typeof messageExpiry != 'number' || messageExpiry <= 0) {
        window.log.info(
          'handleSharedConfigChangeNotification invalid messageExpiry',
          messageExpiry
        );
        // invalid messageExpiry
        return;
      }

      conversation.set({ messageExpiry, sharedSettingVersion: newVersion });
      await window.Signal.Data.updateConversation(conversation.attributes);

      await conversation.saveNewLocalMessage({
        sent_at: notifyTime,
        serverTimestamp: notifyTime,
        messageExpiryUpdate: {
          messageExpiry: messageExpiry,
        },
      });
    } else {
      try {
        await conversation.apiGetSharedConfig();
      } catch (error) {
        window.log.error(
          'failed to get shared config',
          Errors.toLogFormat(error)
        );
      }
    }
  }

  // {
  //   "notifyType": 5,
  //   "notifyTime": 1673858506376,
  //   "data": {
  //       "operator": "+77288809934",
  //       "operatorDeviceId": 1,
  //       "conversation": "+76058820562:+77288809934",
  //       "ver": 2,
  //       "changeType": 1,
  //       "messageExpiry": 180
  //   }
  // }
  async function queueConversationShareChangeHandler(notifyTime, data) {
    const {
      operator,
      operatorDeviceId,
      conversation: serverConversationId,
    } = data;

    const ourNumber = textsecure.storage.user.getNumber();
    const deviceId = textsecure.storage.user.getDeviceId();

    if (operator == ourNumber && deviceId == operatorDeviceId) {
      log.warn(
        `[${serverConversationId} ${notifyTime}]`,
        'covnersation SharedConfig change caused by ourself operation, skipping...'
      );
      return;
    }

    const numbers = serverConversationId.split(':');
    if (
      numbers.length != 2 ||
      !numbers.includes(ourNumber) ||
      !numbers.includes(operator)
    ) {
      window.log.error(
        `conversation: ${serverConversationId}`,
        'does not belong to the operator or me',
        `operator: ${operator}`
      );
      return;
    }

    const conversationId = numbers[0] === ourNumber ? numbers[1] : numbers[0];
    return ConversationController.getOrCreateAndWait(
      conversationId,
      'private'
    ).then(conversation => {
      handleSharedConfigChangeNotification(conversation, notifyTime, data);
    });
  }

  // notifyType: 8
  async function handleReminderChange(notifyTime, data, conversation) {
    const {
      conversation: cid,
      version,
      timestamp,
      changeType,
      idV1,
      idV2,
      description,
      creator,
      reminderId,
    } = data || {};
    log.info(
      '[',
      cid,
      notifyTime,
      '] handle begin for reminder notification:',
      timestamp
    );
    const expireTimer = conversation.getConversationMessageExpiry();

    let reminderList = conversation.get('reminderList') || [];
    const reminder =
      reminderList?.find(r => r?.reminderId === reminderId) || data;

    if (version < reminder?.version) {
      log.warn(
        '[',
        cid,
        notifyTime,
        '] skipping, local:',
        reminder?.version,
        'coming:',
        version
      );
      return;
    }

    switch (changeType) {
      case 1:
      case 2:
        reminderList = reminderList.filter(r => r?.reminderId !== reminderId);
        reminderList.push(data);
        break;
      case 3:
        reminderList = reminderList.filter(r => r?.reminderId !== reminderId);
        break;
      default:
        console.log('update reminder list and then continue...');
    }

    let updateAttribute = {
      reminderList,
    };

    let messageAttribute = {
      sent_at: notifyTime,
      serverTimestamp: notifyTime,
    };

    let creatorName;
    const c = ConversationController.get(creator);
    if (c) {
      creatorName = c.getName();
    }
    let displayText = '';
    if (changeType === 1) {
      displayText = `@${creatorName} ${i18n('createdReminder')}`;
    } else if (changeType === 2) {
      displayText = `@${creatorName} ${i18n('changedReminder')}`;
    } else if (changeType === 3) {
      displayText = `@${creatorName} ${i18n('deletedReminder')}`;
    } else if (changeType === 4) {
      displayText = `${i18n('reminderBy')} @${creatorName}: ${description}`;

      updateAttribute = {
        ...updateAttribute,
        unreadCount: conversation.get('unreadCount') + 1,
        active_at: Date.now(),
      };

      messageAttribute = {
        ...messageAttribute,
        type: 'incoming',
      };
    } else {
      log.warn('[', cid, notifyTime, ']', 'unknown changeType');
      return;
    }

    const message = await conversation.saveNewLocalMessage({
      ...messageAttribute,
      source: window.textsecure.storage.user.getNumber(),
      reminderNotifyUpdate: {
        description,
        creatorName,
        displayText,
      },
      expireTimer,
    });

    if (changeType === 4) {
      await conversation.notify(message);
    }

    conversation.set({
      ...updateAttribute,
    });

    await window.Signal.Data.updateConversation(idV1, conversation.attributes, {
      Conversation: Whisper.Conversation,
    });
  }
})();
