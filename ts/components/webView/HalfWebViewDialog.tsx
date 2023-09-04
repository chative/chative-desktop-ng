import React from 'react';
import { LocalizerType } from '../../types/Util';
import PollModal from '../PollModal';
import { Spin } from 'antd';

interface Props {
  webviewHttpUrl: string;
  webviewAppId: string;
  i18n: LocalizerType;
  onCancel: () => void;
}

type State = {
  title: string;
  onError: boolean;
  loading: boolean;
  whiteUrlReg: Array<any>;
  iframeRandomParam: string;
  botId: string | undefined;
  code: number;
};

const NORMAL_RESPONSE = {
  ver: '1.0',
  action: '',
  status: 200,
  reason: 'OK',
  data: {},
};

export class HalfWebViewDialog extends React.Component<Props, State> {
  constructor(props: Readonly<Props>) {
    super(props);
    this.state = {
      title: '',
      onError: false,
      loading: true,
      whiteUrlReg: [],
      iframeRandomParam: Date.now() + '-iframe',
      botId: '',
      code: 0, // 0-success, 1-unknown, -1-network error, 2-url不合法, 3-postmessage收到非法origin数据 , httpCode
    };
  }

  // 正则校验， 顺便获取 botId
  public initReg() {
    let miniProgramList = [] as any;
    if ((window as any).getMiniProgramList) {
      miniProgramList = (window as any)?.getMiniProgramList() || [];
    }
    let allowedUrls = [];
    let botId;
    for (let i = 0; i < miniProgramList.length; i++) {
      if (miniProgramList[i].appId === this.props.webviewAppId) {
        allowedUrls = miniProgramList[i].allowedUrls;
        botId = miniProgramList[i]?.supportBot;
        break;
      }
    }
    const whiteUrlReg = [];
    for (let i = 0; i < allowedUrls.length; i++) {
      const reg = new RegExp(allowedUrls[i]);
      whiteUrlReg.push(reg);
    }
    this.setState({ whiteUrlReg, botId });
  }

  public async componentDidMount() {
    window.onmessage = this.handelMessage;
    window.addEventListener(
      'conversation-close-create-poll-dialog',
      this.closeSelf
    );
    this.initReg(); // 初始化正则校验字符串列表
    this.loadAndVerifyIframeUrl();
  }

  public loadAndVerifyIframeUrl = async () => {
    try {
      // 初始化状态
      this.setState({ loading: true, code: 0, onError: false });
      const { webviewAppId, webviewHttpUrl } = this.props;

      // 设置一个最大事件定时器，最大时间15秒
      const loadMaxtimer = setTimeout(() => {
        this.setState({
          loading: false,
          onError: true,
          code: -1,
        });
      }, 15000);

      const code = await this.webviewUrlVerify(webviewAppId, webviewHttpUrl);
      if (code === 0) {
        this.finalVerify();
      } else {
        this.setState({
          code,
          onError: true,
        });
      }

      // 给个最短的加载时间，交互看起来更友好
      await new Promise(resolve => {
        setTimeout(() => {
          this.setState({ loading: false });
          resolve(true);
        }, 200);
      });

      // 清除定时器
      clearTimeout(loadMaxtimer);
    } catch (e: any) {
      const code = e.name === 'HTTPError' ? e.code : 1;
      this.setState({
        code,
        onError: true,
      });
    }
  };

  public webviewUrlVerify = async (_appId: string, httpUrl: string) => {
    let miniProgramList = [] as any;
    if ((window as any).getMiniProgramList) {
      miniProgramList = (window as any)?.getMiniProgramList();
    }
    if (miniProgramList) {
      if (miniProgramList.length === 0) return 1;
      for (let i = 0; i < miniProgramList.length; i += 1) {
        const { allowedUrls, appId } = miniProgramList[i];
        if (_appId === appId) {
          for (let j = 0; j < allowedUrls.length; j += 1) {
            const re = new RegExp(allowedUrls[j]);
            if (re.test(httpUrl)) {
              return 0;
            }
          }
          return 2;
        }
      }
      return 2;
    } else {
      if (!window.navigator.onLine) return -1;
      try {
        if ((window as any).fetchMiniProgramList) {
          miniProgramList = await (window as any).fetchMiniProgramList();
        }
        if (!miniProgramList || miniProgramList.length === 0) return 2;
        for (let i = 0; i < miniProgramList.length; i += 1) {
          const { allowedUrls, appId } = miniProgramList[i];
          if (_appId === appId) {
            for (let j = 0; j < allowedUrls.length; j += 1) {
              const re = new RegExp(allowedUrls[j]);
              if (re.test(httpUrl)) {
                return 0;
              }
            }
            return 2;
          }
        }
        return 2;
      } catch (e: any) {
        if (e.name === 'HTTPError') {
          return e.code;
        } else {
          return 1;
        }
      }
    }
  };

  // 校验URL成功后走到这边来进行最后的校验。
  public finalVerify = async () => {
    try {
      const userAgent = (window as any).getCustomUserAgent(
        this.props.webviewAppId
      );
      const existParam = this.props.webviewHttpUrl.includes('?');
      const timestamp = Date.now();
      const param = (existParam ? '&t=' : '?t=') + timestamp;
      await (window as any)
        .getAccountManager()
        .pingURL(this.props.webviewHttpUrl + param, false, userAgent);

      this.setState({
        onError: false,
        code: 0,
      });
    } catch (e: any) {
      const code = e.name === 'HTTPError' ? e.code : 1;
      this.setState({
        code,
        onError: true,
      });
    }
  };

  public retryLoadIframe = async () => {
    if ((window as any)?.fetchMiniProgramList) {
      (window as any)?.fetchMiniProgramList(true);
      this.initReg();
    }
    this.loadAndVerifyIframeUrl();
  };

  public componentWillUnmount() {
    window.removeEventListener('message', this.handelMessage);
    window.removeEventListener(
      'conversation-close-create-poll-dialog',
      this.closeSelf
    );
  }

  public closeSelf = () => {
    this.props.onCancel();
  };

  public checkMiniProgramIframeExist() {
    const iframe = document.getElementById('webview') as any;
    if (!iframe) {
      return false;
    }
    return iframe;
  }

  public handelMessage = (event: MessageEvent) => {
    const { whiteUrlReg } = this.state;
    const iframe = this.checkMiniProgramIframeExist();
    if (!iframe) return;
    const { methodName, callbackid, params } = event.data || {};
    if (!event.origin || event.origin.length === 0) {
      console.error('Receive Message Origin Is Undefined!');
      this.setState({
        loading: false,
        onError: true,
        code: 3,
      });
      return;
    }

    let flag = false;
    for (let i = 0; i < whiteUrlReg.length; i++) {
      if (whiteUrlReg[i].test(event.origin)) {
        flag = true;
      }
    }
    if (!flag) {
      console.error('Receive Unknown Origin Message!');
      this.setState({
        loading: false,
        onError: true,
        code: 3,
      });
      return;
    }

    let response = { ...NORMAL_RESPONSE, action: methodName };
    switch (methodName) {
      case 'closePage':
        this.closePage(callbackid, methodName, response, iframe);
        return;
      case 'getMiniProgramToken':
        this.getToken(callbackid, methodName, response, iframe);
        return;
      case 'removeMiniProgramToken':
        this.removeToken(callbackid, methodName, response, iframe);
        return;
      case 'setTitle':
        this.setTitle(params, callbackid, methodName, response, iframe);
        return;
      case 'getTheme':
        this.getTheme(params, callbackid, methodName, response, iframe);
        return;
      case 'jumpConversation':
        this.jumpConversation(params, callbackid, methodName, response, iframe);
        return;
      default:
        response.status = 5011;
        response.reason = 'not supported';
        iframe.contentWindow.postMessage({ response, callbackid }, '*');
    }
  };

  public jumpConversation = (
    params: any,
    callbackid: any,
    methodName: any,
    response: any,
    iframe: any
  ) => {
    response.action = methodName;
    const { cid, type } = params || {};
    console.log('webview jump conversation', cid, type);
    if (!cid || !type || !['private', 'group'].includes(type)) {
      response.status = 5008;
      response.reason = 'Parameter exception';
    } else {
      const c = (window as any).ConversationController.get(cid);
      if (!c) {
        // 对于外部 webview 打开会话， 如果本地没有 id 对应的会话， 直接返回错误。
        const status = type === 'private' ? 5013 : 5014;
        const reason =
          type === 'private'
            ? 'Personal session jump failed'
            : 'Group session jump failed';
        response.status = status;
        response.reason = reason;
        // (window as any).noticeError(reason);
      } else {
        (window as any).jumpMessage({ conversationId: cid, type });
      }
    }
    iframe.contentWindow.postMessage({ response, callbackid }, '*');
  };

  public getToken = async (
    callbackid: string,
    methodName: any,
    response: any,
    iframe: any
  ) => {
    response.action = methodName;
    if (!(window as any).mpTokenManager) {
      //@ts-ignore
      (window as any).mpTokenManager = new MpTokenManager();
    }
    try {
      let tk = await (window as any).mpTokenManager.getAppToken(
        this.props.webviewAppId
      );
      if (tk && tk.status === 0 && tk.token) {
        console.log('token=', tk.token);
        response.data = { token: tk.token };
        iframe.contentWindow.postMessage({ response, callbackid }, '*');
      } else {
        response.data = { token: '' };
        iframe.contentWindow.postMessage({ response, callbackid }, '*');
      }
    } catch (e: any) {
      const code = e.name === 'HTTPError' ? e.code : 1;
      response.status = e.name === 'HTTPError' ? e.code : 200;
      response.reason =
        e.name === 'HTTPError' ? e.message : 'Authorized failed';
      iframe.contentWindow.postMessage({ response, callbackid }, '*');
      this.setState({
        onError: true,
        code: code,
      });
    }
  };

  public removeToken = async (
    callbackid: string,
    methodName: any,
    response: any,
    iframe: any
  ) => {
    response.action = methodName;
    if (!(window as any).mpTokenManager) {
      //@ts-ignore
      (window as any).mpTokenManager = new MpTokenManager();
    }

    try {
      (window as any).mpTokenManager.removeAppToken(this.props.webviewAppId);
      iframe.contentWindow.postMessage({ response, callbackid }, '*');
    } catch (e: any) {
      const code = e.name === 'HTTPError' ? e.code : 1;
      response.status = e.name === 'HTTPError' ? e.code : 200;
      response.reason =
        e.name === 'HTTPError' ? e.message : 'removeToken failed';
      iframe.contentWindow.postMessage({ response, callbackid }, '*');
      this.setState({
        onError: true,
        code: code,
      });
    }
  };

  public setTitle = (
    params: any,
    callbackid: string,
    methodName: any,
    response: any,
    iframe: any
  ) => {
    response.action = methodName;
    this.setState({
      title: params?.title || '',
    });
    iframe.contentWindow.postMessage({ response, callbackid }, '*');
  };

  public getTheme = (
    _params: any,
    callbackid: string,
    methodName: any,
    response: any,
    iframe: any
  ) => {
    response.action = methodName;
    let theme = (window as any).Events.getThemeSetting();
    if (theme === 'system') {
      theme = (window as any).systemTheme;
    }
    response.data.theme = theme;
    iframe.contentWindow.postMessage({ response, callbackid }, '*');
  };

  public closePage = (
    callbackid: string,
    methodName: any,
    response: any,
    iframe: any
  ) => {
    response.action = methodName;
    iframe.contentWindow.postMessage({ response, callbackid }, '*');
    this.props.onCancel();
  };

  public render() {
    const { onCancel, webviewHttpUrl, i18n } = this.props;
    const { title, onError, loading, iframeRandomParam, botId, code } =
      this.state;

    const existParam = webviewHttpUrl?.includes('?');
    const iframeURL =
      webviewHttpUrl + (existParam ? '&t=' : '?t=') + iframeRandomParam;
    let errorTips;
    // 0-success, 1-各种校验异常, -1-network error, 2-url不合法, 3-postmessage收到非法origin数据 , httpCode
    if (code === 1 || code === 3) {
      errorTips = i18n('app_network_error_tip', ['Unknown']);
    } else if (code === 2) {
      errorTips = i18n('url_not_valid');
    } else {
      errorTips = i18n('app_http_error_tip', [code.toString()]);
    }
    return (
      <PollModal onClose={onCancel} escClose={false}>
        <div className="conversation-half-webview-dialog">
          <span
            className={'common-close'}
            style={{ position: 'absolute', right: '15px', top: '22px' }}
            onClick={onCancel}
          />
          <div className={'header-container'}>
            <div
              style={{
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                width: 'calc(100% - 75px)',
                fontSize: '1.17em',
                textAlign: 'center',
              }}
            >
              <span>{title}</span>
            </div>
          </div>
          <div className={'iframe-body'}>
            {loading ? (
              <div className={'approval-loading-box'}>
                <div className={'approval-loading'}>
                  <Spin />
                </div>
              </div>
            ) : onError ? (
              <div className={'error-view-box'}>
                <div className={'logo'}>
                  <img
                    style={{
                      height: '85px',
                      width: '120px',
                      marginBottom: '16px',
                    }}
                    src="./images/webview-error.svg"
                    alt={''}
                  />
                </div>
                {errorTips && errorTips.length && (
                  <div className={'tip'}>{errorTips}</div>
                )}
                {/*<div className={'tip-two'}>{i18n('pls_try_again')}</div>*/}
                {/*{botId && botId.length && (*/}
                {/*  <div*/}
                {/*    className={'fullview-jump-to-bot'}*/}
                {/*    onClick={() => {*/}
                {/*      (window as any).jumpMessage({ conversationId: botId });*/}
                {/*    }}*/}
                {/*  />*/}
                {/*)}*/}
                <div>
                  {
                    <button
                      className={'operation-halfview'}
                      onClick={this.retryLoadIframe}
                    >
                      {this.props.i18n('try_again')}
                    </button>
                  }
                </div>
                <div
                  style={{
                    color: '#1989fa',
                    marginTop: '15px',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    (window as any).jumpMessage({ conversationId: botId });
                  }}
                >
                  {i18n('contact_developer')}
                </div>
              </div>
            ) : (
              <iframe
                allow={'clipboard-write'}
                onError={() => {
                  this.setState({
                    loading: false,
                    onError: true,
                    code: 1,
                  });
                }}
                id={'webview'}
                className={'half-webview'}
                src={iframeURL}
              />
            )}
          </div>
        </div>
      </PollModal>
    );
  }
}
