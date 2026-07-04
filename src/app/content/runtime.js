(function (root) {
  "use strict";

  const APPLY_DEBOUNCE_MS = 120;
  const MEDIA_ATTRIBUTE_FILTER = [
    "src",
    "srcset",
    "poster",
    "autoplay",
    "loop",
    "muted",
    "style",
    "data-bg",
    "data-background",
    "data-background-image"
  ];
  const MEDIA_ENFORCEMENT_EVENTS = ["loadstart", "loadedmetadata", "canplay", "play", "playing", "volumechange"];
  const FULL_SCAN_SETTLE_DELAYS_MS = [180, 700, 1800];
  const SETTINGS_TRANSITION_SCAN_DELAYS_MS = [80, 240, 600, 1200, 2500, 4000];

  function createContentRuntime(options) {
    const document = options.document;
    const window = options.window;

    let scheduled = false;
    let fullScanPending = true;
    let applyTimer = 0;
    let observer = null;
    let attachShadowPatched = false;
    let settlingFullScanTimers = [];
    let settingsTransitionId = 0;
    let settingsTransitionTimers = [];
    const processingRoots = [document];
    const dirtyRoots = new Set([document]);
    const observedProcessingRoots = new WeakSet();

    function start() {
      observer = new window.MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
          markDirtyRoot(getMutationRoot(mutation));

          if (mutation.type === "childList") {
            mutation.addedNodes.forEach(discoverShadowRootsFromNode);
            mutation.removedNodes.forEach(options.cleanupRemovedNodeStats);
          }
        });
        scheduleApply();
      });

      patchAttachShadow();
      observeProcessingRoot(document);
      discoverShadowRoots(document);

      if (document.readyState === "loading") {
        document.addEventListener(
          "DOMContentLoaded",
          function () {
            scheduleApply({ full: true });
          },
          { once: true }
        );
      } else {
        scheduleApply({ full: true });
      }
    }

    function runFullBlockingPass() {
      cancelScheduledApply();
      markFullScan();
      applyBlocking();
      scheduleSettlingFullScans();
    }

    function scheduleSettingsTransitionScans() {
      clearSettingsTransitionScans();

      const transitionId = settingsTransitionId + 1;
      settingsTransitionId = transitionId;

      settingsTransitionTimers = SETTINGS_TRANSITION_SCAN_DELAYS_MS.map(function (delay) {
        return window.setTimeout(function () {
          if (settingsTransitionId !== transitionId) {
            return;
          }

          markFullScan();
          applyBlocking();
        }, delay);
      });
    }

    function queryAllProcessingRoots(selector) {
      const elements = [];

      getProcessingRoots().forEach(function (root) {
        root.querySelectorAll(selector).forEach(function (element) {
          elements.push(element);
        });
      });

      return elements;
    }

    function cancelScheduledApply() {
      if (applyTimer) {
        window.clearTimeout(applyTimer);
        applyTimer = 0;
      }

      scheduled = false;
    }

    function patchAttachShadow() {
      if (attachShadowPatched || !window.Element.prototype.attachShadow) {
        return;
      }

      const originalAttachShadow = window.Element.prototype.attachShadow;
      window.Element.prototype.attachShadow = function (init) {
        const shadowRoot = originalAttachShadow.call(this, init);

        if (!init || init.mode === "open") {
          window.setTimeout(function () {
            observeProcessingRoot(shadowRoot);
            scheduleApply({ root: shadowRoot });
          }, 0);
        }

        return shadowRoot;
      };

      attachShadowPatched = true;
    }

    function observeProcessingRoot(root) {
      if (!root || observedProcessingRoots.has(root)) {
        return;
      }

      observedProcessingRoots.add(root);

      if (root !== document) {
        processingRoots.push(root);
        addMediaEnforcementListeners(root);
      }

      markDirtyRoot(root);

      const target = root === document ? document.documentElement || document : root;
      observer.observe(target, {
        attributes: true,
        attributeFilter: MEDIA_ATTRIBUTE_FILTER,
        childList: true,
        subtree: true
      });

      discoverShadowRoots(root);
    }

    function discoverShadowRoots(root) {
      if (!root || typeof root.querySelectorAll !== "function") {
        return;
      }

      root.querySelectorAll("*").forEach(function (element) {
        if (element.shadowRoot) {
          observeProcessingRoot(element.shadowRoot);
        }
      });
    }

    function discoverShadowRootsFromNode(node) {
      if (!node || node.nodeType !== options.nodeTypes.ELEMENT_NODE) {
        return;
      }

      if (node.shadowRoot) {
        observeProcessingRoot(node.shadowRoot);
      }

      discoverShadowRoots(node);
    }

    function getMutationRoot(mutation) {
      const target = mutation && mutation.target;
      if (target && typeof target.getRootNode === "function") {
        return normalizeProcessingRoot(target.getRootNode());
      }

      return document;
    }

    function normalizeProcessingRoot(root) {
      return root && (root.nodeType === options.nodeTypes.DOCUMENT_NODE || root.nodeType === options.nodeTypes.DOCUMENT_FRAGMENT_NODE)
        ? root
        : document;
    }

    function markDirtyRoot(root) {
      dirtyRoots.add(normalizeProcessingRoot(root));
    }

    function markFullScan() {
      fullScanPending = true;
      dirtyRoots.clear();
      dirtyRoots.add(document);
    }

    function scheduleApply(options) {
      if (options && options.full) {
        markFullScan();
      } else if (options && options.root) {
        markDirtyRoot(options.root);
      }

      if (scheduled) {
        return;
      }

      scheduled = true;
      applyTimer = window.setTimeout(function () {
        applyTimer = 0;
        scheduled = false;
        applyBlocking();
      }, APPLY_DEBOUNCE_MS);
    }

    function applyBlocking() {
      if (fullScanPending) {
        discoverAllProcessingRoots();
      }

      const work = consumeScheduledWork();
      const roots = work.roots;
      const settings = options.getEffectiveSettings();

      updateDocumentClasses(settings);

      if (!settings.showRevealControls) {
        options.removeAllRevealButtons();
      }

      if (!settings.enabled) {
        if (work.full) {
          options.restoreBlockedElements();
        }
        return;
      }

      if (options.shouldInspectImages()) {
        roots.forEach(options.processImages);
      } else if (work.full) {
        options.restoreElementsByFeature("image");
      }

      if (options.shouldInspectMedia()) {
        roots.forEach(options.processMedia);
      } else if (work.full) {
        options.restoreElementsByFeature("media");
        options.restoreAudioAdjustedElements();
      }

      if (settings.features.emoji) {
        roots.forEach(options.processEmoji);
      } else if (!settings.features.emoji && work.full) {
        getProcessingRoots().forEach(options.restoreEmojiElements);
      }

      options.updateAllRevealOverlayPositions();
    }

    function scheduleSettlingFullScans() {
      clearSettlingFullScans();

      if (!shouldRunSettlingFullScans()) {
        return;
      }

      settlingFullScanTimers = FULL_SCAN_SETTLE_DELAYS_MS.map(function (delay) {
        return window.setTimeout(function () {
          markFullScan();
          applyBlocking();
        }, delay);
      });
    }

    function clearSettlingFullScans() {
      settlingFullScanTimers.forEach(function (timer) {
        window.clearTimeout(timer);
      });
      settlingFullScanTimers = [];
    }

    function shouldRunSettlingFullScans() {
      const settings = options.getEffectiveSettings();
      if (!settings.enabled) {
        return false;
      }

      return (
        options.shouldInspectImages() ||
        options.shouldInspectMedia() ||
        Boolean(settings.features.emoji) ||
        Boolean(settings.features.cssMotion)
      );
    }

    function clearSettingsTransitionScans() {
      settingsTransitionTimers.forEach(function (timer) {
        window.clearTimeout(timer);
      });
      settingsTransitionTimers = [];
    }

    function addMediaEnforcementListeners(root) {
      MEDIA_ENFORCEMENT_EVENTS.forEach(function (eventName) {
        root.addEventListener(eventName, options.stopBlockedMediaPlayback, true);
      });
    }

    function discoverAllProcessingRoots() {
      getProcessingRoots().forEach(discoverShadowRoots);
    }

    function updateDocumentClasses(settings) {
      if (!document.documentElement) {
        return;
      }

      document.documentElement.classList.toggle(
        "motionblock-css-motion-off",
        Boolean(settings.enabled) && Boolean(settings.features.cssMotion)
      );
    }

    function getProcessingRoots() {
      return processingRoots.filter(function (root) {
        return root === document || !root.host || root.host.isConnected;
      });
    }

    function consumeScheduledWork() {
      const full = fullScanPending;
      const activeRoots = getProcessingRoots();
      let roots;

      if (full) {
        roots = activeRoots;
      } else {
        roots = Array.from(dirtyRoots)
          .map(normalizeProcessingRoot)
          .filter(function (root) {
            return activeRoots.indexOf(root) !== -1;
          });
      }

      dirtyRoots.clear();
      fullScanPending = false;

      return {
        full,
        roots: uniqueElements(roots)
      };
    }

    return {
      queryAllProcessingRoots,
      runFullBlockingPass,
      scheduleSettingsTransitionScans,
      start
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

  root.MotionBlockContentRuntime = {
    createContentRuntime
  };
})(globalThis);
