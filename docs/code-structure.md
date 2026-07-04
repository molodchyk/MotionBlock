# Code Structure

This document records MotionBlock's current structure against the shared Extension Modularization Playbook.

The target architecture is feature-first modules with thin runtime entries, pure core logic, platform wrappers for browser APIs, and feature-owned tests/styles. MotionBlock is migrating toward that target in small verified steps.

## Current Runtime Surfaces

- `src/background.js`: Manifest V3 service worker entry. It registers lifecycle, tab, and message listeners, delegates message handling to `src/app/background/message-router.js`, delegates settings persistence to `src/platform/chrome/settings-storage.js`, delegates DNR rule construction to `src/features/network-blocking/background/dynamic-rules.js`, delegates tab/frame block-stat aggregation to `src/features/block-stats/background/tab-stats.js`, delegates per-tab diagnostics aggregation to `src/features/diagnostics/background/diagnostics-store.js`, and owns service-worker orchestration.
- `src/content.js`: manifest-loaded content-script entry. It bootstraps `src/app/content/controller.js`.
- `src/popup.html`, `src/popup.css`, `src/popup.js`: popup runtime entry and assets. `src/popup.js` bootstraps `src/app/popup/controller.js`; `src/app/popup/view.js` owns popup rendering helpers.
- `src/options.html`, `src/options.css`, `src/options.js`: options-page runtime entry and assets. `src/options.js` bootstraps `src/app/options/controller.js`, which currently owns global defaults, website preferences, backup import/export, theme, and reveal-button preference.

## Current Shared And Feature Owners

- `src/shared/config.js`: settings schema, normalization, feature definitions, effective setting calculation, host normalization, backup payload helpers, and UI theme application.
- `src/shared/i18n.js`: Chrome i18n lookup, extension-page localization, locale direction, and RTL locale detection.
- `src/app/background/message-router.js`: background message routing and privileged message validation before dispatching to storage, DNR, and stats collaborators.
- `src/app/content/controller.js`: content-script dependency wiring, settings loading, storage/runtime message listeners, and lifecycle startup.
- `src/app/content/frame-context.js`: content-frame host, ancestor-origin, and referrer host selection for per-site settings.
- `src/app/content/runtime.js`: content mutation observation, shadow-root discovery, dirty-root scheduling, full/settling scans, and CSS-motion document class updates.
- `src/app/content/scanner.js`: content image/media scan loops and media enforcement event handling.
- `src/app/options/controller.js`: options-page state loading/saving, event wiring, rendering, backup import/export, and status messaging.
- `src/app/popup/controller.js`: popup current-tab orchestration, popup event wiring, current-site rule updates, stats refresh, and apply-now dispatch.
- `src/app/popup/view.js`: popup DOM rendering, popup tri-state formatting, popup block-stat normalization, and localized popup presentation text.
- `src/platform/chrome/settings-storage.js`: Chrome sync-storage reads/writes and storage-safe settings sanitization.
- `src/features/network-blocking/background/dynamic-rules.js`: declarativeNetRequest dynamic block-rule construction, temporary allow-rule construction, and DNR rule-id range filtering.
- `src/features/block-stats/background/tab-stats.js`: tab/frame block-stat storage, sanitization, aggregation, and tab cleanup.
- `src/features/block-stats/content/block-stats.js`: content-side block-stat markers, cleanup, snapshots, and debounced stats messages.
- `src/features/diagnostics/background/diagnostics-store.js`: in-memory tab/frame diagnostics storage, sanitization, aggregation, and tab cleanup.
- `src/features/diagnostics/content/audio-bridge.js`: isolated content-script bridge that sends audio-blocking policy to the main-world probe and records probe events in the diagnostics log.
- `src/features/diagnostics/content/diagnostics.js`: content-side bounded diagnostics logging, sanitized URL summaries, media element summaries, and debounced diagnostics messages.
- `src/features/diagnostics/page/media-audio-guard.js`: main-world guard for native media `muted` and `volume` setters while audio blocking is active.
- `src/features/diagnostics/page/audio-probe.js`: main-world audio probe for page-owned `AudioContext`, media `play`, `fetch`, and `XMLHttpRequest` audio behavior. It has no Chrome API access and communicates with the isolated content script through bounded `postMessage` events.
- `src/features/diagnostics/shared/url-sanitizer.js`: shared diagnostics URL sanitization and URL summary helpers used by content and background diagnostics.
- `src/features/emoji-blocking/content/emoji.js`: emoji UI detection, emoji text/attribute stripping, restore behavior, and emoji count helpers.
- `src/features/media-blocking/content/classifier.js`: media URL collection, media-like host detection, media/image block reason classification, and request URL normalization.
- `src/features/media-blocking/content/custom-hosts.js`: custom element/media-host detection and block-reason classification.
- `src/features/media-blocking/content/element-inspection.js`: interface-media detection, hidden accessibility image checks, and GIF-like element metadata matching.
- `src/features/media-blocking/content/effects.js`: image/media/CSS-background blocking effects, autoplay disabling, audio muting, and enforcement.
- `src/features/media-blocking/content/original-state.js`: saved attributes, media runtime state, original style properties, and placeholder sizing.
- `src/features/media-blocking/content/restore.js`: media restore orchestration and restored media reload decisions.
- `src/features/media-blocking/content/reveal-controls.js`: reveal buttons, temporary allow-rule requests, and restored-load retries.
- `src/features/media-blocking/content/url-utils.js`: URL attribute splitting, CSS URL extraction, and media-extension predicates.

## Storage Ownership

- Key: `motionBlockSettings`
- Area: Chrome extension sync storage
- Owner today: `src/shared/config.js` schema plus `src/platform/chrome/settings-storage.js` persistence
- Shape: normalized settings object with `enabled`, `diagnosticsEnabled`, `uiTheme`, `showRevealControls`, `replacementMode`, `features`, and `siteRules`
- Contains: user configuration and per-site hostname preferences
- Migration rule: do not rename without migration and tests

- Runtime diagnostics: in-memory only, owned by `src/features/diagnostics/*`, bounded per tab/frame, cleared on tab close or service-worker restart, and exposed only through the popup when `diagnosticsEnabled` is true.

## Migration Debt

The largest known gaps are:

- `src/app/options/controller.js` is under the source-module soft limit but still owns rendering directly; a future split can move options rendering helpers into `src/app/options/view.js`.
- Most Chrome APIs outside settings persistence are not yet behind dedicated `src/platform/chrome/*` wrappers.
- Tests are still mostly in `test/sanity.js`; feature-owned tests should be added as modules split.
- Extension pages still use classic scripts rather than module scripts or generated bundled output.

## Architecture Guardrails

Run:

```powershell
npm run verify:architecture
```

This reports file-size and folder-density debt. The current tree is expected to pass without findings. Use `-- --fail-on-hard` on the individual audit scripts when a branch is intended to enforce hard budgets.

Release verification remains:

```powershell
npm run verify:release
```
