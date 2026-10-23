# Budget Burn & Forecast

> Track spend against budget, burn rate, run-out date and forecast at completion in rupees.

Part of [PM Pocket Tools](../../README.md). Runs entirely in your browser and works without internet.

## What it does

Enter the budget, dates, what has been paid and what is committed, and see how much is left, how fast it is being used, when it would run out, and the forecast at completion. Rupee amounts use lakh/crore grouping.

## Quick start

**No technical knowledge needed**

1. Download this folder (or the whole project as a ZIP from GitHub) and unzip it.
2. Double-click `index.html`. It opens in your browser and works with no internet connection.
3. Keep the folder anywhere you like - on your desktop or a USB stick. It never needs updating to keep working.

**For developers**

```bash
npm install          # once, at the repository root
npm run serve        # then open http://localhost:8080/tools/budget-burn/
```

Hosting this folder on any static web host (GitHub Pages, Netlify, an intranet web server) needs no build step. See [docs/HOSTING.md](../../docs/HOSTING.md). To publish only this tool as its own repository, run `npm run export-tool -- budget-burn ../budget-burn-repo`.

## Features

- Paid and committed entries (`2026-02-01 | 3,20,000 | People | Contractor`); refunds can be negative.
- Burn rate from the whole project or the last 30 days.
- Forecast = paid + committed + burn rate x days to go; run-out date and verdict (on track, watch, at risk, over).
- Month-by-month spend against a straight-line plan; totals by category.
- CSV, print, and save/open as `.json`.

## How it works

`js/core.js` exports `BurnCore`: `amount`, `parseEntries`, `summary`, `monthly`, `byCategory`, `toCsv`, `serialize`, `parse` and `sample`. The as-of date is always passed in.

| File                 | Purpose                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| `index.html`         | Page structure and the Content-Security-Policy (blocks all network access)                          |
| `css/theme.css`      | Shared look and feel, light/dark. Synced from `shared/` - do not edit here                          |
| `css/app.css`        | Styles for this tool only                                                                           |
| `js/common.js`       | Shared helpers (downloads, file reading, status messages). Synced from `shared/` - do not edit here |
| `js/core.js`         | The logic: pure functions, unit-tested, no browser needed                                           |
| `js/app.js`          | Connects the page to the logic (thin by design)                                                     |
| `tests/core.test.js` | Unit tests for the logic                                                                            |

## Privacy and security

- Everything happens in your browser. Nothing you open, type or create is sent anywhere.
- The page's Content-Security-Policy (`<meta http-equiv="Content-Security-Policy">`) forbids network requests, inline scripts and `eval`, so even a bug could not send your data out.
- The tool has no third-party dependencies at all.
- Project data (budgets, risks, names of people) can be sensitive. The files you save (`.json`, `.csv`, `.pdf`) are not password-protected: keep them where only the right people can open them.

## Limitations

- The forecast is a simple projection, not an accounting figure; it assumes future spend continues at the chosen burn rate and adds committed orders on top, so it can be conservative.
- Single currency (INR); no GST, accruals or earned-value measures.
- Entries dated after the as-of date are ignored. Treat results as planning aids and check anything important before you rely on it.

## Development

```bash
npm test                                                     # all tools, from the repository root
node --test tools/budget-burn/tests/core.test.js   # just this tool
npm run verify                                               # tests + lint + formatting + repository checks
```

The logic in `js/core.js` has no browser dependencies, so you can reuse it from Node: `const core = require('./js/core.js');`

Conventions (pure `core.js`, thin `app.js`, tests for every function) are described in [CONTRIBUTING.md](../../CONTRIBUTING.md) and [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).

## License

MIT - see [LICENSE](LICENSE). No bundled third-party software.
