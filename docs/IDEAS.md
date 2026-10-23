# Ideas and good first tasks

Pick something, open an issue to say so, and follow [CONTRIBUTING.md](../CONTRIBUTING.md). Difficulty guide: **J** = suitable for a junior engineer, **M** = mid-level.

## Improvements to existing tools

| Tool              | Task                                                        | Level |
| ----------------- | ----------------------------------------------------------- | ----- |
| Gantt Timeline    | Lags, overlaps and "start no earlier than" per dependency   | M     |
| Gantt Timeline    | Print layout that fits a poster page                        | J     |
| RAID Log          | History of score changes for each risk                      | M     |
| Status Report     | Several projects on a portfolio one-pager                   | M     |
| Resource Planner  | Import people and assignments from Excel                    | J     |
| Budget Burn       | Earned-value measures (CPI, SPI)                            | M     |
| Milestone Tracker | Chart of baseline vs forecast over time                     | J     |
| Change Requests   | Link a change request to a RAID item                        | J     |
| Risk Heat Map     | Show the movement from before to after mitigation as arrows | M     |
| Dependency Map    | Drag boxes to tidy the layout                               | M     |
| RACI Builder      | Import the task list from Gantt text                        | J     |
| All               | Translate tool text (an `i18n` helper in `shared/`)         | M     |
| All               | Playwright smoke tests for each page in CI                  | M     |

## New tool candidates

Fresh candidates for an eleventh tool:

| Idea                     | What it does                                        | Level |
| ------------------------ | --------------------------------------------------- | ----- |
| Sprint Planner           | Capacity, velocity and a sprint backlog with totals | J     |
| Estimation Poker         | Story-point voting on one screen and a summary      | J     |
| Prioritisation Scorer    | RICE and ICE scoring of a backlog                   | J     |
| OKR Tracker              | Objectives, key results and progress                | M     |
| Decision Log             | Decisions, who made them and why                    | J     |
| Meeting Agenda & Actions | Agenda timer and action list                        | J     |
| Stakeholder Map          | Power/interest grid and a communication plan        | M     |
| Release Notes Builder    | Group change lines into notes by type               | J     |
| Retrospective Board      | Start/stop/continue cards and votes                 | M     |
| Lessons Learned Register | Capture and search lessons                          | J     |

## Repository and quality

- Add a screenshot gallery to the root README (J).
- Add an accessibility audit script with axe-core run from Playwright in CI (M).
- Add a Content-Security-Policy `report` mode test that fails on any violation during the smoke tests (M).
