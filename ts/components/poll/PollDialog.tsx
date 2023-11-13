import React from 'react';
import { LocalizerType } from '../../types/Util';
import PollModal from '../PollModal';
import PollOption from './PollOption';

const MAX_POLL_NAME_LENGTH = 80;
const MAX_POLL_OPTION_NAME_LENGTH = 80;
const MAX_POLL_OPTIONS = 6;
let voteExpireConfig = [10, 30, 60, 360, 1440, 4320, 10080, 20160, 40320];

interface Props {
  i18n: LocalizerType;
  conversationId?: string;
  conversationIdV1?: string;
  onCancel: () => void;
  ourNumber: string;
}

interface State {
  name: string;
  options: Array<string>;
  dueTime: number;
  multipleVotes: boolean;
  operationLoading: boolean;
  anonymousVote: boolean;
}

export class PollDialog extends React.Component<Props, State> {
  public textareaRef: React.RefObject<HTMLTextAreaElement>;
  public unloadComponent: boolean;

  constructor(props: Readonly<Props>) {
    super(props);
    this.textareaRef = React.createRef();
    this.unloadComponent = false;

    const gl = (window as any).getGlobalConfig();
    if (
      gl &&
      gl.voteExpireConfig instanceof Array &&
      gl.voteExpireConfig.length
    ) {
      voteExpireConfig = gl.voteExpireConfig;
    }
    this.state = {
      name: '',
      options: ['', ''],
      dueTime: voteExpireConfig[0],
      multipleVotes: false,
      operationLoading: false,
      anonymousVote: true,
    };
  }

  public componentDidMount() {
    window.addEventListener(
      'conversation-close-create-poll-dialog',
      this.closeSelf
    );

    if (this.textareaRef.current) {
      (window as any).autosize(this.textareaRef.current);
      // not work why???!!
      this.textareaRef.current?.focus();
    }
  }

  public componentWillUnmount() {
    window.removeEventListener(
      'conversation-close-create-poll-dialog',
      this.closeSelf
    );
    this.unloadComponent = true;
  }

  public closeSelf = () => {
    this.props.onCancel();
  };

  public renderOperationLoading() {
    const { operationLoading } = this.state;
    if (!operationLoading) {
      return null;
    }
    return (
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          textAlign: 'center',
          zIndex: 200,
        }}
      >
        <div style={{ width: '100%', height: '100%' }}>
          <div className={'waiting-border'}>
            <div
              className="waiting"
              style={{ width: 40, height: 40, margin: 10 }}
            />
          </div>
        </div>
      </div>
    );
  }

  public renderCloseBtn() {
    return (
      <span
        className={'common-close'}
        style={{ position: 'absolute', left: '15px', top: '26px' }}
        onClick={(event: React.MouseEvent<HTMLSpanElement>) => {
          event.stopPropagation();
          this.props.onCancel();
        }}
      />
    );
  }

  public renderTitle() {
    const { i18n } = this.props;
    return <h3>{i18n('creating_poll')}</h3>;
  }

  public renderName() {
    const { i18n } = this.props;

    return (
      <textarea
        ref={this.textareaRef}
        className={'name'}
        defaultValue={''}
        maxLength={MAX_POLL_NAME_LENGTH}
        spellCheck={false}
        autoFocus={true}
        placeholder={i18n('creating_poll_name_placeholder')}
        onChange={e => {
          let text = e.target.value?.trim();
          if (text && text.length > MAX_POLL_NAME_LENGTH) {
            text = text.substr(0, MAX_POLL_NAME_LENGTH);
          }
          this.setState({ name: text });
        }}
      />
    );
  }

  public renderOptions() {
    const { i18n } = this.props;
    const { options } = this.state;
    if (!options.length) {
      return null;
    }

    return options.map((text, index) => {
      return (
        <PollOption
          i18n={i18n}
          key={index}
          text={text}
          disableIcon={options.length <= 2}
          max_poll_option_text_length={MAX_POLL_OPTION_NAME_LENGTH}
          updateText={(textComplete: string) => {
            let text = textComplete;
            if (text && text.length > MAX_POLL_OPTION_NAME_LENGTH) {
              text = text.substr(0, MAX_POLL_OPTION_NAME_LENGTH);
            }

            const oldText = options[index];
            if (oldText === text) {
              return;
            }

            options[index] = text;
            this.setState({
              options,
            });
          }}
          remove={() => {
            if (options.length <= 2) {
              return;
            }
            const tmp = [...options];
            tmp.splice(index, 1);
            this.setState({ options: tmp });
          }}
        />
      );
    });
  }

  public renderAddOption() {
    const { i18n } = this.props;
    const { options } = this.state;

    let hasEmptyOption = false;
    for (let i = 0; i < options.length; i += 1) {
      if (!options[i]) {
        hasEmptyOption = true;
        break;
      }
    }

    const disableStatus = options.length >= MAX_POLL_OPTIONS || hasEmptyOption;

    return (
      <div
        className={'option-add'}
        style={{
          cursor: disableStatus ? 'not-allowed' : 'pointer',
        }}
        onClick={() => {
          if (disableStatus) {
            return;
          }

          options.push('');
          this.setState({ options: [...options] });
        }}
      >
        <span
          className={
            disableStatus ? 'vote-plus-icon-gray' : 'vote-plus-icon-green'
          }
        />
        <span
          style={{
            verticalAlign: 'middle',
            color: disableStatus ? 'gray' : 'inherit',
          }}
        >
          {i18n('creating_poll_add_option')}
        </span>
      </div>
    );
  }

  public renderDueTime() {
    const { i18n } = this.props;
    const formatMin = (m: number) => {
      if (m < 60) {
        return (
          m +
          (m === 1
            ? i18n('creating_poll_minute')
            : i18n('creating_poll_minutes'))
        );
      }
      m = m / 60;
      if (m < 24) {
        return (
          m +
          (m === 1 ? i18n('creating_poll_hour') : i18n('creating_poll_hours'))
        );
      }
      m = m / 24;
      if (m < 7) {
        return (
          m + (m === 1 ? i18n('creating_poll_day') : i18n('creating_poll_days'))
        );
      }
      m = m / 7;
      return (
        m + (m === 1 ? i18n('creating_poll_week') : i18n('creating_poll_weeks'))
      );
    };
    const options = voteExpireConfig.map((v: number, index: number) => {
      return (
        <option key={index} value={v}>
          {formatMin(v)}
        </option>
      );
    });
    return (
      <div className={'due-time'}>
        <span>{i18n('creating_poll_due_time')}</span>
        <select
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
            this.setState({ dueTime: parseInt(e.target.value) });
          }}
        >
          {options}
        </select>
      </div>
    );
  }

  public renderAllowMultipleVotes() {
    const { i18n } = this.props;
    return (
      <div
        className={'allow-multi_votes'}
        onClick={() => {
          this.setState(prevState => {
            return { multipleVotes: !prevState.multipleVotes };
          });
        }}
      >
        <span>{i18n('creating_poll_allow_multiple')}</span>
        <input
          type="checkbox"
          checked={this.state.multipleVotes}
          onChange={() => {}}
        />
      </div>
    );
  }

  public renderAnonymousVotes() {
    const { i18n } = this.props;
    return (
      <div
        className={'allow-multi_votes'}
        onClick={() => {
          this.setState(prevState => {
            return { anonymousVote: !prevState.anonymousVote };
          });
        }}
      >
        <span>{i18n('creating_poll_anonymous')}</span>
        <input
          type="checkbox"
          checked={this.state.anonymousVote}
          onChange={() => {}}
        />
      </div>
    );
  }

  public renderCreateButton() {
    const { conversationId, conversationIdV1, i18n } = this.props;
    const { name, options, multipleVotes, anonymousVote } = this.state;

    let creatingButtonEnable = true;
    if (!name) {
      creatingButtonEnable = false;
    }

    for (let i = 0; i < options.length; i += 1) {
      if (!options[i]) {
        creatingButtonEnable = false;
        break;
      }
    }

    return (
      <div style={{ textAlign: 'center' }}>
        <button
          disabled={!creatingButtonEnable}
          className={creatingButtonEnable ? 'button-enable' : 'button-disable'}
          onClick={async () => {
            if (!name) {
              throw Error('PollDialog.tsx create poll empty name.');
            }
            if (name.length > MAX_POLL_NAME_LENGTH) {
              throw Error('PollDialog.tsx create poll name too long.');
            }

            for (let i = 0; i < options.length; i += 1) {
              const firstOption = options[i].trim();
              if (!firstOption) {
                throw Error('PollDialog.tsx create poll empty option text.');
              }
              if (firstOption.length > MAX_POLL_OPTION_NAME_LENGTH) {
                throw Error('PollDialog.tsx create poll option text too long.');
              }
              for (let j = i + 1; j < options.length; j += 1) {
                if (firstOption === options[j]) {
                  alert('Options cannot be same');
                  return;
                }
              }
            }

            this.setState({ operationLoading: true });

            // network create poll
            const votePutData = {
              name,
              multiple: multipleVotes ? 1 : 0,
              deadline: this.state.dueTime,
              gid: conversationId,
              options: options.map((v, index) => {
                return { name: v.trim(), id: index };
              }),
              anonymous: anonymousVote ? 1 : 2,
            };

            let vote;
            let errorMsg = 'Unknown error';
            try {
              if ((window as any).textsecure.messaging) {
                vote = await (window as any).textsecure.messaging.createVote(
                  votePutData
                );
              } else {
                errorMsg = 'Network is not available';
              }
            } catch (e: any) {
              if (e && e.message) {
                errorMsg = e.message;
              }
            }

            if (this.unloadComponent) {
              return;
            }

            if (!vote || !vote.id) {
              alert('Create Vote failed:' + errorMsg);
              this.setState({ operationLoading: false });
              return;
            }

            // write to database
            vote = {
              ...vote,
              voteId: vote.id,
              dueTime: vote.deadline,
            };

            try {
              await (window as any).Signal.Data.createOrUpdateBasicVote({
                ...vote,
              });
            } catch (e: any) {
              alert(
                'Create Vote failed SQL createOrUpdateBasicVote:' + e.message
              );
              this.setState({ operationLoading: false });
              return;
            }

            if (this.unloadComponent) {
              return;
            }

            // send vote card
            try {
              const c = await (
                window as any
              ).ConversationController.getOrCreateAndWait(
                conversationIdV1,
                'group'
              );
              if (c) {
                await c.forceSendMessageAuto(
                  '',
                  null,
                  [],
                  null,
                  null,
                  null,
                  null,
                  null,
                  null,
                  { vote }
                );
              }
            } catch (e: any) {
              alert('Create Vote failed Send vote card:' + e.message);
              this.setState({ operationLoading: false });
              return;
            }

            if (this.unloadComponent) {
              return;
            }

            this.setState({ operationLoading: false });
            this.props.onCancel();
          }}
        >
          {i18n('creating_poll_create')}
        </button>
      </div>
    );
  }

  public render() {
    const { onCancel } = this.props;
    const { operationLoading } = this.state;

    return (
      <PollModal onClose={onCancel} escClose={!operationLoading}>
        <div className="poll-dialog">
          {this.renderOperationLoading()}
          {this.renderCloseBtn()}
          {this.renderTitle()}
          {this.renderName()}
          {this.renderOptions()}
          {this.renderAddOption()}
          {this.renderDueTime()}
          {this.renderAllowMultipleVotes()}
          {this.renderAnonymousVotes()}
          {this.renderCreateButton()}
        </div>
      </PollModal>
    );
  }
}
