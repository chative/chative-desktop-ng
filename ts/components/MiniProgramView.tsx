import React, { useEffect, useRef, useState } from 'react';
import { Spin } from 'antd';
const { ipcRenderer } = require('electron');

export const MiniProgramView = () => {
  const inputRef = useRef('');
  const [loading, setLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const listener = (event: any, canGoBack: boolean, canGoForward: boolean) => {
    console.debug(event, canGoBack, canGoForward);
    setCanGoBack(canGoBack);
    setCanGoForward(canGoForward);
  };
  useEffect(() => {
    document.title = (window as any).getName() || 'Apps';
  }, []);

  useEffect(() => {
    ipcRenderer.on('update-control-config', listener);
    ipcRenderer.on('update-loading', handleLoading);
    return () => {
      ipcRenderer.removeListener('update-control-config', listener);
      ipcRenderer.removeListener('update-loading', handleLoading);
    };
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleKeyDown = (e: any) => {
    const { key, keyCode } = e || {};
    if (keyCode === 13 && inputRef.current.endsWith('showmethedev')) {
      ipcRenderer.send('show-me-the-dev');
      inputRef.current = '';
      return;
    }
    inputRef.current += key?.toLowerCase();
  };

  const handleLoading = (event: any, b: any) => {
    console.log(event);
    setLoading(b);
  };

  const doubleClick = () => {
    ipcRenderer.send('maximized-window');
  };

  return (
    <div className="mini-program-wrapper">
      <div
        className="dragable"
        style={{
          height: 48,
          width: '100%',
          textAlign: 'center',
          fontSize: '16px',
          userSelect: 'none',
        }}
        onDoubleClick={doubleClick}
      >
        <div className="work-space-control-view" style={{ width: '100%' }}>
          <div className="left">
            <button
              disabled={!canGoBack}
              className={canGoBack ? 'back' : 'back-disable'}
              onClick={() => (window as any).webviewControl('goBack')}
            ></button>
            <button
              disabled={!canGoForward}
              className={canGoForward ? 'forward' : 'forward-disable'}
              onClick={() => (window as any).webviewControl('goForward')}
            ></button>
            <button
              className="refresh"
              onClick={() => (window as any).webviewControl('reload')}
            ></button>
          </div>
          <div
            className="title-independent"
            id={(window as any).getAppId() + (window as any).getVision()}
          >
            {(window as any).getName() || 'Apps'}
          </div>
          <div className="right">
            <button
              className="share"
              onClick={() => (window as any).webviewControl('share')}
            ></button>
            <button
              className="copy"
              onClick={() => (window as any).webviewControl('copy')}
            ></button>
            <button
              className="open"
              onClick={() => (window as any).webviewControl('external')}
            ></button>
          </div>
        </div>
        <div className="work-space-control-view-line"></div>
      </div>
      {loading && (
        <div className={'browser-view-loading-box'}>
          <div className={'browser-view-loading-icon'}>
            <Spin size="large" />
          </div>
        </div>
      )}
    </div>
  );
};
