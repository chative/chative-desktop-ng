const path = require('path');

const { app } = require('electron');

const { start } = require('./base_config');
const config = require('./config');

// Use separate data directory for development
if (config.has('storageProfile')) {
  const standardPath = app.getPath('userData');
  const userData = path.join(
    path.dirname(standardPath),
    `${path.basename(standardPath)}-${config.get('storageProfile')}`
  );

  app.setPath('userData', userData);
}

const userDataPath = app.getPath('userData');
const targetPath = path.join(userDataPath, 'config.json');

console.log(`userData: ${userDataPath}`);

const userConfig = start('user', targetPath);

module.exports = userConfig;
