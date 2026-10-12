# example: basic speculor-ai workflow

A minimal, self-contained project showing the `.specdev/` artifacts that speculor-ai
produces and validates, for a fictional "auth-login" feature.

```
examples/basic/.specdev/
├── constitution.md
└── changes/auth-login/
    ├── spec.md        # 需求（frontmatter + 三态功能点 + acceptanceCriteria）
    ├── plan.md        # 技术方案（AI 产出，speculor-ai 校验对齐）
    ├── tasks.md       # 任务清单（AI 产出，speculor-ai 校验完备/依赖/批次）
    └── checklist.md   # 验收清单（由 speculor-ai check 生成）
```

## Try it

From this directory, run the built CLI (or `npx speculor-ai` once published):

```bash
npx speculor-ai validate                # 校验 spec：结构 + 三态门控
npx speculor-ai plan --prompt           # 取"生成方案"指令给任意编码 Agent
npx speculor-ai plan                    # 校验 plan 是否覆盖 spec（覆盖率）
npx speculor-ai tasks                   # 校验任务完备 + 依赖无环 + 建议批次
npx speculor-ai check                   # 从 acceptanceCriteria 生成验收清单
```

Example output of `speculor-ai tasks`:

```
── 任务报告（4 个任务）──
✔ 依赖无环，拓扑序: t1 → t3 → t4, t2 → …
✔ 建议批次:
   批次1: [t1]
   批次2: [t3]
   …
```

> The `checklist.md` here is what `speculor-ai check` produces. Change the spec's
> `acceptanceCriteria` and re-run to regenerate it.
