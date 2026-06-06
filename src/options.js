(function () {
  "use strict";

  const MB = window.MotionBlock;
  const globalEnabled = document.getElementById("globalEnabled");
  const globalFeatures = document.getElementById("globalFeatures");
  const replacementMode = document.getElementById("replacementMode");
  const uiTheme = document.getElementById("uiTheme");
  const showRevealControls = document.getElementById("showRevealControls");
  const addSiteForm = document.getElementById("addSiteForm");
  const newSiteHost = document.getElementById("newSiteHost");
  const siteTableHead = document.getElementById("siteTableHead");
  const siteTableBody = document.getElementById("siteTableBody");
  const exportSettings = document.getElementById("exportSettings");
  const importSettings = document.getElementById("importSettings");
  const applyPastedSettings = document.getElementById("applyPastedSettings");
  const importSettingsFile = document.getElementById("importSettingsFile");
  const refreshSettings = document.getElementById("refreshSettings");
  const settingsJson = document.getElementById("settingsJson");
  const statusLine = document.getElementById("statusLine");

  let settings = MB.DEFAULT_SETTINGS;

  document.addEventListener("DOMContentLoaded", init);

  globalEnabled.addEventListener("change", function () {
    settings.enabled = globalEnabled.checked;
    saveAllSettings("Global status saved.");
  });

  globalFeatures.addEventListener("change", function (event) {
    const input = event.target.closest("input[data-feature]");
    if (!input) {
      return;
    }

    settings.features[input.dataset.feature] = input.checked;
    saveAllSettings("Global defaults saved.");
  });

  replacementMode.addEventListener("change", function () {
    settings.replacementMode = replacementMode.value;
    saveAllSettings("Display mode saved.");
  });

  uiTheme.addEventListener("change", function () {
    settings.uiTheme = uiTheme.value;
    MB.applyUiTheme(settings.uiTheme);
    saveAllSettings("Theme saved.");
  });

  showRevealControls.addEventListener("change", function () {
    settings.showRevealControls = showRevealControls.checked;
    saveAllSettings("Reveal button setting saved.");
  });

  addSiteForm.addEventListener("submit", function (event) {
    event.preventDefault();
    const host = MB.normalizeHostname(newSiteHost.value);

    if (!host) {
      showStatus("Enter a valid hostname.");
      return;
    }

    if (!settings.siteRules[host]) {
      settings.siteRules[host] = MB.createEmptySiteRule();
    }

    newSiteHost.value = "";
    saveAllSettings("Site added.");
  });

  siteTableBody.addEventListener("change", function (event) {
    const select = event.target.closest("select[data-site]");
    if (!select) {
      return;
    }

    const host = select.dataset.site;
    const rule = MB.normalizeSiteRule(settings.siteRules[host]);

    if (select.dataset.kind === "enabled") {
      rule.enabled = parseTriState(select.value);
    } else if (select.dataset.feature) {
      rule.features[select.dataset.feature] = parseTriState(select.value);
    }

    settings.siteRules[host] = rule;
    saveAllSettings("Site rule saved.");
  });

  siteTableBody.addEventListener("click", function (event) {
    const button = event.target.closest("button[data-remove-site]");
    if (!button) {
      return;
    }

    delete settings.siteRules[button.dataset.removeSite];
    saveAllSettings("Site removed.");
  });

  exportSettings.addEventListener("click", function () {
    const json = JSON.stringify(createBackupPayload(), null, 2);
    settingsJson.value = json;
    downloadJson(json, createBackupFilename());
    showStatus("Settings exported to a JSON file.");
  });

  importSettings.addEventListener("click", function () {
    importSettingsFile.value = "";
    importSettingsFile.click();
  });

  importSettingsFile.addEventListener("change", async function () {
    const file = importSettingsFile.files && importSettingsFile.files[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      settingsJson.value = text;
      await importSettingsFromText(text, "Settings imported from file.");
    } catch (error) {
      showStatus("Import failed: " + getErrorMessage(error));
    }
  });

  applyPastedSettings.addEventListener("click", async function () {
    await importSettingsFromText(settingsJson.value, "Settings imported from pasted JSON.");
  });

  refreshSettings.addEventListener("click", async function () {
    await loadSettings("Settings refreshed from Chrome sync.");
  });

  async function init() {
    await loadSettings("");
  }

  async function loadSettings(message) {
    const response = await sendMessage({ type: "motionblock:getSettings" });
    if (!response || !response.ok) {
      showStatus(response && response.error ? response.error : "Could not load settings.");
      return false;
    }

    settings = MB.normalizeSettings(response.settings);
    MB.applyUiTheme(settings.uiTheme);
    render();

    if (message) {
      showStatus(message);
    }

    return true;
  }

  function render() {
    globalEnabled.checked = settings.enabled;
    replacementMode.value = settings.replacementMode;
    uiTheme.value = settings.uiTheme;
    showRevealControls.checked = settings.showRevealControls;
    MB.applyUiTheme(settings.uiTheme);
    renderGlobalFeatures();
    renderSiteTable();
  }

  function renderGlobalFeatures() {
    globalFeatures.innerHTML = "";

    MB.FEATURE_DEFINITIONS.forEach(function (feature) {
      const label = document.createElement("label");
      label.className = "feature-toggle";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.dataset.feature = feature.key;
      input.checked = Boolean(settings.features[feature.key]);

      const text = document.createElement("span");
      const title = document.createElement("strong");
      const description = document.createElement("span");

      title.textContent = feature.label;
      description.textContent = feature.description;
      text.appendChild(title);
      text.appendChild(description);

      label.appendChild(input);
      label.appendChild(text);
      globalFeatures.appendChild(label);
    });
  }

  function renderSiteTable() {
    renderSiteTableHead();
    siteTableBody.innerHTML = "";

    const hosts = Object.keys(settings.siteRules).sort();
    if (!hosts.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = MB.FEATURE_KEYS.length + 3;
      cell.textContent = "No website preferences yet.";
      row.appendChild(cell);
      siteTableBody.appendChild(row);
      return;
    }

    hosts.forEach(function (host) {
      const rule = MB.normalizeSiteRule(settings.siteRules[host]);
      const row = document.createElement("tr");

      const hostCell = document.createElement("td");
      hostCell.className = "site-host";
      hostCell.textContent = host;
      row.appendChild(hostCell);

      const enabledCell = document.createElement("td");
      enabledCell.appendChild(createTriStateSelect(host, "enabled", "", rule.enabled));
      row.appendChild(enabledCell);

      MB.FEATURE_DEFINITIONS.forEach(function (feature) {
        const cell = document.createElement("td");
        cell.appendChild(createTriStateSelect(host, "feature", feature.key, rule.features[feature.key]));
        row.appendChild(cell);
      });

      const removeCell = document.createElement("td");
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.dataset.removeSite = host;
      removeButton.textContent = "Remove";
      removeCell.appendChild(removeButton);
      row.appendChild(removeCell);

      siteTableBody.appendChild(row);
    });
  }

  function renderSiteTableHead() {
    siteTableHead.innerHTML = "";
    ["Site", "Active"].forEach(function (label) {
      const th = document.createElement("th");
      th.textContent = label;
      siteTableHead.appendChild(th);
    });

    MB.FEATURE_DEFINITIONS.forEach(function (feature) {
      const th = document.createElement("th");
      th.textContent = feature.shortLabel;
      siteTableHead.appendChild(th);
    });

    const action = document.createElement("th");
    action.textContent = "";
    siteTableHead.appendChild(action);
  }

  function createTriStateSelect(host, kind, featureKey, value) {
    const select = document.createElement("select");
    select.dataset.site = host;
    select.dataset.kind = kind;

    if (featureKey) {
      select.dataset.feature = featureKey;
    }

    select.innerHTML = [
      "<option value=''>Inherit</option>",
      "<option value='true'>Block</option>",
      "<option value='false'>Allow</option>"
    ].join("");
    select.value = formatTriState(value);

    if (kind === "enabled") {
      select.options[1].textContent = "On";
      select.options[2].textContent = "Off";
    }

    return select;
  }

  async function saveAllSettings(message) {
    settings = MB.normalizeSettings(settings);
    const response = await sendMessage({
      type: "motionblock:saveSettings",
      settings
    });

    if (!response || !response.ok) {
      showStatus(response && response.error ? response.error : "Save failed.");
      return;
    }

    settings = MB.normalizeSettings(response.settings);
    render();
    showStatus(message);
  }

  async function importSettingsFromText(text, message) {
    try {
      settings = parseImportedSettings(text);
      await saveAllSettings(message);
    } catch (error) {
      showStatus("Import failed: " + getErrorMessage(error));
    }
  }

  function parseImportedSettings(text) {
    if (!text || !text.trim()) {
      throw new Error("choose a JSON file or paste a backup first.");
    }

    const parsed = JSON.parse(text);
    const candidate = parsed && typeof parsed === "object" && parsed.settings ? parsed.settings : parsed;

    if (!hasRecognizedSettingsShape(candidate)) {
      throw new Error("this does not look like a MotionBlock settings backup.");
    }

    return MB.normalizeSettings(candidate);
  }

  function hasRecognizedSettingsShape(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }

    return ["enabled", "uiTheme", "showRevealControls", "replacementMode", "features", "siteRules"].some(function (key) {
      return Object.prototype.hasOwnProperty.call(value, key);
    });
  }

  function createBackupPayload() {
    return {
      app: "MotionBlock",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      settings: MB.normalizeSettings(settings)
    };
  }

  function createBackupFilename() {
    const date = new Date().toISOString().slice(0, 10);
    return "motionblock-settings-" + date + ".json";
  }

  function downloadJson(json, filename) {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 0);
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

  function showStatus(message) {
    statusLine.textContent = message;
  }

  function getErrorMessage(error) {
    if (error && error.name === "SyntaxError") {
      return "invalid JSON.";
    }

    return error && error.message ? error.message : "invalid JSON.";
  }

  function sendMessage(message) {
    return chrome.runtime.sendMessage(message);
  }
})();
