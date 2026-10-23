# Project Status Report

> Turn a few lines into a one-page red/amber/green status report as PDF or e-mail text.

Part of [PM Pocket Tools](../../README.md). Runs entirely in your browser and works without internet.

## What it does

Fill in progress, the colours, and a few bullets, and get a clean one-page report. The tool suggests schedule and overall colours from your planned and forecast dates and progress, and writes the same report as plain text for e-mail.

## Quick start

**No technical knowledge needed**

1. Download this folder (or the whole project as a ZIP from GitHub) and unzip it.
2. Double-click `index.html`. It opens in your browser and works with no internet connection.
3. Keep the folder anywhere you like - on your desktop or a USB stick. It never needs updating to keep working.

**For developers**

```bash
npm install          # once, at the repository root
npm run serve        # then open http://localhost:8080/tools/status-report/
```

Hosting this folder on any static web host (GitHub Pages, Netlify, an intranet web server) needs no build step. See [docs/HOSTING.md](../../docs/HOSTING.md). To publish only this tool as its own repository, run `npm run export-tool -- status-report ../status-report-repo`.

## Features

- Overall, scope, schedule and budget colours; progress bar with a plan marker.
- Suggested colours from slip days (up to 0 green, up to 10 amber) and progress gap (up to 5 points green, up to 15 amber).
- Sections for achievements, next steps, risks and issues, and decisions needed.
- One-page PDF (continues on a second page if long) and copy-as-text.
- Save and reopen as `.json` to update next week.

## How it works

`js/core.js` exports `StatusCore`: `create`, `parseLines`, `worst`, `slipDays`, `ragFromSlip`, `ragFromProgress`, `suggest`, `validate`, `toText`, `sanitize`, `buildPdf`, `serialize`, `parse` and `sample`.

| File                 | Purpose                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| `index.html`         | Page structure and the Content-Security-Policy (blocks all network access)                          |
| `css/theme.css`      | Shared look and feel, light/dark. Synced from `shared/` - do not edit here                          |
| `css/app.css`        | Styles for this tool only                                                                           |
| `js/common.js`       | Shared helpers (downloads, file reading, status messages). Synced from `shared/` - do not edit here |
| `js/core.js`         | The logic: pure functions, unit-tested, no browser needed                                           |
| `js/app.js`          | Connects the page to the logic (thin by design)                                                     |
| `vendor/`            | Bundled third-party code: pdf-lib 1.17.1 (MIT)                                                      |
| `tests/core.test.js` | Unit tests for the logic                                                                            |

## Privacy and security

- Everything happens in your browser. Nothing you open, type or create is sent anywhere.
- The page's Content-Security-Policy (`<meta http-equiv="Content-Security-Policy">`) forbids network requests, inline scripts and `eval`, so even a bug could not send your data out.
- Third-party code is bundled in `vendor/` (exact versions and licenses in `vendor/README.md`) instead of loaded from a CDN, so there is no third party in the loop when you use the tool.
- Project data (budgets, risks, names of people) can be sensitive. The files you save (`.json`, `.csv`, `.pdf`) are not password-protected: keep them where only the right people can open them.

## Limitations

- The suggested colours are only prompts: the thresholds are simple and you decide what is honest.
- PDF fonts are Latin only; the rupee sign prints as `Rs.` and other scripts as `?`.
- Up to 12 bullets per section. Treat results as planning aids and check anything important before you rely on it.

## Development

```bash
npm test                                                     # all tools, from the repository root
node --test tools/status-report/tests/core.test.js   # just this tool
npm run verify                                               # tests + lint + formatting + repository checks
```

The logic in `js/core.js` has no browser dependencies, so you can reuse it from Node: `const core = require('./js/core.js');`

Conventions (pure `core.js`, thin `app.js`, tests for every function) are described in [CONTRIBUTING.md](../../CONTRIBUTING.md) and [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).

## License

MIT - see [LICENSE](LICENSE). pdf-lib (MIT).
