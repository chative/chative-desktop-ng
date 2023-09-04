import React, { useEffect, useState } from 'react';
import { LocalizerType } from '../../types/Util';
import { LongMark } from './LongMark';
import { Tooltip } from 'antd';

type Props = {
  i18n: LocalizerType;
  messages: any;
  onShowAllPinMessages: () => void;
  // onUnpinOneMessage: () => {};
  onGotoMessage: (
    timestamp: number,
    source: string,
    sourceDevice: number
  ) => void;
};

export const PinMessageBar = (props: Props) => {
  const { i18n, messages, onShowAllPinMessages, onGotoMessage } = props;
  if (!messages || messages.length === 0) {
    return null;
  }

  const [oldIndex, setIndex] = useState(messages.length - 1);
  let index = oldIndex;
  if (index >= messages.length) {
    index = messages.length - 1;
  }

  useEffect(() => {
    setIndex(messages.length - 1);
  }, [messages]);

  const handleClick = () => {
    const m = messages[index];
    onGotoMessage(m.sent_at, m.source, m.sourceDevice);
    setIndex(index === 0 ? messages.length - 1 : index - 1);
  };

  const msgModel = new (window as any).Whisper.Message({
    ...messages[index],
  });
  // @ts-ignore
  const msgBody = msgModel.getDescription();

  return (
    <div className={'pin-message-wrapper'} onClick={handleClick}>
      <div className={'pin-left'}>
        <LongMark length={messages.length} current={index} />
      </div>
      <div className={'pin-middle'}>
        <div className={'pin-middle-up'}>
          <span>
            {' '}
            {i18n('pinned_messages')}{' '}
            {index === messages.length - 1 ? '' : '#' + (index + 1)}
          </span>
        </div>
        <div className={'pin-middle-down'}>
          <span className={'pin-middle-down-message'}>{msgBody}</span>
        </div>
      </div>
      <div className={'pin-right'}>
        {/*{messages.length === 1 ? <span*/}
        {/*    className={'unpin-one-messages-icon'}*/}
        {/*    onClick={(e) => {*/}
        {/*      e.stopPropagation();*/}
        {/*      e.preventDefault();*/}
        {/*      onUnpinOneMessage()*/}
        {/*    }}*/}
        {/*  /> :*/}
        <Tooltip
          mouseEnterDelay={1.5}
          overlayClassName={'antd-tooltip-cover'}
          placement="leftTop"
          title={i18n('detailsTooltip')}
        >
          <span
            className={'all-pin-messages-icon'}
            onClick={e => {
              e.stopPropagation();
              e.preventDefault();
              onShowAllPinMessages();
            }}
          />
        </Tooltip>
        {/*}*/}
      </div>
    </div>
  );
};
