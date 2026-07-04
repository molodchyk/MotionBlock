(function (root) {
  "use strict";

  function sanitizeUrlForDiagnostics(value) {
    if (!value) {
      return "";
    }

    try {
      const parsed = new URL(String(value));
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.origin + parsed.pathname;
      }
      return parsed.protocol;
    } catch (error) {
      return "";
    }
  }

  function summarizeUrlForDiagnostics(value, baseUrl) {
    const raw = String(value || "").trim();
    if (!raw) {
      return null;
    }

    try {
      const parsed = new URL(raw, baseUrl || undefined);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return {
          extension: getPathExtension(parsed.pathname),
          host: parsed.hostname,
          pathLength: parsed.pathname.length,
          scheme: parsed.protocol.slice(0, -1)
        };
      }
      if (parsed.protocol === "blob:") {
        const nested = summarizeUrlForDiagnostics(raw.slice(5), baseUrl);
        return {
          innerHost: nested && nested.host ? nested.host : "",
          scheme: "blob"
        };
      }
      if (parsed.protocol === "data:") {
        return {
          length: raw.length,
          mediaType: raw.slice(5).split(/[;,]/)[0].slice(0, 80),
          scheme: "data"
        };
      }
      return {
        length: raw.length,
        scheme: parsed.protocol.replace(/:$/, "")
      };
    } catch (error) {
      return {
        extension: getPathExtension(raw),
        length: raw.length,
        scheme: "relative"
      };
    }
  }

  function getPathExtension(pathname) {
    const match = String(pathname || "").match(/\.([a-z0-9]{2,8})(?:$|[?#])/i);
    return match ? match[1].toLowerCase() : "";
  }

  root.MotionBlockDiagnosticsUrl = {
    sanitizeUrlForDiagnostics,
    summarizeUrlForDiagnostics
  };
})(globalThis);
