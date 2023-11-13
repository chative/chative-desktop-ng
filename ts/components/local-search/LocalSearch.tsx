import React, { useState, useRef, useEffect, useCallback } from 'react';

const { ipcRenderer } = require('electron');
import { AutoSizer, List } from 'react-virtualized';
import { TextMessageListItem } from './TextMessageListItem';
import { LocalizerType } from '../../types/Util';
import { useAsyncEffect } from 'use-async-effect';
import * as GoogleChrome from '../../util/GoogleChrome';
import { cleanSearchTerm } from '../../util/cleanSearchTerm';
import {
  getConversationModel,
  getConversationProps,
  getMessageCollection,
} from '../../shims/Whisper';
import { debounce } from 'lodash';

type DBMessageResult = {
  attachments?: Array<any>;
  forwardContext?: any;
  conversationId: string;
  id: string;
  type: string;
  source: string;
  snippet: string;
  sent_at: number;
  serverTimestamp: number;
};

type PropsType = {
  i18n: LocalizerType;
};

const doSearch = async ({
  conversationId,
  searchTerm,
  lastSearchTerm,
  setTextMessages,
}: {
  conversationId: string;
  searchTerm: string;
  lastSearchTerm: { current: string };
  setTextMessages: (arg0: never[]) => void;
}) => {
  const searchKeywords = cleanSearchTerm(searchTerm || '');

  lastSearchTerm.current = searchKeywords;

  if (searchKeywords === '') {
    setTextMessages([]);
    return;
  }

  let result;
  if (conversationId) {
    result = await (window as any).Signal.Data.searchMessagesInConversation(
      searchKeywords,
      conversationId,
      { limit: 1000 }
    );
  } else {
    result = await (window as any).Signal.Data.searchMessages(searchKeywords, {
      limit: 1000,
    });
  }

  // query changed before last query result returns
  if (result.query !== lastSearchTerm.current) {
    return;
  }

  const collection = getMessageCollection(result.messages);
  if (collection.length) {
    const groupedMessages = collection.groupBy('conversationId');

    for (const cid of Object.keys(groupedMessages)) {
      const conversation = getConversationModel(cid);
      if (!conversation) {
        continue;
      }

      const models = groupedMessages[cid];
      const firstFound = models[0].getServerTimestamp();
      const lastFound = models[models.length - 1].getServerTimestamp();

      await conversation.loadReadPositions(firstFound, lastFound);
    }
  }

  // query changed before last query result returns
  if (result.query !== lastSearchTerm.current) {
    return;
  }

  setTextMessages(
    collection.models
      .reverse()
      .filter((message: any) => !message?.isExpired())
      .map((message: any) => message.attributes)
  );
};

export const LocalSearch = (props: PropsType) => {
  const { i18n } = props;
  const [initData, setInitData] = useState(false);
  const [textMessages, setTextMessages] = useState<Array<DBMessageResult>>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [ourNumber, setOurNumber] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [conversationId, setConversationId] = useState('');
  const lastSearchTerm = useRef('');

  // for first load this window
  useEffect(() => {
    const keywords = (window as any).keywords;
    const conversationId = (window as any).conversationId;
    if (keywords) {
      setSearchTerm(keywords);
    }
    if (conversationId) {
      setConversationId(conversationId);
    }
  }, []);

  // init data
  useAsyncEffect(async () => {
    ipcRenderer.on(
      'receive-keywords',
      (_, keywords: string, conversationId: string) => {
        setSearchTerm(keywords);
        setConversationId(conversationId);
        inputRef.current?.focus();
      }
    );

    let myNumber = (window as any).textsecure.storage.user.getNumber();
    if (myNumber.indexOf('.') !== -1) {
      myNumber = myNumber.substr(0, myNumber.indexOf('.'));
    }
    if (!myNumber) {
      throw Error('LocalSearch.tsx ourNumber not found!');
    }
    (window as any).setupWaterMark(myNumber);
    setOurNumber(myNumber);

    await (window as any).ConversationController.load(true);
    setInitData(true);
    inputRef.current?.focus();
  }, []);

  const renderEmptyResult = () => {
    if (!searchTerm) {
      return (
        <div className={'empty-search-result-placeholder'}>
          {i18n('messageSearchKeywordsToSearch')}
        </div>
      );
    }
    if (textMessages.length === 0) {
      return (
        <div className={'empty-search-result-placeholder'}>
          {i18n('messageSearchNoResult')}
        </div>
      );
    }
    return null;
  };

  const debouncedDoSearch = useCallback(
    debounce(doSearch, 500, { trailing: true }),
    []
  );

  const getSearchOptions = () => ({
    conversationId,
    searchTerm,
    lastSearchTerm,
    setTextMessages,
  });

  useAsyncEffect(
    () => debouncedDoSearch(getSearchOptions()),
    [searchTerm, conversationId]
  );

  const renderRow = ({ index, style }: any): JSX.Element => {
    const {
      id,
      sent_at,
      type,
      source,
      conversationId,
      snippet,
      attachments,
      forwardContext,
      serverTimestamp,
    } = textMessages[index];

    const userId = type === 'outgoing' ? ourNumber : source;

    const c = getConversationProps(conversationId);
    const user = getConversationProps(userId);
    let body = '';
    if (user) {
      body += user.name || user.profileName || userId;
    }
    body += ': ';

    let externBody = snippet;

    let attachment;
    if (attachments && attachments.length > 0) {
      attachment = attachments[0];
    }

    if (forwardContext) {
      externBody = i18n('placeholderWrapperForChatHistory');
    } else if (attachment) {
      const oldHold = externBody;
      externBody = i18n('shortForAttachment') + oldHold;
      const isImage = GoogleChrome.isImageTypeSupported(attachment.contentType);
      const isVideo = GoogleChrome.isVideoTypeSupported(attachment.contentType);
      if (isImage) {
        externBody = i18n('shortForImage') + oldHold;
      } else if (isVideo) {
        externBody = i18n('shortForVideo') + oldHold;
      }
    }
    body += externBody;

    return (
      <TextMessageListItem
        key={index}
        id={userId}
        conversationId={conversationId}
        conversationType={(c as any).type}
        style={style}
        isMe={(c as any).isMe}
        name={(c as any).name}
        color={(c as any).color}
        profileName={(c as any).profileName}
        avatarPath={(c as any).avatarPath}
        body={body}
        i18n={i18n}
        timestamp={serverTimestamp || sent_at}
        messageId={id}
      />
    );
  };

  const renderResultList = () => {
    if (!searchTerm || textMessages.length === 0) {
      return null;
    }
    return (
      <div style={{ padding: '20px 0 20px 28px', height: '100%' }}>
        <div style={{ height: 'calc(100% - 96px)', overflow: 'auto' }}>
          <AutoSizer>
            {({ height, width }) => (
              <List
                className="module-left-pane__virtual-list"
                height={height}
                rowCount={textMessages.length}
                rowRenderer={renderRow}
                rowHeight={72}
                width={width}
                rerenderWhenChanged={textMessages}
              />
            )}
          </AutoSizer>
        </div>
      </div>
    );
  };

  const renderInputFilter = () => {
    if (!conversationId) {
      return null;
    }

    const c = getConversationProps(conversationId);
    if (!c) {
      return null;
    }
    let name = c.name || 'Unknown';
    if (name.length > 16) {
      name = name.substring(0, 16) + '...';
    }
    return (
      <span className={'filter-span'}>
        {name}
        <span
          className={'filter-small-clear'}
          onClick={() => {
            setConversationId('');
            inputRef.current?.focus();
          }}
        />
      </span>
    );
  };

  const renderInput = () => {
    return (
      <div className="filter-input-container">
        <div>
          <span className="search-icon" />
        </div>
        {renderInputFilter()}
        <input
          ref={inputRef}
          type="text"
          placeholder={i18n('messageSearchInputPlaceholder')}
          value={searchTerm}
          onChange={e => {
            setSearchTerm(e.target.value);
          }}
        />
        {searchTerm ? (
          <span
            className={'search-clear'}
            onClick={() => {
              setSearchTerm('');
              inputRef.current?.focus();
            }}
          >
            {i18n('messageSearchClear')}
          </span>
        ) : null}
      </div>
    );
  };

  if (!initData) {
    return (
      <div style={{ fontSize: '18px', textAlign: 'center', marginTop: 120 }}>
        {i18n('loading')}
      </div>
    );
  }

  return (
    <div className="local-search-body">
      <div className="local-search-top-placeholder" />
      {renderInput()}
      {renderEmptyResult()}
      {renderResultList()}
    </div>
  );
};
