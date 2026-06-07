# Chrome Web Store Entry

Copy-paste fields for the first public listing.

## Extension Name

MotionBlock: GIF, Animation & Autoplay Blocker

## Summary

Stop looping GIFs, GIFV, autoplay video, and distracting motion with global and per-site controls.

## Category

Accessibility

Alternative if the Store category fit feels better during submission:

Productivity

## Language

English

## Detailed Description

MotionBlock helps make busy web pages calmer by blocking distracting motion before it gets in your way.

Use MotionBlock to stop:

- looping GIF images
- GIFV links
- short muted videos used like GIFs
- autoplay video and hover previews
- optional animated WebP URL patterns
- optional video, audio, images, emoji, and CSS motion

MotionBlock is built around per-site control. Keep conservative global defaults, then allow or block specific media types on individual websites from the popup or options page.

Common uses:

- stop distracting animations while reading
- reduce autoplay video noise
- save bandwidth from unnecessary media
- block YouTube-style hover previews
- allow image-heavy sites while blocking motion elsewhere
- quickly allow media on sites that need it

The popup controls the current site. The options page manages global defaults, per-site preferences, JSON backup import/export, Chrome-profile settings sync, blocked media display, optional reveal buttons, and light/dark/system UI theme.

MotionBlock does not collect analytics, send browsing data to a server, or use remote rule lists. Settings are stored in Chrome extension sync storage and may sync through Chrome if the user has Chrome extension sync enabled.

## Support URL

https://github.com/molodchyk/MotionBlock/issues

## Website URL

https://github.com/molodchyk/MotionBlock

## Privacy Policy URL

https://github.com/molodchyk/MotionBlock/blob/main/PRIVACY.md

## Permissions Justification

### storage

Used to save global defaults, per-site preferences, blocked media display mode, UI theme, and reveal-button preference in Chrome extension sync storage.

### declarativeNetRequest

Used to block selected media requests before they load. This is required for efficient GIFV, WebP URL-pattern, video, and audio blocking under Manifest V3. Plain GIF and broad image elements are handled in the page so static interface controls and image-gallery layouts are not broken by blanket request rules.

### host permissions for all URLs

Used because users expect media blocking to work across arbitrary websites. MotionBlock applies local rules only and does not transmit browsing data.

## Data Disclosure

MotionBlock does not collect, sell, transmit, or analyze personal data. It does not use analytics, remote configuration, tracking pixels, external accounts, or developer-operated sync servers.

MotionBlock reads page media elements only to apply the user's selected blocking rules. Per-site preferences are stored as hostnames in Chrome extension sync storage.

## Promo Assets

- Small promo tile: `assets/store/cws-small-promo-440x280.png`
- Marquee promo tile: `assets/store/cws-marquee-promo-1400x560.png`

## Package

Run:

```powershell
.\scripts\package.ps1
```

Upload the generated ZIP from `dist/`.

## Troubleshooting Copy

If media is still visible after installing or changing settings, reload the page. Some websites load media dynamically or convert GIFs into short video files, so MotionBlock uses both selective request blocking and page cleanup.

Chrome does not allow extensions to modify browser-internal pages, the Chrome Web Store, or some protected pages.

If a site breaks, open the popup and choose **Allow this site**.
