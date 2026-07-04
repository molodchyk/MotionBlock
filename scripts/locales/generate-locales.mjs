import fs from "node:fs/promises";
import dns from "node:dns";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ENGLISH_MESSAGES, STORE_LISTING_EN, SUPPORTED_LOCALES, toChromeMessages } from "./locale-source.mjs";
import { normalizeProtectedTokenSpacing } from "./locale-text-utils.mjs";

dns.setDefaultResultOrder("ipv4first");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const LIVE_TRANSLATION = process.argv.includes("--live");
const ONLY_MISSING = process.argv.includes("--missing");
const SLOW_MODE = process.argv.includes("--slow");
const USE_MYMEMORY = process.argv.includes("--mymemory");
const USE_EDGE = process.argv.includes("--edge");
const DELIMITER = "|||MBLOC|||";
const DELIMITER_SPLIT_PATTERN = /\s*\|{2,}\s*MBLOC\s*\|{2,}\s*/;
const TOKEN_PATTERN =
  /https:\/\/github\.com\/molodchyk\/MotionBlock|\$[A-Z0-9_]+\$|GPL-3\.0|MotionBlock|Manifest V3|HTML5|JSON|GIFV|GIFs|GIF|WebP|CSS|Chrome|reddit\.com|discord\.com|news\.example\.com|YouTube|Reddit|Giphy/g;

const GOOGLE_LOCALES = {
  en_AU: "en",
  en_GB: "en",
  en_US: "en",
  es_419: "es",
  pt_BR: "pt",
  pt_PT: "pt-PT",
  zh_CN: "zh-CN",
  zh_TW: "zh-TW"
};

const MYMEMORY_LOCALES = {
  el: "el-GR",
  bg: "bg-BG",
  mk: "mk-MK",
  ru: "ru-RU",
  sr: "sr-RS",
  uk: "uk-UA",
  hy: "hy-AM",
  he: "he-IL",
  ur: "ur-PK",
  ar: "ar-SA",
  ne: "ne-NP",
  mr: "mr-IN",
  hi: "hi-IN",
  bn: "bn-BD",
  pa: "pa-IN",
  gu: "gu-IN",
  ta: "ta-IN",
  te: "te-IN",
  kn: "kn-IN",
  ml: "ml-IN",
  si: "si-LK",
  th: "th-TH",
  ka: "ka-GE",
  am: "am-ET",
  zh_CN: "zh-CN",
  zh_TW: "zh-TW",
  ja: "ja-JP",
  ko: "ko-KR"
};

const EDGE_LOCALES = {
  sr: "sr-Cyrl",
  zh_CN: "zh-Hans",
  zh_TW: "zh-Hant"
};

let edgeToken = "";

async function main() {
  const messageEntries = Object.entries(ENGLISH_MESSAGES);
  const listingDirectory = path.join(ROOT, "store-assets", "store-listing");

  await fs.mkdir(path.join(ROOT, "_locales"), { recursive: true });
  await fs.mkdir(listingDirectory, { recursive: true });

  for (const locale of SUPPORTED_LOCALES) {
    const localeDirectory = path.join(ROOT, "_locales", locale);
    const messagesPath = path.join(localeDirectory, "messages.json");
    const listingPath = path.join(listingDirectory, `${locale}.txt`);

    if (ONLY_MISSING && (await exists(messagesPath)) && (await exists(listingPath))) {
      console.log(`skipped ${locale}`);
      continue;
    }

    const translatedMessages = await translateMessageEntries(messageEntries, locale);
    const storeListing = await translateListing(STORE_LISTING_EN, locale);

    await fs.mkdir(localeDirectory, { recursive: true });
    await fs.writeFile(messagesPath, JSON.stringify(toChromeMessages(Object.fromEntries(translatedMessages)), null, 2) + "\n", "utf8");
    await fs.writeFile(listingPath, normalizeListing(storeListing), "utf8");
    console.log(`generated ${locale}`);
  }
}

async function translateMessageEntries(entries, locale) {
  if (isEnglishLocale(locale) || !LIVE_TRANSLATION) {
    return entries;
  }

  const values = entries.map(function ([, value]) {
    return value;
  });
  const translatedValues = await translateTexts(values, locale);
  return entries.map(function ([key], index) {
    return [key, translatedValues[index]];
  });
}

async function translateTexts(values, locale) {
  const translated = [];
  const chunkSize = SLOW_MODE ? 8 : 28;

  for (let index = 0; index < values.length; index += chunkSize) {
    const chunk = values.slice(index, index + chunkSize);
    translated.push(...(await translateChunk(chunk, locale)));
  }

  return translated;
}

async function translateChunk(values, locale) {
  const protectedValues = values.map(protectTokens);
  const joined = protectedValues
    .map(function (value) {
      return value.text;
    })
    .join(`\n${DELIMITER}\n`);
  const translated = await translateRaw(joined, locale);
  const parts = translated.split(DELIMITER_SPLIT_PATTERN);

  if (parts.length !== values.length) {
    const fallbackParts = [];
    for (let index = 0; index < values.length; index += 1) {
      fallbackParts.push(await translateText(values[index], locale));
    }
    return fallbackParts;
  }

  return parts.map(function (part, index) {
    return normalizeProtectedTokenSpacing(restoreTokens(part, protectedValues[index].tokens));
  });
}

async function translateText(value, locale) {
  if (isEnglishLocale(locale) || !LIVE_TRANSLATION) {
    return value;
  }

  const protectedValue = protectTokens(value);
  const translated = await translateRaw(protectedValue.text, locale);
  return normalizeProtectedTokenSpacing(restoreTokens(translated, protectedValue.tokens));
}

async function translateListing(value, locale) {
  if (isEnglishLocale(locale) || !LIVE_TRANSLATION) {
    return value;
  }

  const lines = String(value).split(/\r?\n/);
  const translatedLines = [];
  for (const line of lines) {
    translatedLines.push(line.trim() ? await translateText(line, locale) : "");
  }
  return translatedLines.join("\n");
}

async function translateRaw(value, locale) {
  if (USE_EDGE) {
    return translateWithEdge(value, locale);
  }

  if (USE_MYMEMORY) {
    return translateWithMyMemory(value, locale);
  }

  const targetLocale = GOOGLE_LOCALES[locale] || locale.replace(/_/g, "-");
  const params = new URLSearchParams({
    client: "gtx",
    sl: "en",
    tl: targetLocale,
    dt: "t",
    q: value
  });

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch("https://translate.googleapis.com/translate_a/single", {
        method: "POST",
        body: params,
        headers: {
          "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
          "user-agent": "MotionBlock locale generator"
        }
      });

      if (!response.ok) {
        throw new Error(`translation HTTP ${response.status}`);
      }

      const payload = await response.json();
      if (!Array.isArray(payload) || !Array.isArray(payload[0])) {
        throw new Error("translation response shape changed");
      }

      await sleep(SLOW_MODE ? 800 : 20);
      return payload[0]
        .map(function (part) {
          return part[0] || "";
        })
        .join("");
    } catch (error) {
      if (attempt === 3) {
        throw error;
      }
      await sleep((SLOW_MODE ? 8000 : 500) * attempt);
    }
  }

  return value;
}

async function translateWithEdge(value, locale) {
  const targetLocale = EDGE_LOCALES[locale] || locale.replace(/_/g, "-");

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(function () {
      controller.abort();
    }, SLOW_MODE ? 30000 : 15000);

    try {
      const token = await getEdgeToken();
      const response = await fetch(
        `https://api-edge.cognitive.microsofttranslator.com/translate?from=en&to=${encodeURIComponent(targetLocale)}&api-version=3.0`,
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json"
          },
          body: JSON.stringify([{ Text: value }])
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          edgeToken = "";
        }
        throw new Error(`Edge translator HTTP ${response.status}`);
      }

      const payload = await response.json();
      const translatedText = payload && payload[0] && payload[0].translations && payload[0].translations[0].text;
      if (typeof translatedText !== "string") {
        throw new Error("Edge translator response shape changed");
      }

      await sleep(SLOW_MODE ? 200 : 20);
      return translatedText;
    } catch (error) {
      if (attempt === 4) {
        throw error;
      }
      await sleep((SLOW_MODE ? 3000 : 500) * attempt);
    } finally {
      clearTimeout(timeout);
    }
  }

  return value;
}

async function getEdgeToken() {
  if (edgeToken) {
    return edgeToken;
  }

  const response = await fetch("https://edge.microsoft.com/translate/auth");
  if (!response.ok) {
    throw new Error(`Edge translator auth HTTP ${response.status}`);
  }
  edgeToken = await response.text();
  return edgeToken;
}

async function translateWithMyMemory(value, locale) {
  const targetLocale = MYMEMORY_LOCALES[locale] || locale.replace(/_/g, "-");
  const params = new URLSearchParams({
    q: value,
    langpair: `en|${targetLocale}`
  });

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(function () {
      controller.abort();
    }, SLOW_MODE ? 30000 : 15000);

    try {
      const response = await fetch(`https://api.mymemory.translated.net/get?${params.toString()}`, {
        signal: controller.signal,
        headers: {
          "user-agent": "MotionBlock locale generator"
        }
      });

      if (!response.ok) {
        throw new Error(`MyMemory HTTP ${response.status}`);
      }

      const payload = await response.json();
      if (payload.quotaFinished) {
        throw new Error("MyMemory quota finished");
      }
      if (!payload.responseData || typeof payload.responseData.translatedText !== "string") {
        throw new Error(`MyMemory failed for ${locale}: ${payload.responseDetails || "unknown error"}`);
      }

      await sleep(SLOW_MODE ? 800 : 80);
      return payload.responseData.translatedText;
    } catch (error) {
      if (attempt === 4) {
        throw error;
      }
      await sleep((SLOW_MODE ? 5000 : 800) * attempt);
    } finally {
      clearTimeout(timeout);
    }
  }

  return value;
}

function protectTokens(value) {
  const tokens = [];
  const text = String(value).replace(TOKEN_PATTERN, function (match) {
    const token = `__MBTOKEN_${tokens.length}__`;
    tokens.push([token, match]);
    return token;
  });

  return { text, tokens };
}

function restoreTokens(value, tokens) {
  return tokens.reduce(function (text, [token, original], index) {
    const exactPattern = escapeRegExp(token).replace(/_/g, "\\s*_\\s*");
    const translatedPattern = `__\\s*[^\\d\\n]{0,40}?\\s*_?\\s*${index}\\s*__`;
    return text
      .replace(new RegExp(exactPattern, "giu"), original)
      .replace(new RegExp(translatedPattern, "giu"), original);
  }, value);
}

function normalizeListing(value) {
  return normalizeProtectedTokenSpacing(value)
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim() + "\n";
}

function isEnglishLocale(locale) {
  return locale === "en" || locale.startsWith("en_");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
}

main().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
