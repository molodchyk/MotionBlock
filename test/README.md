# MotionBlock Test Fixture

Serve the fixture locally:

```powershell
.\scripts\serve-fixtures.ps1
```

Then open:

```text
http://127.0.0.1:8765/fixtures.html
```

The fixture covers:

- inline GIF images
- `.gif` and `.gifv` URL patterns
- static transparent GIF UI spacers that should not be blocked
- tiny GIF interface controls inside table rows that should not create row placeholders
- WebP URL patterns
- autoplay video
- muted looping video
- known-site GIF-like URLs
- optional audio/image/emoji/CSS-motion blocking
- dynamically inserted media

Use the popup on `127.0.0.1` to test per-site allow, block motion here, and reset behavior.
