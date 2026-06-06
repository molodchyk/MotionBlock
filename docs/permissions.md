# Permissions Justification

## `storage`

Used to save global defaults, per-site preferences, replacement mode, UI theme, and reveal-button preference in Chrome extension sync storage.

## `declarativeNetRequest`

Used to block media requests before they load. This is required for efficient GIF, GIFV, image, video, and audio blocking under Manifest V3.

## `<all_urls>`

Used because users expect media blocking to work across arbitrary websites. MotionBlock applies local rules only and does not transmit browsing data.

## Privacy Position

MotionBlock does not collect analytics, browse history, page content, or remote telemetry. Per-site rules are stored as hostnames in Chrome extension sync storage. If Chrome sync is enabled for extensions, Chrome may sync those settings between the user's Chrome installations. MotionBlock does not operate its own sync server.
