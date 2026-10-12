# speculor-ai

> 一个零依赖、`npx` 即用的 **Spec-Driven Development（SDD）** 工具。
> 人写 spec，AI 生成方案与任务，**speculor-ai 逐层校验 AI 的产出是否忠实于人的意图**，并门控推进。

[![CI](https://github.com/NathanBoy/speculor-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/NathanBoy/speculor-ai/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm](https://img.shields.io/npm/v/speculor-ai)](https://www.npmjs.com/package/speculor-ai)

<p align="center">
  <img src="assets/demo.gif" alt="speculor-ai demo" width="80%" />
</p>

---

## 它是什么

SDD 工具很多（Spec Kit、OpenSpec），但大多有一个共同的空白：**都假设"AI 会照着 spec 干活"，却没有任何工具机器校验这一点**。AI 会漏掉 spec 里的功能点、会用冲突的技术决策、会跳过验收项——而这正是 speculor-ai 解决的问题。

**核心命题：机器如何校验 AI 的产出（plan / tasks / 清单）忠实于人的意图（spec）。**

speculor-ai **不是"帮 AI 干活"，而是"替人监督 AI 有没有照着 spec 干活"**。

| 角色       | 谁                                                     | 做什么                                          |
| ---------- | ------------------------------------------------------ | ----------------------------------------------- |
| 生成者     | 任意编码 AI（Cursor / Codex / Claude Code / Copilot…） | 读 spec → 产出 plan.md / tasks.md / 代码        |
| **校验者** | **speculor-ai**                                        | 定义工件契约 + 校验 AI 产出覆盖 spec + 门控推进 |
| 仲裁者     | 你                                                     | 每个阶段出口确认                                |

## 为什么 agent 无关

- **AI 工具迭代极快，绑死 = 高风险**：把工作流编死在单家（如 Claude Code 的 Plugin/Hook），换工具整套作废。speculor-ai 只依赖"文件和校验"，永不失效。
- **规范文件是长期资产，工具是临时程序**：spec 是项目的事实来源（数据），agent 只是读数据的程序；数据独立于程序存在。
- **降低门槛**：不必"为了用 spec 工具而装特定 agent"，直接用手头已有的工具。

因为 agent 无关，speculor-ai 的集成方式**不看你用哪个工具**——统一两步：**① 让 AI 知道有这套流程 ② 在终端 / CI 跑 speculor-ai 命令**。

## 安装

```bash
npx speculor-ai --help
```

无需全局安装、零依赖、Node 18+。

## 快速开始

```bash
# 1. 初始化规范目录
npx speculor-ai init

# 2. 开一个新变更
npx speculor-ai new auth-login

# 3. 写 spec（可让 AI 起草，你确认三态），然后校验
npx speculor-ai validate

# 4. 让 AI 生成方案，speculor-ai 校验对齐
npx speculor-ai plan --prompt     # 输出给 AI 的生成指令
npx speculor-ai plan              # 校验 AI 产出的 plan 是否覆盖 spec

# 5. 让 AI 拆任务，speculor-ai 校验完备性 + 依赖
npx speculor-ai tasks --prompt
npx speculor-ai tasks

# 6. 生成验收清单
npx speculor-ai check
```

---

## 工作流：PRD 直贴 + agent 生成 + speculor-ai 门禁

**最推荐的使用方式**：直接在 IDE 里贴 PRD，让 agent 生成，speculor-ai 在旁边做质检和门禁。

> **关键**：PRD 不能"原样"当 spec 用。PRD 是输入素材，spec 是**结构化产物**——agent 负责把 PRD 转成符合契约的 spec（带 frontmatter + ✅🟡⚠️），speculor-ai 负责验这个转换合不合格。

以 Cursor 为例，完整流程：

```
① Cursor: 贴一段 PRD，并让 agent
   "按 .specdev/changes/auth-login/spec.md 的模板，
    把 PRD 补全成带 frontmatter + ✅🟡⚠️ 的 spec"
   → agent 产出 spec.md

② 终端:   npx speculor-ai validate
   → 有 ⚠️ 待确认则阻塞，你确认后重跑，直到绿

③ Cursor: "读 spec.md 生成技术方案 plan.md"
   → agent 产出 plan.md

④ 终端:   npx speculor-ai plan
   → 对齐报告：覆盖率不足、漏了功能点，都会摆在你眼前
   → 让 agent 补，重跑，直到绿

⑤ Cursor: "按 plan 拆 tasks.md"
   → agent 产出 tasks.md

⑥ 终端:   npx speculor-ai tasks
   → 完备性 + 依赖无环 + 批次建议

⑦ Cursor: 让 agent 按 tasks 实现
   终端:   npx speculor-ai check → 生成验收清单
   → agent 按 checklist 自测，你逐项确认
```

**你的节奏**：Cursor 里对话（生成）+ 终端里跑 speculor-ai（校验），交替进行。Cursor 干"动脑生成"，speculor-ai 干"冷眼校验"，你干"拍板"。

### 门控：文件即状态

speculor-ai 不记忆会话状态，**一切状态都活在文件里**（spec 的三态、plan/tasks 内容、checklist 勾选）。它天然可审计、可中断恢复、可脚本化。

- **产物驱动（默认）**：跑完输出判定 + 报告，你改文件或让 agent 改，重跑推进。
- **交互确认（可选）**：`--interactive` 跑完终端三选一（继续 / 暂停 / other）。
- **纯判定（CI）**：无交互，不通过就 `exit code != 0`，可直接塞进 CI。

---

## 多 IDE 集成指南

因为 agent 无关，**换工具不需要改 speculor-ai 的任何东西，只改"规则文件放哪"**。

### Cursor

```
① 规则文件   .cursor/rules/speculor-ai.mdc:
   本项目使用 speculor-ai 工作流。实现任何功能前，
   先读 .specdev/changes/<name>/spec.md 和 tasks.md，
   完成后对照 checklist.md 自测。
② 内置终端   跑 npx speculor-ai init / validate / plan / tasks / check
③ 面板对话   让 AI 干活，它会读规则 + .specdev/ 文件
```

### Codex（CLI 或 IDE 扩展）

```
① 规则文件   AGENTS.md（Codex 会读）：
   # speculor-ai 工作流
   改代码前先读 .specdev/changes/<name>/spec.md …
② 跑命令     npx speculor-ai plan --prompt
             复制输出给 codex：codex "（粘贴指令）"
③ 校验       npx speculor-ai plan → 看对齐报告
```

### VS Code + 其他扩展 / JetBrains

```
① 规则文件   AGENTS.md（IDE 无关，最通用）
② 内置终端   跑 npx speculor-ai …
```

### 自动化（CI / git hook）

```yaml
# .github/workflows/spec-check.yml（示意）
steps:
  - run: npx speculor-ai validate # spec 结构 + 三态门禁
  - run: npx speculor-ai plan # plan 对齐校验
  - run: npx speculor-ai tasks # 任务完备 + 依赖
```

也可以在 `package.json` 的 `pre-commit` 钩子里挂 `npx speculor-ai validate`，让每次提交前自动过校验。

---

## 命令参考

| 命令                     | 作用                                      | 关键产物                              |
| ------------------------ | ----------------------------------------- | ------------------------------------- |
| `speculor-ai init`       | 初始化 `.specdev/` 脚手架                 | constitution.md、specs/、changes/     |
| `speculor-ai new <name>` | 新建一个变更                              | `changes/<name>/spec.md` 模板         |
| `speculor-ai validate`   | 校验 spec（结构 / 引用 / 三态门控）       | 校验报告                              |
| `speculor-ai plan`       | **spec→plan 对齐校验** + 覆盖率           | `--prompt` 出生成指令 / 对齐报告      |
| `speculor-ai tasks`      | **plan→tasks 完备校验** + 依赖拓扑 + 批次 | `--prompt` 出生成指令 / 任务报告      |
| `speculor-ai check`      | 生成验收清单                              | `checklist.md`（带优先级 + 验证判定） |

## 工件契约

```
.specdev/
├── constitution.md       # 项目原则（plan 对齐校验引用）
├── specs/<capability>/spec.md   # 当前真相 = 唯一事实来源
└── changes/<name>/
    ├── spec.md           # 需求：frontmatter + 三态 FP + acceptanceCriteria
    ├── plan.md           # 技术方案（AI 产出，speculor-ai 校验对齐）
    ├── tasks.md          # 任务清单（AI 产出，speculor-ai 校验完备 + 依赖）
    └── checklist.md      # 验收清单（由 speculor-ai check 生成）
```

**三态标记**：spec 里每个功能点标记其确认状态——`✅` 已确认 / `🟡` 默认方案 / `⚠️` 待确认（阻塞门禁）。让"哪些是事实、哪些是假设"显式可追溯。

## Dogfooding（自举）

本项目用 **speculor-ai 管理自己的迭代**。仓库根 `.specdev/` 里就是 v0.1.0 的
规划工件（constitution + spec/plan/tasks + checklist），且全部通过
`speculor-ai` 自身校验：

```bash
npx speculor-ai validate   # ✔ 校验通过（1 个 spec）
npx speculor-ai plan       # ✔ 覆盖率 100%
npx speculor-ai tasks      # ✔ 依赖无环，4 个任务 / 4 批
npx speculor-ai check      # ✔ 生成验收清单
```

开发中被自己抓到的两个真实问题：

- 规划 `id: v0.1.0` 含 `.`，被 schema 拦截 → 改为 `v0-1-0`；
- plan 的 `covers` 与功能点措辞不齐 → 覆盖率 50%，补全后 100%。

> 敢用自己的工具管理自己，是对「监督 AI 产出忠实度」最直接的背书。

## 文档

- [技术提案（PROPOSAL.md）](./PROPOSAL.md) — 定位、架构、对齐校验算法、里程碑
- [CHANGELOG.md](./CHANGELOG.md)
- [CONTRIBUTING.md](./CONTRIBUTING.md)

## 许可证

[MIT](./LICENSE)
