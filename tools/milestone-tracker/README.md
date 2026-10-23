# Milestone Tracker

> Track milestones against baseline dates, see slippage and what needs attention.

Part of [PM Pocket Tools](../../README.md). Runs entirely in your browser and works without internet.

## What it does

List milestones with their baseline and current forecast dates and a status. The tool shows slip in days, labels each milestone (overdue, blocked, slipping, due soon, on track, done), and writes a short message for the team.

## Quick start

**No technical knowledge needed**

1. Download this folder (or the whole project as a ZIP from GitHub) and unzip it.
2. Double-click `index.html`. It opens in your browser and works with no internet connection.
3. Keep the folder anywhere you like - on your desktop or a USB stick. It never needs updating to keep working.

**For developers**

```bash
npm install          # once, at the repository root
npm run serve        # then open http://localhost:8080/tools/milestone-tracker/
```

Hosting this folder on any static web host (GitHub Pages, Netlify, an intranet web server) needs no build step. See [docs/HOSTING.md](../../docs/HOSTING.md). To publish only this tool as its own repository, run `npm run export-tool -- milestone-tracker ../milestone-tracker-repo`.

## Features

- Plain-text milestones: `Go-live | 15/12/2026 | 22/12/2026 | In progress | Priya`.
- Slip against baseline, days to go, adjustable "due soon" window.
- Summary: overdue, blocked and slipping counts, worst slip, next milestone, how far the last milestone has moved.
- Copy-ready attention message, CSV, calendar file with an alert, print, and save/open as `.json`.

## How it works

`js/core.js` exports `MilestoneCore`: `STATUSES`, `parse`, `toText`, `analyse`, `summary`, `reminder`, `toCsv`, `toIcs`, `serialize`, `parseFile` and `sample`.

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

- Dates are calendar dates; there is no working-day calendar.
- The forecast is whatever you enter: the tool does not predict.
- It does not send reminders: import the calendar file. Treat results as planning aids and check anything important before you rely on it.

## Development

```bash
npm test                                                     # all tools, from the repository root
node --test tools/milestone-tracker/tests/core.test.js   # just this tool
npm run verify                                               # tests + lint + formatting + repository checks
```

The logic in `js/core.js` has no browser dependencies, so you can reuse it from Node: `const core = require('./js/core.js');`

Conventions (pure `core.js`, thin `app.js`, tests for every function) are described in [CONTRIBUTING.md](../../CONTRIBUTING.md) and [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).

## License

MIT - see [LICENSE](LICENSE). No bundled third-party software.
