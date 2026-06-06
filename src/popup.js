(function () {
  "use strict";

  const MB = window.MotionBlock;
  const siteLabel = document.getElementById("siteLabel");
  const statusBadge = document.getElementById("statusBadge");
  const effectiveSummary = document.getElementById("effectiveSummary");
  const siteEnabled = document.getElementById("siteEnabled");
  const siteRuleNote = document.getElementById("siteRuleNote");
  const featureList = document.getElementById("featureList");
  const blockMotionHereButton = document.getElementById("blockMotionHere");
  const allowSiteButton = document.getElementById("allowSite");
  const resetSiteButton = document.getElementById("resetSite");
  const reloadTabButton = document.getElementById("reloadTab");
  const openOptionsButton = document.getElementById("openOptions");
  const reloadHint = document.getElementById("reloadHint");

  let currentTab = null;
  let host = "";
  let settings = MB.DEFAULT_SETTINGS;
  let effective = MB.getEffectiveSettings(settings, host);
  let unsupportedPage = false;

  document.addEventListener("DOMContentLoaded", init);

  siteEnabled.addEventListener("change", function () {
    const rule = getCurrentRule();
    rule.enabled = parseTriState(siteEnabled.value);
    saveSiteRule(rule);
  });

  featureList.addEventListener("change", function (event) {
    const select = event.target.closest("select[data-feature]");
    if (!select) {
      return;
    }

    const rule = getCurrentRule();
    rule.features[select.dataset.feature] = parseTriState(select.value);
    saveSiteRule(rule);
  });

  resetSiteButton.addEventListener("click", async function () {
    if (!host) {
      return;
    }

    const response = await sendMessage({ type: "motionblock:resetSiteRule", host });
    applyResponse(response);
    showReloadHint(response && response.ok);
  });

  reloadTabButton.addEventListener("click", function () {
    if (currentTab && currentTab.id) {
      chrome.tabs.reload(currentTab.id);
    }
  });

  openOptionsButton.addEventListener("click", function () {
    chrome.runtime.openOptionsPage();
  });

  blockMotionHereButton.addEventListener("click", function () {
    const rule = getCurrentRule();
    rule.enabled = true;
    ["gifs", "gifv", "autoplayVideo", "cssMotion"].forEach(function (key) {
      rule.features[key] = true;
    });
    saveSiteRule(rule);
  });

  allowSiteButton.addEventListener("click", function () {
    const rule = getCurrentRule();
    rule.enabled = false;
    saveSiteRule(rule);
  });

  async function init() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tabs[0] || null;
    host = currentTab ? MB.getConfigurableHostFromUrl(currentTab.url || "") : "";

    if (!host) {
      showUnsupportedPage();
      return;
    }

    const response = await sendMessage({
      type: "motionblock:getSettingsForUrl",
      url: currentTab.url
    });

    applyResponse(response);
  }

  function render() {
    unsupportedPage = false;
    delete document.body.dataset.pageState;
    siteLabel.textContent = host || "Unknown site";
    statusBadge.textContent = effective.enabled ? "Blocking" : "Allowed";
    statusBadge.classList.toggle("off", !effective.enabled);
    effectiveSummary.textContent = getEffectiveSummary();

    const rule = getCurrentRule();
    siteEnabled.value = formatTriState(rule.enabled);
    siteRuleNote.textContent = getSiteRuleNote(rule);

    featureList.innerHTML = "";
    MB.FEATURE_GROUPS.forEach(function (group) {
      const features = MB.FEATURE_DEFINITIONS.filter(function (feature) {
        return feature.group === group.key;
      });

      if (!features.length) {
        return;
      }

      const groupNode = document.createElement("div");
      groupNode.className = "feature-group";

      if (group.key !== "motion") {
        const title = document.createElement("div");
        title.className = "feature-group-title";
        title.textContent = group.label;
        groupNode.appendChild(title);
      }

      features.forEach(function (feature) {
        groupNode.appendChild(createFeatureRow(feature, rule));
      });

      featureList.appendChild(groupNode);
    });

    resetSiteButton.disabled = !hasSiteRule();
  }

  function createFeatureRow(feature, rule) {
    const row = document.createElement("label");
    row.className = "feature-row";

    const nameWrap = document.createElement("span");
    nameWrap.className = "feature-label";
    const name = document.createElement("span");
    const meta = document.createElement("span");

    name.className = "feature-name";
    name.textContent = feature.shortLabel;
    meta.className = "feature-meta";
    meta.textContent = getFeatureMeta(feature, rule);

    nameWrap.appendChild(name);
    nameWrap.appendChild(meta);

    const select = document.createElement("select");
    select.dataset.feature = feature.key;
    select.innerHTML = [
      "<option value=''>Use global</option>",
      "<option value='true'>Block here</option>",
      "<option value='false'>Allow here</option>"
    ].join("");
    select.value = formatTriState(rule.features[feature.key]);

    row.appendChild(nameWrap);
    row.appendChild(select);
    return row;
  }

  async function saveSiteRule(rule) {
    const response = await sendMessage({
      type: "motionblock:updateSiteRule",
      host,
      rule
    });
    applyResponse(response);
    showReloadHint(response && response.ok);

    if (currentTab && currentTab.id) {
      try {
        const result = chrome.tabs.sendMessage(currentTab.id, { type: "motionblock:applyNow" });
        if (result && typeof result.catch === "function") {
          result.catch(function () {});
        }
      } catch (error) {
        return;
      }
    }
  }

  function applyResponse(response) {
    if (!response || !response.ok) {
      siteLabel.textContent = response && response.error ? response.error : "Could not load settings";
      setControlsDisabled(true);
      return;
    }

    settings = MB.normalizeSettings(response.settings);
    MB.applyUiTheme(settings.uiTheme);
    host = response.host || host;
    effective = response.effective || MB.getEffectiveSettings(settings, host);
    setControlsDisabled(false);
    render();
  }

  function getCurrentRule() {
    if (!host || !settings.siteRules[host]) {
      return MB.createEmptySiteRule();
    }
    return MB.normalizeSiteRule(settings.siteRules[host]);
  }

  function parseTriState(value) {
    if (value === "true") {
      return true;
    }
    if (value === "false") {
      return false;
    }
    return null;
  }

  function formatTriState(value) {
    if (value === true) {
      return "true";
    }
    if (value === false) {
      return "false";
    }
    return "";
  }

  function setControlsDisabled(disabled) {
    siteEnabled.disabled = disabled;
    blockMotionHereButton.disabled = disabled;
    allowSiteButton.disabled = disabled;
    resetSiteButton.disabled = disabled || !hasSiteRule();
    reloadTabButton.disabled = disabled;
    featureList.querySelectorAll("select").forEach(function (select) {
      select.disabled = disabled;
    });

    reloadHint.hidden = true;
  }

  function showUnsupportedPage() {
    unsupportedPage = true;
    document.body.dataset.pageState = "unsupported";
    host = "";
    settings = MB.normalizeSettings(settings);
    MB.applyUiTheme(settings.uiTheme);

    siteLabel.textContent = "Not a website";
    statusBadge.textContent = "N/A";
    statusBadge.classList.add("off");
    effectiveSummary.textContent = "MotionBlock cannot configure browser, extension, or other protected pages.";
    siteEnabled.value = "";
    siteRuleNote.textContent = "";
    featureList.innerHTML = "";
    setControlsDisabled(true);
    openOptionsButton.disabled = false;
  }

  function sendMessage(message) {
    return chrome.runtime.sendMessage(message);
  }

  function showReloadHint(visible) {
    reloadHint.hidden = !visible;
  }

  function getEffectiveSummary() {
    if (unsupportedPage) {
      return "MotionBlock cannot configure browser, extension, or other protected pages.";
    }

    if (!effective.enabled) {
      return "This site is allowed. MotionBlock is not blocking media here.";
    }

    const active = MB.FEATURE_DEFINITIONS.filter(function (feature) {
      return Boolean(effective.features[feature.key]);
    }).map(function (feature) {
      return feature.shortLabel;
    });

    if (!active.length) {
      return "Active here, but no media categories are currently blocked.";
    }

    return "Blocking " + active.join(", ") + " on this site.";
  }

  function getSiteRuleNote(rule) {
    if (rule.enabled === false) {
      return "All MotionBlock rules are off for this site.";
    }

    if (rule.enabled === true) {
      return "This site uses its own MotionBlock settings.";
    }

    if (hasFeatureOverrides(rule)) {
      return "This site follows global status with media-specific overrides.";
    }

    return "This site follows your global defaults.";
  }

  function getFeatureMeta(feature, rule) {
    if (rule.enabled === false) {
      return "Inactive while site is allowed";
    }

    if (typeof rule.features[feature.key] === "boolean") {
      return rule.features[feature.key] ? "Override: blocking" : "Override: allowed";
    }

    return effective.features[feature.key] ? "Global: blocking" : "Global: allowed";
  }

  function hasSiteRule() {
    return Boolean(host && settings.siteRules[host] && !MB.isEmptySiteRule(settings.siteRules[host]));
  }

  function hasFeatureOverrides(rule) {
    return MB.FEATURE_KEYS.some(function (key) {
      return typeof rule.features[key] === "boolean";
    });
  }
})();
