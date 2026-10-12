# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `specdev init` — scaffold the `.specdev/` directory (constitution, `specs/`, `changes/`).
- `specdev new <name>` — create a change with a tri-state-tagged `spec.md` template.
- `specdev validate` — structural validation, id uniqueness, `dependsOn` resolution,
  and tri-state gating (pending items block progression unless `--allow-pending`).
- `specdev plan` — generate the plan instruction (`--prompt`) and check that an
  AI-produced `plan.md` faithfully covers the spec's feature points and acceptance
  criteria (coverage ratio), via explicit `covers` declarations plus normalized
  text matching.
- `specdev tasks` — generate the task instruction (`--prompt`) and validate task
  completeness against plan modules, acyclic dependency graph (topological order),
  and suggest parallel batches.
- `specdev check` — render an acceptance `checklist.md` from a spec's criteria.
- Zero runtime dependencies; ships a single self-contained ESM CLI.
- Vitest test suite (61 tests) with enforced coverage thresholds.
