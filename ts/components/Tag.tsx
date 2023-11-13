import React from 'react';
import { Tooltip } from 'antd';
import { LocalizerType } from '../types/Util';
type PropsType = {
  i18n: LocalizerType;
  tagName: string;
  showTips: boolean;
  site?: any;
};

export const Tag = (props: PropsType) => {
  const { i18n, tagName, showTips, site } = props;
  if (!tagName || tagName.length === 0) return null;
  return (
    <>
      {showTips ? (
        <Tooltip
          mouseEnterDelay={0.8}
          overlayClassName={'antd-tooltip-cover'}
          placement={site ? site : 'top'}
          title={i18n(`tag_${tagName}`)}
        >
          <div className={`global-tag-${tagName}`} />
        </Tooltip>
      ) : (
        <div className={`global-tag-${tagName}`} />
      )}
    </>
  );
};
