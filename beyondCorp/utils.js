const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const WHITE_SUFFIX = [
  // 'jpg',
  // 'jpeg',
  // 'tiff',
  // 'png',
  // 'gif',
  // 'svg',
  // 'bmp',
  'js',
  'css',
  // 'otf',
];
const checkStaticResource = reqUrl => {
  if (!reqUrl) {
    return false;
  }
  const data = reqUrl?.split('?')[0]?.split('.') || [];
  if (!data.length) {
    return false;
  }
  const suffix = data[data.length - 1].toLowerCase();
  if (WHITE_SUFFIX.includes(suffix)) {
    return true;
  }
  return false;
};

const formatCookie = cookieStr => {
  const data = cookieStr?.split(';') || [];
  if (!data.length) {
    return false;
  }
  const cookie = {};
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      const mainData = data[0]?.split('=') || [];
      if (mainData.length < 2) {
        return false;
      }
      cookie.name = mainData[0];
      cookie.value = mainData[1];
    }
    if (data[i].trim().startsWith('Path')) {
      const d = data[i]?.split('=') || [];
      if (d.length >= 2) {
        cookie.path = d[1];
      }
    }
    if (data[i].trim().startsWith('Expires')) {
      const d = data[i]?.split('=') || [];
      if (d.length >= 2) {
        cookie.expirationDate = d[1];
      }
    }
    if (data[i].trim() === 'Secure') {
      cookie.secure = true;
    }
    if (data[i].trim() === 'HttpOnly') {
      cookie.httpOnly = true;
    }
  }
  const { name, value } = cookie || {};
  if (name && value) {
    return cookie;
  } else {
    return false;
  }
};

const sha256 = str => {
  return crypto.createHash('sha256').update(str).digest('hex');
};

const mkdirsSync = dirname => {
  if (fs.existsSync(dirname)) {
    return true;
  } else {
    if (mkdirsSync(path.dirname(dirname))) {
      fs.mkdirSync(dirname);
      return true;
    }
  }
};

const deleteFile = async (url, name) => {
  try {
    let files = [];

    if (fs.existsSync(url)) {
      //判断给定的路径是否存在

      files = fs.readdirSync(url); //返回文件和子目录的数组

      files.forEach(function (file, index) {
        const curPath = path.join(url, file);

        if (fs.statSync(curPath).isDirectory()) {
          // 同步读取文件夹文件，如果是文件夹，则函数回调
          deleteFile(curPath, name);
        } else {
          if (file.indexOf(name) > -1) {
            //是指定文件，则删除
            fs.unlinkSync(curPath);
            console.log('删除文件：' + curPath);
          }
        }
      });
    } else {
      console.log('给定的路径不存在！');
    }
  } catch (e) {
    console.log('delete disk cache catch error: ' + e);
  }
};

const handleHeadersCookie = cookies => {
  const headers = {};
  for (const cookie of cookies) {
    if (headers['Cookie']?.length) {
      headers['Cookie'] += '; ';
    } else {
      headers['Cookie'] = '';
    }
    headers['Cookie'] += `${cookie.name}=${cookie.value}`;
  }
  return headers;
};

module.exports = {
  checkStaticResource,
  formatCookie,
  mkdirsSync,
  deleteFile,
  sha256,
  handleHeadersCookie,
};
