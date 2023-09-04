import React from 'react';
import classNames from 'classnames';
import { ForwardDialog } from '../ForwardDialog';
import { LocalizerType } from '../../types/Util';

interface Props {
  i18n: LocalizerType;
  onForwardTo: (conversationIds?: Array<string>, isMerged?: boolean) => void;
  ourNumber: string;
  selectedCount: number;
  showEditButton: boolean;
  onShowEditButton: (show: boolean) => void;
  onUnpin: () => void;
}

interface State {
  isMerge?: boolean;
  conversations: Array<any>;
  isShowForwardDialog?: boolean;
}

export class PinSelectActionBar extends React.Component<Props, State> {
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
    this.setState({
      isShowForwardDialog: false,
    });
  };

  public cancelForwardDialog = () => {
    this.setState({
      isShowForwardDialog: false,
    });
  };

  public onForwardMessageToMe = () => {
    const { onForwardTo, ourNumber } = this.props;
    if (onForwardTo && ourNumber) {
      onForwardTo([ourNumber], true);
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
    const { i18n, selectedCount, showEditButton, onShowEditButton, onUnpin } =
      this.props;

    const isDisabled = selectedCount === 0;

    if (showEditButton) {
      return (
        <div className={classNames('select-action-bar')}>
          <div className={classNames('select-action-bar-actions')}>
            <div
              className={classNames('action-button')}
              onClick={() => onShowEditButton(false)}
            >
              <div className={classNames('action-button-icon')}>
                <div
                  className={classNames(
                    'action-button-icon',
                    'action-button-icon_edit'
                  )}
                />
              </div>
              <div className={classNames('action-button-text')}>
                {i18n('editButtonTitle')}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={classNames('select-action-bar')}>
        <div className={classNames('select-action-bar-actions')}>
          {/*Forward*/}
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
              />
            </div>
            <div className={classNames('action-button-text')}>
              {i18n('oneByOneForward', [`${selectedCount}`])}
            </div>
          </div>

          {/*Save to Note*/}
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
              />
            </div>
            <div className={classNames('action-button-text')}>
              {i18n('saveToNoteForward', [`${selectedCount}`])}
            </div>
          </div>

          {/*Unpin*/}
          {
            <div
              className={classNames(
                'action-button',
                isDisabled ? 'action-button-disabled' : null
              )}
              onClick={isDisabled ? () => {} : () => onUnpin()}
            >
              <div className={classNames('action-button-icon')}>
                <div
                  className={classNames(
                    'action-button-icon',
                    'action-button-icon_unpin'
                  )}
                />
              </div>
              <div className={classNames('action-button-text')}>
                {i18n('unpin') + '(' + [`${selectedCount}`] + ')'}
              </div>
            </div>
          }

          {/*close*/}
          <div
            className={classNames('action-button')}
            onClick={() => {
              onShowEditButton(true);
            }}
          >
            <div className={classNames('action-button-icon_cancel')} />
          </div>
        </div>

        {this.renderForwardDialog()}
      </div>
    );
  }
}
