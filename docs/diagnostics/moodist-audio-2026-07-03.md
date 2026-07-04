# Moodist Audio Diagnostics - 2026-07-03

Raw capture: `docs/diagnostics/moodist-audio-2026-07-03.json`

Page: `https://moodist.mvze.net/`

## Finding

The log shows MotionBlock settings were active for `moodist.mvze.net` and the `audio` feature was enabled.

MotionBlock found one native `<audio>` element, classified it as an audio hard block, and repeatedly observed it in a blocked state:

- `tabStats.byFeature.audio` was `1`.
- `scan.media` reported `audioElements: 1`.
- `media.decision` reported `action: hard-block` with `reason.label: audio`.
- The element properties were `paused: true`, `muted: true`, and `volume: 0`.
- The source summary showed a same-host `.wav` URL.
- `scan.customMediaHosts` reported no matching custom media hosts.

## Interpretation Of This Capture

This capture does not show MotionBlock ignoring Moodist's visible native audio element. It shows the opposite: the visible `<audio>` element was blocked.

However, because sound was still audible while this log was captured, this capture was not sufficient. It did not observe page-owned audio APIs or audio fetched outside the browser's native media element path.

Likely explanations before the follow-up fix:

- Moodist also played sound through another path, such as Web Audio / `AudioContext`, decoded audio buffers, or fetched audio data that was not represented as a native `<audio>` element.
- The page reactivated audio through JavaScript property writes or Web Audio state that the old diagnostics did not observe directly.
- The old audio declarativeNetRequest rule only blocked common audio extensions when Chrome classified the request as `media`; audio fetched as script/XHR/fetch could escape that network rule.

## Follow-Up Direction

The follow-up fix adds diagnostics and blocking for Web Audio and audio fetch paths:

- A main-world audio probe logs and blocks `AudioContext` resume, decoding, source starts, destination connects, media `play`, and audio-like `fetch`/`XMLHttpRequest`.
- The audio network rule now covers `media`, `xmlhttprequest`, and `other` resource types for common audio extensions.
- A new Moodist capture should show `pageAudio.*` events if the audible sound uses those paths.
