(function (root) {
  "use strict";

  function start() {
      const MB = window.MotionBlock;
      const I18N = window.MotionBlockI18n;
      const PLACEHOLDER_SRC = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3C/svg%3E";
      const frameContext = window.MotionBlockFrameContext.createFrameContext({
        config: MB,
        document,
        window
      });
      const FRAME_HOST = frameContext.frameHost;
      const SETTINGS_HOST = frameContext.settingsHost;
      const CURRENT_HOST = frameContext.currentHost;
      const BROAD_IMAGE_BLOCK_TIMEOUT_MS = 2500;
      const BROAD_IMAGE_SETTLE_DELAY_MS = 120;
      const DIAGNOSTICS_UPDATE_DEBOUNCE_MS = 250;
      const STATS_UPDATE_DEBOUNCE_MS = 150;
      const CSS_BACKGROUND_SCAN_LIMIT = 160;
      const MEDIA_STAT_DATA_KEY = "motionblockMediaStatFeature";
      const MEDIA_UNCOUNTED_DATA_KEY = "motionblockMediaUncounted";
      const AUDIO_ADJUSTED_DATA_KEY = "motionblockAudioAdjusted";
      const EMOJI_ELEMENT_STAT_DATA_KEY = "motionblockEmojiElementCounted";
      const EMOJI_TEXT_STAT_DATA_KEY = "motionblockEmojiTextCount";
      const EMOJI_ATTRIBUTE_STAT_DATA_KEY = "motionblockEmojiAttributeCount";
      const CSS_BACKGROUND_DATA_KEY = "motionblockCssBackground";
      const CSS_BACKGROUND_URLS_DATA_KEY = "motionblockCssBackgroundUrls";
      const CSS_BACKGROUND_SELECTOR = [
        "[style*='url(' i]",
        "[data-bg]",
        "[data-background]",
        "[data-background-image]"
      ].join(",");
      const CUSTOM_MEDIA_HOST_SELECTOR = [
        "[autoplay]",
        "[loop]",
        "[gif]",
        "[data-hls-url]",
        "[data-media-id]",
        "[data-video-id]",
        "[src*='.gifv' i]",
        "[src*='.m3u8' i]",
        "[src*='.mp4' i]",
        "[src*='.webm' i]"
      ].join(",");
      let storedSettings = MB.DEFAULT_SETTINGS;
      let effectiveSettings = MB.getEffectiveSettings(storedSettings, SETTINGS_HOST);
      const emojiTextOriginals = new WeakMap();
      const emojiTextBlockCounts = new WeakMap();
      const emojiAttributeOriginals = new WeakMap();
      const emojiAttributeBlockCounts = new WeakMap();
      const mediaRuntimeOriginals = new WeakMap();
      let contentRuntime = null;

      if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.sync) {
        return;
      }

      const contentStats = window.MotionBlockContentBlockStats.createContentBlockStats({
        chrome,
        dataKeys: {
          audioAdjusted: AUDIO_ADJUSTED_DATA_KEY,
          cssBackground: CSS_BACKGROUND_DATA_KEY,
          cssBackgroundUrls: CSS_BACKGROUND_URLS_DATA_KEY,
          emojiAttributeStat: EMOJI_ATTRIBUTE_STAT_DATA_KEY,
          emojiElementStat: EMOJI_ELEMENT_STAT_DATA_KEY,
          emojiTextStat: EMOJI_TEXT_STAT_DATA_KEY,
          mediaStat: MEDIA_STAT_DATA_KEY,
          mediaUncounted: MEDIA_UNCOUNTED_DATA_KEY
        },
        emojiTextBlockCounts,
        emojiTextOriginals,
        featureKeys: MB.FEATURE_KEYS,
        frameHost: FRAME_HOST,
        location: window.location,
        nodeTypes: {
          DOCUMENT_FRAGMENT_NODE: Node.DOCUMENT_FRAGMENT_NODE,
          ELEMENT_NODE: Node.ELEMENT_NODE,
          TEXT_NODE: Node.TEXT_NODE
        },
        settingsHost: SETTINGS_HOST,
        updateDebounceMs: STATS_UPDATE_DEBOUNCE_MS,
        window
      });
      const mediaClassifier = window.MotionBlockMediaClassifier.createMediaClassifier({
        cssBackgroundUrlsDataKey: CSS_BACKGROUND_URLS_DATA_KEY,
        currentHost: CURRENT_HOST,
        document,
        getOriginalStylePropertyKey: window.MotionBlockMediaOriginalState.getOriginalStylePropertyKey,
        mediaRuntimeOriginals,
        window
      });
      const originalState = window.MotionBlockMediaOriginalState.createMediaOriginalState({
        document,
        isLikelyInterfaceImage: mediaClassifier.isLikelyInterfaceImage,
        mediaRuntimeOriginals,
        window
      });

      const adjustBlockStat = contentStats.adjust;
      const applyContainerPlaceholder = originalState.applyContainerPlaceholder;
      const collectElementUrls = mediaClassifier.collectElementUrls;
      const collectCssBackgroundUrls = mediaClassifier.collectCssBackgroundUrls;
      const cssEscape = mediaClassifier.cssEscape;
      const findCustomMediaHost = mediaClassifier.findCustomMediaHost;
      const contentDiagnostics = window.MotionBlockContentDiagnostics.createContentDiagnostics({
        chrome,
        document,
        frameHost: FRAME_HOST,
        location: window.location,
        settingsHost: SETTINGS_HOST,
        updateDebounceMs: DIAGNOSTICS_UPDATE_DEBOUNCE_MS,
        window
      });
      const pageAudioBridge = window.MotionBlockPageAudioBridge.createPageAudioBridge({
        diagnostics: contentDiagnostics,
        getEffectiveSettings: function () {
          return effectiveSettings;
        },
        sanitizeUrlForDiagnostics: window.MotionBlockContentDiagnostics.sanitizeUrlForDiagnostics,
        window
      });
      const getBlockStatsSnapshot = contentStats.getSnapshot;
      const getImageStatFeature = contentStats.getImageStatFeature;
      const getMediaStatFeature = contentStats.getMediaStatFeature;
      const getOriginalAttributeKey = originalState.getOriginalAttributeKey;
      const lockDisplayedSize = originalState.lockDisplayedSize;
      const resetBlockStats = contentStats.reset;
      const isLikelyHiddenAccessibilityImage = mediaClassifier.isLikelyHiddenAccessibilityImage;
      const isLikelyInterfaceImage = mediaClassifier.isLikelyInterfaceImage;
      const isNativeMediaElement = mediaClassifier.isNativeMediaElement;
      const isTextNodeInsideIgnoredElement = mediaClassifier.isTextNodeInsideIgnoredElement;
      const cleanupRemovedNodeStats = contentStats.cleanupRemovedNode;
      const decrementElementNumericStat = contentStats.decrementElementNumeric;
      const incrementElementNumericStat = contentStats.incrementElementNumeric;
      const markEmojiElementStat = contentStats.markEmojiElement;
      const markMediaStat = contentStats.markMedia;
      const normalizeRequestUrl = mediaClassifier.normalizeRequestUrl;
      const rememberCssBackgroundUrls = mediaClassifier.rememberCssBackgroundUrls;
      const removePlaceholderContainer = originalState.removePlaceholderContainer;
      const restoreOriginalAttribute = originalState.restoreOriginalAttribute;
      const restoreOriginalMediaProperty = originalState.restoreOriginalMediaProperty;
      const restoreOriginalMediaRuntimeState = originalState.restoreOriginalMediaRuntimeState;
      const restoreOriginalMediaState = originalState.restoreOriginalMediaState;
      const restoreOriginalStyleProperty = originalState.restoreOriginalStyleProperty;
      const sendStatsUpdate = contentStats.sendUpdate;
      const storeOriginalAttribute = originalState.storeOriginalAttribute;
      const storeOriginalMediaProperty = originalState.storeOriginalMediaProperty;
      const storeOriginalMediaRuntimeProperty = originalState.storeOriginalMediaRuntimeProperty;
      const storeOriginalMediaRuntimeState = originalState.storeOriginalMediaRuntimeState;
      const storeOriginalMediaState = originalState.storeOriginalMediaState;
      const storeOriginalStyleProperty = originalState.storeOriginalStyleProperty;
      const unmarkEmojiElementStat = contentStats.unmarkEmojiElement;
      const unmarkMediaStat = contentStats.unmarkMedia;
      const emojiBlocker = window.MotionBlockEmojiBlocker.createEmojiBlocker({
        attributeBlockCounts: emojiAttributeBlockCounts,
        attributeOriginals: emojiAttributeOriginals,
        dataKeys: {
          emojiAttributeStat: EMOJI_ATTRIBUTE_STAT_DATA_KEY,
          emojiTextStat: EMOJI_TEXT_STAT_DATA_KEY
        },
        document,
        isTextNodeInsideIgnoredElement,
        nodeFilterShowText: NodeFilter.SHOW_TEXT,
        nodeTypes: {
          DOCUMENT_FRAGMENT_NODE: Node.DOCUMENT_FRAGMENT_NODE,
          DOCUMENT_NODE: Node.DOCUMENT_NODE,
          ELEMENT_NODE: Node.ELEMENT_NODE
        },
        stats: {
          adjust: adjustBlockStat,
          decrementElementNumeric: decrementElementNumericStat,
          incrementElementNumeric: incrementElementNumericStat,
          markEmojiElement: markEmojiElementStat,
          unmarkEmojiElement: unmarkEmojiElementStat
        },
        textBlockCounts: emojiTextBlockCounts,
        textOriginals: emojiTextOriginals
      });
      const processEmoji = emojiBlocker.processEmoji;
      const restoreEmojiElements = emojiBlocker.restoreEmojiElements;
      const revealControls = window.MotionBlockRevealControls.createRevealControls({
        chrome,
        collectElementUrls,
        cssEscape,
        document,
        getEffectiveSettings: function () {
          return effectiveSettings;
        },
        i18n: I18N,
        normalizeRequestUrl,
        queryAllProcessingRoots,
        restoreElement: function (element) {
          mediaRestore.restoreElement(element);
        },
        window
      });
      const ensureRevealOverlay = revealControls.ensureRevealOverlay;
      const getReasonLabel = revealControls.getReasonLabel;
      const markForLoadRetry = revealControls.markForLoadRetry;
      const removeAllRevealButtons = revealControls.removeAllRevealButtons;
      const removeRevealButton = revealControls.removeRevealButton;
      const scheduleRevealOverlayPositionUpdate = revealControls.scheduleRevealOverlayPositionUpdate;
      const updateAllRevealOverlayPositions = revealControls.updateAllRevealOverlayPositions;
      const mediaRestore = window.MotionBlockMediaRestore.createMediaRestore({
        dataKeys: {
          audioAdjusted: AUDIO_ADJUSTED_DATA_KEY,
          cssBackground: CSS_BACKGROUND_DATA_KEY,
          cssBackgroundUrls: CSS_BACKGROUND_URLS_DATA_KEY,
          mediaUncounted: MEDIA_UNCOUNTED_DATA_KEY
        },
        getOriginalAttributeKey,
        markForLoadRetry,
        queryAllProcessingRoots,
        removePlaceholderContainer,
        removeRevealButton,
        restoreOriginalAttribute,
        restoreOriginalMediaRuntimeState,
        restoreOriginalMediaState,
        restoreOriginalStyleProperty,
        unmarkMediaStat
      });
      const restoreAudioAdjustedElements = mediaRestore.restoreAudioAdjustedElements;
      const restoreBlockedElements = mediaRestore.restoreBlockedElements;
      const restoreElement = mediaRestore.restoreElement;
      const restoreElementsByFeature = mediaRestore.restoreElementsByFeature;
      let scanRunner = null;
      const mediaEffects = window.MotionBlockMediaEffects.createMediaEffects({
        applyContainerPlaceholder,
        broadImageBlockTimeoutMs: BROAD_IMAGE_BLOCK_TIMEOUT_MS,
        broadImageSettleDelayMs: BROAD_IMAGE_SETTLE_DELAY_MS,
        collectCssBackgroundUrls,
        collectElementUrls,
        dataKeys: {
          audioAdjusted: AUDIO_ADJUSTED_DATA_KEY,
          cssBackground: CSS_BACKGROUND_DATA_KEY,
          mediaUncounted: MEDIA_UNCOUNTED_DATA_KEY
        },
        diagnostics: contentDiagnostics,
        ensureRevealOverlay,
        getEffectiveSettings: function () {
          return effectiveSettings;
        },
        getImageStatFeature,
        getMediaStatFeature,
        getReasonLabel,
        isLikelyHiddenAccessibilityImage,
        lockDisplayedSize,
        markMediaStat,
        placeholderSrc: PLACEHOLDER_SRC,
        processMedia: function (root) {
          scanRunner.processMedia(root);
        },
        rememberCssBackgroundUrls,
        removeRevealButton,
        restoreOriginalAttribute,
        restoreOriginalMediaProperty,
        storeOriginalAttribute,
        storeOriginalMediaProperty,
        storeOriginalMediaRuntimeProperty,
        storeOriginalMediaRuntimeState,
        storeOriginalMediaState,
        storeOriginalStyleProperty,
        t,
        unmarkMediaStat,
        window
      });
      const blockCssBackgroundElement = mediaEffects.blockCssBackgroundElement;
      const blockCustomMediaHostElement = mediaEffects.blockCustomMediaHostElement;
      const blockImageElement = mediaEffects.blockImageElement;
      const blockMediaElement = mediaEffects.blockMediaElement;
      const blockVideoAudioElement = mediaEffects.blockVideoAudioElement;
      const clearPendingImageBlock = mediaEffects.clearPendingImageBlock;
      const deferBroadImageBlock = mediaEffects.deferBroadImageBlock;
      const disableAutoplay = mediaEffects.disableAutoplay;
      const enforceBlockedCustomMediaHostElement = mediaEffects.enforceBlockedCustomMediaHostElement;
      const enforceBlockedMediaElement = mediaEffects.enforceBlockedMediaElement;
      const shouldDeferBroadImageBlock = mediaEffects.shouldDeferBroadImageBlock;
      const syncVideoAudioBlocking = mediaEffects.syncVideoAudioBlocking;
      scanRunner = window.MotionBlockContentScanner.createContentScanner({
        blockCssBackgroundElement,
        blockCustomMediaHostElement,
        blockImageElement,
        blockMediaElement,
        blockVideoAudioElement,
        clearPendingImageBlock,
        cssBackgroundDataKey: CSS_BACKGROUND_DATA_KEY,
        cssBackgroundScanLimit: CSS_BACKGROUND_SCAN_LIMIT,
        cssBackgroundSelector: CSS_BACKGROUND_SELECTOR,
        customMediaHostSelector: CUSTOM_MEDIA_HOST_SELECTOR,
        deferBroadImageBlock,
        disableAutoplay,
        enforceBlockedCustomMediaHostElement,
        enforceBlockedMediaElement,
        findCustomMediaHost,
        collectElementUrls,
        diagnostics: contentDiagnostics,
        getCssBackgroundBlockReason,
        getCustomMediaHostBlockReason,
        getEffectiveSettings: function () {
          return effectiveSettings;
        },
        getImageBlockReason,
        getMediaBlockReason,
        isNativeMediaElement,
        nodeTypes: {
          ELEMENT_NODE: Node.ELEMENT_NODE
        },
        restoreAudioAdjustedElements,
        restoreElement,
        restoreElementsByFeature,
        shouldDeferBroadImageBlock,
        syncVideoAudioBlocking,
        window
      });
      const processImages = scanRunner.processImages;
      const processMedia = scanRunner.processMedia;
      const shouldInspectImages = scanRunner.shouldInspectImages;
      const shouldInspectMedia = scanRunner.shouldInspectMedia;
      const stopBlockedMediaPlayback = scanRunner.stopBlockedMediaPlayback;
      contentRuntime = window.MotionBlockContentRuntime.createContentRuntime({
        cleanupRemovedNodeStats,
        document,
        getEffectiveSettings: function () {
          return effectiveSettings;
        },
        nodeTypes: {
          DOCUMENT_FRAGMENT_NODE: Node.DOCUMENT_FRAGMENT_NODE,
          DOCUMENT_NODE: Node.DOCUMENT_NODE,
          ELEMENT_NODE: Node.ELEMENT_NODE
        },
        processEmoji,
        processImages,
        processMedia,
        removeAllRevealButtons,
        restoreAudioAdjustedElements,
        restoreBlockedElements,
        restoreElementsByFeature,
        restoreEmojiElements,
        shouldInspectImages,
        shouldInspectMedia,
        stopBlockedMediaPlayback,
        updateAllRevealOverlayPositions,
        window
      });

      function getImageBlockReason(element) {
        return mediaClassifier.getImageBlockReason(effectiveSettings, element);
      }

      function getCssBackgroundBlockReason(element) {
        return mediaClassifier.getCssBackgroundBlockReason(effectiveSettings, element);
      }

      function getMediaBlockReason(element) {
        return mediaClassifier.getMediaBlockReason(effectiveSettings, element);
      }

      function getCustomMediaHostBlockReason(element) {
        return mediaClassifier.getCustomMediaHostBlockReason(effectiveSettings, element);
      }

      loadSettings();
      contentRuntime.start();
      pageAudioBridge.start();
      window.addEventListener("scroll", scheduleRevealOverlayPositionUpdate, true);
      window.addEventListener("resize", scheduleRevealOverlayPositionUpdate, true);

      chrome.storage.onChanged.addListener(function (changes, areaName) {
        if (areaName === "sync" && changes[MB.STORAGE_KEY]) {
          applySettings(changes[MB.STORAGE_KEY].newValue);
        }
      });

      chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
        if (message && message.type === "motionblock:applyNow") {
          loadSettings().then(function () {
            sendStatsUpdate({ force: true });
            sendResponse({ ok: true, stats: getBlockStatsSnapshot() });
          });
          return true;
        }

        if (message && message.type === "motionblock:getStats") {
          sendStatsUpdate({ force: true });
          sendResponse({ ok: true, stats: getBlockStatsSnapshot() });
          return false;
        }

        if (message && message.type === "motionblock:flushDiagnostics") {
          contentDiagnostics.flush().then(function () {
            sendResponse({ ok: true, diagnostics: contentDiagnostics.getSnapshot() });
          });
          return true;
        }

        return false;
      });

      window.addEventListener("pagehide", function () {
        contentDiagnostics.record("pagehide", { pageUrl: window.MotionBlockContentDiagnostics.sanitizeUrlForDiagnostics(window.location.href) }, {
          force: true,
          immediate: true
        });
        resetBlockStats();
        sendStatsUpdate({ force: true, immediate: true });
      });

      async function loadSettings() {
        const data = await chrome.storage.sync.get(MB.STORAGE_KEY);
        applySettings(data[MB.STORAGE_KEY]);
      }

      function applySettings(settings) {
        storedSettings = MB.normalizeSettings(settings);
        effectiveSettings = MB.getEffectiveSettings(storedSettings, SETTINGS_HOST);
        contentDiagnostics.setEnabled(effectiveSettings.diagnosticsEnabled, {
          frameHost: FRAME_HOST,
          pageUrl: pageAudioBridge.summarizePageUrl(),
          settingsHost: SETTINGS_HOST
        });
        contentDiagnostics.recordSettingsApplied(effectiveSettings);
        pageAudioBridge.sendPolicy();
        contentRuntime.runFullBlockingPass();
        contentRuntime.scheduleSettingsTransitionScans();
      }

      function queryAllProcessingRoots(selector) {
        return contentRuntime.queryAllProcessingRoots(selector);
      }

      function t(key, substitutions, fallback) {
        return I18N.t(key, substitutions, fallback);
      }

  }

  root.MotionBlockContentController = {
    start
  };
})(globalThis);
