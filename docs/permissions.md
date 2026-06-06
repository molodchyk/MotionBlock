# Permissions Justification

## `storage`

Used to save global defaults, per-site preferences, replacement mode, and import/export settings.

## `declarativeNetRequest`

Used to block media requests before they load. This is required for efficient GIF, GIFV, image, video, and audio blocking under Manifest V3.

## `activeTab`

Used by the popup to read the active tab URL after the user opens the extension popup. This lets MotionBlock show and update preferences for the current website.

## `<all_urls>`

Used because users expect media blocking to work across arbitrary websites. MotionBlock applies local rules only and does not transmit browsing data.

## Privacy Position

MotionBlock does not collect analytics, browse history, page content, or remote telemetry. Per-site rules are stored as hostnames in Chrome extension storage.
