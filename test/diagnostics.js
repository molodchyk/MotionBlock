const assert = require("node:assert/strict");

require("../src/shared/config.js");
require("../src/features/diagnostics/shared/url-sanitizer.js");
require("../src/features/diagnostics/background/diagnostics-store.js");
require("../src/features/diagnostics/content/diagnostics.js");
require("../src/features/diagnostics/page/media-audio-guard.js");
require("../src/features/diagnostics/page/audio-probe.js");
require("../src/app/background/message-router.js");
require("../src/app/popup/diagnostics-analysis.js");
require("../src/app/popup/view.js");

const MB = globalThis.MotionBlock;
const diagnosticsStore = globalThis.MotionBlockDiagnosticsStore;
const contentDiagnosticsFactory = globalThis.MotionBlockContentDiagnostics;
const audioProbe = globalThis.MotionBlockAudioProbe;
const messageRouter = globalThis.MotionBlockMessageRouter;
const popupView = globalThis.MotionBlockPopupView;

const diagnosticStore = diagnosticsStore.createDiagnosticsStore({ now: function () { return 1000; } });
diagnosticStore.update(
  {
    enabled: true,
    entries: [
      {
        details: { pageUrl: "https://example.com/page" },
        event: "settings.applied",
        sequence: 1,
        time: "1970-01-01T00:00:01.000Z"
      }
    ],
    frameHost: "frame.example",
    settingsHost: "example.com",
    url: "https://example.com/page?token=secret#hash"
  },
  { tab: { id: 8, url: "https://example.com/page" }, frameId: 0, documentId: "main", url: "https://example.com/page?token=secret" }
);
const diagnosticAggregate = diagnosticStore.aggregate(8);
assert.equal(diagnosticAggregate.entries.length, 1);
assert.equal(diagnosticAggregate.entries[0].url, "https://example.com/page");
assert.equal(diagnosticAggregate.entries[0].frameHost, "frame.example");
diagnosticStore.update({ enabled: false }, { tab: { id: 8, url: "https://example.com/page" }, frameId: 0, documentId: "main" });
assert.equal(diagnosticStore.aggregate(8).entries.length, 0);

const routerCalls = [];
const router = messageRouter.createMessageRouter({
  addTemporaryAllowRules: async function () {},
  config: MB,
  diagnostics: {
    aggregate(tabId) {
      routerCalls.push(["diagnosticsAggregate", tabId]);
      return { entries: [], frames: [], tabId };
    },
    update(report, sender) {
      routerCalls.push(["diagnosticsUpdated", report, sender]);
    }
  },
  rebuildDynamicRules: async function () {},
  settingsStorage: {
    async getStoredSettings() {
      return MB.normalizeSettings({});
    },
    sanitizeSettingsForStorage(value) {
      return MB.normalizeSettings(value);
    },
    async saveSettings() {}
  },
  t: function (key, fallback) {
    return fallback;
  },
  tabStats: {
    aggregate() {
      return { byFeature: {}, frames: 0, total: 0 };
    },
    update() {}
  }
});

Promise.resolve()
  .then(async function () {
    assert.deepEqual(await router({ type: "motionblock:diagnosticsUpdated", diagnostics: { enabled: true } }, { tab: { id: 5 } }), {
      ok: true
    });
    assert.deepEqual(await router({ type: "motionblock:getDiagnostics", tabId: "5" }, {}), {
      diagnostics: { entries: [], frames: [], tabId: 5 },
      ok: true
    });

    const diagnosticsLog = JSON.parse(
      popupView.formatDiagnosticsLog({
        diagnostics: {
          entries: [
            { event: "scan.media", details: { audioElements: 0, totalElements: 1, videoElements: 1 }, frameHost: "example.com", time: "t1" },
            { event: "media.videoAudioMuted", details: { feature: "audio", properties: { muted: true, paused: false, readyState: 4, volume: 0.77 }, tag: "video" }, frameHost: "example.com", time: "t2" },
            { event: "image.nativeBlocked", details: { reason: "GIF", tag: "img" }, frameHost: "example.com", time: "t3" }
          ],
          frames: [],
          tabId: 3
        },
        effective: {
          diagnosticsEnabled: true,
          enabled: true,
          features: { audio: true, gifs: true, images: true }
        },
        host: "example.com",
        tabStats: { byFeature: { audio: 1, gifs: 1, images: 1 }, total: 3 }
      })
    );
    assert.equal(diagnosticsLog.analysis.featureMatrix.audio.evidenceEvents.includes("media.videoAudioMuted"), true);
    assert.equal(diagnosticsLog.analysis.featureMatrix.images.evidenceEvents.includes("image.nativeBlocked"), true);
    assert.equal(diagnosticsLog.analysis.implementation.maxNativeVideoElementsSeen, 1);
    assert.equal(diagnosticsLog.analysis.howToRead.length > 0, true);
    assert.equal(diagnosticsLog.analysis.recentSignificantEvents.length, 2);

    const diagnosticMessages = [];
    const contentDiagnostics = contentDiagnosticsFactory.createContentDiagnostics({
      chrome: {
        runtime: {
          sendMessage(message) {
            diagnosticMessages.push(message);
            return Promise.resolve();
          }
        }
      },
      document: { readyState: "complete" },
      frameHost: "frame.example",
      location: { href: "https://example.com/page?token=secret#hash" },
      now: function () {
        return 1000;
      },
      settingsHost: "example.com",
      window: {
        clearTimeout() {},
        setTimeout(callback) {
          callback();
          return 1;
        }
      }
    });

    await contentDiagnostics.setEnabled(true, { settingsHost: "example.com" });
    await contentDiagnostics.recordSettingsApplied({
      diagnosticsEnabled: true,
      enabled: true,
      features: { audio: true },
      replacementMode: "placeholder",
      showRevealControls: false,
      siteRule: { enabled: null, features: { audio: true }, replacementMode: "" }
    });
    await contentDiagnostics.flush();

    assert.equal(diagnosticMessages.at(-1).type, "motionblock:diagnosticsUpdated");
    assert.equal(diagnosticMessages.at(-1).diagnostics.url, "https://example.com/page");
    assert.equal(diagnosticMessages.at(-1).diagnostics.entries.some(function (entry) {
      return entry.event === "settings.applied";
    }), true);

    const probeMessages = [];
    const listeners = {};
    function FakeAudioContext() {
      this.state = "running";
      this.destination = { constructor: { name: "AudioDestinationNode" } };
    }
    FakeAudioContext.prototype.resume = function () {
      this.state = "running";
      return Promise.resolve();
    };
    FakeAudioContext.prototype.suspend = function () {
      this.state = "suspended";
      return Promise.resolve();
    };
    FakeAudioContext.prototype.decodeAudioData = function () {
      return Promise.resolve({});
    };
    FakeAudioContext.prototype.createBufferSource = function () {
      return {
        constructor: { name: "AudioBufferSourceNode" },
        start() {
          return "started";
        }
      };
    };

    function FakeMediaElement(tagName) {
      this.attributes = {};
      this.currentSrc = "https://cdn.example/video.mp4";
      this.paused = true;
      this.src = "";
      this.tagName = tagName;
      this._muted = false;
      this._volume = 0.8;
    }
    FakeMediaElement.prototype.getAttribute = function (name) {
      return Object.hasOwn(this.attributes, name) ? this.attributes[name] : null;
    };
    FakeMediaElement.prototype.pause = function () {
      this.paused = true;
    };
    FakeMediaElement.prototype.play = function () {
      this.paused = false;
      return Promise.resolve("played");
    };
    FakeMediaElement.prototype.setAttribute = function (name, value) {
      this.attributes[name] = String(value);
    };
    Object.defineProperty(FakeMediaElement.prototype, "muted", {
      configurable: true,
      get() {
        return this._muted;
      },
      set(value) {
        this._muted = Boolean(value);
      }
    });
    Object.defineProperty(FakeMediaElement.prototype, "volume", {
      configurable: true,
      get() {
        return this._volume;
      },
      set(value) {
        this._volume = Number(value);
      }
    });

    const fakeWindow = {
      AudioContext: FakeAudioContext,
      BaseAudioContext: FakeAudioContext,
      DOMException,
      HTMLMediaElement: FakeMediaElement,
      XMLHttpRequest: function () {},
      addEventListener(type, callback) {
        listeners[type] = callback;
      },
      document: {
        querySelectorAll() {
          return [];
        }
      },
      fetch() {
        return Promise.resolve("ok");
      },
      location: { href: "https://example.com/page" },
      postMessage(message) {
        probeMessages.push(message);
      }
    };
    fakeWindow.window = fakeWindow;
    fakeWindow.XMLHttpRequest.prototype.open = function (method, url) {
      this.url = url;
    };
    fakeWindow.XMLHttpRequest.prototype.send = function () {
      this.sent = true;
    };
    fakeWindow.XMLHttpRequest.prototype.abort = function () {
      this.aborted = true;
    };

    audioProbe.installPageAudioProbe(fakeWindow);
    listeners.message({
      source: fakeWindow,
      data: {
        source: "MotionBlockContent",
        type: "motionblock:audioPolicy",
        audioBlocked: true,
        diagnosticsEnabled: true
      }
    });

    const context = new fakeWindow.AudioContext();
    await context.resume();
    assert.equal(context.state, "suspended");
    await assert.rejects(function () {
      return fakeWindow.fetch("https://cdn.example/sound.wav?cache=1");
    }, /Blocked by MotionBlock/);
    await assert.rejects(function () {
      return context.decodeAudioData(new ArrayBuffer(4));
    }, /Blocked by MotionBlock/);
    assert.equal(
      probeMessages.some(function (message) {
        return message.kind === "webAudio.resumeBlocked";
      }),
      true
    );
    assert.equal(
      probeMessages.some(function (message) {
        return message.kind === "network.fetchAudioBlocked";
      }),
      true
    );

    const video = new FakeMediaElement("VIDEO");
    assert.equal(await video.play(), "played");
    assert.equal(video.muted, true);
    assert.equal(video.volume, 0);
    assert.equal(video.paused, false);
    assert.equal(
      probeMessages.some(function (message) {
        return message.kind === "media.videoMutedBeforePlay";
      }),
      false
    );
    assert.equal(
      probeMessages.some(function (message) {
        return message.kind === "media.videoAudioEnforced";
      }),
      true
    );
    video.muted = false;
    video.volume = 0.8;
    assert.equal(video.muted, true);
    assert.equal(video.volume, 0);
    assert.equal(
      probeMessages.some(function (message) {
        return message.kind === "media.videoUnmuteBlocked";
      }),
      true
    );
    assert.equal(
      probeMessages.some(function (message) {
        return message.kind === "media.videoVolumeBlocked";
      }),
      true
    );

    const audio = new FakeMediaElement("AUDIO");
    await audio.play();
    assert.equal(audio.muted, true);
    assert.equal(audio.volume, 0);
    assert.equal(audio.paused, true);
    assert.equal(
      probeMessages.some(function (message) {
        return message.kind === "media.audioPlayBlocked";
      }),
      true
    );
  })
  .then(function () {
    console.log("diagnostics sanity ok");
  })
  .catch(function (error) {
    console.error(error);
    process.exitCode = 1;
  });
