(function (root) {
  "use strict";

  function createMessageRouter(dependencies) {
    const config = dependencies.config;
    const diagnostics = dependencies.diagnostics;
    const settingsStorage = dependencies.settingsStorage;
    const tabStats = dependencies.tabStats;
    const rebuildDynamicRules = dependencies.rebuildDynamicRules;
    const addTemporaryAllowRules = dependencies.addTemporaryAllowRules;
    const t = dependencies.t;

    return async function handleMessage(message, sender) {
      if (!message || typeof message.type !== "string") {
        return { ok: false, error: t("errorMissingMessageType", "Missing message type.") };
      }

      if (message.type === "motionblock:statsUpdated") {
        tabStats.update(message.stats, sender);
        return { ok: true };
      }

      if (message.type === "motionblock:diagnosticsUpdated") {
        if (diagnostics && typeof diagnostics.update === "function") {
          diagnostics.update(message.diagnostics, sender);
        }
        return { ok: true };
      }

      if (message.type === "motionblock:getTabStats") {
        return {
          ok: true,
          stats: tabStats.aggregate(Number(message.tabId))
        };
      }

      if (message.type === "motionblock:getDiagnostics") {
        return {
          diagnostics: diagnostics && typeof diagnostics.aggregate === "function" ? diagnostics.aggregate(Number(message.tabId)) : null,
          ok: true
        };
      }

      if (message.type === "motionblock:getSettings") {
        const settings = await settingsStorage.getStoredSettings();
        return { ok: true, settings };
      }

      if (message.type === "motionblock:getSettingsForUrl") {
        const settings = await settingsStorage.getStoredSettings();
        const host = config.getConfigurableHostFromUrl(message.url || "");
        return {
          ok: true,
          settings,
          host,
          effective: config.getEffectiveSettings(settings, host)
        };
      }

      if (message.type === "motionblock:saveSettings") {
        const settings = settingsStorage.sanitizeSettingsForStorage(message.settings);
        await rebuildDynamicRules(settings);
        await settingsStorage.saveSettings(settings);
        return { ok: true, settings };
      }

      if (message.type === "motionblock:updateSiteRule") {
        const host = config.normalizeHostname(message.host || "");
        if (!host) {
          return { ok: false, error: t("errorMissingSiteHostname", "Missing site hostname.") };
        }

        const settings = await settingsStorage.getStoredSettings();
        const siteRules = Object.assign({}, settings.siteRules);
        const rule = config.normalizeSiteRule(message.rule);

        if (config.isEmptySiteRule(rule)) {
          delete siteRules[host];
        } else {
          siteRules[host] = rule;
        }

        const nextSettings = settingsStorage.sanitizeSettingsForStorage(Object.assign({}, settings, { siteRules }));
        await rebuildDynamicRules(nextSettings);
        await settingsStorage.saveSettings(nextSettings);

        return {
          ok: true,
          settings: nextSettings,
          host,
          effective: config.getEffectiveSettings(nextSettings, host)
        };
      }

      if (message.type === "motionblock:resetSiteRule") {
        const host = config.normalizeHostname(message.host || "");
        const settings = await settingsStorage.getStoredSettings();
        const siteRules = Object.assign({}, settings.siteRules);

        if (host) {
          delete siteRules[host];
        }

        const nextSettings = settingsStorage.sanitizeSettingsForStorage(Object.assign({}, settings, { siteRules }));
        await rebuildDynamicRules(nextSettings);
        await settingsStorage.saveSettings(nextSettings);

        return {
          ok: true,
          settings: nextSettings,
          host,
          effective: config.getEffectiveSettings(nextSettings, host)
        };
      }

      if (message.type === "motionblock:rebuildRules") {
        await rebuildDynamicRules();
        return { ok: true };
      }

      if (message.type === "motionblock:allowUrlsOnce") {
        const urls = Array.isArray(message.urls) ? message.urls : [];
        const resourceTypes = Array.isArray(message.resourceTypes) ? message.resourceTypes : [];
        await addTemporaryAllowRules(urls, resourceTypes);
        return { ok: true };
      }

      return { ok: false, error: t("errorUnknownMessageType", "Unknown message type.") };
    };
  }

  root.MotionBlockMessageRouter = {
    createMessageRouter
  };
})(globalThis);
