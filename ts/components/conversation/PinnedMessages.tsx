import React, { useState, useEffect, useRef } from 'react';
import { LocalizerType } from '../../types/Util';
import { Message, Props } from './Message';
import { PinSelectActionBar } from './PinSelectActionBar';

interface PinnedMessagesProps {
  i18n: LocalizerType;
  ourNumber: string;
  conversationId: string;
  messages: Array<Props>;
  onForwardTo: (
    conversationIds?: Array<string>,
    isMerged?: boolean,
    messages?: Array<any>
  ) => void;
}

export const PinnedMessages = (props: PinnedMessagesProps) => {
  const { i18n, ourNumber, conversationId, messages, onForwardTo } = props;
  const [showEditButton, setShowEditButton] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [lastSelectIndex, setLastSelectIndex] = useState(-1);

  const observer = useRef(); //监听保存

  const initObserver = () => {
    const dom = document.getElementsByClassName('li-name');
    const config = {
      rootMargin: '0px',
      threshold: 0,
    };

    //监听dom是否在视口内
    // @ts-ignore
    observer.current = new IntersectionObserver((entries, self) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const message = messages.filter(m => m.id === entry.target.id);
          // @ts-ignore
          message[0].riskCheck();
        } else {
          //
        }
      });
    }, config);

    // @ts-ignore
    // observer.current.observe(dom);
    for (let i = 0; i < dom.length; i++) {
      // @ts-ignore
      observer.current.observe(dom[i]);
    }
  };

  const resetObserver = () => {
    // @ts-ignore
    observer.current.disconnect();
  };

  useEffect(() => {
    const ele = document.getElementsByClassName('message-list');
    if (ele && ele[0]) {
      ele[0].scrollTop = ele[0].scrollHeight;
    }
    initObserver();
    return () => {
      resetObserver();
    };
  }, [messages]);

  const filterMessages = (items: any, index1: number, index2: number) => {
    let start = index1;
    let end = index2;
    if (start > index2) {
      start = index2;
      end = index1;
    }

    const result = [];
    for (let i = start; i < items.length && i <= end; i++) {
      result.push(items[i].id);
    }

    return result;
  };

  const renderMessages = () => {
    let items = [];
    for (let i = 0; i < messages.length; i += 1) {
      const m = messages[i];
      items.push(
        <li key={m.id} id={m.id} className={'li-name'}>
          <Message
            {...m}
            isSelectingMode={!showEditButton}
            isSelected={selected.has(m.id)}
            onSelectChange={(checked: boolean, shiftKey: boolean) => {
              setLastSelectIndex(i);

              // 打勾
              if (checked && !selected.has(m.id)) {
                if (shiftKey && lastSelectIndex !== -1) {
                  const more = filterMessages(messages, i, lastSelectIndex);
                  setSelected(new Set([...selected, ...more]));
                } else {
                  setSelected(new Set([...selected, m.id]));
                }
              }

              // 取消打勾
              if (!checked && selected.has(m.id)) {
                if (shiftKey && lastSelectIndex !== -1) {
                  selected.delete(m.id);
                  const more = filterMessages(messages, i, lastSelectIndex);
                  for (let j = 0; j < more.length; j += 1) {
                    selected.delete(more[j]);
                  }
                  setSelected(new Set([...selected]));
                } else {
                  selected.delete(m.id);
                  setSelected(new Set([...selected]));
                }
              }
            }}
          />
        </li>
      );
    }
    return (
      <div className={'message-list'}>
        <ul>{items}</ul>
      </div>
    );
  };

  if (!messages || messages.length === 0) {
    return (
      <p
        style={{
          textAlign: 'center',
          marginTop: '120px',
          fontSize: '18px',
          color: '#777777',
        }}
      >
        {i18n('pin_no_messages')}
      </p>
    );
  }

  return (
    <>
      {renderMessages()}
      <PinSelectActionBar
        i18n={i18n}
        showEditButton={showEditButton}
        onShowEditButton={(show: boolean) => {
          setShowEditButton(show);
          if (show) {
            setLastSelectIndex(-1);
          }
          setSelected(new Set());
        }}
        onForwardTo={(ids?: Array<string>, isMerged?: boolean) => {
          if (selected.size === 0) {
            return;
          }
          onForwardTo(ids, isMerged, [...selected]);
          setShowEditButton(true);
          setLastSelectIndex(-1);
        }}
        onUnpin={async () => {
          if (selected.size === 0) {
            return;
          }
          if (selected.size === 1) {
            if (!confirm(i18n('unpinned_one_message_question'))) {
              return;
            }
          }
          if (selected.size > 1) {
            if (
              !confirm(i18n('unpinned_messages_question', ['' + selected.size]))
            ) {
              return;
            }
          }

          let result;
          let errorMsg = 'Unknown error';
          try {
            if ((window as any).textsecure.messaging) {
              result = await (
                window as any
              ).textsecure.messaging.removeGroupPin(conversationId, [
                ...selected,
              ]);
            } else {
              errorMsg = 'Network is not available';
            }
          } catch (e: any) {
            // 已删除，当作成功处理
            if (e && e.response && e.response.status === 2) {
              result = { status: 0 };
            }
            if (e && e.message) {
              errorMsg = e.message;
            }
          }

          if (result && result.status === 0) {
            await (window as any).Signal.Data._removeMessages([...selected], {
              Message: (window as any).Whisper.Message,
            });
            const idV1 = (window as any).Signal.ID.convertIdToV1(
              conversationId
            );
            const conversationModel = await (
              window as any
            ).ConversationController.getOrCreateAndWait(idV1, 'group');
            selected.forEach(id => {
              conversationModel?.trigger('unpin-message', id);
            });
            setShowEditButton(true);
            setLastSelectIndex(-1);
          }

          if (!result || result.status !== 0) {
            (window as any).noticeError(errorMsg);
            return;
          }
        }}
        ourNumber={ourNumber}
        selectedCount={selected.size}
      />
    </>
  );
};
