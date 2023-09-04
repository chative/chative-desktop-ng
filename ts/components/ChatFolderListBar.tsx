import React, { useState } from 'react';

type Props = {
  chatFolderList: Array<String>; //全部的分组
  conversationChatFolder: Array<String>; //当前会话存在的分组
};

function ChatFolderListBarNative(props: Props) {
  const [chatFolderList] = useState(props.chatFolderList);
  const [conversationChatFolder] = useState(props.conversationChatFolder);
  let count = 10000;
  return (
    <div className={'chat-folder-list-innder'}>
      {chatFolderList.map(item => {
        if (conversationChatFolder.includes(item)) {
          return (
            <div className={'chat-folder-list-item'}>
              <div className={'chat-folder-list-item-icon'} />
              <span key={count++}>{item}</span>
            </div>
          );
        }
        return (
          <div className={'chat-folder-list-item'}>
            <span key={count++}>{item}</span>
          </div>
        );
      })}
    </div>
  );
}
export class ChatFolderListBar extends React.Component<Props> {
  public render() {
    return <ChatFolderListBarNative {...this.props} />;
  }
}
