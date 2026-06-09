# Chrome Web Store Privacy Form

StorePilot can scan this document for Chrome Web Store privacy fields. Keep the `[privacy]` block and canonical keys intact.

[privacy]

single_purpose:
MotionBlock helps users reduce distracting motion and media on websites. It blocks or pauses user-selected media types such as GIFs, GIFV, autoplay video, hover previews, optional WebP URL patterns, video, audio, images, emoji, and CSS motion. Users can configure global defaults and per-site rules from the popup or options page. The extension applies those rules locally in the browser and does not send browsing data, page content, analytics, or telemetry to a developer-operated server.

permission.storage:
The extension needs storage to save and load user settings: global media blocking defaults, per-site rules, display mode, UI theme, reveal-button preference, and imported backup settings. Settings are stored with Chrome extension sync storage so Chrome may sync them between the user's own browser profiles when Chrome extension sync is enabled. Without storage, MotionBlock cannot remember user preferences or apply per-site media rules.

permission.declarativeNetRequest:
The extension uses declarativeNetRequest to block selected media requests before they load when the user enables network-level media blockers such as GIFV, WebP URL patterns, video, or audio. This improves reliability and bandwidth use under Manifest V3 without inspecting or sending requests to a remote server. Rules are generated locally from the user's current MotionBlock settings.

host_permission:
MotionBlock needs broad host access because users expect GIF, autoplay, video, audio, image, emoji, and CSS motion controls to work automatically on arbitrary websites. Content scripts run at document_start to inspect page media elements, media URLs, CSS background media, and emoji text locally before distracting media starts moving. activeTab is not sufficient because it only grants temporary access after a user gesture and would not protect pages opened later or media loaded before the popup is clicked. A fixed site list is not sufficient because users configure their own per-site rules. MotionBlock does not transmit page content or browsing data to any developer-operated server.

remote_code:
No. MotionBlock does not use remote JavaScript or WebAssembly code. All extension code is included in the packaged extension.

privacy_policy_url:
https://github.com/molodchyk/MotionBlock/blob/main/PRIVACY.md

## Data Use Disclosure

Recommended selection:

- Website content

Reasoning:

- Website content: MotionBlock reads page media elements, media URLs, CSS background media, and emoji text locally to apply the user's selected blocking rules. This data is processed in the browser and is not transmitted to a developer-operated server.

Do not select these unless future features change the data model:

- Personally identifiable information
- Health information
- Financial and payment information
- Authentication information
- Personal communications
- Location
- Web history
- User activity

Current privacy position:

- User data is not sold.
- User data is not transferred to third parties except Chrome's own extension sync when the user has Chrome sync enabled, and user-initiated backup export/import.
- User data is not used for unrelated purposes.
- User data is not used for creditworthiness or lending.
- MotionBlock does not use analytics, remote configuration, tracking pixels, external accounts, or developer-operated sync servers.
