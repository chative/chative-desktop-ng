import { LocalizerType } from './Util';
export enum RiskClass {
  WHITE = 1,
  GRAY = 2,
  BLACK = 3,
}
export enum Service_Status {
  SUCCESS = 0,
  UNKONWN = 26001,
  LINK_RED = 26002,
  LINK_GRAY = 26003,
  FILE_RED = 26004,
  FILE_GRAY = 26005,
}
const regNoCheck = new RegExp(
  /(chative):\/\/[-A-Za-z0-9+&@#/%?=~_|!:,.;]+[-A-Za-z0-9+&@#/%=~_|]/g
);

export function getSecurityStatus(status: number, i18n: LocalizerType) {
  if (status === Service_Status.LINK_RED) {
    return {
      status: RiskClass.BLACK,
      reason: i18n('redLink'),
    };
  } else if (status === Service_Status.FILE_RED) {
    return {
      status: RiskClass.BLACK,
      reason: i18n('redFile'),
    };
  } else if (status === Service_Status.LINK_GRAY) {
    return {
      status: RiskClass.GRAY,
      reason: i18n('greyLink'),
    };
  } else if (status === Service_Status.FILE_GRAY) {
    return {
      status: RiskClass.GRAY,
      reason: i18n('greyFile'),
    };
  } else if (status === 1 || status === Service_Status.SUCCESS) {
    return {
      status: RiskClass.WHITE,
      reason: '',
    };
  }
  return {};
}

export function urlNeedCheck(url: string) {
  if (url.match(regNoCheck)) {
    return false;
  } else {
    return true;
  }
}
export function fileNeedCheck(fileSuffix: string, regex: any) {
  if (regex.test(fileSuffix)) {
    return false;
  } else {
    return true;
  }
}

export function getNoCheckSecurityStatus() {
  return RiskClass.WHITE;
}
