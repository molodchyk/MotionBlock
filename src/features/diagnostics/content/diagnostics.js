(function (root) {
  "use strict";

  const DEFAULT_MAX_ENTRIES = 180;
  const DEFAULT_UPDATE_DEBOUNCE_MS = 250;
  const DEFAULT_THROTTLE_MS = 1500;
  const MAX_STRING_LENGTH = 220;
  const MAX_ARRAY_LENGTH = 20;
  const MAX_OBJECT_KEYS = 32;
  const sanitizeUrlForDiagnostics = root.MotionBlockDiagnosticsUrl.sanitizeUrlForDiagnostics;
  const summarizeUrlForDiagnostics = root.MotionBlockDiagnosticsUrl.summarizeUrlForDiagnostics;

  function createContentDiagnostics(options) {
    const chromeApi = options.chrome;
    const document = options.document;
    const frameHost = options.frameHost || "";
    const location = options.location;
    const maxEntries = Number(options.maxEntries || DEFAULT_MAX_ENTRIES);
    const now = typeof options.now === "function" ? options.now : Date.now;
    const settingsHost = options.settingsHost || "";
    const updateDebounceMs = Number(options.updateDebounceMs || DEFAULT_UPDATE_DEBOUNCE_MS);
    const window = options.window;

    let enabled = false;
    let entries = [];
    let lastSignature = "";
    let sequence = 0;
    let updateTimer = 0;
    const throttleState = new Map();

    function setEnabled(value, details) {
      const nextEnabled = Boolean(value);
      if (enabled === nextEnabled) {
        return Promise.resolve(false);
      }

      enabled = nextEnabled;

      if (!enabled) {
        entries = [];
        return sendUpdate({ force: true, immediate: true });
      }

      return record("diagnostics.enabled", details || {}, { force: true, immediate: true });
    }

    function recordSettingsApplied(effectiveSettings) {
      const settings = effectiveSettings || {};
      return record(
        "settings.applied",
        {
          diagnosticsEnabled: Boolean(settings.diagnosticsEnabled),
          enabled: Boolean(settings.enabled),
          features: settings.features || {},
          frameHost,
          pageUrl: sanitizeUrlForDiagnostics(location && location.href),
          readyState: document.readyState,
          replacementMode: settings.replacementMode || "",
          settingsHost,
          showRevealControls: Boolean(settings.showRevealControls),
          siteRule: summarizeSiteRule(settings.siteRule)
        },
        { force: true, immediate: true }
      );
    }

    function recordMediaScan(root, details) {
      return recordThrottled("scan.media", summarizeRoot(root), details, DEFAULT_THROTTLE_MS);
    }

    function recordCustomHostScan(root, details) {
      return recordThrottled("scan.customMediaHosts", summarizeRoot(root), details, DEFAULT_THROTTLE_MS);
    }

    function recordMediaDecision(element, reason, action, collectUrls) {
      return recordThrottled(
        "media.decision",
        getElementDiagnosticKey(element, action),
        Object.assign(
          {
            action,
            reason: summarizeReason(reason)
          },
          summarizeMediaElement(element, collectUrls)
        ),
        DEFAULT_THROTTLE_MS
      );
    }

    function recordMediaEffect(event, element, details, collectUrls) {
      return recordThrottled(
        event,
        getElementDiagnosticKey(element, event),
        Object.assign(summarizeMediaElement(element, collectUrls), details || {}),
        DEFAULT_THROTTLE_MS
      );
    }

    function recordPageAudioEvent(kind, details) {
      const event = "pageAudio." + String(kind || "event").replace(/[^a-z0-9_.-]/gi, "").slice(0, 70);
      const key = JSON.stringify({
        event,
        details: sanitizeValue(details || {}, 0)
      });
      return recordThrottled(event, key, details || {}, 500);
    }

    function recordThrottled(event, key, details, throttleMs) {
      if (!enabled) {
        return Promise.resolve(false);
      }

      const sanitizedDetails = sanitizeValue(details, 0);
      const signature = event + ":" + JSON.stringify(sanitizedDetails);
      const timestamp = Number(now());
      const previous = throttleState.get(event + ":" + key);

      if (previous && previous.signature === signature && timestamp - previous.timestamp < throttleMs) {
        return Promise.resolve(false);
      }

      throttleState.set(event + ":" + key, {
        signature,
        timestamp
      });
      return record(event, sanitizedDetails);
    }

    function record(event, details, options) {
      if (!enabled) {
        return Promise.resolve(false);
      }

      const entry = {
        sequence: sequence,
        time: toIsoTime(now()),
        event: String(event || "").slice(0, 90),
        details: sanitizeValue(details, 0)
      };

      sequence += 1;
      entries.push(entry);

      if (entries.length > maxEntries) {
        entries = entries.slice(entries.length - maxEntries);
      }

      if (options && options.immediate) {
        return sendUpdate(options);
      }

      scheduleUpdate();
      return Promise.resolve(true);
    }

    function flush() {
      return sendUpdate({ force: true, immediate: true });
    }

    function getSnapshot() {
      return {
        enabled,
        entries: entries.slice(),
        frameHost,
        readyState: document.readyState,
        settingsHost,
        updatedAt: toIsoTime(now()),
        url: sanitizeUrlForDiagnostics(location && location.href)
      };
    }

    function sendUpdate(options) {
      const force = Boolean(options && options.force);
      const immediate = Boolean(options && options.immediate);

      if (immediate && updateTimer) {
        window.clearTimeout(updateTimer);
        updateTimer = 0;
      }

      const snapshot = getSnapshot();
      const signature = JSON.stringify({
        enabled: snapshot.enabled,
        entries: snapshot.entries.slice(-25),
        url: snapshot.url
      });

      if (!force && signature === lastSignature) {
        return Promise.resolve(false);
      }

      lastSignature = signature;

      try {
        const result = chromeApi.runtime.sendMessage({
          type: "motionblock:diagnosticsUpdated",
          diagnostics: snapshot
        });
        if (result && typeof result.catch === "function") {
          return result.catch(function () {
            return false;
          });
        }
      } catch (error) {
        return Promise.resolve(false);
      }

      return Promise.resolve(true);
    }

    function scheduleUpdate() {
      if (updateTimer) {
        window.clearTimeout(updateTimer);
      }

      updateTimer = window.setTimeout(function () {
        updateTimer = 0;
        sendUpdate();
      }, updateDebounceMs);
    }

    function summarizeRoot(root) {
      if (root === document) {
        return "document";
      }
      if (root && root.host && root.host.tagName) {
        return "shadow:" + String(root.host.tagName).toLowerCase();
      }
      if (root && root.tagName) {
        return "element:" + String(root.tagName).toLowerCase();
      }
      return "root";
    }

    return {
      flush,
      getSnapshot,
      record,
      recordCustomHostScan,
      recordMediaDecision,
      recordMediaEffect,
      recordMediaScan,
      recordPageAudioEvent,
      recordSettingsApplied,
      setEnabled,
      summarizeMediaElement
    };
  }

  function summarizeSiteRule(rule) {
    if (!rule || typeof rule !== "object") {
      return null;
    }

    const featureOverrides = {};
    Object.keys(rule.features || {}).forEach(function (key) {
      if (typeof rule.features[key] === "boolean") {
        featureOverrides[key] = rule.features[key];
      }
    });

    return {
      enabled: typeof rule.enabled === "boolean" ? rule.enabled : null,
      featureOverrides,
      replacementMode: rule.replacementMode || ""
    };
  }

  function summarizeReason(reason) {
    if (!reason || typeof reason !== "object") {
      return reason || null;
    }

    return {
      disableAutoplay: Boolean(reason.disableAutoplay),
      hardBlock: Boolean(reason.hardBlock),
      label: reason.label || ""
    };
  }

  function summarizeMediaElement(element, collectUrls) {
    if (!element) {
      return {};
    }

    return {
      audioAdjusted: Boolean(element.dataset && element.dataset.motionblockAudioAdjusted === "true"),
      blocked: Boolean(element.dataset && element.dataset.motionblockBlocked === "true"),
      feature: element.dataset ? element.dataset.motionblockFeature || "" : "",
      mediaReason: element.dataset ? element.dataset.motionblockReason || "" : "",
      properties: summarizeMediaProperties(element),
      tag: element.tagName ? String(element.tagName).toLowerCase() : "",
      urls: summarizeElementUrls(element, collectUrls),
      userAllowed: Boolean(element.dataset && element.dataset.motionblockUserAllowed === "true")
    };
  }

  function summarizeMediaProperties(element) {
    return {
      autoplay: getBooleanProperty(element, "autoplay"),
      autoplayAttribute: hasAttribute(element, "autoplay"),
      controls: getBooleanProperty(element, "controls"),
      currentSrc: Boolean(getStringProperty(element, "currentSrc")),
      loop: getBooleanProperty(element, "loop"),
      loopAttribute: hasAttribute(element, "loop"),
      muted: getBooleanProperty(element, "muted"),
      mutedAttribute: hasAttribute(element, "muted"),
      networkState: getNumberProperty(element, "networkState"),
      paused: getBooleanProperty(element, "paused"),
      readyState: getNumberProperty(element, "readyState"),
      sourceChildren: countSources(element),
      srcAttribute: hasAttribute(element, "src"),
      volume: getNumberProperty(element, "volume")
    };
  }

  function summarizeElementUrls(element, collectUrls) {
    let urls = [];

    try {
      if (typeof collectUrls === "function") {
        urls = collectUrls(element);
      }
    } catch (error) {
      urls = [];
    }

    return uniqueValues(urls)
      .slice(0, 8)
      .map(function (url) {
        return summarizeUrlForDiagnostics(url, element && element.ownerDocument && element.ownerDocument.baseURI);
      })
      .filter(Boolean);
  }

  function getElementDiagnosticKey(element, suffix) {
    const tag = element && element.tagName ? String(element.tagName).toLowerCase() : "element";
    const source = getStringProperty(element, "currentSrc") || (element && element.getAttribute && element.getAttribute("src")) || "";
    return tag + ":" + suffix + ":" + JSON.stringify(summarizeUrlForDiagnostics(source, element && element.ownerDocument && element.ownerDocument.baseURI));
  }

  function sanitizeValue(value, depth) {
    if (value === null || value === undefined) {
      return value === null ? null : "";
    }
    if (typeof value === "string") {
      return value.length > MAX_STRING_LENGTH ? value.slice(0, MAX_STRING_LENGTH) + "..." : value;
    }
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === "boolean") {
      return value;
    }
    if (Array.isArray(value)) {
      return value.slice(0, MAX_ARRAY_LENGTH).map(function (item) {
        return sanitizeValue(item, depth + 1);
      });
    }
    if (typeof value === "object") {
      if (depth >= 4) {
        return "[depth-limit]";
      }

      const result = {};
      Object.keys(value)
        .slice(0, MAX_OBJECT_KEYS)
        .forEach(function (key) {
          const item = value[key];
          if (typeof item !== "function") {
            result[key] = sanitizeValue(item, depth + 1);
          }
        });
      return result;
    }

    return String(value);
  }

  function hasAttribute(element, name) {
    try {
      return Boolean(element && element.hasAttribute && element.hasAttribute(name));
    } catch (error) {
      return false;
    }
  }

  function getBooleanProperty(element, name) {
    try {
      return Boolean(element && element[name]);
    } catch (error) {
      return false;
    }
  }

  function getNumberProperty(element, name) {
    try {
      const value = Number(element && element[name]);
      return Number.isFinite(value) ? value : 0;
    } catch (error) {
      return 0;
    }
  }

  function getStringProperty(element, name) {
    try {
      return element && element[name] ? String(element[name]) : "";
    } catch (error) {
      return "";
    }
  }

  function countSources(element) {
    try {
      return element && element.querySelectorAll ? element.querySelectorAll("source").length : 0;
    } catch (error) {
      return 0;
    }
  }

  function uniqueValues(values) {
    return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean)));
  }

  function toIsoTime(now) {
    const value = typeof now === "function" ? now() : now;
    const timestamp = Number(value);
    return new Date(Number.isFinite(timestamp) ? timestamp : Date.now()).toISOString();
  }

  root.MotionBlockContentDiagnostics = {
    createContentDiagnostics,
    sanitizeUrlForDiagnostics,
    summarizeUrlForDiagnostics
  };
})(globalThis);
