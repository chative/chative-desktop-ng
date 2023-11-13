import React from 'react';

interface PropsType {
  type: number;
  selected: boolean;
  setType: () => void;
  disabled: boolean;
}

export default function PriorityItem(props: PropsType) {
  const { type, selected, disabled } = props;
  return (
    <div
      className={disabled ? 'not-allow-pointer' : 'pointer'}
      style={{
        display: 'inline-block',
        marginRight: '32px',
        fontSize: '13px',
        position: 'relative',
      }}
      onClick={() => {
        props.setType();
      }}
    >
      <input
        disabled={disabled}
        style={{ pointerEvents: 'none' }}
        type={'checkbox'}
        className={'app-checkbox'}
        checked={selected}
        onChange={() => {}}
      />
      <span className={'priority' + (type - 1)} />
      <span>{'P' + (type - 1)}</span>
    </div>
  );
}
