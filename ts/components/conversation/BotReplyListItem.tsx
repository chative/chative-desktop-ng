import React /*, { useEffect, useState } */ from 'react';
import classNames from 'classnames';

import { MessageBody } from './../conversation/MessageBody';
import { LocalizerType } from '../../types/Util';
import { pick } from 'lodash';

export type PropsData = {
  txt?: string;
  img?: string;
  isSelected: boolean;
};

export type ClickEvent = {
  button: number;
  pageX: number;
  pageY: number;
};

type PropsHousekeeping = {
  i18n: LocalizerType;
  style?: Object;
  onClick?: (c: any, event?: ClickEvent) => void;
  onDoubleClick?: (id: string, event?: any) => void;
};

type Props = PropsData & PropsHousekeeping;

export class BotReplyListItem extends React.Component<Props> {
  public wrapperRef: React.RefObject<HTMLDivElement>;
  private clickTimeout: NodeJS.Timeout | null;

  public constructor(props: Props) {
    super(props);
    this.wrapperRef = React.createRef();
    this.handleClick = this.handleClick.bind(this);
    this.clickTimeout = null;
  }

  public renderImg() {
    // const { img } = this.props;
    return <div className={'module-bot-reply-list-item-img'}></div>;
  }

  public renderTxt() {
    const { i18n, txt /*,img */ } = this.props;
    // @ts-ignore
    return (
      <div className="module-conversation-list-item__message">
        <div
          className={classNames('module-bot-reply-list-item__message__text')}
        >
          <MessageBody
            text={txt || ''}
            disableJumbomoji={true}
            disableLinks={true}
            i18n={i18n}
            // notificationSetting={notificationSetting}
          />
        </div>
      </div>
    );
  }

  handleClick(event: MouseEvent) {
    if (event && event.button === 0) {
      $('.module-conversation-list-item').css('outline', 'none');
    }
    if (
      event &&
      event.button === 2 &&
      this.wrapperRef?.current &&
      this.wrapperRef.current.contains(event.target as Node)
    ) {
      // 右击
      $('.module-conversation-list-item').css('outline', 'none');
      this.wrapperRef.current.style.outline = '#2090ea solid 1px';
      this.wrapperRef.current.style.outlineOffset = '-1px';
      window.dispatchEvent(
        new CustomEvent('conversation-operation', {
          detail: { event, refCurrent: this.wrapperRef.current },
        })
      );
    }
  }

  componentDidMount() {
    document.addEventListener('mousedown', this.handleClick);
  }

  componentWillUnmount() {
    document.removeEventListener('mousedown', this.handleClick);
  }

  public render() {
    // @ts-ignore
    const { onClick, c, /* onDoubleClick ,*/ /*isSelected*/ style } =
      this.props;

    return (
      <div
        ref={this.wrapperRef}
        role="button"
        onMouseDown={event => {
          console.log('BotListItem.tx onMouseDown.');
          const clickEvent = pick(event || {}, ['button', 'pageX', 'pageY']);

          if (event?.button === 2) {
            // right click
            if (onClick) {
              onClick(c, clickEvent);
            }
          } else {
            if (this.clickTimeout) {
              console.log('BotListItem.tx this.clickTimeout NOT NULL.');
            }

            if (!this.clickTimeout && onClick) {
              this.clickTimeout = setTimeout(() => {
                onClick(c, clickEvent);
                this.clickTimeout = null;
              }, 300);
            }
          }
        }}
        style={{ ...style, left: '8px', right: '8px', width: 'auto' }}
        className={classNames('module-bot-reply-list-item')}
      >
        <div
          className="module-bot-reply-list-item__content"
          style={{ maxWidth: '450px' }}
        >
          {this.renderImg()}
          {this.renderTxt()}
        </div>
      </div>
    );
  }
}
