# Risk Heat Map

> Load a risk list from Excel or CSV and see a 5x5 heat map and the top risks.

Part of [PM Pocket Tools](../../README.md). Runs entirely in your browser and works without internet.

## What it does

Drop in your risk register and get a probability and impact heat map, a ranked list, and a summary. If the file has residual ratings, a second map shows the effect of mitigation.

## Quick start

**No technical knowledge needed**

1. Download this folder (or the whole project as a ZIP from GitHub) and unzip it.
2. Double-click `index.html`. It opens in your browser and works with no internet connection.
3. Keep the folder anywhere you like - on your desktop or a USB stick. It never needs updating to keep working.

**For developers**

```bash
npm install          # once, at the repository root
npm run serve        # then open http://localhost:8080/tools/risk-matrix/
```

Hosting this folder on any static web host (GitHub Pages, Netlify, an intranet web server) needs no build step. See [docs/HOSTING.md](../../docs/HOSTING.md). To publish only this tool as its own repository, run `npm run export-tool -- risk-matrix ../risk-matrix-repo`.

## Features

- Reads Excel and CSV with flexible column names; ratings can be 1-5 or Very low to Very high.
- Heat map before and (when provided) after mitigation; closed risks are left off.
- Warnings for high or medium risks with no mitigation and open risks with no owner.
- Ranked table, summary by category and owner, and CSV export.

## How it works

`js/core.js` exports `RiskMatrixCore`: `rating`, `level`, `rowsToRisks`, `matrix`, `summary`, `toCsv` and `sampleRows`. SheetJS only reads the file in `app.js`; the logic works on plain rows.

| File                 | Purpose                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| `index.html`         | Page structure and the Content-Security-Policy (blocks all network access)                          |
| `css/theme.css`      | Shared look and feel, light/dark. Synced from `shared/` - do not edit here                          |
| `css/app.css`        | Styles for this tool only                                                                           |
| `js/common.js`       | Shared helpers (downloads, file reading, status messages). Synced from `shared/` - do not edit here |
| `js/core.js`         | The logic: pure functions, unit-tested, no browser needed                                           |
| `js/app.js`          | Connects the page to the logic (thin by design)                                                     |
| `vendor/`            | Bundled third-party code: SheetJS Community Edition 0.20.3 (Apache-2.0)                             |
| `tests/core.test.js` | Unit tests for the logic                                                                            |

## Privacy and security

- Everything happens in your browser. Nothing you open, type or create is sent anywhere.
- The page's Content-Security-Policy (`<meta http-equiv="Content-Security-Policy">`) forbids network requests, inline scripts and `eval`, so even a bug could not send your data out.
- Third-party code is bundled in `vendor/` (exact versions and licenses in `vendor/README.md`) instead of loaded from a CDN, so there is no third party in the loop when you use the tool.
- Project data (budgets, risks, names of people) can be sensitive. The files you save (`.json`, `.csv`, `.pdf`) are not password-protected: keep them where only the right people can open them.

## Limitations

- It maps what you give it; it does not judge whether the ratings are right.
- Only the first sheet is read, and the first row must be the headers.
- Up to 2,000 risks. Treat results as planning aids and check anything important before you rely on it.

## Development

```bash
npm test                                                     # all tools, from the repository root
node --test tools/risk-matrix/tests/core.test.js   # just this tool
npm run verify                                               # tests + lint + formatting + repository checks
```

The logic in `js/core.js` has no browser dependencies, so you can reuse it from Node: `const core = require('./js/core.js');`

Conventions (pure `core.js`, thin `app.js`, tests for every function) are described in [CONTRIBUTING.md](../../CONTRIBUTING.md) and [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).

## License

MIT - see [LICENSE](LICENSE). SheetJS Community Edition 0.20.3 (Apache-2.0).
