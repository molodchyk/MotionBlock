(function () {
  "use strict";

  const MB = window.MotionBlock;
  const PLACEHOLDER_SRC = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3C/svg%3E";
  const EMOJI_REGEX_SOURCE = [
    "[#*0-9]\\ufe0f?\\u20e3",
    "[\\u{1f1e6}-\\u{1f1ff}]{2}",
    "(?:\\p{Emoji_Presentation}|\\p{Extended_Pictographic})(?:\\ufe0f|\\ufe0e)?[\\u{1f3fb}-\\u{1f3ff}]?(?:\\u200d(?:\\p{Emoji_Presentation}|\\p{Extended_Pictographic})(?:\\ufe0f|\\ufe0e)?[\\u{1f3fb}-\\u{1f3ff}]?)*"
  ].join("|");
  const EMOJI_FALLBACK_PATTERN =
    /[#*0-9]\ufe0f?\u20e3|[\u00a9\u00ae\u203c\u2049\u2122\u2139\u2194-\u21aa\u231a-\u231b\u2328\u23cf\u23e9-\u23f3\u23f8-\u23fa\u24c2\u25aa-\u25ab\u25b6\u25c0\u25fb-\u25fe\u2600-\u27bf\u2934-\u2935\u2b05-\u2b55\u3030\u303d\u3297\u3299]|\ud83c[\udde6-\uddff]|\ud83c[\udf00-\udfff]|\ud83d[\udc00-\ude4f]|\ud83d[\ude80-\udeff]|\ud83e[\udd00-\uddff]/g;
  const EMOJI_TEXT_ATTRIBUTES = ["alt", "aria-label", "data-reaction-content", "data-reaction-label", "data-title", "data-tooltip", "data-tooltip-text", "placeholder", "title"];
  const CURRENT_HOST = MB.normalizeHostname(window.location.hostname);
  const GIF_LIKE_TEXT_PATTERN = /\b(gif|gifv|giphy|tenor|looping|animated)\b/i;
  const GIF_LIKE_URL_PATTERN =
    /(giphy\.com|media\.tenor\.com|tenor\.com|gfycat\.com|redgifs\.com|external-preview\.redd\.it|preview\.redd\.it|\.gifv(?:$|[?#])|[?&](?:format|type)=gifv?(?:&|$)|\/gif[s/]?)/i;
  const APPLY_DEBOUNCE_MS = 120;
  const BROAD_IMAGE_BLOCK_TIMEOUT_MS = 2500;
  const BROAD_IMAGE_SETTLE_DELAY_MS = 120;
  const MEDIA_ATTRIBUTE_FILTER = ["src", "srcset", "poster", "autoplay", "loop", "muted"];
  const MEDIA_ENFORCEMENT_EVENTS = ["loadstart", "loadedmetadata", "canplay", "play", "playing", "volumechange"];
  const FULL_SCAN_SETTLE_DELAYS_MS = [180, 700, 1800];
  const CUSTOM_MEDIA_HOST_SELECTOR = [
    "[autoplay]",
    "[loop]",
    "[gif]",
    "[data-hls-url]",
    "[data-media-id]",
    "[data-video-id]",
    "[src*='.gifv' i]",
    "[src*='.m3u8' i]",
    "[src*='.mp4' i]",
    "[src*='.webm' i]"
  ].join(",");
  const MEDIA_HOST_TEXT_PATTERN = /\b(video|player|media|gif|gifv|animation|stream|embed|audio|sound|music|podcast)\b/i;
  const VIDEO_HOST_TEXT_PATTERN = /\b(video|player|media|gif|gifv|animation|stream|embed)\b/i;
  const AUDIO_HOST_TEXT_PATTERN = /\b(audio|sound|music|podcast|player|media|stream|embed)\b/i;
  const EMOJI_UI_SELECTORS = [
    "img.emoji",
    "img.twemoji",
    "g-emoji",
    "[data-emoji]",
    "[data-emoji-name]",
    "[data-reaction-label]",
    "[data-reaction-content]",
    "[data-testid*='emoji' i]",
    "[data-testid*='reaction' i]",
    "[aria-label*='emoji' i]",
    "[aria-label*='reaction' i]",
    ".emoji",
    ".twemoji",
    ".reaction-summary-item",
    ".reaction-popover-container",
    ".social-reaction-summary-item",
    ".js-reaction-group-button",
    ".js-reaction-summary-item"
  ].join(",");

  let storedSettings = MB.DEFAULT_SETTINGS;
  let effectiveSettings = MB.getEffectiveSettings(storedSettings, window.location.hostname);
  let scheduled = false;
  let fullScanPending = true;
  let applyTimer = 0;
  let observer = null;
  let restoreRetryTimer = 0;
  let overlayPositionTimer = 0;
  let attachShadowPatched = false;
  let settlingFullScanTimers = [];
  const processingRoots = [document];
  const dirtyRoots = new Set([document]);
  const observedProcessingRoots = new WeakSet();
  const placeholderContainers = new WeakMap();
  const emojiTextOriginals = new WeakMap();
  const emojiAttributeOriginals = new WeakMap();

  if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.sync) {
    return;
  }

  loadSettings();
  startObserver();
  addMediaEnforcementListeners(document);
  window.addEventListener("scroll", scheduleRevealOverlayPositionUpdate, true);
  window.addEventListener("resize", scheduleRevealOverlayPositionUpdate, true);

  chrome.storage.onChanged.addListener(function (changes, areaName) {
    if (areaName === "sync" && changes[MB.STORAGE_KEY]) {
      applySettings(changes[MB.STORAGE_KEY].newValue);
    }
  });

  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (message && message.type === "motionblock:applyNow") {
      loadSettings().then(function () {
        sendResponse({ ok: true });
      });
      return true;
    }

    return false;
  });

  async function loadSettings() {
    const data = await chrome.storage.sync.get(MB.STORAGE_KEY);
    applySettings(data[MB.STORAGE_KEY]);
  }

  function applySettings(settings) {
    storedSettings = MB.normalizeSettings(settings);
    effectiveSettings = MB.getEffectiveSettings(storedSettings, window.location.hostname);
    runFullBlockingPass();
  }

  function runFullBlockingPass() {
    cancelScheduledApply();
    markFullScan();
    applyBlocking();
    scheduleSettlingFullScans();
  }

  function cancelScheduledApply() {
    if (applyTimer) {
      window.clearTimeout(applyTimer);
      applyTimer = 0;
    }

    scheduled = false;
  }

  function startObserver() {
    observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        markDirtyRoot(getMutationRoot(mutation));

        if (mutation.type === "childList") {
          mutation.addedNodes.forEach(discoverShadowRootsFromNode);
        }
      });
      scheduleApply();
    });

    patchAttachShadow();
    observeProcessingRoot(document);
    discoverShadowRoots(document);

    if (document.readyState === "loading") {
      document.addEventListener(
        "DOMContentLoaded",
        function () {
          scheduleApply({ full: true });
        },
        { once: true }
      );
    } else {
      scheduleApply({ full: true });
    }
  }

  function patchAttachShadow() {
    if (attachShadowPatched || !Element.prototype.attachShadow) {
      return;
    }

    const originalAttachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (init) {
      const shadowRoot = originalAttachShadow.call(this, init);

      if (!init || init.mode === "open") {
        window.setTimeout(function () {
          observeProcessingRoot(shadowRoot);
          scheduleApply({ root: shadowRoot });
        }, 0);
      }

      return shadowRoot;
    };

    attachShadowPatched = true;
  }

  function observeProcessingRoot(root) {
    if (!root || observedProcessingRoots.has(root)) {
      return;
    }

    observedProcessingRoots.add(root);

    if (root !== document) {
      processingRoots.push(root);
      addMediaEnforcementListeners(root);
    }

    markDirtyRoot(root);

    const target = root === document ? document.documentElement || document : root;
    observer.observe(target, {
      attributes: true,
      attributeFilter: MEDIA_ATTRIBUTE_FILTER,
      childList: true,
      subtree: true
    });

    discoverShadowRoots(root);
  }

  function discoverShadowRoots(root) {
    if (!root || typeof root.querySelectorAll !== "function") {
      return;
    }

    root.querySelectorAll("*").forEach(function (element) {
      if (element.shadowRoot) {
        observeProcessingRoot(element.shadowRoot);
      }
    });
  }

  function discoverShadowRootsFromNode(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    if (node.shadowRoot) {
      observeProcessingRoot(node.shadowRoot);
    }

    discoverShadowRoots(node);
  }

  function getMutationRoot(mutation) {
    const target = mutation && mutation.target;
    if (target && typeof target.getRootNode === "function") {
      return normalizeProcessingRoot(target.getRootNode());
    }

    return document;
  }

  function normalizeProcessingRoot(root) {
    return root && (root.nodeType === Node.DOCUMENT_NODE || root.nodeType === Node.DOCUMENT_FRAGMENT_NODE) ? root : document;
  }

  function markDirtyRoot(root) {
    dirtyRoots.add(normalizeProcessingRoot(root));
  }

  function markFullScan() {
    fullScanPending = true;
    dirtyRoots.clear();
    dirtyRoots.add(document);
  }

  function scheduleApply(options) {
    if (options && options.full) {
      markFullScan();
    } else if (options && options.root) {
      markDirtyRoot(options.root);
    }

    if (scheduled) {
      return;
    }

    scheduled = true;
    applyTimer = window.setTimeout(function () {
      applyTimer = 0;
      scheduled = false;
      applyBlocking();
    }, APPLY_DEBOUNCE_MS);
  }

  function applyBlocking() {
    if (fullScanPending) {
      discoverAllProcessingRoots();
    }

    const work = consumeScheduledWork();
    const roots = work.roots;

    updateDocumentClasses();

    if (!effectiveSettings.showRevealControls) {
      removeAllRevealButtons();
    }

    if (!effectiveSettings.enabled) {
      if (work.full) {
        restoreBlockedElements();
      }
      return;
    }

    if (shouldInspectImages()) {
      roots.forEach(processImages);
    } else if (work.full) {
      restoreElementsByFeature("image");
    }

    if (shouldInspectMedia()) {
      roots.forEach(processMedia);
    } else if (work.full) {
      restoreElementsByFeature("media");
    }

    if (effectiveSettings.features.emoji) {
      roots.forEach(processEmoji);
    } else if (!effectiveSettings.features.emoji && work.full) {
      getProcessingRoots().forEach(restoreEmojiElements);
    }

    updateAllRevealOverlayPositions();
  }

  function scheduleSettlingFullScans() {
    clearSettlingFullScans();

    if (!shouldRunSettlingFullScans()) {
      return;
    }

    settlingFullScanTimers = FULL_SCAN_SETTLE_DELAYS_MS.map(function (delay) {
      return window.setTimeout(function () {
        markFullScan();
        applyBlocking();
      }, delay);
    });
  }

  function clearSettlingFullScans() {
    settlingFullScanTimers.forEach(function (timer) {
      window.clearTimeout(timer);
    });
    settlingFullScanTimers = [];
  }

  function shouldRunSettlingFullScans() {
    if (!effectiveSettings.enabled) {
      return false;
    }

    return (
      shouldInspectImages() ||
      shouldInspectMedia() ||
      Boolean(effectiveSettings.features.emoji) ||
      Boolean(effectiveSettings.features.cssMotion)
    );
  }

  function addMediaEnforcementListeners(root) {
    MEDIA_ENFORCEMENT_EVENTS.forEach(function (eventName) {
      root.addEventListener(eventName, stopBlockedMediaPlayback, true);
    });
  }

  function discoverAllProcessingRoots() {
    getProcessingRoots().forEach(discoverShadowRoots);
  }

  function updateDocumentClasses() {
    const enabled = Boolean(effectiveSettings.enabled);
    document.documentElement.classList.toggle(
      "motionblock-css-motion-off",
      enabled && Boolean(effectiveSettings.features.cssMotion)
    );
  }

  function getProcessingRoots() {
    return processingRoots.filter(function (root) {
      return root === document || !root.host || root.host.isConnected;
    });
  }

  function consumeScheduledWork() {
    const full = fullScanPending;
    const activeRoots = getProcessingRoots();
    let roots;

    if (full) {
      roots = activeRoots;
    } else {
      roots = Array.from(dirtyRoots)
        .map(normalizeProcessingRoot)
        .filter(function (root) {
          return activeRoots.indexOf(root) !== -1;
        });
    }

    dirtyRoots.clear();
    fullScanPending = false;

    return {
      full,
      roots: uniqueElements(roots)
    };
  }

  function uniqueElements(elements) {
    const seen = new Set();
    const result = [];

    elements.forEach(function (element) {
      if (!seen.has(element)) {
        seen.add(element);
        result.push(element);
      }
    });

    return result;
  }

  function queryAllProcessingRoots(selector) {
    const elements = [];

    getProcessingRoots().forEach(function (root) {
      root.querySelectorAll(selector).forEach(function (element) {
        elements.push(element);
      });
    });

    return elements;
  }

  function processImages(root) {
    if (!shouldInspectImages()) {
      restoreElementsByFeature("image");
      return;
    }

    root.querySelectorAll("img, picture source").forEach(function (element) {
      if (element.dataset.motionblockUserAllowed === "true") {
        return;
      }

      const reason = getImageBlockReason(element);

      if (reason) {
        if (shouldDeferBroadImageBlock(element, reason)) {
          deferBroadImageBlock(element, reason);
          return;
        }

        blockImageElement(element, reason);
      } else if (element.dataset.motionblockFeature === "image") {
        restoreElement(element);
      } else if (element.dataset.motionblockPendingImageBlock === "true") {
        clearPendingImageBlock(element);
      }
    });
  }

  function processMedia(root) {
    root.querySelectorAll("video, audio").forEach(function (element) {
      if (element.dataset.motionblockUserAllowed === "true") {
        return;
      }

      const reason = getMediaBlockReason(element);

      if (reason && reason.hardBlock) {
        blockMediaElement(element, reason.label);
      } else if (reason && reason.disableAutoplay) {
        if (element.dataset.motionblockFeature === "media") {
          restoreElement(element);
        }
        disableAutoplay(element);
      } else if (element.dataset.motionblockFeature === "media") {
        restoreElement(element);
      } else if (element.dataset.motionblockBlocked === "true") {
        enforceBlockedMediaElement(element);
      }
    });

    processCustomMediaHosts(root);
  }

  function processCustomMediaHosts(root) {
    const candidates = [];

    root.querySelectorAll(CUSTOM_MEDIA_HOST_SELECTOR).forEach(function (element) {
      candidates.push(element);
    });

    root.querySelectorAll("source[src], source[srcset]").forEach(function (source) {
      const host = findCustomMediaHost(source);
      if (host) {
        candidates.push(host);
      }
    });

    uniqueElements(candidates).forEach(processCustomMediaHost);
  }

  function processCustomMediaHost(element) {
    if (element.dataset.motionblockUserAllowed === "true" || isNativeMediaElement(element)) {
      return;
    }

    const reason = getCustomMediaHostBlockReason(element);

    if (reason && reason.hardBlock) {
      blockCustomMediaHostElement(element, reason.label);
    } else if (element.dataset.motionblockFeature === "media" && element.dataset.motionblockCustomHost === "true") {
      restoreElement(element);
    } else if (element.dataset.motionblockBlocked === "true" && element.dataset.motionblockCustomHost === "true") {
      enforceBlockedCustomMediaHostElement(element);
    }
  }

  function stopBlockedMediaPlayback(event) {
    const element = event.target;
    if (!element || (element.tagName !== "VIDEO" && element.tagName !== "AUDIO")) {
      return;
    }

    if (element.dataset.motionblockEnforcing === "true") {
      return;
    }

    if (!effectiveSettings.enabled || element.dataset.motionblockUserAllowed === "true") {
      return;
    }

    const reason = getMediaBlockReason(element);
    if (reason && reason.hardBlock) {
      blockMediaElement(element, reason.label);
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (element.tagName === "VIDEO" && effectiveSettings.features.audio) {
      element.muted = true;
      element.volume = 0;
    }

    if (reason && reason.disableAutoplay) {
      disableAutoplay(element);
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function processEmoji(root) {
    const scope = getEmojiScope(root);
    if (!scope) {
      return;
    }

    scope.querySelectorAll("img.emoji, img.twemoji, img[alt]").forEach(function (image) {
      const alt = image.getAttribute("alt") || "";
      if (containsEmoji(alt)) {
        hideEmojiElement(image);
      }
    });

    scope.querySelectorAll(EMOJI_UI_SELECTORS).forEach(function (element) {
      if (isLikelyEmojiUiElement(element)) {
        hideEmojiElement(element);
      }
    });

    stripEmojiAttributes(scope);
    stripEmojiTextNodes(scope);
  }

  function stripEmojiAttributes(scope) {
    scope.querySelectorAll("*").forEach(function (element) {
      EMOJI_TEXT_ATTRIBUTES.forEach(function (attributeName) {
        const value = element.getAttribute(attributeName);
        if (!value || !containsEmoji(value)) {
          return;
        }

        storeOriginalEmojiAttribute(element, attributeName, value);
        element.setAttribute(attributeName, stripEmoji(value));
      });
    });
  }

  function stripEmojiTextNodes(scope) {
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.nodeValue || !containsEmoji(node.nodeValue)) {
          return NodeFilter.FILTER_REJECT;
        }

        if (isTextNodeInsideIgnoredElement(node)) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const nodes = [];
    let node = walker.nextNode();
    while (node) {
      nodes.push(node);
      node = walker.nextNode();
    }

    nodes.forEach(function (textNode) {
      emojiTextOriginals.set(textNode, textNode.nodeValue);
      textNode.nodeValue = stripEmoji(textNode.nodeValue);
    });
  }

  function hideEmojiElement(element) {
    element.classList.add("motionblock-emoji-hidden");
    if (element.tagName === "IMG") {
      element.classList.add("motionblock-emoji-image");
    }
  }

  function restoreEmojiElements(root) {
    const scope = getEmojiScope(root);
    if (!scope) {
      return;
    }

    scope.querySelectorAll(".motionblock-emoji-hidden, .motionblock-emoji-image").forEach(function (element) {
      element.classList.remove("motionblock-emoji-hidden", "motionblock-emoji-image");
    });

    restoreEmojiAttributes(scope);
    restoreEmojiTextNodes(scope);
  }

  function isLikelyEmojiUiElement(element) {
    if (element.closest(".motionblock-reveal-button")) {
      return false;
    }

    if (element.matches("g-emoji, img.emoji, img.twemoji, [data-emoji], [data-emoji-name], [data-reaction-label], [data-reaction-content]")) {
      return true;
    }

    const text = [
      element.getAttribute("alt"),
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.getAttribute("data-testid"),
      element.getAttribute("data-test-id"),
      element.getAttribute("data-reaction-label"),
      element.getAttribute("data-reaction-content"),
      element.textContent
    ]
      .filter(Boolean)
      .join(" ");

    if (containsEmoji(text)) {
      return true;
    }

    return /\b(emoji|reaction|react|thumbs up|thumbs down|hooray|heart|rocket|eyes|laugh|confused)\b/i.test(text);
  }

  function getEmojiScope(root) {
    if (!root) {
      return null;
    }

    if (root.nodeType === Node.DOCUMENT_NODE) {
      return root.body || root.documentElement;
    }

    if (root.nodeType === Node.DOCUMENT_FRAGMENT_NODE || root.nodeType === Node.ELEMENT_NODE) {
      return root;
    }

    return null;
  }

  function containsEmoji(value) {
    return createEmojiRegex().test(String(value || ""));
  }

  function stripEmoji(value) {
    return String(value || "").replace(createEmojiRegex(), "").replace(/[\ufe0e\ufe0f]\u200d?/g, "");
  }

  function createEmojiRegex() {
    try {
      return new RegExp(EMOJI_REGEX_SOURCE, "gu");
    } catch (error) {
      EMOJI_FALLBACK_PATTERN.lastIndex = 0;
      return EMOJI_FALLBACK_PATTERN;
    }
  }

  function storeOriginalEmojiAttribute(element, attributeName, value) {
    let originals = emojiAttributeOriginals.get(element);
    if (!originals) {
      originals = {};
      emojiAttributeOriginals.set(element, originals);
    }

    originals[attributeName] = value;
  }

  function restoreEmojiAttributes(scope) {
    scope.querySelectorAll("*").forEach(function (element) {
      const originals = emojiAttributeOriginals.get(element);
      if (!originals) {
        return;
      }

      Object.keys(originals).forEach(function (attributeName) {
        element.setAttribute(attributeName, originals[attributeName]);
      });
      emojiAttributeOriginals.delete(element);
    });
  }

  function restoreEmojiTextNodes(scope) {
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();

    while (node) {
      if (emojiTextOriginals.has(node)) {
        node.nodeValue = emojiTextOriginals.get(node);
        emojiTextOriginals.delete(node);
      }

      node = walker.nextNode();
    }
  }

  function shouldInspectImages() {
    const features = effectiveSettings.features;
    return features.images || features.gifs || features.gifv || features.animatedWebp;
  }

  function shouldInspectMedia() {
    const features = effectiveSettings.features;
    return features.video || features.audio || features.autoplayVideo || features.gifv || features.gifs;
  }

  function getImageBlockReason(element) {
    const features = effectiveSettings.features;
    const urls = collectElementUrls(element);

    if (features.images) {
      return "image";
    }

    const gifUrls = urls.filter(isGifUrl);
    const staticGifUiAsset = gifUrls.length && isLikelyStaticGifUiAsset(element, gifUrls);
    if (features.gifs && gifUrls.length && !staticGifUiAsset) {
      return "GIF";
    }

    if (features.gifs && !staticGifUiAsset && looksLikeGifLikeMotion(element, urls)) {
      return "GIF-like media";
    }

    if (features.gifv && urls.some(isGifvUrl)) {
      return "GIFV";
    }

    if (features.animatedWebp && urls.some(isWebpUrl)) {
      return "WebP";
    }

    return "";
  }

  function getMediaBlockReason(element) {
    const tag = element.tagName.toLowerCase();
    const features = effectiveSettings.features;
    const urls = collectElementUrls(element);
    const gifLikeVideo =
      tag === "video" && (features.gifv || features.gifs) && (urls.some(isGifvUrl) || looksLikeGifLikeMotion(element, urls));
    const wasLooping = element.loop || element.hasAttribute("loop") || Boolean(element.dataset.motionblockOriginalLoop);
    const wasAutoplay =
      element.autoplay || element.hasAttribute("autoplay") || Boolean(element.dataset.motionblockOriginalAutoplay);
    const loopingMutedVideo = tag === "video" && wasLooping && element.muted && !element.controls;
    const autoplayVideo = tag === "video" && wasAutoplay;

    if (tag === "video" && features.video) {
      return { hardBlock: true, label: "video" };
    }

    if (tag === "audio" && features.audio) {
      return { hardBlock: true, label: "audio" };
    }

    if (tag === "video" && features.autoplayVideo && (gifLikeVideo || loopingMutedVideo)) {
      return { hardBlock: true, label: "looping video" };
    }

    if (tag === "video" && features.autoplayVideo && autoplayVideo) {
      return { disableAutoplay: true, label: "autoplay video" };
    }

    return null;
  }

  function getCustomMediaHostBlockReason(element) {
    if (!isLikelyCustomMediaHost(element)) {
      return null;
    }

    const features = effectiveSettings.features;
    const urls = collectElementUrls(element);
    const metadata = getCustomMediaHostMetadata(element);
    const explicitGifHost = element.hasAttribute("gif");
    const autoplayOrLooping = element.hasAttribute("autoplay") || element.hasAttribute("loop") || explicitGifHost;
    const videoLike = VIDEO_HOST_TEXT_PATTERN.test(metadata) || urls.some(isVideoUrl);
    const audioLike = AUDIO_HOST_TEXT_PATTERN.test(metadata) || urls.some(isAudioUrl);
    const gifLike =
      explicitGifHost ||
      urls.some(isGifvUrl) ||
      looksLikeGifLikeMotion(element, urls) ||
      GIF_LIKE_TEXT_PATTERN.test(metadata) ||
      /\b(gif|gifv|animation)\b/i.test(metadata);

    if (features.gifv && urls.some(isGifvUrl)) {
      return { hardBlock: true, label: "GIFV" };
    }

    if (features.gifs && explicitGifHost) {
      return { hardBlock: true, label: "GIF-like media" };
    }

    if ((features.gifv || features.gifs) && gifLike && autoplayOrLooping) {
      return { hardBlock: true, label: "GIF-like media" };
    }

    if (features.autoplayVideo && autoplayOrLooping && videoLike) {
      return { hardBlock: true, label: "autoplay video" };
    }

    if (features.video && videoLike) {
      return { hardBlock: true, label: "video" };
    }

    if (features.audio && audioLike) {
      return { hardBlock: true, label: "audio" };
    }

    return null;
  }

  function isNativeMediaElement(element) {
    return element.tagName === "VIDEO" || element.tagName === "AUDIO";
  }

  function isLikelyCustomMediaHost(element) {
    if (!element || !element.isConnected || element.closest(".motionblock-reveal-button")) {
      return false;
    }

    const tag = element.tagName.toLowerCase();
    if (tag === "img" || tag === "picture" || tag === "source" || tag === "track") {
      return false;
    }

    const metadata = getCustomMediaHostMetadata(element);
    const urls = collectElementUrls(element);
    const hasMediaName = MEDIA_HOST_TEXT_PATTERN.test(metadata);
    const customElement = tag.indexOf("-") !== -1;
    const hasMediaUrl = urls.some(isVideoUrl) || urls.some(isAudioUrl) || urls.some(isGifvUrl);
    const hasMediaChild = Boolean(element.querySelector("source[src], source[srcset], video, audio"));

    return hasMediaName && (customElement || element.hasAttribute("autoplay") || element.hasAttribute("loop") || hasMediaUrl || hasMediaChild);
  }

  function getCustomMediaHostMetadata(element) {
    return [
      element.tagName,
      element.id,
      getElementClassName(element),
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.getAttribute("role"),
      element.getAttribute("slot"),
      element.getAttribute("data-testid"),
      element.getAttribute("data-test-id"),
      element.getAttribute("data-media-id"),
      element.getAttribute("data-video-id"),
      element.getAttribute("data-hls-url"),
      element.getAttribute("src"),
      element.hasAttribute("gif") ? "gif" : ""
    ]
      .filter(Boolean)
      .join(" ");
  }

  function findCustomMediaHost(element) {
    let current = element.parentElement;
    let depth = 0;

    while (current && current !== document.body && current !== document.documentElement && depth < 5) {
      if (!isNativeMediaElement(current) && isLikelyCustomMediaHost(current)) {
        return current;
      }

      current = current.parentElement;
      depth += 1;
    }

    return null;
  }

  function blockImageElement(element, reason) {
    if (element.dataset.motionblockBlocked === "true") {
      refreshImagePlaceholder(element);
      ensureRevealOverlay(element, "Show blocked image");
      return;
    }

    storeOriginalAttribute(element, "alt");
    storeOriginalAttribute(element, "src");
    storeOriginalAttribute(element, "srcset");
    storeOriginalAttribute(element, "sizes");
    storeOriginalAttribute(element, "title");

    element.dataset.motionblockBlocked = "true";
    element.dataset.motionblockFeature = "image";
    element.dataset.motionblockReason = reason;
    element.title = element.title || "Blocked by MotionBlock: " + reason;
    clearPendingImageBlock(element);

    if (element.tagName.toLowerCase() === "source") {
      element.removeAttribute("srcset");
      return;
    }

    if (effectiveSettings.replacementMode === "hide") {
      element.classList.add("motionblock-media-hidden");
    } else {
      const placeholderSize = lockDisplayedSize(element, reason);
      element.classList.add("motionblock-media-placeholder");
      applyContainerPlaceholder(element, placeholderSize);
    }

    element.removeAttribute("srcset");
    element.removeAttribute("sizes");
    element.setAttribute("src", PLACEHOLDER_SRC);
    element.setAttribute("alt", "Blocked " + reason);
    ensureRevealOverlay(element, "Show blocked image");
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

    schedulePendingImageBlock(element, BROAD_IMAGE_SETTLE_DELAY_MS);
    schedulePendingImageBlock(element, BROAD_IMAGE_BLOCK_TIMEOUT_MS);
  }

  function handlePendingImageLoad(event) {
    schedulePendingImageBlock(event.currentTarget, BROAD_IMAGE_SETTLE_DELAY_MS);
  }

  function schedulePendingImageBlock(element, delay) {
    window.setTimeout(function () {
      if (!element.isConnected || element.dataset.motionblockPendingImageBlock !== "true") {
        return;
      }

      if (!effectiveSettings.enabled || !effectiveSettings.features.images) {
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
    return started > 0 && Date.now() - started >= BROAD_IMAGE_BLOCK_TIMEOUT_MS;
  }

  function clearPendingImageBlock(element) {
    element.classList.remove("motionblock-image-pending");
    delete element.dataset.motionblockPendingImageBlock;
    delete element.dataset.motionblockPendingImageReason;
    delete element.dataset.motionblockPendingImageStarted;
  }

  function refreshImagePlaceholder(element) {
    if (effectiveSettings.replacementMode === "hide" || element.tagName.toLowerCase() === "source") {
      return;
    }

    const reason = element.dataset.motionblockReason || "image";
    const placeholderSize = lockDisplayedSize(element, reason);
    element.classList.add("motionblock-media-placeholder");
    applyContainerPlaceholder(element, placeholderSize);
  }

  function blockMediaElement(element, reason) {
    if (element.dataset.motionblockBlocked === "true") {
      enforceBlockedMediaElement(element);
      ensureRevealOverlay(element, element.tagName === "AUDIO" ? "Play blocked audio" : "Play blocked video");
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

    element.dataset.motionblockBlocked = "true";
    element.dataset.motionblockFeature = "media";
    element.dataset.motionblockReason = reason;
    element.title = element.title || "Blocked by MotionBlock: " + reason;

    element.querySelectorAll("source").forEach(function (source) {
      storeOriginalAttribute(source, "src");
      storeOriginalAttribute(source, "srcset");
      source.dataset.motionblockSourceBlocked = "true";
    });

    element.classList.add(
      effectiveSettings.replacementMode === "hide" ? "motionblock-media-hidden" : "motionblock-media-placeholder"
    );
    enforceBlockedMediaElement(element);
    ensureRevealOverlay(element, element.tagName === "AUDIO" ? "Play blocked audio" : "Play blocked video");
  }

  function blockCustomMediaHostElement(element, reason) {
    if (element.dataset.motionblockBlocked === "true") {
      enforceBlockedCustomMediaHostElement(element);
      ensureRevealOverlay(element, "Play blocked media");
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

    element.dataset.motionblockBlocked = "true";
    element.dataset.motionblockFeature = "media";
    element.dataset.motionblockCustomHost = "true";
    element.dataset.motionblockReason = reason;
    element.title = element.title || "Blocked by MotionBlock: " + reason;

    element.classList.add(
      effectiveSettings.replacementMode === "hide" ? "motionblock-media-hidden" : "motionblock-media-placeholder"
    );
    enforceBlockedCustomMediaHostElement(element);
    ensureRevealOverlay(element, "Play blocked media");
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

      if (element.srcObject) {
        element.srcObject = null;
      }

      element.querySelectorAll("source").forEach(function (source) {
        source.dataset.motionblockSourceBlocked = "true";
        source.removeAttribute("src");
        source.removeAttribute("srcset");
      });

      element.removeAttribute("src");
      if (element.src) {
        element.src = "";
      }

      if (typeof element.load === "function") {
        element.load();
      }
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
        source.dataset.motionblockSourceBlocked = "true";
        source.removeAttribute("src");
        source.removeAttribute("srcset");
      });

      element.removeAttribute("src");
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

  function setMediaPropertyIfPresent(element, propertyName, value) {
    try {
      if (propertyName in element) {
        element[propertyName] = value;
      }
    } catch (error) {
      return;
    }
  }

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
      return;
    }

    storeOriginalAttribute(element, "autoplay");
    storeOriginalAttribute(element, "preload");
    element.dataset.motionblockAutoplayAdjusted = "true";
    element.removeAttribute("autoplay");
    element.autoplay = false;
    element.setAttribute("preload", "metadata");
    element.pause();
  }

  function restoreBlockedElements() {
    queryAllProcessingRoots("[data-motionblock-blocked='true'], [data-motionblock-autoplay-adjusted='true']").forEach(
      restoreElement
    );
    queryAllProcessingRoots("[data-motionblock-source-blocked='true']").forEach(restoreElement);
  }

  function restoreElementsByFeature(feature) {
    queryAllProcessingRoots("[data-motionblock-feature='" + feature + "']").forEach(restoreElement);
  }

  function restoreElement(element) {
    const restoresMediaSources =
      element.tagName === "VIDEO" || element.tagName === "AUDIO" || element.dataset.motionblockCustomHost === "true";

    removeRevealButton(element);
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
    restoreOriginalMediaState(element);

    element.classList.remove("motionblock-media-placeholder", "motionblock-media-hidden", "motionblock-image-pending");
    delete element.dataset.motionblockBlocked;
    delete element.dataset.motionblockFeature;
    delete element.dataset.motionblockCustomHost;
    delete element.dataset.motionblockReason;
    delete element.dataset.motionblockAutoplayAdjusted;
    delete element.dataset.motionblockSourceBlocked;
    delete element.dataset.motionblockEnforcing;
    delete element.dataset.motionblockPendingImageBlock;
    delete element.dataset.motionblockPendingImageReason;
    delete element.dataset.motionblockPendingImageStarted;

    element.style.width = element.dataset.motionblockOriginalStyleWidth || "";
    element.style.height = element.dataset.motionblockOriginalStyleHeight || "";
    delete element.dataset.motionblockOriginalStyleWidth;
    delete element.dataset.motionblockOriginalStyleHeight;

    removePlaceholderContainer(element);

    if (restoresMediaSources) {
      element.querySelectorAll("[data-motionblock-source-blocked='true']").forEach(restoreElement);
    }

    if (typeof element.load === "function" && (element.tagName === "VIDEO" || element.tagName === "AUDIO")) {
      element.load();
    }

    markForLoadRetry(element);
  }

  function ensureRevealOverlay(element, label) {
    if (!effectiveSettings.showRevealControls) {
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
    if (!effectiveSettings.showRevealControls) {
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
    if (rect.width <= 1 || rect.height <= 1 || rect.bottom <= 0 || rect.right <= 0 || rect.top >= window.innerHeight || rect.left >= window.innerWidth) {
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
    if (!chrome.runtime || !chrome.runtime.sendMessage) {
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
      await chrome.runtime.sendMessage({
        type: "motionblock:allowUrlsOnce",
        urls,
        resourceTypes
      });
    } catch (error) {
      return;
    }
  }

  function storeOriginalAttribute(element, attributeName) {
    const key = getOriginalAttributeKey(attributeName);
    if (Object.prototype.hasOwnProperty.call(element.dataset, key)) {
      return;
    }

    element.dataset[key] = element.hasAttribute(attributeName) ? element.getAttribute(attributeName) : "";
  }

  function storeOriginalMediaState(element) {
    storeOriginalMediaProperty(element, "autoplay");
    storeOriginalMediaProperty(element, "loop");
    storeOriginalMediaProperty(element, "muted");
    storeOriginalMediaProperty(element, "volume");
  }

  function storeOriginalMediaProperty(element, propertyName) {
    const key = getOriginalMediaPropertyKey(propertyName);
    if (!(propertyName in element) || Object.prototype.hasOwnProperty.call(element.dataset, key)) {
      return;
    }

    const value = element[propertyName];
    element.dataset[key] = typeof value === "number" ? String(value) : value ? "true" : "false";
  }

  function restoreOriginalMediaState(element) {
    restoreOriginalMediaProperty(element, "autoplay", "boolean");
    restoreOriginalMediaProperty(element, "loop", "boolean");
    restoreOriginalMediaProperty(element, "muted", "boolean");
    restoreOriginalMediaProperty(element, "volume", "number");
  }

  function restoreOriginalMediaProperty(element, propertyName, type) {
    const key = getOriginalMediaPropertyKey(propertyName);
    if (!(propertyName in element) || !Object.prototype.hasOwnProperty.call(element.dataset, key)) {
      return;
    }

    try {
      const value = element.dataset[key];
      element[propertyName] = type === "number" ? Number(value) : value === "true";
    } catch (error) {
      return;
    } finally {
      delete element.dataset[key];
    }
  }

  function restoreOriginalAttribute(element, attributeName) {
    const key = getOriginalAttributeKey(attributeName);
    if (!Object.prototype.hasOwnProperty.call(element.dataset, key)) {
      return;
    }

    const value = element.dataset[key];
    if (value) {
      element.setAttribute(attributeName, value);
    } else {
      element.removeAttribute(attributeName);
    }
    delete element.dataset[key];
  }

  function getOriginalAttributeKey(attributeName) {
    return "motionblockOriginal" + attributeName.charAt(0).toUpperCase() + attributeName.slice(1);
  }

  function getOriginalMediaPropertyKey(propertyName) {
    return "motionblockOriginalMedia" + propertyName.charAt(0).toUpperCase() + propertyName.slice(1);
  }

  function lockDisplayedSize(element, reason) {
    const size = getPlaceholderSize(element, reason);

    if (!Object.prototype.hasOwnProperty.call(element.dataset, "motionblockOriginalStyleWidth")) {
      element.dataset.motionblockOriginalStyleWidth = element.style.width || "";
    }

    if (!Object.prototype.hasOwnProperty.call(element.dataset, "motionblockOriginalStyleHeight")) {
      element.dataset.motionblockOriginalStyleHeight = element.style.height || "";
    }

    if (size && size.width > 8 && size.height > 8) {
      element.style.width = Math.round(size.width) + "px";
      element.style.height = Math.round(size.height) + "px";
    }

    return size;
  }

  function getPlaceholderSize(element, reason) {
    const rect = element.getBoundingClientRect();
    const inferredSize = getInferredCollapsedImagePlaceholderSize(element, reason, rect);
    if (inferredSize) {
      return inferredSize;
    }

    if (isUsablePlaceholderRect(rect)) {
      return {
        width: rect.width,
        height: rect.height,
        source: "element"
      };
    }

    const widthAttribute = parseDimensionAttribute(element.getAttribute("width"));
    const heightAttribute = parseDimensionAttribute(element.getAttribute("height"));
    if (widthAttribute > 8 && heightAttribute > 8) {
      return {
        width: widthAttribute,
        height: heightAttribute,
        source: "attribute"
      };
    }

    const container = findPlaceholderContainer(element);
    if (container) {
      return {
        width: container.rect.width,
        height: container.rect.height,
        source: "container",
        container: container.element
      };
    }

    return null;
  }

  function getInferredCollapsedImagePlaceholderSize(element, reason, rect) {
    if (reason !== "image" || !isUsablePlaceholderRect(rect) || isLikelyInterfaceImage(element)) {
      return null;
    }

    if (isCollapsedTallRect(rect)) {
      return {
        width: inferWidthFromHeight(element, rect.height),
        height: rect.height,
        source: "inferred"
      };
    }

    if (isCollapsedWideRect(rect)) {
      return {
        width: rect.width,
        height: inferHeightFromWidth(element, rect.width),
        source: "inferred"
      };
    }

    return null;
  }

  function isCollapsedTallRect(rect) {
    return rect.height >= 96 && rect.width <= 80 && rect.width / rect.height < 0.35;
  }

  function isCollapsedWideRect(rect) {
    return rect.width >= 96 && rect.height <= 80 && rect.width / rect.height > 2.8;
  }

  function inferWidthFromHeight(element, height) {
    const naturalRatio = getUsableNaturalAspectRatio(element);
    const estimatedWidth = naturalRatio ? height * naturalRatio : height;
    return clampNumber(estimatedWidth, 120, getMaximumInferredPlaceholderWidth());
  }

  function inferHeightFromWidth(element, width) {
    const naturalRatio = getUsableNaturalAspectRatio(element);
    const estimatedHeight = naturalRatio ? width / naturalRatio : width * 0.75;
    return clampNumber(estimatedHeight, 90, 320);
  }

  function getUsableNaturalAspectRatio(element) {
    if (element.naturalWidth <= 1 || element.naturalHeight <= 1) {
      return 0;
    }

    return clampNumber(element.naturalWidth / element.naturalHeight, 0.25, 4);
  }

  function getMaximumInferredPlaceholderWidth() {
    return Math.min(420, Math.max(180, window.innerWidth * 0.35));
  }

  function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function parseDimensionAttribute(value) {
    const parsed = Number.parseFloat(String(value || "").replace("px", ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function findPlaceholderContainer(element) {
    let container = element.parentElement;
    let depth = 0;

    while (container && container !== document.body && container !== document.documentElement && depth < 5) {
      const rect = container.getBoundingClientRect();
      if (isUsablePlaceholderRect(rect) && isLikelyMediaContainer(container)) {
        return {
          element: container,
          rect
        };
      }

      container = container.parentElement;
      depth += 1;
    }

    return null;
  }

  function isUsablePlaceholderRect(rect) {
    if (!rect || rect.width <= 8 || rect.height <= 8) {
      return false;
    }

    const maxWidth = Math.max(320, window.innerWidth * 0.95);
    const maxHeight = Math.max(240, window.innerHeight * 0.8);
    return rect.width <= maxWidth && rect.height <= maxHeight;
  }

  function isLikelyMediaContainer(element) {
    const tag = element.tagName.toLowerCase();
    const metadata = [
      element.tagName,
      element.id,
      getElementClassName(element),
      element.getAttribute("aria-label"),
      element.getAttribute("data-testid"),
      element.getAttribute("data-test-id")
    ]
      .filter(Boolean)
      .join(" ");

    if (/\b(img|image|media|photo|picture|poster|preview|thumb|thumbnail|video|yt-image|ytd-thumbnail)\b/i.test(metadata)) {
      return true;
    }

    if (!/^(a|div|figure|span)$/.test(tag)) {
      return false;
    }

    return element.childElementCount <= 2 && !(element.textContent || "").trim();
  }

  function applyContainerPlaceholder(element, size) {
    if (!size || size.source !== "container" || !size.container) {
      return;
    }

    size.container.classList.add("motionblock-media-container-placeholder");
    placeholderContainers.set(element, size.container);
  }

  function removePlaceholderContainer(element) {
    const container = placeholderContainers.get(element) || element.closest(".motionblock-media-container-placeholder");
    if (!container) {
      return;
    }

    placeholderContainers.delete(element);
    if (!container.querySelector("[data-motionblock-blocked='true'][data-motionblock-feature='image']")) {
      container.classList.remove("motionblock-media-container-placeholder");
    }
  }

  function collectElementUrls(element) {
    const urls = [];
    ["src", "srcset", "poster", "data-src", "data-original", "data-lazy-src"].forEach(function (attributeName) {
      const value = element.getAttribute(attributeName);
      if (value) {
        urls.push.apply(urls, splitUrlAttribute(value));
      }
    });

    ["motionblockOriginalSrc", "motionblockOriginalSrcset", "motionblockOriginalPoster"].forEach(function (key) {
      const value = element.dataset[key];
      if (value) {
        urls.push.apply(urls, splitUrlAttribute(value));
      }
    });

    if (element.currentSrc) {
      urls.push(element.currentSrc);
    }

    element.querySelectorAll("source").forEach(function (source) {
      urls.push.apply(urls, collectElementUrls(source));
    });

    return urls;
  }

  function splitUrlAttribute(value) {
    if (/^\s*data:/i.test(String(value || ""))) {
      return [String(value).trim()];
    }

    return String(value)
      .split(",")
      .map(function (part) {
        return part.trim().split(/\s+/)[0];
      })
      .filter(Boolean);
  }

  function normalizeUrl(value) {
    return String(value || "").trim().toLowerCase();
  }

  function normalizeRequestUrl(value) {
    try {
      const url = new URL(String(value || ""), document.baseURI);
      if (url.protocol === "http:" || url.protocol === "https:" || url.protocol === "file:") {
        return url.href;
      }
    } catch (error) {
      return "";
    }

    return "";
  }

  function isGifUrl(value) {
    const url = normalizeUrl(value);
    return /^data:image\/gif/.test(url) || /\.gif(?:$|[?#])/.test(url) || /[?&]format=gif(?:&|$)/.test(url);
  }

  function isLikelyStaticGifUiAsset(element, gifUrls) {
    if (!gifUrls.length) {
      return false;
    }

    if (gifUrls.every(isLikelyTransparentGifDataUrl)) {
      return true;
    }

    if (!isLikelyInterfaceImage(element)) {
      return false;
    }

    return isLikelyTinyImageElement(element) || isLikelySmallDisplayedImage(element);
  }

  function isLikelyTransparentGifDataUrl(value) {
    const url = String(value || "")
      .trim()
      .replace(/\s+/g, "")
      .toLowerCase();

    if (!/^data:image\/gif/.test(url)) {
      return false;
    }

    if (url.length > 260) {
      return false;
    }

    return /base64,r0lgodlhaqab/.test(url) || /base64,r0lgoddhaqab/.test(url);
  }

  function isLikelyTinyImageElement(element) {
    const widthAttribute = parseDimensionAttribute(element.getAttribute("width"));
    const heightAttribute = parseDimensionAttribute(element.getAttribute("height"));

    if (widthAttribute > 0 && heightAttribute > 0 && widthAttribute <= 4 && heightAttribute <= 4) {
      return true;
    }

    if (element.naturalWidth > 0 && element.naturalHeight > 0 && element.naturalWidth <= 4 && element.naturalHeight <= 4) {
      return true;
    }

    return false;
  }

  function isLikelySmallDisplayedImage(element) {
    const rect = element.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return false;
    }

    return rect.width <= 48 && rect.height <= 48;
  }

  function isLikelyInterfaceImage(element) {
    if (element.closest("button, [role='button'], [role='checkbox'], [role='menuitem'], [role='tab'], [role='switch'], input, label")) {
      return true;
    }

    const metadata = [
      element.getAttribute("alt"),
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.getAttribute("role"),
      element.getAttribute("data-tooltip"),
      element.getAttribute("data-tooltip-id"),
      element.getAttribute("data-testid"),
      element.getAttribute("data-test-id"),
      getElementClassName(element)
    ]
      .filter(Boolean)
      .join(" ");

    return /\b(icon|sprite|spacer|transparent|button|checkbox|menu|toolbar|control|nav|navigation)\b/i.test(metadata);
  }

  function isGifvUrl(value) {
    const url = normalizeUrl(value);
    return /\.gifv(?:$|[?#])/.test(url) || /[?&]format=gifv(?:&|$)/.test(url);
  }

  function isWebpUrl(value) {
    const url = normalizeUrl(value);
    return /^data:image\/webp/.test(url) || /\.webp(?:$|[?#])/.test(url);
  }

  function isVideoUrl(value) {
    const url = normalizeUrl(value);
    return /\.(?:mp4|m4v|webm|mov|m3u8|mpd)(?:$|[?#])/.test(url) || /v\.redd\.it|redgifs\.com/.test(url);
  }

  function isAudioUrl(value) {
    const url = normalizeUrl(value);
    return /\.(?:mp3|m4a|aac|ogg|oga|wav|flac)(?:$|[?#])/.test(url);
  }

  function looksLikeGifLikeMotion(element, urls) {
    const metadata = [
      CURRENT_HOST,
      element.id,
      getElementClassName(element),
      element.getAttribute("alt"),
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.getAttribute("data-testid"),
      element.getAttribute("data-test-id")
    ]
      .filter(Boolean)
      .join(" ");

    if (GIF_LIKE_TEXT_PATTERN.test(metadata)) {
      return true;
    }

    return urls.some(function (value) {
      const url = normalizeUrl(value);
      return GIF_LIKE_URL_PATTERN.test(url);
    });
  }

  function getElementClassName(element) {
    if (!element.className) {
      return "";
    }

    if (typeof element.className === "string") {
      return element.className;
    }

    return element.className.baseVal || "";
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(value);
    }

    return String(value).replace(/['"\\]/g, "\\$&");
  }

  function isTextNodeInsideIgnoredElement(node) {
    let element = node.parentElement;
    while (element) {
      const tag = element.tagName.toLowerCase();
      if (tag === "script" || tag === "style" || tag === "textarea" || tag === "input" || element.isContentEditable) {
        return true;
      }
      element = element.parentElement;
    }
    return false;
  }
})();
