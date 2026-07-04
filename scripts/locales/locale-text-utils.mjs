export const PROTECTED_TOKENS = [
  "https://github.com/molodchyk/MotionBlock",
  "news.example.com",
  "reddit.com",
  "discord.com",
  "Manifest V3",
  "GPL-3.0",
  "MotionBlock",
  "YouTube",
  "Reddit",
  "Giphy",
  "HTML5",
  "Chrome",
  "JSON",
  "GIFV",
  "GIFs",
  "WebP",
  "CSS",
  "GIF"
];

export const TOKEN_PATTERN = new RegExp(PROTECTED_TOKENS.map(escapeRegExp).join("|"), "g");

const PROTECTED_TOKEN_ALTERNATION = PROTECTED_TOKENS.map(escapeRegExp).join("|");
const TOKEN_BOUNDARY_CLASS = "\\p{L}\\p{M}\\p{N}";
const PROTECTED_LOOKAHEAD_PATTERN = new RegExp(`([,.:;!?،؛，、。])(?=(?:${PROTECTED_TOKEN_ALTERNATION}|\\$[A-Z0-9_]+\\$))`, "gu");

export function getProtectedTokens(value) {
  const tokens = [];
  String(value).replace(TOKEN_PATTERN, function (match) {
    tokens.push(match);
    return match;
  });
  return tokens;
}

export function restoreTranslatedTokenPlaceholders(value, tokens) {
  return tokens.reduce(function (text, original, index) {
    const translatedPattern = `__\\s*[^\\d\\n]{0,40}?\\s*_?\\s*${index}\\s*__`;
    return text.replace(new RegExp(translatedPattern, "giu"), original);
  }, String(value));
}

export function normalizeProtectedTokenSpacing(value) {
  let text = restoreProtectedTokenFragments(String(value));

  PROTECTED_TOKENS.forEach(function (token) {
    text = token === "GIF" ? normalizeGifTokenSpacing(text) : normalizeTokenSpacing(text, token);
  });

  return text
    .replace(new RegExp(`(?<=[${TOKEN_BOUNDARY_CLASS}])(\\$[A-Z0-9_]+\\$)`, "gu"), " $1")
    .replace(new RegExp(`(\\$[A-Z0-9_]+\\$)(?=[${TOKEN_BOUNDARY_CLASS}])`, "gu"), "$1 ")
    .replace(PROTECTED_LOOKAHEAD_PATTERN, "$1 ")
    .replace(/(\$[A-Z0-9_]+\$)([,;:])(?=\S)/gu, "$1$2 ")
    .replace(/[ \t]{2,}/g, " ");
}

function normalizeTokenSpacing(value, token) {
  const escaped = escapeRegExp(token);
  return String(value)
    .replace(new RegExp(`(?<=[${TOKEN_BOUNDARY_CLASS}])(${escaped})`, "gu"), " $1")
    .replace(new RegExp(`(${escaped})(?=[${TOKEN_BOUNDARY_CLASS}])`, "gu"), "$1 ");
}

function normalizeGifTokenSpacing(value) {
  return String(value)
    .replace(new RegExp(`(?<=[${TOKEN_BOUNDARY_CLASS}])(GIF)(?!(?:s|V)\\b)`, "gu"), " $1")
    .replace(new RegExp(`(GIF)(?!(?:s|V)\\b)(?=[${TOKEN_BOUNDARY_CLASS}])`, "gu"), "$1 ");
}

function restoreProtectedTokenFragments(value) {
  return String(value)
    .replace(/\bGIF\s+s\b/g, "GIFs")
    .replace(/\bGIF\s+V\b/g, "GIFV");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
