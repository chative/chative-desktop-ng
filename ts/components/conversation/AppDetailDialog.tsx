import React from 'react';

import { LocalizerType } from '../../types/Util';
import { Modal } from 'antd';
import classNames from 'classnames';

interface Props {
  i18n: LocalizerType;
  /** Allows you to customize now non-links are rendered. Simplest is just a <span>. */
  onClose: () => void;
  appDetail: any;
  showAppDetailDialog: boolean;
  openApp: () => void;
  isPin: boolean;
  pinOrUnpin: (isPin: boolean, currentAppItem: any) => void;
}

export class AppDetailDialog extends React.Component<Props> {
  public render() {
    const {
      i18n,
      onClose,
      showAppDetailDialog,
      appDetail,
      openApp,
      pinOrUnpin,
      isPin,
    } = this.props;

    const {
      picture,
      name,
      appDescription,
      guideUrl,
      supportBot,
      labels,
      buName,
    } = appDetail;

    return (
      <>
        {
          <Modal
            width={380}
            mask={false}
            footer={null}
            zIndex={9999}
            className={'risk-check-modal'}
            onCancel={onClose}
            closable={true}
            open={showAppDetailDialog}
            style={{ top: '25%' }}
          >
            <div className={'item'} style={{ height: '64px' }}>
              {picture && (
                <div style={{ float: 'left' }}>
                  <img
                    className={classNames('avatar')}
                    style={{
                      height: '64px',
                      width: '64px',
                      borderRadius: '8px',
                    }}
                    src={picture}
                  />
                </div>
              )}
              {!picture && (
                <div className={classNames('avatar-default')}>App</div>
              )}
              <div
                className={'app-name-content'}
                style={{ marginLeft: '20px', float: 'left', marginTop: '9px' }}
              >
                <p
                  className={classNames(
                    'name',
                    (!Array.isArray(labels) || !labels.length) && 'name-signal'
                  )}
                >
                  {name}
                </p>
                {buName && (
                  <div
                    className={'bu-name-div'}
                    style={{ height: '16px', width: '175px' }}
                  >
                    {/*Here is the product team name*/}
                    {buName}
                  </div>
                )}

                {/*{Array.isArray(labels) && labels.length > 0 && (*/}
                {/*  <div className={'mp-label-box'}>*/}
                {/*    {labels.map(label => (*/}
                {/*      <div key={label} className={'mp-label'}>*/}
                {/*        {label}*/}
                {/*      </div>*/}
                {/*    ))}*/}
                {/*  </div>*/}
                {/*)}*/}
              </div>
            </div>
            <div className={'app-description-div'}>
              {appDescription && <div>{appDescription}</div>}
            </div>
            <div>
              {guideUrl && (
                <div
                  className={'app-detail-button-div'}
                  onClick={() => {
                    (window as any).sendBrowserOpenUrl(guideUrl);
                  }}
                >
                  <div className={'app-detail-guide-icon'}></div>
                  <span>Guide</span>
                </div>
              )}
              {supportBot && (
                <div
                  className={'app-detail-button-div'}
                  onClick={() => {
                    onClose();
                    (window as any).jumpMessage({ conversationId: supportBot });
                  }}
                >
                  <div className={'app-detail-support-icon'}></div>
                  <span>Support</span>
                </div>
              )}

              <div
                className={'app-detail-button-div'}
                onClick={() => {
                  if (isPin) {
                    pinOrUnpin(true, appDetail);
                  } else {
                    pinOrUnpin(false, appDetail);
                  }
                }}
              >
                <div className={'app-detail-pin-icon'}></div>
                {isPin ? <span>Unpin</span> : <span>Pin</span>}
              </div>
              <button
                className={'risk-check-modal-understand-btn'}
                style={{
                  width:
                    guideUrl && supportBot
                      ? '49%'
                      : !guideUrl && !supportBot
                      ? '80%'
                      : '66%',
                }}
                onClick={openApp}
              >
                {i18n('open')}
              </button>
            </div>
          </Modal>
        }
      </>
    );
  }
}
