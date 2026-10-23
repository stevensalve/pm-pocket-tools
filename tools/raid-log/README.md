# RAID Log

> Track risks, assumptions, issues and dependencies with owners, scores and due dates.

Part of [PM Pocket Tools](../../README.md). Runs entirely in your browser and works without internet.

## What it does

One log for the four things every project has to watch. Risks and issues get a probability and impact score; every item gets an owner, a due date and an action. See what is overdue, what is high, and what has no owner.

## Quick start

**No technical knowledge needed**

1. Download this folder (or the whole project as a ZIP from GitHub) and unzip it.
2. Double-click `index.html`. It opens in your browser and works with no internet connection.
3. Keep the folder anywhere you like - on your desktop or a USB stick. It never needs updating to keep working.

**For developers**

```bash
npm install          # once, at the repository root
npm run serve        # then open http://localhost:8080/tools/raid-log/
```

Hosting this folder on any static web host (GitHub Pages, Netlify, an intranet web server) needs no build step. See [docs/HOSTING.md](../../docs/HOSTING.md). To publish only this tool as its own repository, run `npm run export-tool -- raid-log ../raid-log-repo`.

## Features

- Reference numbers per type (R01, A01, I01, D01).
- Score = probability x impact (1-5 each); 15 or more is High, 8 to 14 Medium.
- Statuses Open, In progress, Closed, Accepted with the date closed.
- Overdue view, filters and search, summary of open items and top risks.
- CSV, print, and save/open as `.json`.

## How it works

`js/core.js` exports `RaidCore`: `TYPES`, `STATUSES`, `create`, `add`, `update`, `setStatus`, `list`, `summary`, `toCsv`, `serialize`, `parse` and `sample`. Every function returns a new state; "today" is always passed in.

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

- Scores are a simple 5x5 rating, not a quantitative risk model.
- No history of changes, no attachments and no notifications.
- Up to 3,000 items per file. Treat results as planning aids and check anything important before you rely on it.

## Development

```bash
npm test                                                     # all tools, from the repository root
node --test tools/raid-log/tests/core.test.js   # just this tool
npm run verify                                               # tests + lint + formatting + repository checks
```

The logic in `js/core.js` has no browser dependencies, so you can reuse it from Node: `const core = require('./js/core.js');`

Conventions (pure `core.js`, thin `app.js`, tests for every function) are described in [CONTRIBUTING.md](../../CONTRIBUTING.md) and [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).

## License

MIT - see [LICENSE](LICENSE). No bundled third-party software.
