(function (root) {
  "use strict";

  function createSettingsStorage(chromeApi, config) {
    async function initializeSettings() {
      const data = await chromeApi.storage.sync.get(config.STORAGE_KEY);
      return sanitizeSettingsForStorage(data[config.STORAGE_KEY] || config.DEFAULT_SETTINGS);
    }

    async function getStoredSettings() {
      const data = await chromeApi.storage.sync.get(config.STORAGE_KEY);
      return sanitizeSettingsForStorage(data[config.STORAGE_KEY]);
    }

    async function saveSettings(settings) {
      await chromeApi.storage.sync.set({
        [config.STORAGE_KEY]: sanitizeSettingsForStorage(settings)
      });
    }

    function sanitizeSettingsForStorage(settings) {
      const normalized = config.normalizeSettings(settings);
      const ownExtensionHost = config.normalizeHostname(chromeApi.runtime && chromeApi.runtime.id ? chromeApi.runtime.id : "");

      if (ownExtensionHost && normalized.siteRules[ownExtensionHost]) {
        delete normalized.siteRules[ownExtensionHost];
      }

      return normalized;
    }

    return {
      getStoredSettings,
      initializeSettings,
      sanitizeSettingsForStorage,
      saveSettings
    };
  }

  root.MotionBlockSettingsStorage = {
    createSettingsStorage
  };
})(globalThis);
