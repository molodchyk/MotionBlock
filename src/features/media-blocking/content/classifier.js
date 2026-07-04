(function (root) {
  "use strict";

  const urlUtils = root.MotionBlockMediaUrlUtils;
  const extractCssUrls = urlUtils.extractCssUrls;
  const isAudioUrl = urlUtils.isAudioUrl;
  const isGifUrl = urlUtils.isGifUrl;
  const isGifvUrl = urlUtils.isGifvUrl;
  const isLikelyTransparentGifDataUrl = urlUtils.isLikelyTransparentGifDataUrl;
  const isVideoUrl = urlUtils.isVideoUrl;
  const isWebpUrl = urlUtils.isWebpUrl;
  const normalizeUrl = urlUtils.normalizeUrl;
  const splitUrlAttribute = urlUtils.splitUrlAttribute;

  function createMediaClassifier(options) {
    const currentHost = options.currentHost || "";
    const document = options.document;
    const getOriginalStylePropertyKey = options.getOriginalStylePropertyKey;
    const mediaRuntimeOriginals = options.mediaRuntimeOriginals;
    const window = options.window;
    const cssBackgroundUrlsDataKey = options.cssBackgroundUrlsDataKey;
    const elementInspector = root.MotionBlockMediaElementInspector.createMediaElementInspector({
      collectCssBackgroundUrls,
      collectElementUrls,
      currentHost,
      document,
      window
    });
    const customHostClassifier = root.MotionBlockCustomMediaHosts.createCustomHostClassifier({
      collectElementUrls,
      document,
      looksLikeGifLikeMotion: elementInspector.looksLikeGifLikeMotion
    });
    const findCustomMediaHost = customHostClassifier.findCustomMediaHost;
    const getCustomMediaHostBlockReason = customHostClassifier.getCustomMediaHostBlockReason;
    const isLikelyHiddenAccessibilityImage = elementInspector.isLikelyHiddenAccessibilityImage;
    const isLikelyInterfaceBackgroundElement = elementInspector.isLikelyInterfaceBackgroundElement;
    const isLikelyInterfaceImage = elementInspector.isLikelyInterfaceImage;
    const isLikelyStaticGifUiAsset = elementInspector.isLikelyStaticGifUiAsset;
    const isNativeMediaElement = customHostClassifier.isNativeMediaElement;
    const isTextNodeInsideIgnoredElement = elementInspector.isTextNodeInsideIgnoredElement;
    const looksLikeGifLikeImage = elementInspector.looksLikeGifLikeImage;
    const looksLikeGifLikeMotion = elementInspector.looksLikeGifLikeMotion;

    function getImageBlockReason(effectiveSettings, element) {
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

      if (features.gifs && !staticGifUiAsset && looksLikeGifLikeImage(element, urls)) {
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

    function getCssBackgroundBlockReason(effectiveSettings, element) {
      const features = effectiveSettings.features;
      const urls = collectCssBackgroundUrls(element);

      if (!urls.length || isLikelyInterfaceBackgroundElement(element)) {
        return "";
      }

      if (features.images) {
        return "image";
      }

      if (features.gifs && urls.some(isGifUrl)) {
        return "GIF";
      }

      if (features.gifv && urls.some(isGifvUrl)) {
        return "GIFV";
      }

      if (features.animatedWebp && urls.some(isWebpUrl)) {
        return "WebP";
      }

      if (features.gifs && looksLikeGifLikeImage(element, urls)) {
        return "GIF-like media";
      }

      return "";
    }

    function getMediaBlockReason(effectiveSettings, element) {
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

      if (tag === "video" && features.autoplayVideo && gifLikeVideo) {
        return { hardBlock: true, label: "looping video" };
      }

      if (tag === "video" && features.autoplayVideo && (loopingMutedVideo || autoplayVideo)) {
        return { disableAutoplay: true, label: "autoplay video" };
      }

      return null;
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

      const runtimeOriginals = mediaRuntimeOriginals.get(element);
      if (runtimeOriginals && runtimeOriginals.src) {
        urls.push(runtimeOriginals.src);
      }

      element.querySelectorAll("source").forEach(function (source) {
        urls.push.apply(urls, collectElementUrls(source));
      });

      return urls;
    }

    function collectCssBackgroundUrls(element) {
      const values = [];
      const urls = [];

      ["data-bg", "data-background", "data-background-image"].forEach(function (attributeName) {
        const value = element.getAttribute(attributeName);
        if (value) {
          values.push(value);
        }
      });

      if (element.style) {
        values.push(element.style.backgroundImage || "");
        values.push(element.style.background || "");
      }

      values.push(element.getAttribute("style") || "");

      const originalBackgroundImage = element.dataset[getOriginalStylePropertyKey("backgroundImage")];
      if (originalBackgroundImage) {
        values.push(originalBackgroundImage);
      }

      const storedBackgroundUrls = element.dataset[cssBackgroundUrlsDataKey];
      if (storedBackgroundUrls) {
        urls.push.apply(
          urls,
          storedBackgroundUrls
            .split(/\n+/)
            .map(function (url) {
              return url.trim();
            })
            .filter(Boolean)
        );
      }

      try {
        const style = window.getComputedStyle(element);
        values.push(style.backgroundImage || "");
      } catch (error) {
        urls.push.apply(urls, values.flatMap(extractCssUrls));
        return uniqueValues(urls);
      }

      urls.push.apply(urls, values.flatMap(extractCssUrls));
      return uniqueValues(urls);
    }

    function rememberCssBackgroundUrls(element, urls) {
      const normalized = uniqueValues((urls || []).map(normalizeComparableUrl).filter(Boolean)).slice(0, 16);

      if (normalized.length) {
        element.dataset[cssBackgroundUrlsDataKey] = normalized.join("\n");
      }
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

    function cssEscape(value) {
      if (window.CSS && typeof window.CSS.escape === "function") {
        return window.CSS.escape(value);
      }

      return String(value).replace(/['"\\]/g, "\\$&");
    }

    return {
      collectCssBackgroundUrls,
      collectElementUrls,
      cssEscape,
      findCustomMediaHost,
      getCssBackgroundBlockReason,
      getCustomMediaHostBlockReason,
      getImageBlockReason,
      getMediaBlockReason,
      isLikelyHiddenAccessibilityImage,
      isLikelyInterfaceImage,
      isNativeMediaElement,
      isTextNodeInsideIgnoredElement,
      normalizeRequestUrl,
      rememberCssBackgroundUrls
    };
  }

  function uniqueValues(values) {
    const seen = new Set();
    const result = [];

    values.forEach(function (value) {
      if (!seen.has(value)) {
        seen.add(value);
        result.push(value);
      }
    });

    return result;
  }

  root.MotionBlockMediaClassifier = {
    createMediaClassifier,
    extractCssUrls,
    isAudioUrl,
    isGifUrl,
    isGifvUrl,
    isVideoUrl,
    isWebpUrl,
    splitUrlAttribute
  };
})(globalThis);
