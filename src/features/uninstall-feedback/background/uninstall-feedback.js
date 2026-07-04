(function (root) {
  "use strict";

  const UNINSTALL_FEEDBACK_URL = "https://molodchyk.com/motionblock/uninstall/";

  function getUninstallFeedbackUrl(chromeApi) {
    const url = new URL(UNINSTALL_FEEDBACK_URL);
    const runtime = chromeApi && chromeApi.runtime;
    const i18n = chromeApi && chromeApi.i18n;

    url.searchParams.set("source", "chrome");
    url.searchParams.set("version", runtime && typeof runtime.getManifest === "function" ? runtime.getManifest().version : "");
    url.searchParams.set("lang", i18n && typeof i18n.getUILanguage === "function" ? i18n.getUILanguage() : "en");

    return url.toString();
  }

  async function configureUninstallFeedback(chromeApi) {
    if (!chromeApi || !chromeApi.runtime || typeof chromeApi.runtime.setUninstallURL !== "function") {
      return false;
    }

    await chromeApi.runtime.setUninstallURL(getUninstallFeedbackUrl(chromeApi));
    return true;
  }

  root.MotionBlockUninstallFeedback = {
    UNINSTALL_FEEDBACK_URL,
    configureUninstallFeedback,
    getUninstallFeedbackUrl
  };
})(globalThis);
