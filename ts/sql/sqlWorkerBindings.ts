// This is a shim that gets inserted in place of `bindings` npm module when
// building sql worker bundle.
module.exports = (binding: string) => {
  if (binding === 'better_sqlite3.node') {
    return require('better_sqlite3.node');
  }

  throw new Error(`Unknown binding ${binding}`);
};
