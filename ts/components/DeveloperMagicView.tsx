import React, { useRef } from 'react';

export const DeveloperMagicView = () => {
  const certExpireInputRef = useRef<HTMLInputElement>(null);
  const hostInputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <button onClick={(window as any).mainWindowOpenDevTools}>
        打开主窗口 DevTools
      </button>
      <button onClick={(window as any).exportLocalCert}>
        导出证书和CA到App目录下
      </button>
      <button onClick={(window as any).clearLocalCert}>删除本地证书</button>
      <div>
        证书有效期修改(毫秒时间戳): <input ref={certExpireInputRef} />{' '}
        <button
          onClick={() => {
            if (certExpireInputRef?.current) {
              const expire = parseInt(certExpireInputRef?.current.value);
              (window as any).setLocalCertExpire(expire);
            }
          }}
        >
          修改
        </button>
      </div>
      <div>
        beyondCorp流量调度绑定host: <input ref={hostInputRef} />{' '}
        <button
          onClick={() => {
            if (hostInputRef?.current) {
              (window as any).setBeyondCorpHost(hostInputRef.current.value);
            }
          }}
        >
          绑定
        </button>
        <button
          onClick={() => {
            if (hostInputRef?.current) {
              hostInputRef.current.value = '';
            }
            (window as any).removeBeyondCorpHost();
          }}
        >
          取消绑定
        </button>
      </div>
      <div>
        杀软安装:
        <button
          onClick={() => {
            (window as any).setAntivirous(true);
          }}
        >
          true
        </button>
        <button
          onClick={() => {
            (window as any).setAntivirous(false);
          }}
        >
          false
        </button>
        <button
          onClick={() => {
            (window as any).setAntivirous();
          }}
        >
          恢复
        </button>
      </div>
      <div>
        self service 安装:
        <button
          onClick={() => {
            (window as any).setSelfService(true);
          }}
        >
          true
        </button>
        <button
          onClick={() => {
            (window as any).setSelfService(false);
          }}
        >
          false
        </button>
        <button
          onClick={() => {
            (window as any).setSelfService();
          }}
        >
          恢复
        </button>
      </div>
      <div>
        workspace one 安装:
        <button
          onClick={() => {
            (window as any).setWorkspaceOne(true);
          }}
        >
          true
        </button>
        <button
          onClick={() => {
            (window as any).setWorkspaceOne(false);
          }}
        >
          false
        </button>
        <button
          onClick={() => {
            (window as any).setWorkspaceOne();
          }}
        >
          恢复
        </button>
      </div>
    </div>
  );
};
