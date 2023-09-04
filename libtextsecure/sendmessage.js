/* global _, textsecure, WebAPI, libsignal, OutgoingMessage, window */

/* eslint-disable more/no-then, no-bitwise */

function stringToArrayBuffer(str) {
  if (typeof str !== 'string') {
    throw new Error('Passed non-string to stringToArrayBuffer');
  }
  const res = new ArrayBuffer(str.length);
  const uint = new Uint8Array(res);
  for (let i = 0; i < str.length; i += 1) {
    uint[i] = str.charCodeAt(i);
  }
  return res;
}

function Message(options) {
  this.body = options.body;
  this.mentions = options.mentions;
  this.atPersons = options.atPersons;
  this.attachments = options.attachments || [];
  this.quote = options.quote;
  this.group = options.group;
  this.flags = options.flags;
  this.recipients = options.recipients;
  this.timestamp = options.timestamp;
  this.needsSync = options.needsSync;
  this.expireTimer = options.expireTimer;
  this.profileKey = options.profileKey;
  this.forwardContext = options.forwardContext;
  this.contacts = options.contacts;
  this.recall = options.recall;
  this.task = options.task;
  this.vote = options.vote;
  this.card = options.card;
  this.threadContext = options.threadContext;
  this.reaction = options.reaction;
  this.messageMode = options.messageMode;

  if (!(this.recipients instanceof Array)) {
    throw new Error('Invalid recipient list');
  }

  if (!this.group && this.recipients.length !== 1) {
    throw new Error('Invalid recipient list for non-group');
  }

  if (typeof this.timestamp !== 'number') {
    throw new Error('Invalid timestamp');
  }

  if (this.expireTimer !== undefined && this.expireTimer !== null) {
    if (typeof this.expireTimer !== 'number' || !(this.expireTimer >= 0)) {
      throw new Error('Invalid expireTimer');
    }
  }

  if (this.attachments) {
    if (!(this.attachments instanceof Array)) {
      throw new Error('Invalid message attachments');
    }
  }

  if (this.flags !== undefined && this.flags !== null) {
    if (typeof this.flags !== 'number') {
      throw new Error('Invalid message flags');
    }
  }

  if (this.forwardContext) {
    const { forwards, rapidFiles } = this.forwardContext;
    if (forwards && !(forwards instanceof Array)) {
      throw new Error('Invalid message forwardContext.forward.forwards');
    }

    if (rapidFiles && !(rapidFiles instanceof Array)) {
      throw new Error('Invalid message forwardContext.rapidFiles');
    }
  }

  if (this.contacts) {
    if (!(this.contacts instanceof Array)) {
      throw new Error('Invalid message contacts');
    }
  }

  if (this.recall && this.recall.realSource) {
    const { source, timestamp, serverTimestamp } = this.recall.realSource;
    if (typeof timestamp != 'number') {
      throw new Error('Invalid recall timestamp');
    }

    if (serverTimestamp && typeof serverTimestamp !== 'number') {
      throw new Error('Invalid recall serverTimestamp');
    }

    if (source != textsecure.storage.user.getNumber()) {
      throw new Error('only can recall messages from ourselves.');
    }
  }

  if (this.task) {
    const { taskId, name } = this.task;
    if (!taskId || !name) {
      throw new Error('Invalid task id or name');
    }
  }

  if (this.vote) {
    const { voteId, name } = this.vote;
    if (!voteId || !name) {
      throw new Error('Invalid vote id or name');
    }
  }

  if (this.card) {
    const { content } = this.card;
    if (!content) {
      throw new Error('Invalid card content');
    }
  }

  if (this.threadContext) {
    if (this.threadContext.source) {
      const { source } = this.threadContext.source;
      if (!source || typeof source !== 'string') {
        throw new Error('Invalid topic/thread context source source');
      }
    } else {
      throw new Error('Invalid topic/thread context source');
    }
    // for threadContext,
    // topicCompatible or threadCompatible should be true at least one.
    const { threadCompatible, topicCompatible } = this.threadContext;
    if (topicCompatible) {
      const { type, supportType, topicId } = this.threadContext;
      if (typeof type !== 'number') {
        throw new Error('Invalid topic context type');
      }

      if (typeof supportType !== 'number') {
        throw new Error('Invalid topic context supportType');
      }

      if (typeof topicId !== 'string') {
        throw new Error('Invalid topic context topicId');
      }
    } else {
      if (!threadCompatible) {
        // neither thread nor topic compatbile
        throw new Error('Invalid neither topic nor thread context compatible');
      } else {
        // only compatible for thread
      }
    }
  }

  if (this.reaction) {
    const { source, sourceDevice, timestamp } = this.reaction.source || {};
    if (!source || typeof source !== 'string') {
      throw new Error('Invalid reaction source source');
    }

    if (typeof timestamp != 'number') {
      throw new Error('Invalid reaction source timestamp');
    }

    if (typeof sourceDevice != 'number') {
      throw new Error('Invalid reaction source sourceDevice');
    }

    if (typeof this.reaction.emoji !== 'string') {
      throw new Error('Invalid reaction emoji');
    }
  }

  if (this.isEndSession()) {
    if (
      this.body !== null ||
      this.group !== null ||
      this.attachments.length !== 0
    ) {
      throw new Error('Invalid end session message');
    }
  } else {
    if (
      typeof this.timestamp !== 'number' ||
      (this.body && typeof this.body !== 'string')
    ) {
      throw new Error('Invalid message body');
    }
    if (this.group) {
      if (
        typeof this.group.id !== 'string' ||
        typeof this.group.type !== 'number'
      ) {
        throw new Error('Invalid group context');
      }
    }
  }
}

Message.prototype = {
  constructor: Message,
  isEndSession() {
    return this.flags & textsecure.protobuf.DataMessage.Flags.END_SESSION;
  },
  toProto() {
    if (this.dataMessage instanceof textsecure.protobuf.DataMessage) {
      return this.dataMessage;
    }
    const proto = new textsecure.protobuf.DataMessage();

    const updateRequiredProtocalVersion = requiredVersion => {
      if (
        !proto.requiredProtocolVersion ||
        proto.requiredProtocolVersion < requiredVersion
      ) {
        proto.requiredProtocolVersion = requiredVersion;
      }
    };

    const assignRealSource = sourceObject => {
      const realSource = new textsecure.protobuf.DataMessage.RealSource();

      const {
        source,
        sourceDevice,
        timestamp,
        serverTimestamp,
        sequenceId,
        notifySequenceId,
      } = sourceObject;

      // source should be always exists
      realSource.source = source;

      if (sourceDevice) {
        realSource.sourceDevice = sourceDevice;
      }

      if (timestamp) {
        realSource.timestamp = timestamp;
      }

      if (serverTimestamp) {
        realSource.serverTimestamp = serverTimestamp;
      }

      if (sequenceId) {
        realSource.sequenceId = sequenceId;
      }

      if (notifySequenceId) {
        realSource.notifySequenceId = notifySequenceId;
      }

      return realSource;
    };

    // 此字段未知原因，之前一直没有赋值，今天就修复这个问题
    // if (this.timestamp) {
    //   proto.timestamp = this.timestamp;
    // }

    if (this.body) {
      proto.body = this.body;
    }

    if (this.atPersons && this.atPersons.length > 0) {
      proto.atPersons = this.atPersons;
    }

    let rapidFiles = [];

    if (this.attachmentPointers && this.attachmentPointers.length > 0) {
      proto.attachments = this.attachmentPointers;
      rapidFiles = this.attachments.map(attachment =>
        _.pick(attachment, ['rapidHash', 'authorizeId'])
      );
    }

    if (this.flags) {
      proto.flags = this.flags;
    }

    if (this.group) {
      proto.group = new textsecure.protobuf.GroupContext();
      proto.group.id = stringToArrayBuffer(this.group.id);
      proto.group.type = this.group.type;
    }

    if (this.quote) {
      const { QuotedAttachment } = textsecure.protobuf.DataMessage.Quote;
      const { Quote } = textsecure.protobuf.DataMessage;

      proto.quote = new Quote();
      const { quote } = proto;

      quote.id = this.quote.id;
      quote.author = this.quote.author;
      quote.text = this.quote.text;
      quote.attachments = (this.quote.attachments || []).map(attachment => {
        const quotedAttachment = new QuotedAttachment();

        quotedAttachment.contentType = attachment.contentType;
        quotedAttachment.fileName = attachment.fileName;
        if (attachment.attachmentPointer) {
          quotedAttachment.thumbnail = attachment.attachmentPointer;
        }

        return quotedAttachment;
      });
    }

    if (this.expireTimer) {
      proto.expireTimer = this.expireTimer;
    }

    if (this.profileKey) {
      proto.profileKey = this.profileKey;
    }

    if (this.forwardContext) {
      const { Forward, ForwardContext } = textsecure.protobuf.DataMessage;

      const assignForwards = (forwards, depth, maxDepth) => {
        if (!forwards || forwards.length < 1) {
          return null;
        }

        depth = depth || 1;
        maxDepth = maxDepth || textsecure.MAX_FORWARD_DEPTH;
        if (depth > maxDepth || depth < 1) {
          return null;
        }

        return forwards.map(forward => {
          let newForward = new Forward();

          if (forward.id) {
            newForward.id = forward.id;
          }

          if (forward.type) {
            newForward.type = forward.type;
          }

          if (forward.author) {
            newForward.author = forward.author;
          }

          if (forward.body) {
            newForward.body = forward.body;
          }

          if (forward.card) {
            newForward.card = forward.card;
          }

          if (forward.isFromGroup) {
            newForward.isFromGroup = forward.isFromGroup;
          }

          const { attachmentPointers } = forward;
          if (attachmentPointers && attachmentPointers.length > 0) {
            newForward.attachments = attachmentPointers;
            rapidFiles = rapidFiles.concat(
              forward.attachments.map(attachment =>
                _.pick(attachment, ['rapidHash', 'authorizeId'])
              )
            );
          }

          const { mentions } = forward;
          if (mentions && mentions.length > 0) {
            newForward.mentions = mentions;
          }

          const nextForwards = assignForwards(
            forward.forwards,
            depth,
            maxDepth
          );
          if (nextForwards && nextForwards.length > 0) {
            newForward.forwards = nextForwards;
          }

          return newForward;
        });
      };

      proto.forwardContext = new ForwardContext();

      updateRequiredProtocalVersion(
        textsecure.protobuf.DataMessage.ProtocolVersion.FORWARD
      );

      const { forwards } = this.forwardContext;
      if (forwards && forwards.length > 0) {
        proto.forwardContext.forwards = assignForwards(forwards);
      }

      if (rapidFiles && rapidFiles.length > 0) {
        const RapidFile = textsecure.protobuf.RapidFile;
        proto.forwardContext.rapidFiles = rapidFiles.map(rapidFile => {
          let newRapidFile = new RapidFile();
          if (rapidFile.rapidHash) {
            newRapidFile.rapidHash = rapidFile.rapidHash;
          }

          if (rapidFile.authorizeId) {
            newRapidFile.authorizeId = rapidFile.authorizeId;
          }

          return newRapidFile;
        });
      }
    }

    if (this.contacts && this.contacts.length > 0) {
      const { Contact } = textsecure.protobuf.DataMessage;
      const { Name, Phone } = Contact;

      proto.contacts = this.contacts.map(contact => {
        const { name, number } = contact;

        let protoContact = new Contact();
        if (name) {
          protoContact.name = new Name({ displayName: name });
        }

        if (number) {
          protoContact.number = new Phone({ value: number, type: 3 });
        }

        return protoContact;
      });

      updateRequiredProtocalVersion(
        textsecure.protobuf.DataMessage.ProtocolVersion.CONTACT
      );
    }

    if (this.recall && this.recall.realSource) {
      const recall = new textsecure.protobuf.DataMessage.Recall();

      recall.realSource = assignRealSource(this.recall.realSource);
      proto.recall = recall;

      updateRequiredProtocalVersion(
        textsecure.protobuf.DataMessage.ProtocolVersion.RECALL
      );
    }

    if (this.task) {
      const { Task } = textsecure.protobuf.DataMessage;
      const task = new Task();
      task.taskId = this.task.taskId || null;
      task.version = this.task.version || null;
      task.creator = this.task.creator || null;
      task.timestamp = this.task.timestamp || null;
      task.name = this.task.name || null;
      task.notes = this.task.notes || null;
      task.assignees = this.task.assignees || null;
      task.dueTime = this.task.dueTime || null;
      task.priority = this.task.priority || null;
      task.followers = this.task.followers || null;
      task.status = this.task.status || null;

      proto.task = task;
      updateRequiredProtocalVersion(
        textsecure.protobuf.DataMessage.ProtocolVersion.TASK
      );
    }

    if (this.vote) {
      const { Vote } = textsecure.protobuf.DataMessage;
      const vote = new Vote();
      vote.voteId = this.vote.voteId || null;
      vote.version = this.vote.version || null;
      vote.creator = this.vote.creator || null;
      vote.name = this.vote.name || null;
      vote.multiple = !!this.vote.multiple;
      vote.dueTime = this.vote.dueTime || null;
      vote.status = this.vote.status || null;
      vote.options = this.vote.options || null;
      vote.anonymous = this.vote.anonymous === 2 ? 2 : 1;

      proto.vote = vote;
      updateRequiredProtocalVersion(
        textsecure.protobuf.DataMessage.ProtocolVersion.VOTE
      );
    }

    if (this.card) {
      const { Card } = textsecure.protobuf.DataMessage;
      const card = new Card();
      card.appId = this.card.appId || null;
      card.cardId = this.card.cardId || null;
      card.version = this.card.version || null;
      card.creator = this.card.creator || null;
      card.timestamp = this.card.timestamp || null;
      card.content = this.card.content || null;
      card.contentType = this.card.contentType || null;
      card.type = this.card.type || null;
      proto.card = card;
      updateRequiredProtocalVersion(
        textsecure.protobuf.DataMessage.ProtocolVersion.CARD
      );
    }

    if (this.mentions && Array.isArray(this.mentions) && this.mentions.length) {
      const { Mention } = textsecure.protobuf.DataMessage;
      proto.mentions = this.mentions.map(mention => {
        const { start, length, uid, type } = mention;
        const protoMention = new Mention();
        protoMention.start = start;
        protoMention.length = length;
        protoMention.uid = uid;
        protoMention.type = type;
        return protoMention;
      });
    }

    if (this.threadContext) {
      const {
        source,
        botId,
        replyToUser,
        groupId,
        // compatible,
        topicCompatible,
        threadCompatible,
        type,
        topicId,
        supportType,
        sourceBrief,
        // sendAll,
        sourceDisplayName,
        groupName,
      } = this.threadContext;

      const context = {};

      context.source = assignRealSource(source);
      context.botId = botId;
      context.replyToUser = !!replyToUser;

      if (typeof groupId === 'string' && groupId) {
        context.groupId = stringToArrayBuffer(groupId);
      }

      // if compatible is set for this.threadContext
      // should send proto ThreadContext for compatible
      //compatible && !sendAll
      // compatible for old thread
      if (threadCompatible) {
        const { ThreadContext } = textsecure.protobuf.DataMessage;
        proto.threadContext = new ThreadContext(context);
      }
      // compatible for new topic
      if (topicCompatible) {
        context.type = type;
        context.topicId = topicId;
        context.supportType = supportType;
        context.sourceBrief = sourceBrief || null;
        context.sourceDisplayName = sourceDisplayName || null;
        context.groupName = groupName || null;
        const { TopicContext } = textsecure.protobuf.DataMessage;
        proto.topicContext = new TopicContext(context);
      }
    }

    if (this.reaction && this.reaction.source) {
      const reaction = new textsecure.protobuf.DataMessage.Reaction();

      reaction.source = assignRealSource(this.reaction.source);
      reaction.emoji = this.reaction.emoji;
      reaction.remove = !!this.reaction.remove;

      proto.reaction = reaction;

      updateRequiredProtocalVersion(
        textsecure.protobuf.DataMessage.ProtocolVersion.REACTION
      );
    }

    proto.messageMode = this.messageMode || textsecure.protobuf.Mode.NORMAL;

    this.rapidFiles = rapidFiles;
    this.dataMessage = proto;

    return proto;
  },
  toArrayBuffer() {
    return this.toProto().toArrayBuffer();
  },
};

function MessageSender(username, password) {
  this.server = WebAPI.connect({ username, password });
  this.pendingMessages = {};
}

MessageSender.prototype = {
  constructor: MessageSender,

  //  makeAttachmentPointer :: Attachment -> Promise AttachmentPointerProto
  makeAttachmentPointer(attachment, numbers) {
    if (typeof attachment !== 'object' || attachment == null) {
      return Promise.resolve(undefined);
    }

    const { data, rapidKey, rapidSize } = attachment;
    if (!(data instanceof ArrayBuffer) && !ArrayBuffer.isView(data)) {
      return Promise.reject(
        new TypeError(
          `\`attachment.data\` must be an \`ArrayBuffer\` or \`ArrayBufferView\`; got: ${typeof data}`
        )
      );
    }

    let timestamp;
    let promise;
    if (rapidKey && rapidSize) {
      promise = Promise.resolve(
        dcodeIO.ByteBuffer.wrap(rapidKey, 'base64').toArrayBuffer()
      );
    } else {
      timestamp = Date.now();
      promise = crypto.subtle.digest({ name: 'SHA-512' }, data);
    }

    const fillProtoIfRapid = (result, proto) => {
      const { exists, cipherHash, attachmentId, authorizeId } = result;
      if (exists && cipherHash && attachmentId && authorizeId) {
        log.info('rapid upload success, ', attachmentId, cipherHash);

        proto.id = authorizeId;
        proto.digest = dcodeIO.ByteBuffer.wrap(
          cipherHash,
          'hex'
        ).toArrayBuffer();
        return true;
      }
    };

    return promise.then(async digest => {
      if (timestamp) {
        log.info('calculate digest delta:', Date.now() - timestamp);
      }

      const proto = new textsecure.protobuf.AttachmentPointer();
      proto.key = digest;

      const twiceHash = await crypto.subtle.digest({ name: 'SHA-256' }, digest);
      const rapidHash = dcodeIO.ByteBuffer.wrap(twiceHash).toString('base64');

      const ourNumber = textsecure.storage.user.getNumber();
      numbers = Array.from(new Set([...numbers, ourNumber]));

      const rapidResult = await this.server.rapidUpload(rapidHash, numbers);

      if (!fillProtoIfRapid(rapidResult, proto)) {
        const { attachmentId, url: ossUrl } = rapidResult;
        if (!attachmentId || !ossUrl) {
          // upload failed.
          log.error('rapid upload error for response is invalid.');
          throw new Error('rapid upload server response invalid result.');
        }

        // verify local saved file when rapid upload failed.
        if (rapidKey && rapidSize) {
          log.warn(
            'forward attachments, but rapid upload failed, try to upload it.'
          );

          const dataHash = await crypto.subtle.digest(
            { name: 'SHA-512' },
            data
          );
          const dataHashB64 =
            dcodeIO.ByteBuffer.wrap(dataHash).toString('base64');

          if (rapidKey != dataHashB64 || data.byteLength != rapidSize) {
            log.error('local saved file changed before forwarding.');
            throw new Error('file changed before forwarding');
          }
        }

        // encrypt
        const encryptData = await textsecure.crypto.encryptAttachment(
          attachment.data,
          proto.key,
          libsignal.crypto.getRandomBytes(16)
        );

        timestamp = Date.now();

        const digestHexUpper = dcodeIO.ByteBuffer.wrap(encryptData.digest)
          .toString('hex')
          .toUpperCase();

        // upload
        const putResult = await this.server.putAttachmentNew(
          encryptData.ciphertext,
          digestHexUpper,
          attachment.data.byteLength,
          ossUrl,
          attachmentId,
          rapidHash,
          numbers
        );

        log.info(
          'upload:',
          putResult.exists,
          attachmentId,
          ' delta:',
          Date.now() - timestamp
        );

        if (!fillProtoIfRapid(putResult, proto)) {
          const { authorizeId } = putResult;
          if (!authorizeId) {
            log.error('authorizeId not found in server result.');
            throw new Error('Server response invalid data.');
          }

          proto.id = authorizeId;
          proto.digest = encryptData.digest;
        }
      }

      attachment.rapidHash = rapidHash;
      attachment.authorizeId = proto.id;

      proto.contentType = attachment.contentType;

      if (rapidKey && rapidSize) {
        proto.size = rapidSize;
      } else if (attachment.size) {
        proto.size = attachment.size;
      } else {
        log.error('There is no field size in attachment:', rapidHash);
        throw new Error('attachment has no size.');
      }

      if (attachment.fileName) {
        proto.fileName = attachment.fileName;
      }
      if (attachment.flags) {
        proto.flags = attachment.flags;
      }
      if (attachment.width) {
        proto.width = attachment.width;
      }
      if (attachment.height) {
        proto.height = attachment.height;
      }
      if (attachment.caption) {
        proto.caption = attachment.caption;
      }

      return proto;
    });
  },

  queueJobForNumber(number, runJob) {
    const taskWithTimeout = textsecure.createTaskWithTimeout(
      runJob,
      `queueJobForNumber ${number}`
    );

    const runPrevious = this.pendingMessages[number] || Promise.resolve();
    this.pendingMessages[number] = runPrevious.then(
      taskWithTimeout,
      taskWithTimeout
    );

    const runCurrent = this.pendingMessages[number];
    runCurrent.then(() => {
      if (this.pendingMessages[number] === runCurrent) {
        delete this.pendingMessages[number];
      }
    });
  },

  uploadObjectAttachments(object, recipients) {
    const makePointer = this.makeAttachmentPointer.bind(this);
    const { attachments } = object;

    if (!attachments || attachments.length < 1) {
      return Promise.resolve();
    }

    return Promise.all(
      attachments.map(attachment => makePointer(attachment, recipients))
    ).then(pointers => (object.attachmentPointers = pointers));
  },

  uploadForwardsAttachments(forwards, recipients, depth, maxDepth) {
    if (!forwards || forwards.length < 1) {
      return Promise.resolve();
    }

    depth = depth || 1;
    maxDepth = maxDepth || textsecure.MAX_FORWARD_DEPTH;
    if (depth > maxDepth || depth < 1) {
      return Promise.resolve();
    }
    depth++;

    return Promise.all(
      forwards.map(forward =>
        this.uploadObjectAttachments(forward, recipients).then(() =>
          this.uploadForwardsAttachments(
            forward.forwards || [],
            recipients,
            depth,
            maxDepth
          )
        )
      )
    );
  },

  uploadAttachments(message) {
    const { recipients, forwardContext } = message;
    const { forwards } = forwardContext || {};

    return this.uploadObjectAttachments(message, recipients)
      .then(() => this.uploadForwardsAttachments(forwards || [], recipients))
      .catch(error => {
        if (error instanceof Error && error.name === 'HTTPError') {
          throw new textsecure.MessageError(message, error);
        } else {
          throw error;
        }
      });
  },

  uploadThumbnails(message) {
    const makePointer = this.makeAttachmentPointer.bind(this);
    const { quote } = message;

    if (!quote || !quote.attachments || quote.attachments.length === 0) {
      return Promise.resolve();
    }

    return Promise.all(
      quote.attachments.map(attachment => {
        const { thumbnail } = attachment;
        if (!thumbnail) {
          return null;
        }

        return makePointer(thumbnail, message.recipients).then(pointer => {
          // eslint-disable-next-line no-param-reassign
          attachment.attachmentPointer = pointer;
        });
      })
    ).catch(error => {
      if (error instanceof Error && error.name === 'HTTPError') {
        throw new textsecure.MessageError(message, error);
      } else {
        throw error;
      }
    });
  },

  deleteFileAuthorization(message) {
    const { target } = message.recall || {};
    if (target) {
      const { rapidFiles } = target;
      if (rapidFiles instanceof Array && rapidFiles.length > 0) {
        let filesMap = {};
        rapidFiles.forEach(file => {
          const { rapidHash, authorizeId } = file;
          if (filesMap[rapidHash]) {
            filesMap[rapidHash].push(authorizeId);
          } else {
            filesMap[rapidHash] = [authorizeId];
          }
        });

        const combinedFiles = Object.keys(filesMap).map(key => ({
          fileHash: key,
          authorizeIds: _.uniq(filesMap[key]),
        }));

        return this.server.deleteAuthorization(combinedFiles);
      }
    }

    return Promise.resolve();
  },

  sendMessage(attrs, extension) {
    const message = new Message(attrs);
    const silent = false;

    let promise;

    if (message.recall) {
      promise = this.deleteFileAuthorization(message);
    } else {
      promise = Promise.all([
        this.uploadAttachments(message),
        this.uploadThumbnails(message),
      ]);
    }

    return promise.then(
      () =>
        new Promise((resolve, reject) => {
          this.sendMessageProto(
            message.timestamp,
            message.recipients,
            message.toProto(),
            res => {
              res.rapidFiles = message.rapidFiles;
              res.dataMessage = message.toArrayBuffer();
              if (res.errors.length > 0) {
                reject(res);
              } else {
                resolve(res);
              }
            },
            silent,
            extension
          );
        })
    );
  },

  sendMessageProtoNoSilent(message, extension) {
    if (message.group && message.recipients.length === 0) {
      return Promise.resolve({
        successfulNumbers: [],
        failoverNumbers: [],
        errors: [],
        rapidFiles: message.rapidFiles,
        dataMessage: message.toArrayBuffer(),
      });
    }

    return new Promise((resolve, reject) => {
      const silent = false;

      this.sendMessageProto(
        message.timestamp,
        message.recipients,
        message.toProto(),
        res => {
          res.rapidFiles = message.rapidFiles;
          res.dataMessage = message.toArrayBuffer();
          if (res.errors.length > 0) {
            reject(res);
          } else {
            resolve(res);
          }
        },
        silent,
        extension
      );
    });
  },

  sendExpirationMessage(attrs) {
    const message = new Message(attrs);
    const silent = true;

    return Promise.all([
      this.uploadAttachments(message),
      this.uploadThumbnails(message),
    ]).then(
      () =>
        new Promise((resolve, reject) => {
          this.sendMessageProto(
            message.timestamp,
            message.recipients,
            message.toProto(),
            res => {
              res.dataMessage = message.toArrayBuffer();
              if (res.errors.length > 0) {
                reject(res);
              } else {
                resolve(res);
              }
            },
            silent
          );
        })
    );
  },

  sendMessageProto(timestamp, numbers, message, callback, silent, extension) {
    const { isLargeGroup, tunnelSecurityForced } = extension || {};

    // large group message sending
    if (isLargeGroup) {
      const outgoing = new OutgoingMessage(
        this.server,
        timestamp,
        numbers,
        message,
        silent,
        callback,
        extension
      );

      outgoing.sendToGroup();
      return;
    }

    if (!tunnelSecurityForced) {
      const rejections = textsecure.storage.get('signedKeyRotationRejected', 0);
      if (rejections > 5) {
        throw new textsecure.SignedPreKeyRotationError(
          numbers,
          message.toArrayBuffer(),
          timestamp
        );
      }
    }

    const outgoing = new OutgoingMessage(
      this.server,
      timestamp,
      numbers,
      message,
      silent,
      callback,
      extension
    );

    const sendToNumber = outgoing.sendToNumberV3.bind(outgoing);
    numbers.forEach(number => {
      this.queueJobForNumber(number, () => sendToNumber(number));
    });
  },

  sendMessageProtoAndWait(timestamp, numbers, message, silent) {
    return new Promise((resolve, reject) => {
      const callback = result => {
        if (result && result.errors && result.errors.length > 0) {
          return reject(result);
        }

        return resolve(result);
      };

      this.sendMessageProto(timestamp, numbers, message, callback, silent);
    });
  },

  sendIndividualProto(number, proto, timestamp, silent, extension) {
    return new Promise((resolve, reject) => {
      const callback = res => {
        if (res && res.errors && res.errors.length > 0) {
          reject(res);
        } else {
          resolve(res);
        }
      };
      this.sendMessageProto(
        timestamp,
        [number],
        proto,
        callback,
        silent,
        _.pick(extension || {}, [
          'tunnelSecurityEnds',
          'tunnelSecurityForced',
          'isPrivate',
          'conversationId',
        ])
      );
    });
  },

  createSyncMessage() {
    const syncMessage = new textsecure.protobuf.SyncMessage();

    // Generate a random int from 1 and 512
    const buffer = libsignal.crypto.getRandomBytes(1);
    const paddingLength = (new Uint8Array(buffer)[0] & 0x1ff) + 1;

    // Generate a random padding buffer of the chosen size
    syncMessage.padding = libsignal.crypto.getRandomBytes(paddingLength);

    return syncMessage;
  },

  sendSyncMessage(
    encodedDataMessage,
    timestamp,
    destination,
    expirationStartTimestamp,
    rapidFiles,
    extension,
    serverTimestamp,
    sequenceId,
    notifySequenceId
  ) {
    const myNumber = textsecure.storage.user.getNumber();
    const myDevice = textsecure.storage.user.getDeviceId();

    const { conversationId } = extension || {};

    if ((myDevice === 1 || myDevice === '1') && myNumber !== conversationId) {
      return Promise.resolve();
    }

    const dataMessage =
      textsecure.protobuf.DataMessage.decode(encodedDataMessage);
    const sentMessage = new textsecure.protobuf.SyncMessage.Sent();
    sentMessage.timestamp = timestamp;
    sentMessage.message = dataMessage;
    if (destination) {
      sentMessage.destination = destination;
    }
    if (expirationStartTimestamp) {
      sentMessage.expirationStartTimestamp = expirationStartTimestamp;
    }

    if (rapidFiles instanceof Array && rapidFiles.length > 0) {
      const RapidFile = textsecure.protobuf.RapidFile;
      sentMessage.rapidFiles = rapidFiles.map(r => {
        let rapidFile = new RapidFile();
        rapidFile.rapidHash = r.rapidHash;
        rapidFile.authorizeId = r.authorizeId;
        return rapidFile;
      });
    }

    if (serverTimestamp) {
      sentMessage.serverTimestamp = serverTimestamp;
    }

    if (sequenceId) {
      sentMessage.sequenceId = sequenceId;
    }

    if (notifySequenceId) {
      sentMessage.notifySequenceId = notifySequenceId;
    }

    const syncMessage = this.createSyncMessage();
    syncMessage.sent = sentMessage;
    const contentMessage = new textsecure.protobuf.Content();
    contentMessage.syncMessage = syncMessage;

    window.log.info(`syncing conversation ${destination} message ${timestamp}`);

    const silent = true;
    return this.sendIndividualProto(
      myNumber,
      contentMessage,
      timestamp,
      silent,
      extension
    );
  },

  async getProfile(number) {
    return this.server.getProfile(number);
  },

  getAvatar(path) {
    return this.server.getAvatar(path);
  },

  sendRequestConfigurationSyncMessage() {
    const myNumber = textsecure.storage.user.getNumber();
    const myDevice = textsecure.storage.user.getDeviceId();
    if (myDevice !== 1 && myDevice !== '1') {
      const request = new textsecure.protobuf.SyncMessage.Request();
      request.type = textsecure.protobuf.SyncMessage.Request.Type.CONFIGURATION;
      const syncMessage = this.createSyncMessage();
      syncMessage.request = request;
      const contentMessage = new textsecure.protobuf.Content();
      contentMessage.syncMessage = syncMessage;

      const silent = true;
      return this.sendIndividualProto(
        myNumber,
        contentMessage,
        Date.now(),
        silent
      );
    }

    return Promise.resolve();
  },

  sendRequestGroupSyncMessage() {
    const myNumber = textsecure.storage.user.getNumber();
    const myDevice = textsecure.storage.user.getDeviceId();
    if (myDevice !== 1 && myDevice !== '1') {
      const request = new textsecure.protobuf.SyncMessage.Request();
      request.type = textsecure.protobuf.SyncMessage.Request.Type.GROUPS;
      const syncMessage = this.createSyncMessage();
      syncMessage.request = request;
      const contentMessage = new textsecure.protobuf.Content();
      contentMessage.syncMessage = syncMessage;

      const silent = true;
      return this.sendIndividualProto(
        myNumber,
        contentMessage,
        Date.now(),
        silent
      );
    }

    return Promise.resolve();
  },

  sendRequestContactSyncMessage() {
    const myNumber = textsecure.storage.user.getNumber();
    const myDevice = textsecure.storage.user.getDeviceId();
    if (myDevice !== 1 && myDevice !== '1') {
      const request = new textsecure.protobuf.SyncMessage.Request();
      request.type = textsecure.protobuf.SyncMessage.Request.Type.CONTACTS;
      const syncMessage = this.createSyncMessage();
      syncMessage.request = request;
      const contentMessage = new textsecure.protobuf.Content();
      contentMessage.syncMessage = syncMessage;

      const silent = true;
      return this.sendIndividualProto(
        myNumber,
        contentMessage,
        Date.now(),
        silent
      );
    }

    return Promise.resolve();
  },

  async sendTypingMessage(options = {}) {
    const ACTION_ENUM = textsecure.protobuf.TypingMessage.Action;
    const { recipientId, groupId, groupNumbers, isTyping, timestamp } = options;

    // We don't want to send typing messages to our other devices, but we will
    //   in the group case.
    const myNumber = textsecure.storage.user.getNumber();
    if (recipientId && myNumber === recipientId) {
      return null;
    }

    if (!recipientId && !groupId) {
      throw new Error('Need to provide either recipientId or groupId!');
    }

    const recipients = groupId
      ? _.without(groupNumbers, myNumber)
      : [recipientId];
    const groupIdBuffer = groupId
      ? window.Signal.Crypto.fromEncodedBinaryToArrayBuffer(groupId)
      : null;

    const action = isTyping ? ACTION_ENUM.STARTED : ACTION_ENUM.STOPPED;
    const finalTimestamp = timestamp || Date.now();

    const typingMessage = new textsecure.protobuf.TypingMessage();
    typingMessage.groupId = groupIdBuffer;
    typingMessage.action = action;
    typingMessage.timestamp = finalTimestamp;

    const contentMessage = new textsecure.protobuf.Content();
    contentMessage.typingMessage = typingMessage;

    const silent = true;
    const online = true;

    return this.sendMessageProtoAndWait(
      finalTimestamp,
      recipients,
      contentMessage,
      silent
    );
  },

  sendDeliveryReceipt(recipientId, timestamp) {
    const myNumber = textsecure.storage.user.getNumber();
    const myDevice = textsecure.storage.user.getDeviceId();
    if (myNumber === recipientId && (myDevice === 1 || myDevice === '1')) {
      return Promise.resolve();
    }

    const receiptMessage = new textsecure.protobuf.ReceiptMessage();
    receiptMessage.type = textsecure.protobuf.ReceiptMessage.Type.DELIVERY;
    receiptMessage.timestamp = [timestamp];

    const contentMessage = new textsecure.protobuf.Content();
    contentMessage.receiptMessage = receiptMessage;

    const silent = true;
    return this.sendIndividualProto(
      recipientId,
      contentMessage,
      Date.now(),
      silent
    );
  },

  sendReadReceipts(receipts, extension) {
    const { sender, timestamps, readPosition, messageMode } = receipts;

    const receiptMessage = new textsecure.protobuf.ReceiptMessage();
    receiptMessage.type = textsecure.protobuf.ReceiptMessage.Type.READ;
    receiptMessage.timestamp = timestamps;

    if (messageMode) {
      receiptMessage.messageMode = messageMode;
    }

    if (readPosition) {
      const { groupId, readAt, maxServerTimestamp, maxNotifySequenceId } =
        readPosition;

      const position = new textsecure.protobuf.ReadPosition();
      position.readAt = readAt;
      position.maxServerTimestamp = maxServerTimestamp;

      if (maxNotifySequenceId) {
        position.maxNotifySequenceId = maxNotifySequenceId;
      }

      if (groupId) {
        position.groupId = stringToArrayBuffer(groupId);
      }

      receiptMessage.readPosition = position;
    }

    const contentMessage = new textsecure.protobuf.Content();
    contentMessage.receiptMessage = receiptMessage;

    const silent = true;
    return this.sendIndividualProto(
      sender,
      contentMessage,
      Date.now(),
      silent,
      extension
    );
  },
  syncReadMessages(reads, extension) {
    const myNumber = textsecure.storage.user.getNumber();

    const syncMessage = this.createSyncMessage();
    syncMessage.read = [];
    for (let i = 0; i < reads.length; i += 1) {
      const { timestamp, sender, readPosition, messageMode } = reads[i];
      if (!timestamp || !sender) {
        window.log.warn('invalid read', reads[i]);
        continue;
      }

      const read = new textsecure.protobuf.SyncMessage.Read();

      read.timestamp = timestamp;
      read.sender = sender;

      if (messageMode) {
        read.messageMode = messageMode;
      }

      if (readPosition) {
        const {
          groupId,
          readAt = 0,
          maxServerTimestamp,
          maxNotifySequenceId,
        } = readPosition;

        const position = new textsecure.protobuf.ReadPosition();
        position.readAt = readAt;
        position.maxServerTimestamp = maxServerTimestamp;

        if (maxNotifySequenceId) {
          position.maxNotifySequenceId = maxNotifySequenceId;
        }

        if (groupId) {
          position.groupId = stringToArrayBuffer(groupId);
        }

        read.readPosition = position;
      }

      syncMessage.read.push(read);
    }

    if (!syncMessage.read.length) {
      return Promise.reject('empty valid reads');
    }

    const contentMessage = new textsecure.protobuf.Content();
    contentMessage.syncMessage = syncMessage;

    const silent = true;
    return this.sendIndividualProto(
      myNumber,
      contentMessage,
      Date.now(),
      silent,
      extension
    );
  },
  syncMarkAsReadOrUnread(number, groupId, flag, extension) {
    const myNumber = textsecure.storage.user.getNumber();
    // const myDevice = textsecure.storage.user.getDeviceId();

    // do not check deviceId here
    // we will use the serverTimestamp from server
    if (!number && !groupId) {
      throw new Error('number or groupId can not be both null');
    }

    const conversationId = new textsecure.protobuf.ConversationId();
    if (groupId) {
      conversationId.groupId = stringToArrayBuffer(groupId);
    } else {
      conversationId.number = number;
    }

    const markAsUnread = new textsecure.protobuf.SyncMessage.MarkAsUnread();
    markAsUnread.conversationId = conversationId;

    // unread flag: //0: 清除设定的未读状态 1、置未读  2、置全部已读
    markAsUnread.flag = flag;

    const syncMessage = this.createSyncMessage();
    syncMessage.markAsUnread = markAsUnread;

    const contentMessage = new textsecure.protobuf.Content();
    contentMessage.syncMessage = syncMessage;

    const silent = true;
    return this.sendIndividualProto(
      myNumber,
      contentMessage,
      Date.now(),
      silent,
      extension
    );
  },
  syncConversationArchive(number, groupId, flag, extension) {
    const myNumber = textsecure.storage.user.getNumber();
    if (!number && !groupId) {
      throw new Error('number or groupId can not be both null');
    }

    const conversationId = new textsecure.protobuf.ConversationId();
    if (groupId) {
      conversationId.groupId = stringToArrayBuffer(groupId);
    } else {
      conversationId.number = number;
    }

    const conversationArchive =
      new textsecure.protobuf.SyncMessage.ConversationArchive();
    conversationArchive.conversationId = conversationId;
    // 0: 解档  1:归档
    conversationArchive.flag = flag;

    const syncMessage = this.createSyncMessage();
    syncMessage.conversationArchive = conversationArchive;

    const contentMessage = new textsecure.protobuf.Content();
    contentMessage.syncMessage = syncMessage;

    const silent = true;
    return this.sendIndividualProto(
      myNumber,
      contentMessage,
      Date.now(),
      silent,
      extension
    );
  },

  syncVerification(destination, state, identityKey) {
    const myNumber = textsecure.storage.user.getNumber();
    const myDevice = textsecure.storage.user.getDeviceId();
    const now = Date.now();

    if (myDevice === 1 || myDevice === '1') {
      return Promise.resolve();
    }

    // First send a null message to mask the sync message.
    const nullMessage = new textsecure.protobuf.NullMessage();

    // Generate a random int from 1 and 512
    const buffer = libsignal.crypto.getRandomBytes(1);
    const paddingLength = (new Uint8Array(buffer)[0] & 0x1ff) + 1;

    // Generate a random padding buffer of the chosen size
    nullMessage.padding = libsignal.crypto.getRandomBytes(paddingLength);

    const contentMessage = new textsecure.protobuf.Content();
    contentMessage.nullMessage = nullMessage;

    // We want the NullMessage to look like a normal outgoing message; not silent
    const silent = true;
    const promise = this.sendIndividualProto(
      destination,
      contentMessage,
      now,
      silent
    );

    return promise.then(() => {
      const verified = new textsecure.protobuf.Verified();
      verified.state = state;
      verified.destination = destination;
      verified.identityKey = identityKey;
      verified.nullMessage = nullMessage.padding;

      const syncMessage = this.createSyncMessage();
      syncMessage.verified = verified;

      const secondMessage = new textsecure.protobuf.Content();
      secondMessage.syncMessage = syncMessage;

      const innerSilent = true;
      return this.sendIndividualProto(
        myNumber,
        secondMessage,
        now,
        innerSilent
      );
    });
  },

  syncTaskRead(taskReads, extension) {
    const myNumber = textsecure.storage.user.getNumber();
    const myDevice = textsecure.storage.user.getDeviceId();
    if (myDevice !== 1 && myDevice !== '1') {
      const syncMessage = this.createSyncMessage();
      syncMessage.tasks = [];
      for (let i = 0; i < taskReads.length; i += 1) {
        const task = new textsecure.protobuf.SyncMessage.Task();

        task.type = textsecure.protobuf.SyncMessage.Task.Type.READ;
        task.taskId = taskReads[i].taskId;
        task.version = taskReads[i].version;
        task.timestamp = taskReads[i].timestamp;

        syncMessage.tasks.push(task);
      }
      const contentMessage = new textsecure.protobuf.Content();
      contentMessage.syncMessage = syncMessage;

      const silent = true;
      return this.sendIndividualProto(
        myNumber,
        contentMessage,
        Date.now(),
        silent,
        extension
      );
    }

    return Promise.resolve();
  },

  syncNullMessage(extension) {
    const myNumber = textsecure.storage.user.getNumber();
    const now = Date.now();

    const syncMessage = this.createSyncMessage();
    const contentMessage = new textsecure.protobuf.Content();
    contentMessage.syncMessage = syncMessage;

    const silent = true;
    return this.sendIndividualProto(
      myNumber,
      contentMessage,
      now,
      silent,
      extension
    );
  },

  sendGroupProto(providedNumbers, proto, timestamp = Date.now()) {
    const me = textsecure.storage.user.getNumber();

    // because ios client do not handle group update sync message,
    // so, we need to send self group update message to take effect.
    const numbers = providedNumbers;
    // const numbers = providedNumbers.filter(number => number !== me);
    if (numbers.length === 0) {
      return Promise.resolve({
        successfulNumbers: [],
        failoverNumbers: [],
        errors: [],
        dataMessage: proto.toArrayBuffer(),
      });
    }

    return new Promise((resolve, reject) => {
      const silent = true;
      const callback = res => {
        res.dataMessage = proto.toArrayBuffer();
        if (res.errors.length > 0) {
          reject(res);
        } else {
          resolve(res);
        }
      };

      this.sendMessageProto(timestamp, numbers, proto, callback, silent);
    });
  },

  async getMessageProto(
    number,
    body,
    mentions,
    attachments,
    quote,
    timestamp,
    expireTimer,
    profileKey,
    flags,
    forwardContext,
    contacts,
    recall,
    task,
    vote,
    card,
    threadContext,
    messageMode,
    reaction
  ) {
    const attributes = {
      recipients: [number],
      body,
      mentions,
      timestamp,
      attachments,
      quote,
      expireTimer,
      profileKey,
      flags,
      forwardContext,
      contacts,
      recall,
      task,
      vote,
      card,
      threadContext,
      reaction,
      messageMode,
    };

    return this.getMessageProtoObject(attributes);
  },

  async getMessageProtoObject(attributes) {
    const message = new Message(attributes);

    if (message.recall) {
      await this.deleteFileAuthorization(message);
    } else {
      await Promise.all([
        this.uploadAttachments(message),
        this.uploadThumbnails(message),
      ]);
    }

    // make proto ready here
    message.toProto();

    return message;
  },

  async getMessageProtoBuffer(attributes) {
    return this.getMessageProtoObject(attributes).then(message =>
      message.toArrayBuffer()
    );
  },

  async getPinMessageProtoBuffer(attributes, pin) {
    // 1. get dataMessage
    const dataMessage = await this.getMessageProtoObject(attributes);

    // 2. get content
    const content = new textsecure.protobuf.Content();
    content.dataMessage = dataMessage.toProto();

    // 3. envelope it
    const envelope = new textsecure.protobuf.Envelope();
    envelope.type = textsecure.protobuf.Envelope.Type.PLAINTEXT;
    envelope.source = pin.source;
    envelope.sourceDevice = pin.sourceDevice;
    envelope.timestamp = pin.timestamp;
    envelope.content = content.toArrayBuffer();
    return envelope.toArrayBuffer();
  },

  async getMessageToNumberProto(
    number,
    body,
    mentions,
    atPersons,
    attachments,
    quote,
    timestamp,
    expireTimer,
    profileKey,
    forwardContext,
    contacts,
    recall,
    task,
    vote,
    card,
    threadContext,
    messageMode
  ) {
    const attributes = {
      recipients: [number],
      body,
      mentions,
      atPersons,
      timestamp,
      attachments,
      quote,
      needsSync: true,
      expireTimer,
      profileKey,
      forwardContext,
      contacts,
      recall,
      task,
      vote,
      card,
      threadContext,
      messageMode,
    };

    return this.getMessageProtoObject(attributes);
  },

  sendMessageToNumber(
    number,
    messageText,
    mentions,
    attachments,
    quote,
    timestamp,
    expireTimer,
    profileKey,
    extension,
    forwardContext,
    contacts,
    recall,
    task,
    vote,
    card,
    threadContext,
    messageMode
  ) {
    return this.sendMessage(
      {
        recipients: [number],
        body: messageText,
        mentions,
        timestamp,
        attachments,
        quote,
        needsSync: true,
        expireTimer,
        profileKey,
        forwardContext,
        contacts,
        recall,
        task,
        vote,
        card,
        threadContext,
        messageMode,
      },
      extension
    );
  },

  resetSession(number, timestamp) {
    window.log.info('resetting secure session');
    const silent = true;
    const proto = new textsecure.protobuf.DataMessage();
    proto.body = 'TERMINATE';
    proto.flags = textsecure.protobuf.DataMessage.Flags.END_SESSION;

    const logError = prefix => error => {
      window.log.error(prefix, error && error.stack ? error.stack : error);
      throw error;
    };
    const deleteAllSessions = targetNumber =>
      textsecure.storage.protocol.getDeviceIds(targetNumber).then(deviceIds =>
        Promise.all(
          deviceIds.map(deviceId => {
            const address = new libsignal.SignalProtocolAddress(
              targetNumber,
              deviceId
            );
            window.log.info('deleting sessions for', address.toString());
            const sessionCipher = new libsignal.SessionCipher(
              textsecure.storage.protocol,
              address
            );
            return sessionCipher.deleteAllSessionsForDevice();
          })
        )
      );

    const sendToContactPromise = deleteAllSessions(number)
      .catch(logError('resetSession/deleteAllSessions1 error:'))
      .then(() => {
        window.log.info(
          'finished closing local sessions, now sending to contact'
        );
        return this.sendIndividualProto(number, proto, timestamp, silent).catch(
          logError('resetSession/sendToContact error:')
        );
      })
      .then(() =>
        deleteAllSessions(number).catch(
          logError('resetSession/deleteAllSessions2 error:')
        )
      );

    const myNumber = textsecure.storage.user.getNumber();
    // We already sent the reset session to our other devices in the code above!
    if (number === myNumber) {
      return sendToContactPromise;
    }

    const buffer = proto.toArrayBuffer();
    const sendSyncPromise = this.sendSyncMessage(
      buffer,
      timestamp,
      number
    ).catch(logError('resetSession/sendSync error:'));

    return Promise.all([sendToContactPromise, sendSyncPromise]);
  },

  async getMessageToGroupProto(
    groupId,
    groupNumbers,
    messageText,
    mentions,
    atPersons,
    attachments,
    quote,
    timestamp,
    expireTimer,
    profileKey,
    forwardContext,
    contacts,
    recall,
    task,
    vote,
    card,
    threadContext,
    messageMode
  ) {
    const me = textsecure.storage.user.getNumber();
    const numbers = groupNumbers.filter(number => number !== me);
    const attrs = {
      recipients: numbers,
      body: messageText,
      mentions,
      atPersons,
      timestamp,
      attachments,
      quote,
      needsSync: true,
      expireTimer,
      profileKey,
      group: {
        id: groupId,
        type: textsecure.protobuf.GroupContext.Type.DELIVER,
      },
      forwardContext,
      contacts,
      recall,
      task,
      vote,
      card,
      threadContext,
      messageMode,
    };

    return this.getMessageProtoObject(attrs);
  },

  // async sendMessageToGroup(
  //   groupId,
  //   groupNumbers,
  //   messageText,
  //   mentions,
  //   atPersons,
  //   attachments,
  //   quote,
  //   timestamp,
  //   expireTimer,
  //   profileKey,
  //   extension,
  //   forwardContext,
  //   contacts
  // ) {
  //   const me = textsecure.storage.user.getNumber();
  //   const numbers = groupNumbers.filter(number => number !== me);
  //   const attrs = {
  //     recipients: numbers,
  //     body: messageText,
  //     mentions,
  //     atPersons,
  //     timestamp,
  //     attachments,
  //     quote,
  //     needsSync: true,
  //     expireTimer,
  //     profileKey,
  //     group: {
  //       id: groupId,
  //       type: textsecure.protobuf.GroupContext.Type.DELIVER,
  //     },
  //     forwardContext,
  //     contacts,
  //   };

  //   if (numbers.length === 0) {
  //     return Promise.resolve({
  //       successfulNumbers: [],
  //       failoverNumbers: [],
  //       errors: [],
  //       dataMessage: await this.getMessageProtoBuffer(attrs),
  //     });
  //   }

  //   return this.sendMessage(attrs, extension);
  // },

  sendReactionMessage(attrs, extension) {
    const message = new Message(attrs);
    const silent = true;

    return new Promise((resolve, reject) => {
      this.sendMessageProto(
        message.timestamp,
        message.recipients,
        message.toProto(),
        res => {
          res.dataMessage = message.toArrayBuffer();
          if (res.errors.length > 0) {
            reject(res);
          } else {
            resolve(res);
          }
        },
        silent,
        extension
      );
    });
  },

  sendReactionToNumber(number, timestamp, reaction, extension) {
    return this.sendReactionMessage(
      {
        recipients: [number],
        timestamp,
        needsSync: true,
        reaction,
      },
      extension
    );
  },

  async sendReactionToGroup(
    groupId,
    groupNumbers,
    timestamp,
    reaction,
    extension
  ) {
    const me = textsecure.storage.user.getNumber();
    const numbers = groupNumbers.filter(number => number !== me);
    const attrs = {
      recipients: numbers,
      timestamp,
      needsSync: true,
      group: {
        id: groupId,
        type: textsecure.protobuf.GroupContext.Type.DELIVER,
      },
      reaction,
    };

    if (numbers.length === 0) {
      return Promise.resolve({
        successfulNumbers: [],
        failoverNumbers: [],
        errors: [],
        dataMessage: await this.getMessageProtoBuffer(attrs),
      });
    }

    return this.sendReactionMessage(attrs, extension);
  },

  createGroup(id, name, targetNumbers, avatar) {
    const proto = new textsecure.protobuf.DataMessage();
    proto.group = new textsecure.protobuf.GroupContext();
    proto.group.id = stringToArrayBuffer(id);

    proto.group.type = textsecure.protobuf.GroupContext.Type.UPDATE;
    proto.group.members = targetNumbers;
    proto.group.name = name;

    if (avatar) {
      return this.makeAttachmentPointer(avatar).then(attachment => {
        proto.group.avatar = attachment;
        return this.sendGroupProto(targetNumbers, proto);
      });
    } else {
      return this.sendGroupProto(targetNumbers, proto);
    }
  },

  updateGroup(groupId, name, members, targetNumbers) {
    const proto = new textsecure.protobuf.DataMessage();
    proto.group = new textsecure.protobuf.GroupContext();

    proto.group.id = stringToArrayBuffer(groupId);
    proto.group.type = textsecure.protobuf.GroupContext.Type.UPDATE;
    proto.group.name = name;
    proto.group.members = members;

    return this.sendGroupProto(targetNumbers, proto);
  },

  addNumberToGroup(groupId, newNumbers) {
    const proto = new textsecure.protobuf.DataMessage();
    proto.group = new textsecure.protobuf.GroupContext();
    proto.group.id = stringToArrayBuffer(groupId);
    proto.group.type = textsecure.protobuf.GroupContext.Type.UPDATE;
    proto.group.members = newNumbers;
    return this.sendGroupProto(newNumbers, proto);
  },

  setGroupName(groupId, name, groupNumbers) {
    const proto = new textsecure.protobuf.DataMessage();
    proto.group = new textsecure.protobuf.GroupContext();
    proto.group.id = stringToArrayBuffer(groupId);
    proto.group.type = textsecure.protobuf.GroupContext.Type.UPDATE;
    proto.group.name = name;
    proto.group.members = groupNumbers;

    return this.sendGroupProto(groupNumbers, proto);
  },

  setGroupAvatar(groupId, avatar, groupNumbers) {
    const proto = new textsecure.protobuf.DataMessage();
    proto.group = new textsecure.protobuf.GroupContext();
    proto.group.id = stringToArrayBuffer(groupId);
    proto.group.type = textsecure.protobuf.GroupContext.Type.UPDATE;
    proto.group.members = groupNumbers;

    return this.makeAttachmentPointer(avatar).then(attachment => {
      proto.group.avatar = attachment;
      return this.sendGroupProto(groupNumbers, proto);
    });
  },

  leaveGroup(groupId, groupNumbers) {
    const proto = new textsecure.protobuf.DataMessage();
    proto.group = new textsecure.protobuf.GroupContext();
    proto.group.id = stringToArrayBuffer(groupId);
    proto.group.type = textsecure.protobuf.GroupContext.Type.QUIT;
    return this.sendGroupProto(groupNumbers, proto);
  },
  // async sendExpirationTimerUpdateToGroup(
  //   groupId,
  //   groupNumbers,
  //   expireTimer,
  //   timestamp,
  //   profileKey
  // ) {
  //   const me = textsecure.storage.user.getNumber();
  //   const numbers = groupNumbers.filter(number => number !== me);
  //   const attrs = {
  //     recipients: numbers,
  //     timestamp,
  //     needsSync: true,
  //     expireTimer,
  //     profileKey,
  //     flags: textsecure.protobuf.DataMessage.Flags.EXPIRATION_TIMER_UPDATE,
  //     group: {
  //       id: groupId,
  //       type: textsecure.protobuf.GroupContext.Type.DELIVER,
  //     },
  //   };

  //   if (numbers.length === 0) {
  //     return Promise.resolve({
  //       successfulNumbers: [],
  //       failoverNumbers: [],
  //       errors: [],
  //       dataMessage: await this.getMessageProtoBuffer(attrs),
  //     });
  //   }

  //   return this.sendExpirationMessage(attrs);
  // },
  // sendExpirationTimerUpdateToNumber(
  //   number,
  //   expireTimer,
  //   timestamp,
  //   profileKey
  // ) {
  //   return this.sendExpirationMessage({
  //     recipients: [number],
  //     timestamp,
  //     needsSync: true,
  //     expireTimer,
  //     profileKey,
  //     flags: textsecure.protobuf.DataMessage.Flags.EXPIRATION_TIMER_UPDATE,
  //   });
  // },

  // deprecated
  // getInternalContacts() {
  //   return this.server.getInternalContacts();
  // },

  // fetch someone's profile
  // if properties is not set, only fetch basic properties
  fetchContactProfile(number, properties) {
    if (typeof number !== 'string') {
      log.error('Invalid number type');
      throw Error('Invalid input number.');
    }

    return this.fetchDirectoryContacts([number], properties).then(
      data => data.contacts[0]
    );
  },

  // fetch directory c
  fetchDirectoryContacts(numbers, properties) {
    return this.server
      .fetchDirectoryContacts(numbers, properties)
      .then(result => {
        const { data = {} } = result;
        const { contacts = [] } = data;

        return Promise.all(
          contacts.map(contact => {
            const { remark } = contact;
            if (!remark) {
              return;
            }

            const { number } = contact;
            const key = textsecure.crypto.getRemarkNameKey(number);
            return textsecure.crypto
              .decryptRemarkName(remark, key)
              .then(
                decrypted =>
                  (contact.remarkName =
                    dcodeIO.ByteBuffer.wrap(decrypted).toString('utf8'))
              );
          })
        ).then(() => data);
      });
  },

  // return promise
  createGroupV2(groupName, groupAvatar, expiration, members) {
    return this.server.createGroupV2(
      groupName,
      groupAvatar,
      expiration,
      members
    );
  },
  upgradeGroupToV2(groupId, groupName, groupAvatar, expiration, members) {
    return this.server.upgradeGroupToV2(
      groupId,
      groupName,
      groupAvatar,
      expiration,
      members
    );
  },
  editGroupV2(
    groupId,
    groupName,
    groupOwner,
    groupAvatar,
    expiration,
    remindCycle
  ) {
    return this.server.editGroupV2(
      groupId,
      groupName,
      groupOwner,
      groupAvatar,
      expiration,
      remindCycle
    );
  },
  queryGroupV2(groupId) {
    return this.server.queryGroupV2(groupId);
  },
  getGroupV2List() {
    return this.server.getGroupV2List();
  },
  getServerTokenDirect() {
    return this.server.getServerTokenDirect();
  },
  addGroupV2Members(groupId, members) {
    return this.server.addGroupV2Members(groupId, members);
  },
  removeGroupV2Members(groupId, members) {
    return this.server.removeGroupV2Members(groupId, members);
  },
  addGroupAdmin(groupId, member) {
    return this.server.addGroupAdmin(groupId, member);
  },
  removeGroupAdmin(groupId, member) {
    return this.server.removeGroupAdmin(groupId, member);
  },
  transferGroupOwner(groupId, member) {
    return this.server.transferGroupOwner(groupId, member);
  },
  editGroupV2Member(
    groupId,
    number,
    role,
    displayName,
    remark,
    notification,
    rapidRole
  ) {
    return this.server.editGroupV2Member(
      groupId,
      number,
      role,
      displayName,
      remark,
      notification,
      rapidRole
    );
  },
  getGroupV2Member(groupId, number) {
    return this.server.getGroupV2Member(groupId, number);
  },
  disbandGroupV2(groupId) {
    return this.server.disbandGroupV2(groupId);
  },
  getGroupV2InviteCode(groupId) {
    return this.server.getGroupV2InviteCode(groupId);
  },
  getGroupV2InfoByInviteCode(groupInviteCode) {
    return this.server.getGroupV2InfoByInviteCode(groupInviteCode);
  },
  joinGroupV2ByInviteCode(groupInviteCode) {
    return this.server.joinGroupV2ByInviteCode(groupInviteCode);
  },
  changeGroupOnlyOwner(groupId, data) {
    return this.server.editGroupV2OnlyOwner(groupId, data);
  },
  getAttachment(id) {
    return this.server.getAttachment(id);
  },
  putAttachment(id) {
    return this.server.putAttachment(id);
  },
  securityCheck(content, contentType, messageId, senderId) {
    return this.server.securityCheck(content, contentType, messageId, senderId);
  },
  translateContent(contents, targetLang, sourceLang) {
    return this.server.translateContent(contents, targetLang, sourceLang);
  },

  // light task
  createLightTask(data) {
    return this.server.createLightTask(data);
  },
  deleteLightTask(data) {
    return this.server.deleteLightTask(data);
  },
  updateLightTask(data) {
    return this.server.updateLightTask(data);
  },
  getLightTask(taskId) {
    return this.server.getLightTask(taskId);
  },
  getLightTaskOperationLog(taskId, pageNumber, pageSize) {
    return this.server.getLightTaskOperationLog(taskId, pageNumber, pageSize);
  },
  getTaskList(pageNumber, pageSize) {
    return this.server.getTaskList(pageNumber, pageSize);
  },
  createExternalMeeting() {
    return this.server.createExternalMeeting();
  },
  getMeetingOnlineUsers(channelName) {
    return this.server.getMeetingOnlineUsers(channelName);
  },
  getExternalGroupMeeting(channelName, meetingName, invite) {
    return this.server.getExternalGroupMeeting(
      channelName,
      meetingName,
      invite
    );
  },
  // vote
  createVote(data) {
    return this.server.createVote(data);
  },
  voteItems(data) {
    return this.server.voteItems(data);
  },
  getVoteResult(data) {
    return this.server.getVoteResult(data);
  },
  // pin
  createGroupPin(groupId, content, source) {
    return this.server.createGroupPin(groupId, content, source);
  },
  removeGroupPin(groupId, pins) {
    return this.server.removeGroupPin(groupId, pins);
  },
  getGroupPins(groupId) {
    return this.server.getGroupPins(groupId);
  },

  getGroupMeetingDetails(meetingId) {
    return this.server.getGroupMeetingDetails(meetingId);
  },

  // mini program
  getMpList() {
    return this.server.getMpList();
  },
  getAppIdToken(appId) {
    return this.server.getAppIdToken(appId);
  },
  postExternalUrl(httpUrl, token) {
    return this.server.postExternalUrl(httpUrl, token);
  },

  // conversation
  conversationToFront(conversationId) {
    return this.server.conversationToFront(conversationId);
  },
  getUserExtInfo(number) {
    return this.server.getUserExtInfo(number);
  },
  getUserAccessedBUList() {
    return this.server.getUserAccessedBUList();
  },
  getMemberByBU(dn) {
    return this.server.getMemberByBU(dn);
  },
  getMemberByLeader(email) {
    return this.server.getMemberByLeader(email);
  },
  getUserAccessedLeaderList() {
    return this.server.getUserAccessedLeaderList();
  },

  // 会议 - 成员变更通知
  meetingNotifyGroupLeave(channelName) {
    return this.server.meetingNotifyGroupLeave(channelName);
  },
  meetingNotifyGroupInvite(channelName) {
    return this.server.meetingNotifyGroupInvite(channelName);
  },
  meetingNotifyGroupKick(channelName, users) {
    return this.server.meetingNotifyGroupKick(channelName, users);
  },

  getConversationSharedConfig(conversationId) {
    const ourNumber = textsecure.storage.user.getNumber();
    return this.server.getConversationSharedConfig(ourNumber, conversationId);
  },
  setConversationSharedConfig(conversationId, config) {
    const ourNumber = textsecure.storage.user.getNumber();
    return this.server.setConversationSharedConfig(
      ourNumber,
      conversationId,
      config
    );
  },

  getConversationConfig(idOrIds) {
    return this.server.getConversationConfig(idOrIds);
  },

  setConversationConfig(conversationId, config) {
    return this.server.setConversationConfig(conversationId, config);
  },
};

window.textsecure = window.textsecure || {};

textsecure.MessageSender = function MessageSenderWrapper(username, password) {
  const sender = new MessageSender(username, password);

  // this.sendExpirationTimerUpdateToNumber =
  //   sender.sendExpirationTimerUpdateToNumber.bind(sender);
  // this.sendExpirationTimerUpdateToGroup =
  //   sender.sendExpirationTimerUpdateToGroup.bind(sender);
  // this.sendRequestGroupSyncMessage =
  //   sender.sendRequestGroupSyncMessage.bind(sender);
  // this.sendRequestContactSyncMessage =
  //   sender.sendRequestContactSyncMessage.bind(sender);
  // this.sendRequestConfigurationSyncMessage =
  //   sender.sendRequestConfigurationSyncMessage.bind(sender);
  this.sendMessageToNumber = sender.sendMessageToNumber.bind(sender);
  this.sendMessage = sender.sendMessage.bind(sender);
  this.resetSession = sender.resetSession.bind(sender);
  // this.sendMessageToGroup = sender.sendMessageToGroup.bind(sender);
  this.sendTypingMessage = sender.sendTypingMessage.bind(sender);
  // this.createGroup = sender.createGroup.bind(sender);
  // this.updateGroup = sender.updateGroup.bind(sender);
  // this.addNumberToGroup = sender.addNumberToGroup.bind(sender);
  // this.setGroupName = sender.setGroupName.bind(sender);
  // this.setGroupAvatar = sender.setGroupAvatar.bind(sender);
  // this.leaveGroup = sender.leaveGroup.bind(sender);
  this.sendSyncMessage = sender.sendSyncMessage.bind(sender);
  this.getProfile = sender.getProfile.bind(sender);
  this.getAvatar = sender.getAvatar.bind(sender);
  this.syncReadMessages = sender.syncReadMessages.bind(sender);
  this.syncVerification = sender.syncVerification.bind(sender);
  // this.sendDeliveryReceipt = sender.sendDeliveryReceipt.bind(sender);
  this.sendReadReceipts = sender.sendReadReceipts.bind(sender);
  this.getMessageProto = sender.getMessageProto.bind(sender);
  // this.getInternalContacts = sender.getInternalContacts.bind(sender);
  this.createGroupV2 = sender.createGroupV2.bind(sender);
  this.upgradeGroupToV2 = sender.upgradeGroupToV2.bind(sender);
  this.editGroupV2 = sender.editGroupV2.bind(sender);
  this.queryGroupV2 = sender.queryGroupV2.bind(sender);
  this.getGroupV2List = sender.getGroupV2List.bind(sender);
  this.getServerTokenDirect = sender.getServerTokenDirect.bind(sender);
  this.addGroupV2Members = sender.addGroupV2Members.bind(sender);
  this.removeGroupV2Members = sender.removeGroupV2Members.bind(sender);
  this.addGroupAdmin = sender.addGroupAdmin.bind(sender);
  this.removeGroupAdmin = sender.removeGroupAdmin.bind(sender);
  this.transferGroupOwner = sender.transferGroupOwner.bind(sender);
  this.editGroupV2Member = sender.editGroupV2Member.bind(sender);
  this.getGroupV2Member = sender.getGroupV2Member.bind(sender);
  this.disbandGroupV2 = sender.disbandGroupV2.bind(sender);
  this.getGroupV2InviteCode = sender.getGroupV2InviteCode.bind(sender);
  this.getGroupV2InfoByInviteCode =
    sender.getGroupV2InfoByInviteCode.bind(sender);
  this.joinGroupV2ByInviteCode = sender.joinGroupV2ByInviteCode.bind(sender);
  this.changeGroupOnlyOwner = sender.changeGroupOnlyOwner.bind(sender);

  this.getAttachment = sender.getAttachment.bind(sender);
  this.putAttachment = sender.putAttachment.bind(sender);
  this.fetchContactProfile = sender.fetchContactProfile.bind(sender);
  this.fetchDirectoryContacts = sender.fetchDirectoryContacts.bind(sender);
  this.getMessageToGroupProto = sender.getMessageToGroupProto.bind(sender);
  this.getPinMessageProtoBuffer = sender.getPinMessageProtoBuffer.bind(sender);
  this.getMessageToNumberProto = sender.getMessageToNumberProto.bind(sender);
  this.sendMessageProtoNoSilent = sender.sendMessageProtoNoSilent.bind(sender);
  this.translateContent = sender.translateContent.bind(sender);
  this.securityCheck = sender.securityCheck.bind(sender);

  // light task
  this.createLightTask = sender.createLightTask.bind(sender);
  this.deleteLightTask = sender.deleteLightTask.bind(sender);
  this.updateLightTask = sender.updateLightTask.bind(sender);
  this.getLightTask = sender.getLightTask.bind(sender);
  this.getLightTaskOperationLog = sender.getLightTaskOperationLog.bind(sender);
  this.syncTaskRead = sender.syncTaskRead.bind(sender);
  this.getTaskList = sender.getTaskList.bind(sender);
  this.createExternalMeeting = sender.createExternalMeeting.bind(sender);
  this.getMeetingOnlineUsers = sender.getMeetingOnlineUsers.bind(sender);
  this.getExternalGroupMeeting = sender.getExternalGroupMeeting.bind(sender);

  // vote
  this.createVote = sender.createVote.bind(sender);
  this.voteItems = sender.voteItems.bind(sender);
  this.getVoteResult = sender.getVoteResult.bind(sender);

  // pin
  this.createGroupPin = sender.createGroupPin.bind(sender);
  this.removeGroupPin = sender.removeGroupPin.bind(sender);
  this.getGroupPins = sender.getGroupPins.bind(sender);

  // reaction
  this.sendReactionToGroup = sender.sendReactionToGroup.bind(sender);
  this.sendReactionToNumber = sender.sendReactionToNumber.bind(sender);

  this.getGroupMeetingDetails = sender.getGroupMeetingDetails.bind(sender);

  // mini program
  this.getMpList = sender.getMpList.bind(sender);
  this.getAppIdToken = sender.getAppIdToken.bind(sender);
  this.postExternalUrl = sender.postExternalUrl.bind(sender);

  // mark as unread
  this.syncMarkAsReadOrUnread = sender.syncMarkAsReadOrUnread.bind(sender);

  // conversation archived
  this.syncConversationArchive = sender.syncConversationArchive.bind(sender);

  // sync null message
  this.syncNullMessage = sender.syncNullMessage.bind(sender);

  // conversation
  this.conversationToFront = sender.conversationToFront.bind(sender);

  // get userExtInfo
  this.getUserExtInfo = sender.getUserExtInfo.bind(sender);

  // 获取当前登录者有权限的相关的所有的bu
  this.getUserAccessedBUList = sender.getUserAccessedBUList.bind(sender);

  // 获取当前登录者有权限的相关的所有的bu下的人
  this.getMemberByBU = sender.getMemberByBU.bind(sender);

  // 获取有权搜索到的所有leader信息
  this.getUserAccessedLeaderList =
    sender.getUserAccessedLeaderList.bind(sender);

  // 获取有权搜索到的所有leader下的人
  this.getMemberByLeader = sender.getMemberByLeader.bind(sender);

  this.meetingNotifyGroupLeave = sender.meetingNotifyGroupLeave.bind(sender);
  this.meetingNotifyGroupInvite = sender.meetingNotifyGroupInvite.bind(sender);
  this.meetingNotifyGroupKick = sender.meetingNotifyGroupKick.bind(sender);

  // conversation shared config
  this.getConversationSharedConfig =
    sender.getConversationSharedConfig.bind(sender);
  this.setConversationSharedConfig =
    sender.setConversationSharedConfig.bind(sender);

  // conversation config
  this.getConversationConfig = sender.getConversationConfig.bind(sender);
  this.setConversationConfig = sender.setConversationConfig.bind(sender);
};

textsecure.MessageSender.prototype = {
  constructor: textsecure.MessageSender,
};
