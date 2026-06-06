const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

require("../src/shared/config.js");

const MB = globalThis.MotionBlock;

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

const defaults = MB.normalizeSettings({});
assert.equal(defaults.enabled, true);
assert.equal(defaults.uiTheme, "system");
assert.equal(defaults.showRevealControls, false);
assert.equal(defaults.features.gifs, true);
assert.equal(defaults.features.gifv, true);
assert.equal(defaults.features.animatedWebp, false);
assert.equal(defaults.features.images, false);

const settings = MB.normalizeSettings({
  enabled: true,
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
assert.equal(settings.showRevealControls, true);

const backup = MB.createSettingsBackup(settings);
assert.equal(backup.app, "MotionBlock");
assert.equal(backup.schemaVersion, 1);
assert.equal(MB.normalizeSettingsBackupPayload(backup).uiTheme, "dark");
assert.equal(MB.normalizeSettingsBackupPayload(settings).showRevealControls, true);
assert.throws(function () {
  MB.normalizeSettingsBackupPayload({ app: "Other" });
}, /MotionBlock settings backup/);

assert.equal(Object.hasOwn(settings.siteRules, "reddit.com"), true);
assert.equal(Object.hasOwn(settings.siteRules, "www.reddit.com"), false);
assert.equal(Object.hasOwn(settings.siteRules, "empty.example"), false);

const reddit = MB.getEffectiveSettings(settings, "reddit.com");
assert.equal(reddit.enabled, true);
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

console.log("settings sanity ok");
