(function (root) {
  "use strict";

  function createMediaOriginalState(options) {
    const document = options.document;
    const isLikelyInterfaceImage = options.isLikelyInterfaceImage;
    const mediaRuntimeOriginals = options.mediaRuntimeOriginals;
    const placeholderContainers = new WeakMap();
    const window = options.window;

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

    function storeOriginalMediaRuntimeState(element) {
      storeOriginalMediaRuntimeProperty(element, "src");
      storeOriginalMediaRuntimeProperty(element, "srcObject");
    }

    function storeOriginalMediaRuntimeProperty(element, propertyName) {
      if (!element || !(propertyName in element)) {
        return;
      }

      let originals = mediaRuntimeOriginals.get(element);
      if (!originals) {
        originals = {};
        mediaRuntimeOriginals.set(element, originals);
      }

      if (Object.prototype.hasOwnProperty.call(originals, propertyName)) {
        return;
      }

      try {
        originals[propertyName] = element[propertyName];
      } catch (error) {
        originals[propertyName] = null;
      }
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

    function restoreOriginalMediaRuntimeState(element) {
      const originals = mediaRuntimeOriginals.get(element);
      if (!originals) {
        return;
      }

      restoreOriginalMediaRuntimeProperty(element, originals, "srcObject");
      if (!originals.srcObject) {
        restoreOriginalMediaRuntimeProperty(element, originals, "src");
      }

      mediaRuntimeOriginals.delete(element);
    }

    function restoreOriginalMediaRuntimeProperty(element, originals, propertyName) {
      if (!(propertyName in element) || !Object.prototype.hasOwnProperty.call(originals, propertyName)) {
        return;
      }

      try {
        element[propertyName] = originals[propertyName];
      } catch (error) {
        return;
      }
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

    function storeOriginalStyleProperty(element, propertyName) {
      const key = getOriginalStylePropertyKey(propertyName);
      const priorityKey = key + "Priority";
      if (Object.prototype.hasOwnProperty.call(element.dataset, key)) {
        return;
      }

      const cssPropertyName = camelCaseToCssPropertyName(propertyName);
      element.dataset[key] = element.style[propertyName] || "";
      element.dataset[priorityKey] = element.style.getPropertyPriority(cssPropertyName) || "";
    }

    function restoreOriginalStyleProperty(element, propertyName) {
      const key = getOriginalStylePropertyKey(propertyName);
      const priorityKey = key + "Priority";
      if (!Object.prototype.hasOwnProperty.call(element.dataset, key)) {
        return;
      }

      const cssPropertyName = camelCaseToCssPropertyName(propertyName);
      const value = element.dataset[key];
      const priority = element.dataset[priorityKey] || "";

      if (value) {
        element.style.setProperty(cssPropertyName, value, priority);
      } else {
        element.style.removeProperty(cssPropertyName);
      }

      delete element.dataset[key];
      delete element.dataset[priorityKey];
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

    return {
      applyContainerPlaceholder,
      getOriginalAttributeKey,
      getOriginalMediaPropertyKey,
      getOriginalStylePropertyKey,
      lockDisplayedSize,
      removePlaceholderContainer,
      restoreOriginalAttribute,
      restoreOriginalMediaProperty,
      restoreOriginalMediaRuntimeState,
      restoreOriginalMediaState,
      restoreOriginalStyleProperty,
      storeOriginalAttribute,
      storeOriginalMediaProperty,
      storeOriginalMediaRuntimeProperty,
      storeOriginalMediaRuntimeState,
      storeOriginalMediaState,
      storeOriginalStyleProperty
    };
  }

  function getOriginalAttributeKey(attributeName) {
    return "motionblockOriginal" + attributeName.charAt(0).toUpperCase() + attributeName.slice(1);
  }

  function getOriginalMediaPropertyKey(propertyName) {
    return "motionblockOriginalMedia" + propertyName.charAt(0).toUpperCase() + propertyName.slice(1);
  }

  function getOriginalStylePropertyKey(propertyName) {
    return "motionblockOriginalStyle" + propertyName.charAt(0).toUpperCase() + propertyName.slice(1);
  }

  function camelCaseToCssPropertyName(propertyName) {
    return String(propertyName).replace(/[A-Z]/g, function (letter) {
      return "-" + letter.toLowerCase();
    });
  }

  function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function parseDimensionAttribute(value) {
    const parsed = Number.parseFloat(String(value || "").replace("px", ""));
    return Number.isFinite(parsed) ? parsed : 0;
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

  root.MotionBlockMediaOriginalState = {
    createMediaOriginalState,
    getOriginalAttributeKey,
    getOriginalMediaPropertyKey,
    getOriginalStylePropertyKey
  };
})(globalThis);
