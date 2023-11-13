/* eslint-disable no-console */

const fs = require('fs');
const _ = require('lodash');

const packageJson = require('./package.json');
const testJson = require('./config/dev-chativetest.json');

const { version } = packageJson;
// const test = /test/;

// You might be wondering why this file is necessary. It comes down to our desire to allow
//   side-by-side installation of production and beta builds. Electron-Builder uses
//   top-level data from package.json for many things, like the executable name, the
//   debian package name, the install directory under /opt on linux, etc. We tried
//   adding the ${channel} macro to these values, but Electron-Builder didn't like that.

// if (!test.test(version)) {
//   process.exit();
// }

console.log('prepare_chativetest_build: updating package.json');

// -------

const NAME_PATH = 'name';
const TEST_NAME = 'chativetest-desktop';

const PRODUCT_NAME_PATH = 'productName';
const TEST_PRODUCT_NAME = 'ChativeTest';

const APP_ID_PATH = 'build.appId';
const TEST_APP_ID = 'org.difft.chativetest-desktop';

const STARTUP_WM_CLASS_PATH = 'build.linux.desktop.StartupWMClass';
const TEST_STARTUP_WM_CLASS = 'ChativeTest';

const RPM_PACKAGE_NAME_PATH = 'build.rpm.packageName';
const DEB_PACKAGE_NAME_PATH = 'build.deb.packageName';
const TEST_LINUX_PACKAGE_NAME = 'chativetest';

const DESCRIPTION_PATH = 'description';
const TEST_DESCRIPTION = 'ChativeTest Desktop';

// -------

function checkValue(object, objectPath, expected) {
  const actual = _.get(object, objectPath);
  if (actual !== expected) {
    throw new Error(`${objectPath} was ${actual}; expected ${expected}`);
  }
}

// ------

// checkValue(packageJson, NAME_PATH, PRODUCTION_NAME);
// checkValue(packageJson, PRODUCT_NAME_PATH, PRODUCTION_PRODUCT_NAME);
// checkValue(packageJson, APP_ID_PATH, PRODUCTION_APP_ID);
// checkValue(packageJson, STARTUP_WM_CLASS_PATH, PRODUCTION_STARTUP_WM_CLASS);
// checkValue(packageJson, DESCRIPTION_PATH, PRODUCTION_DESCRIPTION);

// -------

_.set(packageJson, NAME_PATH, TEST_NAME);
_.set(packageJson, PRODUCT_NAME_PATH, TEST_PRODUCT_NAME);
_.set(packageJson, APP_ID_PATH, TEST_APP_ID);
_.set(packageJson, STARTUP_WM_CLASS_PATH, TEST_STARTUP_WM_CLASS);
_.set(packageJson, RPM_PACKAGE_NAME_PATH, TEST_LINUX_PACKAGE_NAME);
_.set(packageJson, DEB_PACKAGE_NAME_PATH, TEST_LINUX_PACKAGE_NAME);
_.set(packageJson, DESCRIPTION_PATH, TEST_DESCRIPTION);

//
fs.writeFileSync('./package.json', JSON.stringify(packageJson, null, '  '));

console.log('prepare_test_build: updating ', './config/development.json');
fs.writeFileSync(
  './config/development.json',
  JSON.stringify(testJson, null, '  ')
);

console.log('prepare_test_build: updating ', './config/production.json');
_.set(testJson, 'updatesEnabled', true);
_.set(testJson, 'openDevTools', false);
_.unset(testJson, 'storageProfile');

fs.writeFileSync(
  './config/production.json',
  JSON.stringify(testJson, null, '  ')
);

// -------
const backgroundHtml = './background.html';

console.log('prepare_chativetest_build: updating ', backgroundHtml);

const bgHtml = fs.readFileSync(backgroundHtml, {
  encoding: 'utf8',
  flag: 'r',
});

// const frameStartPos = bgHtml.indexOf('img-src');
// const frameEndPos = bgHtml.indexOf('media-src');
// const newBgHtml =
//   bgHtml.substr(0, frameStartPos) +
//   'img-src *;\n' +
//   bgHtml.substr(frameEndPos);
const newBgHtml = bgHtml.replace(
  /uploadimage.difft.org/,
  'uploadimage.test.difft.org'
);

fs.writeFileSync(backgroundHtml, newBgHtml);
