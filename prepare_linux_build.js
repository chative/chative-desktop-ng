const fs = require('fs');
const util = require('util');
const path = require('path');

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

async function deleteLine(filename, keyword) {
  let fileContent = await readFile(filename, { encoding: 'utf-8' });

  let newContent = fileContent.split('\n').filter(line => {
    return !line.includes(keyword);
  });

  await writeFile(filename, newContent.join('\n'));
}

async function deleteMeetingFiles() {
  const theDir = './ts/components/meeting/';

  let files = await fs.promises.readdir(theDir);
  files = files.filter(filename => {
    return filename.startsWith('Meeting');
  });

  for (const filename of files) {
    const filePath = path.join(theDir, filename);
    await fs.promises.unlink(filePath);
  }
}

async function main() {
  await deleteMeetingFiles();
}

main();
