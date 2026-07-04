const assert = require("node:assert/strict");

Promise.resolve()
  .then(async function () {
    const localeTextUtils = await import("../scripts/locales/locale-text-utils.mjs");
    assert.equal(localeTextUtils.normalizeProtectedTokenSpacing("Stop GIFs,GIFV now"), "Stop GIFs, GIFV now");
    assert.equal(
      localeTextUtils.normalizeProtectedTokenSpacing("Используйте какreddit.com,discord.comилиnews.example.com."),
      "Используйте как reddit.com, discord.com или news.example.com."
    );
    assert.equal(
      localeTextUtils.normalizeProtectedTokenSpacing("reddit.com, discord.com বাnews.example.com"),
      "reddit.com, discord.com বা news.example.com"
    );
    assert.equal(
      localeTextUtils.normalizeProtectedTokenSpacing("reddit.com،discord.com، یا news.example.com"),
      "reddit.com، discord.com، یا news.example.com"
    );
    assert.equal(
      localeTextUtils.normalizeProtectedTokenSpacing("CSS движение.MotionBlock построен"),
      "CSS движение. MotionBlock построен"
    );
    assert.equal(localeTextUtils.normalizeProtectedTokenSpacing("Заблокировано MotionBlock:$REASON$"), "Заблокировано MotionBlock: $REASON$");
    assert.equal(localeTextUtils.normalizeProtectedTokenSpacing("LoopingGIFimages"), "Looping GIF images");
  })
  .then(function () {
    console.log("locale text sanity ok");
  })
  .catch(function (error) {
    console.error(error);
    process.exitCode = 1;
  });
