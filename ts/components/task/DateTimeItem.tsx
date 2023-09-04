import React from 'react';
import moment from 'moment';

interface PropsType {
  disabled: boolean;
  timestamp: number;
  setTimestamp: (t: number) => void;
}

export default function DateTimeItem(props: PropsType) {
  // https://github.com/moment/moment/issues/3928
  const formatDatetime = (timestamp: number) => {
    return moment(timestamp).format('YYYY-MM-DDTHH:mm');
  };

  const { timestamp, setTimestamp, disabled } = props;

  return (
    <input
      onKeyDown={e => e.preventDefault()}
      type="datetime-local"
      disabled={disabled}
      className={'task-date-time-input'}
      value={formatDatetime(timestamp)}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        setTimestamp(moment(e.target.value).valueOf());
      }}
    />
  );
}
