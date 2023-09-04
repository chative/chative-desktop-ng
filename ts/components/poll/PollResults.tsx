import React, { useState } from 'react';
import { LocalizerType } from '../../types/Util';
import Dialog from '../Dialog';
import { ContactListItem } from '../ContactListItem';
import { useAsyncEffect } from 'use-async-effect';

interface Props {
  i18n: LocalizerType;
  onCancel: () => void;
  vid: string;
  name: string;
  options: Array<any>;
  memberRapidRole: any;
}

export default function PollResults(props: Props) {
  const { i18n, onCancel, options, name, vid } = props;
  const [voteDetails, setVoteDetails] = useState([]);
  const [requestFailed, setRequestFailed] = useState(
    i18n('poll_card_loading_results')
  );
  const optionPrefix = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  useAsyncEffect(async () => {
    const { getVoteResult } = (window as any).textsecure.messaging || {};
    if (getVoteResult) {
      let errorMessage = 'Unknown error';
      try {
        const results = await getVoteResult(vid);
        if (results) {
          setVoteDetails(results);
          setRequestFailed('');
          return;
        }
        errorMessage = 'Network is not available';
      } catch (error: any) {
        if (error && error.message) errorMessage = error.message;
      }
      setRequestFailed(errorMessage);
    } else {
      setRequestFailed('Network is not available');
    }
  }, []);

  const renderCloseButton = () => {
    return (
      <div className="results__top-header-bar">
        <span
          className={'apple-close'}
          onClick={(event: React.MouseEvent<HTMLSpanElement>) => {
            event.stopPropagation();
            onCancel();
          }}
        />
      </div>
    );
  };

  const getConversationProps = (id: string) => {
    if (!id) {
      throw Error('PollResults.tsx bad uid!');
    }
    const c = (window as any).ConversationController.get(id);
    if (c) {
      return {
        ...c.format(),
        isMe: false,
      };
    } else {
      return {
        id,
        name: id,
        isArchived: false,
        timestamp: 0,
        phoneNumber: id,
        type: 'direct',
        isMe: false,
        lastUpdated: 0,
        unreadCount: 0,
        isSelected: false,
        isTyping: false,
      };
    }
  };

  const renderUsers = (uids: any) => {
    const users = [];
    for (let i = 0; i < uids.length; i++) {
      const c = getConversationProps(uids[i]);
      const rapidRole =
        props?.memberRapidRole && c ? props.memberRapidRole?.[c.id] : undefined;
      const isOutside = (window as any).ConversationController.get(
        c.id
      )?.isOutside();

      users.push(
        <ContactListItem
          key={c.id}
          id={c.id}
          phoneNumber={c.id}
          isMe={c.isMe}
          name={c.name}
          color={(c as any).color}
          verified={false}
          profileName={(c as any).profileName}
          avatarPath={(c as any).avatarPath}
          email={(c as any).email}
          i18n={i18n}
          rapidRole={rapidRole}
          isOutside={isOutside}
        />
      );
    }
    return users;
  };

  const renderOneOption = (id: number, uids: any, allVotesCount: number) => {
    let optionName;
    for (let i = 0; i < options.length; i += 1) {
      if (id === options[i].id) {
        optionName = optionPrefix[id] + '. ' + options[i].name;
        break;
      }
    }
    if (!optionName) {
      throw Error('PollResults.tsx bad option id!');
    }

    // 四舍五入
    let xxx = 1000 * (uids.length / allVotesCount);
    xxx = Math.round(xxx) / 10;
    let percentText = xxx + '';
    if (!percentText.includes('.')) {
      percentText = percentText + '.0';
    }

    if (uids.length === 1) {
      percentText =
        uids.length + i18n('poll_card_vote') + ' ' + percentText + '%';
    } else {
      percentText =
        uids.length + i18n('poll_card_votes') + ' ' + percentText + '%';
    }

    return (
      <div key={id}>
        <div className={'option-title'}>
          <span className={'option-title-name'}>{optionName}</span>
          <span className={'option-title-tag'}>{percentText}</span>
        </div>
        <div className={'option-users'}>{renderUsers(uids)}</div>
      </div>
    );
  };

  const renderOptions = () => {
    if (requestFailed) {
      return <p style={{ textAlign: 'center' }}>{requestFailed}</p>;
    }

    let allVotesCount = 0;
    for (let i = 0; i < voteDetails.length; i += 1) {
      const { uids } = voteDetails[i];
      // @ts-ignore
      if (uids && uids.length) {
        // @ts-ignore
        allVotesCount += uids.length;
      }
    }

    if (!allVotesCount) {
      return <p style={{ textAlign: 'center' }}>No one voted!</p>;
    }

    const items = [];
    for (let i = 0; i < voteDetails.length; i += 1) {
      const { id, uids } = voteDetails[i];
      // @ts-ignore
      if (uids && uids.length) {
        items.push(renderOneOption(id, uids, allVotesCount));
      }
    }
    return items;
  };

  return (
    <Dialog onClose={onCancel} escClose={true}>
      <div className="poll-results-dialog">
        {renderCloseButton()}
        <h3>{i18n('poll_card_vote_results')}</h3>
        <h4>{name}</h4>
        <div className={'poll-options-container'}>{renderOptions()}</div>
      </div>
    </Dialog>
  );
}
