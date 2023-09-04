import React from 'react';
import { Tooltip } from 'antd';
import classNames from 'classnames';
import { v4 as uuidv4 } from 'uuid';

import { Menu, MenuHeader, MenuItem, MenuRadioGroup } from '@szhsin/react-menu';
import { LocalizerType } from '../../types/Util';

export interface Language {
  lang: string;
  name: string;
}

interface Props {
  i18n: LocalizerType;
  targetLang?: string;
  onChangeTranslation: (targetLang?: string) => void;
  supportedLanguages: Array<Language>;
  buttonClassNames?: Array<string>;
}

export class TranslateMenu extends React.Component<Props> {
  public renderMenuItems() {
    const { supportedLanguages, i18n } = this.props;

    const menuItems: any[] = [];

    menuItems.push(
      <MenuHeader key={uuidv4()}>{i18n('translateTitle')}</MenuHeader>
    );

    for (let item of supportedLanguages) {
      menuItems.push(
        <MenuItem key={uuidv4()} type="radio" value={item.lang}>
          {item.name}
        </MenuItem>
      );
    }

    return menuItems;
  }

  public renderMenu() {
    const { targetLang, onChangeTranslation, buttonClassNames, i18n } =
      this.props;

    return (
      <Menu
        menuButton={
          <div>
            <Tooltip
              mouseEnterDelay={1.5}
              overlayClassName={'antd-tooltip-cover'}
              placement="top"
              title={i18n('autoTranslateTooltip')}
            >
              <button className={classNames('translation', buttonClassNames)} />
            </Tooltip>
          </div>
        }
        menuStyle={{ fontSize: '14px' }}
      >
        <MenuRadioGroup
          value={targetLang}
          onRadioChange={e => onChangeTranslation(e.value)}
        >
          {this.renderMenuItems()}
        </MenuRadioGroup>
      </Menu>
    );
  }

  public render() {
    return <>{this.renderMenu()}</>;
  }
}
