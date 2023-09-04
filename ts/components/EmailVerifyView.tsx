import React, { useEffect, useState } from 'react';
import { Statistic } from 'antd';
const { Countdown } = Statistic;

export const EmailVerifyView = () => {
  const reloadCountdownValue = () => {
    return Date.now() + 1000 * 60 * 10;
  };
  const getSendCodeCountdownValue = () => {
    return Date.now() + 1000 * 60;
  };

  const [expireDay, setExpireDay] = useState<string | undefined | null>();
  const [errorid, setErrorid] = useState<number | undefined | null>();
  const [countdownValue, setCountdownValue] = useState<number>(
    reloadCountdownValue()
  );
  const [sendCodeCountdownValue, setSendCodeCountdownValue] = useState<number>(
    getSendCodeCountdownValue()
  );
  const [canResendCode, setCanResendCode] = useState<boolean>(false);
  const [showWait, setShowWait] = useState<boolean>(true);
  const [showTimeout, setShowTimeout] = useState<boolean>(false);
  const [showErrorTip, setShowErrorTip] = useState<boolean>(false);
  const [errorTipString, setErrorTipString] = useState<string | undefined>();
  const [preCodeString, setPreCodeString] = useState<string>('');

  const normal = '#474D57';
  const timeout = '#D9271E';
  const forbidden = '#B7BDC6';
  const highlight = '#056FFA';

  const getURLParams = () => {
    //@ts-ignore
    const params = new URL(document.location).searchParams;
    const errorid = params.get('errorid');
    const first = params.get('first');
    const expireDay = params.get('expireDay');
    return {
      errorid,
      first,
      expireDay,
    };
  };

  useEffect(() => {
    const { errorid, first, expireDay } = getURLParams();
    let _errorid;
    if (errorid) {
      _errorid = parseInt(errorid);
    }
    setErrorid(_errorid);

    setExpireDay(expireDay);

    // 第一次加载，获取一次验证码
    if (first) {
      (window as any).webApiSendCodeAgain();
    }
  }, []);

  useEffect(() => {
    window.addEventListener('beyondCorp_ssl_http_request_result', handleResult);
    return () => {
      window.removeEventListener(
        'beyondCorp_ssl_http_request_result',
        handleResult
      );
    };
  }, []);
  const handleResult = (event: any) => {
    const { statusCode } = event.detail;

    if (statusCode === 200) {
      setShowErrorTip(false);
    } else {
      setShowErrorTip(true);
    }

    switch (statusCode) {
      case 200:
        setErrorid(statusCode);
        break;
      case 901:
        setErrorid(statusCode);
        break;
      case -100:
        setErrorTipString('Request failed, please check your network status!');
        break;
      case -101:
      case 401:
      case 203:
      case 404:
        setErrorTipString('Something is wrong, please try to send code again.');
        setCanResendCode(true); // c可直接再重新获取 ode，无 CD
        break;
      case 406:
      case 405:
        setErrorTipString('Code expired, please send code again');
        setCanResendCode(true); // c可直接再重新获取 ode，无 CD
        forbiddenInput();
        break;
      case 403:
        setErrorTipString(
          'Something is wrong, please close current browser and reopen to try again.'
        );
        break;
      case 407:
        setErrorTipString('Authorized failed!');
        break;
      case 402:
      case 416:
        setErrorTipString('Invalid code, please enter again.');
        break;
      default:
        setErrorTipString(`Unknown error(${statusCode})!`);
    }
  };

  const inputIds = [
    'email-code-input-0',
    'email-code-input-1',
    'email-code-input-2',
    'email-code-input-3',
    'email-code-input-4',
    'email-code-input-5',
  ];

  const clearInput = () => {
    for (let i = 0; i < inputIds.length; i++) {
      const input = document.getElementById(inputIds[i]) as HTMLInputElement;
      if (input) {
        input.value = '';
      }
    }
  };

  const ableInput = () => {
    for (let i = 0; i < inputIds.length; i++) {
      const input = document.getElementById(inputIds[i]) as HTMLInputElement;
      if (input) {
        input.readOnly = false;
        input.classList.remove('forbidden-input');
      }
    }
  };

  const forbiddenInput = () => {
    for (let i = 0; i < inputIds.length; i++) {
      const input = document.getElementById(inputIds[i]) as HTMLInputElement;
      if (input) {
        input.readOnly = true;
        input.classList.add('forbidden-input');
      }
    }
  };

  const blurInput = () => {
    for (let i = 0; i < inputIds.length; i++) {
      const input = document.getElementById(inputIds[i]) as HTMLInputElement;
      if (input && input === document.activeElement) {
        input.blur();
      }
    }
  };

  const sendCodeAgain = () => {
    setShowTimeout(false);
    setShowWait(true);
    setShowErrorTip(false);
    setErrorid(undefined);
    setCountdownValue(reloadCountdownValue());
    setCanResendCode(false);
    setSendCodeCountdownValue(getSendCodeCountdownValue());

    const timerElement = document.querySelector(
      '.ant-statistic-content'
    ) as any;
    if (timerElement) {
      timerElement.style.color = normal;
    }

    ableInput();
    clearInput();
    focusEmptyInput();

    // 发送验证码
    (window as any).webApiSendCodeAgain();
  };

  const focusEmptyInput = () => {
    for (let i = 0; i < inputIds.length; i++) {
      const input = document.getElementById(inputIds[i]) as HTMLInputElement;
      if (input) {
        const inputValue = input?.value?.trim()?.substring(0, 1) || '';
        // 找到的第一个为空的输入框，并设置焦点
        if (!inputValue || inputValue === '') {
          input.value = inputValue;
          input.focus();
          return;
        }
      }
    }
  };

  const getInputCodeString = () => {
    const codeArr = [];
    for (let i = 0; i < inputIds.length; i++) {
      const input = document.getElementById(inputIds[i]) as HTMLInputElement;
      if (input) {
        const inputValue = input.value?.trim()?.substring(0, 1) || '';
        codeArr.push(inputValue);
      }
    }
    const codeString = codeArr.join('') || '';
    return codeString;
  };

  const isInputActive = () => {
    for (let i = 0; i < inputIds.length; i++) {
      const input = document.getElementById(inputIds[i]) as HTMLInputElement;
      if (input && input === document.activeElement) {
        return true;
      }
    }
    return false;
  };

  const onInput = async (event: any) => {
    const value = event?.target?.value?.trim()?.substring(0, 1) || '';
    const validValue = parseInt(value);

    if (!value) {
      focusEmptyInput();
      return;
    }

    if (isNaN(validValue)) {
      event.target.value = '';
      (window as any).showCommonToast('Please input number');
      focusEmptyInput();
      return;
    }

    event.target.value = validValue;

    focusEmptyInput();
    const codeString = getInputCodeString();
    if (codeString && codeString.length === 6 && codeString !== preCodeString) {
      setPreCodeString(codeString);
      blurInput();
      // auto verify
      (window as any).verifyCode(codeString);
    }
  };

  const onChange = () => {
    const code = getInputCodeString();
    if (code?.length < 6) {
      setShowErrorTip(false);
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const onKeyDown = (event: KeyboardEvent) => {
    const keyCode = event.keyCode;
    if (keyCode === 8) {
      for (let i = 0; i < inputIds.length; i++) {
        const input = document.getElementById(inputIds[i]) as HTMLInputElement;
        if (input === document.activeElement && !input.value) {
          if (i === 0) {
            break;
          }
          const beforeInput = document.getElementById(
            inputIds[i - 1]
          ) as HTMLInputElement;
          beforeInput.value = '';
          beforeInput.focus();
          break;
        }
      }

      const isActive = isInputActive();
      if (isActive) {
        setShowErrorTip(false);
      }
    }
  };

  const onFinish = () => {
    // 这边直接操作元素，而不是更新 state 来重新渲染， 重新渲染会对这个倒计时有影响。
    const timerElement = document.querySelector(
      '.ant-statistic-content'
    ) as any;
    if (!showTimeout) {
      timerElement.style.color = timeout;
      setShowTimeout(true);
    }
    if (showWait) {
      setShowWait(false);
      forbiddenInput();
    }
  };

  const sendCodeCountdownFinish = () => {
    if (!canResendCode) {
      setCanResendCode(true);
    }
  };

  if (errorid === 1001) {
    // 已经过期了
    return (
      <div className={'email-verify'}>
        <div>
          <img className={'logo-comman'} src="./images/BEYONDCORP_LOGO.svg" />
        </div>
        <p className={'title'}>Alert</p>
        <p className={'paragraph'} style={{ marginBottom: 24 }}>
          You current cert already expired, please install new cert to proceed
        </p>
        <button className="btn-renew" onClick={sendCodeAgain}>
          Next
        </button>
      </div>
    );
  }

  if (errorid === 1002) {
    //  快过期了
    return (
      <div className={'email-verify'}>
        <div>
          <img className={'logo-comman'} src="./images/BEYONDCORP_LOGO.svg" />
        </div>
        <p className={'title'}>Alert</p>
        <p className={'paragraph'}>
          {expireDay === '0'
            ? `You current cert is going to expire today, please renew your cert`
            : `You current cert is going to expire within ${expireDay} days, please renew your cert`}
        </p>
        <p className={'paragraph'} style={{ marginBottom: 24 }}>
          to make sure your cert updated.
        </p>
        <button
          className="btn-go-on"
          onClick={() => {
            (window as any).forceInjectCert();
          }}
        >
          Proceed with current cert
        </button>
        <button className="btn-renew" onClick={sendCodeAgain}>
          Renew
        </button>
      </div>
    );
  }

  if (errorid === 1003) {
    // 本地检测到没有安装证书，提示安装
    return (
      <div className={'email-verify'}>
        <div>
          <img className={'logo-comman'} src="./images/BEYONDCORP_LOGO.svg" />
        </div>
        <p className={'title'}>Authentication</p>
        <p className={'paragraph'}>
          To provide you a safe browsing experience,{' '}
        </p>
        <p className={'paragraph'}>we would request you to install a </p>
        <p className={'paragraph'} style={{ marginBottom: 24 }}>
          mutual certificate to your device.
        </p>
        <button
          className="btn-renew"
          onClick={(window as any).jumpToInstallCert}
        >
          Next
        </button>
      </div>
    );
  }

  if (errorid === 200) {
    return (
      <div className={'email-verify'}>
        <div>
          <img className={'logo-comman'} src="./images/BEYONDCORP_LOGO.svg" />
        </div>
        <p className={'title'}>Installing</p>
        <p className={'paragraph'}>Mutual Cert Installing...</p>
      </div>
    );
  }

  if (errorid === 1003) {
    // 本地检测到没有安装证书，提示安装
    return (
      <div className={'email-verify'}>
        <div>
          <img className={'logo-comman'} src="./images/BEYONDCORP_LOGO.svg" />
        </div>
        <p className={'title'}>Authentication</p>
        <p className={'paragraph'}>
          To provide you a safe browsing experience,{' '}
        </p>
        <p className={'paragraph'}>we would request you to install a </p>
        <p className={'paragraph'} style={{ marginBottom: 24 }}>
          mutual certificate to your device.
        </p>
        <button
          className="btn-renew"
          onClick={(window as any).jumpToInstallCert}
        >
          Next
        </button>
      </div>
    );
  }

  if (errorid === 901) {
    // 收到的证书不合法，去重新申请
    return (
      <div className={'email-verify'}>
        <div>
          <img className={'logo-comman'} src="./images/BEYONDCORP_LOGO.svg" />
        </div>
        <p className={'title'}>Alert</p>
        <p className={'paragraph'} style={{ marginBottom: 24 }}>
          Certificate type error, please try again.
        </p>
        <button className="btn-renew" onClick={sendCodeAgain}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className={'email-verify'}>
      <div>
        <img className={'logo-comman'} src="./images/BEYONDCORP_LOGO.svg" />
      </div>
      <p className={'title'}>Two-factor authentication</p>
      <p className={'paragraph'}>
        A 6 digital code has been sent to you via Chative,
      </p>
      <p className={'paragraph'}>
        please enter the code in chative to verify your account.
      </p>
      <div className={'timer'}>
        <Countdown
          valueStyle={{ fontSize: '16px', lineHeight: '24px' }}
          format="mm:ss"
          value={countdownValue}
          onFinish={onFinish}
        />
      </div>
      <div className={'input-box'}>
        {inputIds.map(i => {
          return (
            <input
              onFocus={focusEmptyInput}
              autoFocus
              onInput={onInput}
              key={i}
              id={i}
              className={'input-item'}
              onChange={onChange}
            />
          );
        })}
      </div>
      {showErrorTip && errorTipString && (
        <p className={'error-tip'}>{errorTipString}</p>
      )}
      {showWait && (
        <p className={'p3'}>
          <span id="bottom-tip1">{"Didn't receive the code ? "}</span>
          {canResendCode ? (
            <a
              href="#"
              onClick={sendCodeAgain}
              id="bottom-tip2"
              style={{ color: highlight, cursor: 'pointer' }}
            >
              {'Send code again'}
            </a>
          ) : (
            <a
              href="#"
              id="bottom-tip2"
              style={{ color: forbidden, cursor: 'not-allowed' }}
            >
              You can resent after&nbsp;
              <Countdown
                className={'overlay-email-verify-countdown'}
                valueStyle={{ fontSize: '12px', color: forbidden }}
                format="ss"
                value={sendCodeCountdownValue}
                onFinish={sendCodeCountdownFinish}
              />
              s
            </a>
          )}
        </p>
      )}
      {showTimeout && (
        <p className={'p3'}>
          <span id="bottom-tip1">{'Timeout ! '}</span>
          <a
            href="#"
            onClick={sendCodeAgain}
            id="bottom-tip2"
            style={{ color: highlight, cursor: 'pointer' }}
          >
            {'Send code again'}
          </a>
        </p>
      )}
    </div>
  );
};
