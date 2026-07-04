(function (root) {
  "use strict";

  const PROBE_SOURCE = "MotionBlockAudioProbe";
  const CONTENT_SOURCE = "MotionBlockContent";
  const AUDIO_URL_PATTERN = /\.(?:mp3|m4a|aac|ogg|oga|wav|flac)(?:$|[?#])/i;

  function installPageAudioProbe(window) {
    if (!window || window.__motionBlockAudioProbeInstalled) {
      return;
    }

    window.__motionBlockAudioProbeInstalled = true;

    const policy = {
      audioBlocked: false,
      diagnosticsEnabled: false
    };
    const contexts = new Set();
    const mediaAudioGuard = createMediaAudioGuard(post, summarizeMediaElement, muteMediaElement);

    window.addEventListener("message", function (event) {
      const message = event && event.data;
      if (event.source !== window || !message || message.source !== CONTENT_SOURCE || message.type !== "motionblock:audioPolicy") {
        return;
      }

      policy.audioBlocked = Boolean(message.audioBlocked);
      policy.diagnosticsEnabled = Boolean(message.diagnosticsEnabled);
      post("policyApplied", { audioBlocked: policy.audioBlocked, diagnosticsEnabled: policy.diagnosticsEnabled });

      if (policy.audioBlocked) {
        mediaAudioGuard.enforceAll(window, policy, "policy");
        contexts.forEach(function (context) {
          suspendContext(context, "policy");
        });
      }
    });

    patchAudioContextConstructor(window, "AudioContext", policy, contexts);
    patchAudioContextConstructor(window, "webkitAudioContext", policy, contexts);
    patchDecodeAudioData(window, policy);
    patchAudioScheduledSourceStart(window, policy);
    patchAudioNodeConnect(window, policy);
    patchHtmlMediaPlay(window, policy);
    mediaAudioGuard.patch(window, policy);
    patchAudioConstructor(window, policy);
    patchFetch(window, policy);
    patchXmlHttpRequest(window, policy);

    function post(kind, details) {
      if (!policy.diagnosticsEnabled) {
        return;
      }

      window.postMessage(
        {
          source: PROBE_SOURCE,
          type: "motionblock:pageAudioEvent",
          kind,
          details: sanitizeDetails(details || {})
        },
        "*"
      );
    }

    function suspendContext(context, reason) {
      if (!context || typeof context.suspend !== "function") {
        return;
      }

      try {
        const result = context.suspend();
        post("webAudio.contextSuspended", {
          reason,
          state: context.state || ""
        });
        if (result && typeof result.catch === "function") {
          result.catch(function () {});
        }
      } catch (error) {
        post("webAudio.contextSuspendFailed", { error: getErrorName(error), reason });
      }
    }

    window.__motionBlockMediaAudioGuard = mediaAudioGuard;
    window.__motionBlockPostAudioEvent = post;
    window.__motionBlockSuspendAudioContext = suspendContext;
  }

  function createMediaAudioGuard(post, summarizeMediaElement, muteMediaElement) {
    const factory = root.MotionBlockMediaAudioGuard && root.MotionBlockMediaAudioGuard.createMediaAudioGuard;
    if (typeof factory === "function") {
      return factory({ muteMediaElement, post, summarizeMediaElement });
    }
    return { enforce(window, element, policy) { if (policy.audioBlocked) { muteMediaElement(element); } }, enforceAll() {}, patch() {} };
  }

  function patchAudioContextConstructor(window, constructorName, policy, contexts) {
    const OriginalContext = window[constructorName];
    if (typeof OriginalContext !== "function" || OriginalContext.__motionBlockWrapped) {
      return;
    }

    const originalResume = OriginalContext.prototype && OriginalContext.prototype.resume;
    const originalCreateBufferSource = OriginalContext.prototype && OriginalContext.prototype.createBufferSource;

    function WrappedAudioContext() {
      const context = Reflect.construct(OriginalContext, arguments, new.target || WrappedAudioContext);
      trackContext(window, context, constructorName, policy, contexts);
      return context;
    }

    WrappedAudioContext.prototype = OriginalContext.prototype;
    Object.setPrototypeOf(WrappedAudioContext, OriginalContext);
    WrappedAudioContext.__motionBlockWrapped = true;
    window[constructorName] = WrappedAudioContext;

    if (typeof originalResume === "function" && !originalResume.__motionBlockWrapped) {
      OriginalContext.prototype.resume = function () {
        trackContext(window, this, constructorName, policy, contexts);
        if (policy.audioBlocked) {
          window.__motionBlockPostAudioEvent("webAudio.resumeBlocked", { context: constructorName, state: this.state || "" });
          window.__motionBlockSuspendAudioContext(this, "resume");
          return Promise.resolve();
        }
        return originalResume.apply(this, arguments);
      };
      OriginalContext.prototype.resume.__motionBlockWrapped = true;
    }

    if (typeof originalCreateBufferSource === "function" && !originalCreateBufferSource.__motionBlockWrapped) {
      OriginalContext.prototype.createBufferSource = function () {
        const node = originalCreateBufferSource.apply(this, arguments);
        patchSourceNodeStart(window, node, policy, "AudioBufferSourceNode");
        return node;
      };
      OriginalContext.prototype.createBufferSource.__motionBlockWrapped = true;
    }
  }

  function trackContext(window, context, constructorName, policy, contexts) {
    if (!context || contexts.has(context)) {
      return;
    }

    contexts.add(context);
    window.__motionBlockPostAudioEvent("webAudio.contextCreated", { context: constructorName, state: context.state || "" });
    if (policy.audioBlocked) {
      window.__motionBlockSuspendAudioContext(context, "constructor");
    }
  }

  function patchDecodeAudioData(window, policy) {
    [window.BaseAudioContext && window.BaseAudioContext.prototype, window.AudioContext && window.AudioContext.prototype, window.webkitAudioContext && window.webkitAudioContext.prototype]
      .filter(Boolean)
      .forEach(function (prototype) {
        const originalDecode = prototype.decodeAudioData;
        if (typeof originalDecode !== "function" || originalDecode.__motionBlockWrapped) {
          return;
        }

        prototype.decodeAudioData = function (buffer, successCallback, errorCallback) {
          if (policy.audioBlocked) {
            const error = createAbortError(window);
            window.__motionBlockPostAudioEvent("webAudio.decodeBlocked", { byteLength: buffer && buffer.byteLength ? buffer.byteLength : 0 });
            if (typeof errorCallback === "function") {
              setTimeout(function () { errorCallback(error); }, 0);
            }
            return Promise.reject(error);
          }
          return originalDecode.apply(this, arguments);
        };
        prototype.decodeAudioData.__motionBlockWrapped = true;
      });
  }

  function patchAudioScheduledSourceStart(window, policy) {
    const prototype = window.AudioScheduledSourceNode && window.AudioScheduledSourceNode.prototype;
    const originalStart = prototype && prototype.start;
    if (typeof originalStart !== "function" || originalStart.__motionBlockWrapped) {
      return;
    }

    prototype.start = function () {
      if (policy.audioBlocked) {
        window.__motionBlockPostAudioEvent("webAudio.sourceStartBlocked", { node: getConstructorName(this) });
        return undefined;
      }
      return originalStart.apply(this, arguments);
    };
    prototype.start.__motionBlockWrapped = true;
  }

  function patchSourceNodeStart(window, node, policy, nodeName) {
    if (!node || typeof node.start !== "function" || node.start.__motionBlockWrapped) {
      return;
    }

    const originalStart = node.start;
    node.start = function () {
      if (policy.audioBlocked) {
        window.__motionBlockPostAudioEvent("webAudio.sourceStartBlocked", { node: nodeName || getConstructorName(node) });
        return undefined;
      }
      return originalStart.apply(this, arguments);
    };
    node.start.__motionBlockWrapped = true;
  }

  function patchAudioNodeConnect(window, policy) {
    const prototype = window.AudioNode && window.AudioNode.prototype;
    const originalConnect = prototype && prototype.connect;
    if (typeof originalConnect !== "function" || originalConnect.__motionBlockWrapped) {
      return;
    }

    prototype.connect = function (destination) {
      if (policy.audioBlocked && isAudioDestination(destination)) {
        window.__motionBlockPostAudioEvent("webAudio.destinationConnectBlocked", { node: getConstructorName(this) });
        return destination;
      }
      return originalConnect.apply(this, arguments);
    };
    prototype.connect.__motionBlockWrapped = true;
  }

  function patchHtmlMediaPlay(window, policy) {
    const prototype = window.HTMLMediaElement && window.HTMLMediaElement.prototype;
    const originalPlay = prototype && prototype.play;
    if (typeof originalPlay !== "function" || originalPlay.__motionBlockWrapped) {
      return;
    }

    prototype.play = function () {
      const tag = String(this.tagName || "").toLowerCase();
      if (tag === "audio" || tag === "video") {
        window.__motionBlockPostAudioEvent("media.playCalled", summarizeMediaElement(this));
      }
      if (policy.audioBlocked && tag === "audio") {
        window.__motionBlockMediaAudioGuard.enforce(window, this, policy, "play");
        try { this.pause(); } catch (error) {}
        window.__motionBlockPostAudioEvent("media.audioPlayBlocked", summarizeMediaElement(this));
        return Promise.resolve();
      }
      if (policy.audioBlocked && tag === "video") {
        window.__motionBlockMediaAudioGuard.enforce(window, this, policy, "play");
      }
      return originalPlay.apply(this, arguments);
    };
    prototype.play.__motionBlockWrapped = true;
  }

  function patchAudioConstructor(window, policy) {
    const OriginalAudio = window.Audio;
    if (typeof OriginalAudio !== "function" || OriginalAudio.__motionBlockWrapped) {
      return;
    }

    function WrappedAudio(src) {
      const audio = new OriginalAudio(src);
      window.__motionBlockPostAudioEvent("media.audioConstructed", summarizeMediaElement(audio));
      if (policy.audioBlocked) {
        window.__motionBlockMediaAudioGuard.enforce(window, audio, policy, "constructor");
      }
      return audio;
    }

    WrappedAudio.prototype = OriginalAudio.prototype;
    Object.setPrototypeOf(WrappedAudio, OriginalAudio);
    WrappedAudio.__motionBlockWrapped = true;
    window.Audio = WrappedAudio;
  }

  function patchFetch(window, policy) {
    const originalFetch = window.fetch;
    if (typeof originalFetch !== "function" || originalFetch.__motionBlockWrapped) {
      return;
    }

    window.fetch = function (input) {
      const url = getFetchUrl(input);
      if (isAudioLikeUrl(url)) {
        window.__motionBlockPostAudioEvent(policy.audioBlocked ? "network.fetchAudioBlocked" : "network.fetchAudioObserved", { url: summarizeUrl(url) });
        if (policy.audioBlocked) {
          return Promise.reject(createAbortError(window));
        }
      }
      return originalFetch.apply(this, arguments);
    };
    window.fetch.__motionBlockWrapped = true;
  }

  function patchXmlHttpRequest(window, policy) {
    const prototype = window.XMLHttpRequest && window.XMLHttpRequest.prototype;
    if (!prototype || prototype.__motionBlockWrapped) {
      return;
    }

    const originalOpen = prototype.open;
    const originalSend = prototype.send;
    prototype.open = function (method, url) {
      this.__motionBlockAudioUrl = String(url || "");
      return originalOpen.apply(this, arguments);
    };
    prototype.send = function () {
      if (isAudioLikeUrl(this.__motionBlockAudioUrl)) {
        window.__motionBlockPostAudioEvent(policy.audioBlocked ? "network.xhrAudioBlocked" : "network.xhrAudioObserved", {
          url: summarizeUrl(this.__motionBlockAudioUrl)
        });
        if (policy.audioBlocked) {
          try { this.abort(); } catch (error) {}
          return undefined;
        }
      }
      return originalSend.apply(this, arguments);
    };
    prototype.__motionBlockWrapped = true;
  }

  function muteMediaElement(element) {
    try { element.muted = true; } catch (error) {}
    try { element.volume = 0; } catch (error) {}
    try { element.setAttribute("muted", ""); } catch (error) {}
  }

  function summarizeMediaElement(element) {
    return {
      currentSrc: summarizeUrl(element && (element.currentSrc || element.src || element.getAttribute && element.getAttribute("src"))),
      muted: Boolean(element && element.muted),
      paused: Boolean(element && element.paused),
      tag: String((element && element.tagName) || "audio").toLowerCase(),
      volume: Number(element && element.volume) || 0
    };
  }

  function getFetchUrl(input) {
    if (typeof input === "string") {
      return input;
    }
    return input && input.url ? String(input.url) : "";
  }

  function isAudioLikeUrl(value) {
    return AUDIO_URL_PATTERN.test(String(value || ""));
  }

  function summarizeUrl(value) {
    const raw = String(value || "");
    if (!raw) {
      return null;
    }
    try {
      const parsed = new URL(raw, root.location && root.location.href);
      return {
        extension: getPathExtension(parsed.pathname),
        host: parsed.hostname,
        pathLength: parsed.pathname.length,
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

  function sanitizeDetails(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function getPathExtension(pathname) {
    const match = String(pathname || "").match(/\.([a-z0-9]{2,8})(?:$|[?#])/i);
    return match ? match[1].toLowerCase() : "";
  }

  function isAudioDestination(destination) {
    return /AudioDestinationNode/.test(getConstructorName(destination));
  }

  function getConstructorName(value) {
    return value && value.constructor && value.constructor.name ? value.constructor.name : "";
  }

  function createAbortError(window) {
    try {
      return new window.DOMException("Blocked by MotionBlock", "AbortError");
    } catch (error) {
      const fallback = new Error("Blocked by MotionBlock");
      fallback.name = "AbortError";
      return fallback;
    }
  }

  function getErrorName(error) {
    return error && error.name ? error.name : "Error";
  }

  root.MotionBlockAudioProbe = {
    installPageAudioProbe,
    isAudioLikeUrl,
    summarizeUrl
  };

  if (root.window === root) {
    installPageAudioProbe(root);
  }
})(globalThis);
