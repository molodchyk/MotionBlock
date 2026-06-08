# MotionBlock QA Checklist

Use this checklist before packaging or publishing a release. Run it in passes, not as a one-off: many MotionBlock failures appear only after reload, lazy-load, scrolling, changing settings while media is already loaded, or returning to a previously blocked state.

## Run Protocol

Create one run block per pass:

```text
Run:
Date:
Extension version / commit:
Chrome version:
Profile used:
Tester:
Pass type: Defaults / Broad blockers / Toggle regression / Post-fix rerun
Result: Pass / Needs fix / Blocked
Notes:
```

Recommended pass order:

1. **Defaults pass**: global defaults only.
2. **Broad blockers pass**: enable WebP, Video, Audio, Images, Emoji, and CSS motion.
3. **Per-site pass**: use popup overrides on each site, including Allow this site, Block motion here, individual Block here, and Reset site.
4. **Toggle pass**: change settings while media is already loaded, without reloading the page.
5. **Reload/lazy-load pass**: reload, scroll, open posts/modals, switch feeds, and verify newly inserted media.
6. **Post-fix rerun**: after any bug fix, rerun the failing site plus at least YouTube, Reddit, Instagram, X, Gmail, and Google Images.

## Global Checks

| Check | Expected | Pass 1 | Pass 2 | Pass 3 | Notes |
| --- | --- | --- | --- | --- | --- |
| Extension loads unpacked | No console errors in `chrome://extensions` | [ ] | [ ] | [ ] | |
| Popup opens on normal websites | Shows current host, status, counters, and feature rows | [ ] | [ ] | [ ] | |
| Popup on options/protected pages | Shows unsupported state; no useless site controls | [ ] | [ ] | [ ] | |
| Options page opens | Settings render and save | [ ] | [ ] | [ ] | |
| System/light/dark UI mode | Popup and options follow selected mode | [ ] | [ ] | [ ] | |
| Backup export | Downloads valid JSON | [ ] | [ ] | [ ] | |
| Backup import from file | Restores settings | [ ] | [ ] | [ ] | |
| Backup import from pasted JSON | Restores settings | [ ] | [ ] | [ ] | |
| Sync refresh | Refreshes settings without corrupting current config | [ ] | [ ] | [ ] | |
| Counters | Counts blocked items by category and resets sensibly after reload/navigation | [ ] | [ ] | [ ] | |
| Reveal controls off by default | No top-left floating reveal buttons unless explicitly enabled | [ ] | [ ] | [ ] | |
| Reveal controls on | Button is near the blocked item, clickable, and does not get stuck | [ ] | [ ] | [ ] | |

## Feature Checks

| Feature | Test | Expected | Pass 1 | Pass 2 | Pass 3 | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| GIFs | Static page GIF and dynamically inserted GIF | Blocked by default; static UI spacer GIFs are not blocked | [ ] | [ ] | [ ] | |
| GIFV | `.gifv`, Redgifs/Giphy/Tenor-style looping media | Blocked when GIFV is enabled | [ ] | [ ] | [ ] | |
| Autoplay | Native autoplay or looping muted video | Playback stops without destroying the player | [ ] | [ ] | [ ] | |
| Video | Loaded video/reel/feed media | Hidden or blocked; unblock restores without page reload when possible | [ ] | [ ] | [ ] | |
| Audio | Video with sound and native audio element | Audio mutes immediately; unblocking restores without needing pause/play | [ ] | [ ] | [ ] | |
| Images | Normal images, lazy-loaded images, `srcset`, CSS backgrounds | Blocked without collapsing layout or inventing uniform dimensions | [ ] | [ ] | [ ] | |
| WebP | Static `.webp` image | Only blocked when WebP is enabled | [ ] | [ ] | [ ] | |
| Emoji | Text emoji, title attributes, reaction images, emoji sprites | Emoji removed/hidden without breaking surrounding text/actions | [ ] | [ ] | [ ] | |
| CSS motion | CSS animations/transitions/smooth scroll | Motion stops; page remains usable | [ ] | [ ] | [ ] | |
| Site allow | Allow this site | All blockers inactive on that site | [ ] | [ ] | [ ] | |
| Individual override | Set one row to Block here while site was allowed | Site reactivates and selected blocker applies | [ ] | [ ] | [ ] | |
| Reset site | Reset site rule | Site returns to global defaults | [ ] | [ ] | [ ] | |

## Local Fixture

Run `.\scripts\serve-fixtures.ps1`, open `http://127.0.0.1:8765/fixtures.html`, and test before live sites.

| Check | Expected | Pass 1 | Pass 2 | Pass 3 | Notes |
| --- | --- | --- | --- | --- | --- |
| Inline GIF | Blocked by default | [ ] | [ ] | [ ] | |
| Normal PNG | Remains visible by default | [ ] | [ ] | [ ] | |
| Static GIF UI spacer | Remains visible and clickable | [ ] | [ ] | [ ] | |
| Table-row GIF control | Does not turn the whole row into a placeholder | [ ] | [ ] | [ ] | |
| Collapsed gallery thumbnail | Keeps plausible thumbnail dimensions with Images enabled | [ ] | [ ] | [ ] | |
| Varied images | Placeholders keep varied dimensions, not uniform squares | [ ] | [ ] | [ ] | |
| WebP | Allowed by default; blocked only when WebP enabled | [ ] | [ ] | [ ] | |
| GIFV video | Blocked | [ ] | [ ] | [ ] | |
| Muted looping video | Stops without damaging restore | [ ] | [ ] | [ ] | |
| Normal autoplay video | Autoplay removed/paused | [ ] | [ ] | [ ] | |
| Audio element | Allowed by default; blocked when Audio enabled | [ ] | [ ] | [ ] | |
| CSS animation | Allowed by default; stopped when CSS enabled | [ ] | [ ] | [ ] | |
| Emoji text/images | Allowed by default; hidden when Emoji enabled | [ ] | [ ] | [ ] | |
| Dynamic insertion | Late GIF/media is blocked | [ ] | [ ] | [ ] | |
| Popup controls | Allow, Block motion here, individual overrides, Reset site all work | [ ] | [ ] | [ ] | |

## Live Site Matrix

For every site:

- Record exact URL.
- Test defaults first.
- Test broad blockers.
- Change one setting while media is already loaded.
- Reload and test again.
- Scroll enough to trigger lazy-loaded media.
- Watch for layout collapse, stuck overlays, broken clicks, lag, console errors, and counters lying.

| Site | URLs / Areas | Must Verify | Pass 1 | Pass 2 | Pass 3 | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| YouTube | Home, search results, watch page, sidebar recommendations | Hover previews stop; thumbnails/images block cleanly; video/audio toggles work; emoji in titles/descriptions is removed when enabled; no stuck reveal button in top-left | [ ] | [ ] | [ ] | |
| Reddit | Home feed, subreddit page, post page, embedded YouTube, native video posts, sidebar cards | `shreddit-*` media is handled; native video and audio block; YouTube embeds are not missed; subreddit banners do not flicker; scroll remains responsive | [ ] | [ ] | [ ] | |
| Instagram | Reels page, feed post, profile grid | Video block/unblock works without reload; audio block/unblock takes effect immediately; image/emoji blockers do not leave “trouble playing this video” after unblock | [ ] | [ ] | [ ] | |
| X / Twitter | Home feed, image post modal, video post, profile | Images actually hide/block despite absolute-position CSS; opening a post does not freeze; videos/audio block; emoji stripping works; counters are plausible | [ ] | [ ] | [ ] | |
| Gmail | Inbox, message list, compose, message view | Static GIF controls and clickable row actions are not counted as content GIFs; inbox remains clickable; real message images follow image settings | [ ] | [ ] | [ ] | |
| Google Images / CSE | Image results page and custom search image tab | Image placeholders keep masonry/list layout; no collapsed narrow bars; unblock restores varied dimensions | [ ] | [ ] | [ ] | |
| GitHub | Releases page, issue/PR comments, reactions | Emoji/reactions block only when enabled; text remains readable; release images/media follow settings | [ ] | [ ] | [ ] | |
| Giphy | Search results, GIF detail page | GIFs and GIFV-like media block; toggling restores without reload where possible | [ ] | [ ] | [ ] | |
| Tenor | Search results and GIF detail | GIFs and looping media block; layout stays usable | [ ] | [ ] | [ ] | |
| Discord web | Channel messages, GIF picker if available, reactions | GIFs/media previews block; emoji/reactions behavior is acceptable; app remains responsive | [ ] | [ ] | [ ] | |
| Facebook | Feed, comments, GIF comments if available | GIF/video blocks apply to feed and comments; no broad UI breakage | [ ] | [ ] | [ ] | |
| Threads | Feed, post page | Images/video/audio/emoji toggles work; no major feed lag | [ ] | [ ] | [ ] | |
| Steam Community | Community pages and activity feed | GIF/video previews block; page layout and controls stay usable | [ ] | [ ] | [ ] | |
| Stocktwits | Feed/media posts | GIF/video/image blockers apply; no missed disguised media | [ ] | [ ] | [ ] | |
| Flipboard | Feed and article cards | Animated or disguised media blocks; normal navigation works | [ ] | [ ] | [ ] | |
| LinkedIn | Feed, comments, reactions | Images/video/emoji toggles work; reaction controls remain usable | [ ] | [ ] | [ ] | |
| Weather/news site | Weather.com or similar animated-heavy page | CSS motion and media blocking work without making page unusable | [ ] | [ ] | [ ] | |
| HuffPost/news article | Article with ads, embeds, GIFs | GIF/autoplay blocking works; article reading layout remains stable | [ ] | [ ] | [ ] | |

## Regression Traps

Run these after any content-script change:

| Trap | Steps | Expected | Pass 1 | Pass 2 | Pass 3 | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Loaded video unblock | Open Instagram/YouTube/fixture video, enable Video, then disable Video without reload | Player is visible again or left only autoplay-paused; no permanent error | [ ] | [ ] | [ ] | |
| Loaded audio toggle | Open Reddit/Instagram video with sound, enable Audio, then disable Audio without reload | Mutes and unmutes immediately | [ ] | [ ] | [ ] | |
| Site allowed plus feature block | Allow a site, then set Audio or Images to Block here | Site becomes active and selected feature blocks | [ ] | [ ] | [ ] | |
| Gmail UI sprites | Enable GIFs and Images on Gmail inbox | Clickable controls are not turned into content placeholders | [ ] | [ ] | [ ] | |
| CSS background flicker | Enable Images on Reddit subreddit banner or another CSS-background page | Background remains blocked without rapid flicker | [ ] | [ ] | [ ] | |
| Placeholder dimensions | Enable Images on Google Images/CSE and X | Layout does not collapse or become uniform fake squares | [ ] | [ ] | [ ] | |
| Reveal overlay | Enable reveal controls and block media on YouTube/fixture | Button is positioned by the item, clickable, and disappears after temporary allow | [ ] | [ ] | [ ] | |
| Shadow DOM media | Reddit custom elements or other open-shadow-root media | Nested media is discovered and blocked | [ ] | [ ] | [ ] | |
| Iframe/embed media | Reddit with embedded YouTube or news article embeds | Frame uses top-site preferences where possible; media is not missed silently | [ ] | [ ] | [ ] | |
| Lag pass | Scroll Reddit, X, YouTube, Instagram for several minutes with broad blockers enabled | No obvious freezes, flicker loops, or runaway counter growth | [ ] | [ ] | [ ] | |

## Failure Log Template

```text
Failure:
Date:
Commit:
Site / URL:
Settings:
Reloaded before test: Yes / No
Steps:
Expected:
Actual:
Screenshots / DOM snippet:
Console errors:
Counter values:
Does Allow this site fix it:
Does reload fix it:
Severity: Release blocker / Major / Minor / Watch
Retest scope after fix:
```

## Release Gate

Do not publish if any release blocker remains:

- A default setting breaks major sites such as YouTube, Reddit, Instagram, X, Gmail, or Google Images.
- Blocking and then unblocking a loaded video/audio leaves it broken until page reload.
- GIF blocking catches ordinary UI controls on a major site.
- Broad Images collapses common image-grid layouts.
- A site becomes materially laggy or flickers continuously.
- Popup or options settings are saved but do not match the effective behavior.

Acceptable known tradeoffs must be documented in `docs/review-feedback.md` or a GitHub issue before release.
