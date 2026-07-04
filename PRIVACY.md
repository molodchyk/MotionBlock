# Privacy

MotionBlock stores extension settings with Chrome extension sync storage. Stored settings include global media blocking defaults, per-site hostname rules, blocked media display mode, reveal-button preference, advanced diagnostics preference, and UI theme. If Chrome sync is enabled for extensions in the user's browser profile, Chrome may sync those settings between the user's Chrome installations.

MotionBlock does not collect, sell, transmit, or analyze personal data. It does not use analytics, remote configuration, tracking pixels, external accounts, or developer-operated sync servers.

MotionBlock reads page media elements, media URLs, CSS background media, and emoji text only to apply the user's selected blocking rules locally in the browser. Per-site preferences are stored as hostnames so the extension can apply user-selected rules on matching websites.

When audio blocking is enabled, MotionBlock can also observe and block page-owned audio APIs locally, including Web Audio context resume/decoding/source starts and audio-like `fetch` or `XMLHttpRequest` URLs. If the user enables advanced diagnostics, MotionBlock keeps a bounded per-tab diagnostic report in extension memory. That report can include the current page host, frame host, effective MotionBlock settings, media element flags, Web Audio events, audio-like request summaries, blocked-count summaries, and sanitized media URL summaries without query strings or fragments. The report is shown in the popup for the user to copy while troubleshooting and is not sent to MotionBlock's developer or any developer-operated server.

MotionBlock uses these permissions:

- `storage`: saves global defaults, per-site preferences, display mode, reveal-button preference, advanced diagnostics preference, and UI theme.
- `declarativeNetRequest`: blocks selected media requests before they load when the user enables network-level media blockers.
- `<all_urls>` host access: lets the content script apply user-selected media rules on arbitrary websites. MotionBlock excludes Chrome Web Store pages and cannot modify browser-internal or other protected pages.

MotionBlock does not make developer-operated network requests. All executable extension code is packaged with the extension. It does not use remote JavaScript, WebAssembly, analytics, ads, tracking, or remote code.

## Optional Uninstall Feedback

After uninstalling the Chrome version, Chrome may open an optional feedback page at `https://molodchyk.com/motionblock/uninstall/`. The extension sets only generic URL parameters for `source=chrome`, the extension version, and the Chrome UI language. It does not send user identifiers, browsing data, page content, settings, per-site rules, counters, media URLs, diagnostics, or copied logs.

Submitting the feedback form is voluntary. The form is intended to be processed by Formspree and should not include personal data unless the user chooses to provide it.

The use of information received from Chrome APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements.
