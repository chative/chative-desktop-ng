//      toLogFormat :: Error -> String
exports.toLogFormat = error => {
  if (!error) {
    return error;
  }

  if (error && error.stack) {
    return error.stack;
  }

  let jsonStr = undefined;
  try {
    jsonStr = JSON.stringify(error);
  } catch (error) {
    jsonStr = undefined;
  }

  return String(jsonStr);
};
