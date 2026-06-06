# Manual Test Plan

## Local Fixture

1. Load MotionBlock unpacked from the project root.
2. Run `.\scripts\serve-fixtures.ps1`.
3. Open `http://127.0.0.1:8765/fixtures.html`.
4. Confirm defaults:
   - inline GIF is blocked
   - normal PNG remains visible
   - WebP URL is not blocked by default
   - GIFV video is blocked
   - muted looping Reddit-like video is blocked
   - normal autoplay video has autoplay removed
   - audio remains visible
   - CSS animation still runs
   - emoji remains visible
   - GitHub-style reaction buttons remain visible
   - dynamically inserted GIF/media is blocked
5. Open the popup and click **Allow this site**.
6. Reload the page and confirm media is allowed.
7. Click **Block motion here**.
8. Reload the page and confirm GIF/GIFV/autoplay/CSS motion are blocked on the fixture.
9. Set Emoji to **Block here** and confirm emoji text/images and GitHub-style reactions are hidden.
10. In Options, switch Interface theme between System, Light, and Dark and confirm popup/options follow the selected mode.
11. In Options, confirm **Reveal buttons for blocked media** is off by default. Enable it only when testing click-to-play on simple pages.
12. Export a JSON backup file, import it back from the file picker, and confirm settings remain intact.
13. Paste the exported JSON into the textarea, apply it, and confirm settings remain intact.
14. Click **Refresh from sync** and confirm the options page reloads current settings without changing them.
15. Use **Reset site** and reload.

## Review-Derived Live Sites

Test these after the local fixture behaves correctly:

- reddit.com
- discord.com
- giphy.com
- facebook.com
- steamcommunity.com
- youtube.com hover previews
- youtube.com image/video placeholders after reload and scroll/lazy-load
- stocktwits.com
- flipboard.com
- weather.com
- huffpost.com
- linkedin.com
- github.com/mifi/lossless-cut

## What To Record

For each site, record:

- URL tested
- which MotionBlock settings were active
- what was blocked correctly
- what slipped through
- whether the site broke
- whether a per-site allow rule fixed breakage

Add repeatable failures to `docs/review-feedback.md` or a future issue tracker.
