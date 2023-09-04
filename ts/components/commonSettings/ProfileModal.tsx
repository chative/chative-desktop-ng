import { ReactElement, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

type Props = {
  modelClassName?: string;
  children: ReactElement;
  onClose: () => void;
};

export default function ProfileModal(props: Props) {
  const className = props.modelClassName || 'profile-modal';
  const classSelector = `.${className}`;

  const [el] = useState(document.querySelector(classSelector) as HTMLElement);

  if (!el) {
    throw new Error('The element .modal was not found!');
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e && e.key === 'Escape') {
      props?.onClose();
    }
  };

  useEffect(() => {
    el.onmousedown = (e: MouseEvent) => {
      // @ts-ignore
      if (e?.target?.className === className) {
        props?.onClose();
      }
    };
    el.setAttribute('style', 'display: flex');
    window.addEventListener('keydown', onKeyDown);
    return () => {
      el.setAttribute('style', 'display: none');
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return ReactDOM.createPortal(props.children, el);
}
