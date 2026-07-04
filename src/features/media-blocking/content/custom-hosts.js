(function (root) {
  "use strict";

  const GIF_LIKE_TEXT_PATTERN = /\b(gif|gifv|giphy|tenor|looping|animated)\b/i;
  const MEDIA_HOST_TEXT_PATTERN = /\b(video|player|media|gif|gifv|animation|stream|embed|audio|sound|music|podcast)\b/i;
  const VIDEO_HOST_TEXT_PATTERN = /\b(video|player|media|gif|gifv|animation|stream|embed)\b/i;
  const AUDIO_HOST_TEXT_PATTERN = /\b(audio|sound|music|podcast|player|media|stream|embed)\b/i;
  const urlUtils = root.MotionBlockMediaUrlUtils;

  function createCustomHostClassifier(options) {
    const collectElementUrls = options.collectElementUrls;
    const document = options.document;
    const looksLikeGifLikeMotion = options.looksLikeGifLikeMotion;

    function getCustomMediaHostBlockReason(effectiveSettings, element) {
      if (!isLikelyCustomMediaHost(element)) {
        return null;
      }

      const features = effectiveSettings.features;
      const urls = collectElementUrls(element);
      const metadata = getCustomMediaHostMetadata(element);
      const explicitGifHost = element.hasAttribute("gif");
      const autoplayOrLooping = element.hasAttribute("autoplay") || element.hasAttribute("loop") || explicitGifHost;
      const videoLike = VIDEO_HOST_TEXT_PATTERN.test(metadata) || urls.some(urlUtils.isVideoUrl);
      const audioLike = AUDIO_HOST_TEXT_PATTERN.test(metadata) || urls.some(urlUtils.isAudioUrl);
      const gifLike =
        explicitGifHost ||
        urls.some(urlUtils.isGifvUrl) ||
        looksLikeGifLikeMotion(element, urls) ||
        GIF_LIKE_TEXT_PATTERN.test(metadata) ||
        /\b(gif|gifv|animation)\b/i.test(metadata);

      if (features.gifv && urls.some(urlUtils.isGifvUrl)) {
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
      const hasMediaUrl = urls.some(urlUtils.isVideoUrl) || urls.some(urlUtils.isAudioUrl) || urls.some(urlUtils.isGifvUrl);
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

    return {
      findCustomMediaHost,
      getCustomMediaHostBlockReason,
      isNativeMediaElement
    };
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

  root.MotionBlockCustomMediaHosts = {
    createCustomHostClassifier
  };
})(globalThis);
