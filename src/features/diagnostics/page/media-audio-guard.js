(function (root) {
  "use strict";

  function createMediaAudioGuard(options) {
    const muteMediaElement = options.muteMediaElement;
    const post = options.post;
    const summarizeMediaElement = options.summarizeMediaElement;

    function patch(window, policy) {
      const prototype = window.HTMLMediaElement && window.HTMLMediaElement.prototype;
      if (!prototype || prototype.__motionBlockAudioPropertyWrapped) {
        return;
      }

      ["muted", "volume"].forEach(function (property) {
        const descriptor = Object.getOwnPropertyDescriptor(prototype, property);
        if (!descriptor || typeof descriptor.get !== "function" || typeof descriptor.set !== "function") {
          return;
        }

        Object.defineProperty(prototype, property, {
          configurable: true,
          enumerable: descriptor.enumerable,
          get: function () { return descriptor.get.call(this); },
          set: function (value) {
            if (policy.audioBlocked && isMediaAudioTarget(this)) {
              if (property === "muted" && !Boolean(value)) {
                descriptor.set.call(this, true);
                setMutedAttribute(this);
                post("media." + getMediaTagName(this) + "UnmuteBlocked", summarizeMediaElement(this));
                return;
              }
              if (property === "volume" && Number(value) > 0) {
                descriptor.set.call(this, 0);
                post("media." + getMediaTagName(this) + "VolumeBlocked", summarizeMediaElement(this));
                return;
              }
            }
            descriptor.set.call(this, value);
          }
        });
      });
      prototype.__motionBlockAudioPropertyWrapped = true;
    }

    function enforce(window, element, policy, reason) {
      if (!policy.audioBlocked || !isMediaAudioTarget(element)) {
        return;
      }
      const wasAudible = !readMuted(element) || readVolume(element) > 0;
      muteMediaElement(element);
      if (wasAudible) {
        post("media." + getMediaTagName(element) + "AudioEnforced", Object.assign({ reason }, summarizeMediaElement(element)));
      }
    }

    function enforceAll(window, policy, reason) {
      const document = window.document;
      if (!document || typeof document.querySelectorAll !== "function") {
        return;
      }
      try {
        Array.prototype.forEach.call(document.querySelectorAll("audio,video"), function (element) {
          enforce(window, element, policy, reason);
        });
      } catch (error) {}
    }

    return { enforce, enforceAll, patch };
  }

  function isMediaAudioTarget(element) {
    const tag = getMediaTagName(element);
    return tag === "audio" || tag === "video";
  }

  function getMediaTagName(element) {
    return String((element && element.tagName) || "").toLowerCase();
  }

  function readMuted(element) {
    try { return Boolean(element && element.muted); } catch (error) { return false; }
  }

  function readVolume(element) {
    try { return Number(element && element.volume) || 0; } catch (error) { return 0; }
  }

  function setMutedAttribute(element) {
    try {
      if (element && typeof element.setAttribute === "function") {
        element.setAttribute("muted", "");
      }
    } catch (error) {}
  }

  root.MotionBlockMediaAudioGuard = {
    createMediaAudioGuard
  };
})(globalThis);
