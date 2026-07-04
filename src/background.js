importScripts(
  "shared/i18n.js",
  "shared/config.js",
  "platform/chrome/settings-storage.js",
  "features/network-blocking/background/dynamic-rules.js",
  "features/block-stats/background/tab-stats.js",
  "features/diagnostics/shared/url-sanitizer.js",
  "features/diagnostics/background/diagnostics-store.js",
  "app/background/message-router.js"
);

const MB = globalThis.MotionBlock;
const NETWORK_RULES = globalThis.MotionBlockNetworkRules;
const TAB_STATS = globalThis.MotionBlockTabStats.createTabStatsStore(MB.FEATURE_KEYS);
const DIAGNOSTICS = globalThis.MotionBlockDiagnosticsStore.createDiagnosticsStore();
const SETTINGS_STORAGE = globalThis.MotionBlockSettingsStorage.createSettingsStorage(chrome, MB);
const handleMessage = globalThis.MotionBlockMessageRouter.createMessageRouter({
  addTemporaryAllowRules,
  config: MB,
  diagnostics: DIAGNOSTICS,
  rebuildDynamicRules,
  settingsStorage: SETTINGS_STORAGE,
  t,
  tabStats: TAB_STATS
});
const RULE_ID_START = 1100;
const RULE_ID_END = 1299;
const TEMP_ALLOW_RULE_ID_START = 910000;
const TEMP_ALLOW_RULE_ID_END = 910199;
let rulesUpdateQueue = Promise.resolve();

chrome.runtime.onInstalled.addListener(function () {
  initializeSettings().then(rebuildDynamicRules);
});

chrome.runtime.onStartup.addListener(function () {
  rebuildDynamicRules();
});

chrome.storage.onChanged.addListener(function (changes, areaName) {
  if (areaName === "sync" && changes[MB.STORAGE_KEY]) {
    rebuildDynamicRules(MB.normalizeSettings(changes[MB.STORAGE_KEY].newValue));
  }
});

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch(function (error) {
      sendResponse({ ok: false, error: error && error.message ? error.message : String(error) });
    });

  return true;
});

chrome.tabs.onRemoved.addListener(function (tabId) {
  TAB_STATS.clearTab(tabId);
  DIAGNOSTICS.clearTab(tabId);
});

async function initializeSettings() {
  const settings = await SETTINGS_STORAGE.initializeSettings();
  await rebuildDynamicRules(settings);
  await SETTINGS_STORAGE.saveSettings(settings);
}

function rebuildDynamicRules(settingsOverride) {
  const normalizedSettings = settingsOverride ? MB.normalizeSettings(settingsOverride) : null;

  rulesUpdateQueue = rulesUpdateQueue
    .catch(function () {
      return undefined;
    })
    .then(function () {
      return rebuildDynamicRulesNow(normalizedSettings);
    });

  return rulesUpdateQueue;
}

async function rebuildDynamicRulesNow(settingsOverride) {
  const settings = settingsOverride || (await SETTINGS_STORAGE.getStoredSettings());
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = NETWORK_RULES.getRuleIdsInRange(existingRules, RULE_ID_START, RULE_ID_END);

  const addRules = settings.enabled ? NETWORK_RULES.buildDynamicRules(settings, { ruleIdStart: RULE_ID_START }) : [];

  if (removeRuleIds.length) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds
    });
  }

  if (addRules.length) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules
    });
  }
}

async function addTemporaryAllowRules(urls, resourceTypes) {
  const sessionRules = await chrome.declarativeNetRequest.getSessionRules();
  const removeRuleIds = NETWORK_RULES.getRuleIdsInRange(sessionRules, TEMP_ALLOW_RULE_ID_START, TEMP_ALLOW_RULE_ID_END);
  const addRules = NETWORK_RULES.buildTemporaryAllowRules(urls, resourceTypes, {
    ruleIdStart: TEMP_ALLOW_RULE_ID_START,
    ruleIdEnd: TEMP_ALLOW_RULE_ID_END
  });

  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds,
    addRules
  });
}

function t(key, fallback) {
  return globalThis.MotionBlockI18n.t(key, undefined, fallback);
}
