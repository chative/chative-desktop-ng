import React, { useState } from 'react';
import { LocalizerType } from '../../types/Util';
import timestampToLocal from './_taskUtil';
import { v4 as uuidv4 } from 'uuid';
import { Line } from 'rc-progress';
import PollResults from '../poll/PollResults';

const optionPrefix = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export interface PollOptionType {
  id: number;
  name: string;
}

export interface OptionCountType {
  id: number;
  count: number;
}

export interface PollType {
  voteId: string;
  name: string;
  creator: string;
  multiple: number;
  options: Array<PollOptionType>;
  dueTime: number;
  status: number;
  version?: number;
  selected?: Array<number>;
  optionsCount?: Array<OptionCountType>;
  votersCount?: number;
  totalVotes?: number;
  anonymous: number;
}

interface PropsType {
  i18n: LocalizerType;
  poll: PollType;
  ourNumber: string;
  memberRapidRole: any;
}

export default function EmbeddedPoll(props: PropsType) {
  const { i18n, poll, ourNumber } = props;
  const {
    voteId,
    name,
    creator,
    dueTime,
    options,
    multiple,
    optionsCount,
    selected,
    status,
    votersCount,
    totalVotes,
    anonymous,
  } = poll;
  const [selectedSingleOption, setSelectedSingleOption] = useState(-1);
  const [selectedMultipleOption, setSelectedMultipleOption] = useState(
    new Set()
  );
  const [operationLoading, setOperationLoading] = useState(false);
  const [showPollResultDialog, setShowPollResultDialog] = useState(false);

  const renderHeader = () => {
    let subName = '';
    if (multiple) {
      subName = i18n('poll_card_multiple_choice');
    }
    if (anonymous === 2) {
      subName += i18n('poll_card_named_choice');
    }

    subName += ' ' + i18n('poll_card_end_at');

    return (
      <div className={'poll-header'}>
        <span className={'poll-icon'} />
        <span className={'name'}>{name}</span>
        <p className={'sub-name'}>
          {subName + timestampToLocal(dueTime, i18n('lang') === 'zh-CN')}
        </p>
      </div>
    );
  };

  const renderOptions = () => {
    if (status !== 1 || (selected && selected.length)) {
      return null;
    }
    const randomKey = uuidv4();
    const hasId = (id: number) => {
      if (multiple) {
        return selectedMultipleOption.has(id);
      } else {
        return selectedSingleOption === id;
      }
    };

    const items = options.map((v, index) => {
      return (
        <div
          key={index}
          className={'option-item'}
          onClick={() => {
            if (operationLoading) {
              return;
            }
            if (multiple) {
              if (selectedMultipleOption.has(v.id)) {
                selectedMultipleOption.delete(v.id);
              } else {
                selectedMultipleOption.add(v.id);
              }
              setSelectedMultipleOption(new Set([...selectedMultipleOption]));
            } else {
              setSelectedSingleOption(v.id);
            }
          }}
        >
          <input
            type={multiple ? 'checkbox' : 'radio'}
            id={index + randomKey}
            value={v.id}
            name={randomKey}
            checked={hasId(v.id)}
            onChange={() => {}}
          />
          <label htmlFor={index + randomKey}>
            {optionPrefix[index] + '. ' + v.name}
          </label>
        </div>
      );
    });
    return <div className={'options-container'}>{items}</div>;
  };

  const renderOptionDoneItem = (
    key: number,
    selfVoted: boolean,
    title: string,
    count: number,
    percent: number
  ) => {
    let percentText = percent + '';
    if (!percentText.includes('.')) {
      percentText = percentText + '.0';
    }
    percentText = percentText + '%' + (selfVoted ? ' ✓' : '');

    const strokeColor = percent === 0 ? '#D9D9D9' : 'rgb(50,113,255)';
    const voteText =
      count + (count <= 1 ? i18n('poll_card_vote') : i18n('poll_card_votes'));
    return (
      <div key={key} style={{ padding: '10px 10px 0 10px' }}>
        <p
          className={selfVoted ? 'self-voted-name' : ''}
          style={{ margin: '5px 0', wordBreak: 'break-word' }}
        >
          {title}
        </p>
        <p
          className={selfVoted ? 'self-voted-name' : ''}
          style={{
            fontSize: '10px',
            margin: 0,
            padding: 0,
          }}
        >
          {voteText + ' ' + percentText}
        </p>
        <div style={{ display: 'flex', height: '3px', marginTop: 4 }}>
          <Line percent={percent} strokeColor={strokeColor} />
        </div>
      </div>
    );
  };

  const renderOptionsDone = () => {
    const selfVoted = selected && selected.length;
    if (status !== 2 && !selfVoted) {
      return null;
    }

    const getOptionCount = (index: number) => {
      if (!optionsCount) {
        return 0;
      }
      for (let i = 0; i < optionsCount.length; i += 1) {
        if (index === optionsCount[i].id) {
          return optionsCount[i].count;
        }
      }
      return 0;
    };

    const items = options.map((v, index) => {
      const thisOptionCount = getOptionCount(v.id);
      let xxx = 0;
      if (totalVotes) {
        xxx = 1000 * (thisOptionCount / totalVotes);
        xxx = Math.round(xxx) / 10;
      }

      const selfVoted = selected ? selected.includes(v.id) : false;
      return renderOptionDoneItem(
        index,
        selfVoted,
        optionPrefix[index] + '. ' + v.name,
        thisOptionCount,
        xxx
      );
    });

    return <div>{items}</div>;
  };

  const renderStatus = () => {
    const selfVoted = selected && selected.length;
    if (selfVoted || status === 2) {
      return (
        <div className={'vote-status-container'}>
          <span className={'vote-status'}>
            {i18n('poll_card_participant_number') + (votersCount || 0)}
          </span>
          {multiple ? (
            <span className={'vote-status'}>
              {i18n('poll_card_total_votes') + (totalVotes || 0)}
            </span>
          ) : null}
        </div>
      );
    }
    return null;
  };

  const renderShowResultButton = () => {
    return (
      <div style={{ textAlign: 'center' }}>
        <button
          className={'button-enable'}
          onClick={() => {
            setShowPollResultDialog(true);
          }}
        >
          {i18n('poll_card_show_results')}
        </button>
      </div>
    );
  };

  const voteAction = async () => {
    let sps: any;
    if (multiple) {
      sps = [...selectedMultipleOption];
    } else {
      sps = [selectedSingleOption];
    }

    setOperationLoading(true);
    let vote;
    let errorMsg = 'Unknown error';
    try {
      if ((window as any).textsecure.messaging) {
        vote = await (window as any).textsecure.messaging.voteItems({
          id: voteId,
          options: sps,
        });
      } else {
        errorMsg = 'Network is not available';
      }
    } catch (e: any) {
      if (e) {
        if (e.response && e.response.reason) {
          errorMsg = e.response.reason;
        } else {
          if (e.message) {
            errorMsg = e.message;
          }
        }
      }
    }

    if (!vote || !vote.id) {
      setOperationLoading(false);
      alert('Vote failed:' + errorMsg);
      return;
    }

    const voteUpdate = {
      voteId: vote.id,
      version: vote.version,
      selected: vote.selected || null,
      optionsCount: vote.options,
      votersCount: vote.votersCount,
      totalVotes: vote.totalVotes,
      status: vote.status,
    };

    try {
      await (window as any).Signal.Data.createOrUpdateChangeableVote(
        voteUpdate
      );
    } catch (e: any) {
      setOperationLoading(false);
      alert('Vote failed SQL createOrUpdateChangeableVote:' + e.message);
      return;
    }

    await (window as any).Whisper.Vote.updateVoteLinkedMessages(voteUpdate);
    setOperationLoading(false);

    if (vote.status === 2) {
      alert(i18n('poll_card_already_ended'));
      return;
    }

    if (vote.voted === 1) {
      alert(i18n('poll_card_already_voted'));
    }
  };

  const renderAnonymousButton = () => {
    if (anonymous !== 1) {
      return null;
    }

    const selfVoted = selected && selected.length;
    if (selfVoted && status !== 2) {
      return null;
    }

    let btnDisable: boolean;
    if (multiple) {
      btnDisable = selectedMultipleOption.size === 0;
    } else {
      btnDisable = selectedSingleOption === -1;
    }
    if (operationLoading || status === 2) {
      btnDisable = true;
    }

    return (
      <div style={{ textAlign: 'center' }}>
        <button
          disabled={btnDisable}
          className={btnDisable ? 'button-disable' : 'button-enable'}
          onClick={voteAction}
        >
          {operationLoading
            ? i18n('poll_card_voting')
            : status === 2
            ? i18n('poll_card_vote_ended')
            : i18n('poll_card_vote_now')}
        </button>
      </div>
    );
  };

  const renderNonAnonymousButton = () => {
    if (anonymous !== 2) {
      return null;
    }

    const selfVoted = selected && selected.length;
    if (status === 2 || selfVoted) {
      return renderShowResultButton();
    }

    let btnDisable: boolean;
    if (multiple) {
      btnDisable = selectedMultipleOption.size === 0;
    } else {
      btnDisable = selectedSingleOption === -1;
    }
    if (operationLoading) {
      btnDisable = true;
    }

    const isOwner = creator === ourNumber;
    let st = {};
    if (isOwner) {
      st = {
        width: 'calc(100% - 100px)',
      };
    }

    return (
      <div style={{ textAlign: 'center' }}>
        <button
          style={st}
          disabled={btnDisable}
          className={btnDisable ? 'button-disable' : 'button-enable'}
          onClick={voteAction}
        >
          {operationLoading
            ? i18n('poll_card_voting')
            : i18n('poll_card_vote_now')}
        </button>
        {isOwner ? (
          <button
            style={{ width: '52px', marginLeft: '6px', padding: 0 }}
            className={'button-enable'}
            onClick={() => {
              setShowPollResultDialog(true);
            }}
          >
            {i18n('view')}
          </button>
        ) : null}
      </div>
    );
  };

  const renderPollResultDialog = () => {
    if (!showPollResultDialog) {
      return false;
    }
    return (
      <PollResults
        onCancel={() => {
          setShowPollResultDialog(false);
        }}
        i18n={i18n}
        vid={voteId}
        name={name}
        options={options}
        memberRapidRole={props.memberRapidRole}
      />
    );
  };

  return (
    <div className={'poll-message-block'}>
      {renderHeader()}
      {renderOptions()}
      {renderOptionsDone()}
      {renderStatus()}
      {renderAnonymousButton()}
      {renderNonAnonymousButton()}
      {renderPollResultDialog()}
    </div>
  );
}
