<p align="center">
  <img src="icons/icon.svg" alt="" width="112">
</p>

<h1 align="center">No Noise</h1>

<p align="center">
  <strong>A Firefox extension that removes the recurring noise from your browsing history,<br>
  so the pages worth keeping rise back to the surface — entirely on your machine.</strong>
</p>

<p align="center">
  <img alt="Firefox 140+" src="https://img.shields.io/badge/Firefox-140%2B-FF7139?logo=firefoxbrowser&logoColor=white">
  <img alt="Firefox for Android 142+" src="https://img.shields.io/badge/Android-142%2B-FF7139?logo=firefoxbrowser&logoColor=white">
  <img alt="8 languages" src="https://img.shields.io/badge/languages-8-d6336c">
  <img alt="No data collected" src="https://img.shields.io/badge/data%20collected-none-2ea44f">
  <a href="LICENSE"><img alt="MIT licence" src="https://img.shields.io/badge/licence-MIT-blue"></a>
</p>

<p align="center">
  <a href="README.fr.md">Lire en français</a>
</p>

## Why

Browsing history is a second memory: when you cannot quite remember where you
saw something — a docs page, an article, a product — you search history and
find it. Until the signal drowns in noise.

Day after day the same handful of sites pile up: pull requests, photo albums,
identical searches, the same dashboards. None of those visits are worth
remembering, yet they bury the one page you care about.

Turning history off throws away the useful part. A cloud “helper” would read
your browsing. **No Noise** removes only the sites you choose — automatically,
as you browse — and never sends a byte off your machine.

## Features

- **Three cleaning modes**, combinable: real-time (adaptive), periodic sweep,
  and on demand — plus <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> and a
  right-click **“Add this site to No Noise”** menu.
- **Delete and Keep rules** — a Keep rule protects URLs even when a Delete rule
  matches (purge `google.com` but keep `google.com/maps`).
- **Four pattern types**: Contains, Domain (subdomains included), Wildcard
  (`*`), Regular expression.
- **Per-rule scheduling and retention**: always / real-time only / sweeps only,
  and optionally only entries older than N days.
- **History noise analyzer** — scan history, see the domains that clutter it
  most, turn each into a rule in one click.
- **Safety**: simulation (dry-run), confirmation before manual cleaning, warning
  above a configurable number of deletions.
- **Privacy-minded log**: domain names only by default (full URL or off are
  opt-in); notifications are optional.
- **URL tester**, statistics, JSON import/export (with merge/replace preview)
  and a plain-text pattern importer.
- **Eight languages**, selected from the browser locale. 100 % local.

## Install (development)

Firefox 140 or later on desktop, Firefox for Android 142 or later.

| Method | How |
| ------ | --- |
| **Temporary, from source** | `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on…* → pick `manifest.json` |
| **With web-ext** | `npm install` then `npm start` |

```bash
npm install
npm test            # unit tests
npm run lint        # Mozilla web-ext lint
npm run lint:js     # ESLint
npm run build       # .zip in web-ext-artifacts/
```

Publication on Firefox Add-ons comes later — this repo is prepared for it
(`mister-no-noise@mister-guiiug`) but not submitted yet.

## Privacy

**No data is collected.** The manifest declares it
(`data_collection_permissions: none`). No analytics, no account, no ads.

Rules, settings, logs and statistics stay in your browser
(`storage.local`). Optional desktop notifications are requested only if you
turn them on. The right-click menu can be disabled in the options.

## Permissions

| Permission | Purpose |
| ---------- | ------- |
| `history` | Read and delete history entries |
| `storage` | Store rules, settings and statistics |
| `alarms` | Trigger the periodic sweep |
| `contextMenus` | “Add this site” right-click entry (can be turned off in options) |
| `notifications` | Report cleanings (**optional**) |

## Languages

English (default), French, Spanish, German, Italian, Portuguese (Brazil),
Russian, Simplified Chinese. Add one by copying `_locales/en/messages.json` to
`_locales/<code>/messages.json` and translating the `message` values.

## Project structure

```
manifest.json         MV3 (Firefox event page, 140+)
manifest.chrome.json  Chromium variant (experimental)
_locales/<code>/      UI translations
icons/icon.svg        Toolbar icon
src/common/           Compat shim + shared logic (SHC)
src/background.js     Real-time, sweeps, analyzer, menu, command
src/popup/            Toolbar popup
src/options/          Full configuration page
test/                 Unit tests (node --test)
```

## Licence

[MIT](LICENSE) — © GuiiuG
