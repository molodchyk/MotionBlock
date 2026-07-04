(function () {
  "use strict";

  window.MotionBlockPopupController
    .createPopupController({
      chrome,
      config: window.MotionBlock,
      document,
      i18n: window.MotionBlockI18n,
      popupView: window.MotionBlockPopupView,
      window
    })
    .start();
})();
