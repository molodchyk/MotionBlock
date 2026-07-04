(function (root) {
  "use strict";

  function extractCssUrls(value) {
    const urls = [];
    const text = String(value || "");
    const pattern = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gi;
    let match = pattern.exec(text);

    while (match) {
      const url = (match[1] || match[2] || match[3] || "").trim();
      if (url) {
        urls.push(url);
      }
      match = pattern.exec(text);
    }

    return urls;
  }

  function splitUrlAttribute(value) {
    if (/^\s*data:/i.test(String(value || ""))) {
      return [String(value).trim()];
    }

    return String(value)
      .split(",")
      .map(function (part) {
        return part.trim().split(/\s+/)[0];
      })
      .filter(Boolean);
  }

  function normalizeUrl(value) {
    return String(value || "").trim().toLowerCase();
  }

  function isGifUrl(value) {
    const url = normalizeUrl(value);
    return /^data:image\/gif/.test(url) || /\.gif(?:$|[?#])/.test(url) || /[?&]format=gif(?:&|$)/.test(url);
  }

  function isGifvUrl(value) {
    const url = normalizeUrl(value);
    return /\.gifv(?:$|[?#])/.test(url) || /[?&]format=gifv(?:&|$)/.test(url);
  }

  function isWebpUrl(value) {
    const url = normalizeUrl(value);
    return /^data:image\/webp/.test(url) || /\.webp(?:$|[?#])/.test(url);
  }

  function isVideoUrl(value) {
    const url = normalizeUrl(value);
    return /\.(?:mp4|m4v|webm|mov|m3u8|mpd)(?:$|[?#])/.test(url) || /v\.redd\.it|redgifs\.com/.test(url);
  }

  function isAudioUrl(value) {
    const url = normalizeUrl(value);
    return /\.(?:mp3|m4a|aac|ogg|oga|wav|flac)(?:$|[?#])/.test(url);
  }

  function isLikelyTransparentGifDataUrl(value) {
    const url = String(value || "")
      .trim()
      .replace(/\s+/g, "")
      .toLowerCase();

    if (!/^data:image\/gif/.test(url)) {
      return false;
    }

    if (url.length > 260) {
      return false;
    }

    return /base64,r0lgodlhaqab/.test(url) || /base64,r0lgoddhaqab/.test(url);
  }

  root.MotionBlockMediaUrlUtils = {
    extractCssUrls,
    isAudioUrl,
    isGifUrl,
    isGifvUrl,
    isLikelyTransparentGifDataUrl,
    isVideoUrl,
    isWebpUrl,
    normalizeUrl,
    splitUrlAttribute
  };
})(globalThis);
