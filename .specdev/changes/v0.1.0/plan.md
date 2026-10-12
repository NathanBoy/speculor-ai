---
spec: v0-1-0
modules: [cli, plan, config]
covers:
  - 为 plan 对齐增加 `--strict` 严格匹配模式（关闭文本兜底，仅用显式 covers）
  - 支持 `--dir` 自定义工作流目录名（默认 `.specdev`）
  - 支持 `--json` 输出机器可读结果
  - 通过 --strict 强制 plan 精确覆盖 spec
  - 通过 --dir 支持自定义工作流目录名
  - 通过 --json 输出可被程序解析的结果
---

# 方案

## cli 模块

- 新增 `--strict`、`--dir`、`--json` 全局选项，解析后注入各命令。
- `--json` 时抑制彩色/装饰输出，仅打印结构化 JSON。

## plan 模块

- 新增 strict 对齐模式：关闭归一化文本兜底匹配，仅接受显式 `covers` 声明。

## config 模块

- 工作流目录名从常量改为可配置（`--dir`），loader 与模板均读该配置。
- 默认仍为 `.specdev`，行为向后兼容。

## 技术决策

- 零新增运行时依赖；选项解析复用现有 `--flag` 解析逻辑。
- 保持 `validate` / `plan` / `tasks` / `check` 的既有输出结构，`--json` 仅做格式化层切换。
