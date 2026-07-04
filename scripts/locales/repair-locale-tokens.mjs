import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ENGLISH_MESSAGES, STORE_LISTING_EN, SUPPORTED_LOCALES } from "./locale-source.mjs";
import {
  getProtectedTokens,
  normalizeProtectedTokenSpacing,
  restoreTranslatedTokenPlaceholders
} from "./locale-text-utils.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

SUPPORTED_LOCALES.forEach(function (locale) {
  const messagesPath = path.join(ROOT, "_locales", locale, "messages.json");
  const listingPath = path.join(ROOT, "store-assets", "store-listing", `${locale}.txt`);
  const messages = JSON.parse(fs.readFileSync(messagesPath, "utf8"));

  Object.keys(ENGLISH_MESSAGES).forEach(function (key) {
    const tokens = getProtectedTokens(ENGLISH_MESSAGES[key]);
    messages[key].message = normalizeProtectedTokenSpacing(restoreTranslatedTokenPlaceholders(messages[key].message, tokens));
  });

  fs.writeFileSync(messagesPath, JSON.stringify(messages, null, 2) + "\n", "utf8");

  const listingTokens = getProtectedTokens(STORE_LISTING_EN);
  const listing = fs.readFileSync(listingPath, "utf8");
  fs.writeFileSync(listingPath, normalizeProtectedTokenSpacing(restoreTranslatedTokenPlaceholders(listing, listingTokens)), "utf8");
});

console.log("locale token repair ok");
