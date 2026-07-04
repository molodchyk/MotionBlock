(function (root) {
  "use strict";

  function createPopupView(options) {
    const config = options.config;
    const document = options.document;
    const i18n = options.i18n;
    const elements = options.elements;

    function render(state) {
      delete document.body.dataset.pageState;
      elements.siteLabel.textContent = state.host || t("unknownSite", "Unknown site");
      elements.statusBadge.textContent = state.effective.enabled ? t("statusBlocking", "Blocking") : t("statusAllowed", "Allowed");
      elements.statusBadge.classList.toggle("off", !state.effective.enabled);
      elements.effectiveSummary.textContent = getEffectiveSummary(state);
      elements.siteEnabled.value = formatTriState(state.rule.enabled);
      elements.siteRuleNote.textContent = getSiteRuleNote(state.rule);

      elements.featureList.innerHTML = "";
      config.FEATURE_GROUPS.forEach(function (group) {
        const features = config.FEATURE_DEFINITIONS.filter(function (feature) {
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
          groupNode.appendChild(createFeatureRow(feature, state.rule, state.effective));
        });

        elements.featureList.appendChild(groupNode);
      });

      elements.resetSiteButton.disabled = !state.hasSiteRule;
      renderStats(state.tabStats);
      renderDiagnostics(state);
    }

    function renderUnsupported(tabStats) {
      document.body.dataset.pageState = "unsupported";
      elements.siteLabel.textContent = t("notAWebsite", "Not a website");
      elements.statusBadge.textContent = t("statusNotApplicable", "N/A");
      elements.statusBadge.classList.add("off");
      elements.effectiveSummary.textContent = t(
        "unsupportedPageSummary",
        "MotionBlock cannot configure browser, extension, or other protected pages."
      );
      elements.siteEnabled.value = "";
      elements.siteRuleNote.textContent = "";
      elements.featureList.innerHTML = "";
      renderStats(tabStats);
      renderDiagnostics({
        diagnostics: createEmptyDiagnostics(),
        settings: {},
        unsupportedPage: true
      });
      setControlsDisabled(true, false);
      elements.openOptionsButton.disabled = false;
    }

    function renderStats(tabStats) {
      const total = Math.max(0, Number(tabStats.total || 0));
      elements.statsTotal.textContent = t("statsBlockedCount", [String(total)], "$COUNT$ blocked");
      elements.statsTotal.classList.toggle("empty", total === 0);

      elements.featureList.querySelectorAll("[data-feature-count]").forEach(function (countNode) {
        const value = getVisibleFeatureCount(tabStats, countNode.dataset.featureCount);
        countNode.textContent = String(value);
        countNode.classList.toggle("empty", value === 0);
      });
    }

    function setControlsDisabled(disabled, hasSiteRule) {
      elements.siteEnabled.disabled = disabled;
      elements.blockMotionHereButton.disabled = disabled;
      elements.allowSiteButton.disabled = disabled;
      elements.resetSiteButton.disabled = disabled || !hasSiteRule;
      elements.reloadTabButton.disabled = disabled;
      elements.featureList.querySelectorAll("select").forEach(function (select) {
        select.disabled = disabled;
      });
      if (elements.copyDiagnosticsButton) {
        elements.copyDiagnosticsButton.disabled = disabled;
      }
      if (elements.refreshDiagnosticsButton) {
        elements.refreshDiagnosticsButton.disabled = disabled;
      }
      elements.reloadHint.hidden = true;
    }

    function setLoadError(message) {
      elements.siteLabel.textContent = message || t("couldNotLoadSettings", "Could not load settings");
      setControlsDisabled(true, false);
    }

    function showReloadHint(visible) {
      elements.reloadHint.hidden = !visible;
    }

    function renderDiagnostics(state) {
      const settings = state.settings || {};
      const diagnostics = normalizeDiagnostics(state.diagnostics);
      const visible = Boolean(settings.diagnosticsEnabled) && !state.unsupportedPage;

      elements.diagnosticsPanel.hidden = !visible;
      if (!visible) {
        elements.diagnosticsLog.value = "";
        elements.diagnosticsSummary.textContent = "";
        elements.diagnosticsStatus.textContent = "";
        return;
      }

      elements.diagnosticsLog.value = formatDiagnosticsLog(state);
      elements.diagnosticsSummary.textContent = diagnostics.entries.length
        ? t("diagnosticsSummaryWithEvents", [String(diagnostics.entries.length)], "$COUNT$ diagnostic events recorded.")
        : t("diagnosticsSummaryEmpty", "No diagnostics yet. Reload this tab, reproduce the issue, then refresh this panel.");
    }

    function showDiagnosticsStatus(message) {
      elements.diagnosticsStatus.textContent = message || "";
    }

    function createFeatureRow(feature, rule, effective) {
      const row = document.createElement("label");
      row.className = "feature-row";

      const nameWrap = document.createElement("span");
      nameWrap.className = "feature-label";
      const name = document.createElement("span");
      const meta = document.createElement("span");

      name.className = "feature-name";
      name.textContent = feature.shortLabel;
      meta.className = "feature-meta";
      meta.textContent = getFeatureMeta(feature, rule, effective);

      nameWrap.appendChild(name);
      nameWrap.appendChild(meta);

      const count = document.createElement("span");
      count.className = "feature-count";
      count.dataset.featureCount = feature.key;
      count.textContent = "0";

      const select = document.createElement("select");
      select.dataset.feature = feature.key;
      select.innerHTML = [
        "<option value=''>Use global</option>",
        "<option value='true'>Block here</option>",
        "<option value='false'>Allow here</option>"
      ].join("");
      select.options[0].textContent = t("selectUseGlobal", "Use global");
      select.options[1].textContent = t("selectBlockHere", "Block here");
      select.options[2].textContent = t("selectAllowHere", "Allow here");
      select.value = formatTriState(rule.features[feature.key]);

      row.appendChild(nameWrap);
      row.appendChild(count);
      row.appendChild(select);
      return row;
    }

    function getEffectiveSummary(state) {
      if (state.unsupportedPage) {
        return t("unsupportedPageSummary", "MotionBlock cannot configure browser, extension, or other protected pages.");
      }

      if (!state.effective.enabled) {
        return t("summaryAllowed", "This site is allowed. MotionBlock is not blocking media here.");
      }

      const active = config.FEATURE_DEFINITIONS.filter(function (feature) {
        return Boolean(state.effective.features[feature.key]);
      }).map(function (feature) {
        return feature.shortLabel;
      });

      if (!active.length) {
        return t("summaryActiveNoCategories", "Active here, but no media categories are currently blocked.");
      }

      return t("summaryBlockingFeatures", [formatList(active)], "Blocking $FEATURES$ on this site.");
    }

    function getSiteRuleNote(rule) {
      if (rule.enabled === false) {
        return t("siteRuleAllOff", "All MotionBlock rules are off for this site.");
      }
      if (rule.enabled === true) {
        return t("siteRuleOwnSettings", "This site uses its own MotionBlock settings.");
      }
      if (hasFeatureOverrides(rule, config.FEATURE_KEYS)) {
        return t("siteRuleOverrides", "This site follows global status with media-specific overrides.");
      }
      return t("siteRuleDefaults", "This site follows your global defaults.");
    }

    function getFeatureMeta(feature, rule, effective) {
      if (rule.enabled === false) {
        return t("featureMetaInactive", "Inactive while site is allowed");
      }
      if (typeof rule.features[feature.key] === "boolean") {
        return rule.features[feature.key]
          ? t("featureMetaOverrideBlocking", "Override: blocking")
          : t("featureMetaOverrideAllowed", "Override: allowed");
      }
      return effective.features[feature.key] ? t("featureMetaGlobalBlocking", "Global: blocking") : t("featureMetaGlobalAllowed", "Global: allowed");
    }

    function formatList(items) {
      try {
        return new Intl.ListFormat(i18n.getLanguageTag(), { style: "short", type: "conjunction" }).format(items);
      } catch (error) {
        return items.join(", ");
      }
    }

    function t(key, substitutions, fallback) {
      return i18n.t(key, substitutions, fallback);
    }

    return {
      render,
      renderDiagnostics,
      renderStats,
      renderUnsupported,
      setControlsDisabled,
      setLoadError,
      showDiagnosticsStatus,
      showReloadHint
    };
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

  function createEmptyTabStats(featureKeys) {
    const byFeature = {};
    featureKeys.forEach(function (key) {
      byFeature[key] = 0;
    });

    return {
      byFeature,
      total: 0
    };
  }

  function normalizeTabStats(stats, featureKeys) {
    const source = stats && typeof stats === "object" ? stats.byFeature || {} : {};
    const normalized = createEmptyTabStats(featureKeys);

    featureKeys.forEach(function (key) {
      const value = Number(source[key] || 0);
      normalized.byFeature[key] = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
    });

    normalized.total = featureKeys.reduce(function (sum, key) {
      return sum + normalized.byFeature[key];
    }, 0);
    return normalized;
  }

  function createEmptyDiagnostics() {
    return {
      capturedAt: "",
      entries: [],
      entryCount: 0,
      frames: [],
      tabId: 0
    };
  }

  function normalizeDiagnostics(diagnostics) {
    const source = diagnostics && typeof diagnostics === "object" ? diagnostics : {};
    const entries = Array.isArray(source.entries) ? source.entries : [];
    const frames = Array.isArray(source.frames) ? source.frames : [];

    return {
      capturedAt: typeof source.capturedAt === "string" ? source.capturedAt : "",
      entries,
      entryCount: Math.max(0, Number(source.entryCount || entries.length)),
      frames,
      tabId: Number(source.tabId || 0)
    };
  }

  function formatDiagnosticsLog(state) {
    const diagnostics = normalizeDiagnostics(state.diagnostics);
    const effective = state.effective || {};
    const tabStats = normalizeTabStats(state.tabStats, Object.keys((effective && effective.features) || {}));

    return JSON.stringify(
      {
        app: "MotionBlock",
        generatedAt: new Date().toISOString(),
        page: {
          host: state.host || "",
          status: effective.enabled ? "blocking" : "allowed"
        },
        effectiveSettings: {
          diagnosticsEnabled: Boolean(effective.diagnosticsEnabled),
          enabled: Boolean(effective.enabled),
          features: effective.features || {},
          replacementMode: effective.replacementMode || "",
          showRevealControls: Boolean(effective.showRevealControls)
        },
        tabStats,
        analysis: root.MotionBlockDiagnosticsAnalysis.buildDiagnosticsAnalysis(diagnostics, effective, tabStats),
        diagnostics
      },
      null,
      2
    );
  }

  function hasFeatureOverrides(rule, featureKeys) {
    return featureKeys.some(function (key) {
      return typeof rule.features[key] === "boolean";
    });
  }

  function getVisibleFeatureCount(tabStats, featureKey) {
    if (!tabStats || !tabStats.byFeature) {
      return 0;
    }

    return Math.max(0, Number(tabStats.byFeature[featureKey] || 0));
  }

  root.MotionBlockPopupView = {
    createEmptyDiagnostics,
    createEmptyTabStats,
    formatDiagnosticsLog,
    createPopupView,
    formatTriState,
    normalizeDiagnostics,
    normalizeTabStats,
    parseTriState
  };
})(globalThis);
