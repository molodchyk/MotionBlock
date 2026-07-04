(function (root) {
  "use strict";

  function createPageAudioBridge(options) {
    const diagnostics = options.diagnostics;
    const getEffectiveSettings = options.getEffectiveSettings;
    const sanitizeUrlForDiagnostics = options.sanitizeUrlForDiagnostics;
    const window = options.window;
    let started = false;

    function start() {
      if (started) {
        return;
      }
      started = true;
      window.addEventListener("message", handlePageAudioProbeMessage);
    }

    function sendPolicy() {
      const effectiveSettings = getEffectiveSettings();
      window.postMessage(
        {
          source: "MotionBlockContent",
          type: "motionblock:audioPolicy",
          audioBlocked: Boolean(effectiveSettings.enabled && effectiveSettings.features.audio),
          diagnosticsEnabled: Boolean(effectiveSettings.diagnosticsEnabled)
        },
        "*"
      );
    }

    function handlePageAudioProbeMessage(event) {
      const message = event && event.data;
      if (event.source !== window || !message || message.source !== "MotionBlockAudioProbe" || message.type !== "motionblock:pageAudioEvent") {
        return;
      }

      diagnostics.recordPageAudioEvent(message.kind, message.details);
    }

    function summarizePageUrl() {
      return sanitizeUrlForDiagnostics(window.location && window.location.href);
    }

    return {
      sendPolicy,
      start,
      summarizePageUrl
    };
  }

  root.MotionBlockPageAudioBridge = {
    createPageAudioBridge
  };
})(globalThis);
