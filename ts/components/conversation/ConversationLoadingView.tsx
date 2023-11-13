import React from 'react';
import { Spin } from 'antd';

interface Props {
  onCancel: () => void;
}

export class ConversationLodingView extends React.Component<Props> {
  constructor(props: Readonly<Props>) {
    super(props);
  }

  public componentDidMount() {
    window.addEventListener(
      'conversation-close-create-poll-dialog',
      this.closeSelf
    );
  }

  public componentWillUnmount() {
    window.removeEventListener(
      'conversation-close-create-poll-dialog',
      this.closeSelf
    );
  }
  public closeSelf = () => {
    this.props.onCancel();
  };

  public render() {
    return (
      <div className={'conversation-loading-box'}>
        <div className={'conversation-loading'}>
          <Spin size="large" />
        </div>
      </div>
    );
  }
}
