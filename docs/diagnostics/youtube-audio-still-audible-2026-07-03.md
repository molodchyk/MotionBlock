# YouTube Audio Still Audible - 2026-07-03

Saved source log:

- `docs/diagnostics/youtube-audio-still-audible-2026-07-03.json`

## What The Log Shows

- Page host: `youtube.com`.
- Effective state: MotionBlock enabled, audio blocking enabled, video blocking disabled.
- Native media path: one native `<video>` element was observed.
- No alternate audio path was observed: zero Web Audio events, zero audio-like `fetch` events, and zero audio-like `XMLHttpRequest` events.
- MotionBlock repeatedly recorded `media.videoAudioMuted`, but the captured media properties still showed a non-zero volume around `0.777`.

## Diagnosis

This was a native-video audio regression, not a Web Audio or audio-fetch miss. The content-side audio blocker muted the YouTube `<video>` element but did not force `volume` to `0`, and the page could restore audible state between scans.

## Fix Direction

- Keep YouTube video playback running when only the audio feature is blocked.
- Force native video audio to both `muted=true` and `volume=0`.
- Add a main-world property guard for native media `muted` and `volume` setters while audio blocking is enabled.
- Record diagnostics when the page tries to unmute video or raise video volume.
