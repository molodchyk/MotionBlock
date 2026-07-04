# YouTube Audio Regression Capture - 2026-07-03

Raw capture: `docs/diagnostics/youtube-audio-regression-2026-07-03.json`

Analyze with:

```powershell
npm run analyze:diagnostics -- docs\diagnostics\youtube-audio-regression-2026-07-03.json
```

## Scenario

- Page: `https://www.youtube.com/watch`
- Effective host: `youtube.com`
- Audio blocking: enabled
- Video blocking: disabled
- User-visible behavior: video felt like repeated pause/resume while audio blocking was active.

## Evidence

The diagnostic capture recorded 143 entries. The dominant events were:

- `scan.media`: 44
- `scan.customMediaHosts`: 44
- `media.videoAudioMuted`: 31
- `pageAudio.media.videoMutedBeforePlay`: 2

The log shows the new main-world audio probe muting a YouTube `<video>` before its `play()` call, followed by repeated content-script video-audio mute events during normal scans.

## Root Cause

The Moodist fix added broad page-level audio interception for Web Audio, audio fetches, and media playback. That was correct for audio-only implementations, but it was too aggressive for native `<video>` playback. Audio blocking should not turn video playback into a hard playback-control path.

## Fix

- The page audio probe no longer mutates `<video>.play()` calls.
- Native `<audio>.play()` remains blocked.
- Native `<video>` audio blocking is handled by the content layer as a mute-only operation.
- Video audio muting is now idempotent and no longer forces `volume = 0` repeatedly.
- Diagnostics only record `media.videoAudioMuted` when MotionBlock actually changes a video from audible to muted.

This keeps broad audio coverage for Moodist-style Web Audio and audio fetch paths while avoiding playback thrash on video-heavy sites such as YouTube.
