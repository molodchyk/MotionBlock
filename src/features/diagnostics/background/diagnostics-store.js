(function (root) {
  "use strict";

  const DEFAULT_MAX_ENTRIES_PER_FRAME = 180;
  const DEFAULT_MAX_AGGREGATE_ENTRIES = 260;
  const MAX_STRING_LENGTH = 240;
  const MAX_ARRAY_LENGTH = 30;
  const MAX_OBJECT_KEYS = 36;
  const sanitizeUrlForDiagnostics = root.MotionBlockDiagnosticsUrl.sanitizeUrlForDiagnostics;

  function createDiagnosticsStore(options) {
    const now = options && typeof options.now === "function" ? options.now : Date.now;
    const maxEntriesPerFrame = Number((options && options.maxEntriesPerFrame) || DEFAULT_MAX_ENTRIES_PER_FRAME);
    const maxAggregateEntries = Number((options && options.maxAggregateEntries) || DEFAULT_MAX_AGGREGATE_ENTRIES);
    const tabDiagnostics = new Map();
    const tabMainUrls = new Map();

    function update(report, sender) {
      if (!sender || !sender.tab || typeof sender.tab.id !== "number") {
        return;
      }

      const tabId = sender.tab.id;
      const frameId = typeof sender.frameId === "number" ? sender.frameId : 0;
      const senderUrl = sender.url || "";
      const mainUrl = sender.tab.url || (frameId === 0 ? senderUrl : "");

      if (mainUrl && tabMainUrls.get(tabId) !== mainUrl) {
        tabDiagnostics.delete(tabId);
        tabMainUrls.set(tabId, mainUrl);
      }

      const sanitizedReport = sanitizeDiagnosticsReport(report, maxEntriesPerFrame);
      const frameKey = getFrameDiagnosticsKey(sender);

      if (!sanitizedReport.enabled) {
        const frameReports = tabDiagnostics.get(tabId);
        if (frameReports) {
          frameReports.delete(frameKey);
        }
        return;
      }

      if (!tabDiagnostics.has(tabId)) {
        tabDiagnostics.set(tabId, new Map());
      }

      tabDiagnostics.get(tabId).set(frameKey, {
        entries: sanitizedReport.entries,
        frameHost: sanitizedReport.frameHost,
        frameId,
        readyState: sanitizedReport.readyState,
        settingsHost: sanitizedReport.settingsHost,
        updatedAt: sanitizedReport.updatedAt || toIsoTime(now()),
        url: sanitizedReport.url || sanitizeUrlForDiagnostics(senderUrl)
      });
    }

    function aggregate(tabId) {
      const frameReports = tabDiagnostics.get(Number(tabId));
      const frames = [];
      const entries = [];

      if (frameReports) {
        frameReports.forEach(function (report) {
          const frame = {
            entryCount: report.entries.length,
            frameHost: report.frameHost,
            frameId: report.frameId,
            readyState: report.readyState,
            settingsHost: report.settingsHost,
            updatedAt: report.updatedAt,
            url: report.url
          };

          frames.push(frame);
          report.entries.forEach(function (entry) {
            entries.push(
              Object.assign(
                {
                  frameHost: report.frameHost,
                  frameId: report.frameId,
                  settingsHost: report.settingsHost,
                  url: report.url
                },
                entry
              )
            );
          });
        });
      }

      entries.sort(compareDiagnosticsEntries);

      return {
        capturedAt: toIsoTime(now()),
        entries: entries.slice(Math.max(0, entries.length - maxAggregateEntries)),
        entryCount: entries.length,
        frames: frames.sort(function (a, b) {
          return a.frameId - b.frameId;
        }),
        tabId: Number(tabId)
      };
    }

    function clearTab(tabId) {
      tabDiagnostics.delete(tabId);
      tabMainUrls.delete(tabId);
    }

    return {
      aggregate,
      clearTab,
      update
    };
  }

  function sanitizeDiagnosticsReport(report, maxEntries) {
    const source = report && typeof report === "object" ? report : {};
    const entries = Array.isArray(source.entries) ? source.entries : [];

    return {
      enabled: Boolean(source.enabled),
      entries: entries.slice(Math.max(0, entries.length - maxEntries)).map(sanitizeDiagnosticsEntry),
      frameHost: sanitizeString(source.frameHost || ""),
      readyState: sanitizeString(source.readyState || ""),
      settingsHost: sanitizeString(source.settingsHost || ""),
      updatedAt: sanitizeString(source.updatedAt || ""),
      url: sanitizeUrlForDiagnostics(source.url || "")
    };
  }

  function sanitizeDiagnosticsEntry(entry) {
    const source = entry && typeof entry === "object" ? entry : {};

    return {
      details: sanitizeValue(source.details, 0),
      event: sanitizeString(source.event || ""),
      sequence: sanitizeNumber(source.sequence),
      time: sanitizeString(source.time || "")
    };
  }

  function sanitizeValue(value, depth) {
    if (value === null || value === undefined) {
      return value === null ? null : "";
    }
    if (typeof value === "string") {
      return sanitizeString(value);
    }
    if (typeof value === "number") {
      return sanitizeNumber(value);
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
            result[sanitizeString(key)] = sanitizeValue(item, depth + 1);
          }
        });
      return result;
    }

    return sanitizeString(value);
  }

  function sanitizeString(value) {
    const text = String(value || "");
    return text.length > MAX_STRING_LENGTH ? text.slice(0, MAX_STRING_LENGTH) + "..." : text;
  }

  function sanitizeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function compareDiagnosticsEntries(a, b) {
    const timeDelta = Date.parse(a.time || "") - Date.parse(b.time || "");
    if (Number.isFinite(timeDelta) && timeDelta !== 0) {
      return timeDelta;
    }
    return sanitizeNumber(a.sequence) - sanitizeNumber(b.sequence);
  }

  function getFrameDiagnosticsKey(sender) {
    const frameId = typeof sender.frameId === "number" ? sender.frameId : 0;
    const documentId = sender.documentId || "";
    const url = sender.url || "";
    return frameId + ":" + (documentId || url);
  }

  function toIsoTime(value) {
    const timestamp = typeof value === "function" ? Number(value()) : Number(value);
    return new Date(Number.isFinite(timestamp) ? timestamp : Date.now()).toISOString();
  }

  root.MotionBlockDiagnosticsStore = {
    createDiagnosticsStore,
    sanitizeDiagnosticsReport
  };
})(globalThis);
