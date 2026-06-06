# Roadmap

## Release 0.1

- GIF and GIFV blocking.
- Autoplay video handling.
- Per-site rules.
- Global feature toggles.
- Options export/import.
- Manual testing on Reddit, Discord, Giphy, Steam, YouTube, and a few news sites.
- Store listing draft based on `review-feedback.md`.
- Local fixture page for repeatable media cases.
- Popup quick actions for "allow this site" and "block motion here".
- Opt-in click-to-play reveal buttons for blocked media.

## Release 0.2

- Better detection of GIF-like video on Reddit and Giphy.
- First-frame or click-to-play replacement for GIFs where technically possible.
- "Play once, then stop" mode investigation.
- More polished placeholder controls.

## Release 0.3

- Animated WebP detection by byte inspection where permissions and CORS allow it.
- Domain pattern rules, such as `*.example.com`.
- Optional context menu actions.
- Store screenshots and localized store listing.

## Open technical questions

- How much host permission scope is acceptable for Chrome Web Store review with this feature set?
- Whether first-frame extraction is worth the complexity for cross-origin media.
- Whether CSS motion blocking should become part of a preset rather than a normal feature toggle.
