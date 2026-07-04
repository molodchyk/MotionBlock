# Release Notes

## 1.0.1 - 2026-07-04

- Added an optional Chrome post-uninstall feedback page hook at `https://molodchyk.com/motionblock/uninstall/`.
- Kept uninstall feedback URL parameters limited to source, extension version, and Chrome UI language.
- Documented the optional feedback flow in the privacy policy, permissions notes, and Chrome Web Store privacy form.
- Fixed native-video audio blocking so YouTube-style video playback can continue while audio is forced silent with both `muted=true` and `volume=0`.
- Added a main-world native media audio guard that records when pages try to unmute video or raise volume while audio blocking is active.
- Improved popup and CLI diagnostics so copied logs identify native media, Web Audio, audio request paths, repeated video muting, and non-zero-volume mute failures.
- Saved reproducible diagnostics for Moodist and YouTube audio investigations in `docs/diagnostics/`.
- Localized extension UI, manifest metadata, and StorePilot-ready store listings for 66 Chrome Web Store visible-language locales.
- Strengthened locale QA for placeholder parity, protected-token spacing, long English fallback strings, unchanged English store listing lines, right-to-left locale wiring, and high-risk Russian popup terminology.
- Fixed Russian popup labels including reload, diagnostics copy/refresh, reset site, global settings, and options wording.
- Added StorePilot-ready Chrome Web Store category and additional-fields documents.
- Refactored extension code toward feature-owned modules with manifest, import, package, file-size, and folder-density verification.

Verification:

- `npm test`
- `npm run verify:locales`
- `npm run verify:imports`
- `npm run verify:manifest`
- `npm run verify:architecture`
- `npm run verify:release`

Package:

- `dist/motionblock-1.0.1.zip`
