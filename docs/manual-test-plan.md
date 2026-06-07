# Manual Test Plan

## Local Fixture

1. Load MotionBlock unpacked from the project root.
2. Run `.\scripts\serve-fixtures.ps1`.
3. Open `http://127.0.0.1:8765/fixtures.html`.
4. Confirm defaults:
   - inline GIF is blocked
   - normal PNG remains visible
   - static GIF spacer inside a UI button remains visible and clickable
   - tiny GIF interface control inside the table-row fixture remains visible and does not turn the row into a placeholder
   - collapsed gallery thumbnail fixture becomes a normal thumbnail-sized placeholder when Images is enabled
   - varied loaded images keep varied placeholder dimensions when Images is enabled
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
9. Confirm popup feature labels show each media type and its Blocking/Allowed state on separate lines.
10. Confirm popup rows distinguish Global from Override state.
11. Confirm changing a popup preference shows the reload hint.
12. Set Emoji to **Block here** and confirm emoji text/images and GitHub-style reactions are hidden.
13. Set Images to **Block here** and confirm blocked image placeholders are quiet neutral boxes, not high-contrast patterns.
14. In Options, confirm global features are grouped into motion blocking and broad media blockers.
15. Click **Restore recommended** and confirm GIFs/GIFV/autoplay return on while broad blockers remain off.
16. In Options, switch Interface theme between System, Light, and Dark and confirm popup/options follow the selected mode.
17. In Options, confirm **Reveal buttons for blocked media** is off by default. Enable it only when testing click-to-play on simple pages.
18. Export a JSON backup file, import it back from the file picker, and confirm settings remain intact.
19. Paste the exported JSON into the textarea, apply it, and confirm settings remain intact.
20. Click **Refresh from sync** and confirm the options page reloads current settings without changing them.
21. Open the popup while the Options page or `chrome://extensions` is active and confirm current-site controls are hidden.
22. Use **Reset site** and reload.

## Review-Derived Live Sites

Test these after the local fixture behaves correctly:

- reddit.com
- reddit.com feed videos inside `shreddit-*` custom elements should stop when Video or Audio is enabled
- discord.com
- giphy.com
- facebook.com
- steamcommunity.com
- youtube.com hover previews
- youtube.com image/video placeholders after reload and scroll/lazy-load
- google.com image search with Images enabled should show calm placeholders that keep the page's varied masonry layout, not uniform invented squares
- mail.google.com inbox controls and message-row actions should not become GIF placeholders, even when Gmail uses static GIF UI sprites
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
