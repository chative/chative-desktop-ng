import React, { useEffect, useState } from 'react';
import { Spin } from 'antd';

const { ipcRenderer } = require('electron');

export const MiniProgramInsideView = () => {
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

  (window as any).handleInsideViewReplace = (appId: string, name: string) => {
    const type = (window as any).getInsideViewType();
    const titleElement = document.getElementsByClassName(
      'title-inside-' + type
    )[0];
    titleElement.innerHTML = name;
    titleElement.id = appId + 'inside';
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
        <div className="work-space-control-inside-view">
          <div
            className={'title-inside-' + (window as any).getInsideViewType()}
            id={(window as any).getAppId() + 'inside'}
          >
            {(window as any).getName() || 'Apps'}
          </div>
          <div className="right">
            <button
              className="close"
              onClick={() => {
                const appId = (window as any).getAppId();
                (window as any).closeInsideView(appId);
              }}
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
