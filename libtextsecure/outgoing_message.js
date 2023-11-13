/* global textsecure, libsignal, window, btoa, _ */

/* eslint-disable more/no-then */

// prettier-ignore
const NotificationType = {
  MSG_SINGLE_NORMAL:              0,
  MSG_SINGLE_FILE:                1,
  MSG_SINGLE_REPLY:               2,
  MSG_SINGLE_CALL_RING:           3,
  MSG_SINGLE_CALL_CANCEL:         4,
  MSG_SINGLE_CALL_TIMEOUT:        5,
  MSG_GROUP_NORMAL:               6,
  MSG_GROUP_FILE:                 7,
  MSG_GROUP_AT_RECEIVER:          8,
  MSG_GROUP_AT_OTHERS:            9,
  MSG_GROUP_AT_ALL:               10,
  MSG_GROUP_REPLY_RECEIVER:       11,
  MSG_GROUP_REPLY_OTHERS:         12,
  MSG_GROUP_CALL_RING:            13,
  MSG_GROUP_CALL_CLOSE:           14,
  MSG_GROUP_CALL_OVER:            15,
  MSG_GROUP_ANNOUNCEMENT_ADDED:   16,
  MSG_GROUP_ANNOUNCEMENT_UPDATED: 17,
  MSG_RECALL_MENTIONS_OTHERS:     18,
  MSG_RECALL_MENTIONS_RECEIVER:   19,
  MSG_SINGLE_TASK:                20,
}

// prettier-ignore
const DetailMessageType = {
  FORWARD:  1,
  CONTACT:  2,
  RECALL:   3,
  TASK:     4,
  VOTE:     5,
  REACTION: 6,
  CARD:     7,
};

// prettier-ignore
const CallAction = {
  RING:    'RING',
  CANCEL:  'CANCEL',
  TIMEOUT: 'TIMEOUT',
}

function OutgoingMessage(
  server,
  timestamp,
  numbers,
  message,
  silent,
  callback,
  extension
) {
  if (message instanceof textsecure.protobuf.DataMessage) {
    const content = new textsecure.protobuf.Content();
    content.dataMessage = message;
    // eslint-disable-next-line no-param-reassign
    message = content;
  }
  this.server = server;
  this.timestamp = timestamp;
  this.numbers = numbers;
  this.message = message; // ContentMessage proto
  this.callback = callback;
  this.silent = silent;

  this.extension = extension;

  this.numbersCompleted = 0;
  this.errors = [];
  this.successfulNumbers = [];

  this.sequenceId = 0;
  this.serverTimestamp = 0;
  this.notifySequenceId = 0;

  this.sequenceIdMap = {};
  this.serverTimestampMap = {};
  this.notifySequenceIdMap = {};
}

OutgoingMessage.prototype = {
  constructor: OutgoingMessage,
  numberCompleted() {
    this.numbersCompleted += 1;
    if (this.numbersCompleted >= this.numbers.length) {
      this.callback({
        sequenceId: this.sequenceId,
        serverTimestamp: this.serverTimestamp,
        notifySequenceId: this.notifySequenceId,

        sequenceIdMap: this.sequenceIdMap,
        serverTimestampMap: this.serverTimestampMap,
        notifySequenceIdMap: this.notifySequenceIdMap,

        successfulNumbers: this.successfulNumbers,
        errors: this.errors,
      });
    }
  },
  registerError(number, reason, error) {
    if (!error || (error.name === 'HTTPError' && error.code !== 404)) {
      // eslint-disable-next-line no-param-reassign
      error = new textsecure.OutgoingMessageError(
        number,
        this.message.toArrayBuffer(),
        this.timestamp,
        error
      );
    }

    // eslint-disable-next-line no-param-reassign
    error.number = number;
    // eslint-disable-next-line no-param-reassign
    error.reason = reason;
    this.errors[this.errors.length] = error;
    this.numberCompleted();
  },
  reloadDevicesAndSend(number, recurse) {
    return () =>
      textsecure.storage.protocol.getDeviceIds(number).then(deviceIds => {
        if (deviceIds.length === 0) {
          return this.registerError(
            number,
            'Got empty device list when loading device keys',
            null
          );
        }
        return this.doSendMessage(number, deviceIds, recurse);
      });
  },

  getKeysForNumber(number, updateDevices) {
    const handleResult = response =>
      Promise.all(
        response.devices.map(device => {
          // eslint-disable-next-line no-param-reassign
          device.identityKey = response.identityKey;
          if (
            updateDevices === undefined ||
            updateDevices.indexOf(device.deviceId) > -1
          ) {
            const address = new libsignal.SignalProtocolAddress(
              number,
              device.deviceId
            );
            const builder = new libsignal.SessionBuilder(
              textsecure.storage.protocol,
              address
            );
            if (device.registrationId === 0) {
              window.log.info('device registrationId 0!');
            }
            return builder.processPreKey(device).catch(error => {
              if (error.message === 'Identity key changed') {
                // eslint-disable-next-line no-param-reassign
                error.timestamp = this.timestamp;
                // eslint-disable-next-line no-param-reassign
                error.originalMessage = this.message.toArrayBuffer();
                // eslint-disable-next-line no-param-reassign
                error.identityKey = device.identityKey;
              }
              throw error;
            });
          }

          return null;
        })
      );

    if (updateDevices === undefined) {
      return this.server.getKeysForNumber(number, '*').then(handleResult);
    }

    let promise = Promise.resolve();
    updateDevices.forEach(deviceId => {
      promise = promise.then(() =>
        this.server
          .getKeysForNumber(number, deviceId)
          .then(handleResult)
          .catch(e => {
            if (e.name === 'HTTPError' && e.code === 404) {
              if (deviceId !== 1) {
                return this.removeDeviceIdsForNumber(number, [deviceId]);
              }
              throw new textsecure.UnregisteredUserError(number, e);
            } else {
              throw e;
            }
          })
      );
    });

    return promise;
  },

  transmitMessage(number, jsonData, timestamp) {
    return this.server
      .sendMessages(number, jsonData, timestamp, this.silent)
      .catch(e => {
        if (e.name === 'HTTPError' && e.code !== 409 && e.code !== 410) {
          // 409 and 410 should bubble and be handled by doSendMessage
          // 404 should throw UnregisteredUserError
          // all other network errors can be retried later.

          const conversation = ConversationController.get(number);
          if (conversation) {
            conversation.addTips(e.code);
          }

          if (e.code === 404) {
            throw new textsecure.UnregisteredUserError(number, e);
          } else if (e.code === 430 || e.code === 431) {
            throw new textsecure.ForbiddenError(number, e);
          }

          throw new textsecure.SendMessageNetworkError(
            number,
            jsonData,
            e,
            timestamp
          );
        }
        throw e;
      });
  },

  getPaddedMessageLength(messageLength) {
    const messageLengthWithTerminator = messageLength + 1;
    let messagePartCount = Math.floor(messageLengthWithTerminator / 160);

    if (messageLengthWithTerminator % 160 !== 0) {
      messagePartCount += 1;
    }

    return messagePartCount * 160;
  },

  getPlaintext() {
    if (!this.plaintext) {
      const messageBuffer = this.message.toArrayBuffer();
      this.plaintext = new Uint8Array(
        this.getPaddedMessageLength(messageBuffer.byteLength + 1) - 1
      );
      this.plaintext.set(new Uint8Array(messageBuffer));
      this.plaintext[messageBuffer.byteLength] = 0x80;
    }
    return this.plaintext;
  },

  //   version - 填2就好
  //   pubIdKey - 私聊 - 对方的indentifyKey, 传buffer
  //   pubIdKeys - 群聊-
  //   localPriKey - 自己的私钥，传buffer
  //   plainText - xxxx
  getRustEncryptedData(version, pubIdKey, pubIdKeys, localPriKey, plainText) {
    return window.libCryptClient.encrypt_message(
      window.MESSAGE_CURRENT_VERSION,
      pubIdKey,
      pubIdKeys,
      localPriKey,
      plainText
    );
  },

  getDetailMessageType() {
    const { dataMessage } = this.message;
    if (dataMessage instanceof textsecure.protobuf.DataMessage) {
      const { reaction, forwardContext, contacts, recall, task, vote, card } =
        dataMessage;
      if (forwardContext?.forwards?.length > 0) {
        return DetailMessageType.FORWARD;
      } else if (contacts?.length > 0) {
        return DetailMessageType.CONTACT;
      } else if (recall?.realSource) {
        return DetailMessageType.RECALL;
      } else if (task instanceof textsecure.protobuf.DataMessage.Task) {
        return DetailMessageType.TASK;
      } else if (vote instanceof textsecure.protobuf.DataMessage.Vote) {
        return DetailMessageType.VOTE;
      } else if (card instanceof textsecure.protobuf.DataMessage.Card) {
        return DetailMessageType.CARD;
      } else if (reaction instanceof textsecure.protobuf.DataMessage.Reaction) {
        return DetailMessageType.REACTION;
      } else {
        //
        return null;
      }
      return null;
    }
  },

  getMessageType() {
    const MessageType = textsecure.protobuf.Envelope.MsgType;
    let messageType = MessageType.MSG_UNKNOWN;

    do {
      const { receiptMessage } = this.message;
      if (receiptMessage instanceof textsecure.protobuf.ReceiptMessage) {
        messageType = MessageType.MSG_READ_RECEIPT;
        break;
      }

      const { dataMessage } = this.message;
      if (dataMessage instanceof textsecure.protobuf.DataMessage) {
        const { recall } = dataMessage;
        if (recall instanceof textsecure.protobuf.DataMessage.Recall) {
          messageType = MessageType.MSG_RECALL;
        } else {
          messageType = MessageType.MSG_NORMAL;
        }

        break;
      }

      const { syncMessage } = this.message;
      if (syncMessage instanceof textsecure.protobuf.SyncMessage) {
        const { sent, read } = syncMessage;
        if (sent instanceof textsecure.protobuf.SyncMessage.Sent) {
          const { reaction } = sent.message || {};
          if (reaction instanceof textsecure.protobuf.DataMessage.Reaction) {
            messageType = MessageType.MSG_SYNC;
          } else {
            messageType = MessageType.MSG_SYNC_PREVIEWABLE;
          }
        } else if (
          read?.length &&
          read[0] instanceof textsecure.protobuf.SyncMessage.Read
        ) {
          messageType = MessageType.MSG_SYNC_READ_RECEIPT;
        } else {
          messageType = MessageType.MSG_SYNC;
        }
        break;
      }
    } while (false);

    return messageType;
  },

  getNotificationForNumber(number) {
    let notification = {};
    let passthrough = {};

    // add notification for group sync messages
    if (this.message.syncMessage instanceof textsecure.protobuf.SyncMessage) {
      const group = this.message.syncMessage.sent?.message?.group;
      if (group) {
        const groupId = dcodeIO.ByteBuffer.wrap(group.id).toString('binary');
        const conversation = ConversationController.get(groupId);

        notification.type = -1;
        notification.args = {
          gname: conversation.getName(),
        };

        if (conversation.isGroupV2()) {
          notification.args.gid = conversation.getGroupV2Id();
        }
      }
      return notification;
    }

    const proto = this.message.dataMessage;
    if (!proto || !(proto instanceof textsecure.protobuf.DataMessage)) {
      return notification;
    }

    const ourNumber = textsecure.storage.user.getNumber();
    const { channelName, meetingName, callAction, collapseId, recall } =
      this.extension || {};

    let realCollapseId = collapseId;
    if (channelName) {
      realCollapseId = channelName;
    } else if (proto.recall) {
      realCollapseId = recall?.collapseId;
    }

    notification.args = {
      collapseId: realCollapseId,
    };

    if (proto.group) {
      // group chat
      const groupIdB64 = dcodeIO.ByteBuffer.wrap(proto.group.id).toString(
        'base64'
      );
      passthrough = {
        conversationId: groupIdB64,
      };

      const groupId = dcodeIO.ByteBuffer.wrap(proto.group.id).toString(
        'binary'
      );
      const conversation = ConversationController.get(groupId);

      notification.args.gname = conversation.getName();
      if (conversation.isGroupV2()) {
        notification.args.gid = conversation.getGroupV2Id();
      }

      const MENTIONS_ALL_ID = 'MENTIONS_ALL';

      if (proto.recall) {
        // atPersons in recall is an array of persons
        const { atPersons, quotedAuthor } = recall;

        const mentionedPersons = [];
        if (quotedAuthor) {
          mentionedPersons.push(quotedAuthor);

          if (quotedAuthor === number) {
            notification.type = NotificationType.MSG_RECALL_MENTIONS_RECEIVER;
          } else {
            notification.type = NotificationType.MSG_RECALL_MENTIONS_OTHERS;
          }
        } else if (atPersons instanceof Array && atPersons.length > 0) {
          mentionedPersons.push(...atPersons);

          if (
            atPersons.includes(MENTIONS_ALL_ID) ||
            atPersons.includes(number)
          ) {
            notification.type = NotificationType.MSG_RECALL_MENTIONS_RECEIVER;
          } else {
            notification.type = NotificationType.MSG_RECALL_MENTIONS_OTHERS;
          }
        }

        if (mentionedPersons.length > 0) {
          notification.args = {
            ...notification.args,
            mentionedPersons,
          };
        }
      } else if (proto.attachments && proto.attachments.length > 0) {
        // attachments
        notification.type = NotificationType.MSG_GROUP_FILE;
      } else if (proto.quote) {
        // quote
        if (proto.quote.author === number) {
          notification.type = NotificationType.MSG_GROUP_REPLY_RECEIVER;
        } else {
          notification.type = NotificationType.MSG_GROUP_REPLY_OTHERS;
          notification.args = {
            ...notification.args,
            mentionedPersons: [proto.quote.author],
          };
        }
      } else if (callAction === CallAction.RING) {
        notification.type = NotificationType.MSG_GROUP_CALL_RING;

        passthrough = {
          ...passthrough,
          callInfo: {
            mode: 'group',
            caller: ourNumber,
            channelName: channelName,
            meetingName: meetingName,
            groupId: groupIdB64,
          },
        };
      } else if (proto.atPersons) {
        // at persons
        const persons = proto.atPersons.split(';');

        notification.args = {
          ...notification.args,
          mentionedPersons: persons,
        };

        if (persons.includes(MENTIONS_ALL_ID)) {
          notification.type = NotificationType.MSG_GROUP_AT_ALL;
        } else if (persons.includes(number)) {
          notification.type = NotificationType.MSG_GROUP_AT_RECEIVER;
        } else {
          notification.type = NotificationType.MSG_GROUP_AT_OTHERS;
        }
      } else {
        notification.type = NotificationType.MSG_GROUP_NORMAL;

        // if (callAction === CallAction.RING) {
        //   notification.type = NotificationType.MSG_GROUP_CALL_RING;

        //   passthrough = {
        //     ...passthrough,
        //     callInfo: {
        //       mode: 'group',
        //       caller: ourNumber,
        //       channelName: channelName,
        //       meetingName: meetingName,
        //       groupId: groupIdB64,
        //     },
        //   };
        // }
      }
    } else {
      passthrough = {
        conversationId: ourNumber,
      };

      // single chat
      if (proto.attachments && proto.attachments.length > 0) {
        notification.type = NotificationType.MSG_SINGLE_FILE;
      } else if (proto.quote) {
        notification.type = NotificationType.MSG_SINGLE_REPLY;
      } else if (proto.task) {
        notification.type = NotificationType.MSG_SINGLE_TASK;
      } else {
        // default to normal message
        notification.type = NotificationType.MSG_SINGLE_NORMAL;

        if (callAction === CallAction.RING) {
          // 群拉人通知的情况
          if (meetingName) {
            const me = ConversationController.get(ourNumber);
            notification.args.gname = me.getDisplayName();
            notification.type = NotificationType.MSG_GROUP_CALL_RING;
            passthrough = {
              ...passthrough,
              callInfo: {
                mode: 'group',
                caller: ourNumber,
                channelName,
                meetingName,
                groupId: '', // 必须设置为空
              },
            };
          } else {
            notification.type = NotificationType.MSG_SINGLE_CALL_RING;
            passthrough = {
              ...passthrough,
              callInfo: {
                mode: 'private',
                caller: ourNumber,
                channelName: channelName,
              },
            };
          }
        } else if (callAction === CallAction.CANCEL) {
          notification.type = NotificationType.MSG_SINGLE_CALL_CANCEL;
        } else if (callAction === CallAction.TIMEOUT) {
          notification.type = NotificationType.MSG_SINGLE_CALL_TIMEOUT;
        }
      }
    }

    notification.args = {
      ...notification.args,
      passthrough: JSON.stringify(passthrough),
    };

    return notification;
  },

  doSendMessage(number, deviceIds, recurse) {
    const ciphers = {};
    const plaintext = this.getPlaintext();
    const notification = this.getNotificationForNumber(number);
    const proto = this.message.receiptMessage;
    const readReceipt = proto instanceof textsecure.protobuf.ReceiptMessage;

    return Promise.all(
      deviceIds.map(async deviceId => {
        const address = new libsignal.SignalProtocolAddress(number, deviceId);

        const ourNumber = textsecure.storage.user.getNumber();
        const options = {};

        // No limit on message keys if we're communicating with our other devices
        const isMe = ourNumber === number;
        if (isMe) {
          options.messageKeysLimit = false;
        }

        const sessionCipher = new libsignal.SessionCipher(
          textsecure.storage.protocol,
          address,
          options
        );
        ciphers[address.getDeviceId()] = sessionCipher;

        const jsonData = {
          destinationDeviceId: address.getDeviceId(),
          notification,
          readReceipt,
          msgType: this.getMessageType(),
        };

        const { isPrivate, conversationId } = this.extension || {};
        if (conversationId) {
          if (isPrivate) {
            jsonData.conversation = { number: conversationId };
          } else {
            jsonData.conversation = { gid: conversationId };
          }
        }

        // is read receipt message AND plain read receipts
        // only send tunnel security message
        if (readReceipt && this.extension?.plainReadReceipts) {
          return [
            {
              ...jsonData,
              destinationRegistrationId:
                await sessionCipher.getRemoteRegistrationId(),
              type: textsecure.protobuf.Envelope.Type.PLAINTEXT,
              content: this.message.toBase64(),
            },
          ];
        }

        const ciphertext = await sessionCipher.encrypt(plaintext);

        // add cipher body
        const jsonDatas = [
          {
            ...jsonData,
            destinationRegistrationId: ciphertext.registrationId,
            type: ciphertext.type,
            content: btoa(ciphertext.body),
          },
        ];

        // is me, do not use tunnel security,
        // because ios cannot handle duplicated outgoing messages from other device
        if (isMe) {
          return jsonDatas;
        }

        const tunnelSecurityEnds = this.extension?.tunnelSecurityEnds;
        if (Array.isArray(tunnelSecurityEnds)) {
          const isTunnelSecurity = tunnelSecurityEnds.some(end => {
            if (end?.toString()) {
              return number.endsWith(end);
            }

            return false;
          });

          if (isTunnelSecurity) {
            jsonDatas.push({
              ...jsonData,
              destinationRegistrationId: ciphertext.registrationId,
              type: textsecure.protobuf.Envelope.Type.PLAINTEXT,
              content: this.message.toBase64(),
            });
          }
        }

        return jsonDatas;
      })
    )
      .then(jsonData => {
        const mergedData = [];
        jsonData.forEach(data => mergedData.push(...data));

        return this.transmitMessage(number, mergedData, this.timestamp).then(
          response => {
            this.sequenceIdMap[number] = response?.sequenceId;
            this.serverTimestampMap[number] = response?.systemShowTimestamp;
            this.notifySequenceIdMap[number] = response?.notifySequenceId;

            this.successfulNumbers.push(number);
            this.numberCompleted();
          }
        );
      })
      .catch(error => {
        if (
          error instanceof Error &&
          error.name === 'HTTPError' &&
          (error.code === 410 || error.code === 409)
        ) {
          if (!recurse)
            return this.registerError(
              number,
              'Hit retry limit attempting to reload device list',
              error
            );

          let p;
          if (error.code === 409) {
            p = this.removeDeviceIdsForNumber(
              number,
              error.response.extraDevices
            );
          } else {
            p = Promise.all(
              error.response.staleDevices.map(deviceId =>
                ciphers[deviceId].closeOpenSessionForDevice(
                  new libsignal.SignalProtocolAddress(number, deviceId)
                )
              )
            );
          }

          return p.then(() => {
            const resetDevices =
              error.code === 410
                ? error.response.staleDevices
                : error.response.missingDevices;
            return this.getKeysForNumber(number, resetDevices).then(
              // We continue to retry as long as the error code was 409; the assumption is
              //   that we'll request new device info and the next request will succeed.
              this.reloadDevicesAndSend(number, error.code === 409)
            );
          });
        } else if (error.message === 'Identity key changed') {
          // eslint-disable-next-line no-param-reassign
          error.timestamp = this.timestamp;
          // eslint-disable-next-line no-param-reassign
          error.originalMessage = this.message.toArrayBuffer();
          window.log.error(
            'Got "key changed" error from encrypt - no identityKey for application layer',
            number,
            deviceIds
          );
          throw error;
        } else {
          this.registerError(number, 'Failed to create or send message', error);
        }

        return null;
      });
  },

  getStaleDeviceIdsForNumber(number) {
    return textsecure.storage.protocol.getDeviceIds(number).then(deviceIds => {
      if (deviceIds.length === 0) {
        return [1];
      }
      const updateDevices = [];
      return Promise.all(
        deviceIds.map(deviceId => {
          const address = new libsignal.SignalProtocolAddress(number, deviceId);
          const sessionCipher = new libsignal.SessionCipher(
            textsecure.storage.protocol,
            address
          );
          return sessionCipher.hasOpenSession().then(hasSession => {
            if (!hasSession) {
              updateDevices.push(deviceId);
            }
          });
        })
      ).then(() => updateDevices);
    });
  },

  removeDeviceIdsForNumber(number, deviceIdsToRemove) {
    let promise = Promise.resolve();
    // eslint-disable-next-line no-restricted-syntax, guard-for-in
    for (const j in deviceIdsToRemove) {
      promise = promise.then(() => {
        const encodedNumber = `${number}.${deviceIdsToRemove[j]}`;
        return textsecure.storage.protocol.removeSession(encodedNumber);
      });
    }
    return promise;
  },

  async sendToNumber(number) {
    try {
      const updateDevices = await this.getStaleDeviceIdsForNumber(number);
      await this.getKeysForNumber(number, updateDevices);
      await this.reloadDevicesAndSend(number, true)();
    } catch (error) {
      if (error.message === 'Identity key changed') {
        // eslint-disable-next-line no-param-reassign
        const newError = new textsecure.OutgoingIdentityKeyError(
          number,
          error.originalMessage,
          error.timestamp,
          error.identityKey
        );
        this.registerError(number, 'Identity key changed', newError);
      } else {
        this.registerError(
          number,
          `Failed to retrieve new device keys for number ${number}`,
          error
        );
      }
    }
  },

  async requestUsersIdkey(users) {
    try {
      const userKeys = await window
        .getAccountManager()
        .getUserSessionsV2KeyByUid(users);
      if (Array.isArray(userKeys?.keys) && userKeys.keys.length) {
        return userKeys.keys;
      }
    } catch (e) {
      this.registerError(
        this.extension?.conversationId,
        'Send message to group failed - request sessionV2.'
      );
    }
  },

  identityKeyToArrayBuffer(identityKey) {
    const ab = window.Signal.Crypto.base64ToArrayBuffer(identityKey);
    return ab.slice(1);
  },

  async sendToGroup(tryTimes = 3) {
    if (tryTimes <= 0) {
      this.registerError(
        number,
        'Send message failed.',
        'tried 6 times, but still failed.'
      );
      return;
    }

    const proto = this.message.dataMessage;
    if (!(proto instanceof textsecure.protobuf.DataMessage) || !proto.group) {
      this.numbers.forEach(number => {
        this.registerError(
          number,
          'Send message failed.',
          'Cannot send non group dataMessage'
        );
      });
      return;
    }

    const notification = this.getNotificationForNumber();

    const plaintext = this.getPlaintext();
    const plaintextBuffer = plaintext.buffer;
    const store = textsecure.storage.protocol;
    const myIdentifyKeyPair = await store.getIdentityKeyPair();
    // 组装群组人员id -> identityKey
    const allMemberRegistrationIds = {};
    const pubIdKeys = {};
    const shouldRequestKeys = [];
    for (let i = 0; i < this.numbers.length; i += 1) {
      const num = this.numbers[i];
      const userSession = await window.Signal.Data.getSessionV2ById(num);
      if (
        userSession?.uid &&
        userSession?.identityKey &&
        userSession?.registrationId
      ) {
        // found in local database
        pubIdKeys[num] = this.identityKeyToArrayBuffer(userSession.identityKey);
        allMemberRegistrationIds[num] = userSession?.registrationId;
      } else {
        shouldRequestKeys.push(num);
      }
    }

    if (shouldRequestKeys.length) {
      const keys = await this.requestUsersIdkey(shouldRequestKeys);
      if (Array.isArray(keys)) {
        for (let i = 0; i < keys.length; i += 1) {
          const key = keys[i];
          pubIdKeys[key.uid] = this.identityKeyToArrayBuffer(key.identityKey);
          allMemberRegistrationIds[key.uid] = key.registrationId;
          await window.Signal.Data.createOrUpdateSessionV2({
            ...key,
          });
        }
      }
    }

    const encResult = this.getRustEncryptedData(
      window.MESSAGE_CURRENT_VERSION,
      new Uint8Array().buffer,
      pubIdKeys,
      myIdentifyKeyPair.privKey,
      plaintextBuffer
    );

    // use encResult.erm_keys
    const recipients = [];
    Object.keys(pubIdKeys).forEach(function (k) {
      recipients.push({
        uid: k,
        registrationId: allMemberRegistrationIds[k],
        peerContext: window.Signal.Crypto.arrayBufferToBase64(
          encResult.erm_keys[k]
        ),
      });
    });

    const encryptedMessage = new textsecure.protobuf.EncryptedContent({
      version: window.MESSAGE_CURRENT_VERSION,
      cipherText: new Uint8Array(encResult.cipher_text),
      signedEKey: new Uint8Array(encResult.signed_e_key),
      eKey: new Uint8Array(encResult.e_key),
      identityKey: new Uint8Array(encResult.identity_key),
    });

    const encMessageBuf =
      textsecure.protobuf.EncryptedContent.encode(encryptedMessage);
    const encMessageBufUint8Array = new Uint8Array(encMessageBuf.toBuffer());
    const appendVersionEncMessageBuf = this.concatenate(
      Uint8Array,
      new Uint8Array([
        (window.MESSAGE_CURRENT_VERSION << 4) |
          window.MESSAGE_MINIMUM_SUPPORTED_VERSION,
      ]),
      encMessageBufUint8Array
    );
    const content = window.Signal.Crypto.arrayBufferToBase64(
      appendVersionEncMessageBuf
    );

    const jsonData = {
      type: textsecure.protobuf.Envelope.Type.ENCRYPTEDTEXT,
      content,
      notification,
      msgType: this.getMessageType(),
      detailMessageType: this.getDetailMessageType(),
      recipients,
    };

    const MessageType = textsecure.protobuf.Envelope.MsgType;
    if (jsonData.msgType === MessageType.MSG_RECALL) {
      const { realSource } = this.message.dataMessage?.recall;
      if (realSource) {
        jsonData.realSource = {
          ...realSource,
        };
      }
    }

    const { isPrivate, conversationId } = this.extension || {};
    if (conversationId) {
      if (isPrivate) {
        // just log it, should never be here
        console.log("sendToGroup shouldn't have isPrivate.");
        jsonData.conversation = { number: conversationId };
      } else {
        jsonData.conversation = { gid: conversationId };
      }
    }

    // we just reuse notification.args.gid, as this is the groupV2Id
    this.server
      .sendMessageV3ToGroup(
        notification.args.gid,
        jsonData,
        this.timestamp,
        this.silent
      )
      .then(async response => {
        // 失败降级处理11002，客户端认为成功并记录日志，server会发送通道加密消息；
        if (response.status === 11002) {
          console.log('sendMessageV3ToGroup status === 11002.');
        }

        // 出错了，需要处理
        if (response.status === 11001) {
          console.log('sendMessageV3ToGroup status === 11001.');
          // 少人了
          if (response?.data?.missing) {
            console.log('sendMessageV3ToGroup status === 11001. with missing.');
            if (Array.isArray(response?.data?.missing)) {
              for (let i = 0; i < response?.data?.missing.length; i += 1) {
                const key = response?.data?.missing[i];
                this.numbers.push(key.uid);
                await window.Signal.Data.createOrUpdateSessionV2({
                  ...key,
                });
              }
              // 更新群信息
              const expiredSessionUser = ConversationController.get(
                this.extension?.conversationId
              );
              if (expiredSessionUser) {
                expiredSessionUser.apiLoadGroupV2();
              }
              console.log(
                'sendMessageV3ToGroup status === 11001. with missing try again.'
              );
              return this.sendToGroup(tryTimes - 1);
            } else {
              console.log(
                'sendMessageV3ToGroup status === 11001. bad missing data.'
              );
              this.registerError(
                this.extension?.conversationId,
                'sendMessageV3ToGroup status === 11001. bad missing data.'
              );
            }
            return;
          }

          // 有的人session已过期了
          else if (response?.data?.stale) {
            console.log('sendMessageV3ToGroup status === 11001. with stale.');
            if (Array.isArray(response?.data?.stale)) {
              for (let i = 0; i < response?.data?.stale.length; i += 1) {
                const key = response?.data?.stale[i];
                await window.Signal.Data.createOrUpdateSessionV2({
                  ...key,
                });

                // 更新此人session
                const expiredSessionUser = ConversationController.get(key.uid);
                if (expiredSessionUser) {
                  expiredSessionUser.forceUpdateSessionV2(key);
                }
              }
              console.log(
                'sendMessageV3ToGroup status === 11001. with stale try again.'
              );
              return this.sendToGroup(tryTimes - 1);
            } else {
              console.log(
                'sendMessageV3ToGroup status === 11001. bad stale data.'
              );
              this.registerError(
                this.extension?.conversationId,
                'sendMessageV3ToGroup status === 11001. bad stale data.'
              );
            }
            return;
          }

          // 多人了，当作成功处理
          else if (response?.data?.extra) {
            console.log(
              'sendMessageV3ToGroup status === 11001. with extra, success.'
            );
          } else {
            this.registerError(
              this.extension?.conversationId,
              'Send message to group unknown 11001'
            );
            return;
          }
        }

        this.sequenceId = response?.sequenceId;
        this.serverTimestamp = response?.systemShowTimestamp;
        this.notifySequenceId = response?.notifySequenceId;

        this.numbers.forEach(number => {
          this.successfulNumbers.push(number);
          this.numberCompleted();
        });
      })
      .catch(e => {
        this.numbers.forEach(number => {
          let error;
          if (e.name === 'HTTPError') {
            if (e.code === 404) {
              error = new textsecure.UnregisteredUserError(number, e);
            } else if (e.code === 430 || e.code === 431) {
              error = new textsecure.ForbiddenError(number, e);
            } else {
              error = new textsecure.SendMessageNetworkError(
                number,
                jsonData,
                e,
                this.timestamp
              );
            }
          } else {
            error = e;
          }

          this.registerError(number, 'Send message to group failed.', error);
        });
      });
  },

  // 通道加密消息
  // async sendToNumberV2(number) {
  //   const { receiptMessage } = this.message;
  //   const notification = this.getNotificationForNumber();
  //
  //   const jsonData = {
  //     type: textsecure.protobuf.Envelope.Type.PLAINTEXT,
  //     content: this.message.toBase64(),
  //     notification,
  //     readReceipt: receiptMessage instanceof textsecure.protobuf.ReceiptMessage,
  //     msgType: this.getMessageType(),
  //     detailMessageType: this.getDetailMessageType(),
  //   };
  //
  //   const MessageType = textsecure.protobuf.Envelope.MsgType;
  //   if (jsonData.msgType === MessageType.MSG_SYNC_READ_RECEIPT) {
  //     const reads = this.message.syncMessage.read;
  //     jsonData.readPositions = reads.map(read => {
  //       const { readPosition } = read;
  //       return {
  //         groupId: readPosition.groupId ? this.extension?.conversationId : null,
  //         maxServerTime: readPosition.maxServerTimestamp,
  //         ..._.pick(readPosition, ['readAt', 'maxNotifySequenceId']),
  //       };
  //     });
  //   } else if (jsonData.msgType === MessageType.MSG_RECALL) {
  //     const { realSource } = this.message.dataMessage?.recall;
  //     if (realSource) {
  //       jsonData.realSource = {
  //         ...realSource,
  //       };
  //     }
  //   } else if (jsonData.msgType === MessageType.MSG_SYNC_PREVIEWABLE) {
  //     const { sent } = this.message.syncMessage;
  //     if (sent) {
  //       jsonData.realSource = {
  //         source: textsecure.storage.user.getNumber(),
  //         sourceDevice: textsecure.storage.user.getDeviceId(),
  //         timestamp: sent.timestamp,
  //         serverTimestamp: sent.serverTimestamp,
  //         sequenceId: sent.sequenceId,
  //         notifySequenceId: sent.notifySequenceId,
  //       };
  //     }
  //   }
  //
  //   const { isPrivate, conversationId } = this.extension || {};
  //   if (conversationId) {
  //     if (isPrivate) {
  //       jsonData.conversation = { number: conversationId };
  //     } else {
  //       jsonData.conversation = { gid: conversationId };
  //     }
  //   }
  //
  //   this.server
  //     .sendMessageToNumber(number, jsonData, this.timestamp, this.silent)
  //     .then(response => {
  //       this.sequenceIdMap[number] = response?.sequenceId;
  //       this.serverTimestampMap[number] = response?.systemShowTimestamp;
  //       this.notifySequenceIdMap[number] = response?.notifySequenceId;
  //
  //       this.successfulNumbers.push(number);
  //       this.numberCompleted();
  //     })
  //     .catch(e => {
  //       let error;
  //       if (e.name === 'HTTPError') {
  //         const conversation = ConversationController.get(number);
  //         if (conversation) {
  //           conversation.addTips(e.code);
  //         }
  //
  //         // 404 should throw UnregisteredUserError
  //         // 430 should throw ForbiddenError
  //         // all other network errors can be retried later.
  //         if (e.code === 404) {
  //           error = new textsecure.UnregisteredUserError(number, e);
  //         } else if (e.code === 430 || e.code === 431) {
  //           error = new textsecure.ForbiddenError(number, e);
  //         } else {
  //           error = new textsecure.SendMessageNetworkError(
  //             number,
  //             jsonData,
  //             e,
  //             this.timestamp
  //           );
  //         }
  //       } else {
  //         error = e;
  //       }
  //
  //       this.registerError(number, 'Send message to number failed.', error);
  //     });
  // },

  concatenate(resultConstructor, ...arrays) {
    let totalLength = 0;
    for (let arr of arrays) {
      totalLength += arr.length;
    }
    let result = new resultConstructor(totalLength);
    let offset = 0;
    for (let arr of arrays) {
      result.set(arr, offset);
      offset += arr.length;
    }
    return result;
  },

  // V3加密消息(包含通道加密消息)
  async sendToNumberV3(number, tryTimes = 3) {
    if (tryTimes <= 0) {
      this.registerError(
        number,
        'Send message failed.',
        'tried 6 times, but still failed.'
      );
      return;
    }
    const { receiptMessage } = this.message;
    const notification = this.getNotificationForNumber();

    let identityKey = this.extension?.sessionV2?.identityKey;
    let registrationId = this.extension?.sessionV2?.registrationId;

    if (!identityKey || !registrationId) {
      const userSession = await window.Signal.Data.getSessionV2ById(number);
      if (
        userSession?.uid &&
        userSession?.identityKey &&
        userSession?.registrationId
      ) {
        identityKey = userSession?.identityKey;
        registrationId = userSession?.registrationId;
      } else {
        // 发起网络请求获取数据
        try {
          const keys = await this.requestUsersIdkey([number]);
          if (Array.isArray(keys) && keys.length) {
            const session = keys[0];
            if (session?.uid && session?.identityKey) {
              // 保存 session
              await window.Signal.Data.createOrUpdateSessionV2({
                ...session,
              });
              identityKey = session.identityKey;
              registrationId = session.registrationId;
            }
          }
        } catch (e) {}
      }
    }

    if (!identityKey || !registrationId) {
      this.registerError(
        number,
        'Send message to number failed - request sessionV2.'
      );
    }

    const plaintext = this.getPlaintext();
    const plaintextBuffer = plaintext.buffer;
    const store = textsecure.storage.protocol;
    const myIdentifyKeyPair = await store.getIdentityKeyPair();
    const abKey = this.identityKeyToArrayBuffer(identityKey);
    const encResult = this.getRustEncryptedData(
      window.MESSAGE_CURRENT_VERSION,
      abKey,
      {},
      myIdentifyKeyPair.privKey,
      plaintextBuffer
    );
    const encryptedMessage = new textsecure.protobuf.EncryptedContent({
      version: window.MESSAGE_CURRENT_VERSION,
      cipherText: new Uint8Array(encResult.cipher_text),
      signedEKey: new Uint8Array(encResult.signed_e_key),
      eKey: new Uint8Array(encResult.e_key),
      identityKey: new Uint8Array(encResult.identity_key),
    });

    const encMessageBuf =
      textsecure.protobuf.EncryptedContent.encode(encryptedMessage);
    const encMessageBufUint8Array = new Uint8Array(encMessageBuf.toBuffer());
    const appendVersionEncMessageBuf = this.concatenate(
      Uint8Array,
      new Uint8Array([
        (window.MESSAGE_CURRENT_VERSION << 4) |
          window.MESSAGE_MINIMUM_SUPPORTED_VERSION,
      ]),
      encMessageBufUint8Array
    );
    const content = window.Signal.Crypto.arrayBufferToBase64(
      appendVersionEncMessageBuf
    );

    const jsonData = {
      type: textsecure.protobuf.Envelope.Type.ENCRYPTEDTEXT,
      content,
      notification,
      readReceipt: receiptMessage instanceof textsecure.protobuf.ReceiptMessage,
      msgType: this.getMessageType(),
      detailMessageType: this.getDetailMessageType(),
      recipients: [
        {
          uid: number,
          registrationId,
        },
      ],
    };

    const MessageType = textsecure.protobuf.Envelope.MsgType;
    if (jsonData.msgType === MessageType.MSG_SYNC_READ_RECEIPT) {
      const reads = this.message.syncMessage.read;
      jsonData.readPositions = reads.map(read => {
        const { readPosition } = read;
        return {
          groupId: readPosition.groupId ? this.extension?.conversationId : null,
          maxServerTime: readPosition.maxServerTimestamp,
          ..._.pick(readPosition, ['readAt', 'maxNotifySequenceId']),
        };
      });
    } else if (jsonData.msgType === MessageType.MSG_RECALL) {
      const { realSource } = this.message.dataMessage?.recall;
      if (realSource) {
        jsonData.realSource = {
          ...realSource,
        };
      }
    } else if (jsonData.msgType === MessageType.MSG_SYNC_PREVIEWABLE) {
      const { sent } = this.message.syncMessage;
      if (sent) {
        jsonData.realSource = {
          source: textsecure.storage.user.getNumber(),
          sourceDevice: textsecure.storage.user.getDeviceId(),
          timestamp: sent.timestamp,
          serverTimestamp: sent.serverTimestamp,
          sequenceId: sent.sequenceId,
          notifySequenceId: sent.notifySequenceId,
        };
      }
    }

    const { isPrivate, conversationId } = this.extension || {};
    if (conversationId) {
      if (isPrivate) {
        jsonData.conversation = { number: conversationId };
      } else {
        jsonData.conversation = { gid: conversationId };
      }
    }

    this.server
      .sendMessageV3ToNumber(number, jsonData, this.timestamp, this.silent)
      .then(async response => {
        // 失败降级处理11002，客户端认为成功并记录日志，server会发送通道加密消息；
        if (response.status === 11002) {
          console.log('sendMessageV3ToNumber status === 11002.');
        }
        // 过期用户11001，deleteSession 重试消息发送；
        if (response.status === 11001) {
          console.log('sendMessageV3ToNumber status === 11001.');
          if (
            Array.isArray(response?.data?.stale) &&
            response?.data?.stale.length
          ) {
            const key = response?.data?.stale[0];
            await window.Signal.Data.createOrUpdateSessionV2({
              ...key,
            });

            if (!this.extension) {
              this.extension = {};
            }
            if (!this.extension.sessionV2) {
              this.extension.sessionV2 = {};
            }
            this.extension.sessionV2.identityKey = key.identityKey;
            this.extension.sessionV2.registrationId = key.registrationId;

            // 更新此人session
            const expiredSessionUser = ConversationController.get(key.uid);
            if (expiredSessionUser) {
              expiredSessionUser.forceUpdateSessionV2(key);
            }
            this.sendToNumberV3(number, tryTimes - 1);
          } else {
            this.registerError(
              number,
              'Send message to number failed - bad stale data.'
            );
          }
          return;
        }

        this.sequenceIdMap[number] = response?.sequenceId;
        this.serverTimestampMap[number] = response?.systemShowTimestamp;
        this.notifySequenceIdMap[number] = response?.notifySequenceId;

        this.successfulNumbers.push(number);
        this.numberCompleted();
      })
      .catch(e => {
        let error;
        if (e.name === 'HTTPError') {
          const conversation = ConversationController.get(number);
          if (conversation) {
            conversation.addTips(e.code);
          }

          // 404 should throw UnregisteredUserError
          // 430 should throw ForbiddenError
          // all other network errors can be retried later.
          if (e.code === 404) {
            error = new textsecure.UnregisteredUserError(number, e);
          } else if (e.code === 430 || e.code === 431) {
            error = new textsecure.ForbiddenError(number, e);
          } else {
            error = new textsecure.SendMessageNetworkError(
              number,
              jsonData,
              e,
              this.timestamp
            );
          }
        } else {
          error = e;
        }

        this.registerError(number, 'Send message to number failed.', error);
      });
  },
};
