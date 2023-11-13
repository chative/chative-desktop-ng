import React, { Component } from 'react';
import { Dropdown, Menu } from 'antd';
import { LocalizerType } from '../../types/Util';
import moment from 'moment';

interface StatusSettingProps {
  i18n: LocalizerType;
  id: string;
}

interface StatusSettingState {
  status: number;
  expire: number;
}

enum StatusSetType {
  clear = 'clear',
  set_dont_distrub = 'set_dont_distrub',
  date_30minutes = 'date_30minutes',
  date_1hour = 'date_1hour',
  date_2hours = 'date_2hours',
  date_12hours = 'date_12hours',
  date_7days = 'date_7days',
  date_14days = 'date_14days',
}

export class StatusSetting extends Component<
  StatusSettingProps,
  StatusSettingState
> {
  constructor(props: Readonly<StatusSettingProps>) {
    super(props);

    this.state = {
      status: 0,
      expire: -1,
    };
  }

  componentDidMount() {
    const { id } = this.props;
    window.addEventListener(
      'event-user-status-changed',
      this.userStatusChanged
    );
    if ((window as any).userStatusReceiver) {
      if (id) {
        const v = (window as any).userStatusReceiver.addUserListen(id);
        if (v) {
          this.userStatusChanged(v);
        }
      }
    }
  }

  public componentWillUnmount = () => {
    window.removeEventListener(
      'event-user-status-changed',
      this.userStatusChanged
    );
  };

  public userStatusChanged = (event: any) => {
    const { id } = this.props;

    if (
      event &&
      event.detail &&
      event.detail.user &&
      event.detail.user === id
    ) {
      this.setState({ status: event.detail.status });
      if (event.detail.expire) {
        this.setState({ expire: event.detail.expire });
      }
    }
  };

  statusTitle() {
    const { i18n } = this.props;

    switch (this.state.status) {
      case 0:
        return i18n('active');
      case 1:
        return i18n('dont_distrub');
      case 2:
        return i18n('leave');
      case 3:
        return i18n('calling');
      case 5:
        return i18n('meeting');
      default:
        return '';
    }
  }

  timestampToLocal(timestamp: number) {
    const { i18n } = this.props;
    const isChinese = i18n('lang') === 'zh-CN';
    moment.locale(isChinese ? 'zh-cn' : 'en');

    let result = '';
    let dest = moment(timestamp);
    const hours = dest.hour();

    let timeStatus = '';
    if (hours === 12) {
      timeStatus = i18n('time_format_noon', ['']);
    }
    if (hours === 0) {
      timeStatus = i18n('time_format_midnight', ['']);
    }
    if (hours < 12) {
      timeStatus = i18n('time_format_am', ['']);
    }
    if (hours > 12) {
      timeStatus = i18n('time_format_pm', ['']);
    }

    if (isChinese) {
      result = dest.format('YYYY年 M月 D日 HH:mm');
    } else {
      result = dest.format('MMM D, YYYY, HH:mm');
    }
    return result + ' ' + timeStatus;
  }

  statusDateTitle() {
    const { i18n } = this.props;
    if (this.state.status === 1 && this.state.expire != -1) {
      return (
        i18n('until_time') + ' ' + this.timestampToLocal(this.state.expire)
      );
    } else {
      return '';
    }
  }

  statusRingIconClassName() {
    if (this.state.status === 1 && this.state.expire > 0) {
      return 'setting-status-ring-icon ring-disable';
    } else {
      return 'setting-status-ring-icon';
    }
  }

  render() {
    const { i18n } = this.props;

    const mainWindow = window as any;

    const showNoDistrubDate = this.state.status === 1;

    const itemOnClick = (e: any) => {
      switch (e.key) {
        case StatusSetType.clear:
          mainWindow.updateNoDisturbStatus(1, 0);
          break;
        case StatusSetType.date_30minutes:
          mainWindow.updateNoDisturbStatus(1, 30 * 60);
          break;

        case StatusSetType.date_1hour:
          mainWindow.updateNoDisturbStatus(1, 60 * 60);
          break;

        case StatusSetType.date_2hours:
          mainWindow.updateNoDisturbStatus(1, 2 * 60 * 60);
          break;

        case StatusSetType.date_12hours:
          mainWindow.updateNoDisturbStatus(1, 12 * 60 * 60);
          break;
        case StatusSetType.date_7days:
          mainWindow.updateNoDisturbStatus(1, 7 * 24 * 60 * 60);
          break;

        case StatusSetType.date_14days:
          mainWindow.updateNoDisturbStatus(1, 14 * 24 * 60 * 60);
          break;
      }
    };

    const menu = (
      <Menu
        onClick={itemOnClick}
        items={[
          showNoDistrubDate
            ? {
                label: i18n(StatusSetType.clear),
                className: 'status-drop-down-item',
                key: StatusSetType.clear,
              }
            : null,
          showNoDistrubDate
            ? {
                type: 'divider',
              }
            : null,
          {
            label: i18n(StatusSetType.set_dont_distrub),
            className: 'status-drop-down-item drop-down-item-disable',
            key: StatusSetType.set_dont_distrub,
            disabled: true,
          },
          {
            label: i18n(StatusSetType.date_30minutes),
            className: 'status-drop-down-item',
            key: StatusSetType.date_30minutes,
          },
          {
            label: i18n(StatusSetType.date_1hour),
            className: 'status-drop-down-item',
            key: StatusSetType.date_1hour,
          },
          {
            label: i18n(StatusSetType.date_2hours),
            className: 'status-drop-down-item',
            key: StatusSetType.date_2hours,
          },
          {
            label: i18n(StatusSetType.date_12hours),
            className: 'status-drop-down-item',
            key: StatusSetType.date_12hours,
          },
          {
            label: i18n(StatusSetType.date_7days),
            className: 'status-drop-down-item',
            key: StatusSetType.date_7days,
          },
          {
            label: i18n(StatusSetType.date_14days),
            className: 'status-drop-down-item',
            key: StatusSetType.date_14days,
          },
        ]}
      />
    );

    return (
      <Dropdown
        overlay={menu}
        trigger={['click']}
        overlayClassName={'status-drop-down-content'}
        transitionName={''}
      >
        <div className="setting-status-content">
          <div className="setting-status-text-content">
            <div className="setting-status-title">{this.statusTitle()}</div>
            {showNoDistrubDate ? (
              <div className="setting-status-date">
                {this.statusDateTitle()}
              </div>
            ) : null}
          </div>
          <div className={this.statusRingIconClassName()}></div>
          <div className="setting-status-line"></div>
          <div className="setting-status-dropdown-icon"></div>
        </div>
      </Dropdown>
    );
  }
}
