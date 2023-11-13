/* global
  window,
  textsecure,
  libsignal,
  WebSocketResource,
  btoa,
  getString,
  libphonenumber,
  Event,
  ConversationController
*/

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function () {
  window.textsecure = window.textsecure || {};

  const ARCHIVE_AGE = 30 * 24 * 60 * 60 * 1000;

  function AccountManager(username, password) {
    this.server = window.WebAPI.connect({ username, password });
    this.pending = Promise.resolve();
  }

  function getNumber(numberId) {
    if (!numberId || !numberId.length) {
      return numberId;
    }
    const parts = numberId.split('.');
    if (!parts.length) {
      return numberId;
    }

    return parts[0];
  }

  AccountManager.prototype = new textsecure.EventTarget();
  AccountManager.prototype.extend({
    constructor: AccountManager,
    requestVoiceVerification(number) {
      return this.server.requestVerificationVoice(number);
    },
    requestSMSVerification(number) {
      return this.server.requestVerificationSMS(number);
    },
    registerSingleDevice(number, verificationCode, pinCode, defaultName) {
      const registerKeys = this.server.registerKeys.bind(this.server);
      const createAccount = this.createAccount.bind(this);
      const clearSessionsAndPreKeys = this.clearSessionsAndPreKeys.bind(this);
      const generateKeys = this.generateKeys.bind(this, 100);
      const confirmKeys = this.confirmKeys.bind(this);
      const registrationDone = this.registrationDone.bind(this);

      return this.queueTask(() =>
        libsignal.KeyHelper.generateIdentityKeyPair().then(identityKeyPair => {
          const profileKey = textsecure.crypto.getRandomBytes(32);
          // default readReceipts set to true.
          const readReceipts = true;

          return createAccount(
            number,
            verificationCode,
            identityKeyPair,
            profileKey,
            undefined,
            'OWI',
            readReceipts,
            pinCode
          )
            .then(clearSessionsAndPreKeys)
            .then(generateKeys)
            .then(keys => registerKeys(keys).then(() => confirmKeys(keys)))
            .then(() => registrationDone(number, defaultName));
        })
      );
    },
    registerSecondDevice(setProvisioningUrl, confirmNumber, progressCallback) {
      const createAccount = this.createAccount.bind(this);
      const clearSessionsAndPreKeys = this.clearSessionsAndPreKeys.bind(this);
      const generateKeys = this.generateKeys.bind(this, 100, progressCallback);
      const confirmKeys = this.confirmKeys.bind(this);
      const registrationDone = this.registrationDone.bind(this);
      const registerKeys = this.server.registerKeys.bind(this.server);
      const getSocket = this.server.getProvisioningSocket.bind(this.server);
      const queueTask = this.queueTask.bind(this);
      const provisioningCipher = new libsignal.ProvisioningCipher();
      let gotProvisionEnvelope = false;
      return provisioningCipher.getPublicKey().then(
        pubKey =>
          new Promise((resolve, reject) => {
            const socket = getSocket();
            socket.onclose = event => {
              window.log.info('provisioning socket closed. Code:', event.code);
              if (!gotProvisionEnvelope) {
                reject(new Error('websocket closed'));
              }
            };
            socket.onopen = () => {
              window.log.info('provisioning socket open');
            };
            const wsr = new WebSocketResource(socket, {
              keepalive: { path: '/v1/keepalive/provisioning' },
              handleRequest(request) {
                if (request.path === '/v1/address' && request.verb === 'PUT') {
                  const proto = textsecure.protobuf.ProvisioningUuid.decode(
                    request.body
                  );
                  setProvisioningUrl(
                    [
                      'tsdevice:/?uuid=',
                      proto.uuid,
                      '&pub_key=',
                      betterEncodeURIComponent(btoa(getString(pubKey))),
                    ].join('')
                  );
                  request.respond(200, 'OK');
                } else if (
                  request.path === '/v1/message' &&
                  request.verb === 'PUT'
                ) {
                  const envelope = textsecure.protobuf.ProvisionEnvelope.decode(
                    request.body,
                    'binary'
                  );
                  request.respond(200, 'OK');
                  gotProvisionEnvelope = true;
                  wsr.close();
                  resolve(
                    provisioningCipher
                      .decrypt(envelope)
                      .then(provisionMessage =>
                        queueTask(() =>
                          confirmNumber(provisionMessage.number).then(
                            deviceName => {
                              if (
                                typeof deviceName !== 'string' ||
                                deviceName.length === 0
                              ) {
                                throw new Error('Invalid device name');
                              }
                              //配置meetingVersion 来自(background.js)
                              let meetingVersion = window.Signal.OS.isMacOS()
                                ? MAC_MEETINGVERSION
                                : LINUX_MEETINGVERSION;

                              return createAccount(
                                provisionMessage.number,
                                provisionMessage.provisioningCode,
                                provisionMessage.identityKeyPair,
                                provisionMessage.profileKey,
                                deviceName,
                                provisionMessage.userAgent,
                                provisionMessage.readReceipts,
                                null,
                                meetingVersion
                              )
                                .then(clearSessionsAndPreKeys)
                                .then(generateKeys)
                                .then(keys =>
                                  registerKeys(keys).then(() =>
                                    confirmKeys(keys)
                                  )
                                )
                                .then(() => {
                                  registrationDone(provisionMessage.number);
                                });
                            }
                          )
                        )
                      )
                  );
                } else {
                  window.log.error('Unknown websocket message', request.path);
                }
              },
            });
          })
      );
    },
    refreshPreKeys() {
      const generateKeys = this.generateKeys.bind(this, 100);
      const registerKeys = this.server.registerKeys.bind(this.server);

      return this.queueTask(() =>
        this.server.getMyKeys().then(preKeyCount => {
          window.log.info(`prekey count ${preKeyCount}`);
          if (preKeyCount < 10) {
            return generateKeys().then(registerKeys);
          }
          return null;
        })
      );
    },
    rotateSignedPreKey() {
      return this.queueTask(() => {
        const signedKeyId = textsecure.storage.get('signedKeyId', 1);
        if (typeof signedKeyId !== 'number') {
          throw new Error('Invalid signedKeyId');
        }

        const store = textsecure.storage.protocol;
        const { server, cleanSignedPreKeys } = this;

        return store
          .getIdentityKeyPair()
          .then(
            identityKey =>
              libsignal.KeyHelper.generateSignedPreKey(
                identityKey,
                signedKeyId
              ),
            () => {
              // We swallow any error here, because we don't want to get into
              //   a loop of repeated retries.
              window.log.error(
                'Failed to get identity key. Canceling key rotation.'
              );
            }
          )
          .then(res => {
            if (!res) {
              return null;
            }
            window.log.info('Saving new signed prekey', res.keyId);
            return Promise.all([
              textsecure.storage.put('signedKeyId', signedKeyId + 1),
              store.storeSignedPreKey(res.keyId, res.keyPair),
              server.setSignedPreKey({
                keyId: res.keyId,
                publicKey: res.keyPair.pubKey,
                signature: res.signature,
              }),
            ])
              .then(() => {
                const confirmed = true;
                window.log.info('Confirming new signed prekey', res.keyId);
                return Promise.all([
                  textsecure.storage.remove('signedKeyRotationRejected'),
                  store.storeSignedPreKey(res.keyId, res.keyPair, confirmed),
                ]);
              })
              .then(() => cleanSignedPreKeys());
          })
          .catch(e => {
            window.log.error(
              'rotateSignedPrekey error:',
              e && e.stack ? e.stack : e
            );

            if (
              e instanceof Error &&
              e.name === 'HTTPError' &&
              e.code >= 400 &&
              e.code <= 599
            ) {
              const rejections =
                1 + textsecure.storage.get('signedKeyRotationRejected', 0);
              textsecure.storage.put('signedKeyRotationRejected', rejections);
              window.log.error(
                'Signed key rotation rejected count:',
                rejections
              );
            } else {
              throw e;
            }
          });
      });
    },
    queueTask(task) {
      const taskWithTimeout = textsecure.createTaskWithTimeout(task);
      this.pending = this.pending.then(taskWithTimeout, taskWithTimeout);

      return this.pending;
    },
    cleanSignedPreKeys() {
      const MINIMUM_KEYS = 5;
      const store = textsecure.storage.protocol;
      return store.loadSignedPreKeys().then(allKeys => {
        allKeys.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
        allKeys.reverse(); // we want the most recent first
        let confirmed = allKeys.filter(key => key.confirmed);
        const unconfirmed = allKeys.filter(key => !key.confirmed);

        const recent = allKeys[0] ? allKeys[0].keyId : 'none';
        const recentConfirmed = confirmed[0] ? confirmed[0].keyId : 'none';
        window.log.info(`Most recent signed key: ${recent}`);
        window.log.info(`Most recent confirmed signed key: ${recentConfirmed}`);
        window.log.info(
          'Total signed key count:',
          allKeys.length,
          '-',
          confirmed.length,
          'confirmed'
        );

        let confirmedCount = confirmed.length;

        // Keep MINIMUM_KEYS confirmed keys, then drop if older than a month
        confirmed = confirmed.forEach((key, index) => {
          if (index < MINIMUM_KEYS) {
            return;
          }
          const createdAt = key.created_at || 0;
          const age = Date.now() - createdAt;

          if (age > ARCHIVE_AGE) {
            window.log.info(
              'Removing confirmed signed prekey:',
              key.keyId,
              'with timestamp:',
              createdAt
            );
            store.removeSignedPreKey(key.keyId);
            confirmedCount -= 1;
          }
        });

        const stillNeeded = MINIMUM_KEYS - confirmedCount;

        // If we still don't have enough total keys, we keep as many unconfirmed
        // keys as necessary. If not necessary, and over a week old, we drop.
        unconfirmed.forEach((key, index) => {
          if (index < stillNeeded) {
            return;
          }

          const createdAt = key.created_at || 0;
          const age = Date.now() - createdAt;
          if (age > ARCHIVE_AGE) {
            window.log.info(
              'Removing unconfirmed signed prekey:',
              key.keyId,
              'with timestamp:',
              createdAt
            );
            store.removeSignedPreKey(key.keyId);
          }
        });
      });
    },
    createAccount(
      number,
      verificationCode,
      identityKeyPair,
      profileKey,
      deviceName,
      userAgent,
      readReceipts,
      pinCode,
      meetingVersion
    ) {
      const signalingKey = libsignal.crypto.getRandomBytes(32 + 20);
      let password = btoa(getString(libsignal.crypto.getRandomBytes(16)));
      password = password.substring(0, password.length - 2);
      const registrationId = libsignal.KeyHelper.generateRegistrationId();

      const previousNumber = getNumber(textsecure.storage.get('number_id'));

      return this.server
        .confirmCode(
          number,
          verificationCode,
          password,
          signalingKey,
          registrationId,
          deviceName,
          pinCode,
          meetingVersion
        )
        .then(response => {
          if (previousNumber && previousNumber !== number) {
            window.log.warn('New number is different from old number');

            const warningText =
              'You are logging in a different user, ' +
              'previous data would be removed, are you sure continue?';

            if (!window.confirm(warningText)) {
              window.log.warn('user has canceled this loggin.');
              return this.server.unlinkCurrentDevice().then(() => {
                throw new Error('User has canceled this loggin.');
              });
            }

            const loginInfo = textsecure.storage.get('loginInfo') || {};

            window.log.warn('deleting all previous data');
            return textsecure.storage.protocol.removeAllData().then(
              () => {
                window.log.info('Successfully deleted previous data');

                textsecure.storage.put('loginInfo', loginInfo);

                return response;
              },
              error => {
                window.log.error(
                  'Something went wrong deleting data from previous number',
                  error && error.stack ? error.stack : error
                );

                textsecure.storage.put('loginInfo', loginInfo);

                return this.server.unlinkCurrentDevice().finally(() => {
                  throw new Error('Failed to remove previous data');
                });
              }
            );
          }

          return response;
        })
        .then(async response => {
          await Promise.all([
            textsecure.storage.remove('identityKey'),
            textsecure.storage.remove('signaling_key'),
            textsecure.storage.remove('password'),
            textsecure.storage.remove('registrationId'),
            textsecure.storage.remove('number_id'),
            textsecure.storage.remove('device_name'),
            textsecure.storage.remove('regionCode'),
            textsecure.storage.remove('userAgent'),
            textsecure.storage.remove('profileKey'),
            textsecure.storage.remove('read-receipts-setting'),
          ]);

          // update our own identity key, which may have changed
          // if we're relinking after a reinstall on the master device
          await textsecure.storage.protocol.saveIdentityWithAttributes(number, {
            id: number,
            publicKey: identityKeyPair.pubKey,
            firstUse: true,
            timestamp: Date.now(),
            verified: textsecure.storage.protocol.VerifiedStatus.VERIFIED,
            nonblockingApproval: true,
          });

          await textsecure.storage.put('identityKey', identityKeyPair);
          await textsecure.storage.put('signaling_key', signalingKey);
          await textsecure.storage.put('password', password);
          await textsecure.storage.put('registrationId', registrationId);
          if (profileKey) {
            await textsecure.storage.put('profileKey', profileKey);
          }
          if (userAgent) {
            await textsecure.storage.put('userAgent', userAgent);
          }

          // force enable read receipt
          await textsecure.storage.put('read-receipt-setting', true);

          await textsecure.storage.user.setNumberAndDeviceId(
            number,
            response.deviceId || 1,
            deviceName
          );

          const regionCode = libphonenumber.util.getRegionCodeForNumber(number);
          await textsecure.storage.put('regionCode', regionCode);
        });
    },
    clearSessionsAndPreKeys() {
      const store = textsecure.storage.protocol;

      window.log.info('clearing all sessions, prekeys, and signed prekeys');
      return Promise.all([
        store.clearPreKeyStore(),
        store.clearSignedPreKeysStore(),
        store.clearSessionStore(),
      ]);
    },
    // Takes the same object returned by generateKeys
    confirmKeys(keys) {
      const store = textsecure.storage.protocol;
      const key = keys.signedPreKey;
      const confirmed = true;

      window.log.info('confirmKeys: confirming key', key.keyId);
      return store.storeSignedPreKey(key.keyId, key.keyPair, confirmed);
    },
    generateKeys(count, providedProgressCallback) {
      const progressCallback =
        typeof providedProgressCallback === 'function'
          ? providedProgressCallback
          : null;
      const startId = textsecure.storage.get('maxPreKeyId', 1);
      const signedKeyId = textsecure.storage.get('signedKeyId', 1);

      if (typeof startId !== 'number') {
        throw new Error('Invalid maxPreKeyId');
      }
      if (typeof signedKeyId !== 'number') {
        throw new Error('Invalid signedKeyId');
      }

      const store = textsecure.storage.protocol;
      return store.getIdentityKeyPair().then(identityKey => {
        const result = { preKeys: [], identityKey: identityKey.pubKey };
        const promises = [];

        for (let keyId = startId; keyId < startId + count; keyId += 1) {
          promises.push(
            libsignal.KeyHelper.generatePreKey(keyId).then(res => {
              store.storePreKey(res.keyId, res.keyPair);
              result.preKeys.push({
                keyId: res.keyId,
                publicKey: res.keyPair.pubKey,
              });
              if (progressCallback) {
                progressCallback();
              }
            })
          );
        }

        promises.push(
          libsignal.KeyHelper.generateSignedPreKey(
            identityKey,
            signedKeyId
          ).then(res => {
            store.storeSignedPreKey(res.keyId, res.keyPair);
            result.signedPreKey = {
              keyId: res.keyId,
              publicKey: res.keyPair.pubKey,
              signature: res.signature,
              // server.registerKeys doesn't use keyPair, confirmKeys does
              keyPair: res.keyPair,
            };
          })
        );

        textsecure.storage.put('maxPreKeyId', startId + count);
        textsecure.storage.put('signedKeyId', signedKeyId + 1);
        return Promise.all(promises).then(() =>
          // This is primarily for the signed prekey summary it logs out
          this.cleanSignedPreKeys().then(() => result)
        );
      });
    },
    async registrationDone(number, defaultName) {
      window.log.info('registration done');

      // Ensure that we always have a conversation for ourself
      const me = await ConversationController.getOrCreateAndWait(
        number,
        'private'
      );

      try {
        const result = await this.server.fetchDirectoryContacts([number]);
        const myProfile = result.data.contacts[0];
        if (myProfile && myProfile.number === number) {
          const { avatar } = myProfile;
          if (avatar) {
            myProfile.commonAvatar = me.parsePrivateAvatar(avatar);
          }

          me.updateAttributesPrivate(myProfile);
        }
      } catch (error) {
        log.error('our contact profile update failed.', error);
      }

      let attributes = {};

      // if no previous name was got, use new  username
      if (!me.get('name') || me.get('name') === me.get('id')) {
        if (defaultName) {
          let uploadName = defaultName;
          if (uploadName.length > 30) {
            uploadName = uploadName.substring(0, 30);
          }

          await this.server.setProfile({ name: uploadName });
          attributes.name = uploadName;
        }
      }

      attributes.active_at = Date.now();
      if ((await window.Signal.Data.getStickConversationCount()) === 0) {
        attributes.isStick = true;
      }

      me.set(attributes);
      await window.Signal.Data.updateConversation(attributes);

      this.dispatchEvent(new Event('registration'));
    },
    async redeemAccount(invitationCode) {
      return this.server.redeemAccount(invitationCode).then(response => {
        return {
          account: response.account,
          verificationCode: response.vcode,
        };
      });
    },
    async getOpenIdLoginAddress(domain) {
      return this.server
        .getOpenIdLoginAddress(domain)
        .then(response => {
          const status = response.status;
          let err;
          switch (status) {
            case 0:
              return response.data;
            case 9:
              err = 'No such domain, HTTP 403';
              break;
            default:
              err = 'unexpected error.';
              break;
          }
          throw new Error(err);
        })
        .catch(error => {
          // const err = 'Please enter the correct prefix';
          throw new Error(error);
        });
    },
    async authWithOktaTokens(accessToken, idToken, nonce) {
      return this.server
        .authWithOktaTokens(accessToken, idToken, nonce)
        .then(response => {
          const status = response.status;
          let err;
          switch (status) {
            case 0:
              // ok
              return {
                account: response.account,
                nextStep: response.nextStep,
                invitationCode: response.invitationCode,
                verificationCode: response.verificationCode,
                requirePin: response.requirePin,
              };
            case 1:
              // invalid token
              err = 'invalid token.';
              break;
            case 2:
              // account disabled
              err = 'disabled account.';
              break;
            default:
              // unexpected error
              err = 'unexpected error.';
              break;
          }

          throw new Error(err);
        });
    },
    async authWithOktaTokensV2(accessToken, idToken, nonce, openIdLoginInfo) {
      const { domain } = openIdLoginInfo;
      if (!domain) {
        throw Error('invalid login domain.');
      }

      return this.server
        .authWithOktaTokensV2(accessToken, idToken, nonce, domain)
        .then(response => {
          const status = response.status;
          let err;
          switch (status) {
            case 0:
            case 22:
              // ok
              window.textsecure.storage.put('loginInfo', openIdLoginInfo);
              return response.data;
            case 5:
              // invalid token
              err = 'invalid token, HTTP 401';
              break;
            case 14:
              // account disabled
              err = 'the account is disabled, HTTP 403';
              break;
            // case 22:
            //   err = 'the account has no team'
            //   break;
            default:
              // unexpected error
              err = 'unexpected error.';
              break;
          }

          throw new Error(err);
        });
    },
    async getUserInfoFromOkta(userInfoUrl, accessToken) {
      return this.server.getUserInfoFromOkta(userInfoUrl, accessToken);
    },
    async setInternalName(plainProfileName) {
      const encodedName = betterEncodeURIComponent(plainProfileName);
      return this.server.setInternalName(encodedName);
    },
    async getGlobalConfig(url) {
      return this.server.getGlobalConfig(url);
    },
    async getWBCConfig(url) {
      return this.server.getWBCConfig(url);
    },
    async requestThumbsUp(number) {
      return this.server.requestThumbsUp(number);
    },
    async unlinkCurrentDevice() {
      return this.server.unlinkCurrentDevice();
    },
    async reportException(exception) {
      return this.server.reportException(exception);
    },
    async pingURL(url, mainDomain, userAgent) {
      return this.server.pingURL(url, mainDomain, userAgent);
    },
    async setProfile(obj) {
      return this.server.setProfile(obj);
    },
    async authCheckEmail(email) {
      return this.server.authCheckEmail(email);
    },
    async getAvatarUploadId() {
      return this.server.getAvatarUploadId();
    },
    async putAvatar(ossUrl, encryptedBin, attachmentId, encAlgo, encKey) {
      return this.server.putAvatar(
        ossUrl,
        encryptedBin,
        attachmentId,
        encAlgo,
        encKey
      );
    },
    async putGroupAvatar(
      attachmentId,
      b64Key,
      b64Digest,
      groupIdV2,
      imageByteCount
    ) {
      return this.server.putGroupAvatar(
        attachmentId,
        b64Key,
        b64Digest,
        groupIdV2,
        imageByteCount
      );
    },
    async uploadDeviceInfo(info) {
      return this.server.uploadDeviceInfo(info);
    },
    async getUserSessionsV2KeyByUid(uids) {
      return this.server.getUserSessionsV2KeyByUid(uids);
    },
  });
  textsecure.AccountManager = AccountManager;
})();
