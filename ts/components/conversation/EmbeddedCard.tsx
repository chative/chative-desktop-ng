import React, { useEffect, useRef, useState } from 'react';
import { LocalizerType } from '../../types/Util';
import classNames from 'classnames';
import { RiskCheckDialog } from './RiskCheckDialog';
const markDown = require('markdown-it')({
  // Enable everything
  breaks: true,
  html: false,
  linkify: true,
  // typographer: true,
});
// const emoji = require('markdown-it-emoji');
// // const sub = require('markdown-it-sub');
// // const sup = require('markdown-it-sup');
// // const ins = require('markdown-it-ins');
// // const mark = require('markdown-it-mark');
// // const footnote = require('markdown-it-footnote');
// // const deflist = require('markdown-it-deflist');
// // markDown.use(ins);
// // markDown.use(emoji);
// // markDown.use(mark);
// // markDown.use(ins);
// // markDown.use(footnote);
// // markDown.use(sub);
// // markDown.use(sup);
// // markDown.use(deflist);

export interface CardType {
  appId: string;
  cardId: string;
  version: number;
  creator: string;
  timestamp: number;
  content: string;
  contentType: ContentType;
  type: Type;
  fixedWidth: boolean;
  urlHandle: CardURLHandleType | undefined;
  height?: number;
}
interface ContentType {
  MARKDOWN: number;
  ADAPTIVECARD: number;
}
enum CardURLHandleType {
  External,
  Internal,
}
interface Type {
  INSERT: number;
  UPDATE: number;
}
interface PropsType {
  i18n: LocalizerType;
  card?: CardType;
  conversationId?: string;
  getUrlCheckResult: (url: string) => any;
}

const useForceRerender = () => {
  const [, setValue] = useState(0);
  return () => setValue(value => value + 1);
};

const useIsElementVisible = (target: Element | null, options = undefined) => {
  const [isVisible, setIsVisible] = useState(false);
  const forceUpdate = useForceRerender();

  useEffect(() => {
    forceUpdate();
  }, []);

  useEffect(() => {
    if (!target) {
      return;
    }

    const observer = new IntersectionObserver(
      entries => setIsVisible(entries[0].isIntersecting),
      options
    );
    observer.observe(target);

    return () => observer.unobserve(target);
  }, [target, options]);

  return isVisible;
};

const DEFAULT_MAX_HEIGHT = 360;
export default function EmbeddedCard(props: PropsType) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const contentHeightRef = useRef<any>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [actionLess, setActionLess] = useState(false);
  const [showAction, setShowAction] = useState<boolean | undefined>(undefined);
  const [showRiskCheckDialog, setShowRiskCheckDialog] = useState(false);
  const [cardData, setCardData] = useState({});
  const [checkResult, setCheckResult] = useState({ status: 2, reason: '' });

  const { card, i18n } = props;
  const { content, fixedWidth, height } = card || {};
  if (!content) {
    return null;
  }

  const isCardVisible = useIsElementVisible(bodyRef?.current);

  // calc x, y
  const calcXY = (rect: DOMRect | undefined) => {
    if (!rect) {
      return undefined;
    }

    const padding = 8;
    const profileDialogHeight = 480 + 36;
    const profileDialogWidth = 280;

    const maxY = window.innerHeight - profileDialogHeight - padding;
    const maxX = window.innerWidth - profileDialogWidth - padding;

    const x = rect.x + rect.width + padding;
    const y = Math.max(
      rect.y - profileDialogHeight / 2 + rect.height / 2,
      padding
    );

    // 右侧空间足够
    if (x <= maxX) {
      return { x, y: Math.min(y, maxY) };
    }

    // 右侧空间不够，左侧显示
    return {
      x: Math.max(rect.x - profileDialogWidth - padding, padding),
      y: Math.min(y, maxY),
    };
  };

  useEffect(() => {
    if (!isCardVisible || showAction !== undefined) {
      return;
    }

    const dom = contentRef?.current as HTMLDivElement;
    if (dom && dom.offsetHeight) {
      calcHeight();
    }
  });

  const calcHeight = () => {
    const maxHeight = height || DEFAULT_MAX_HEIGHT;
    const element = contentRef?.current as HTMLDivElement;
    const contentHeight = element.offsetHeight;
    contentHeightRef.current = contentHeight;
    if (contentHeight >= maxHeight) {
      element.style.maxHeight = maxHeight + 'px';
      element.style.overflow = 'hidden';
      setShowAction(true);
    } else {
      setShowAction(false);
    }
  };

  const renderAction = () => {
    return (
      <div onClick={action} className={'markdown-action-box'}>
        <div className={'markdown-action'}>
          {actionLess ? i18n('markdown-read-less') : i18n('markdown-read-more')}
        </div>
        <div
          className={classNames(
            'markdown-read',
            actionLess ? 'markdown-read-less' : 'markdown-read-more'
          )}
        />
      </div>
    );
  };
  const renderRiskCheckDialog = (cardData: any) => {
    if (!showRiskCheckDialog || !checkResult) {
      return;
    }
    const { url, appId, pos, conversationId } = cardData;
    return (
      <>
        <RiskCheckDialog
          checkResult={checkResult}
          onClose={() => {
            setShowRiskCheckDialog(false);
          }}
          showRiskCheckDialog={showRiskCheckDialog}
          onclickUrl={url}
          i18n={i18n}
          onDoAlways={() => {
            setShowRiskCheckDialog(false);
            (window as any).sendBrowserOpenUrl(url, appId, pos, conversationId);
          }}
        ></RiskCheckDialog>
      </>
    );
  };

  const action = () => {
    const element = contentRef?.current as HTMLDivElement;
    const originHeight = contentHeightRef.current; // 原始高度
    if (actionLess) {
      element.style.maxHeight = (height || DEFAULT_MAX_HEIGHT) + 'px';
      setActionLess(false);
    } else {
      const maxHeight = parseInt(element.style.maxHeight) || 0;
      const addHeight = maxHeight + 3000;
      element.style.maxHeight = addHeight + 'px';
      if (addHeight < originHeight) {
        return;
      }
      setActionLess(true);
    }
  };

  const handleTarget = (target: HTMLAnchorElement) => {
    if (target) {
      const rect = bodyRef?.current?.getBoundingClientRect();
      const pos = calcXY(rect);
      // 本身就是一个 a 链接
      if (target.href) {
        if (card?.urlHandle == CardURLHandleType.Internal) {
          // todo: open mini progam
        } else {
          handleHref(target, pos);
        }
        return;
      }
      // 查看父元素是否有 a 标签
      let currentNode = target;
      while (true) {
        currentNode = currentNode?.parentNode as HTMLAnchorElement;
        if (!currentNode) {
          break;
        }
        if (currentNode.href) {
          if (card?.urlHandle == CardURLHandleType.Internal) {
            // todo: open mini progam
          } else {
            handleHref(currentNode, pos);
          }

          break;
        }
      }
    }
  };

  const handleHref = async (target: HTMLAnchorElement, pos: any) => {
    const href = target.getAttribute('href');
    if (!href) {
      return;
    }

    try {
      const data = (window as any).Signal.Util.urlMatch(href);
      // const noLastSlashHref = data[0].replace(/([\w\W]+)\/$/, '$1'); //可能存在因为末尾是"/"，导致无法匹配的问题，需要对"/"处理一下
      const conversationId = (window as any).Signal.ID.convertIdToV2(
        props.conversationId
      );

      let hrefResult;
      let noLastSlashHrefResult;
      // hrefResult = await props.getUrlCheckResult(data[0]);
      // noLastSlashHrefResult = await props.getUrlCheckResult(noLastSlashHref);

      // disable RiskCheckDialog
      if (
        true ||
        (hrefResult && hrefResult.status === 1) ||
        (noLastSlashHrefResult && noLastSlashHrefResult.status === 1)
      ) {
        (window as any).sendBrowserOpenUrl(
          // data?.[0],
          href, // 为保证准确，这边先用 href 去跳转
          card?.appId,
          pos,
          conversationId
        );
      } else {
        setCheckResult(
          hrefResult.status >= noLastSlashHrefResult.status
            ? hrefResult
            : noLastSlashHrefResult
        );
        setShowRiskCheckDialog(true);
        setCardData({
          url: data[0],
          appId: card?.appId,
          pos,
          conversationId,
        });
      }
    } catch (e) {
      (window as any).log.info('click invalid link', e);
      (window as any).noticeError('Invalid URL!');
    }
  };

  const result = markDown.render(content);
  return (
    <div
      ref={bodyRef}
      className={classNames('markdown-body-box')}
      style={{ width: fixedWidth ? '320px' : '100%' }}
    >
      <div
        ref={contentRef}
        className={classNames(
          'markdown-body',
          showAction && 'markdown-body-show-action'
        )}
        dangerouslySetInnerHTML={{ __html: result }}
        onClick={(event: React.MouseEvent<HTMLElement, MouseEvent>) => {
          event.preventDefault();
          event.stopPropagation();
          const target = event.target as HTMLAnchorElement;
          handleTarget(target);
        }}
      />
      {showAction && renderAction()}
      {showRiskCheckDialog && renderRiskCheckDialog(cardData)}
    </div>
  );
}
