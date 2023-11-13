/* global
  Whisper,
  Backbone,
  _,
  ConversationController,
  MessageController,
  window
*/

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function () {
  'use strict';

  window.Whisper = window.Whisper || {};
  Whisper.ReadReceipts = {
    readByAtUpdateBather: Signal.Util.createBatcher({
      name: 'readByAtUpdateBather',
      wait: 200,
      maxSize: Infinity,
      processBatch: async items => {
        const deduped = Array.from(new Set(items));

        log.info(
          'readByAtUpdateBather: deduped ',
          `${items.length} into ${deduped.length}`
        );

        for (const conversation of deduped) {
          await new Promise(r => setTimeout(r, 0));
          conversation.trigger('change:read_by_at');
        }
      },
    }),

    async getTargetMessage(reader, messages, readerGroups) {
      if (messages.length === 0) {
        return null;
      }

      // find message in 1v1 conversation with reader
      const message = messages.find(
        item => item.isOutgoing() && reader === item.get('conversationId')
      );
      if (message) {
        // register message
        return MessageController.register(message.id, message);
      }

      let gids = readerGroups[reader];
      if (!gids) {
        try {
          const groups = await window.Signal.Data.getAllGroupsInvolvingId(
            reader,
            { ConversationCollection: Whisper.ConversationCollection }
          );

          const ids = groups.pluck('id');
          gids = ids || [];
          readerGroups[reader] = gids;
        } catch (error) {
          window.log.error(
            'getAllGroupsInvolvingId failed',
            JSON.stringify(error)
          );
        }
      }

      if (!gids?.length) {
        return null;
      }

      const target = messages.find(
        item =>
          item.isOutgoing() && _.contains(gids, item.get('conversationId'))
      );
      if (!target) {
        return null;
      }

      return MessageController.register(target.id, target);
    },

    async findTargetMessage(receipt, readerGroups) {
      try {
        const messages = await window.Signal.Data.getMessagesBySentAt(
          receipt.get('timestamp'),
          {
            MessageCollection: Whisper.MessageCollection,
          }
        );

        const message = await this.getTargetMessage(
          receipt.get('reader'),
          messages,
          readerGroups
        );

        if (!message) {
          window.log.info(
            'No message for read receipt',
            receipt.get('reader'),
            receipt.get('timestamp')
          );
          return;
        }

        if (message.isNoNeedReceipts()) {
          return;
        }

        return message;
      } catch (error) {
        window.log.error(
          'ReadReceipts.findTargetMessage error:',
          error && error.stack ? error.stack : error
        );
      }
    },

    updateConversationReads(
      conversationReads,
      conversationId,
      readAt,
      maxServerTimestamp,
      maxNotifySequenceId
    ) {
      const { readAt: lastReadAt, maxServerTimestamp: lastServerTimestamp } =
        conversationReads[conversationId] || {};

      if (
        !lastServerTimestamp ||
        lastServerTimestamp < maxServerTimestamp ||
        (lastServerTimestamp === maxServerTimestamp && lastReadAt > readAt)
      ) {
        conversationReads[conversationId] = {
          maxServerTimestamp,
          readAt,
          maxNotifySequenceId,
        };
      }
    },

    async forMessage(message) {
      if (!message || message.isOutgoing()) {
        return;
      }

      // construct read position by received message
      // if received someone's message, then someone
      // must has read at here
      const readPosition = {
        reader: message.getSource(),
        conversationId: message.get('conversationId'),
        readAt: message.getServerTimestamp(),
        maxServerTimestamp: message.getServerTimestamp(),
        maxNotifySequenceId: message.get('notifySequenceId'),
      };

      await this.onReceipt(null, readPosition);
    },

    async onNormalReceipts(receipts, readPosition) {
      const readerMapping = {};

      // read receipt from others,
      // we just keep one last read position for everyone in each conversation
      // we save these readerByPositions in conversations

      if (readPosition) {
        const {
          reader,
          conversationId,
          readAt,
          maxServerTimestamp,
          maxNotifySequenceId,
        } = readPosition;

        const conversationReads = {};
        conversationReads[conversationId] = {
          readAt,
          maxServerTimestamp,
          maxNotifySequenceId,
        };
        readerMapping[reader] = conversationReads;
      } else {
        // compitable for receipts from older version client
        // manually generate readPosition for each reader of each conversation
        const readerInGroups = {};

        // receipt
        // {
        //   timestamp, // message's sent_at
        //   reader, // receipt sent by who
        //   envelopedAt, // envelope.timestamp, receipt message self's sent_at
        // }
        for (const receipt of receipts) {
          const { reader, envelopedAt: readAt } = receipt;

          const conversationReads = readerMapping[reader] || {};
          if (!readerMapping[reader]) {
            readerMapping[reader] = conversationReads;
          }

          const receiptModel = new Backbone.Model(receipt);
          const target = await this.findTargetMessage(
            receiptModel,
            readerInGroups
          );
          if (!target) {
            continue;
          }

          const conversationId = target.get('conversationId');
          if (!conversationId) {
            continue;
          }

          const serverTimestamp = target.getServerTimestamp();
          if (!serverTimestamp) {
            continue;
          }

          const notifySequenceId = target.get('notifySequenceId');

          // merge conversation reads by conversation and reader
          this.updateConversationReads(
            conversationReads,
            conversationId,
            readAt,
            serverTimestamp,
            notifySequenceId
          );
        }
      }

      // update read position in conversation
      for (const reader of Object.keys(readerMapping)) {
        const conversationReads = readerMapping[reader];
        for (const conversationId of Object.keys(conversationReads)) {
          const conversation = ConversationController.get(conversationId);
          if (conversation) {
            // update readerByPosition
            const readByAtMapping = conversation.get('read_by_at') || {};
            const oldPosition = readByAtMapping[reader];

            const curPosition = conversationReads[conversationId];
            if (
              !oldPosition ||
              curPosition.maxServerTimestamp > oldPosition.maxServerTimestamp
            ) {
              window.log.info(
                'update read status for',
                reader,
                'in conversation',
                conversationId,
                'at',
                curPosition
              );

              readByAtMapping[reader] = curPosition;
              conversation.set(
                { read_by_at: { ...readByAtMapping } },
                { silent: true }
              );
              this.readByAtUpdateBather.add(conversation);

              // save
              await window.Signal.Data.updateConversation(
                conversation.attributes
              );
            }
          } else {
            window.log.warn(
              'conversation not found for',
              reader,
              'in',
              conversationId
            );
          }
        }
      }
    },

    async onConfidentialReceipts(receipts) {
      const readerInGroups = {};

      // find and update message status
      for (const receipt of receipts) {
        const receiptModel = new Backbone.Model(receipt);
        const target = await this.findTargetMessage(
          receiptModel,
          readerInGroups
        );
        if (!target) {
          log.warn('not found message for', receipt);
          continue;
        }

        // skip non confidential message
        if (!target.isConfidentialMessage()) {
          continue;
        }

        // update message confidential-read records
        // and if all read, then remove this message
        await target.updateCondidentialStatus(receipt.reader);
      }
    },

    async onReceipt(receipt, readPosition, confirm) {
      const receipts = receipt instanceof Array ? receipt : [receipt];

      const isConfidential =
        receipt &&
        receipts.some(
          receipt =>
            receipt?.messageMode === textsecure.protobuf.Mode.CONFIDENTIAL
        );

      if (isConfidential) {
        await this.onConfidentialReceipts(receipts);
      } else {
        await this.onNormalReceipts(receipts, readPosition);
      }

      if (typeof confirm === 'function') {
        confirm();
      }
    },
  };
})();
