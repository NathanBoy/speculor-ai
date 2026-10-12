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

### v0.2.0 — Trustworthy alignment & gating

Prioritize making the alignment gate _credible_ (see PROPOSAL §8.5):

- **Evidence chain** — every covered item reports its evidence location in the
  plan (line/segment), so the gate is auditable, not a black box
- **Confidence** — per-item match confidence; low-confidence items require
  human confirmation instead of a binary pass/fail
- **Incremental & actionable** — `--change <name>` to validate one change;
  on failure, give the AI actionable fix guidance instead of just "not covered"
- `--interactive` — terminal gating (continue / pause / revisit)
- Constitution conflict check: flag AI plans that conflict with project principles

### v0.3.0 — Depth & automation

- `--deep` semantic alignment (embedding/LLM) as an optional pluggable mode,
  keeping the core zero-dependency
- Adversarial test suite ("looks covered but drifts" plans) to prove the
  verifier can't be fooled
- `watch` mode: re-run checks as `.specdev/` files change
- Acceptance-loop: checklist ticks feed back into spec state

### Further out

- Pluggable "validator plugins" (custom checks)
- Official VS Code / JetBrains extensions
- Concrete integration examples combining with OpenSpec / Spec Kit
