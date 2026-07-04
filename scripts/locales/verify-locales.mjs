import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ENGLISH_MESSAGES, PLACEHOLDERS, STORE_LISTING_EN, SUPPORTED_LOCALES } from "./locale-source.mjs";
import { normalizeProtectedTokenSpacing } from "./locale-text-utils.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const LOCALES_DIR = path.join(ROOT, "_locales");
const LISTING_DIR = path.join(ROOT, "store-assets", "store-listing");
const RTL_LOCALES = ["ar", "fa", "he", "ur"];
const LOCALE_EXPECTED_MESSAGES = {
  ru: {
    allowThisSite: "Разрешить этот сайт",
    blockMotionHere: "Блокировать движение здесь",
    copyDiagnostics: "Скопировать журнал",
    optionsButton: "Настройки",
    optionsTitle: "Настройки MotionBlock",
    refreshDiagnostics: "Обновить",
    reloadTab: "Перезагрузить",
    resetSite: "Сбросить сайт",
    selectAllowHere: "Разрешить здесь",
    selectBlock: "Блокировать",
    selectBlockHere: "Блокировать здесь",
    selectUseGlobal: "Глобальные настройки",
    websitePreferencesIntro: "Используйте точные доменные имена, например reddit.com, discord.com или news.example.com."
  }
};
const LOCALE_FORBIDDEN_SNIPPETS = {
  ru: ["Перезарядка", "Журнал копирования", "MotionBlock Варианты", "Блок-моушн", "Позвольте здесь", "Использовать глобальный"]
};
const englishKeys = Object.keys(ENGLISH_MESSAGES).sort();

const localeDirectories = fs
  .readdirSync(LOCALES_DIR, { withFileTypes: true })
  .filter(function (entry) {
    return entry.isDirectory();
  })
  .map(function (entry) {
    return entry.name;
  })
  .sort();

assertSameSet(localeDirectories, SUPPORTED_LOCALES, "_locales directories");

SUPPORTED_LOCALES.forEach(function (locale) {
  const messagesPath = path.join(LOCALES_DIR, locale, "messages.json");
  const listingPath = path.join(LISTING_DIR, `${locale}.txt`);
  assert(fs.existsSync(messagesPath), `${locale} is missing messages.json`);
  assert(fs.existsSync(listingPath), `${locale} is missing store listing file`);

  const messages = JSON.parse(fs.readFileSync(messagesPath, "utf8"));
  const keys = Object.keys(messages).sort();
  assertSameSet(keys, englishKeys, `${locale} message keys`);
  assertLocaleSpecificQa(locale, messages);

  keys.forEach(function (key) {
    const entry = messages[key];
    assert(entry && typeof entry.message === "string", `${locale}.${key} must have a string message`);
    assert(entry.message.trim(), `${locale}.${key} is empty`);
    assert(!/undefined|null/.test(entry.message), `${locale}.${key} contains a generated placeholder word`);
    assert(
      entry.message === normalizeProtectedTokenSpacing(entry.message),
      `${locale}.${key} has protected token spacing drift: ${entry.message}`
    );
    assertPlaceholderShape(locale, key, entry);
  });

  const listing = fs.readFileSync(listingPath, "utf8");
  assertListing(locale, listing);
  assert(
    listing === normalizeProtectedTokenSpacing(listing),
    `${locale} store listing has protected token spacing drift`
  );
  assertTranslationCoverage(locale, messages, listing);
});

const i18nSource = fs.readFileSync(path.join(ROOT, "src", "shared", "i18n.js"), "utf8");
RTL_LOCALES.forEach(function (locale) {
  assert(i18nSource.includes(`"${locale}"`), `RTL locale ${locale} is missing from src/shared/i18n.js`);
});

const revealControlsSource = fs.readFileSync(path.join(ROOT, "src", "features", "media-blocking", "content", "reveal-controls.js"), "utf8");
assert(revealControlsSource.includes("button.dir = i18n.getDirection()"), "content reveal buttons must set their own direction");

console.log(`locale verification ok (${SUPPORTED_LOCALES.length} locales)`);

function assertPlaceholderShape(locale, key, entry) {
  const expectedNames = Object.keys(PLACEHOLDERS[key] || {}).sort();
  const actualNames = Object.keys(entry.placeholders || {}).sort();
  assertSameSet(actualNames, expectedNames, `${locale}.${key} placeholders`);

  const messageTokens = extractMessageTokens(entry.message);
  expectedNames.forEach(function (name) {
    assert(messageTokens.includes(name), `${locale}.${key} message is missing $${name.toUpperCase()}$`);
  });
}

function extractMessageTokens(message) {
  return Array.from(String(message).matchAll(/\$([A-Z0-9_]+)\$/g)).map(function (match) {
    return match[1].toLowerCase();
  });
}

function assertListing(locale, listing) {
  const trimmed = listing.trim();
  assert(trimmed, `${locale} store listing is empty`);
  assert(!trimmed.startsWith("#"), `${locale} store listing must not start with a Markdown heading`);
  assert(!/^MotionBlock\b/.test(trimmed), `${locale} store listing must not start with the extension name`);
  assert(!/^(Name|Summary|Description|Detailed Description)\s*:/i.test(trimmed), `${locale} store listing starts with a field label`);
  assert(trimmed.includes("https://github.com/molodchyk/MotionBlock"), `${locale} store listing is missing the GitHub URL`);
  assert(trimmed.includes("GPL-3.0"), `${locale} store listing is missing GPL-3.0`);
}

function assertTranslationCoverage(locale, messages, listing) {
  if (locale === "en" || locale.startsWith("en_")) {
    return;
  }

  const changedMessages = Object.keys(ENGLISH_MESSAGES).filter(function (key) {
    return messages[key].message !== ENGLISH_MESSAGES[key];
  });
  const unchangedLongMessages = Object.keys(ENGLISH_MESSAGES).filter(function (key) {
    return messages[key].message === ENGLISH_MESSAGES[key] && isLongTranslatableEnglish(ENGLISH_MESSAGES[key]);
  });

  assert(changedMessages.length >= 45, `${locale} has too many untranslated UI messages`);
  assert(
    unchangedLongMessages.length === 0,
    `${locale} has untranslated long UI messages: ${unchangedLongMessages.join(", ")}`
  );
  assert(listing.trim() !== STORE_LISTING_EN.trim(), `${locale} store listing is not translated`);
  assertMateriallyLocalizedListing(locale, listing);
}

function assertLocaleSpecificQa(locale, messages) {
  const expected = LOCALE_EXPECTED_MESSAGES[locale] || {};
  Object.keys(expected).forEach(function (key) {
    assert(messages[key] && messages[key].message === expected[key], `${locale}.${key} must be "${expected[key]}"`);
  });

  const forbidden = LOCALE_FORBIDDEN_SNIPPETS[locale] || [];
  const haystack = JSON.stringify(messages);
  forbidden.forEach(function (snippet) {
    assert(!haystack.includes(snippet), `${locale} contains forbidden translation snippet: ${snippet}`);
  });
}

function assertMateriallyLocalizedListing(locale, listing) {
  const unchangedLines = STORE_LISTING_EN.split(/\r?\n/)
    .map(function (line) {
      return line.trim();
    })
    .filter(isLongTranslatableEnglish)
    .filter(function (line) {
      return listing.includes(line);
    });
  assert(unchangedLines.length === 0, `${locale} store listing has untranslated English lines: ${unchangedLines.join(" | ")}`);
}

function isLongTranslatableEnglish(value) {
  const text = String(value || "").trim();
  if (text.length < 18 || /^https?:\/\//.test(text)) {
    return false;
  }
  const withoutProtected = text.replace(/MotionBlock|GIFV|GIFs|GIF|WebP|CSS|JSON|HTML5|Chrome|YouTube|Reddit|Giphy|GPL-3\.0|https:\/\/github\.com\/molodchyk\/MotionBlock/g, "").trim();
  return /[a-z]{3,}/.test(withoutProtected);
}

function assertSameSet(actual, expected, label) {
  const actualSorted = [...actual].sort();
  const expectedSorted = [...expected].sort();
  assert(
    JSON.stringify(actualSorted) === JSON.stringify(expectedSorted),
    `${label} mismatch\nactual: ${actualSorted.join(", ")}\nexpected: ${expectedSorted.join(", ")}`
  );
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
