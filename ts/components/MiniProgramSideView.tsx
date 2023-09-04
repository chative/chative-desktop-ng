import React, { useEffect, useState } from 'react';
import { Spin } from 'antd';
const { ipcRenderer } = require('electron');

export const MiniProgramSideView = () => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ipcRenderer.on('update-loading', handleLoading);
    return () => {
      ipcRenderer.removeListener('update-loading', handleLoading);
    };
  }, []);

  const handleLoading = (event: any, b: any) => {
    console.log(event);
    setLoading(b);
  };

  useEffect(() => {
    document.title = (window as any).getName() || 'Apps';
  }, []);

  (window as any).handleSideViewReplace = (appId: string, name: string) => {
    const titleElement = document.getElementsByClassName('title-side')[0];
    titleElement.innerHTML = name;
    titleElement.id = appId;
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
      >
        <div className="work-space-control-side-view">
          <div className="left">
            <button
              className="open"
              onClick={() => (window as any).webviewControl('independent')}
            ></button>
          </div>
          <div
            className="title-side"
            id={(window as any).getAppId() + (window as any).getVision()}
          >
            {(window as any).getName() || 'Apps'}
          </div>
          <div className="right">
            <button
              className="close"
              onClick={() => (window as any).webviewControl('close')}
            ></button>
          </div>
        </div>
        <div className="work-space-control-view-line"></div>
        <div className="work-space-control-view-v-line"></div>
      </div>
      {loading && (
        <div className={'browser-view-loading-box'}>
          <div className={'browser-view-loading-icon'}>
            <Spin />
          </div>
        </div>
      )}
    </div>
  );
};
