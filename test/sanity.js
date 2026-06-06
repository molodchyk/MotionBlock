const assert = require("node:assert/strict");

require("../src/shared/config.js");

const MB = globalThis.MotionBlock;

assert.equal(MB.normalizeHostname("https://www.Reddit.com/r/test"), "reddit.com");
assert.equal(MB.normalizeHostname("example.com:443"), "example.com");

const defaults = MB.normalizeSettings({});
assert.equal(defaults.enabled, true);
assert.equal(defaults.uiTheme, "system");
assert.equal(defaults.features.gifs, true);
assert.equal(defaults.features.gifv, true);
assert.equal(defaults.features.animatedWebp, false);
assert.equal(defaults.features.images, false);

const settings = MB.normalizeSettings({
  enabled: true,
  uiTheme: "dark",
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

console.log("settings sanity ok");
