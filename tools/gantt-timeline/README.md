# Gantt Timeline & Critical Path

> Plan tasks with durations and dependencies; see the schedule, the critical path and a bar chart.

Part of [PM Pocket Tools](../../README.md). Runs entirely in your browser and works without internet.

## What it does

Type one task per line with its working days and what it depends on. The tool works out start and finish dates (skipping weekends and the holidays you list), shows the critical path, the slack on every other task, and draws a bar chart. Export to CSV or a calendar file.

## Quick start

**No technical knowledge needed**

1. Download this folder (or the whole project as a ZIP from GitHub) and unzip it.
2. Double-click `index.html`. It opens in your browser and works with no internet connection.
3. Keep the folder anywhere you like - on your desktop or a USB stick. It never needs updating to keep working.

**For developers**

```bash
npm install          # once, at the repository root
npm run serve        # then open http://localhost:8080/tools/gantt-timeline/
```

Hosting this folder on any static web host (GitHub Pages, Netlify, an intranet web server) needs no build step. See [docs/HOSTING.md](../../docs/HOSTING.md). To publish only this tool as its own repository, run `npm run export-tool -- gantt-timeline ../gantt-timeline-repo`.

## Features

- Plain-text tasks: `Build | 10 | 2,3 | Ravi | 09/11/2026` (days, dependencies by task number, owner, not-before date).
- Forward and backward pass: earliest start and finish, slack, and the critical chain (milestones with 0 days are supported).
- Monday to Friday or Monday to Saturday weeks, plus your own holiday list.
- Clear messages for unknown dependencies and circular dependencies.
- CSV, calendar file (`.ics`, one all-day event per task), print, and save/open as `.json`.

## How it works

`js/core.js` exports `GanttCore`: `parseTasks`, `tasksToText`, `parseHolidays`, `schedule`, `bars`, `toCsv`, `toIcs`, `serialize`, `parse` and `sample`. Durations count working days; a task starts the day after its last predecessor finishes.

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

- Finish-to-start dependencies only: no lags, overlaps, resource levelling or part-days.
- Every task uses the same working calendar.
- It is a planning aid, not a replacement for a full scheduling package. Treat results as planning aids and check anything important before you rely on it.

## Development

```bash
npm test                                                     # all tools, from the repository root
node --test tools/gantt-timeline/tests/core.test.js   # just this tool
npm run verify                                               # tests + lint + formatting + repository checks
```

The logic in `js/core.js` has no browser dependencies, so you can reuse it from Node: `const core = require('./js/core.js');`

Conventions (pure `core.js`, thin `app.js`, tests for every function) are described in [CONTRIBUTING.md](../../CONTRIBUTING.md) and [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).

## License

MIT - see [LICENSE](LICENSE). No bundled third-party software.
