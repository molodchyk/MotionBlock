(function (root) {
  "use strict";

  const STORAGE_KEY = "motionBlockSettings";
  const UI_THEME_MODES = ["system", "light", "dark"];
  const CONFIGURABLE_PROTOCOLS = ["http:", "https:"];

  function t(key, fallback) {
    return root.MotionBlockI18n && typeof root.MotionBlockI18n.t === "function"
      ? root.MotionBlockI18n.t(key, undefined, fallback)
      : fallback;
  }

  const FEATURE_DEFINITIONS = [
    {
      key: "gifs",
      group: "motion",
      label: t("featureGifsLabel", "GIF images"),
      shortLabel: t("featureGifsShortLabel", "GIFs"),
      description: t("featureGifsDescription", "Replace GIF image elements in the page while leaving tiny interface GIFs alone.")
    },
    {
      key: "gifv",
      group: "motion",
      label: t("featureGifvLabel", "GIFV and GIF-like video URLs"),
      shortLabel: t("featureGifvShortLabel", "GIFV"),
      description: t("featureGifvDescription", "Block .gifv URLs and video elements that behave like looping GIFs.")
    },
    {
      key: "animatedWebp",
      group: "broad",
      label: t("featureAnimatedWebpLabel", "WebP URL patterns"),
      shortLabel: t("featureAnimatedWebpShortLabel", "WebP"),
      description: t("featureAnimatedWebpDescription", "Block .webp image URLs. Off by default because many WebP images are not animated.")
    },
    {
      key: "autoplayVideo",
      group: "motion",
      label: t("featureAutoplayVideoLabel", "Autoplay and looping video"),
      shortLabel: t("featureAutoplayVideoShortLabel", "Autoplay"),
      description: t("featureAutoplayVideoDescription", "Pause autoplay video and remove muted looping video used as animation.")
    },
    {
      key: "video",
      group: "broad",
      label: t("featureVideoLabel", "All video"),
      shortLabel: t("featureVideoShortLabel", "Video"),
      description: t("featureVideoDescription", "Block HTML5 video and common video file requests.")
    },
    {
      key: "audio",
      group: "broad",
      label: t("featureAudioLabel", "Audio"),
      shortLabel: t("featureAudioShortLabel", "Audio"),
      description: t("featureAudioDescription", "Block audio elements and common audio file requests.")
    },
    {
      key: "images",
      group: "broad",
      label: t("featureImagesLabel", "All images"),
      shortLabel: t("featureImagesShortLabel", "Images"),
      description: t("featureImagesDescription", "Replace image elements in the page. Use per-site allow rules for image-heavy sites.")
    },
    {
      key: "emoji",
      group: "broad",
      label: t("featureEmojiLabel", "Emoji text and emoji images"),
      shortLabel: t("featureEmojiShortLabel", "Emoji"),
      description: t("featureEmojiDescription", "Remove emoji characters and common emoji image renderers. Off by default because it changes text.")
    },
    {
      key: "cssMotion",
      group: "motion",
      label: t("featureCssMotionLabel", "CSS animation and transitions"),
      shortLabel: t("featureCssMotionShortLabel", "CSS"),
      description: t("featureCssMotionDescription", "Disable CSS animations, transitions, and smooth scrolling.")
    }
  ];

  const FEATURE_GROUPS = [
    {
      key: "motion",
      label: t("featureGroupMotionLabel", "Motion blocking"),
      description: t("featureGroupMotionDescription", "Recommended defaults for GIFs, GIF-like videos, autoplay, and page motion.")
    },
    {
      key: "broad",
      label: t("featureGroupBroadLabel", "Broad media blockers"),
      description: t("featureGroupBroadDescription", "Power-user controls for images, video, audio, WebP URLs, and emoji. These can change or break some sites.")
    }
  ];

  const FEATURE_KEYS = FEATURE_DEFINITIONS.map(function (feature) {
    return feature.key;
  });

  const DEFAULT_FEATURES = {
    gifs: true,
    gifv: true,
    animatedWebp: false,
    autoplayVideo: true,
    video: false,
    audio: false,
    images: false,
    emoji: false,
    cssMotion: false
  };

  const DEFAULT_SETTINGS = {
    enabled: true,
    diagnosticsEnabled: false,
    uiTheme: "system",
    showRevealControls: false,
    replacementMode: "placeholder",
    features: DEFAULT_FEATURES,
    siteRules: {}
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function normalizeHostname(value) {
    if (!value || typeof value !== "string") {
      return "";
    }

    let candidate = value.trim().toLowerCase();
    if (!candidate) {
      return "";
    }

    try {
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) {
        candidate = new URL(candidate).hostname;
      }
    } catch (error) {
      return "";
    }

    return candidate
      .replace(/^www\./, "")
      .replace(/:\d+$/, "")
      .replace(/^\.+|\.+$/g, "");
  }

  function getHostFromUrl(url) {
    try {
      return normalizeHostname(new URL(url).hostname);
    } catch (error) {
      return "";
    }
  }

  function getConfigurableHostFromUrl(url) {
    try {
      const parsed = new URL(url);
      if (CONFIGURABLE_PROTOCOLS.indexOf(parsed.protocol) === -1) {
        return "";
      }

      return normalizeHostname(parsed.hostname);
    } catch (error) {
      return "";
    }
  }

  function isConfigurableUrl(url) {
    return Boolean(getConfigurableHostFromUrl(url));
  }

  function normalizeFeatures(value, fallback) {
    const normalized = {};
    const source = isPlainObject(value) ? value : {};
    const fallbackFeatures = isPlainObject(fallback) ? fallback : DEFAULT_FEATURES;

    FEATURE_KEYS.forEach(function (key) {
      normalized[key] = typeof source[key] === "boolean" ? source[key] : Boolean(fallbackFeatures[key]);
    });

    return normalized;
  }

  function normalizeFeatureOverrides(value) {
    const normalized = {};
    const source = isPlainObject(value) ? value : {};

    FEATURE_KEYS.forEach(function (key) {
      normalized[key] = typeof source[key] === "boolean" ? source[key] : null;
    });

    return normalized;
  }

  function createEmptySiteRule() {
    return {
      enabled: null,
      replacementMode: "",
      features: normalizeFeatureOverrides({})
    };
  }

  function normalizeSiteRule(rule) {
    const source = isPlainObject(rule) ? rule : {};
    const normalized = createEmptySiteRule();

    if (typeof source.enabled === "boolean") {
      normalized.enabled = source.enabled;
    }

    if (source.replacementMode === "hide" || source.replacementMode === "placeholder") {
      normalized.replacementMode = source.replacementMode;
    }

    normalized.features = normalizeFeatureOverrides(source.features);

    return normalized;
  }

  function isEmptySiteRule(rule) {
    const normalized = normalizeSiteRule(rule);
    const hasFeatureOverride = FEATURE_KEYS.some(function (key) {
      return typeof normalized.features[key] === "boolean";
    });

    return normalized.enabled === null && !normalized.replacementMode && !hasFeatureOverride;
  }

  function normalizeSiteRules(value) {
    const source = isPlainObject(value) ? value : {};
    const normalized = {};

    Object.keys(source).forEach(function (host) {
      const normalizedHost = normalizeHostname(host);
      const rule = normalizeSiteRule(source[host]);

      if (normalizedHost && !isEmptySiteRule(rule)) {
        normalized[normalizedHost] = rule;
      }
    });

    return normalized;
  }

  function normalizeSettings(settings) {
    const source = isPlainObject(settings) ? settings : {};
    const replacementMode = source.replacementMode === "hide" ? "hide" : "placeholder";
    const uiTheme = UI_THEME_MODES.indexOf(source.uiTheme) === -1 ? DEFAULT_SETTINGS.uiTheme : source.uiTheme;

    return {
      enabled: typeof source.enabled === "boolean" ? source.enabled : DEFAULT_SETTINGS.enabled,
      diagnosticsEnabled:
        typeof source.diagnosticsEnabled === "boolean" ? source.diagnosticsEnabled : DEFAULT_SETTINGS.diagnosticsEnabled,
      uiTheme,
      showRevealControls:
        typeof source.showRevealControls === "boolean" ? source.showRevealControls : DEFAULT_SETTINGS.showRevealControls,
      replacementMode,
      features: normalizeFeatures(source.features, DEFAULT_FEATURES),
      siteRules: normalizeSiteRules(source.siteRules)
    };
  }

  function hasRecognizedSettingsShape(value) {
    if (!isPlainObject(value)) {
      return false;
    }

    return ["enabled", "diagnosticsEnabled", "uiTheme", "showRevealControls", "replacementMode", "features", "siteRules"].some(
      function (key) {
        return Object.prototype.hasOwnProperty.call(value, key);
      }
    );
  }

  function normalizeSettingsBackupPayload(payload) {
    const source = isPlainObject(payload) && isPlainObject(payload.settings) ? payload.settings : payload;

    if (!hasRecognizedSettingsShape(source)) {
      throw new Error(t("errorInvalidSettingsBackup", "This does not look like a MotionBlock settings backup."));
    }

    return normalizeSettings(source);
  }

  function createSettingsBackup(settings) {
    return {
      app: "MotionBlock",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      settings: normalizeSettings(settings)
    };
  }

  function getEffectiveSettings(settings, hostname) {
    const normalized = normalizeSettings(settings);
    const host = normalizeHostname(hostname);
    const rule = host ? normalized.siteRules[host] : null;
    const features = normalizeFeatures(normalized.features, DEFAULT_FEATURES);

    if (rule && rule.enabled !== false) {
      FEATURE_KEYS.forEach(function (key) {
        if (typeof rule.features[key] === "boolean") {
          features[key] = rule.features[key];
        }
      });
    }

    return {
      enabled: normalized.enabled && !(rule && rule.enabled === false),
      diagnosticsEnabled: normalized.diagnosticsEnabled,
      showRevealControls: normalized.showRevealControls,
      replacementMode: rule && rule.replacementMode ? rule.replacementMode : normalized.replacementMode,
      features,
      host,
      siteRule: rule || createEmptySiteRule()
    };
  }

  function getFeatureDefinition(key) {
    return FEATURE_DEFINITIONS.find(function (feature) {
      return feature.key === key;
    });
  }

  function applyUiTheme(mode) {
    if (!root.document || !root.matchMedia) {
      return;
    }

    const normalizedMode = UI_THEME_MODES.indexOf(mode) === -1 ? DEFAULT_SETTINGS.uiTheme : mode;
    const resolvedMode =
      normalizedMode === "system" && root.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : normalizedMode === "dark" ? "dark" : "light";

    root.document.documentElement.dataset.theme = resolvedMode;
    root.document.documentElement.dataset.themePreference = normalizedMode;
  }

  root.MotionBlock = {
    STORAGE_KEY,
    FEATURE_DEFINITIONS,
    FEATURE_GROUPS,
    FEATURE_KEYS,
    UI_THEME_MODES,
    DEFAULT_FEATURES: clone(DEFAULT_FEATURES),
    DEFAULT_SETTINGS: clone(DEFAULT_SETTINGS),
    applyUiTheme,
    createEmptySiteRule,
    createSettingsBackup,
    getConfigurableHostFromUrl,
    getEffectiveSettings,
    getFeatureDefinition,
    getHostFromUrl,
    hasRecognizedSettingsShape,
    isEmptySiteRule,
    isConfigurableUrl,
    normalizeFeatures,
    normalizeFeatureOverrides,
    normalizeHostname,
    normalizeSettingsBackupPayload,
    normalizeSettings,
    normalizeSiteRule
  };
})(globalThis);
