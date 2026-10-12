# Contributing

Thanks for considering contributing to speculor-ai! This project is small, focused,
and deliberately dependency-free. Please read this before opening a PR.

## Development setup

```bash
npm install
npm run build     # tsup: build the CLI into dist/
```

## Checks

Before submitting a PR, make sure all of these pass locally:

```bash
npm run typecheck   # tsc --noEmit (strict)
npm run lint        # eslint (flat config)
npm run format      # prettier --write .
npm run test        # vitest
npm run test:coverage  # enforces coverage thresholds
```

The CI workflow runs the same commands on Node 18 / 20 / 22.

## Design principles

speculor-ai has a few hard constraints that we ask contributors to respect:

1. **Zero runtime dependencies.** The published CLI must remain dependency-free.
   Prefer hand-rolled, small solutions (like the frontmatter parser and the
   alignment checker) over pulling in a library.
2. **speculor-ai is a verifier, not a generator.** It never produces plan/tasks
   content for the AI — it checks whether AI output faithfully covers a spec.
   Keep new commands aligned with this role.
3. **Agent-agnostic.** speculor-ai must not bind to any specific coding agent or
   IDE. It works with plain files that any agent can read.
4. **Focus.** Each subcommand does one thing. Avoid scope creep; if a feature
   grows large, discuss it in an issue first.

## Structure

```
src/
  cli/          # CLI shell + subcommands (thin; logic lives in core)
  core/         # dependency-free core: schema, loader, validator,
                # plan/tasks alignment, templates, renderer
test/           # vitest specs (unit + end-to-end command flow)
examples/       # illustrative example artifacts
```

## Commit style

Keep commits small and single-purpose. Prefix the subject with a conventional
commit type (`feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`).

## Questions

Open an issue, or email the maintainer at **liuhuakangk@163.com**.
