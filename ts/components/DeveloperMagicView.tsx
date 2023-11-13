import React from 'react';

export const DeveloperMagicView = () => {
  return (
    <div>
      <button onClick={(window as any).mainWindowOpenDevTools}></button>
      <button onClick={(window as any).exportLocalCert}></button>
    </div>
  );
};
