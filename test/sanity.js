const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

require("../src/shared/config.js");
require("../src/platform/chrome/settings-storage.js");
require("../src/features/network-blocking/background/dynamic-rules.js");
require("../src/features/block-stats/background/tab-stats.js");
require("../src/features/block-stats/content/block-stats.js");
require("../src/features/uninstall-feedback/background/uninstall-feedback.js");
require("../src/features/emoji-blocking/content/emoji.js");
require("../src/features/media-blocking/content/url-utils.js");
require("../src/features/media-blocking/content/element-inspection.js");
require("../src/features/media-blocking/content/custom-hosts.js");
require("../src/features/media-blocking/content/classifier.js");
require("../src/features/media-blocking/content/effects.js");
require("../src/features/media-blocking/content/original-state.js");
require("../src/app/background/message-router.js");
require("../src/app/content/frame-context.js");
require("../src/app/popup/diagnostics-analysis.js");
require("../src/app/popup/view.js");

const MB = globalThis.MotionBlock;
const settingsStorage = globalThis.MotionBlockSettingsStorage;
const networkRules = globalThis.MotionBlockNetworkRules;
const tabStats = globalThis.MotionBlockTabStats;
const contentBlockStats = globalThis.MotionBlockContentBlockStats;
const emojiBlocker = globalThis.MotionBlockEmojiBlocker;
const mediaClassifier = globalThis.MotionBlockMediaClassifier;
const mediaEffects = globalThis.MotionBlockMediaEffects;
const mediaOriginalState = globalThis.MotionBlockMediaOriginalState;
const messageRouter = globalThis.MotionBlockMessageRouter;
const frameContext = globalThis.MotionBlockFrameContext;
const popupView = globalThis.MotionBlockPopupView;
const uninstallFeedback = globalThis.MotionBlockUninstallFeedback;

assert.equal(MB.normalizeHostname("https://www.Reddit.com/r/test"), "reddit.com");
assert.equal(MB.normalizeHostname("example.com:443"), "example.com");
assert.equal(MB.getConfigurableHostFromUrl("https://www.Reddit.com/r/test"), "reddit.com");
assert.equal(MB.getConfigurableHostFromUrl("http://example.com/path"), "example.com");
assert.equal(MB.getConfigurableHostFromUrl("chrome-extension://abcdefghijklmnop/src/options.html"), "");
assert.equal(MB.getConfigurableHostFromUrl("chrome://extensions/"), "");
assert.equal(MB.getConfigurableHostFromUrl("about:blank"), "");
assert.equal(MB.getConfigurableHostFromUrl("file:///C:/tmp/test.html"), "");
assert.equal(MB.isConfigurableUrl("https://youtube.com/watch?v=1"), true);
assert.equal(MB.isConfigurableUrl("chrome://settings/"), false);
assert.deepEqual(
  frameContext.createFrameContext({
    config: MB,
    document: { referrer: "https://referrer.example/page" },
    window: {
      location: {
        ancestorOrigins: ["https://outer.example", "https://top.example"],
        hostname: "frame.example"
      },
      self: {},
      top: {}
    }
  }),
  {
    currentHost: "top.example frame.example",
    frameHost: "frame.example",
    settingsHost: "top.example"
  }
);

const defaults = MB.normalizeSettings({});
assert.equal(defaults.enabled, true);
assert.equal(defaults.diagnosticsEnabled, false);
assert.equal(defaults.uiTheme, "system");
assert.equal(defaults.showRevealControls, false);
assert.equal(defaults.features.gifs, true);
assert.equal(defaults.features.gifv, true);
assert.equal(defaults.features.animatedWebp, false);
assert.equal(defaults.features.images, false);
assert.equal(MB.FEATURE_GROUPS.length >= 2, true);
assert.equal(MB.FEATURE_DEFINITIONS.every(function (feature) {
  return MB.FEATURE_GROUPS.some(function (group) {
    return group.key === feature.group;
  });
}), true);

const settings = MB.normalizeSettings({
  enabled: true,
  diagnosticsEnabled: true,
  uiTheme: "dark",
  showRevealControls: true,
  features: {
    gifs: false,
    gifv: false,
    autoplayVideo: false
  },
  siteRules: {
    "www.reddit.com": {
      enabled: true,
      features: {
        gifs: true,
        gifv: true,
        cssMotion: true
      }
    },
    "giphy.com": {
      enabled: false
    },
    "empty.example": {}
  }
});

assert.equal(settings.uiTheme, "dark");
assert.equal(settings.diagnosticsEnabled, true);
assert.equal(settings.showRevealControls, true);

const backup = MB.createSettingsBackup(settings);
assert.equal(backup.app, "MotionBlock");
assert.equal(backup.schemaVersion, 1);
assert.equal(MB.normalizeSettingsBackupPayload(backup).uiTheme, "dark");
assert.equal(MB.normalizeSettingsBackupPayload(backup).diagnosticsEnabled, true);
assert.equal(MB.normalizeSettingsBackupPayload(settings).showRevealControls, true);
assert.throws(function () {
  MB.normalizeSettingsBackupPayload({ app: "Other" });
}, /MotionBlock settings backup/);

assert.equal(Object.hasOwn(settings.siteRules, "reddit.com"), true);
assert.equal(Object.hasOwn(settings.siteRules, "www.reddit.com"), false);
assert.equal(Object.hasOwn(settings.siteRules, "empty.example"), false);

const reddit = MB.getEffectiveSettings(settings, "reddit.com");
assert.equal(reddit.enabled, true);
assert.equal(reddit.diagnosticsEnabled, true);
assert.equal(reddit.features.gifs, true);
assert.equal(reddit.features.gifv, true);
assert.equal(reddit.features.cssMotion, true);
assert.equal(reddit.features.autoplayVideo, false);

const giphy = MB.getEffectiveSettings(settings, "giphy.com");
assert.equal(giphy.enabled, false);

const invalidTheme = MB.normalizeSettings({ uiTheme: "purple" });
assert.equal(invalidTheme.uiTheme, "system");
assert.equal(MB.getEffectiveSettings(defaults, "youtube.com").showRevealControls, false);

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8"));
assert.deepEqual(manifest.permissions.sort(), ["declarativeNetRequest", "storage"]);
assert.equal(manifest.host_permissions.includes("<all_urls>"), true);

const background = fs.readFileSync(path.join(__dirname, "..", "src", "background.js"), "utf8");
assert.equal(background.includes('regexFilter: "\\\\.gif(?:$|[?#])"'), false);
assert.equal(background.includes("cleardot"), false);
assert.equal(background.includes("  images: ["), false);
assert.equal(background.includes("DNR_FEATURE_RULES"), false);
assert.equal(background.includes("const tabStats = new Map"), false);
assert.equal(background.includes("chrome.storage.sync.get"), false);
assert.equal(background.includes("chrome.runtime.onMessage.addListener"), true);
assert.equal(background.includes("features/uninstall-feedback/background/uninstall-feedback.js"), true);

const uninstallUrl = new URL(uninstallFeedback.getUninstallFeedbackUrl({
  i18n: {
    getUILanguage() {
      return "de";
    }
  },
  runtime: {
    getManifest() {
      return { version: "1.0.1" };
    }
  }
}));
assert.equal(uninstallUrl.origin + uninstallUrl.pathname, "https://molodchyk.com/motionblock/uninstall/");
assert.equal(uninstallUrl.searchParams.get("source"), "chrome");
assert.equal(uninstallUrl.searchParams.get("version"), "1.0.1");
assert.equal(uninstallUrl.searchParams.get("lang"), "de");
assert.equal(Array.from(uninstallUrl.searchParams.keys()).sort().join(","), "lang,source,version");

assert.deepEqual(mediaClassifier.splitUrlAttribute("a.jpg 1x, b.webp 2x"), ["a.jpg", "b.webp"]);
assert.deepEqual(mediaClassifier.extractCssUrls('url("https://example.com/a.gif") linear-gradient(red, blue) url(/b.webp)'), [
  "https://example.com/a.gif",
  "/b.webp"
]);
assert.equal(mediaClassifier.isGifUrl("https://example.com/a.gif?x=1"), true);
assert.equal(mediaClassifier.isGifvUrl("https://example.com/a.gifv"), true);
assert.equal(mediaClassifier.isWebpUrl("data:image/webp;base64,abc"), true);
assert.equal(mediaClassifier.isVideoUrl("https://v.redd.it/abc"), true);
assert.equal(mediaClassifier.isAudioUrl("https://example.com/a.flac"), true);
assert.equal(mediaOriginalState.getOriginalAttributeKey("srcset"), "motionblockOriginalSrcset");
assert.equal(mediaOriginalState.getOriginalStylePropertyKey("backgroundImage"), "motionblockOriginalStyleBackgroundImage");

assert.equal(popupView.parseTriState("true"), true);
assert.equal(popupView.parseTriState("false"), false);
assert.equal(popupView.parseTriState(""), null);
assert.equal(popupView.formatTriState(true), "true");
assert.equal(popupView.formatTriState(false), "false");
assert.equal(popupView.formatTriState(null), "");
assert.deepEqual(popupView.createEmptyTabStats(["gifs", "video"]), {
  byFeature: {
    gifs: 0,
    video: 0
  },
  total: 0
});
assert.deepEqual(popupView.normalizeTabStats({ byFeature: { gifs: 2.9, video: -1, audio: "3" } }, ["gifs", "video", "audio"]), {
  byFeature: {
    gifs: 2,
    video: 0,
    audio: 3
  },
  total: 5
});
const storage = settingsStorage.createSettingsStorage(
  {
    runtime: { id: "abcdefghijklmnop" },
    storage: { sync: {} }
  },
  MB
);
const storedSettings = storage.sanitizeSettingsForStorage({
  enabled: true,
  diagnosticsEnabled: true,
  siteRules: {
    abcdefghijklmnop: { enabled: false },
    "example.com": { enabled: false }
  }
});
assert.equal(storedSettings.diagnosticsEnabled, true);
assert.equal(Object.hasOwn(storedSettings.siteRules, "abcdefghijklmnop"), false);
assert.equal(Object.hasOwn(storedSettings.siteRules, "example.com"), true);

const defaultNetworkRules = networkRules.buildDynamicRules(defaults, { ruleIdStart: 1100 });
assert.equal(defaultNetworkRules.length, 1);
assert.equal(defaultNetworkRules[0].id, 1100);
assert.equal(defaultNetworkRules[0].condition.regexFilter, "\\.gifv(?:$|[?#])");
assert.equal(defaultNetworkRules[0].condition.resourceTypes.includes("media"), true);

const audioNetworkRules = networkRules.buildDynamicRules(MB.normalizeSettings({ features: { audio: true } }), { ruleIdStart: 1300 });
const audioRule = audioNetworkRules.find(function (rule) {
  return rule.condition.regexFilter && rule.condition.regexFilter.includes("mp3");
});
assert.equal(audioRule.condition.resourceTypes.includes("media"), true);
assert.equal(audioRule.condition.resourceTypes.includes("xmlhttprequest"), true);
assert.equal(audioRule.condition.resourceTypes.includes("other"), true);

const networkRulesWithOverrides = networkRules.buildDynamicRules(
  MB.normalizeSettings({
    enabled: true,
    features: {
      gifs: true,
      gifv: true,
      animatedWebp: false,
      autoplayVideo: true,
      video: false,
      audio: false,
      images: false,
      emoji: false,
      cssMotion: false
    },
    siteRules: {
      "blocked.example": {
        enabled: false
      },
      "off.example": {
        features: {
          gifv: false
        }
      },
      "video.example": {
        features: {
          video: true
        }
      },
      "bad_host.example/path": {
        features: {
          video: true
        }
      }
    }
  }),
  { ruleIdStart: 1200 }
);

assert.deepEqual(networkRulesWithOverrides[0].condition.excludedInitiatorDomains.sort(), ["blocked.example", "off.example"]);
assert.equal(
  networkRulesWithOverrides.some(function (rule) {
    return rule.condition.initiatorDomains && rule.condition.initiatorDomains.includes("video.example");
  }),
  true
);
assert.equal(
  networkRulesWithOverrides.some(function (rule) {
    return rule.condition.initiatorDomains && rule.condition.initiatorDomains.includes("bad_host.example/path");
  }),
  false
);

const temporaryAllowRules = networkRules.buildTemporaryAllowRules(
  ["https://example.com/a.mp4", "javascript:alert(1)", "file:///C:/tmp/a.mp4"],
  ["media", 7],
  { ruleIdStart: 910000, ruleIdEnd: 910001 }
);
assert.equal(temporaryAllowRules.length, 2);
assert.equal(temporaryAllowRules[0].id, 910000);
assert.equal(temporaryAllowRules[0].condition.resourceTypes[0], "media");
assert.deepEqual(networkRules.getRuleIdsInRange([{ id: 1 }, { id: 1100 }, { id: 1299 }, { id: 1300 }], 1100, 1299), [1100, 1299]);

const store = tabStats.createTabStatsStore(MB.FEATURE_KEYS, { now: function () { return 42; } });
assert.deepEqual(store.aggregate(7), {
  byFeature: Object.fromEntries(MB.FEATURE_KEYS.map(function (key) { return [key, 0]; })),
  total: 0,
  frames: 0
});

store.update(
  { byFeature: { gifs: 2.8, gifv: -1, video: "3" } },
  { tab: { id: 7, url: "https://example.com/page" }, frameId: 0, documentId: "main", url: "https://example.com/page" }
);
store.update(
  { byFeature: { gifs: 1, audio: 4 } },
  { tab: { id: 7, url: "https://example.com/page" }, frameId: 2, documentId: "child", url: "https://cdn.example/frame" }
);

const aggregateStats = store.aggregate(7);
assert.equal(aggregateStats.frames, 2);
assert.equal(aggregateStats.total, 10);
assert.equal(aggregateStats.byFeature.gifs, 3);
assert.equal(aggregateStats.byFeature.video, 3);
assert.equal(aggregateStats.byFeature.audio, 4);
assert.equal(aggregateStats.byFeature.gifv, 0);

store.update(
  { byFeature: { gifs: 9 } },
  { tab: { id: 7, url: "https://other.example/page" }, frameId: 0, documentId: "next", url: "https://other.example/page" }
);
assert.equal(store.aggregate(7).total, 9);
store.clearTab(7);
assert.equal(store.aggregate(7).total, 0);

const contentStatMessages = [];
const contentStats = contentBlockStats.createContentBlockStats({
  chrome: {
    runtime: {
      sendMessage(message) {
        contentStatMessages.push(message);
        return Promise.resolve();
      }
    }
  },
  dataKeys: {
    audioAdjusted: "motionblockAudioAdjusted",
    cssBackground: "motionblockCssBackground",
    cssBackgroundUrls: "motionblockCssBackgroundUrls",
    emojiAttributeStat: "motionblockEmojiAttributeCount",
    emojiElementStat: "motionblockEmojiElementCounted",
    emojiTextStat: "motionblockEmojiTextCount",
    mediaStat: "motionblockMediaStatFeature",
    mediaUncounted: "motionblockMediaUncounted"
  },
  emojiTextBlockCounts: new WeakMap(),
  emojiTextOriginals: new WeakMap(),
  featureKeys: ["gifs", "emoji"],
  frameHost: "frame.example",
  location: { href: "https://frame.example/page" },
  nodeTypes: {
    DOCUMENT_FRAGMENT_NODE: 11,
    ELEMENT_NODE: 1,
    TEXT_NODE: 3
  },
  settingsHost: "settings.example",
  updateDebounceMs: 1,
  window: {
    clearTimeout() {},
    setTimeout(callback) {
      callback();
      return 1;
    }
  }
});
const mediaStatElement = { dataset: {} };
contentStats.markMedia(mediaStatElement, "gifs");
assert.equal(contentStats.getSnapshot().total, 1);
assert.equal(contentStats.getSnapshot().byFeature.gifs, 1);
contentStats.unmarkMedia(mediaStatElement);
assert.equal(contentStats.getSnapshot().total, 0);
assert.equal(contentBlockStats.getImageStatFeature("WebP"), "animatedWebp");
assert.equal(contentBlockStats.getMediaStatFeature("looping video", { tagName: "VIDEO" }), "autoplayVideo");
assert.equal(contentStatMessages.some(function (message) {
  return message.type === "motionblock:statsUpdated";
}), true);
assert.equal(emojiBlocker.countEmojiMatches("Hello 😀 🚀"), 2);
assert.equal(emojiBlocker.stripEmoji("Go 🚀 now"), "Go  now");

const mediaEffectEvents = [];
const videoAttributes = {};
const videoElement = {
  attributes: videoAttributes,
  dataset: {},
  muted: false,
  tagName: "VIDEO",
  volume: 0.77,
  hasAttribute(name) {
    return Object.hasOwn(videoAttributes, name);
  },
  setAttribute(name, value) {
    videoAttributes[name] = String(value);
  }
};
const effects = mediaEffects.createMediaEffects({
  dataKeys: { audioAdjusted: "motionblockAudioAdjusted" },
  diagnostics: {
    recordMediaEffect(event, element, details) {
      mediaEffectEvents.push({ event, details, muted: element.muted, volume: element.volume });
    }
  },
  getEffectiveSettings() {
    return MB.normalizeSettings({ features: { audio: true } });
  },
  markMediaStat() {},
  restoreOriginalAttribute() {},
  restoreOriginalMediaProperty() {},
  storeOriginalAttribute() {},
  storeOriginalMediaProperty() {},
  unmarkMediaStat() {}
});
effects.blockVideoAudioElement(videoElement); assert.deepEqual([videoElement.muted, videoElement.volume], [true, 0]);
assert.equal(Object.hasOwn(videoAttributes, "muted"), true);
assert.equal(mediaEffectEvents.filter(function (entry) { return entry.event === "media.videoAudioMuted"; }).length, 1);
effects.blockVideoAudioElement(videoElement); assert.equal(mediaEffectEvents.filter(function (entry) { return entry.event === "media.videoAudioMuted"; }).length, 1);
videoElement.muted = false; videoElement.volume = 0.5;
effects.blockVideoAudioElement(videoElement);
assert.deepEqual([videoElement.muted, videoElement.volume], [true, 0]);
assert.equal(mediaEffectEvents.filter(function (entry) { return entry.event === "media.videoAudioMuted"; }).length, 2);

const routerCalls = [];
const router = messageRouter.createMessageRouter({
  addTemporaryAllowRules: async function (urls, resourceTypes) {
    routerCalls.push(["allowUrlsOnce", urls, resourceTypes]);
  },
  config: MB,
  rebuildDynamicRules: async function (settings) {
    routerCalls.push(["rebuildRules", settings || null]);
  },
  settingsStorage: {
    async getStoredSettings() {
      return MB.normalizeSettings({
        siteRules: {
          "old.example": { enabled: false }
        }
      });
    },
    sanitizeSettingsForStorage(value) {
      return MB.normalizeSettings(value);
    },
    async saveSettings(value) {
      routerCalls.push(["saveSettings", value]);
    }
  },
  t: function (key, fallback) {
    return fallback;
  },
  tabStats: {
    aggregate(tabId) {
      routerCalls.push(["aggregate", tabId]);
      return { byFeature: {}, frames: 1, total: 2 };
    },
    update(stats, sender) {
      routerCalls.push(["statsUpdated", stats, sender]);
    }
  }
});

Promise.resolve()
  .then(async function () {
    assert.deepEqual(await router(null, {}), { ok: false, error: "Missing message type." });
    assert.deepEqual(await router({ type: "motionblock:statsUpdated", stats: { total: 1 } }, { tab: { id: 5 } }), { ok: true });
    assert.deepEqual(await router({ type: "motionblock:getTabStats", tabId: "5" }, {}), {
      ok: true,
      stats: { byFeature: {}, frames: 1, total: 2 }
    });

    const updateResponse = await router(
      {
        type: "motionblock:updateSiteRule",
        host: "New.Example",
        rule: { enabled: true, features: { gifv: true } }
      },
      {}
    );
    assert.equal(updateResponse.ok, true);
    assert.equal(updateResponse.host, "new.example");
    assert.equal(updateResponse.settings.siteRules["new.example"].enabled, true);
    assert.equal(updateResponse.effective.host, "new.example");

    assert.deepEqual(await router({ type: "motionblock:allowUrlsOnce", urls: ["https://example.com/a.mp4"], resourceTypes: ["media"] }, {}), {
      ok: true
    });
    assert.equal(
      routerCalls.some(function (call) {
        return call[0] === "saveSettings";
      }),
      true
    );
    assert.equal(
      routerCalls.some(function (call) {
        return call[0] === "allowUrlsOnce";
      }),
      true
    );
  })
  .then(function () {
    console.log("settings sanity ok");
  })
  .catch(function (error) {
    console.error(error);
    process.exitCode = 1;
  });
