# Permissions Justification

## `storage`

Used to save global defaults, per-site preferences, replacement mode, UI theme, reveal-button preference, and advanced diagnostics preference in Chrome extension sync storage.

## `declarativeNetRequest`

Used to block selected media requests before they load. This is required for efficient GIFV, WebP URL-pattern, video, and audio blocking under Manifest V3. Plain GIF and broad image elements are handled in the page so static interface controls and image-gallery layouts are not broken by blanket request rules.

## `<all_urls>`

Used because users expect media blocking to work across arbitrary websites. MotionBlock applies local rules only, including page-owned media elements, Web Audio APIs, and audio-like request paths, and does not transmit browsing data.

## Privacy Position

MotionBlock does not collect analytics, browse history, page content, or remote telemetry. Per-site rules are stored as hostnames in Chrome extension sync storage. If Chrome sync is enabled for extensions, Chrome may sync those settings between the user's Chrome installations. Optional diagnostics keep a bounded per-tab report in extension memory for user-initiated copying from the popup. MotionBlock does not operate its own sync server.
