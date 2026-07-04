(function (root) {
  "use strict";

  const RTL_LOCALES = new Set(["ar", "fa", "he", "ur"]);

  function getUiLocale() {
    if (root.chrome && root.chrome.i18n && typeof root.chrome.i18n.getUILanguage === "function") {
      return normalizeLocale(root.chrome.i18n.getUILanguage());
    }

    if (root.navigator && root.navigator.language) {
      return normalizeLocale(root.navigator.language);
    }

    return "en";
  }

  function normalizeLocale(locale) {
    return String(locale || "en").replace(/-/g, "_");
  }

  function getLanguageTag(locale) {
    return normalizeLocale(locale || getUiLocale()).replace(/_/g, "-");
  }

  function getDirection(locale) {
    return RTL_LOCALES.has(normalizeLocale(locale || getUiLocale()).split("_")[0]) ? "rtl" : "ltr";
  }

  function getMessage(key, substitutions) {
    if (!root.chrome || !root.chrome.i18n || typeof root.chrome.i18n.getMessage !== "function") {
      return "";
    }

    const normalizedSubstitutions = Array.isArray(substitutions)
      ? substitutions.map(String)
      : substitutions === undefined || substitutions === null
        ? undefined
        : String(substitutions);

    return root.chrome.i18n.getMessage(key, normalizedSubstitutions) || "";
  }

  function t(key, substitutions, fallback) {
    const message = getMessage(key, substitutions);
    if (message) {
      return message;
    }

    return formatFallback(fallback || key, substitutions);
  }

  function formatFallback(value, substitutions) {
    const replacements = Array.isArray(substitutions)
      ? substitutions
      : substitutions === undefined || substitutions === null
        ? []
        : [substitutions];

    return String(value).replace(/\$([A-Z0-9_]+)\$/g, function (match) {
      const token = match.slice(1, -1).toLowerCase();
      if (token === "count") {
        return String(replacements[0] || "0");
      }
      if (token === "features" || token === "reason" || token === "error") {
        return String(replacements[0] || "");
      }
      return match;
    });
  }

  function applyDocumentLocale(doc) {
    const locale = getUiLocale();
    const documentElement = doc && doc.documentElement;
    if (!documentElement) {
      return;
    }

    documentElement.lang = getLanguageTag(locale);
    documentElement.dir = getDirection(locale);
  }

  function localizeDocument(doc) {
    const targetDocument = doc || root.document;
    if (!targetDocument) {
      return;
    }

    applyDocumentLocale(targetDocument);

    targetDocument.querySelectorAll("[data-i18n]").forEach(function (element) {
      element.textContent = t(element.dataset.i18n, undefined, element.textContent);
    });

    targetDocument.querySelectorAll("[data-i18n-placeholder]").forEach(function (element) {
      element.setAttribute("placeholder", t(element.dataset.i18nPlaceholder, undefined, element.getAttribute("placeholder") || ""));
    });

    targetDocument.querySelectorAll("[data-i18n-title]").forEach(function (element) {
      element.setAttribute("title", t(element.dataset.i18nTitle, undefined, element.getAttribute("title") || ""));
    });

    targetDocument.querySelectorAll("[data-i18n-aria-label]").forEach(function (element) {
      element.setAttribute(
        "aria-label",
        t(element.dataset.i18nAriaLabel, undefined, element.getAttribute("aria-label") || "")
      );
    });
  }

  root.MotionBlockI18n = {
    RTL_LOCALES: Array.from(RTL_LOCALES),
    applyDocumentLocale,
    getDirection,
    getLanguageTag,
    getUiLocale,
    localizeDocument,
    t
  };
})(globalThis);
