(function (root) {
  "use strict";

  const EMOJI_REGEX_SOURCE = [
    "[#*0-9]\\ufe0f?\\u20e3",
    "[\\u{1f1e6}-\\u{1f1ff}]{2}",
    "(?:\\p{Emoji_Presentation}|\\p{Extended_Pictographic})(?:\\ufe0f|\\ufe0e)?[\\u{1f3fb}-\\u{1f3ff}]?(?:\\u200d(?:\\p{Emoji_Presentation}|\\p{Extended_Pictographic})(?:\\ufe0f|\\ufe0e)?[\\u{1f3fb}-\\u{1f3ff}]?)*"
  ].join("|");
  const EMOJI_FALLBACK_PATTERN =
    /[#*0-9]\ufe0f?\u20e3|[\u00a9\u00ae\u203c\u2049\u2122\u2139\u2194-\u21aa\u231a-\u231b\u2328\u23cf\u23e9-\u23f3\u23f8-\u23fa\u24c2\u25aa-\u25ab\u25b6\u25c0\u25fb-\u25fe\u2600-\u27bf\u2934-\u2935\u2b05-\u2b55\u3030\u303d\u3297\u3299]|\ud83c[\udde6-\uddff]|\ud83c[\udf00-\udfff]|\ud83d[\udc00-\ude4f]|\ud83d[\ude80-\udeff]|\ud83e[\udd00-\uddff]/g;
  const EMOJI_TEXT_ATTRIBUTES = ["alt", "aria-label", "data-reaction-content", "data-reaction-label", "data-title", "data-tooltip", "data-tooltip-text", "placeholder", "title"];
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

  function createEmojiBlocker(options) {
    const attributeBlockCounts = options.attributeBlockCounts;
    const attributeOriginals = options.attributeOriginals;
    const dataKeys = options.dataKeys;
    const document = options.document;
    const isTextNodeInsideIgnoredElement = options.isTextNodeInsideIgnoredElement;
    const nodeFilterShowText = options.nodeFilterShowText;
    const nodeTypes = options.nodeTypes;
    const stats = options.stats;
    const textBlockCounts = options.textBlockCounts;
    const textOriginals = options.textOriginals;

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
          if (value && containsEmoji(value)) {
            storeOriginalEmojiAttribute(element, attributeName, value);
            element.setAttribute(attributeName, stripEmoji(value));
          }
        });
      });
    }

    function stripEmojiTextNodes(scope) {
      const walker = document.createTreeWalker(scope, nodeFilterShowText);
      let textNode = walker.nextNode();

      while (textNode) {
        const next = walker.nextNode();
        if (textNode.nodeValue && containsEmoji(textNode.nodeValue) && !isTextNodeInsideIgnoredElement(textNode)) {
          if (!textOriginals.has(textNode)) {
            const count = countEmojiMatches(textNode.nodeValue);
            textOriginals.set(textNode, textNode.nodeValue);
            textBlockCounts.set(textNode, count);
            stats.incrementElementNumeric(textNode.parentElement, dataKeys.emojiTextStat, count);
            stats.adjust("emoji", count);
          }
          textNode.nodeValue = stripEmoji(textNode.nodeValue);
        }
        textNode = next;
      }
    }

    function hideEmojiElement(element) {
      stats.markEmojiElement(element);
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
        stats.unmarkEmojiElement(element);
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

      if (root.nodeType === nodeTypes.DOCUMENT_NODE) {
        return root.body || root.documentElement;
      }

      if (root.nodeType === nodeTypes.DOCUMENT_FRAGMENT_NODE || root.nodeType === nodeTypes.ELEMENT_NODE) {
        return root;
      }

      return null;
    }

    function storeOriginalEmojiAttribute(element, attributeName, value) {
      let originals = attributeOriginals.get(element);
      if (!originals) {
        originals = {};
        attributeOriginals.set(element, originals);
      }

      if (!Object.prototype.hasOwnProperty.call(originals, attributeName)) {
        let counts = attributeBlockCounts.get(element);
        if (!counts) {
          counts = {};
          attributeBlockCounts.set(element, counts);
        }

        const count = countEmojiMatches(value);
        counts[attributeName] = count;
        stats.incrementElementNumeric(element, dataKeys.emojiAttributeStat, count);
        stats.adjust("emoji", count);
      }

      originals[attributeName] = value;
    }

    function restoreEmojiAttributes(scope) {
      scope.querySelectorAll("*").forEach(function (element) {
        const originals = attributeOriginals.get(element);
        if (!originals) {
          return;
        }

        Object.keys(originals).forEach(function (attributeName) {
          element.setAttribute(attributeName, originals[attributeName]);
        });

        const counts = attributeBlockCounts.get(element);
        if (counts) {
          const total = Object.keys(counts).reduce(function (sum, attributeName) {
            return sum + Number(counts[attributeName] || 0);
          }, 0);
          stats.decrementElementNumeric(element, dataKeys.emojiAttributeStat, total);
          stats.adjust("emoji", -total);
          attributeBlockCounts.delete(element);
        }

        attributeOriginals.delete(element);
      });
    }

    function restoreEmojiTextNodes(scope) {
      const walker = document.createTreeWalker(scope, nodeFilterShowText);
      let node = walker.nextNode();

      while (node) {
        if (textOriginals.has(node)) {
          const count = Number(textBlockCounts.get(node) || 0);
          stats.decrementElementNumeric(node.parentElement, dataKeys.emojiTextStat, count);
          stats.adjust("emoji", -count);
          node.nodeValue = textOriginals.get(node);
          textOriginals.delete(node);
          textBlockCounts.delete(node);
        }

        node = walker.nextNode();
      }
    }

    return {
      processEmoji,
      restoreEmojiElements
    };
  }

  function countEmojiMatches(value) {
    const matches = String(value || "").match(createEmojiRegex());
    return matches ? matches.length : 0;
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

  root.MotionBlockEmojiBlocker = {
    countEmojiMatches,
    createEmojiBlocker,
    stripEmoji
  };
})(globalThis);
