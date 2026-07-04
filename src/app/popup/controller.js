(function (root) {
  "use strict";

  function createPopupController(options) {
    const config = options.config;
    const chromeApi = options.chrome;
    const document = options.document;
    const i18n = options.i18n;
    const popupView = options.popupView;
    const view = popupView.createPopupView({
      config,
      document,
      elements: getElements(document),
      i18n
    });

    let currentTab = null;
    let host = "";
    let settings = config.DEFAULT_SETTINGS;
    let effective = config.getEffectiveSettings(settings, host);
    let tabStats = popupView.createEmptyTabStats(config.FEATURE_KEYS);
    let diagnostics = popupView.createEmptyDiagnostics();
    let statsRefreshTimer = 0;
    let statsRefreshInterval = 0;
    let unsupportedPage = false;

    function start() {
      i18n.localizeDocument(document);
      registerEvents();
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", queueInit, { once: true });
      } else {
        queueInit();
      }
    }

    function registerEvents() {
      const elements = getElements(document);
      options.window.addEventListener("unload", clearTimers);
      elements.siteEnabled.addEventListener("change", function () {
        const rule = getCurrentRule();
        rule.enabled = popupView.parseTriState(elements.siteEnabled.value);
        saveSiteRule(rule);
      });
      elements.featureList.addEventListener("change", function (event) {
        const select = event.target.closest("select[data-feature]");
        if (!select) {
          return;
        }

        const rule = getCurrentRule();
        const value = popupView.parseTriState(select.value);
        rule.features[select.dataset.feature] = value;
        if (value === true && rule.enabled === false) {
          rule.enabled = true;
        }
        saveSiteRule(rule);
      });
      elements.resetSiteButton.addEventListener("click", resetSite);
      elements.reloadTabButton.addEventListener("click", reloadTab);
      elements.openOptionsButton.addEventListener("click", function () {
        chromeApi.runtime.openOptionsPage();
      });
      elements.blockMotionHereButton.addEventListener("click", blockMotionHere);
      elements.allowSiteButton.addEventListener("click", allowSite);
      elements.copyDiagnosticsButton.addEventListener("click", copyDiagnostics);
      elements.refreshDiagnosticsButton.addEventListener("click", function () {
        refreshDiagnostics(true);
      });
    }

    async function init() {
      const tabs = await chromeApi.tabs.query({ active: true, currentWindow: true });
      currentTab = tabs[0] || null;
      host = currentTab ? config.getConfigurableHostFromUrl(currentTab.url || "") : "";

      if (!host) {
        showUnsupportedPage();
        return;
      }

      applyResponse(
        await sendMessage({
          type: "motionblock:getSettingsForUrl",
          url: currentTab.url
        })
      );
      refreshStats();
      refreshDiagnostics(false);
      statsRefreshInterval = options.window.setInterval(refreshStats, 1200);
    }

    function queueInit() {
      init().catch(function (error) {
        view.setLoadError(error && error.message);
      });
    }

    async function resetSite() {
      if (!host) {
        return;
      }

      const response = await sendMessage({ type: "motionblock:resetSiteRule", host });
      applyResponse(response);
      view.showReloadHint(response && response.ok);
    }

    function reloadTab() {
      if (currentTab && typeof currentTab.id === "number") {
        chromeApi.tabs.reload(currentTab.id);
      }
    }

    function blockMotionHere() {
      const rule = getCurrentRule();
      rule.enabled = true;
      ["gifs", "gifv", "autoplayVideo", "cssMotion"].forEach(function (key) {
        rule.features[key] = true;
      });
      saveSiteRule(rule);
    }

    function allowSite() {
      const rule = getCurrentRule();
      rule.enabled = false;
      saveSiteRule(rule);
    }

    async function saveSiteRule(rule) {
      const response = await sendMessage({
        type: "motionblock:updateSiteRule",
        host,
        rule
      });
      applyResponse(response);
      view.showReloadHint(response && response.ok);
      scheduleStatsRefresh();
      refreshDiagnostics(false);
      applyCurrentTabNow();
    }

    function applyResponse(response) {
      if (!response || !response.ok) {
        view.setLoadError(response && response.error);
        return;
      }

      settings = config.normalizeSettings(response.settings);
      config.applyUiTheme(settings.uiTheme);
      host = response.host || host;
      effective = response.effective || config.getEffectiveSettings(settings, host);
      unsupportedPage = false;
      view.setControlsDisabled(false, hasSiteRule());
      render();
    }

    function render() {
      view.render({
        effective,
        hasSiteRule: hasSiteRule(),
        host,
        rule: getCurrentRule(),
        settings,
        diagnostics,
        tabStats,
        unsupportedPage
      });
    }

    function getCurrentRule() {
      if (!host || !settings.siteRules[host]) {
        return config.createEmptySiteRule();
      }
      return config.normalizeSiteRule(settings.siteRules[host]);
    }

    function hasSiteRule() {
      return Boolean(host && settings.siteRules[host] && !config.isEmptySiteRule(settings.siteRules[host]));
    }

    function showUnsupportedPage() {
      unsupportedPage = true;
      host = "";
      settings = config.normalizeSettings(settings);
      config.applyUiTheme(settings.uiTheme);
      tabStats = popupView.createEmptyTabStats(config.FEATURE_KEYS);
      diagnostics = popupView.createEmptyDiagnostics();
      view.renderUnsupported(tabStats);
    }

    async function refreshStats() {
      if (!currentTab || typeof currentTab.id !== "number" || unsupportedPage) {
        tabStats = popupView.createEmptyTabStats(config.FEATURE_KEYS);
        view.renderStats(tabStats);
        return;
      }

      try {
        const response = await sendMessage({
          type: "motionblock:getTabStats",
          tabId: currentTab.id
        });
        if (response && response.ok) {
          tabStats = popupView.normalizeTabStats(response.stats, config.FEATURE_KEYS);
          view.renderStats(tabStats);
        }
      } catch (error) {
        return;
      }
    }

    function scheduleStatsRefresh() {
      if (statsRefreshTimer) {
        options.window.clearTimeout(statsRefreshTimer);
      }

      statsRefreshTimer = options.window.setTimeout(function () {
        statsRefreshTimer = 0;
        refreshStats();
      }, 350);
    }

    async function refreshDiagnostics(showStatus) {
      if (!settings.diagnosticsEnabled || !currentTab || typeof currentTab.id !== "number" || unsupportedPage) {
        diagnostics = popupView.createEmptyDiagnostics();
        view.renderDiagnostics({
          diagnostics,
          effective,
          host,
          settings,
          tabStats,
          unsupportedPage
        });
        return;
      }

      try {
        await flushContentDiagnostics();
        const response = await sendMessage({
          type: "motionblock:getDiagnostics",
          tabId: currentTab.id
        });
        if (response && response.ok) {
          diagnostics = popupView.normalizeDiagnostics(response.diagnostics);
          view.renderDiagnostics({
            diagnostics,
            effective,
            host,
            settings,
            tabStats,
            unsupportedPage
          });
          if (showStatus) {
            view.showDiagnosticsStatus(t("diagnosticsRefreshed", "Diagnostics refreshed."));
          }
        }
      } catch (error) {
        if (showStatus) {
          view.showDiagnosticsStatus(t("diagnosticsRefreshFailed", "Could not refresh diagnostics."));
        }
      }
    }

    async function flushContentDiagnostics() {
      try {
        const result = chromeApi.tabs.sendMessage(currentTab.id, { type: "motionblock:flushDiagnostics" });
        if (result && typeof result.catch === "function") {
          await result.catch(function () {});
        }
      } catch (error) {
        return;
      }
    }

    async function copyDiagnostics() {
      await refreshDiagnostics(false);

      const text = popupView.formatDiagnosticsLog({
        diagnostics,
        effective,
        host,
        settings,
        tabStats,
        unsupportedPage
      });

      try {
        if (options.window.navigator && options.window.navigator.clipboard && options.window.navigator.clipboard.writeText) {
          await options.window.navigator.clipboard.writeText(text);
        } else {
          fallbackCopyDiagnostics(text);
        }
        view.showDiagnosticsStatus(t("diagnosticsCopied", "Diagnostics copied."));
      } catch (error) {
        try {
          fallbackCopyDiagnostics(text);
          view.showDiagnosticsStatus(t("diagnosticsCopied", "Diagnostics copied."));
        } catch (fallbackError) {
          view.showDiagnosticsStatus(t("diagnosticsCopyFailed", "Could not copy diagnostics."));
        }
      }
    }

    function fallbackCopyDiagnostics(text) {
      const elements = getElements(document);
      elements.diagnosticsLog.value = text;
      elements.diagnosticsLog.focus();
      elements.diagnosticsLog.select();
      document.execCommand("copy");
    }

    function applyCurrentTabNow() {
      if (!currentTab || typeof currentTab.id !== "number") {
        return;
      }

      try {
        const result = chromeApi.tabs.sendMessage(currentTab.id, { type: "motionblock:applyNow" });
        if (result && typeof result.catch === "function") {
          result.catch(function () {});
        }
      } catch (error) {
        return;
      }
    }

    function clearTimers() {
      if (statsRefreshTimer) {
        options.window.clearTimeout(statsRefreshTimer);
      }
      if (statsRefreshInterval) {
        options.window.clearInterval(statsRefreshInterval);
      }
    }

    function sendMessage(message) {
      return chromeApi.runtime.sendMessage(message);
    }

    function t(key, fallback) {
      return i18n.t(key, undefined, fallback);
    }

    return {
      start
    };
  }

  function getElements(document) {
    return {
      allowSiteButton: document.getElementById("allowSite"),
      blockMotionHereButton: document.getElementById("blockMotionHere"),
      copyDiagnosticsButton: document.getElementById("copyDiagnostics"),
      diagnosticsLog: document.getElementById("diagnosticsLog"),
      diagnosticsPanel: document.getElementById("diagnosticsPanel"),
      diagnosticsStatus: document.getElementById("diagnosticsStatus"),
      diagnosticsSummary: document.getElementById("diagnosticsSummary"),
      effectiveSummary: document.getElementById("effectiveSummary"),
      featureList: document.getElementById("featureList"),
      openOptionsButton: document.getElementById("openOptions"),
      refreshDiagnosticsButton: document.getElementById("refreshDiagnostics"),
      reloadHint: document.getElementById("reloadHint"),
      reloadTabButton: document.getElementById("reloadTab"),
      resetSiteButton: document.getElementById("resetSite"),
      siteEnabled: document.getElementById("siteEnabled"),
      siteLabel: document.getElementById("siteLabel"),
      siteRuleNote: document.getElementById("siteRuleNote"),
      statsTotal: document.getElementById("statsTotal"),
      statusBadge: document.getElementById("statusBadge")
    };
  }

  root.MotionBlockPopupController = {
    createPopupController
  };
})(globalThis);
