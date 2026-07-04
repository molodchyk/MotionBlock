(function (root) {
  "use strict";

  function createMediaRestore(options) {
    const dataKeys = options.dataKeys;
    const getOriginalAttributeKey = options.getOriginalAttributeKey;
    const markForLoadRetry = options.markForLoadRetry;
    const queryAllProcessingRoots = options.queryAllProcessingRoots;
    const removePlaceholderContainer = options.removePlaceholderContainer;
    const removeRevealButton = options.removeRevealButton;
    const restoreOriginalAttribute = options.restoreOriginalAttribute;
    const restoreOriginalMediaRuntimeState = options.restoreOriginalMediaRuntimeState;
    const restoreOriginalMediaState = options.restoreOriginalMediaState;
    const restoreOriginalStyleProperty = options.restoreOriginalStyleProperty;
    const unmarkMediaStat = options.unmarkMediaStat;

    function restoreBlockedElements() {
      queryAllProcessingRoots(
        "[data-motionblock-blocked='true'], [data-motionblock-autoplay-adjusted='true'], [data-" +
          toDataAttributeName(dataKeys.audioAdjusted) +
          "='true']"
      ).forEach(restoreElement);
      queryAllProcessingRoots("[data-motionblock-source-blocked='true']").forEach(restoreElement);
    }

    function restoreElementsByFeature(feature) {
      queryAllProcessingRoots("[data-motionblock-feature='" + feature + "']").forEach(restoreElement);
    }

    function restoreAudioAdjustedElements() {
      queryAllProcessingRoots("[data-" + toDataAttributeName(dataKeys.audioAdjusted) + "='true']").forEach(restoreElement);
    }

    function restoreElement(element) {
      const restoresMediaSources =
        element.tagName === "VIDEO" || element.tagName === "AUDIO" || element.dataset.motionblockCustomHost === "true";
      const reloadsRestoredMedia = shouldReloadRestoredMediaElement(element);

      removeRevealButton(element);
      unmarkMediaStat(element);
      restoreOriginalAttribute(element, "alt");
      restoreOriginalAttribute(element, "src");
      restoreOriginalAttribute(element, "srcset");
      restoreOriginalAttribute(element, "sizes");
      restoreOriginalAttribute(element, "poster");
      restoreOriginalAttribute(element, "preload");
      restoreOriginalAttribute(element, "autoplay");
      restoreOriginalAttribute(element, "loop");
      restoreOriginalAttribute(element, "muted");
      restoreOriginalAttribute(element, "title");
      restoreOriginalStyleProperty(element, "backgroundImage");
      restoreOriginalMediaRuntimeState(element);
      restoreOriginalMediaState(element);

      element.classList.remove(
        "motionblock-media-placeholder",
        "motionblock-media-hidden",
        "motionblock-image-pending",
        "motionblock-background-placeholder",
        "motionblock-background-hidden"
      );
      delete element.dataset.motionblockBlocked;
      delete element.dataset.motionblockFeature;
      delete element.dataset.motionblockCustomHost;
      delete element.dataset.motionblockReason;
      delete element.dataset[dataKeys.cssBackground];
      delete element.dataset[dataKeys.cssBackgroundUrls];
      delete element.dataset[dataKeys.mediaUncounted];
      delete element.dataset.motionblockAutoplayAdjusted;
      delete element.dataset[dataKeys.audioAdjusted];
      delete element.dataset.motionblockSourceBlocked;
      delete element.dataset.motionblockEnforcing;
      delete element.dataset.motionblockPendingImageBlock;
      delete element.dataset.motionblockPendingImageReason;
      delete element.dataset.motionblockPendingImageStarted;
      delete element.dataset.motionblockSourcesCleared;

      element.style.width = element.dataset.motionblockOriginalStyleWidth || "";
      element.style.height = element.dataset.motionblockOriginalStyleHeight || "";
      delete element.dataset.motionblockOriginalStyleWidth;
      delete element.dataset.motionblockOriginalStyleHeight;

      removePlaceholderContainer(element);

      if (restoresMediaSources) {
        element.querySelectorAll("[data-motionblock-source-blocked='true']").forEach(restoreElement);
      }

      if (reloadsRestoredMedia && typeof element.load === "function" && (element.tagName === "VIDEO" || element.tagName === "AUDIO")) {
        element.load();
      }

      if ((element.tagName !== "VIDEO" && element.tagName !== "AUDIO") || reloadsRestoredMedia) {
        markForLoadRetry(element);
      }
    }

    function shouldReloadRestoredMediaElement(element) {
      const tag = element.tagName;
      if (tag !== "VIDEO" && tag !== "AUDIO") {
        return false;
      }

      if (element.dataset.motionblockSourcesCleared === "true") {
        return true;
      }

      const originalSrcKey = getOriginalAttributeKey("src");
      if (
        Object.prototype.hasOwnProperty.call(element.dataset, originalSrcKey) &&
        element.dataset[originalSrcKey] &&
        !element.hasAttribute("src")
      ) {
        return true;
      }

      return Boolean(element.querySelector("[data-motionblock-source-blocked='true']"));
    }

    return {
      restoreAudioAdjustedElements,
      restoreBlockedElements,
      restoreElement,
      restoreElementsByFeature
    };
  }

  function toDataAttributeName(dataKey) {
    return String(dataKey).replace(/[A-Z]/g, function (letter) {
      return "-" + letter.toLowerCase();
    });
  }

  root.MotionBlockMediaRestore = {
    createMediaRestore
  };
})(globalThis);
