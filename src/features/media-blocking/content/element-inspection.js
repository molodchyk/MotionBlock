(function (root) {
  "use strict";

  const GIF_LIKE_TEXT_PATTERN = /\b(gif|gifv|giphy|tenor|looping|animated)\b/i;
  const GIF_LIKE_URL_PATTERN =
    /(giphy\.com|media\.tenor\.com|tenor\.com|gfycat\.com|redgifs\.com|external-preview\.redd\.it|preview\.redd\.it|\.gifv(?:$|[?#])|[?&](?:format|type)=gifv?(?:&|$)|\/gif[s/]?)/i;
  const GIF_LIKE_IMAGE_URL_PATTERN =
    /(giphy\.com|media\.tenor\.com|tenor\.com|gfycat\.com|redgifs\.com|\.gifv(?:$|[?#])|[?&](?:format|type)=gifv?(?:&|$)|\/gif[s/]?)/i;
  const urlUtils = root.MotionBlockMediaUrlUtils;

  function createMediaElementInspector(options) {
    const collectCssBackgroundUrls = options.collectCssBackgroundUrls;
    const currentHost = options.currentHost || "";
    const document = options.document;
    const window = options.window;

    function isLikelyStaticGifUiAsset(element, gifUrls) {
      if (!gifUrls.length) {
        return false;
      }

      if (gifUrls.every(urlUtils.isLikelyTransparentGifDataUrl)) {
        return true;
      }

      if (!isLikelyInterfaceImage(element)) {
        return false;
      }

      return isLikelyTinyImageElement(element) || isLikelySmallDisplayedImage(element);
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

    function isLikelyInterfaceBackgroundElement(element) {
      if (
        element.closest(
          "button, [role='button'], [role='checkbox'], [role='menuitem'], [role='tab'], [role='switch'], input, label"
        )
      ) {
        return true;
      }

      const rect = element.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) {
        return true;
      }

      if (rect.width <= 48 && rect.height <= 48) {
        return true;
      }

      const metadata = [
        element.tagName,
        element.id,
        getElementClassName(element),
        element.getAttribute("aria-label"),
        element.getAttribute("title"),
        element.getAttribute("role"),
        element.getAttribute("data-testid"),
        element.getAttribute("data-test-id")
      ]
        .filter(Boolean)
        .join(" ");

      if (/\b(icon|sprite|spacer|transparent|button|checkbox|menu|toolbar|control|nav|navigation)\b/i.test(metadata)) {
        return rect.width <= 96 && rect.height <= 96;
      }

      return false;
    }

    function isLikelyHiddenAccessibilityImage(element) {
      if (!element || element.tagName.toLowerCase() !== "img") {
        return false;
      }

      let style;
      try {
        style = window.getComputedStyle(element);
      } catch (error) {
        return false;
      }

      const opacity = Number.parseFloat(style.opacity || "1");
      const zIndex = Number.parseInt(style.zIndex || "0", 10);
      const hiddenByPaint = opacity <= 0.05 || (Number.isFinite(zIndex) && zIndex < 0);

      if (!hiddenByPaint || style.position !== "absolute") {
        return false;
      }

      return hasNearbyCssBackgroundWithSameUrl(element, options.collectElementUrls(element));
    }

    function looksLikeGifLikeImage(element, urls) {
      const metadata = [
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
        const url = urlUtils.normalizeUrl(value);
        return GIF_LIKE_IMAGE_URL_PATTERN.test(url);
      });
    }

    function looksLikeGifLikeMotion(element, urls) {
      const metadata = [
        currentHost,
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
        const url = urlUtils.normalizeUrl(value);
        return GIF_LIKE_URL_PATTERN.test(url);
      });
    }

    function hasNearbyCssBackgroundWithSameUrl(element, urls) {
      const normalizedUrls = urls.map(normalizeComparableUrl).filter(Boolean);
      if (!normalizedUrls.length || !element.parentElement) {
        return false;
      }

      const candidates = [];
      let current = element.parentElement;
      let depth = 0;

      while (current && current !== document.body && current !== document.documentElement && depth < 4) {
        candidates.push(current);
        Array.prototype.forEach.call(current.children || [], function (child) {
          if (child !== element) {
            candidates.push(child);
          }
        });
        current = current.parentElement;
        depth += 1;
      }

      return candidates.some(function (candidate) {
        return collectCssBackgroundUrls(candidate).some(function (backgroundUrl) {
          return normalizedUrls.indexOf(normalizeComparableUrl(backgroundUrl)) !== -1;
        });
      });
    }

    function normalizeComparableUrl(value) {
      try {
        return new URL(String(value || ""), document.baseURI).href;
      } catch (error) {
        return String(value || "").trim();
      }
    }

    return {
      isLikelyHiddenAccessibilityImage,
      isLikelyInterfaceBackgroundElement,
      isLikelyInterfaceImage,
      isLikelyStaticGifUiAsset,
      isTextNodeInsideIgnoredElement,
      looksLikeGifLikeImage,
      looksLikeGifLikeMotion
    };
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

  function getElementClassName(element) {
    if (!element.className) {
      return "";
    }

    if (typeof element.className === "string") {
      return element.className;
    }

    return element.className.baseVal || "";
  }

  function parseDimensionAttribute(value) {
    const parsed = Number.parseFloat(String(value || ""));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  root.MotionBlockMediaElementInspector = {
    createMediaElementInspector
  };
})(globalThis);
