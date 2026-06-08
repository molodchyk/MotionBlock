# MotionBlock Critical Knowledge

This file captures lessons that should survive context loss. Read it before changing `src/content.js`, media detection, restore behavior, popup settings, or release QA.

## Product Promise

MotionBlock should make distracting media quieter without becoming a generic site breaker.

The core promise is:

- block GIFs, GIFV, autoplay and looping motion by default
- offer broad media blockers for images, video, audio, WebP, emoji, and CSS motion
- keep global defaults conservative
- make per-site rules easy
- preserve page layout and controls as much as possible
- avoid noisy replacement UI

Do not overpromise "every possible media item on every possible website." Do claim broad coverage only when the implementation and QA can support it.

## Review-Derived User Needs

Users repeatedly asked for:

- per-website allow/block rules
- whitelist/allowlist support
- GIFV and disguised short-video support
- first-frame or quiet placeholder behavior instead of a big replacement logo
- play once or click-to-play behavior
- stable page layout after blocking
- a way to allow images on image-heavy sites
- reliability on Reddit, Facebook, Giphy, YouTube, Stocktwits, Flipboard, Gmail, and news sites

Users repeatedly complained about:

- GIF blockers missing Reddit/Facebook/Giphy GIFs
- GIF-like content being short MP4/WebM rather than a `.gif`
- replacement graphics being larger or more distracting than the original GIF
- missing per-site controls
- controls or UI sprites being blocked as GIFs
- sites breaking when blockers are too broad
- needing a reload for every change

## Non-Negotiable Engineering Lessons

### Separate Detection From Timing

When a setting toggle does not affect media already on the page, first decide whether this is:

- **Detection failure**: MotionBlock never recognized the element as blockable.
- **Timing/reconciliation failure**: MotionBlock recognized it, but did not apply or restore fast enough after settings changed, lazy media loaded, or the site rehydrated DOM.

Do not fix a timing problem by broadening detection.

The Reddit preloaded GIF issue was a timing/reconciliation issue. The elements were being recognized, but existing/preloaded/recreated items were not consistently reprocessed after toggling. Broadening media-wrapper detection caused ordinary Reddit images to be counted as GIFs. That was the wrong layer.

For timing issues, prefer:

- full reconcile after settings changes
- short delayed follow-up reconciles after settings changes
- debounced mutation handling
- restore passes when a feature turns off
- media runtime enforcement events for loaded media

Avoid:

- walking arbitrary ancestors looking for "post", "media", or "video" labels
- treating a whole feed item as GIF-like because an ancestor says it is a post
- adding site-specific class or DOM-path patches

### Classifier Changes Are High Risk

Changing detection rules can break unrelated sites. Classifier edits must be narrow and tested against still images, UI icons, backgrounds, native video, custom media hosts, and shadow DOM.

Known dangerous classifier patterns:

- broad ancestor metadata search
- matching generic words like `post`, `feed`, `thread`, `media`, or `content`
- treating all `preview.redd.it` image URLs as GIF-like
- using current site name alone as a GIF signal
- inspecting arbitrary `href` values on broad containers
- treating an entire custom element host as blockable just because it contains a child media element

Safer patterns:

- native element type: `img`, `video`, `audio`, `source`
- direct URL extension or MIME-like URL markers
- direct element attributes such as `src`, `srcset`, `poster`, `autoplay`, `loop`
- direct media attributes on custom hosts only when the host itself is media-like
- small, explicit text markers on the element itself, not arbitrary ancestors

### UI Controls Must Survive

Static GIFs and images are often used for buttons, checkboxes, sprites, transparent spacers, and icons. Blocking those breaks sites and contradicts the main user feedback.

Always protect likely interface elements:

- elements inside buttons and controls
- tiny images and sprites
- transparent spacer GIFs
- Gmail-style static GIF UI assets
- reaction buttons and action toolbars

If broad Images is enabled, blocking content images is expected. Even then, controls must remain clickable when possible.

### Placeholder Behavior Matters

Users disliked blockers where the replacement was bigger or more distracting than the original.

Default replacement should be quiet:

- no large logo
- no stuck global top-left reveal button
- no high-contrast animated-looking pattern
- preserve actual or likely dimensions
- do not invent uniform square tiles for masonry/gallery layouts
- do not collapse to thin bars

Reveal controls should remain optional and off by default. If enabled, the control must be placed near the blocked item and be clickable. A reveal control stuck at the viewport top-left is a bug.

### Restore Must Be Treated As A First-Class Feature

Blocking is only half the job. Users expect turning a feature off to restore the page without a reload when technically possible.

Restore needs to handle:

- blocked `img` `src`, `srcset`, `sizes`, `alt`, `title`, and inline size/style
- blocked CSS background values
- native video and audio runtime state
- autoplay/loop/muted attributes changed by MotionBlock
- emoji text and attributes
- counters and per-element stat markers
- placeholder containers and reveal buttons

Release blocker: blocking and then unblocking a loaded video or audio element must not leave it permanently broken until reload unless documented as a known site limitation.

## Current Risk Areas

### Reddit

Important behavior:

- Reddit uses custom elements such as `shreddit-*`.
- Native video, GIF-like media, embeds, and CSS background banners may appear inside custom elements and shadow roots.
- Feed items rehydrate and mutate while scrolling.
- Some static Reddit images use `preview.redd.it`; do not automatically classify those as GIFs.
- Subreddit banners may fight CSS background blocking and flicker if the site continuously restores inline variables or background styles.

Failure modes seen:

- preloaded GIFs not blocking/unblocking immediately after GIF setting changes
- ordinary still images counted as GIFs after broad classifier changes
- audio not muting on some loaded videos
- YouTube embeds inside Reddit not being affected by top-level settings
- CSS background banner flicker
- feed lag when broad scans are too aggressive

Debug rule: if counters already show GIFs and the toggle is late, fix timing/reconcile, not detection.

### YouTube

Important behavior:

- thumbnails, hover previews, watch-page videos, sidebar media, emoji in titles/descriptions
- hover previews may be muted looping videos rather than images
- embeds inside other sites may run in iframes

Failure modes seen:

- videos still playing on hover while all blockers claimed active
- reveal button stuck at top-left
- emoji title text not blocked because emoji text processing missed custom text elements

### Instagram

Important behavior:

- Reels can keep internal media state alive across setting changes.
- Blocking video and unblocking can leave Instagram showing an internal playback error if restore is incomplete.
- Audio mute/unmute may not apply until play/pause unless runtime enforcement touches active media.

Failure modes seen:

- audio toggle does not take effect until pause/unpause
- video unblock leaves "Sorry, we're having trouble playing this video" until reload

### X / Twitter

Important behavior:

- images can be absolutely positioned with site CSS, including z-index changes
- opening posts or modals can cause heavy DOM updates

Failure modes seen:

- image element marked blocked but original still visually present because CSS wins or parent background remains
- clicking/opening posts can freeze if scans are too broad or too frequent
- popup height may need enough room for counters and broad controls

### Gmail

Important behavior:

- Gmail uses static GIFs and tiny image assets for UI controls.
- Inbox rows and action buttons must stay clickable.

Failure modes seen:

- static GIF control inside a message row was treated as a blocked GIF
- placeholder dimensions expanded and covered clickable row content

### Google Images / CSE

Important behavior:

- image grids rely on natural or computed dimensions
- masonry layout should remain varied

Failure modes seen:

- placeholders collapsed to thin bars
- placeholders became uniform fake squares even though real images were varied
- unblock/reblock sometimes changed dimensions because layout had settled later

## Debugging Decision Tree

When a user reports a media blocker failure:

1. Check which setting is enabled globally and for the site.
2. Check whether the popup counter increments for that feature.
3. Inspect whether the target element has MotionBlock attributes/classes.
4. If it has attributes/classes but the media is visible or playing, this is action/restore/CSS/runtime enforcement, not detection.
5. If it is counted correctly but toggling is late, this is timing/reconciliation, not detection.
6. If it is never counted and has a direct media URL or native tag, inspect detection.
7. If it is inside shadow DOM or an iframe, inspect root discovery and frame host settings.
8. If a site flickers, check whether MotionBlock and the site are repeatedly overwriting the same style/attribute.
9. If a page lags, check scan scope, mutation frequency, and counter churn before adding more observers.
10. After a fix, rerun the failing site plus YouTube, Reddit, Instagram, X, Gmail, and Google Images.

## Required Regression Checks After Content Script Changes

Run these before packaging:

- `node --check src/content.js`
- `node --check src/background.js`
- `node --check src/popup.js`
- `node --check src/options.js`
- `node test/sanity.js`
- `git diff --check`

Manual or fixture checks:

- real GIF blocks by default
- normal PNG/JPG does not block when only GIFs are enabled
- `preview.redd.it` still images are not counted as GIFs
- static Gmail-like GIF controls are not blocked as content GIFs
- GIF setting toggle applies to already-loaded GIFs without reload
- GIF setting toggle restores already-blocked GIFs without reload
- delayed site rehydration after a toggle is reconciled
- broad Images preserves varied layout dimensions
- Video block/unblock on loaded media restores without permanent error where possible
- Audio block/unblock mutes and unmutes loaded media where possible
- CSS background blocking does not flicker continuously
- popup counters stay plausible and do not grow without new blocks
- broad blockers do not make Reddit/X/Instagram materially laggy

## Release Blockers

Do not publish if any of these are true:

- default settings break YouTube, Reddit, Instagram, X, Gmail, or Google Images
- GIF blocking catches normal UI controls on a major site
- ordinary still images are counted as GIFs
- blocking and unblocking loaded video/audio leaves it broken until reload
- broad image blocking collapses common image grids
- reveal controls get stuck at top-left or are not clickable
- a page visibly flickers several times per second
- a page becomes materially laggy with normal scrolling
- popup/options state says a feature is blocking but the content script is not applying that state

## Change Discipline

Before changing detection:

- write down whether the bug is detection, action, restore, timing, stats, or UI
- prefer a test or fixture that reproduces the failure
- avoid site-specific selectors unless the feature is explicitly site-specific
- avoid expanding selectors to broad containers
- prove still images and UI controls are not newly caught

Before changing timing:

- keep delayed scans bounded
- cancel outdated transition timers
- avoid permanent tight polling
- run lag checks on Reddit, X, YouTube, and Instagram

Before changing restore:

- verify blocking and unblocking on the same loaded element
- verify counters decrement or reset correctly
- verify no stale MotionBlock data attributes remain that alter future detection

## Current Implementation Direction

The correct direction for the latest Reddit preloaded GIF toggle issue:

- revert broad media-wrapper classifier expansion
- keep detection close to direct media elements and direct media-like attributes
- add bounded delayed full reconciles after settings changes
- ensure feature-off paths restore already-blocked elements
- keep a narrow still-image safety guard so Reddit static images are not treated as GIF-like only because their URL host appears in old motion heuristics

Do not reintroduce broad ancestor metadata scanning to solve toggle timing.
