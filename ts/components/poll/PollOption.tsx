import React, { useRef, useEffect } from 'react';
import { LocalizerType } from '../../types/Util';

interface PropsType {
  i18n: LocalizerType;
  text: string;
  disableIcon: boolean;
  max_poll_option_text_length: number;
  updateText: (text: string) => void;
  remove: () => void;
}

export default function PollOption(props: PropsType) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      (window as any).autosize(textareaRef.current);
    }
  }, []);

  return (
    <div className={'option-item'}>
      <span
        className={
          props.disableIcon ? 'vote-reduce-icon-gray' : 'vote-reduce-icon-red'
        }
        onClick={props.remove}
      />
      <textarea
        ref={textareaRef}
        className={'text'}
        value={props.text}
        maxLength={props.max_poll_option_text_length}
        spellCheck={false}
        autoFocus={true}
        placeholder={props.i18n('creating_poll_option_placeholder')}
        onChange={e => {
          const text = e.target.value || '';
          props.updateText(text);
        }}
      />
    </div>
  );
}
