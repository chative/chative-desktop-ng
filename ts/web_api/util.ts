// @ts-ignore
import * as packageJson from '../../package.json';
import os from 'os';

export const getApiUserAgent = (() => {
  const { productName, version } = packageJson;
  const productInfo = `${productName}/${version}`;

  // os.type(),
  // it returns 'Linux' on Linux, 'Darwin' on macOS, and 'Windows_NT' on Windows.
  const userAgent = `${productInfo} (${os.type()};${os.release()};node-fetch/2)`;

  return () => userAgent;
})();
