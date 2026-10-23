/**
 * The catalogue shown on the launcher page (index.html).
 * Keep in sync with the folders in /tools - `npm run check:structure` fails if
 * a tool is missing here. It is a .js file (not .json) so the launcher also
 * works when opened straight from disk, where browsers block fetch().
 */
window.TOOLS = [
  {
    id: 'gantt-timeline',
    title: 'Gantt Timeline & Critical Path',
    tagline: 'Plan tasks with durations and dependencies, see the schedule, the critical path and a chart.',
    replaces: 'hand-drawn plans',
    tags: ['gantt', 'schedule', 'critical', 'path'],
  },
  {
    id: 'raid-log',
    title: 'RAID Log',
    tagline: 'Track risks, assumptions, issues and dependencies with owners, scores and due dates.',
    replaces: 'RAID spreadsheets',
    tags: ['risk', 'issue', 'assumption', 'dependency'],
  },
  {
    id: 'status-report',
    title: 'Project Status Report',
    tagline: 'Turn a few lines into a one-page RAG status report as PDF or text.',
    replaces: 'weekly status e-mails',
    tags: ['status', 'report', 'rag', 'weekly'],
  },
  {
    id: 'resource-planner',
    title: 'Resource Planner',
    tagline: 'Allocate people to projects by week and see who is over or under-booked.',
    replaces: 'allocation spreadsheets',
    tags: ['resource', 'allocation', 'capacity'],
  },
  {
    id: 'budget-burn',
    title: 'Budget Burn & Forecast',
    tagline: 'Track spend against budget, burn rate, run-out date and forecast at completion in INR.',
    replaces: 'budget trackers',
    tags: ['budget', 'burn', 'forecast', 'cost'],
  },
  {
    id: 'milestone-tracker',
    title: 'Milestone Tracker',
    tagline: 'Track milestones against baseline dates, see slippage and export reminders.',
    replaces: 'milestone lists',
    tags: ['milestone', 'slip', 'baseline'],
  },
  {
    id: 'change-requests',
    title: 'Change Request Log',
    tagline: 'Log change requests with cost and schedule impact, decisions and a printable form.',
    replaces: 'change forms',
    tags: ['change', 'request', 'impact', 'approval'],
  },
  {
    id: 'risk-matrix',
    title: 'Risk Heat Map',
    tagline: 'Load a risk list and see a 5x5 probability and impact heat map with the top risks.',
    replaces: 'risk spreadsheets',
    tags: ['risk', 'heatmap', 'matrix'],
  },
  {
    id: 'dependency-map',
    title: 'Dependency Map',
    tagline: 'Find blocked work, circular dependencies and the order to do things, with a diagram.',
    replaces: 'dependency whiteboards',
    tags: ['dependency', 'blocked', 'order'],
  },
  {
    id: 'raci-builder',
    title: 'RACI Matrix Builder',
    tagline: 'Build a RACI chart, check every task has exactly one owner, print as PDF.',
    replaces: 'RACI tables',
    tags: ['raci', 'responsibility', 'roles'],
  },
];
