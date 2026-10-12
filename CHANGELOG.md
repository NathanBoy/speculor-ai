# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.1] - 2026-10-12

### Added

- `speculor-ai init` — scaffold the `.specdev/` directory (constitution, `specs/`, `changes/`).
- `speculor-ai new <name>` — create a change with a tri-state-tagged `spec.md` template.
- `speculor-ai validate` — structural validation, id uniqueness, `dependsOn` resolution,
  and tri-state gating (pending items block progression unless `--allow-pending`).
- `speculor-ai plan` — generate the plan instruction (`--prompt`) and check that an
  AI-produced `plan.md` faithfully covers the spec's feature points and acceptance
  criteria (coverage ratio), via explicit `covers` declarations plus normalized
  text matching.
- `speculor-ai tasks` — generate the task instruction (`--prompt`) and validate task
  completeness against plan modules, acyclic dependency graph (topological order),
  and suggest parallel batches.
- `speculor-ai check` — render an acceptance `checklist.md` from a spec's criteria.
- Zero runtime dependencies; ships a single self-contained ESM CLI.
- Vitest test suite (61 tests) with enforced coverage thresholds.
