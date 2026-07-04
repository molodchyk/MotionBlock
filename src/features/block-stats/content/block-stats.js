(function (root) {
  "use strict";

  function createContentBlockStats(options) {
    const chromeApi = options.chrome;
    const dataKeys = options.dataKeys;
    const emojiTextBlockCounts = options.emojiTextBlockCounts;
    const emojiTextOriginals = options.emojiTextOriginals;
    const featureKeys = options.featureKeys;
    const frameHost = options.frameHost;
    const location = options.location;
    const nodeTypes = options.nodeTypes;
    const settingsHost = options.settingsHost;
    const updateDebounceMs = options.updateDebounceMs;
    const window = options.window;
    const blockStats = createEmptyBlockStats(featureKeys);

    let statsUpdateTimer = 0;
    let lastStatsSignature = "";

    function getSnapshot() {
      const byFeature = {};
      let total = 0;

      featureKeys.forEach(function (key) {
        const value = Math.max(0, Number(blockStats[key] || 0));
        byFeature[key] = value;
        total += value;
      });

      return {
        byFeature,
        total,
        frameHost,
        settingsHost,
        url: location.href
      };
    }

    function reset() {
      featureKeys.forEach(function (key) {
        blockStats[key] = 0;
      });
    }

    function markMedia(element, featureKey) {
      if (!element || !featureKey || featureKeys.indexOf(featureKey) === -1) {
        return;
      }

      const previous = element.dataset[dataKeys.mediaStat] || "";
      if (previous === featureKey) {
        return;
      }

      if (previous) {
        adjust(previous, -1);
      }

      element.dataset[dataKeys.mediaStat] = featureKey;
      adjust(featureKey, 1);
    }

    function unmarkMedia(element) {
      if (!element || !element.dataset) {
        return;
      }

      const previous = element.dataset[dataKeys.mediaStat] || "";
      if (previous) {
        adjust(previous, -1);
        delete element.dataset[dataKeys.mediaStat];
      }
    }

    function markEmojiElement(element) {
      if (!element || element.dataset[dataKeys.emojiElementStat] === "true") {
        return;
      }

      element.dataset[dataKeys.emojiElementStat] = "true";
      adjust("emoji", 1);
    }

    function unmarkEmojiElement(element) {
      if (!element || !element.dataset || element.dataset[dataKeys.emojiElementStat] !== "true") {
        return;
      }

      delete element.dataset[dataKeys.emojiElementStat];
      adjust("emoji", -1);
    }

    function incrementElementNumeric(element, dataKey, amount) {
      if (!element || !amount) {
        return;
      }

      const next = Math.max(0, Number(element.dataset[dataKey] || "0") + amount);
      if (next) {
        element.dataset[dataKey] = String(next);
      } else {
        delete element.dataset[dataKey];
      }
    }

    function consumeElementNumeric(element, dataKey) {
      if (!element || !element.dataset) {
        return 0;
      }

      const value = Math.max(0, Number(element.dataset[dataKey] || "0"));
      if (value) {
        delete element.dataset[dataKey];
      }
      return value;
    }

    function decrementElementNumeric(element, dataKey, amount) {
      if (!element || !amount) {
        return;
      }

      const next = Math.max(0, Number(element.dataset[dataKey] || "0") - amount);
      if (next) {
        element.dataset[dataKey] = String(next);
      } else {
        delete element.dataset[dataKey];
      }
    }

    function adjust(featureKey, delta) {
      if (featureKeys.indexOf(featureKey) === -1 || !delta) {
        return;
      }

      blockStats[featureKey] = Math.max(0, Number(blockStats[featureKey] || 0) + delta);
      scheduleUpdate();
    }

    function sendUpdate(options) {
      const force = Boolean(options && options.force);
      const immediate = Boolean(options && options.immediate);

      if (immediate && statsUpdateTimer) {
        window.clearTimeout(statsUpdateTimer);
        statsUpdateTimer = 0;
      }

      const snapshot = getSnapshot();
      const signature = JSON.stringify(snapshot.byFeature) + ":" + snapshot.total;
      if (!force && signature === lastStatsSignature) {
        return;
      }

      lastStatsSignature = signature;

      try {
        const result = chromeApi.runtime.sendMessage({
          type: "motionblock:statsUpdated",
          stats: snapshot
        });
        if (result && typeof result.catch === "function") {
          result.catch(function () {});
        }
      } catch (error) {
        return;
      }
    }

    function cleanupRemovedNode(node) {
      if (!node || node.nodeType !== nodeTypes.ELEMENT_NODE) {
        if (node && node.nodeType === nodeTypes.TEXT_NODE && emojiTextBlockCounts.has(node)) {
          const count = Number(emojiTextBlockCounts.get(node) || 0);
          adjust("emoji", -count);
          emojiTextBlockCounts.delete(node);
          emojiTextOriginals.delete(node);
        }

        if (node && node.nodeType === nodeTypes.DOCUMENT_FRAGMENT_NODE) {
          cleanupRemovedSubtree(node);
        }
        return;
      }

      cleanupElement(node);
      cleanupRemovedSubtree(node);
    }

    function cleanupRemovedSubtree(root) {
      if (!root || !root.querySelectorAll) {
        return;
      }

      root
        .querySelectorAll(
          "[data-" +
            toDataAttributeName(dataKeys.mediaStat) +
            "], [data-" +
            toDataAttributeName(dataKeys.mediaUncounted) +
            "], [data-" +
            toDataAttributeName(dataKeys.cssBackground) +
            "], [data-" +
            toDataAttributeName(dataKeys.cssBackgroundUrls) +
            "], [data-" +
            toDataAttributeName(dataKeys.audioAdjusted) +
            "], [data-" +
            toDataAttributeName(dataKeys.emojiElementStat) +
            "], [data-" +
            toDataAttributeName(dataKeys.emojiTextStat) +
            "], [data-" +
            toDataAttributeName(dataKeys.emojiAttributeStat) +
            "]"
        )
        .forEach(cleanupElement);
    }

    function cleanupElement(element) {
      unmarkMedia(element);
      unmarkEmojiElement(element);

      const emojiTextCount = consumeElementNumeric(element, dataKeys.emojiTextStat);
      const emojiAttributeCount = consumeElementNumeric(element, dataKeys.emojiAttributeStat);
      if (emojiTextCount || emojiAttributeCount) {
        adjust("emoji", -(emojiTextCount + emojiAttributeCount));
      }
    }

    function scheduleUpdate() {
      if (statsUpdateTimer) {
        window.clearTimeout(statsUpdateTimer);
      }

      statsUpdateTimer = window.setTimeout(function () {
        statsUpdateTimer = 0;
        sendUpdate();
      }, updateDebounceMs);
    }

    return {
      adjust,
      cleanupElement,
      cleanupRemovedNode,
      cleanupRemovedSubtree,
      consumeElementNumeric,
      decrementElementNumeric,
      getImageStatFeature,
      getMediaStatFeature,
      getSnapshot,
      incrementElementNumeric,
      markEmojiElement,
      markMedia,
      reset,
      sendUpdate,
      unmarkEmojiElement,
      unmarkMedia
    };
  }

  function createEmptyBlockStats(featureKeys) {
    const stats = {};
    featureKeys.forEach(function (key) {
      stats[key] = 0;
    });
    return stats;
  }

  function getImageStatFeature(reason) {
    const normalized = String(reason || "").toLowerCase();

    if (normalized === "image") {
      return "images";
    }
    if (normalized === "gifv") {
      return "gifv";
    }
    if (normalized === "webp") {
      return "animatedWebp";
    }
    if (normalized.indexOf("gif") !== -1) {
      return "gifs";
    }

    return "images";
  }

  function getMediaStatFeature(reason, element) {
    const normalized = String(reason || "").toLowerCase();
    const tag = element && element.tagName ? element.tagName.toLowerCase() : "";

    if (normalized === "gifv") {
      return "gifv";
    }
    if (normalized.indexOf("gif") !== -1) {
      return "gifs";
    }
    if (normalized.indexOf("audio") !== -1 || tag === "audio") {
      return "audio";
    }
    if (normalized.indexOf("autoplay") !== -1 || normalized.indexOf("looping") !== -1) {
      return "autoplayVideo";
    }
    if (normalized.indexOf("video") !== -1 || tag === "video") {
      return "video";
    }

    return "video";
  }

  function toDataAttributeName(dataKey) {
    return String(dataKey).replace(/[A-Z]/g, function (letter) {
      return "-" + letter.toLowerCase();
    });
  }

  root.MotionBlockContentBlockStats = {
    createContentBlockStats,
    getImageStatFeature,
    getMediaStatFeature
  };
})(globalThis);
