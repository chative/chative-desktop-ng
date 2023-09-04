const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const excludeFiles = [
  'obfuscate.js',
  'js/components.js',
  'js/libtextsecure.js',
  'js/util_worker.js',
  'js/libphonenumber-util.js',
  'js/libsignal-protocol-worker.js',
  'js/Mp3LameEncoder.min.js',
  'js/signal_protocol_store.js',
  'js/curve/curve25519_compiled.js',
  'js/curve/curve25519_wrapper.js',
  'ts/protobuf/compiled.js',
];

function obfuscate(file) {
  if (!file.endsWith('.js') || file.startsWith('.')) {
    return;
  }
  for (let i = 0; i < excludeFiles.length; i += 1) {
    if (file.endsWith(excludeFiles[i])) {
      return;
    }
  }
  console.log('obfuscate file:', file);
  try {
    const source = fs.readFileSync(file, 'utf8');
    const obfuscationResult = JavaScriptObfuscator.obfuscate(source, {
      log: false,
      disableConsoleOutput: true,
    });
    fs.writeFileSync(file, obfuscationResult.getObfuscatedCode());
  } catch (err) {
    console.error(err);
  }
}

function fileDisplay(filePath, recursion = true) {
  fs.readdir(filePath, function (err, files) {
    if (err) {
      console.warn(err);
    } else {
      files.forEach(function (filename) {
        const theFileFullName = path.join(filePath, filename);
        fs.stat(theFileFullName, function (err, stats) {
          if (err) {
            console.warn(err);
          } else {
            const isFile = stats.isFile();
            const isDir = stats.isDirectory();
            if (isFile) {
              obfuscate(theFileFullName);
            }
            if (isDir && recursion) {
              fileDisplay(theFileFullName);
            }
          }
        });
      });
    }
  });
}

fileDisplay(path.join(__dirname), false);
fileDisplay(path.join(__dirname, 'ts'));
fileDisplay(path.join(__dirname, 'js'));
fileDisplay(path.join(__dirname, 'app'));
