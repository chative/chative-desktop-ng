import React, { useState } from 'react';

type Props = {
  conversations: Array<Object>;
};

function ChatFolderMenuBarNative(props: Props) {
  const [conversations] = useState(props.conversations);
  return (
    <div>
      {conversations.map((item, index) => {
        return (
          <span key={index} className={'chat-folder-item'}>
            {item}
          </span>
        );
      })}
    </div>
  );
}

export class ChatFolderMenuBar extends React.Component<Props> {
  public render() {
    return <ChatFolderMenuBarNative {...this.props} />;
  }
}
