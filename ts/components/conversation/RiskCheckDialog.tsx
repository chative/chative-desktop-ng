import React from 'react';

import { LocalizerType } from '../../types/Util';
import { Modal } from 'antd';

export interface CheckResult {
  status: number;
  reason: string;
}

interface Props {
  i18n: LocalizerType;
  /** Allows you to customize now non-links are rendered. Simplest is just a <span>. */
  checkResult: CheckResult;
  showRiskCheckDialog: boolean;
  onclickUrl?: string;
  onClose: () => void;
  onDoAlways?: () => void;
}

export class RiskCheckDialog extends React.Component<Props> {
  public render() {
    const {
      i18n,
      onclickUrl,
      checkResult,
      showRiskCheckDialog,
      onClose,
      onDoAlways,
    } = this.props;

    const { status, reason } = checkResult;

    if (status === 1) {
      return;
    }

    return (
      <>
        {
          <Modal
            width={400}
            mask={false}
            footer={null}
            zIndex={9999}
            className={'risk-check-modal'}
            onCancel={onClose}
            closable={false}
            open={showRiskCheckDialog}
            style={{ top: '25%' }}
          >
            {status === 3 ? (
              <img
                src="images/error_tip.svg"
                style={{
                  width: '80px',
                  height: '80px',
                  position: 'relative',
                  left: '135px',
                }}
              />
            ) : (
              <img
                src="images/warn_tip.svg"
                style={{
                  width: '80px',
                  height: '80px',
                  position: 'relative',
                  left: '135px',
                }}
              />
            )}
            <p className={'safety-tip'}>{i18n('safetyTip')}</p>

            <p className={'risk-check-modal-text'}>{reason}</p>

            {onclickUrl ? (
              <div className={'risk-check-modal-url-div'}>
                <p className={'risk-check-modal-url'}>{onclickUrl}</p>
              </div>
            ) : null}

            {status === 3 ? (
              <button
                className={'risk-check-modal-understand-btn'}
                onClick={onClose}
              >
                {i18n('understand')}
              </button>
            ) : (
              <div>
                <button
                  style={{ width: '47%' }}
                  className={'risk-check-modal-cancel-btn'}
                  onClick={onClose}
                >
                  {i18n('cancel')}
                </button>
                <button
                  className={'risk-check-modal-understand-btn'}
                  style={{ width: '47%' }}
                  onClick={onDoAlways}
                >
                  {i18n('open')}
                </button>
              </div>
            )}
          </Modal>
        }
      </>
    );
  }
}
