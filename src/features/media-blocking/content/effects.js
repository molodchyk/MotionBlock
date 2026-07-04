(function (root) {
  "use strict";

  function createMediaEffects(options) {
    const applyContainerPlaceholder = options.applyContainerPlaceholder;
    const collectCssBackgroundUrls = options.collectCssBackgroundUrls;
    const collectElementUrls = options.collectElementUrls;
    const dataKeys = options.dataKeys;
    const diagnostics = options.diagnostics;
    const getEffectiveSettings = options.getEffectiveSettings;
    const getImageStatFeature = options.getImageStatFeature;
    const getMediaStatFeature = options.getMediaStatFeature;
    const getReasonLabel = options.getReasonLabel;
    const isLikelyHiddenAccessibilityImage = options.isLikelyHiddenAccessibilityImage;
    const lockDisplayedSize = options.lockDisplayedSize;
    const markMediaStat = options.markMediaStat;
    const processMedia = options.processMedia;
    const rememberCssBackgroundUrls = options.rememberCssBackgroundUrls;
    const removeRevealButton = options.removeRevealButton;
    const restoreOriginalAttribute = options.restoreOriginalAttribute;
    const restoreOriginalMediaProperty = options.restoreOriginalMediaProperty;
    const storeOriginalAttribute = options.storeOriginalAttribute;
    const storeOriginalMediaProperty = options.storeOriginalMediaProperty;
    const storeOriginalMediaRuntimeProperty = options.storeOriginalMediaRuntimeProperty;
    const storeOriginalMediaRuntimeState = options.storeOriginalMediaRuntimeState;
    const storeOriginalMediaState = options.storeOriginalMediaState;
    const storeOriginalStyleProperty = options.storeOriginalStyleProperty;
    const t = options.t;
    const unmarkMediaStat = options.unmarkMediaStat;
    const window = options.window;

    function blockImageElement(element, reason) {
      if (element.dataset.motionblockBlocked === "true") {
        if (element.dataset[dataKeys.mediaUncounted] !== "true") {
          markMediaStat(element, getImageStatFeature(reason || element.dataset.motionblockReason));
          options.ensureRevealOverlay(element, t("contentShowBlockedImage", "Show blocked image"));
          refreshImagePlaceholder(element);
        } else {
          removeRevealButton(element);
        }
        return;
      }

      const hiddenAccessibilityImage = isLikelyHiddenAccessibilityImage(element);

      storeOriginalAttribute(element, "alt");
      storeOriginalAttribute(element, "src");
      storeOriginalAttribute(element, "srcset");
      storeOriginalAttribute(element, "sizes");
      storeOriginalAttribute(element, "title");

      element.dataset.motionblockBlocked = "true";
      element.dataset.motionblockFeature = "image";
      element.dataset.motionblockReason = reason;
      if (hiddenAccessibilityImage) {
        element.dataset[dataKeys.mediaUncounted] = "true";
      } else {
        markMediaStat(element, getImageStatFeature(reason));
      }
      element.title = element.title || t("contentBlockedByTitle", [getReasonLabel(reason)], "Blocked by MotionBlock: $REASON$");
      clearPendingImageBlock(element);
      recordMediaEffect("image.nativeBlocked", element, { hiddenAccessibilityImage, reason });

      if (element.tagName.toLowerCase() === "source") {
        element.removeAttribute("srcset");
        return;
      }

      if (hiddenAccessibilityImage || getEffectiveSettings().replacementMode === "hide") {
        element.classList.add("motionblock-media-hidden");
      } else {
        const placeholderSize = lockDisplayedSize(element, reason);
        element.classList.add("motionblock-media-placeholder");
        applyContainerPlaceholder(element, placeholderSize);
      }

      element.removeAttribute("srcset");
      element.removeAttribute("sizes");
      element.setAttribute("src", options.placeholderSrc);
      element.setAttribute("alt", t("contentBlockedAlt", [getReasonLabel(reason)], "Blocked $REASON$"));
      if (!hiddenAccessibilityImage) {
        options.ensureRevealOverlay(element, t("contentShowBlockedImage", "Show blocked image"));
      }
    }

    function blockCssBackgroundElement(element, reason) {
      if (element.dataset.motionblockBlocked === "true") {
        if (element.dataset[dataKeys.cssBackground] === "true") {
          rememberCssBackgroundUrls(element, collectCssBackgroundUrls(element));
          markMediaStat(element, getImageStatFeature(reason || element.dataset.motionblockReason));
          return;
        }

        return;
      }

      storeOriginalStyleProperty(element, "backgroundImage");

      element.dataset.motionblockBlocked = "true";
      element.dataset.motionblockFeature = "image";
      element.dataset.motionblockReason = reason;
      element.dataset[dataKeys.cssBackground] = "true";
      rememberCssBackgroundUrls(element, collectCssBackgroundUrls(element));
      markMediaStat(element, getImageStatFeature(reason));

      element.classList.add(
        getEffectiveSettings().replacementMode === "hide" ? "motionblock-background-hidden" : "motionblock-background-placeholder"
      );
      element.style.setProperty("background-image", "none", "important");
      recordMediaEffect("image.cssBackgroundBlocked", element, { reason });
    }

    function shouldDeferBroadImageBlock(element, reason) {
      if (reason !== "image" || element.dataset.motionblockBlocked === "true") {
        return false;
      }

      if (element.tagName.toLowerCase() === "source") {
        const image = element.closest("picture") ? element.closest("picture").querySelector("img") : null;
        return Boolean(image && image.dataset.motionblockBlocked !== "true");
      }

      if (element.tagName.toLowerCase() !== "img") {
        return false;
      }

      return !isBroadImageReadyForBlocking(element) && !hasPendingImageBlockTimedOut(element);
    }

    function deferBroadImageBlock(element, reason) {
      if (element.tagName.toLowerCase() === "source") {
        return;
      }

      if (element.dataset.motionblockPendingImageBlock !== "true") {
        element.dataset.motionblockPendingImageBlock = "true";
        element.dataset.motionblockPendingImageReason = reason;
        element.dataset.motionblockPendingImageStarted = String(Date.now());
        element.classList.add("motionblock-image-pending");
        element.addEventListener("load", handlePendingImageLoad, { once: true });
        element.addEventListener("error", handlePendingImageLoad, { once: true });
      }

      schedulePendingImageBlock(element, options.broadImageSettleDelayMs);
      schedulePendingImageBlock(element, options.broadImageBlockTimeoutMs);
    }

    function handlePendingImageLoad(event) {
      schedulePendingImageBlock(event.currentTarget, options.broadImageSettleDelayMs);
    }

    function schedulePendingImageBlock(element, delay) {
      window.setTimeout(function () {
        const settings = getEffectiveSettings();
        if (!element.isConnected || element.dataset.motionblockPendingImageBlock !== "true") {
          return;
        }

        if (!settings.enabled || !settings.features.images) {
          clearPendingImageBlock(element);
          return;
        }

        if (!isBroadImageReadyForBlocking(element) && !hasPendingImageBlockTimedOut(element)) {
          return;
        }

        blockImageElement(element, element.dataset.motionblockPendingImageReason || "image");
      }, delay);
    }

    function isBroadImageReadyForBlocking(element) {
      return element.complete && element.naturalWidth > 1 && element.naturalHeight > 1;
    }

    function hasPendingImageBlockTimedOut(element) {
      const started = Number(element.dataset.motionblockPendingImageStarted || "0");
      return started > 0 && Date.now() - started >= options.broadImageBlockTimeoutMs;
    }

    function clearPendingImageBlock(element) {
      element.classList.remove("motionblock-image-pending");
      delete element.dataset.motionblockPendingImageBlock;
      delete element.dataset.motionblockPendingImageReason;
      delete element.dataset.motionblockPendingImageStarted;
    }

    function refreshImagePlaceholder(element) {
      if (getEffectiveSettings().replacementMode === "hide" || element.tagName.toLowerCase() === "source") {
        return;
      }

      const reason = element.dataset.motionblockReason || "image";
      const placeholderSize = lockDisplayedSize(element, reason);
      element.classList.add("motionblock-media-placeholder");
      applyContainerPlaceholder(element, placeholderSize);
    }

    function blockMediaElement(element, reason) {
      if (element.dataset.motionblockBlocked === "true") {
        markMediaStat(element, getMediaStatFeature(reason || element.dataset.motionblockReason, element));
        enforceBlockedMediaElement(element);
        options.ensureRevealOverlay(
          element,
          element.tagName === "AUDIO" ? t("contentPlayBlockedAudio", "Play blocked audio") : t("contentPlayBlockedVideo", "Play blocked video")
        );
        return;
      }

      storeOriginalAttribute(element, "alt");
      storeOriginalAttribute(element, "src");
      storeOriginalAttribute(element, "poster");
      storeOriginalAttribute(element, "preload");
      storeOriginalAttribute(element, "autoplay");
      storeOriginalAttribute(element, "loop");
      storeOriginalAttribute(element, "muted");
      storeOriginalAttribute(element, "title");
      storeOriginalMediaState(element);
      storeOriginalMediaRuntimeState(element);

      element.dataset.motionblockBlocked = "true";
      element.dataset.motionblockFeature = "media";
      element.dataset.motionblockReason = reason;
      markMediaStat(element, getMediaStatFeature(reason, element));
      element.title = element.title || t("contentBlockedByTitle", [getReasonLabel(reason)], "Blocked by MotionBlock: $REASON$");

      lockDisplayedSize(element, reason);
      element.classList.add("motionblock-media-hidden");
      enforceBlockedMediaElement(element);
      recordMediaEffect("media.nativeBlocked", element, { reason });
      options.ensureRevealOverlay(
        element,
        element.tagName === "AUDIO" ? t("contentPlayBlockedAudio", "Play blocked audio") : t("contentPlayBlockedVideo", "Play blocked video")
      );
    }

    function blockCustomMediaHostElement(element, reason) {
      if (element.dataset.motionblockBlocked === "true") {
        markMediaStat(element, getMediaStatFeature(reason || element.dataset.motionblockReason, element));
        enforceBlockedCustomMediaHostElement(element);
        options.ensureRevealOverlay(element, t("contentPlayBlockedMedia", "Play blocked media"));
        return;
      }

      storeOriginalAttribute(element, "autoplay");
      storeOriginalAttribute(element, "loop");
      storeOriginalAttribute(element, "src");
      storeOriginalAttribute(element, "poster");
      storeOriginalAttribute(element, "preload");
      storeOriginalAttribute(element, "muted");
      storeOriginalAttribute(element, "title");
      storeOriginalMediaState(element);
      storeOriginalMediaRuntimeState(element);

      element.dataset.motionblockBlocked = "true";
      element.dataset.motionblockFeature = "media";
      element.dataset.motionblockCustomHost = "true";
      element.dataset.motionblockReason = reason;
      markMediaStat(element, getMediaStatFeature(reason, element));
      element.title = element.title || t("contentBlockedByTitle", [getReasonLabel(reason)], "Blocked by MotionBlock: $REASON$");

      element.classList.add(
        getEffectiveSettings().replacementMode === "hide" ? "motionblock-media-hidden" : "motionblock-media-placeholder"
      );
      enforceBlockedCustomMediaHostElement(element);
      recordMediaEffect("media.customHostBlocked", element, { reason });
      options.ensureRevealOverlay(element, t("contentPlayBlockedMedia", "Play blocked media"));
    }

    function enforceBlockedMediaElement(element) {
      if (element.dataset.motionblockEnforcing === "true") {
        return;
      }

      element.dataset.motionblockEnforcing = "true";

      try {
        element.pause();
        element.autoplay = false;
        element.loop = false;
        element.muted = true;
        element.volume = 0;
        element.removeAttribute("autoplay");
        element.removeAttribute("loop");
        element.setAttribute("preload", "none");
      } finally {
        delete element.dataset.motionblockEnforcing;
      }
    }

    function enforceBlockedCustomMediaHostElement(element) {
      if (element.dataset.motionblockEnforcing === "true") {
        return;
      }

      element.dataset.motionblockEnforcing = "true";

      try {
        element.removeAttribute("autoplay");
        element.removeAttribute("loop");
        element.setAttribute("preload", "none");

        element.querySelectorAll("source").forEach(function (source) {
          storeOriginalAttribute(source, "src");
          storeOriginalAttribute(source, "srcset");
          storeOriginalMediaRuntimeProperty(source, "src");
          source.dataset.motionblockSourceBlocked = "true";
          source.removeAttribute("src");
          source.removeAttribute("srcset");
        });

        element.removeAttribute("src");
        element.dataset.motionblockSourcesCleared = "true";
        setMediaPropertyIfPresent(element, "src", "");
        setMediaPropertyIfPresent(element, "autoplay", false);
        setMediaPropertyIfPresent(element, "loop", false);
        setMediaPropertyIfPresent(element, "muted", true);
        setMediaPropertyIfPresent(element, "volume", 0);
        callMediaMethodIfPresent(element, "pause");
        callMediaMethodIfPresent(element, "stop");
        callMediaMethodIfPresent(element, "pauseVideo");
        callMediaMethodIfPresent(element, "stopVideo");

        if (element.shadowRoot) {
          processMedia(element.shadowRoot);
        }
      } finally {
        delete element.dataset.motionblockEnforcing;
      }
    }

    function syncVideoAudioBlocking(element) {
      if (!element || element.tagName !== "VIDEO") {
        return;
      }

      if (getEffectiveSettings().enabled && getEffectiveSettings().features.audio && element.dataset.motionblockBlocked !== "true") {
        blockVideoAudioElement(element);
      } else if (element.dataset[dataKeys.audioAdjusted] === "true" && element.dataset.motionblockBlocked !== "true") {
        restoreVideoAudioElement(element);
      }
    }

    function blockVideoAudioElement(element) {
      if (!element || element.tagName !== "VIDEO") {
        return;
      }

      if (element.dataset[dataKeys.audioAdjusted] !== "true") {
        storeOriginalAttribute(element, "muted");
        storeOriginalMediaProperty(element, "muted");
        storeOriginalMediaProperty(element, "volume");
        element.dataset[dataKeys.audioAdjusted] = "true";
      }
      markMediaStat(element, "audio");

      if (element.dataset.motionblockEnforcing === "true") {
        return;
      }

      const wasMuted = isVideoAudioMuted(element), wasAudible = !wasMuted || getVideoAudioVolume(element) > 0;
      element.dataset.motionblockEnforcing = "true";

      try {
        if (!wasMuted) {
          element.muted = true;
        }
        if (getVideoAudioVolume(element) > 0) { element.volume = 0; }
        if (!hasAttribute(element, "muted")) {
          element.setAttribute("muted", "");
        }
      } catch (error) {
        recordMediaEffect("media.videoAudioMuteFailed", element, { error: error && error.name ? error.name : "Error" });
        return;
      } finally {
        delete element.dataset.motionblockEnforcing;
      }

      if (wasAudible) {
        recordMediaEffect("media.videoAudioMuted", element, { feature: "audio" });
      }
    }

    function restoreVideoAudioElement(element) {
      if (!element || element.dataset[dataKeys.audioAdjusted] !== "true") {
        return;
      }

      unmarkMediaStat(element);
      restoreOriginalAttribute(element, "muted");
      restoreOriginalMediaProperty(element, "muted", "boolean");
      restoreOriginalMediaProperty(element, "volume", "number");
      delete element.dataset[dataKeys.audioAdjusted];
    }

    function setMediaPropertyIfPresent(element, propertyName, value) {
      try {
        if (propertyName in element) {
          element[propertyName] = value;
        }
      } catch (error) {
        return;
      }
    }

    function isVideoAudioMuted(element) { try { return Boolean(element && element.muted); } catch (error) { return false; } }
    function getVideoAudioVolume(element) { try { return Number(element && element.volume) || 0; } catch (error) { return 0; } }

    function hasAttribute(element, name) { try { return Boolean(element && typeof element.hasAttribute === "function" && element.hasAttribute(name)); } catch (error) { return false; } }

    function callMediaMethodIfPresent(element, methodName) {
      try {
        if (typeof element[methodName] === "function") {
          element[methodName]();
        }
      } catch (error) {
        return;
      }
    }

    function disableAutoplay(element) {
      if (element.dataset.motionblockAutoplayAdjusted === "true") {
        markMediaStat(element, "autoplayVideo");
        return;
      }

      storeOriginalAttribute(element, "autoplay");
      storeOriginalAttribute(element, "preload");
      element.dataset.motionblockAutoplayAdjusted = "true";
      markMediaStat(element, "autoplayVideo");
      element.removeAttribute("autoplay");
      element.autoplay = false;
      element.setAttribute("preload", "metadata");
      element.pause();
      recordMediaEffect("media.autoplayDisabled", element, {});
    }

    function recordMediaEffect(event, element, details) { if (diagnostics && typeof diagnostics.recordMediaEffect === "function") { diagnostics.recordMediaEffect(event, element, details, collectElementUrls); } }

    return {
      blockCssBackgroundElement, blockCustomMediaHostElement, blockImageElement, blockMediaElement, blockVideoAudioElement,
      clearPendingImageBlock, deferBroadImageBlock, disableAutoplay, enforceBlockedCustomMediaHostElement,
      enforceBlockedMediaElement, restoreVideoAudioElement, shouldDeferBroadImageBlock, syncVideoAudioBlocking
    };
  }

  root.MotionBlockMediaEffects = { createMediaEffects };
})(globalThis);
