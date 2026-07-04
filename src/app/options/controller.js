(function (root) {
  "use strict";

  function start() {
      const MB = window.MotionBlock;
      const I18N = window.MotionBlockI18n;
      const globalEnabled = document.getElementById("globalEnabled");
      const globalFeatures = document.getElementById("globalFeatures");
      const replacementMode = document.getElementById("replacementMode");
      const uiTheme = document.getElementById("uiTheme");
      const showRevealControls = document.getElementById("showRevealControls");
      const diagnosticsEnabled = document.getElementById("diagnosticsEnabled");
      const restoreRecommended = document.getElementById("restoreRecommended");
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

      I18N.localizeDocument(document);

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
      } else {
        init();
      }

      globalEnabled.addEventListener("change", function () {
        settings.enabled = globalEnabled.checked;
        saveAllSettings(t("globalStatusSaved", "Global status saved."));
      });

      globalFeatures.addEventListener("change", function (event) {
        const input = event.target.closest("input[data-feature]");
        if (!input) {
          return;
        }

        settings.features[input.dataset.feature] = input.checked;
        saveAllSettings(t("globalDefaultsSaved", "Global defaults saved."));
      });

      replacementMode.addEventListener("change", function () {
        settings.replacementMode = replacementMode.value;
        saveAllSettings(t("displayModeSaved", "Display mode saved."));
      });

      uiTheme.addEventListener("change", function () {
        settings.uiTheme = uiTheme.value;
        MB.applyUiTheme(settings.uiTheme);
        saveAllSettings(t("themeSaved", "Theme saved."));
      });

      showRevealControls.addEventListener("change", function () { settings.showRevealControls = showRevealControls.checked; saveAllSettings(t("revealSettingSaved", "Reveal button setting saved.")); });
      diagnosticsEnabled.addEventListener("change", function () { settings.diagnosticsEnabled = diagnosticsEnabled.checked; saveAllSettings(t("diagnosticsSettingSaved", "Diagnostics setting saved.")); });

      restoreRecommended.addEventListener("click", function () {
        settings.enabled = true;
        settings.diagnosticsEnabled = false;
        settings.replacementMode = "placeholder";
        settings.showRevealControls = false;
        settings.features = MB.normalizeFeatures({}, MB.DEFAULT_FEATURES);
        saveAllSettings(t("recommendedDefaultsRestored", "Recommended defaults restored."));
      });

      addSiteForm.addEventListener("submit", function (event) {
        event.preventDefault();
        const host = MB.normalizeHostname(newSiteHost.value);

        if (!host) {
          showStatus(t("enterValidHostname", "Enter a valid hostname."));
          return;
        }

        if (!settings.siteRules[host]) {
          settings.siteRules[host] = MB.createEmptySiteRule();
        }

        newSiteHost.value = "";
        saveAllSettings(t("siteAdded", "Site added."));
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
        saveAllSettings(t("siteRuleSaved", "Site rule saved."));
      });

      siteTableBody.addEventListener("click", function (event) {
        const button = event.target.closest("button[data-remove-site]");
        if (!button) {
          return;
        }

        delete settings.siteRules[button.dataset.removeSite];
        saveAllSettings(t("siteRemoved", "Site removed."));
      });

      exportSettings.addEventListener("click", function () {
        const json = JSON.stringify(MB.createSettingsBackup(settings), null, 2);
        settingsJson.value = json;
        downloadJson(json, createBackupFilename());
        showStatus(t("settingsExported", "Settings exported to a JSON file."));
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
          await importSettingsFromText(text, t("settingsImportedFromFile", "Settings imported from file."));
        } catch (error) {
          showStatus(t("importFailed", [getErrorMessage(error)], "Import failed: $ERROR$"));
        }
      });

      applyPastedSettings.addEventListener("click", async function () {
        await importSettingsFromText(settingsJson.value, t("settingsImportedFromPastedJson", "Settings imported from pasted JSON."));
      });

      refreshSettings.addEventListener("click", async function () {
        await loadSettings(t("settingsRefreshed", "Settings refreshed from Chrome sync."));
      });

      async function init() {
        await loadSettings("");
      }

      async function loadSettings(message) {
        const response = await sendMessage({ type: "motionblock:getSettings" });
        if (!response || !response.ok) {
          showStatus(response && response.error ? response.error : t("couldNotLoadSettingsPeriod", "Could not load settings."));
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
        showRevealControls.checked = settings.showRevealControls; diagnosticsEnabled.checked = settings.diagnosticsEnabled;
        MB.applyUiTheme(settings.uiTheme);
        renderGlobalFeatures();
        renderSiteTable();
      }

      function renderGlobalFeatures() {
        globalFeatures.innerHTML = "";

        MB.FEATURE_GROUPS.forEach(function (group) {
          const features = MB.FEATURE_DEFINITIONS.filter(function (feature) {
            return feature.group === group.key;
          });

          if (!features.length) {
            return;
          }

          const section = document.createElement("section");
          section.className = "feature-group-card";

          const heading = document.createElement("div");
          heading.className = "feature-group-heading";

          const title = document.createElement("h3");
          const description = document.createElement("p");

          title.textContent = group.label;
          description.textContent = group.description;
          heading.appendChild(title);
          heading.appendChild(description);
          section.appendChild(heading);

          const grid = document.createElement("div");
          grid.className = "feature-card-grid";

          features.forEach(function (feature) {
            grid.appendChild(createGlobalFeatureToggle(feature));
          });

          section.appendChild(grid);
          globalFeatures.appendChild(section);
        });
      }

      function createGlobalFeatureToggle(feature) {
        const label = document.createElement("label");
        label.className = "feature-toggle";

        const input = document.createElement("input");
        input.type = "checkbox";
        input.dataset.feature = feature.key;
        input.checked = Boolean(settings.features[feature.key]);

        const text = document.createElement("span");
        const titleRow = document.createElement("span");
        const title = document.createElement("strong");
        const state = document.createElement("span");
        const description = document.createElement("span");

        titleRow.className = "feature-title-row";
        state.className = "feature-state";
        state.textContent = settings.features[feature.key] ? t("defaultOn", "Default on") : t("defaultOff", "Default off");

        title.textContent = feature.label;
        description.textContent = feature.description;
        titleRow.appendChild(title);
        titleRow.appendChild(state);
        text.appendChild(titleRow);
        text.appendChild(description);

        label.appendChild(input);
        label.appendChild(text);
        return label;
      }

      function renderSiteTable() {
        renderSiteTableHead();
        siteTableBody.innerHTML = "";

        const hosts = Object.keys(settings.siteRules).sort();
        if (!hosts.length) {
          const row = document.createElement("tr");
          const cell = document.createElement("td");
          cell.colSpan = MB.FEATURE_KEYS.length + 3;
          cell.textContent = t("noWebsitePreferences", "No website preferences yet.");
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
          removeButton.textContent = t("removeSite", "Remove");
          removeCell.appendChild(removeButton);
          row.appendChild(removeCell);

          siteTableBody.appendChild(row);
        });
      }

      function renderSiteTableHead() {
        siteTableHead.innerHTML = "";
        [t("siteTableSite", "Site"), t("siteTableActive", "Active")].forEach(function (label) {
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
        select.options[0].textContent = t("selectInherit", "Inherit");
        select.options[1].textContent = t("selectBlock", "Block");
        select.options[2].textContent = t("selectAllow", "Allow");
        select.value = formatTriState(value);

        if (kind === "enabled") {
          select.options[1].textContent = t("selectOn", "On");
          select.options[2].textContent = t("selectOff", "Off");
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
          showStatus(response && response.error ? response.error : t("saveFailed", "Save failed."));
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
          showStatus(t("importFailed", [getErrorMessage(error)], "Import failed: $ERROR$"));
        }
      }

      function parseImportedSettings(text) {
        if (!text || !text.trim()) {
          throw new Error(t("chooseJsonFileError", "choose a JSON file or paste a backup first."));
        }

        const parsed = JSON.parse(text);
        return MB.normalizeSettingsBackupPayload(parsed);
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
          return t("invalidJson", "invalid JSON.");
        }

        return error && error.message ? error.message : t("invalidJson", "invalid JSON.");
      }

      function sendMessage(message) {
        return chrome.runtime.sendMessage(message);
      }

      function t(key, substitutions, fallback) {
        return I18N.t(key, substitutions, fallback);
      }
  }

  root.MotionBlockOptionsController = {
    start
  };
})(globalThis);
