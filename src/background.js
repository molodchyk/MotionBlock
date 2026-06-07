importScripts("shared/config.js");

const MB = globalThis.MotionBlock;
const RULE_ID_START = 1100;
const RULE_ID_END = 1299;
const TEMP_ALLOW_RULE_ID_START = 910000;
const TEMP_ALLOW_RULE_ID_END = 910199;
let rulesUpdateQueue = Promise.resolve();
const tabStats = new Map();
const tabMainUrls = new Map();

const DNR_FEATURE_RULES = {
  gifv: [
    {
      regexFilter: "\\.gifv(?:$|[?#])",
      resourceTypes: ["image", "media", "xmlhttprequest", "other"]
    }
  ],
  animatedWebp: [
    {
      regexFilter: "\\.webp(?:$|[?#])",
      resourceTypes: ["image"]
    },
    {
      regexFilter: "^data:image/webp",
      resourceTypes: ["image"]
    }
  ],
  video: [
    {
      resourceTypes: ["media"]
    },
    {
      regexFilter: "\\.(?:mp4|m4v|webm|mov|m3u8|mpd)(?:$|[?#])",
      resourceTypes: ["media", "xmlhttprequest"]
    }
  ],
  audio: [
    {
      regexFilter: "\\.(?:mp3|m4a|aac|ogg|oga|wav|flac)(?:$|[?#])",
      resourceTypes: ["media"]
    }
  ]
};

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
  tabStats.delete(tabId);
  tabMainUrls.delete(tabId);
});

async function handleMessage(message, sender) {
  if (!message || typeof message.type !== "string") {
    return { ok: false, error: "Missing message type." };
  }

  if (message.type === "motionblock:statsUpdated") {
    updateTabStats(message.stats, sender);
    return { ok: true };
  }

  if (message.type === "motionblock:getTabStats") {
    const tabId = Number(message.tabId);
    return {
      ok: true,
      stats: aggregateTabStats(tabId)
    };
  }

  if (message.type === "motionblock:getSettings") {
    const settings = await getStoredSettings();
    return { ok: true, settings };
  }

  if (message.type === "motionblock:getSettingsForUrl") {
    const settings = await getStoredSettings();
    const host = MB.getConfigurableHostFromUrl(message.url || "");
    return {
      ok: true,
      settings,
      host,
      effective: MB.getEffectiveSettings(settings, host)
    };
  }

  if (message.type === "motionblock:saveSettings") {
    const settings = sanitizeSettingsForStorage(message.settings);
    await rebuildDynamicRules(settings);
    await saveSettings(settings);
    return { ok: true, settings };
  }

  if (message.type === "motionblock:updateSiteRule") {
    const host = MB.normalizeHostname(message.host || "");
    if (!host) {
      return { ok: false, error: "Missing site hostname." };
    }

    const settings = await getStoredSettings();
    const siteRules = Object.assign({}, settings.siteRules);
    const rule = MB.normalizeSiteRule(message.rule);

    if (MB.isEmptySiteRule(rule)) {
      delete siteRules[host];
    } else {
      siteRules[host] = rule;
    }

    const nextSettings = sanitizeSettingsForStorage(Object.assign({}, settings, { siteRules }));
    await rebuildDynamicRules(nextSettings);
    await saveSettings(nextSettings);

    return {
      ok: true,
      settings: nextSettings,
      host,
      effective: MB.getEffectiveSettings(nextSettings, host)
    };
  }

  if (message.type === "motionblock:resetSiteRule") {
    const host = MB.normalizeHostname(message.host || "");
    const settings = await getStoredSettings();
    const siteRules = Object.assign({}, settings.siteRules);

    if (host) {
      delete siteRules[host];
    }

    const nextSettings = sanitizeSettingsForStorage(Object.assign({}, settings, { siteRules }));
    await rebuildDynamicRules(nextSettings);
    await saveSettings(nextSettings);

    return {
      ok: true,
      settings: nextSettings,
      host,
      effective: MB.getEffectiveSettings(nextSettings, host)
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

  return { ok: false, error: "Unknown message type." };
}

async function initializeSettings() {
  const data = await chrome.storage.sync.get(MB.STORAGE_KEY);
  if (!data[MB.STORAGE_KEY]) {
    const settings = sanitizeSettingsForStorage(MB.DEFAULT_SETTINGS);
    await rebuildDynamicRules(settings);
    await saveSettings(settings);
  } else {
    const settings = sanitizeSettingsForStorage(data[MB.STORAGE_KEY]);
    await rebuildDynamicRules(settings);
    await saveSettings(settings);
  }
}

async function getStoredSettings() {
  const data = await chrome.storage.sync.get(MB.STORAGE_KEY);
  return sanitizeSettingsForStorage(data[MB.STORAGE_KEY]);
}

async function saveSettings(settings) {
  await chrome.storage.sync.set({
    [MB.STORAGE_KEY]: sanitizeSettingsForStorage(settings)
  });
}

function updateTabStats(stats, sender) {
  if (!sender || !sender.tab || typeof sender.tab.id !== "number") {
    return;
  }

  const tabId = sender.tab.id;
  const frameId = typeof sender.frameId === "number" ? sender.frameId : 0;
  const senderUrl = sender.url || "";
  const mainUrl = sender.tab.url || (frameId === 0 ? senderUrl : "");

  if (mainUrl && tabMainUrls.get(tabId) !== mainUrl) {
    tabStats.delete(tabId);
    tabMainUrls.set(tabId, mainUrl);
  }

  if (!tabStats.has(tabId)) {
    tabStats.set(tabId, new Map());
  }

  const frameStats = tabStats.get(tabId);
  frameStats.set(getFrameStatsKey(sender), {
    stats: sanitizeBlockStats(stats),
    frameId,
    url: senderUrl,
    updatedAt: Date.now()
  });
}

function aggregateTabStats(tabId) {
  const aggregate = createEmptyBlockStats();
  const frameStats = tabStats.get(tabId);

  if (!frameStats) {
    return {
      byFeature: aggregate,
      total: 0,
      frames: 0
    };
  }

  let frames = 0;
  frameStats.forEach(function (entry) {
    frames += 1;
    MB.FEATURE_KEYS.forEach(function (key) {
      aggregate[key] += Number(entry.stats.byFeature[key] || 0);
    });
  });

  return {
    byFeature: aggregate,
    total: sumStats(aggregate),
    frames
  };
}

function getFrameStatsKey(sender) {
  const frameId = typeof sender.frameId === "number" ? sender.frameId : 0;
  const documentId = sender.documentId || "";
  const url = sender.url || "";
  return frameId + ":" + (documentId || url);
}

function sanitizeBlockStats(stats) {
  const source = stats && typeof stats === "object" ? stats.byFeature || {} : {};
  const byFeature = createEmptyBlockStats();

  MB.FEATURE_KEYS.forEach(function (key) {
    const value = Number(source[key] || 0);
    byFeature[key] = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  });

  return {
    byFeature,
    total: sumStats(byFeature)
  };
}

function createEmptyBlockStats() {
  const stats = {};
  MB.FEATURE_KEYS.forEach(function (key) {
    stats[key] = 0;
  });
  return stats;
}

function sumStats(stats) {
  return MB.FEATURE_KEYS.reduce(function (sum, key) {
    return sum + Number(stats[key] || 0);
  }, 0);
}

function sanitizeSettingsForStorage(settings) {
  const normalized = MB.normalizeSettings(settings);
  const ownExtensionHost = MB.normalizeHostname(chrome.runtime && chrome.runtime.id ? chrome.runtime.id : "");

  if (ownExtensionHost && normalized.siteRules[ownExtensionHost]) {
    delete normalized.siteRules[ownExtensionHost];
  }

  return normalized;
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
  const settings = settingsOverride || (await getStoredSettings());
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existingRules
    .map(function (rule) {
      return rule.id;
    })
    .filter(function (id) {
      return id >= RULE_ID_START && id <= RULE_ID_END;
    });

  const addRules = settings.enabled ? buildDynamicRules(settings) : [];

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
  const normalizedResourceTypes = resourceTypes.filter(function (resourceType) {
    return typeof resourceType === "string";
  });
  const uniqueUrls = unique(urls)
    .filter(function (url) {
      return /^https?:\/\//i.test(url) || /^file:\/\//i.test(url);
    })
    .filter(function (url) {
      return url.length < 1800;
    })
    .slice(0, TEMP_ALLOW_RULE_ID_END - TEMP_ALLOW_RULE_ID_START + 1);

  const sessionRules = await chrome.declarativeNetRequest.getSessionRules();
  const removeRuleIds = sessionRules
    .map(function (rule) {
      return rule.id;
    })
    .filter(function (id) {
      return id >= TEMP_ALLOW_RULE_ID_START && id <= TEMP_ALLOW_RULE_ID_END;
    });

  const addRules = uniqueUrls.map(function (url, index) {
    return {
      id: TEMP_ALLOW_RULE_ID_START + index,
      priority: 10,
      action: { type: "allow" },
      condition: {
        regexFilter: "^" + escapeRegex(url) + "$",
        isUrlFilterCaseSensitive: false,
        resourceTypes: normalizedResourceTypes.length ? normalizedResourceTypes : ["image", "media", "xmlhttprequest"]
      }
    };
  });

  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds,
    addRules
  });
}

function buildDynamicRules(settings) {
  const rules = [];
  let id = RULE_ID_START;

  Object.keys(DNR_FEATURE_RULES).forEach(function (featureKey) {
    const globalValue = Boolean(settings.features[featureKey]);
    const disabledHosts = getDisabledHosts(settings);
    const featureOffHosts = getHostsWithFeatureOverride(settings, featureKey, false);
    const featureOnHosts = getHostsWithFeatureOverride(settings, featureKey, true)
      .filter(function (host) {
        return disabledHosts.indexOf(host) === -1;
      });

    if (globalValue) {
      DNR_FEATURE_RULES[featureKey].forEach(function (template) {
        const condition = cloneCondition(template);
        const excludedHosts = unique(disabledHosts.concat(featureOffHosts)).filter(isDnrDomain);

        if (excludedHosts.length) {
          condition.excludedInitiatorDomains = excludedHosts;
        }

        rules.push(createBlockRule(id, condition));
        id += 1;
      });
      return;
    }

    if (featureOnHosts.length) {
      DNR_FEATURE_RULES[featureKey].forEach(function (template) {
        const condition = cloneCondition(template);
        condition.initiatorDomains = unique(featureOnHosts).filter(isDnrDomain);

        if (condition.initiatorDomains.length) {
          rules.push(createBlockRule(id, condition));
          id += 1;
        }
      });
    }
  });

  return rules;
}

function createBlockRule(id, condition) {
  return {
    id,
    priority: 1,
    action: { type: "block" },
    condition
  };
}

function cloneCondition(template) {
  const condition = {
    resourceTypes: template.resourceTypes.slice()
  };

  if (template.regexFilter) {
    condition.regexFilter = template.regexFilter;
    condition.isUrlFilterCaseSensitive = false;
  }

  return condition;
}

function getDisabledHosts(settings) {
  return Object.keys(settings.siteRules).filter(function (host) {
    return settings.siteRules[host].enabled === false;
  });
}

function getHostsWithFeatureOverride(settings, featureKey, value) {
  return Object.keys(settings.siteRules).filter(function (host) {
    const rule = settings.siteRules[host];
    return rule.enabled !== false && rule.features && rule.features[featureKey] === value;
  });
}

function isDnrDomain(host) {
  return /^[a-z0-9.-]+$/i.test(host) && host.indexOf("..") === -1;
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
