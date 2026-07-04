# Localization

MotionBlock follows the shared browser-extension localization workflow in `C:\Users\molod\Documents\Personal\settings\Defense_against_Distractions\docs\localization.md`.

## Locale Coverage

The extension ships Chrome `_locales/<locale>/messages.json` files and StorePilot-ready `store-assets/store-listing/<locale>.txt` files for the 66 tracked Chrome Web Store visible-language locales.

The canonical locale list lives in `scripts/locales/locale-source.mjs` and is verified by:

```powershell
npm run verify:locales
```

## Source Of Truth

- UI, manifest, and content-script message keys: `scripts/locales/locale-source.mjs`
- Generated Chrome i18n files: `_locales/<locale>/messages.json`
- Generated store listing files: `store-assets/store-listing/<locale>.txt`
- Runtime i18n helper: `src/shared/i18n.js`

Regenerate translations with:

```powershell
npm run generate:locales:live
```

Use `--missing` to resume an interrupted live translation run without overwriting completed locales:

```powershell
node scripts/locales/generate-locales.mjs --live --missing
```

## QA Rules

`npm run verify:locales` checks:

- exactly the 66 supported locale folders exist;
- every locale has the same message keys as English;
- placeholder names match English;
- every locale has a matching Store listing text file;
- Store listing files do not start with the extension name, a heading, or a field label;
- Store listing files preserve `GPL-3.0` and `https://github.com/molodchyk/MotionBlock`;
- protected literals such as `MotionBlock`, `$COUNT$`, `JSON`, `reddit.com`, `discord.com`, and `news.example.com` do not get glued to translated words;
- non-English locale files are materially translated rather than copied from English;
- Arabic, Persian, Hebrew, and Urdu are wired as right-to-left locales.

## RTL Surfaces

Arabic (`ar`), Persian (`fa`), Hebrew (`he`), and Urdu (`ur`) use `dir="rtl"` on popup and options pages through `src/shared/i18n.js`.

Content-script reveal buttons set their own `lang` and `dir` attributes so injected MotionBlock-owned controls can render right-to-left without changing the host page direction.
