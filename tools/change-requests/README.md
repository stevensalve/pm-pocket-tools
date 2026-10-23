# Change Request Log

> Log change requests with cost and schedule impact, record decisions and print a form.

Part of [PM Pocket Tools](../../README.md). Runs entirely in your browser and works without internet.

## What it does

Raise change requests with their cost and schedule impact, move them through submitted, approved, rejected, deferred and implemented, and see the running effect on budget and end date. Print a one-page request form with approval lines.

## Quick start

**No technical knowledge needed**

1. Download this folder (or the whole project as a ZIP from GitHub) and unzip it.
2. Double-click `index.html`. It opens in your browser and works with no internet connection.
3. Keep the folder anywhere you like - on your desktop or a USB stick. It never needs updating to keep working.

**For developers**

```bash
npm install          # once, at the repository root
npm run serve        # then open http://localhost:8080/tools/change-requests/
```

Hosting this folder on any static web host (GitHub Pages, Netlify, an intranet web server) needs no build step. See [docs/HOSTING.md](../../docs/HOSTING.md). To publish only this tool as its own repository, run `npm run export-tool -- change-requests ../change-requests-repo`.

## Features

- Controlled status flow: a decision needs who, when and (for a rejection) a reason; decided requests cannot be edited.
- Impacts in rupees (minus for savings) and days.
- Running totals; optional baseline budget and end date show the revised figures and "if everything pending is approved".
- Printable A4 form per request (PDF), CSV, print, and save/open as `.json`.

## How it works

`js/core.js` exports `ChangeCore`: `CATEGORIES`, `PRIORITIES`, `STATUSES`, `NEXT`, `create`, `add`, `update`, `setStatus`, `list`, `totals`, `toCsv`, `sanitize`, `buildPdf`, `serialize`, `parse` and `sample`.

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

- It records decisions; it is not a workflow or approval system and cannot enforce who may approve.
- Impacts are simply added up: overlapping changes are not netted off.
- PDF fonts are Latin only. Treat results as planning aids and check anything important before you rely on it.

## Development

```bash
npm test                                                     # all tools, from the repository root
node --test tools/change-requests/tests/core.test.js   # just this tool
npm run verify                                               # tests + lint + formatting + repository checks
```

The logic in `js/core.js` has no browser dependencies, so you can reuse it from Node: `const core = require('./js/core.js');`

Conventions (pure `core.js`, thin `app.js`, tests for every function) are described in [CONTRIBUTING.md](../../CONTRIBUTING.md) and [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).

## License

MIT - see [LICENSE](LICENSE). pdf-lib (MIT).
