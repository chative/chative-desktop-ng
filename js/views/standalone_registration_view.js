/* global
  getAccountManager,
  Whisper,
  OpenIdAuthFlow,
  OpenIdAuthStateEmitter,
  i18n,
  smalltalk,
  log,
*/

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function () {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.StandaloneRegistrationView = Whisper.View.extend({
    templateName: 'standalone',
    className: 'full-screen-flow',
    initialize() {
      this.accountManager = getAccountManager();

      this.render();
      this.$('#error').hide();
      this.$('.waiting').hide();

      this.authFlow = new OpenIdAuthFlow();
      this.authFlow.authStateEmitter.on(
        OpenIdAuthStateEmitter.ON_TOKEN_RESPONSE,
        this.onTokenResponse.bind(this)
      );
      this.openIdLoginInfo = null;
    },
    render_attributes() {
      return {
        registerWithOktaHeader: i18n('registerWithOktaHeader'),
        registerWithOktaButton: i18n('registerWithOktaButton'),
        registerWithInviteCodeButton: i18n('registerWithInviteCodeButton'),
        registerWithVerifyCodeButton: i18n('registerWithVerifyCodeButton'),
        registerWithOktaWarning: i18n('registerWithOktaWarning'),
        dataLoadingText: i18n('dataLoadingText'),
      };
    },
    events: {
      'click #regWithOkta': 'regWithOpenId',
      // 'click #regWithInviteCode': 'regWithInviteCode',
      // 'click #regWithVerifyCode': 'regWithVerifyCode',
    },
    async regWithOkta() {
      this.displayError('');

      // 输入邮箱/邀请码/验证码
      let inputValue;
      try {
        inputValue = await smalltalk.prompt(
          i18n('registerWithOktaButton'),
          i18n('enter_email_or_code'),
          '',
          {
            buttons: {
              ok: 'OK',
            },
          }
        );
        // eslint-disable-next-line no-empty
      } catch (e) {}

      if (!inputValue) {
        this.displayError(i18n('please_enter_email_or_code'));
        return;
      }

      // 1. 32位邀请码
      const inviteExp = /[a-zA-Z0-9]{32}/;
      if (inviteExp.test(inputValue)) {
        await this.regWithInviteCode(inputValue);
        return;
      }

      // 2. 17位验证码
      const vCodeExp = /\d{17}/;
      if (vCodeExp.test(inputValue)) {
        await this.regWithVerifyCode(
          `+${inputValue.substr(0, 11)}`,
          inputValue.substr(11, 6)
        );
        return;
      }

      // 3. 邮箱格式
      const mailExp =
        /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*/;
      if (!mailExp.test(inputValue)) {
        this.displayError(i18n('email_or_code_error'));
        return;
      }

      try {
        const response = await this.accountManager.authCheckEmail(inputValue);
        if (response && response.status === 0) {
          if (!this.authFlow.loggedIn()) {
            this.$('#standalone-waiting').show();
            this.$('#regWithOkta').prop('disabled', true);

            const clientId = '';
            const issuerUrl = '';

            await this.authFlow.fetchServiceConfiguration(issuerUrl);
            this.authFlow.makeAuthorizationRequest(clientId, inputValue);
          }
        } else {
          this.displayError(i18n('email_or_code_error'));
        }
      } catch (error) {
        this.displayError(error);
      }
    },

    async doLogin(inputValue, domain, domainPrefix) {
      // 1. 32位邀请码
      const inviteExp = /[a-zA-Z0-9]{32}/;
      if (inviteExp.test(inputValue)) {
        await this.regWithInviteCode(inputValue);
        return;
      }
      // 2. 17位验证码
      const vCodeExp = /\d{17}/;
      if (vCodeExp.test(inputValue)) {
        await this.regWithVerifyCode(
          `+${inputValue.substr(0, 11)}`,
          inputValue.substr(11, 6)
        );
        return;
      }
      // 3.okta登录
      try {
        const loginAddress = await this.accountManager.getOpenIdLoginAddress(
          domain
        );
        if (!loginAddress) {
          throw new Error('current okta domain isnot supported.');
        }

        const response = await this.accountManager.authCheckEmail(inputValue);
        if (response?.status !== 0) {
          throw new Error(i18n('email_or_code_error'));
        }
        if (this.authFlow.loggedIn()) {
          log.info('user has been logged in.', domain, inputValue);
          return;
        }

        const { clientId, issuer } = loginAddress;

        this.openIdLoginInfo = {
          email: inputValue,
          clientId: clientId,
          issuer: issuer,
          domain: domain,
          domainPrefix: domainPrefix,
        };
        this.$('#standalone-waiting').show();
        this.$('#regWithOkta').prop('disabled', true);

        await this.authFlow.fetchServiceConfiguration(issuer);
        this.authFlow.makeAuthorizationRequest(clientId, inputValue);
      } catch (error) {
        this.displayError(error);
        return;
      }
    },

    async regWithOpenId() {
      this.displayError('');

      this.Register = new Whisper.ReactWrapperView({
        className: 'button',
        Component: window.Signal.Components.Register,
        // eslint-disable-next-line no-undef
        props: {
          doLogin: (inputValue, okta, oktaPrefix) => {
            this.doLogin(inputValue, okta, oktaPrefix);
          },
          getOpenIdLoginAddress: domain => {
            return this.accountManager.getOpenIdLoginAddress(domain);
          },
        },
      });
    },
    async regWithInviteCode(inviteCode) {
      this.displayError('');
      // this.$('#standalone-waiting2').show();
      // this.$('#regWithInviteCode').prop('disabled', true);

      let response;
      try {
        response = await this.accountManager.redeemAccount(inviteCode);
        const { verificationCode, account: number } = response;
        await this.accountManager.requestSMSVerification(number);

        // 输入名字
        let inputValue;
        while (!inputValue) {
          try {
            // eslint-disable-next-line no-await-in-loop
            inputValue = await smalltalk.prompt(
              i18n('registerWithOktaButton'),
              'Enter Your Name',
              '',
              {
                buttons: {
                  ok: 'OK',
                },
              }
            );
            // eslint-disable-next-line no-empty
          } catch (e) {}
        }

        await this.accountManager
          .registerSingleDevice(number, verificationCode, undefined, inputValue)
          .then(() => {
            this.$el.trigger('openInbox');
            window.removeSetupMenuItems();
          });
      } catch (err) {
        this.displayError(err);
        // this.$('#standalone-waiting2').hide();
        // this.$('#regWithInviteCode').prop('disabled', false);
      }
    },
    async regWithVerifyCode(number, verificationCode) {
      this.displayError('');
      // this.$('#standalone-waiting3').show();
      // this.$('#regWithVerifyCode').prop('disabled', true);

      try {
        const response = await this.accountManager.requestSMSVerification(
          number
        );
        let pinCode;
        if (response.requirePin) {
          try {
            pinCode = await smalltalk.prompt(
              'Pin Code',
              'Input your pin code',
              '',
              {
                buttons: {
                  ok: 'OK',
                },
              }
            );
            // eslint-disable-next-line no-empty
          } catch (e) {}

          if (!pinCode) {
            // eslint-disable-next-line no-throw-literal
            throw 'Need Pin Code';
          }
        }

        await this.accountManager
          .registerSingleDevice(number, verificationCode, pinCode)
          .then(() => {
            this.$el.trigger('openInbox');
            window.removeSetupMenuItems();
          });
      } catch (err) {
        this.displayError(err);
        // this.$('#standalone-waiting3').hide();
        // this.$('#regWithVerifyCode').prop('disabled', false);
      }
    },
    displayError(error) {
      let showError = error;
      if (error.response || error.message) {
        if (typeof error.response === 'string') {
          showError = error.response;
        } else if (typeof error.message === 'string') {
          showError = error.message;
        } else {
          showError = JSON.stringify(error.response);
        }
      }

      this.$('#error').hide().text(showError).addClass('in').fadeIn();
    },
    async onTokenResponse(tokenResponse, error) {
      const { loginHint, nonce, userInfoEndpoint } = tokenResponse || {};
      log.info('on token response ...');

      window.showWindow();

      if (error) {
        log.info(`request token response error: ${error}`);
        let errorDisableOkta = 'This account is invalid, please contact ITBot.';
        // this.displayError(error.errorDescription);
        this.displayError(errorDisableOkta);
        this.$('#standalone-waiting').hide();
        this.$('#regWithOkta').prop('disabled', false);
        return;
      }

      const tokens = this.authFlow.accessTokenResponse;
      const { idToken, accessToken } = tokens;

      try {
        const userInfo = await this.accountManager.getUserInfoFromOkta(
          userInfoEndpoint,
          accessToken
        );

        const loggedUser = userInfo?.preferred_username?.toLowerCase();
        if (loginHint?.toLowerCase() !== loggedUser) {
          throw new Error(
            `Login account: ${loginHint} does not match with: ${loggedUser}.`
          );
        }

        let oktaName = this.getUserName(userInfo);
        if (!oktaName) {
          // 输入名字
          let inputValue;
          while (!inputValue) {
            try {
              // eslint-disable-next-line no-await-in-loop
              inputValue = await smalltalk.prompt(
                i18n('registerWithOktaButton'),
                'Enter Your Name',
                '',
                {
                  buttons: {
                    ok: 'OK',
                  },
                }
              );
              // eslint-disable-next-line no-empty
            } catch (e) {}
          }
          oktaName = inputValue;
        }

        let response = await this.accountManager.authWithOktaTokensV2(
          accessToken,
          idToken,
          nonce,
          this.openIdLoginInfo
        );

        let pinCode;
        if (response.requirePin) {
          try {
            pinCode = await smalltalk.prompt(
              'Pin Code',
              'Input your pin code',
              '',
              {
                buttons: {
                  ok: 'OK',
                },
              }
            );
            // eslint-disable-next-line no-empty
          } catch (e) {}

          if (!pinCode) {
            // eslint-disable-next-line no-throw-literal
            throw 'Need Pin Code';
          }
        }

        const { nextStep } = response;
        switch (nextStep) {
          case 0:
            // invite code flow
            const { invitationCode } = response;
            response = await this.accountManager.redeemAccount(invitationCode);
          // turn to verify code flow
          case 1:
            // verify code flow
            const { verificationCode, account: number } = response;
            await this.accountManager.requestSMSVerification(number);
            await this.accountManager
              .registerSingleDevice(number, verificationCode, pinCode, oktaName)
              .then(() => {
                this.$el.trigger('openInbox');
                window.removeSetupMenuItems();
              });
            break;
        }
      } catch (err) {
        this.displayError(err);
        this.$('.waiting').hide();
        this.$('#regWithOkta').prop('disabled', false);
        this.authFlow.signOut();
      }
    },
    getUserName(userInfo) {
      let displayName = '';
      if (!userInfo) {
        return undefined;
      }

      let givenName = userInfo.given_name;
      if (givenName) {
        givenName = givenName.trim();
        if (givenName.length > 0) {
          displayName = givenName;
        }
      }

      let middleName = userInfo.middle_name;
      if (middleName) {
        middleName = middleName.trim();
        if (middleName.length > 0) {
          displayName += (displayName.length > 0 ? '.' : '') + middleName;
        }
      }

      let familyName = userInfo.family_name;
      if (familyName) {
        familyName = familyName.trim();
        if (familyName.length > 0) {
          displayName += (displayName.length > 0 ? '.' : '') + familyName;
        }
      }

      if (displayName.length === 0) {
        // username is email address format.
        const username = userInfo.preferred_username;
        if (username && username.length > 0) {
          displayName = username.split('@')[0];
        }
      }

      return displayName.length > 0 ? displayName : undefined;
    },
  });
})();
