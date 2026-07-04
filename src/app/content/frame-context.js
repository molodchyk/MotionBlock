(function (root) {
  "use strict";

  function createFrameContext(options) {
    const config = options.config;
    const document = options.document;
    const window = options.window;
    const frameHost = config.normalizeHostname(window.location.hostname);
    const settingsHost = getSettingsHostForFrame();

    return {
      currentHost: settingsHost === frameHost ? settingsHost : [settingsHost, frameHost].filter(Boolean).join(" "),
      frameHost,
      settingsHost
    };

    function getSettingsHostForFrame() {
      if (!isFramedWindow()) {
        return frameHost;
      }

      return getTopAncestorHost() || getReferrerHost() || frameHost;
    }

    function isFramedWindow() {
      try {
        return window.self !== window.top;
      } catch (error) {
        return true;
      }
    }

    function getTopAncestorHost() {
      const ancestorOrigins = getAncestorOrigins();

      for (let index = ancestorOrigins.length - 1; index >= 0; index -= 1) {
        const host = config.getConfigurableHostFromUrl(ancestorOrigins[index]);
        if (host) {
          return host;
        }
      }

      return "";
    }

    function getAncestorOrigins() {
      const origins = [];

      try {
        const ancestorOrigins = window.location && window.location.ancestorOrigins;
        if (!ancestorOrigins || typeof ancestorOrigins.length !== "number") {
          return origins;
        }

        for (let index = 0; index < ancestorOrigins.length; index += 1) {
          origins.push(String(ancestorOrigins[index] || ""));
        }
      } catch (error) {
        return [];
      }

      return origins;
    }

    function getReferrerHost() {
      return config.getConfigurableHostFromUrl(document.referrer || "");
    }
  }

  root.MotionBlockFrameContext = {
    createFrameContext
  };
})(globalThis);
