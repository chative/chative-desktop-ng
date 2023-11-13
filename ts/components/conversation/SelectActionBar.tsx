import React from 'react';
import classNames from 'classnames';
import { ForwardDialog } from '../ForwardDialog';
import { LocalizerType } from '../../types/Util';

interface Props {
  i18n: LocalizerType;
  isShown?: boolean;
  onForwardTo: (conversationIds?: Array<string>, isMerged?: boolean) => void;
  onCancel: () => void;
  ourNumber: string;
  isDisabled?: boolean;
  selectedCount: number;
}

interface State {
  isMerge?: boolean;
  conversations: Array<any>;
  isShowForwardDialog?: boolean;
}

export class SelectActionBar extends React.Component<Props, State> {
  public constructor(props: Props) {
    super(props);

    this.state = {
      isShowForwardDialog: false,
      conversations: [],
    };
  }

  public onShowForwardDialog = async (isMerge?: boolean) => {
    this.setState({
      isMerge,
      isShowForwardDialog: true,
      conversations: (window as any).getAliveConversationsProps(),
    });
  };

  public closeForwardDialog = () => {
    const { onCancel } = this.props;
    this.setState({
      isShowForwardDialog: false,
    });

    onCancel();
  };

  public cancelForwardDialog = () => {
    this.setState({
      isShowForwardDialog: false,
    });
  };

  public onForwardMessageToMe = () => {
    const { onForwardTo, ourNumber, onCancel } = this.props;
    if (onForwardTo && ourNumber) {
      onForwardTo([ourNumber], true);
    }

    if (onCancel) {
      onCancel();
    }
  };

  public renderForwardDialog() {
    const { isShowForwardDialog, isMerge, conversations } = this.state;
    if (!isShowForwardDialog) {
      return null;
    }

    const { i18n, onForwardTo } = this.props;

    return (
      <ForwardDialog
        i18n={i18n}
        isMerge={isMerge}
        onForwardTo={onForwardTo}
        conversations={conversations}
        onClose={this.closeForwardDialog}
        onCancel={this.cancelForwardDialog}
      />
    );
  }

  public render() {
    const { i18n, isShown, onCancel, isDisabled, selectedCount } = this.props;

    if (!isShown) {
      return null;
    }

    return (
      <div className={classNames('select-action-bar')}>
        <div className={classNames('select-action-bar-actions')}>
          <div
            className={classNames(
              'action-button',
              isDisabled ? 'action-button-disabled' : null
            )}
            onClick={
              isDisabled ? () => {} : () => this.onShowForwardDialog(false)
            }
          >
            <div className={classNames('action-button-icon')}>
              <div
                className={classNames(
                  'action-button-icon',
                  'action-button-icon_one-by-one'
                )}
              ></div>
            </div>
            <div className={classNames('action-button-text')}>
              {i18n('oneByOneForward', [`${selectedCount}`])}
            </div>
          </div>
          <div
            className={classNames(
              'action-button',
              isDisabled || selectedCount <= 1 ? 'action-button-disabled' : null
            )}
            onClick={
              isDisabled || selectedCount <= 1
                ? () => {}
                : () => this.onShowForwardDialog(true)
            }
          >
            <div className={classNames('action-button-icon')}>
              <div
                className={classNames(
                  'action-button-icon',
                  'action-button-icon_combined'
                )}
              ></div>
            </div>
            <div className={classNames('action-button-text')}>
              {i18n('combineAndForward', [`${selectedCount}`])}
            </div>
          </div>
          <div
            className={classNames(
              'action-button',
              isDisabled ? 'action-button-disabled' : null
            )}
            onClick={isDisabled ? () => {} : this.onForwardMessageToMe}
          >
            <div className={classNames('action-button-icon')}>
              <div
                className={classNames(
                  'action-button-icon',
                  'action-button-icon_to-me'
                )}
              ></div>
            </div>
            <div className={classNames('action-button-text')}>
              {i18n('saveToNoteForward', [`${selectedCount}`])}
            </div>
          </div>
          <div className={classNames('action-button')} onClick={onCancel}>
            <div className={classNames('action-button-icon_cancel')}></div>
            {/* <div className={classNames('action-button-text')}>{i18n('cancel')}</div> */}
          </div>
        </div>

        {this.renderForwardDialog()}
      </div>
    );
  }
}
