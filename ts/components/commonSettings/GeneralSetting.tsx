import React, { Component } from 'react';
import { LocalizerType } from '../../types/Util';
import { SettingChooseItem } from './CommonSettingComponents';

interface GeneralProps {
  i18n: LocalizerType;
  title: string;
  closeSetting: () => void;
  accountLogout: () => void;
}

interface GeneralState {
  disableHardWareAcceleration: boolean;
  spellCheck: boolean;
  mediaPermissions: boolean;
  deviceName: string;
  quitTopicSetting: boolean;
}

const mainWindow = window as any;

const getInitialData = async () => ({
  deviceName: await mainWindow.getDeviceName(),
  spellCheck: await mainWindow.getSpellCheck(),
  mediaPermissions: await mainWindow.getMediaPermissions(),
  disableHardwareAcceleration:
    await mainWindow.getDisableHardwareAcceleration(),
  quitTopicSetting: await mainWindow.getQuitTopicSetting(),
});

export class GeneralSetting extends Component<GeneralProps, GeneralState> {
  constructor(props: Readonly<GeneralProps>) {
    super(props);

    this.state = {
      disableHardWareAcceleration: false,
      spellCheck: false,
      mediaPermissions: false,
      deviceName: '',
      quitTopicSetting: true,
    };

    getInitialData().then(
      data => {
        'use strict';

        this.setState({
          disableHardWareAcceleration: data.disableHardwareAcceleration,
          spellCheck: data.spellCheck,
          mediaPermissions: data.mediaPermissions,
          deviceName: data.deviceName,
          quitTopicSetting: data.quitTopicSetting,
        });
      },
      error => {
        'use strict';

        mainWindow.log.error(
          'settings.initialRequest error:',
          error && error.stack ? error.stack : error
        );
      }
    );
  }

  renderGeneralItems() {
    const { i18n } = this.props;
    const {
      disableHardWareAcceleration,
      spellCheck,
      mediaPermissions,
      quitTopicSetting,
    } = this.state;

    return (
      <div>
        <SettingChooseItem
          title={i18n('hardwareAccelerationDescription')}
          checked={disableHardWareAcceleration}
          mutliCheck={true}
          onChange={value => {
            mainWindow.setDisableHardwareAcceleration(value);
            this.setState({ disableHardWareAcceleration: value });
          }}
        />

        <SettingChooseItem
          title={i18n('spellCheckDescription')}
          checked={spellCheck}
          mutliCheck={true}
          onChange={value => {
            mainWindow.Events.setSpellCheck(value);
            this.setState({ spellCheck: value });
          }}
        />

        <SettingChooseItem
          title={i18n('mediaPermissionsDescription')}
          checked={mediaPermissions}
          mutliCheck={true}
          onChange={value => {
            mainWindow.setMediaPermissions(value);
            this.setState({ mediaPermissions: value });
          }}
        />

        <SettingChooseItem
          title={i18n('quitTopicDescription')}
          checked={quitTopicSetting}
          mutliCheck={true}
          onChange={value => {
            mainWindow.setQuitTopicSetting(value);
            this.setState({ quitTopicSetting: value });
          }}
        />
      </div>
    );
  }

  render() {
    const { i18n, closeSetting, title, accountLogout } = this.props;

    return (
      <div id="common-setting" className="common-setting">
        <div className="common-setting header-bg"></div>
        <div className="common-setting bottom-bg"></div>
        <div className="common-setting page-title"> {title} </div>
        <div
          className="common-setting close-button"
          onClick={closeSetting}
        ></div>
        <div className="setting-list-content sub-setting-content">
          {this.renderGeneralItems()}
          <div className="setting-device-line"></div>
          <div className="setting-device-name">
            {i18n('deviceName') + ' : ' + this.state.deviceName}
          </div>

          <div className="setting-logout" onClick={accountLogout}>
            {i18n('clearDataButton')}
          </div>
        </div>
      </div>
    );
  }
}
