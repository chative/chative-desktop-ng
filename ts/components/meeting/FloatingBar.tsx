import React, { useEffect, useState } from 'react';
import { LocalizerType } from '../../types/Util';
import { ipcRenderer } from 'electron';

const getWebUserDisplayName = (name: string) => {
  if (name.startsWith('web-')) {
    const temp = name.replace('web-', '');
    return (
      (temp.indexOf('-') > 0 ? temp.substring(0, temp.indexOf('-')) : temp) +
      '(Web)'
    );
  }
  return name;
};

type PropsType = {
  i18n: LocalizerType;
};
export const FloatingBar = (props: PropsType) => {
  const { i18n } = props;
  const [micMute, setMicMute] = useState(false);
  const [speaker, setSpeaker] = useState('');
  const [shareName, setShareName] = useState('');

  useEffect(() => {
    const ourNumber = (window as any).getOurNumber();
    (window as any).setupWaterMark(ourNumber || 'null');

    setSpeaker((window as any).speaker);
    setMicMute((window as any).isMuted);

    // Listen for the event
    ipcRenderer.on('receive-status', (_, speaker, isMuted, name) => {
      setSpeaker(speaker);
      setMicMute(isMuted);
      setShareName(name);
    });
  }, []);

  const renderHeader = () => {
    if (!shareName || speaker) {
      if (speaker) {
        return (
          <div className={'header'}>
            <span className={'speaking-icon'}></span>
            <span className={'content'}>
              {' ' + getWebUserDisplayName(speaker)}
            </span>
          </div>
        );
      }

      return (
        <div className={'header'}>
          <span className={'title'}>
            {i18n('speaking') + ' ' + i18n('speaking_no_one')}
          </span>
        </div>
      );
    }

    return (
      <div className={'header'}>
        <span className={'share-screen-icon'}></span>
        <span className={'content'}>
          {' ' + getWebUserDisplayName(shareName)}
        </span>
      </div>
    );
  };

  return (
    <div
      className="floating-bar-body"
      onDoubleClick={() => {
        (window as any).backToMeeting();
      }}
    >
      {renderHeader()}
      <div className="button-list">
        {micMute ? (
          <span
            className={'mic-muted'}
            onClick={() => {
              (window as any).wantSetMuted(false);
            }}
            onDoubleClick={ev => {
              ev.stopPropagation();
              ev.preventDefault();
            }}
          />
        ) : (
          <span
            className={'mic-normal'}
            onClick={() => {
              (window as any).wantSetMuted(true);
            }}
            onDoubleClick={ev => {
              ev.stopPropagation();
              ev.preventDefault();
            }}
          />
        )}
        <span
          className={'window-close'}
          onClick={() => {
            (window as any).wantClose();
          }}
          onDoubleClick={ev => {
            ev.stopPropagation();
            ev.preventDefault();
          }}
        />
      </div>
    </div>
  );
};
