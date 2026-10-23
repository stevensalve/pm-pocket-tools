# PM Pocket Tools

**Ten small, private tools for project and product managers that run in your browser and keep working with no internet.**
Plan with dependencies and a critical path, track risks and issues, write the weekly status report, balance people across projects, watch budget burn, follow milestones, control change requests, draw a risk heat map, map dependencies and build a RACI chart - without uploading a single file to someone else's server. Built for India: INR with lakh/crore grouping, DD/MM/YYYY dates.

- **Private** - everything runs on your own computer. Nothing is uploaded, tracked or stored remotely.
- **Offline** - download once, use forever. No installation, no account, no subscription.
- **Simple** - plain HTML, CSS and JavaScript. No framework, no build step, nothing to break.
- **Open** - MIT licensed. Copy a tool, change it, share it.

> New here and not a developer? Jump to [Use it without any technical knowledge](#use-it-without-any-technical-knowledge).
>
> The sample data, RAG thresholds, risk levels and the forecast formulas are **simple, documented defaults**. They help you organise and communicate; they do not replace your own judgement, your PMO's methods or a full scheduling and finance system. Check anything important before you rely on it.
>
> Files you save (`.json`, `.csv`, `.pdf`) can contain budgets and names and are **not password-protected**. Keep them somewhere appropriate and delete them when no longer needed.

## The ten tools

Each tool lives in its own self-contained folder under [`tools/`](tools/) with its own README, license and tests. Any folder can be copied, hosted or published on its own.

| #   | Tool                                                    | What it does                                                                     | Replaces                |
| --- | ------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------- |
| 1   | [Gantt Timeline & Critical Path](tools/gantt-timeline/) | Dependencies, working-day schedule, critical path, slack and bar chart           | hand-drawn plans        |
| 2   | [RAID Log](tools/raid-log/)                             | Risks, assumptions, issues and dependencies with scores, owners and overdue view | RAID spreadsheets       |
| 3   | [Project Status Report](tools/status-report/)           | RAG one-page report as PDF or e-mail text, with suggested colours                | weekly status e-mails   |
| 4   | [Resource Planner](tools/resource-planner/)             | Weekly heat map of load against capacity, leave and person-days by project       | allocation spreadsheets |
| 5   | [Budget Burn & Forecast](tools/budget-burn/)            | Burn rate, run-out date and forecast at completion in INR                        | budget trackers         |
| 6   | [Milestone Tracker](tools/milestone-tracker/)           | Baseline vs forecast, slip, attention message and calendar reminders             | milestone lists         |
| 7   | [Change Request Log](tools/change-requests/)            | Impact on cost and schedule, controlled decisions, printable form                | change forms            |
| 8   | [Risk Heat Map](tools/risk-matrix/)                     | 5x5 heat map from an Excel/CSV risk list, before and after mitigation            | risk spreadsheets       |
| 9   | [Dependency Map](tools/dependency-map/)                 | Blocked work, circular dependencies, what can start now, diagram                 | dependency whiteboards  |
| 10  | [RACI Matrix Builder](tools/raci-builder/)              | RACI chart with one-owner check, workload and landscape PDF                      | RACI tables             |

The launcher page ([`index.html`](index.html)) lists all ten with a search box.

## Use it without any technical knowledge

1. On the GitHub page, click the green **Code** button, then **Download ZIP**.
2. Unzip the file anywhere (Desktop, Documents, a USB stick).
3. Open the unzipped folder and double-click **`index.html`**. Choose a tool.

That's all. You can disconnect from the internet and everything still works. Want just one tool? Copy only its folder from `tools/` and double-click that folder's `index.html`.

Works in current versions of Chrome, Edge, Firefox and Safari (16.4 or newer).

## For developers

Requirements: [Node.js](https://nodejs.org) 22 or newer (only for tests and tooling - the tools themselves need no Node).

```bash
git clone <this-repository-url>
cd pm-pocket-tools
npm install          # dev tooling only: tests, lint, formatter, library copies
npm run serve        # http://localhost:8080  (or just open index.html)
npm test             # unit tests for every tool
npm run verify       # everything CI runs: sync check, structure check, offline check, lint, format, tests
```

Useful commands:

| Command                                                        | Purpose                                                         |
| -------------------------------------------------------------- | --------------------------------------------------------------- |
| `npm run serve`                                                | Local static server (zero dependencies)                         |
| `npm test`                                                     | Run all unit tests (Node's built-in test runner)                |
| `npm run lint` / `npm run format`                              | ESLint / Prettier                                               |
| `npm run sync`                                                 | Copy `shared/` files into each tool (`check:sync` verifies)     |
| `npm run vendor`                                               | Refresh bundled third-party libraries from `node_modules`       |
| `npm run check:offline`                                        | Fail if any page loads something from the internet              |
| `npm run check:structure`                                      | Enforce conventions (required files, README sections, CSP, ...) |
| `npm run build`                                                | Assemble the deployable site in `_site/`                        |
| `npm run new-tool -- my-tool "My Tool" "What it does"`         | Scaffold an eleventh tool                                       |
| `npm run export-tool -- gantt-timeline ../gantt-timeline-repo` | Turn one tool into its own repository                           |

### Repository layout

```text
.
├── index.html               Launcher page (search + links to all tools)
├── tools/
│   └── <tool>/              One self-contained folder per tool
│       ├── index.html       Page + Content-Security-Policy
│       ├── css/             theme.css (synced) + app.css (tool-specific)
│       ├── js/              common.js (synced) + core.js (logic) + app.js (UI)
│       ├── vendor/          Bundled third-party libraries + README with versions
│       ├── tests/           Unit tests (node:test)
│       ├── README.md        User and developer documentation
│       └── LICENSE
├── shared/                  Single source for theme.css and common.js (+ tests)
├── site/                    Launcher page code and tool catalogue
├── templates/tool/          Starter files used by `npm run new-tool`
├── scripts/                 Zero-dependency Node scripts (sync, vendor, checks, build)
├── docs/                    Architecture, hosting, adding a tool, splitting a tool
└── .github/                 CI, GitHub Pages deploy, issue and PR templates, Dependabot
```

### How the code is organised (the short version)

Every tool follows the same three-layer pattern, so once you have read one you can read all ten:

1. **`core.js` - the logic.** Pure functions with no access to the page, so they run in Node and are unit-tested. They throw plain-language `Error`s for bad input.
2. **`app.js` - the user interface.** Reads the form, calls `core.js`, shows results and errors. Builds the page with `textContent` / DOM APIs (never `innerHTML` with user data).
3. **`index.html` + CSS** - semantic, accessible markup with a strict Content-Security-Policy.

Scripts are classic `<script>` files (not ES modules) on purpose: browsers block module loading from `file://`, and double-click-to-open is a core feature. Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the reasoning.

## Hosting

Because there is no build step, hosting is just "serve these files".

- **GitHub Pages** (included): in your repository go to _Settings -> Pages -> Build and deployment -> Source: GitHub Actions_. The workflow in `.github/workflows/pages.yml` publishes the site on every push to `main`.
- **Any static host** (Netlify, Cloudflare Pages, an intranet web server, a shared network drive): upload the output of `npm run build` (the `_site/` folder) or the repository itself.

Details and tips (including hosting inside a company network): [docs/HOSTING.md](docs/HOSTING.md).

## Privacy and security by design

- Every page has a Content-Security-Policy that blocks network requests (`connect-src 'none'`), inline scripts and `eval`. `npm run check:offline` and `npm run check:structure` guard this in CI.
- Third-party libraries are copied into each tool's `vendor/` folder (no CDN), with versions and licenses recorded.
- No analytics, cookies, fonts or images are loaded from anywhere.
- Report vulnerabilities as described in [SECURITY.md](SECURITY.md).

## Contributing

Contributions are welcome at every level - fixing a typo, adding a test, improving accessibility, or building a new tool. Start with [CONTRIBUTING.md](CONTRIBUTING.md); [docs/IDEAS.md](docs/IDEAS.md) lists beginner-friendly and intermediate tasks. Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE). Bundled third-party libraries keep their own licenses (listed in each tool's `vendor/README.md`): pdf-lib (MIT) and SheetJS Community Edition (Apache-2.0).
