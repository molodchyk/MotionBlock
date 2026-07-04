export const SUPPORTED_LOCALES = [
  "de",
  "en",
  "en_AU",
  "en_GB",
  "en_US",
  "fa",
  "fil",
  "id",
  "sw",
  "ms",
  "nl",
  "vi",
  "tr",
  "az",
  "ca",
  "da",
  "et",
  "es",
  "es_419",
  "eu",
  "fr",
  "hr",
  "it",
  "lv",
  "lt",
  "hu",
  "no",
  "uz",
  "pl",
  "pt_BR",
  "pt_PT",
  "ro",
  "sq",
  "sk",
  "sl",
  "fi",
  "sv",
  "cs",
  "el",
  "bg",
  "mk",
  "ru",
  "sr",
  "uk",
  "hy",
  "he",
  "ur",
  "ar",
  "ne",
  "mr",
  "hi",
  "bn",
  "pa",
  "gu",
  "ta",
  "te",
  "kn",
  "ml",
  "si",
  "th",
  "ka",
  "am",
  "zh_CN",
  "zh_TW",
  "ja",
  "ko"
];

export const ENGLISH_MESSAGES = {
  extensionName: "MotionBlock: GIF Blocker & Animation Stopper",
  extensionShortName: "MotionBlock",
  extensionDescription: "Stop GIFs, GIFV, autoplay video, hover previews, and distracting motion with per-site controls.",
  actionDefaultTitle: "MotionBlock",
  popupTitle: "MotionBlock",
  optionsTitle: "MotionBlock Options",
  siteLoading: "Loading site...",
  optionsButton: "Options",
  statusOnInitial: "On",
  checkingActiveRules: "Checking active rules...",
  statsBlockedCount: "$COUNT$ blocked",
  blockMotionHere: "Block motion here",
  allowThisSite: "Allow this site",
  siteMode: "Site mode",
  followGlobalDefaults: "Follow global defaults",
  blockOnThisSite: "Block on this site",
  allowThisSiteOption: "Allow this site",
  siteMediaControls: "Site media controls",
  diagnosticsPopupHeading: "Diagnostics",
  diagnosticsLogAriaLabel: "MotionBlock diagnostics log",
  copyDiagnostics: "Copy log",
  refreshDiagnostics: "Refresh",
  diagnosticsSummaryWithEvents: "$COUNT$ diagnostic events recorded.",
  diagnosticsSummaryEmpty: "No diagnostics yet. Reload this tab, reproduce the issue, then refresh this panel.",
  diagnosticsRefreshed: "Diagnostics refreshed.",
  diagnosticsRefreshFailed: "Could not refresh diagnostics.",
  diagnosticsCopied: "Diagnostics copied.",
  diagnosticsCopyFailed: "Could not copy diagnostics.",
  resetSite: "Reset site",
  reloadTab: "Reload",
  reloadHint: "Reload may be needed for media that was already blocked or loaded.",
  unknownSite: "Unknown site",
  statusBlocking: "Blocking",
  statusAllowed: "Allowed",
  couldNotLoadSettings: "Could not load settings",
  notAWebsite: "Not a website",
  statusNotApplicable: "N/A",
  unsupportedPageSummary: "MotionBlock cannot configure browser, extension, or other protected pages.",
  selectUseGlobal: "Use global",
  selectBlockHere: "Block here",
  selectAllowHere: "Allow here",
  summaryAllowed: "This site is allowed. MotionBlock is not blocking media here.",
  summaryActiveNoCategories: "Active here, but no media categories are currently blocked.",
  summaryBlockingFeatures: "Blocking $FEATURES$ on this site.",
  siteRuleAllOff: "All MotionBlock rules are off for this site.",
  siteRuleOwnSettings: "This site uses its own MotionBlock settings.",
  siteRuleOverrides: "This site follows global status with media-specific overrides.",
  siteRuleDefaults: "This site follows your global defaults.",
  featureMetaInactive: "Inactive while site is allowed",
  featureMetaOverrideBlocking: "Override: blocking",
  featureMetaOverrideAllowed: "Override: allowed",
  featureMetaGlobalBlocking: "Global: blocking",
  featureMetaGlobalAllowed: "Global: allowed",
  optionsIntro: "Global media defaults and per-site preferences.",
  extensionActive: "Extension active",
  globalDefaultsHeading: "Global Defaults",
  globalDefaultsIntro: "Start with GIFs, GIF-like video, and autoplay. Use broad blockers only when a site needs stricter media control.",
  restoreRecommended: "Restore recommended",
  blockedMediaDisplay: "Blocked media display",
  replacementPlaceholder: "Compact placeholder",
  replacementHide: "Hide element",
  interfaceTheme: "Interface theme",
  themeSystem: "System",
  themeLight: "Light",
  themeDark: "Dark",
  revealControlsTitle: "Reveal buttons for blocked media",
  revealControlsDescription: "Show click-to-play/show buttons on blocked media. Off by default because some sites reuse hidden media surfaces.",
  diagnosticsTitle: "Advanced diagnostics",
  diagnosticsDescription: "Show a copyable per-tab diagnostic log in the popup while you reproduce a blocking problem.",
  websitePreferencesHeading: "Website Preferences",
  websitePreferencesIntro: "Use exact hostnames such as reddit.com, discord.com, or news.example.com.",
  addSite: "Add site",
  backupHeading: "Backup",
  backupIntro: "Settings are stored in Chrome sync storage. If Chrome sync is enabled for extensions, they can follow your Chrome profile.",
  exportJson: "Export JSON",
  importFile: "Import file",
  applyPastedJson: "Apply pasted JSON",
  refreshFromSync: "Refresh from sync",
  settingsJsonPlaceholder: "Export preview appears here. You can also paste a MotionBlock JSON backup and apply it.",
  globalStatusSaved: "Global status saved.",
  globalDefaultsSaved: "Global defaults saved.",
  displayModeSaved: "Display mode saved.",
  themeSaved: "Theme saved.",
  revealSettingSaved: "Reveal button setting saved.",
  diagnosticsSettingSaved: "Diagnostics setting saved.",
  recommendedDefaultsRestored: "Recommended defaults restored.",
  enterValidHostname: "Enter a valid hostname.",
  siteAdded: "Site added.",
  siteRuleSaved: "Site rule saved.",
  siteRemoved: "Site removed.",
  settingsExported: "Settings exported to a JSON file.",
  settingsImportedFromFile: "Settings imported from file.",
  settingsImportedFromPastedJson: "Settings imported from pasted JSON.",
  settingsRefreshed: "Settings refreshed from Chrome sync.",
  couldNotLoadSettingsPeriod: "Could not load settings.",
  defaultOn: "Default on",
  defaultOff: "Default off",
  noWebsitePreferences: "No website preferences yet.",
  removeSite: "Remove",
  siteTableSite: "Site",
  siteTableActive: "Active",
  selectInherit: "Inherit",
  selectBlock: "Block",
  selectAllow: "Allow",
  selectOn: "On",
  selectOff: "Off",
  saveFailed: "Save failed.",
  importFailed: "Import failed: $ERROR$",
  chooseJsonFileError: "choose a JSON file or paste a backup first.",
  invalidJson: "invalid JSON.",
  errorInvalidSettingsBackup: "This does not look like a MotionBlock settings backup.",
  errorMissingMessageType: "Missing message type.",
  errorMissingSiteHostname: "Missing site hostname.",
  errorUnknownMessageType: "Unknown message type.",
  featureGifsLabel: "GIF images",
  featureGifsShortLabel: "GIFs",
  featureGifsDescription: "Replace GIF image elements in the page while leaving tiny interface GIFs alone.",
  featureGifvLabel: "GIFV and GIF-like video URLs",
  featureGifvShortLabel: "GIFV",
  featureGifvDescription: "Block .gifv URLs and video elements that behave like looping GIFs.",
  featureAnimatedWebpLabel: "WebP URL patterns",
  featureAnimatedWebpShortLabel: "WebP",
  featureAnimatedWebpDescription: "Block .webp image URLs. Off by default because many WebP images are not animated.",
  featureAutoplayVideoLabel: "Autoplay and looping video",
  featureAutoplayVideoShortLabel: "Autoplay",
  featureAutoplayVideoDescription: "Pause autoplay video and remove muted looping video used as animation.",
  featureVideoLabel: "All video",
  featureVideoShortLabel: "Video",
  featureVideoDescription: "Block HTML5 video and common video file requests.",
  featureAudioLabel: "Audio",
  featureAudioShortLabel: "Audio",
  featureAudioDescription: "Block audio elements and common audio file requests.",
  featureImagesLabel: "All images",
  featureImagesShortLabel: "Images",
  featureImagesDescription: "Replace image elements in the page. Use per-site allow rules for image-heavy sites.",
  featureEmojiLabel: "Emoji text and emoji images",
  featureEmojiShortLabel: "Emoji",
  featureEmojiDescription: "Remove emoji characters and common emoji image renderers. Off by default because it changes text.",
  featureCssMotionLabel: "CSS animation and transitions",
  featureCssMotionShortLabel: "CSS",
  featureCssMotionDescription: "Disable CSS animations, transitions, and smooth scrolling.",
  featureGroupMotionLabel: "Motion blocking",
  featureGroupMotionDescription: "Recommended defaults for GIFs, GIF-like videos, autoplay, and page motion.",
  featureGroupBroadLabel: "Broad media blockers",
  featureGroupBroadDescription: "Power-user controls for images, video, audio, WebP URLs, and emoji. These can change or break some sites.",
  contentShowBlockedImage: "Show blocked image",
  contentPlayBlockedAudio: "Play blocked audio",
  contentPlayBlockedVideo: "Play blocked video",
  contentPlayBlockedMedia: "Play blocked media",
  contentBlockedByTitle: "Blocked by MotionBlock: $REASON$",
  contentBlockedAlt: "Blocked $REASON$",
  contentReasonGif: "GIF",
  contentReasonGifv: "GIFV",
  contentReasonWebp: "WebP",
  contentReasonGifLikeMedia: "GIF-like media",
  contentReasonVideo: "video",
  contentReasonAudio: "audio",
  contentReasonLoopingVideo: "looping video",
  contentReasonAutoplayVideo: "autoplay video",
  contentReasonImage: "image",
  contentReasonMedia: "media"
};

export const STORE_LISTING_EN = `Block distracting GIFs, GIFV, autoplay video, hover previews, and page motion before they get in your way.

Use MotionBlock to stop:

Looping GIF images.
GIFV links.
Short muted videos used like GIFs.
Autoplay video and hover previews.
Optional animated WebP URL patterns.
Optional video, audio, images, emoji, and CSS motion.

MotionBlock is built around per-site control. Keep conservative global defaults, then allow or block specific media types on individual websites from the popup or options page. Settings stay in Chrome extension sync storage and may sync through Chrome if the user has extension sync enabled.

Common uses:

Stop distracting animations while reading.
Reduce autoplay video noise.
Save bandwidth from unnecessary media.
Block YouTube-style hover previews.
Calm Reddit, Giphy, social feeds, and news pages that convert GIFs into short videos.
Allow image-heavy sites while blocking motion elsewhere.
Quickly allow media on sites that need it.

The popup controls the current site. The options page manages global defaults, per-site preferences, JSON backup import/export, blocked media display, optional reveal buttons, and light/dark/system UI theme.

Chrome does not allow extensions to modify browser-internal pages, the Chrome Web Store, or some protected pages. If media is still visible after installing or changing settings, reload the page.

MotionBlock does not collect analytics, send browsing data to a server, or use remote rule lists.

Open source under the GPL-3.0 license:
https://github.com/molodchyk/MotionBlock`;

export const PLACEHOLDERS = {
  statsBlockedCount: {
    count: {
      content: "$1",
      example: "3"
    }
  },
  diagnosticsSummaryWithEvents: {
    count: {
      content: "$1",
      example: "12"
    }
  },
  summaryBlockingFeatures: {
    features: {
      content: "$1",
      example: "GIFs, GIFV"
    }
  },
  importFailed: {
    error: {
      content: "$1",
      example: "invalid JSON."
    }
  },
  contentBlockedByTitle: {
    reason: {
      content: "$1",
      example: "GIF"
    }
  },
  contentBlockedAlt: {
    reason: {
      content: "$1",
      example: "GIF"
    }
  }
};

export function toChromeMessages(translations) {
  return Object.fromEntries(
    Object.entries(translations).map(function ([key, message]) {
      const entry = { message };
      if (PLACEHOLDERS[key]) {
        entry.placeholders = PLACEHOLDERS[key];
      }
      return [key, entry];
    })
  );
}
