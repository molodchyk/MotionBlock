# MotionBlock

MotionBlock is a Chrome Manifest V3 extension for blocking distracting motion first: GIFs, GIFV, looping video, and autoplay. Broader media controls are available as opt-in settings for images, video, audio, emoji, and CSS motion.

Working store title:

> MotionBlock: GIF Blocker & Animation Stopper

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

- DOM-aware GIF and image blocking that avoids tiny interface GIFs, plus network blocking for GIFV, WebP URL patterns, broad video, and audio settings.
- DOM cleanup for already-in-page images, video, audio, emoji renderers, and CSS motion.
- Audio blocking covers native media elements, common audio file request paths, and page-owned Web Audio playback/decoding paths.
- Per-site tri-state preferences: inherit, block/on, allow/off.
- Settings export/import with JSON backup files.
- Chrome-profile settings sync through Chrome extension sync storage when browser sync is enabled.
- System, light, and dark UI theme modes.
- Optional reveal buttons for blocked media. Off by default because complex sites can reuse hidden media surfaces.
- Optional advanced diagnostics that show a copyable in-memory popup log for troubleshooting site-specific blocking issues.

## Planning Docs

- `docs/product-brief.md` records the positioning and naming.
- `docs/review-feedback.md` records the vital review feedback and product implications from competitor research.
- `docs/roadmap.md` tracks likely release order.
- `docs/release-notes.md` records packaged release changes and verification.
- `docs/store-listing-draft.md` contains initial Chrome Web Store copy.
- `docs/chrome-web-store-entry.md` contains copy-paste Chrome Web Store fields.
- `docs/chrome-web-store-category.md` contains the StorePilot-ready category decision.
- `docs/chrome-web-store-additional-fields.md` contains StorePilot-ready additional fields.
- `docs/chrome-web-store-privacy-form.md` contains StorePilot-ready privacy form fields.
- `docs/localization.md` records the 66-locale Chrome Web Store coverage and QA workflow.
- `docs/code-structure.md` records current ownership and modularization debt.
- `docs/permissions.md` explains requested extension permissions.
- `docs/manual-test-plan.md` lists local and live-site test targets.
- `store-assets/store-listing/*.txt` contains localized Store listing long descriptions.
- `store-assets/promo/` contains Chrome Web Store promotional tiles.
- `store-assets/screenshots/` is reserved for final Store screenshots.

## Local Fixture

Run:

```powershell
.\scripts\serve-fixtures.ps1
```

Then open `http://127.0.0.1:8765/fixtures.html`.

Run the lightweight settings sanity check:

```powershell
npm test
```

Run the release checks:

```powershell
npm run verify:release
```

Useful narrow checks:

```powershell
npm run verify:architecture
npm run verify:manifest
npm run verify:locales
npm run verify:package
```

## Known limits

- WebP blocking is URL-based for now. It is off by default because detecting animated WebP reliably needs deeper byte inspection.
- First-frame GIF replacement is not implemented yet. The current default is a compact placeholder that preserves the displayed size when possible.
- Reveal buttons are opt-in. They are useful on simple pages, but broad video/image blocking can produce unreliable click-to-play behavior on complex sites.
- Emoji removal restores same-page text and common text attributes while the original nodes remain. A reload can still be needed when a site re-renders text internally.
- GIF image blocking is DOM-aware instead of a blanket `.gif` network rule, because many sites still use static GIFs as tiny interface controls.
- Broad image blocking is DOM-aware instead of a blanket image request rule, because image galleries often need loaded dimensions to keep their layout.

## Privacy

MotionBlock stores global defaults, per-site rules, display mode, reveal-button preference, diagnostics preference, and UI theme in Chrome extension sync storage. Optional diagnostics keep a bounded per-tab report in extension memory and show it in the popup only while diagnostics are enabled. It uses `storage`, `declarativeNetRequest`, and broad host access so the selected media rules can run locally across arbitrary websites.

MotionBlock does not collect analytics, send browsing data to a developer server, use remote rule lists, or run remote code. See `PRIVACY.md` and `docs/permissions.md`.

## Localization

The extension UI, manifest metadata, and Chrome Web Store detailed description are localized for the 66 locales tracked in `docs/localization.md`. Locale files live in `_locales/<locale>/messages.json`; StorePilot-ready listing files live in `store-assets/store-listing/<locale>.txt`.

Regenerate locale files with:

```powershell
npm run generate:locales:live
```

Then run:

```powershell
npm run verify:locales
```

## Support

If this extension saves you time and you want to support its development:

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-support-FFDD00?logo=buymeacoffee&logoColor=000)](https://buymeacoffee.com/molodchyk)
[![Patreon](https://img.shields.io/badge/Patreon-support-F96854?logo=patreon&logoColor=fff)](https://www.patreon.com/OMolodchyk)

## License

MotionBlock is licensed under the GNU General Public License v3.0. See `LICENSE`.

Source code:

https://github.com/molodchyk/MotionBlock
