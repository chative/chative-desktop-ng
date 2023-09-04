import React from 'react';
import { Tooltip } from 'antd';
import { LocalizerType } from '../types/Util';

type PropsType = {
  i18n: LocalizerType;
  rapidRole?: number;
  showTips?: boolean;
};

export const GroupRapidTag = (props: PropsType) => {
  const { i18n, rapidRole, showTips } = props;
  return (
    <>
      {rapidRole !== 0 &&
        rapidRole &&
        (showTips ? (
          <Tooltip
            mouseEnterDelay={0.8}
            overlayClassName={'antd-tooltip-cover'}
            placement="top"
            title={i18n(`rapid_${rapidRole}`)}
          >
            <div className={`global-group-rapid-${rapidRole}`} />
          </Tooltip>
        ) : (
          <div className={`global-group-rapid-${rapidRole}`} />
        ))}
    </>
  );
};
