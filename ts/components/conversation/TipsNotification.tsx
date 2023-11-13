import React from 'react';
import { LocalizerType } from '../../types/Util';

interface Props {
  i18n: LocalizerType;
  code: number;
}

export class TipsNotification extends React.Component<Props> {
  public render() {
    const { code, i18n } = this.props;
    if (code === 404) {
      return (
        <div className="module-tips-notification">
          {i18n('number_not_register_error')}
        </div>
      );
    }
    if (code === 430) {
      // const openSupportBotUrl = 'chative://localAction/thread?tid=%2B10000';
      return (
        <div className="module-tips-notification">
          {i18n('different_subteam_error')}
          {/* <a href={openSupportBotUrl}>SupportBot</a> */}
        </div>
      );
    }
    if (code === 431) {
      return (
        <div className="module-tips-notification">
          {i18n('number_not_active_error')}
        </div>
      );
    }

    return null;
  }
}
