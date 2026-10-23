# Changelog

All notable changes are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.0.0] - 2026-10-22

### Added

- Launcher page with search.
- Ten offline project management tools: Gantt Timeline & Critical Path, RAID Log, Project Status Report, Resource Planner, Budget Burn & Forecast, Milestone Tracker, Change Request Log, Risk Heat Map, Dependency Map, RACI Matrix Builder.
- Shared theme (light/dark) and helper library, synced into each tool.
- Unit tests for every tool's logic, repository checks (offline guarantee, structure, shared-file sync), ESLint and Prettier.
- GitHub Actions for CI and GitHub Pages deployment; Dependabot configuration; issue and pull-request templates.
- Indian-money and date helpers in the shared library (lakh/crore grouping, amounts in words, DD/MM/YYYY).
- Scripts to scaffold a new tool and to export a tool as a standalone repository.
