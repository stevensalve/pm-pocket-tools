# Resource Planner

> Allocate people to projects by week and see who is over-booked, under-used or on leave.

Part of [PM Pocket Tools](../../README.md). Runs entirely in your browser and works without internet.

## What it does

List your people (with part-time capacity and leave) and assignments (project, dates and percent of a full week). The tool shows a weekly heat map of load against capacity and the person-days per project.

## Quick start

**No technical knowledge needed**

1. Download this folder (or the whole project as a ZIP from GitHub) and unzip it.
2. Double-click `index.html`. It opens in your browser and works with no internet connection.
3. Keep the folder anywhere you like - on your desktop or a USB stick. It never needs updating to keep working.

**For developers**

```bash
npm install          # once, at the repository root
npm run serve        # then open http://localhost:8080/tools/resource-planner/
```

Hosting this folder on any static web host (GitHub Pages, Netlify, an intranet web server) needs no build step. See [docs/HOSTING.md](../../docs/HOSTING.md). To publish only this tool as its own repository, run `npm run export-tool -- resource-planner ../resource-planner-repo`.

## Features

- Plain-text people and assignments; capacity below 100% and leave ranges reduce availability.
- Weekly grid for up to 52 weeks: red over capacity, blue under half, grey no capacity.
- Hover a cell for the project split; list of over-booked person-weeks.
- Person-days by project; CSV, print, and save/open as `.json`.

## How it works

`js/core.js` exports `ResourceCore`: `mondayOf`, `parsePeople`, `parseAssignments`, `grid`, `toCsv`, `serialize`, `parse` and `sample`. Weeks run Monday to Sunday with five working days; assignments count only on working days.

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

- Holidays are not built in: enter them as leave for each person.
- Percent is of a full-time week, not hours.
- Up to 100 people, 1,000 assignments and 52 weeks. Treat results as planning aids and check anything important before you rely on it.

## Development

```bash
npm test                                                     # all tools, from the repository root
node --test tools/resource-planner/tests/core.test.js   # just this tool
npm run verify                                               # tests + lint + formatting + repository checks
```

The logic in `js/core.js` has no browser dependencies, so you can reuse it from Node: `const core = require('./js/core.js');`

Conventions (pure `core.js`, thin `app.js`, tests for every function) are described in [CONTRIBUTING.md](../../CONTRIBUTING.md) and [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).

## License

MIT - see [LICENSE](LICENSE). No bundled third-party software.
