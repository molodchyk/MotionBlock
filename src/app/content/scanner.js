(function (root) {
  "use strict";

  function createContentScanner(options) {
    const cssBackgroundDataKey = options.cssBackgroundDataKey;
    const cssBackgroundScanLimit = options.cssBackgroundScanLimit;
    const cssBackgroundSelector = options.cssBackgroundSelector;
    const customMediaHostSelector = options.customMediaHostSelector;
    const window = options.window;

    function processImages(root) {
      if (!shouldInspectImages()) {
        options.restoreElementsByFeature("image");
        return;
      }

      root.querySelectorAll("img, picture source").forEach(function (element) {
        if (element.dataset.motionblockUserAllowed === "true") {
          return;
        }

        const reason = options.getImageBlockReason(element);

        if (reason) {
          if (options.shouldDeferBroadImageBlock(element, reason)) {
            options.deferBroadImageBlock(element, reason);
            return;
          }

          options.blockImageElement(element, reason);
        } else if (element.dataset.motionblockFeature === "image") {
          options.restoreElement(element);
        } else if (element.dataset.motionblockPendingImageBlock === "true") {
          options.clearPendingImageBlock(element);
        }
      });

      processCssBackgroundImages(root);
    }

    function processCssBackgroundImages(root) {
      const candidates = [];

      if (root.nodeType === options.nodeTypes.ELEMENT_NODE && root.matches(cssBackgroundSelector)) {
        candidates.push(root);
      }

      root
        .querySelectorAll(cssBackgroundSelector + ", [data-" + toDataAttributeName(cssBackgroundDataKey) + "='true']")
        .forEach(function (element) {
          candidates.push(element);
        });

      processCssBackgroundImageBatch(uniqueElements(candidates), 0);
    }

    function processCssBackgroundImageBatch(elements, startIndex) {
      const endIndex = Math.min(elements.length, startIndex + cssBackgroundScanLimit);

      for (let index = startIndex; index < endIndex; index += 1) {
        processCssBackgroundImage(elements[index]);
      }

      if (endIndex < elements.length) {
        window.setTimeout(function () {
          processCssBackgroundImageBatch(elements, endIndex);
        }, 0);
      }
    }

    function processCssBackgroundImage(element) {
      if (!element.isConnected || element.dataset.motionblockUserAllowed === "true" || element.closest(".motionblock-reveal-button")) {
        return;
      }

      const reason = options.getCssBackgroundBlockReason(element);

      if (reason) {
        options.blockCssBackgroundElement(element, reason);
      } else if (element.dataset[cssBackgroundDataKey] === "true") {
        options.restoreElement(element);
      }
    }

    function processMedia(root) {
      const mediaElements = Array.from(root.querySelectorAll("video, audio"));
      recordNativeMediaScan(root, mediaElements);

      mediaElements.forEach(function (element) {
        if (element.dataset.motionblockUserAllowed === "true") {
          return;
        }

        const reason = options.getMediaBlockReason(element);

        if (reason && reason.hardBlock) {
          recordMediaDecision(element, reason, "hard-block");
          options.blockMediaElement(element, reason.label);
        } else if (reason && reason.disableAutoplay) {
          recordMediaDecision(element, reason, "disable-autoplay");
          if (element.dataset.motionblockFeature === "media") {
            options.restoreElement(element);
          }
          options.disableAutoplay(element);
          options.syncVideoAudioBlocking(element);
        } else if (element.dataset.motionblockFeature === "media") {
          recordMediaDecision(element, reason, "restore-native-media");
          options.restoreElement(element);
          options.syncVideoAudioBlocking(element);
        } else if (element.dataset.motionblockBlocked === "true") {
          recordMediaDecision(element, reason, "enforce-blocked-native-media");
          options.enforceBlockedMediaElement(element);
        } else {
          options.syncVideoAudioBlocking(element);
        }
      });

      processCustomMediaHosts(root);
    }

    function processCustomMediaHosts(root) {
      const candidates = [];

      root.querySelectorAll(customMediaHostSelector).forEach(function (element) {
        candidates.push(element);
      });

      root.querySelectorAll("source[src], source[srcset]").forEach(function (source) {
        const host = options.findCustomMediaHost(source);
        if (host) {
          candidates.push(host);
        }
      });

      const uniqueCandidates = uniqueElements(candidates);
      recordCustomHostScan(root, candidates.length, uniqueCandidates.length);
      uniqueCandidates.forEach(processCustomMediaHost);
    }

    function processCustomMediaHost(element) {
      if (element.dataset.motionblockUserAllowed === "true" || options.isNativeMediaElement(element)) {
        return;
      }

      const reason = options.getCustomMediaHostBlockReason(element);

      if (reason && reason.hardBlock) {
        recordMediaDecision(element, reason, "custom-hard-block");
        options.blockCustomMediaHostElement(element, reason.label);
      } else if (element.dataset.motionblockFeature === "media" && element.dataset.motionblockCustomHost === "true") {
        recordMediaDecision(element, reason, "restore-custom-media-host");
        options.restoreElement(element);
      } else if (element.dataset.motionblockBlocked === "true" && element.dataset.motionblockCustomHost === "true") {
        recordMediaDecision(element, reason, "enforce-blocked-custom-media-host");
        options.enforceBlockedCustomMediaHostElement(element);
      }
    }

    function stopBlockedMediaPlayback(event) {
      const element = event.target;
      const settings = options.getEffectiveSettings();
      if (!element || (element.tagName !== "VIDEO" && element.tagName !== "AUDIO")) {
        return;
      }

      if (element.dataset.motionblockEnforcing === "true") {
        return;
      }

      if (!settings.enabled || element.dataset.motionblockUserAllowed === "true") {
        return;
      }

      const reason = options.getMediaBlockReason(element);
      if (reason && reason.hardBlock) {
        recordMediaDecision(element, reason, "hard-block-from-play-event");
        options.blockMediaElement(element, reason.label);
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (element.tagName === "VIDEO" && settings.features.audio) {
        options.blockVideoAudioElement(element);
      }

      if (reason && reason.disableAutoplay) {
        recordMediaDecision(element, reason, "disable-autoplay-from-play-event");
        options.disableAutoplay(element);
        event.preventDefault();
        event.stopPropagation();
      }
    }

    function recordNativeMediaScan(root, elements) {
      const diagnostics = options.diagnostics;
      if (!diagnostics || typeof diagnostics.recordMediaScan !== "function") {
        return;
      }

      const counts = elements.reduce(
        function (result, element) {
          if (element.tagName === "AUDIO") {
            result.audio += 1;
          } else if (element.tagName === "VIDEO") {
            result.video += 1;
          }
          return result;
        },
        { audio: 0, video: 0 }
      );
      const settings = options.getEffectiveSettings();

      diagnostics.recordMediaScan(root, {
        audioElements: counts.audio,
        enabled: Boolean(settings.enabled),
        features: settings.features,
        totalElements: elements.length,
        videoElements: counts.video
      });
    }

    function recordCustomHostScan(root, candidates, uniqueCandidates) {
      const diagnostics = options.diagnostics;
      if (!diagnostics || typeof diagnostics.recordCustomHostScan !== "function") {
        return;
      }

      const settings = options.getEffectiveSettings();
      diagnostics.recordCustomHostScan(root, {
        candidateMatches: candidates,
        enabled: Boolean(settings.enabled),
        features: settings.features,
        uniqueCandidates
      });
    }

    function recordMediaDecision(element, reason, action) {
      const diagnostics = options.diagnostics;
      if (!diagnostics || typeof diagnostics.recordMediaDecision !== "function") {
        return;
      }

      diagnostics.recordMediaDecision(element, reason, action, options.collectElementUrls);
    }

    function shouldInspectImages() {
      const features = options.getEffectiveSettings().features;
      return features.images || features.gifs || features.gifv || features.animatedWebp;
    }

    function shouldInspectMedia() {
      const features = options.getEffectiveSettings().features;
      return features.video || features.audio || features.autoplayVideo || features.gifv || features.gifs;
    }

    return {
      processImages,
      processMedia,
      shouldInspectImages,
      shouldInspectMedia,
      stopBlockedMediaPlayback
    };
  }

  function uniqueElements(elements) {
    const seen = new Set();
    const result = [];

    elements.forEach(function (element) {
      if (!seen.has(element)) {
        seen.add(element);
        result.push(element);
      }
    });

    return result;
  }

  function toDataAttributeName(dataKey) {
    return String(dataKey).replace(/[A-Z]/g, function (letter) {
      return "-" + letter.toLowerCase();
    });
  }

  root.MotionBlockContentScanner = {
    createContentScanner
  };
})(globalThis);
