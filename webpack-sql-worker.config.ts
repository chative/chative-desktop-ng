import { resolve, join } from 'path';
import { Configuration } from 'webpack';

const context = __dirname;

// A path relative to `ts/sql/` in `asar.unpacked`
const libDir = join('..', '..', 'node_modules', '@signalapp/better-sqlite3');
const bindingFile = join(libDir, 'build', 'Release', 'better_sqlite3.node');

const workerConfig: Configuration = {
  context,
  mode: 'development',
  devtool: false,
  entry: ['./ts/sql/sqlWorker.js'],
  target: 'node',
  output: {
    path: resolve(context, 'ts', 'sql'),
    filename: 'sqlWorker.bundle.js',
    publicPath: './',
  },
  resolve: {
    extensions: ['.js'],
    alias: {
      bindings: join(context, 'ts', 'sql', 'sqlWorkerBindings.js'),
    },
  },
  externals: {
    'better_sqlite3.node': `commonjs2 ${bindingFile}`,
  },
};

export default [workerConfig];
