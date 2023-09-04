import React from 'react';
import emojiRegex from 'emoji-regex';
import LinkifyIt from 'linkify-it';
import { RiskCheckDialog } from './RiskCheckDialog';

import { LocalizerType, RenderTextCallbackType } from '../../types/Util';
import { MentionUser } from './MentionUser';

const REGEXP = emojiRegex();
const linkify = LinkifyIt();

linkify.add('difft:', 'http:');
linkify.add('chative:', 'http:');

// https://stackoverflow.com/questions/43242440/javascript-regular-expression-for-unicode-emoji
// https://regex101.com/r/ZP389q/3
// const EMOJI_REG =
//   /[\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}\u{1f1e6}-\u{1f1ff}\u{1f191}-\u{1f251}\u{1f004}\u{1f0cf}\u{1f170}-\u{1f171}\u{1f17e}-\u{1f17f}\u{1f18e}\u{3030}\u{2b50}\u{2b55}\u{2934}-\u{2935}\u{2b05}-\u{2b07}\u{2b1b}-\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}]/gu;

interface Props {
  text: string;
  i18n: LocalizerType;
  mentions?: Array<any>;
  /** Allows you to customize now non-links are rendered. Simplest is just a <span>. */
  renderNonLink?: RenderTextCallbackType;
  checkUrlResult?: any;
  getUrlCheckResult: (url: string) => any;
}
interface State {
  showRiskCheckDialog: boolean;
  onclickUrl?: string;
  checkResult?: any;
}

const SUPPORTED_PROTOCOLS = /^(http|https|difft|chative):/i;
const HAS_AT = /@/;
const START_WITH_LETTER_OR_NUMBER = /^[A-Z0-9]/i;

export class Linkify extends React.Component<Props, State> {
  hrefClickBind: (
    event: React.MouseEvent<HTMLAnchorElement, MouseEvent>
  ) => void;

  constructor(props: Readonly<Props>) {
    super(props);
    this.hrefClickBind = this.hrefClick.bind(this);
    this.state = {
      showRiskCheckDialog: false,
      onclickUrl: '',
    };
  }

  async check(url: string) {
    let result = await (window as any).Signal.Data.getUrlRiskInfo(url);
    return result;
  }

  public static defaultProps: Partial<Props> = {
    renderNonLink: ({ text }) => text,
  };

  public renderRiskCheckDialog(url: string | undefined) {
    const { /*checkUrlResult,*/ i18n } = this.props;
    const { showRiskCheckDialog, checkResult } = this.state;
    if (!showRiskCheckDialog || !url || !checkResult) {
      return;
    }

    // @ts-ignore
    return (
      <>
        <RiskCheckDialog
          checkResult={checkResult}
          onClose={() => {
            this.setState({
              showRiskCheckDialog: false,
            });
          }}
          onDoAlways={() => {
            this.setState({
              showRiskCheckDialog: false,
            });
            (window as any).sendBrowserOpenUrl(url);
          }}
          showRiskCheckDialog={showRiskCheckDialog}
          onclickUrl={url}
          i18n={i18n}
        ></RiskCheckDialog>
      </>
    );
  }

  // @ts-ignore
  public async hrefClick(
    event: React.MouseEvent<HTMLAnchorElement, MouseEvent>
  ) {
    const href = event?.currentTarget?.href;
    if (!href) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    const { /*checkUrlResult, i18n,*/ getUrlCheckResult } = this.props;

    try {
      // const noLastSlashHref = href.replace(/([\w\W]+)\/$/, '$1'); //可能存在因为末尾是"/"，导致无法匹配的问题，需要对"/"处理一下
      let hrefResult;
      let noLastSlashHrefResult;
      hrefResult = await getUrlCheckResult(href);
      // noLastSlashHrefResult = await getUrlCheckResult(noLastSlashHref);

      // disable RiskCheckDialog
      if (
        true ||
        (hrefResult && hrefResult.status === 1) ||
        (noLastSlashHrefResult && noLastSlashHrefResult.status === 1)
      ) {
        (window as any).sendBrowserOpenUrl(href);
      } else {
        this.setState({
          showRiskCheckDialog: true,
          onclickUrl: href,
          checkResult:
            hrefResult.status >= noLastSlashHrefResult.status
              ? hrefResult
              : noLastSlashHrefResult,
        });
      }
    } catch (e) {
      (window as any).log.info('click invalid link', e);
      (window as any).noticeError('Invalid URL!');
    }
  }

  public shouldShowBiggerEmoji(s: string) {
    if (s.length > 16) {
      return false;
    }

    // if (s.match(EMOJI_REG)) {
    //   // @ts-ignore
    //   let segmenter = new Intl.Segmenter({ granularity: 'grapheme' });
    //   let segments = segmenter.segment(s);
    //   return Array.from(segments).length === 1;
    // }
    // return false;

    let emojiCount = 0;
    let isOnlyEmoji;
    //@ts-ignore
    const items = s.matchAll(REGEXP);
    for (const match of items) {
      isOnlyEmoji = match[0] === s;
      emojiCount += 1;
    }
    return isOnlyEmoji && emojiCount === 1;
  }

  public analyzeURL(text: string, start: number) {
    const { showRiskCheckDialog, onclickUrl } = this.state;
    const matchData = linkify.match(text) || []; //匹配的链接文本
    const results: Array<any> = [];
    let last = 0;
    let count = start * 10000;

    if (this.shouldShowBiggerEmoji(text)) {
      return (
        <span style={{ fontSize: '26px', lineHeight: '32px' }} key={count++}>
          {text}
        </span>
      );
    }

    if (matchData.length === 0) {
      return <span key={count++}>{text}</span>;
    }

    matchData.forEach(
      (match: {
        index: number;
        url: string;
        lastIndex: number;
        text: string;
      }) => {
        if (last < match.index) {
          const textWithNoLink = text.slice(last, match.index);
          results.push(<span key={count++}>{textWithNoLink}</span>);
        }

        const { url, text: originalText } = match;

        const isTextStartWithLetterOrNumber =
          START_WITH_LETTER_OR_NUMBER.test(originalText);
        if (
          isTextStartWithLetterOrNumber &&
          SUPPORTED_PROTOCOLS.test(url) &&
          !HAS_AT.test(url)
        ) {
          // 默认使用https
          if (url === 'http://' + originalText) {
            results.push(
              <a
                key={count++}
                href={'https://' + originalText}
                onClick={this.hrefClickBind}
              >
                {originalText}
              </a>
            );
          } else {
            results.push(
              <a key={count++} href={url} onClick={this.hrefClickBind}>
                {originalText}
              </a>
            );
          }
        } else {
          results.push(<span key={count++}>{originalText}</span>);
        }
        last = match.lastIndex;
      }
    );

    if (last < text.length) {
      results.push(<span key={count++}>{text.slice(last)}</span>);
    }

    // if (showRiskCheckDialog){
    //   results.push(this.renderRiskCheckDialog(onclickUrl));
    // }
    // return results;
    return (
      <>
        {results}
        {showRiskCheckDialog ? this.renderRiskCheckDialog(onclickUrl) : null}
      </>
    );
  }

  public analyzeText(text: string, mentions: Array<any> | undefined) {
    if (!mentions || mentions.length === 0) {
      return this.analyzeURL(text, 0);
    }

    // 必须排序，否则无法遍历数组
    mentions.sort((left: any, right: any) => {
      return left.start - right.start;
    });

    let mergedSpans: any[] = [];
    let index = 0;
    let curPosition = 0;
    while (index < mentions.length) {
      const { start, length, uid, type } = mentions[index];

      // check params
      if (start < curPosition) {
        console.log(
          'Linkify.tsx Bad message mentions params:' +
            text +
            '===>' +
            JSON.stringify(mentions)
        );
        break;
      }

      // prefix
      const prefixString = text.substring(curPosition, start);
      if (prefixString) {
        mergedSpans = mergedSpans.concat(this.analyzeURL(prefixString, index));
      }

      // mention
      mergedSpans.push(
        <MentionUser
          key={uid + index}
          text={text.substring(start, start + length)}
          uid={uid}
          type={type}
        />
      );

      // curPosition
      curPosition = start + length;

      index += 1;
    }

    const lastString = text.substring(curPosition);
    if (lastString) {
      const result = this.analyzeURL(lastString, index);
      if (result) {
        for (let i = 0; i < result.props.children.length; i++) {
          mergedSpans = mergedSpans.concat(result.props.children[i]);
        }
      }
      // mergedSpans = mergedSpans.concat(this.analyzeURL(lastString, index));
    }

    return mergedSpans;
  }

  public render() {
    const { text, mentions } = this.props; //整个文本
    return this.analyzeText(text, mentions);
  }
}
