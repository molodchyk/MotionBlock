(function (root) {
  "use strict";

  function createTabStatsStore(featureKeys, options) {
    const keys = Array.isArray(featureKeys) ? featureKeys.slice() : [];
    const now = options && typeof options.now === "function" ? options.now : Date.now;
    const tabStats = new Map();
    const tabMainUrls = new Map();

    function update(stats, sender) {
      if (!sender || !sender.tab || typeof sender.tab.id !== "number") {
        return;
      }

      const tabId = sender.tab.id;
      const frameId = typeof sender.frameId === "number" ? sender.frameId : 0;
      const senderUrl = sender.url || "";
      const mainUrl = sender.tab.url || (frameId === 0 ? senderUrl : "");

      if (mainUrl && tabMainUrls.get(tabId) !== mainUrl) {
        tabStats.delete(tabId);
        tabMainUrls.set(tabId, mainUrl);
      }

      if (!tabStats.has(tabId)) {
        tabStats.set(tabId, new Map());
      }

      tabStats.get(tabId).set(getFrameStatsKey(sender), {
        stats: sanitizeBlockStats(stats, keys),
        frameId,
        url: senderUrl,
        updatedAt: now()
      });
    }

    function aggregate(tabId) {
      const aggregateStats = createEmptyBlockStats(keys);
      const frameStats = tabStats.get(tabId);

      if (!frameStats) {
        return {
          byFeature: aggregateStats,
          total: 0,
          frames: 0
        };
      }

      let frames = 0;
      frameStats.forEach(function (entry) {
        frames += 1;
        keys.forEach(function (key) {
          aggregateStats[key] += Number(entry.stats.byFeature[key] || 0);
        });
      });

      return {
        byFeature: aggregateStats,
        total: sumStats(aggregateStats, keys),
        frames
      };
    }

    function clearTab(tabId) {
      tabStats.delete(tabId);
      tabMainUrls.delete(tabId);
    }

    return {
      aggregate,
      clearTab,
      update
    };
  }

  function getFrameStatsKey(sender) {
    const frameId = typeof sender.frameId === "number" ? sender.frameId : 0;
    const documentId = sender.documentId || "";
    const url = sender.url || "";
    return frameId + ":" + (documentId || url);
  }

  function sanitizeBlockStats(stats, featureKeys) {
    const keys = Array.isArray(featureKeys) ? featureKeys : [];
    const source = stats && typeof stats === "object" ? stats.byFeature || {} : {};
    const byFeature = createEmptyBlockStats(keys);

    keys.forEach(function (key) {
      const value = Number(source[key] || 0);
      byFeature[key] = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
    });

    return {
      byFeature,
      total: sumStats(byFeature, keys)
    };
  }

  function createEmptyBlockStats(featureKeys) {
    const stats = {};
    (Array.isArray(featureKeys) ? featureKeys : []).forEach(function (key) {
      stats[key] = 0;
    });
    return stats;
  }

  function sumStats(stats, featureKeys) {
    return (Array.isArray(featureKeys) ? featureKeys : []).reduce(function (sum, key) {
      return sum + Number(stats[key] || 0);
    }, 0);
  }

  root.MotionBlockTabStats = {
    createEmptyBlockStats,
    createTabStatsStore,
    sanitizeBlockStats
  };
})(globalThis);
