(function (root) {
  "use strict";

  function createRevealControls(options) {
    const chromeApi = options.chrome;
    const collectElementUrls = options.collectElementUrls;
    const cssEscape = options.cssEscape;
    const document = options.document;
    const getEffectiveSettings = options.getEffectiveSettings;
    const i18n = options.i18n;
    const normalizeRequestUrl = options.normalizeRequestUrl;
    const queryAllProcessingRoots = options.queryAllProcessingRoots;
    const restoreElement = options.restoreElement;
    const window = options.window;

    let overlayPositionTimer = 0;
    let restoreRetryTimer = 0;

    function getReasonLabel(reason) {
      const reasonKeyByLabel = {
        GIF: "contentReasonGif",
        GIFV: "contentReasonGifv",
        WebP: "contentReasonWebp",
        "GIF-like media": "contentReasonGifLikeMedia",
        video: "contentReasonVideo",
        audio: "contentReasonAudio",
        "looping video": "contentReasonLoopingVideo",
        "autoplay video": "contentReasonAutoplayVideo",
        image: "contentReasonImage"
      };
      const fallback = String(reason || "");
      return t(reasonKeyByLabel[fallback] || "contentReasonMedia", undefined, fallback);
    }

    function ensureRevealOverlay(element, label) {
      if (!getEffectiveSettings().showRevealControls) {
        removeRevealButton(element);
        return;
      }

      if (!element.parentNode) {
        return;
      }

      if (element.dataset.motionblockRevealId) {
        updateRevealOverlayPosition(element);
        return;
      }

      const button = document.createElement("button");
      const id = "motionblock-" + Math.random().toString(36).slice(2);
      button.type = "button";
      button.className = "motionblock-reveal-button";
      button.lang = i18n.getLanguageTag();
      button.dir = i18n.getDirection();
      button.textContent = label;
      button.setAttribute("aria-label", label);
      button.dataset.motionblockRevealButton = id;
      element.dataset.motionblockRevealId = id;

      button.addEventListener("click", function () {
        allowElementTemporarily(element);
      });

      document.documentElement.appendChild(button);
      updateRevealOverlayPosition(element);
    }

    function removeRevealButton(element) {
      const id = element.dataset.motionblockRevealId;
      if (!id) {
        return;
      }

      const button = document.querySelector("[data-motionblock-reveal-button='" + cssEscape(id) + "']");
      if (button) {
        button.remove();
      }
      delete element.dataset.motionblockRevealId;
    }

    function removeAllRevealButtons() {
      const buttons = document.querySelectorAll(".motionblock-reveal-button");
      if (!buttons.length) {
        return;
      }

      buttons.forEach(function (button) {
        button.remove();
      });

      queryAllProcessingRoots("[data-motionblock-reveal-id]").forEach(function (element) {
        delete element.dataset.motionblockRevealId;
      });
    }

    function scheduleRevealOverlayPositionUpdate() {
      if (overlayPositionTimer) {
        return;
      }

      overlayPositionTimer = window.requestAnimationFrame(function () {
        overlayPositionTimer = 0;
        updateAllRevealOverlayPositions();
      });
    }

    function updateAllRevealOverlayPositions() {
      if (!getEffectiveSettings().showRevealControls) {
        removeAllRevealButtons();
        return;
      }

      queryAllProcessingRoots("[data-motionblock-reveal-id]").forEach(updateRevealOverlayPosition);
    }

    function updateRevealOverlayPosition(element) {
      const id = element.dataset.motionblockRevealId;
      if (!id) {
        return;
      }

      const button = document.querySelector("[data-motionblock-reveal-button='" + cssEscape(id) + "']");
      if (!button) {
        delete element.dataset.motionblockRevealId;
        return;
      }

      const rect = element.getBoundingClientRect();
      if (
        rect.width <= 1 ||
        rect.height <= 1 ||
        rect.bottom <= 0 ||
        rect.right <= 0 ||
        rect.top >= window.innerHeight ||
        rect.left >= window.innerWidth
      ) {
        button.style.display = "none";
        return;
      }

      const left = Math.max(8, Math.min(rect.left + 8, window.innerWidth - 170));
      const top = Math.max(8, Math.min(rect.top + 8, window.innerHeight - 38));
      button.style.display = "inline-flex";
      button.style.left = left + "px";
      button.style.top = top + "px";
    }

    async function allowElementTemporarily(element) {
      element.dataset.motionblockUserAllowed = "true";
      await requestTemporaryAllowRules(element);

      if (element.tagName === "VIDEO" || element.tagName === "AUDIO") {
        element.querySelectorAll("[data-motionblock-source-blocked='true']").forEach(restoreElement);
      }

      restoreElement(element);

      if (element.tagName === "VIDEO" || element.tagName === "AUDIO") {
        element.controls = true;
        if (typeof element.play === "function") {
          element.play().catch(function () {});
        }
      }
    }

    function markForLoadRetry(element) {
      const tag = element.tagName.toLowerCase();
      if (tag !== "img" && tag !== "source" && tag !== "video" && tag !== "audio") {
        return;
      }

      element.dataset.motionblockRestorePending = "true";
      element.dataset.motionblockRestoreAttempts = "0";
      element.dataset.motionblockRestoreStarted = String(Date.now());

      if (tag === "img") {
        element.addEventListener("load", clearLoadRetry, { once: true });
      }

      scheduleRestoredMediaRetry(120);
      scheduleRestoredMediaRetry(700);
    }

    function clearLoadRetry(event) {
      const element = event.currentTarget;
      delete element.dataset.motionblockRestorePending;
      delete element.dataset.motionblockRestoreAttempts;
      delete element.dataset.motionblockRestoreStarted;
    }

    function scheduleRestoredMediaRetry(delay) {
      if (restoreRetryTimer) {
        return;
      }

      restoreRetryTimer = window.setTimeout(function () {
        restoreRetryTimer = 0;
        retryRestoredMediaLoads();
      }, delay);
    }

    function retryRestoredMediaLoads() {
      const pending = queryAllProcessingRoots("[data-motionblock-restore-pending='true']");
      let hasPending = false;

      pending.forEach(function (element) {
        const attempts = Number(element.dataset.motionblockRestoreAttempts || "0");
        const started = Number(element.dataset.motionblockRestoreStarted || "0");
        const age = Date.now() - started;

        if (attempts >= 6 || age > 5000 || element.dataset.motionblockBlocked === "true") {
          delete element.dataset.motionblockRestorePending;
          delete element.dataset.motionblockRestoreAttempts;
          delete element.dataset.motionblockRestoreStarted;
          return;
        }

        element.dataset.motionblockRestoreAttempts = String(attempts + 1);
        forceReloadRestoredElement(element);

        if (element.dataset.motionblockRestorePending === "true") {
          hasPending = true;
        }
      });

      if (hasPending) {
        scheduleRestoredMediaRetry(450);
      }
    }

    function forceReloadRestoredElement(element) {
      const tag = element.tagName.toLowerCase();

      if (tag === "img") {
        if (element.complete && element.naturalWidth > 0) {
          clearLoadRetry({ currentTarget: element });
          return;
        }

        resetAttribute(element, "srcset");
        resetAttribute(element, "sizes");
        resetAttribute(element, "src");
        return;
      }

      if (tag === "source") {
        resetAttribute(element, "srcset");
        resetAttribute(element, "src");
        const picture = element.closest("picture");
        const image = picture ? picture.querySelector("img") : null;
        if (image) {
          resetAttribute(image, "srcset");
          resetAttribute(image, "src");
        }
        return;
      }

      if ((tag === "video" || tag === "audio") && typeof element.load === "function") {
        element.load();
      }
    }

    function resetAttribute(element, attributeName) {
      const value = element.getAttribute(attributeName);
      if (!value) {
        return;
      }

      element.removeAttribute(attributeName);
      element.getBoundingClientRect();
      element.setAttribute(attributeName, value);
    }

    async function requestTemporaryAllowRules(element) {
      if (!chromeApi.runtime || !chromeApi.runtime.sendMessage) {
        return;
      }

      const urls = collectElementUrls(element)
        .map(normalizeRequestUrl)
        .filter(Boolean);

      if (!urls.length) {
        return;
      }

      const tag = element.tagName.toLowerCase();
      const resourceTypes = tag === "img" || tag === "source" ? ["image"] : ["media", "xmlhttprequest"];

      try {
        await chromeApi.runtime.sendMessage({
          type: "motionblock:allowUrlsOnce",
          urls,
          resourceTypes
        });
      } catch (error) {
        return;
      }
    }

    function t(key, substitutions, fallback) {
      return i18n.t(key, substitutions, fallback);
    }

    return {
      getReasonLabel,
      ensureRevealOverlay,
      markForLoadRetry,
      removeAllRevealButtons,
      removeRevealButton,
      scheduleRevealOverlayPositionUpdate,
      updateAllRevealOverlayPositions
    };
  }

  root.MotionBlockRevealControls = {
    createRevealControls
  };
})(globalThis);
