# MotionBlock

MotionBlock is a Chrome Manifest V3 extension for blocking distracting motion first: GIFs, GIFV, looping video, and autoplay. Broader media controls are available as opt-in settings for images, video, audio, emoji, and CSS motion.

Working store title:

> MotionBlock: GIF, Animation & Autoplay Blocker

## Why this shape

The product is built around the repeated review themes from existing blockers:

- People search for GIF blockers and animation stoppers, not broad "media control".
- They want per-site rules because image and video needs vary by website.
- They dislike giant replacement graphics.
- They want GIFV, Reddit, Discord, Giphy, Steam, and autoplay-style videos covered.
- They do not want normal WebP images blocked by default.

## Development

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose Load unpacked.
4. Select this folder: `C:\Users\molod\Documents\Personal\settings\MotionBlock`.

The popup controls the current site. The options page controls global defaults and exact-host website preferences.

## Current MVP

- Dynamic network blocking for GIF, GIFV, WebP URL patterns, broad image, broad video, and audio settings.
- DOM cleanup for already-in-page images, video, audio, emoji renderers, and CSS motion.
- Per-site tri-state preferences: inherit, block/on, allow/off.
- Settings export and import.
- System, light, and dark UI theme modes.

## Planning Docs

- `docs/product-brief.md` records the positioning and naming.
- `docs/review-feedback.md` records the vital review feedback and product implications from competitor research.
- `docs/roadmap.md` tracks likely release order.
- `docs/store-listing-draft.md` contains initial Chrome Web Store copy.
- `docs/chrome-web-store-entry.md` contains copy-paste Chrome Web Store fields.
- `docs/permissions.md` explains requested extension permissions.
- `docs/manual-test-plan.md` lists local and live-site test targets.

## Local Fixture

Run:

```powershell
.\scripts\serve-fixtures.ps1
```

Then open `http://127.0.0.1:8765/fixtures.html`.

Run the lightweight settings sanity check:

```powershell
node .\test\sanity.js
```

## Known limits

- WebP blocking is URL-based for now. It is off by default because detecting animated WebP reliably needs deeper byte inspection.
- First-frame GIF replacement is not implemented yet. The current default is a compact placeholder that preserves the displayed size when possible.
- Emoji removal changes text and cannot be cleanly restored without reloading the page.

## Support

If this extension saves you time and you want to support its development:

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-support-FFDD00?logo=buymeacoffee&logoColor=000)](https://buymeacoffee.com/molodchyk)
[![Patreon](https://img.shields.io/badge/Patreon-support-F96854?logo=patreon&logoColor=fff)](https://www.patreon.com/OMolodchyk)

## License

MotionBlock is licensed under the GNU General Public License v3.0. See `LICENSE`.
