(function () {
  'use strict';
  window.isShouldScrollToBottom = false;
  let startTime = new Date();
  window.addEventListener('mousemove', () => {
    startTime = new Date();
  });
  window.addEventListener('click', () => {
    startTime = new Date();
  });
  window.addEventListener('keydown', () => {
    startTime = new Date();
  });
  window.isActivation = () => {
    //return false;
    let endTime = new Date();
    let diffTime = endTime - startTime;
    if (diffTime > 60 * 1000) {
      window.isShouldScrollToBottom = true;
      return false;
    } else {
      return true;
    }
  };
})();
