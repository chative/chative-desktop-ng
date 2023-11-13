import { join, resolve } from 'path';
import { readdir as readdirCallback } from 'fs';

import pify from 'pify';

import { getCliOptions, getPrintableError } from './common';
import { writeSignature } from './signature';

// @ts-ignore
import * as packageJson from '../../package.json';

const readdir = pify(readdirCallback);

/* tslint:disable:no-console */

const OPTIONS = [
  {
    names: ['help', 'h'],
    type: 'bool',
    help: 'Print this help and exit.',
  },
  {
    names: ['private', 'p'],
    type: 'string',
    help: 'Path to private key file (default: ./private.key)',
    default: 'private.key',
  },
  {
    names: ['update', 'u'],
    type: 'string',
    help: 'Path to the update package (default: the .exe or .zip in ./release)',
  },
  {
    names: ['version', 'v'],
    type: 'string',
    help: `Version number of this package (default: ${packageJson.version})`,
    default: packageJson.version,
  },
];

type OptionsType = {
  private: string;
  update: string;
  version: string;
};

const cliOptions = getCliOptions<OptionsType>(OPTIONS);
go(cliOptions).catch(error => {
  console.error('Something went wrong!', getPrintableError(error));
});

async function go(options: OptionsType) {
  const { private: privateKey, version } = options;

  let updatePaths: Array<string>;
  if (options.update) {
    updatePaths = [options.update];
  } else {
    updatePaths = await findUpdatePaths();
  }

  const privateKeyPath = `${packageJson.name}.${privateKey}`;

  await Promise.all(
    updatePaths.map(async updatePath => {
      console.log('Signing with...');
      console.log(`  version: ${version}`);
      console.log(`  update file: ${updatePath}`);
      console.log(`  private key file: ${privateKeyPath}`);

      await writeSignature(updatePath, version, privateKeyPath);
    })
  );
}

// const IS_EXE = /\.exe$/;
// const IS_ZIP = /\.zip$/;
async function findUpdatePaths(): Promise<Array<string>> {
  const releaseDir = resolve('release');
  const files: Array<string> = await readdir(releaseDir);

  const archs = ['x64', 'arm64'];
  const zips = archs.map(arch => `${packageJson.name}-mac-${arch}-latest.zip`);

  const max = files.length;
  const results = new Array<string>();

  for (let i = 0; i < max; i += 1) {
    const file = files[i];
    const fullPath = join(releaseDir, file);

    if (zips.includes(file)) {
      console.log('found file:', fullPath);
      results.push(fullPath);

      if (results.length === zips.length) {
        break;
      }
    }
  }

  if (results.length === 0) {
    throw new Error("No suitable file found in 'release' folder!");
  }

  return results;
}
