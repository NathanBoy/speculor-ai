# Roadmap

Goals for speculor-ai: start as a small tool that **supervises whether AI
output stays faithful to a spec**, and grow into a standardized, pluggable
gating layer that any team can embed in its workflow.

## Released

- **0.0.1** — Six-command MVP (`init` / `new` / `validate` / `plan` / `tasks` /
  `check`). Zero runtime dependencies, agent-agnostic, 61 tests with enforced
  coverage. Published on npm.

## Planned

### v0.1.0 — Configurability & machine-readable output

Tracking in `.specdev/changes/v0.1.0/` (this repo dogfoods its own roadmap):

- `--strict` — exact-match mode for plan alignment (disables text fallback)
- `--dir` — customize the workflow directory name (default `.specdev`)
- `--json` — machine-readable output for CI/tooling

### v0.2.0 — Gating & conflict detection

- `--interactive` — terminal gating (continue / pause / revisit)
- Constitution conflict check: flag AI plans that conflict with project
  principles

### Further out

- Pluggable "validator plugins" (custom checks)
- Official VS Code / JetBrains extensions
- Concrete integration examples combining with OpenSpec / Spec Kit
