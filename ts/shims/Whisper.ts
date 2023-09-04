export function getMessageModel(attributes: any) {
  // @ts-ignore
  return new window.Whisper.Message(attributes);
}

export function getMessageCollection(attributesArray: Array<any>) {
  // @ts-ignore
  return new window.Whisper.MessageCollection(attributesArray);
}

export function getConversationModel(conversationId: string) {
  if (typeof conversationId !== 'string' || !conversationId) {
    console.log('invalid conversation id', conversationId);
    return null;
  }

  // @ts-ignore
  return window.ConversationController.get(conversationId);
}

export function getConversationProps(
  conversationId: string,
  ourNumber?: string
) {
  const model = getConversationModel(conversationId);

  let isMe = false;

  if (ourNumber) {
    if (ourNumber === conversationId) {
      isMe = true;
    }
  } else {
    // @ts-ignore
    if (conversationId === window.textsecure.storage.user.getNumber()) {
      isMe = true;
    }
  }

  if (model) {
    return {
      ...model.format(),
      isMe,
    };
  } else {
    return {
      id: conversationId,
      name: conversationId,
      isArchived: false,
      timestamp: 0,
      phoneNumber: conversationId,
      type: 'direct',
      isMe,
      lastUpdated: 0,
      unreadCount: 0,
      isSelected: false,
      isTyping: false,
    };
  }
}
