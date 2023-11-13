/*
 * Copyright 2017 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

import { AuthorizationRequest } from '@openid/appauth/built/authorization_request';

import {
  AuthorizationNotifier,
  AuthorizationRequestHandler,
} from '@openid/appauth/built/authorization_request_handler';

import { AuthorizationServiceConfiguration } from '@openid/appauth/built/authorization_service_configuration';

import { NodeCrypto } from '@openid/appauth/built/node_support/';

import { NodeBasedHandler } from '@openid/appauth/built/node_support/node_request_handler';

import { NodeRequestor } from '@openid/appauth/built/node_support/node_requestor';

import {
  GRANT_TYPE_AUTHORIZATION_CODE,
  TokenRequest,
} from '@openid/appauth/built/token_request';

import {
  BaseTokenRequestHandler,
  TokenRequestHandler,
} from '@openid/appauth/built/token_request_handler';

import { TokenResponse } from '@openid/appauth/built/token_response';

import { StringMap } from '@openid/appauth/built/types';

import { EventEmitter } from 'events';

export class AuthStateEmitter extends EventEmitter {
  static ON_TOKEN_RESPONSE = 'on_token_response';
}

/* the Node.js based HTTP client. */
const requestor = new NodeRequestor();

const scope = 'openid profile offline_access';

const httpServerPort = 8998;
const redirectUri = 'http://localhost:' + httpServerPort;

export class AuthFlow {
  private notifier: AuthorizationNotifier;
  private authorizationHandler: AuthorizationRequestHandler;
  private tokenHandler: TokenRequestHandler;
  readonly authStateEmitter: AuthStateEmitter;

  // state
  private configuration: AuthorizationServiceConfiguration | undefined;
  private accessTokenResponse: TokenResponse | undefined;

  constructor() {
    this.notifier = new AuthorizationNotifier();
    this.authStateEmitter = new AuthStateEmitter();
    this.authorizationHandler = new NodeBasedHandler(httpServerPort);
    this.tokenHandler = new BaseTokenRequestHandler(requestor);

    // set notifier to deliver responses
    this.authorizationHandler.setAuthorizationNotifier(this.notifier);
    // set a listener to listen for authorization responses
    // make refresh and access token requests.
    this.notifier.setAuthorizationListener((request, response, error) => {
      if (response) {
        let codeVerifier: string | undefined;
        if (request.internal && request.internal.code_verifier) {
          codeVerifier = request.internal.code_verifier;
        }

        const nonce = request.extras?.nonce;
        const loginHint = request.extras?.login_hint;

        this.makeTokensRequest(
          request.clientId,
          response.code,
          codeVerifier
        ).then(() => {
          const userInfoEndpoint = this.configuration?.userInfoEndpoint;
          this.authStateEmitter.emit(AuthStateEmitter.ON_TOKEN_RESPONSE, {
            loginHint,
            nonce,
            userInfoEndpoint,
          });
        });
      } else {
        this.authStateEmitter.emit(
          AuthStateEmitter.ON_TOKEN_RESPONSE,
          undefined,
          error
        );
      }
    });
  }

  fetchServiceConfiguration(openIdIssuerUrl: string): Promise<void> {
    return AuthorizationServiceConfiguration.fetchFromIssuer(
      openIdIssuerUrl,
      requestor
    ).then(response => {
      this.configuration = response;
    });
  }

  makeAuthorizationRequest(clientId: string, username?: string) {
    if (!this.configuration) {
      return;
    }

    let crypto = new NodeCrypto();
    const extras: StringMap = {
      nonce: crypto.generateRandom(40),
      prompt: 'consent select_account',
      access_type: 'offline',
    };

    if (username) {
      extras['login_hint'] = username;
    }

    // create a request
    const request = new AuthorizationRequest(
      {
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: scope,
        response_type: AuthorizationRequest.RESPONSE_TYPE_CODE,
        state: crypto.generateRandom(40),
        extras: extras,
      },
      crypto
    );

    this.authorizationHandler.performAuthorizationRequest(
      this.configuration,
      request
    );
  }

  private makeTokensRequest(
    clientId: string,
    code: string,
    codeVerifier: string | undefined
  ): Promise<void> {
    if (!this.configuration) {
      return Promise.resolve();
    }

    const extras: StringMap = {};

    if (codeVerifier) {
      extras.code_verifier = codeVerifier;
    }

    // use the code to make the token request.
    let request = new TokenRequest({
      client_id: clientId,
      redirect_uri: redirectUri,
      grant_type: GRANT_TYPE_AUTHORIZATION_CODE,
      code: code,
      extras: extras,
    });

    return this.tokenHandler
      .performTokenRequest(this.configuration, request)
      .then(response => {
        this.accessTokenResponse = response;
      });
  }

  loggedIn(): boolean {
    return !!this.accessTokenResponse && this.accessTokenResponse.isValid();
  }

  signOut() {
    // forget all cached token state
    this.accessTokenResponse = undefined;
  }
}
