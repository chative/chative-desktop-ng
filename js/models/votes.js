/* global
  Whisper,
  MessageController,
*/

// eslint-disable-next-line func-names
(function () {
  window.Whisper = window.Whisper || {};

  const { saveMessage, getMessageById, getVoteLinkedMessages } =
    window.Signal.Data;

  const WhisperMessage = { Message: Whisper.Message };

  window.Whisper.Vote = {
    async findMessage(messageId) {
      let found = MessageController.getById(messageId);
      if (!found) {
        const fetched = await getMessageById(messageId, WhisperMessage);

        if (fetched) {
          found = MessageController.register(fetched.id, fetched);
        } else {
          window.log.error('message not found in database for ', messageId);
        }
      }

      return found;
    },

    async updateVoteLinkedMessages(vote) {
      const { voteId } = vote;
      if (!voteId) {
        window.log.error('invalid voteId.');
        return;
      }

      const messageIds = await getVoteLinkedMessages(voteId);
      if (messageIds && messageIds.length > 0) {
        for (let i = 0; i < messageIds.length; i += 1) {
          const { messageId } = messageIds[i];
          // eslint-disable-next-line no-await-in-loop
          const message = await this.findMessage(messageId);
          if (message) {
            const existTask = message.get('vote') || {};
            message.set({
              vote: {
                ...existTask,
                ...vote,
              },
            });

            // eslint-disable-next-line no-await-in-loop
            await saveMessage(message.attributes, WhisperMessage);
          }
        }
      }
    },
  };
})();
