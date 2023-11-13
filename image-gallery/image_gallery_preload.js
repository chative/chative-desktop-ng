/* global window */

const electron = require('electron');
const { ipcRenderer } = require('electron');
const remote = require('@electron/remote');
const fse = require('fs-extra');
const toArrayBuffer = require('to-arraybuffer');

// const Attachments = require('../app/attachments');
const i18n = require('../js/modules/i18n');
const url = require('url');

const config = url.parse(window.location.toString(), true).query;
const { locale } = config;
const localeMessages = ipcRenderer.sendSync('locale-data');

ipcRenderer.on('receive-images', (_, { mediaFiles, selectedIndex }) => {
  window.mediaFiles = mediaFiles;
  window.selectedIndex = selectedIndex;
});

window.getEnvironment = () => config.environment;
window.getVersion = () => config.version;

window.React = require('react');
window.ReactDOM = require('react-dom');
window.moment = require('moment');
window.i18n = i18n.setup(locale, localeMessages);

// window.forwardImage = () => ipcRenderer.send('show-forward-image');
window.closeWindow = () => remote.getCurrentWindow().close();

// const Signal = require('../js/modules/signal');
require('../js/logging');
const { copyImageFile } = require('../js/modules/copy_image');

window.copyImageFile = copyImageFile;

window.openFileDefault = (absPath, fileName, contentType) => {
  ipcRenderer.send('open-file-default', absPath, fileName, contentType);
};

window.readFileBuffer = async filePath => {
  const buffer = await fse.readFile(filePath);
  return toArrayBuffer(buffer);
};

window.getImageGalleryView = () => {
  const {
    ImageGallery,
  } = require('../ts/components/image-gallery/ImageGallery');
  return ImageGallery;
};

// window.Signal = Signal.setup({
//   Attachments,
//   userDataPath: app.getPath('userData'),
//   getRegionCode: () => window.storage.get('regionCode'),
//   logger: window.log,
// });
