# Review Feedback Notes

This file captures the important product feedback from the pasted Chrome Web Store reviews, old comment threads, and competitor listings used while shaping MotionBlock.

## Competitors Reviewed

### GIF Blocker

Observed profile:

- Featured.
- About 4,000 users.
- Around 3.7 stars from 43 ratings.
- Narrow name matches high-intent searches.

Useful positive signals:

- Users want a simple, no-fuss GIF blocker.
- Users care about CPU, bandwidth, and quieter reading.
- Some users specifically mention relief from animation noise.
- Steam and YouTube preview blocking were mentioned positively.

Repeated complaints and requests:

- Does not work on Giphy.
- Does not work on Reddit.
- Does not block Facebook feed or Facebook comment GIFs reliably.
- Some GIF-like content is actually HTML5 video, GIFV, disguised JPG, or short MPEG/MP4.
- Blocking normal non-animated WebP images causes frustration.
- Users want image-format-specific settings.
- Users want GIFV support.
- Users want a whitelist or blacklist.
- Users want per-site settings.
- Users want the first frame shown instead of a replacement icon.
- Replacement icons can be too large and more disruptive than the original GIF.

MotionBlock decisions:

- Keep GIF and GIFV blocking central to the product.
- Do not block WebP by default.
- Add per-site rules from the first version.
- Use compact placeholders that preserve element size when possible.
- Make placeholders visually quiet; users complained when replacements were more distracting than the original media.
- For broad image blocking, wait for real image layout before replacing where possible; uniform invented thumbnails are misleading on image galleries.
- Infer a reasonable thumbnail placeholder only as a fallback when broad image blocking encounters already-collapsed placeholders.
- Treat muted looping video as motion, not just as video.
- Do not treat static transparent GIFs used as interface spacers/icons as distracting GIF content.
- Scan open shadow roots so custom-element media players, including Reddit's `shreddit-*` components, are covered.
- Keep shadow-root scanning debounced and scoped to changed roots so dynamic feeds do not become laggy.
- Add Reddit, Giphy, Steam, Discord, Facebook, and Stocktwits to the manual test list.

### Stop Animations

Observed profile:

- Featured.
- About 7,000 users.
- Around 3.1 stars from 109 ratings.
- Very old extension with strong accumulated install advantage.

Useful positive signals:

- Users want to stop all motion, not only GIF files.
- Some users like a quick keyboard toggle.
- Users mention reading comfort and accessibility needs.
- Arc, Edge, and Brave compatibility show cross-Chromium interest.

Repeated complaints and requests:

- Esc-only control conflicts with other browser or site shortcuts.
- Users want custom shortcuts or a popup button.
- Many users did not understand they had to press Esc, pin the extension, or reload pages.
- Animation resumes while scrolling.
- Screenshot-based freezing causes blurry text.
- Screenshot-based freezing prevents text selection and does not reduce CPU usage.
- It does not work reliably on Discord, Reddit, NYT, ads, games, or JavaScript/CSS animation-heavy pages.
- Users want automatic stopping without manual Esc.

MotionBlock decisions:

- Avoid screenshot-overlay freezing as the main mechanism.
- Make blocking automatic by default.
- Put current-site controls in the popup.
- Support CSS motion reduction as a setting.
- Keep keyboard shortcut support as later enhancement, not the only control surface.
- Preserve page interaction and text selection whenever possible.

### HTML Content Blocker

Observed profile:

- Featured.
- About 4,000 users.
- Around 3.8 stars from 80 ratings.
- Broader content blocker covering media, images, JavaScript, CSS, and object content.

Useful positive signals:

- Strong demand exists for blocking autoplay video/audio.
- Users on limited or metered connections value media blocking.
- Users like stopping videos that slow pages, waste bandwidth, or play sound.
- Some users use these tools for website testing.

Repeated complaints and requests:

- Global defaults can break too many sites.
- Users want blacklist mode, whitelist mode, and per-site rules.
- Users want different settings per website, such as block images on one site and media on another.
- Current-site whitelist behavior can be confusing or buggy.
- Users want one-off playback for a specific blocked video.
- Users want thumbnails while blocking video loads.
- Users want clear UI state for whether a block is active.
- Reliability can degrade as websites change.
- YouTube and weather/news sites are common failure cases.

MotionBlock decisions:

- Use per-site tri-state rules: inherit, block/on, allow/off.
- Keep global defaults conservative.
- Put broad image/video/audio blocking behind opt-in toggles.
- Design the popup around the active site, not abstract global state.
- Track one-off click-to-play and video thumbnails as later features.

### Blockify

Observed profile:

- Featured.
- About 1,000 users.
- 5.0 stars from 7 ratings.
- Not media-specific; blocks sites, feeds, and selected elements.

Useful positive signals:

- A simple workflow and clear store instructions can produce high satisfaction even with fewer users.
- Persistent rules are valued.
- Element picking is an understandable power feature.
- Privacy claims are important on Chrome Web Store listings.

MotionBlock decisions:

- Keep the UX plain and fast.
- Explain setup and troubleshooting clearly in the store listing.
- State no analytics and no remote collection.
- Consider element picking only after media blocking is reliable.

## Naming Signal

Users repeatedly use these words:

- GIF
- GIFV
- animation
- motion
- autoplay
- video
- whitelist
- blacklist
- per website
- first frame
- play once

Decision:

- Store title should carry the search terms: **MotionBlock: GIF Blocker & Animation Stopper**.
- Brand should be short: **MotionBlock**.
- Avoid leading with "MediaBlock" because it is broader, less searchable for the core pain, and more likely to collide with existing names.

## Feature Priority From Feedback

### Must Have For MVP

- Block GIF image elements without blanket network blocking that breaks static UI GIFs.
- Block GIFV URL patterns.
- Pause or block autoplay video.
- Detect and block muted looping video used as GIF replacement.
- Per-site preferences.
- Global defaults.
- Current-site popup.
- Options page for exact-host rules.
- Conservative WebP handling.
- Quiet compact placeholder or hide mode.
- Clear privacy posture.

### High Priority After MVP

- First-frame display for GIFs where technically possible.
- Click-to-play blocked media.
- Play once, then stop.
- Better Reddit, Giphy, Discord, Facebook, and Stocktwits handling.
- Better animated WebP detection.
- Domain wildcard rules.
- Custom keyboard shortcut.
- Store screenshots demonstrating before/after.

### Lower Priority

- Full arbitrary element picker.
- Feed blocking.
- JavaScript blocking.
- CSS blocking presets beyond motion reduction.
- Dark mode.

## Manual Test Targets From Reviews

- reddit.com
- discord.com
- giphy.com
- facebook.com
- steamcommunity.com
- youtube.com hover previews
- stocktwits.com
- flipboard.com
- weather.com
- huffpost.com
- linkedin.com
- github.com/mifi/lossless-cut
- news pages with autoplay video

## Store Listing Implications

Lead with the pain:

- Stop GIFs.
- Stop distracting animation.
- Stop autoplay-like motion.

Then mention broader controls:

- Per-site rules.
- Optional video, audio, image, WebP, emoji, and CSS motion controls.

Avoid overpromising:

- Do not claim every possible animation is blocked.
- Explain that some sites convert GIFs into short videos.
- Explain that animated WebP detection is conservative.
- Explain that GIF blocking is page-aware so static GIF interface controls are less likely to break.

Support and troubleshooting should include:

- Reload the page after installing or changing network-level settings.
- Some browser-internal and Chrome Web Store pages cannot be modified by extensions.
- If a site breaks, allow the site from the popup.
