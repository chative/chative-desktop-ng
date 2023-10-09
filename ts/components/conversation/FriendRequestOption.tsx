import React from 'react';

import { LocalizerType } from '../../types/Util';
import classNames from 'classnames';
import { Button, Modal } from 'antd';

interface Props {
  i18n: LocalizerType;
  isBlocked: boolean;
  setBlockSetting: (isBlock: boolean) => void;
  sendAgreeFriend: () => void;
  sendReport: () => void;
  findyouDescribe?: string;
}

interface State {
  modalOpen: boolean;
}

export class FriendRequestOption extends React.Component<Props, State> {
  public constructor(props: Props) {
    super(props);

    this.state = {
      modalOpen: false,
    };
  }

  //从哪里来的请求
  public getFrendRequestFrom() {
    const { findyouDescribe } = this.props;
    return (
      <>
        <div className="the_from">{findyouDescribe ? findyouDescribe : ''}</div>
      </>
    );
  }
  //已屏蔽按钮
  public showBlockeRender() {
    const { setBlockSetting, sendAgreeFriend, i18n } = this.props;
    return (
      <>
        <Button
          type="default"
          onClick={() => {
            setBlockSetting(false);
            sendAgreeFriend();
          }}
        >
          {i18n('unblock')}
        </Button>
      </>
    );
  }

  //未屏蔽
  public showButtonRender() {
    const { setBlockSetting, i18n, sendAgreeFriend, sendReport } = this.props;
    const { modalOpen } = this.state;
    const showModal = () => {
      this.setState({
        modalOpen: true,
      });
    };
    const BlockOk = () => {
      setBlockSetting(true);
      this.setState({ modalOpen: false });
    };
    const handleCancel = () => {
      this.setState({ modalOpen: false });
    };
    const BlockAndReportOk = () => {
      //setBlockSetting(true);
      sendReport();
      this.setState({ modalOpen: false });
    };

    return (
      <>
        <Button danger onClick={showModal}>
          {i18n('block')}
        </Button>
        <Button
          type="primary"
          onClick={sendAgreeFriend}
          className={classNames('btn-blue')}
        >
          {i18n('acceptNewKey')}
        </Button>
        <Modal
          open={modalOpen}
          onOk={BlockOk}
          onCancel={handleCancel}
          footer={[
            <Button key="submit" onClick={BlockOk}>
              {i18n('block')}
            </Button>,
            <Button key="report" danger onClick={BlockAndReportOk}>
              {i18n('blockAndReport')}
            </Button>,
            <Button key="back" onClick={handleCancel}>
              {i18n('cancel')}
            </Button>,
          ]}
          width={325}
        >
          {i18n('ublockFriendMessage')}
        </Modal>
      </>
    );
  }

  public render() {
    const { isBlocked } = this.props;

    return (
      <>
        <div className="friend-request-option_content">
          {this.getFrendRequestFrom()}
          {isBlocked ? this.showBlockeRender() : this.showButtonRender()}
        </div>
      </>
    );
  }
}
