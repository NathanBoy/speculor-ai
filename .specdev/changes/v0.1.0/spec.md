---
id: v0-1-0
capability: core
status: proposed
priority: P1
dependsOn: []
acceptanceCriteria:
  - '通过 --strict 强制 plan 精确覆盖 spec'
  - '通过 --dir 支持自定义工作流目录名'
  - '通过 --json 输出可被程序解析的结果'
---

# v0.1.0 增强

## 背景 / 动机

v0.0.1 发布了基础六命令。下一迭代补齐「可配置」与「机器可读」能力，
让 speculor-ai 更适合 CI 与团队规范场景。

## 功能点（三态：✅已确认 / 🟡默认方案 / ⚠️待确认）

- ✅ 为 plan 对齐增加 `--strict` 严格匹配模式（关闭文本兜底，仅用显式 covers）
- ✅ 支持 `--dir` 自定义工作流目录名（默认 `.specdev`）
- 🟡 支持 `--json` 输出机器可读结果

## 范围

- 包含：CLI 全局选项解析、plan 严格匹配、目录可配置、JSON 输出
- 不包含：门控交互（`--interactive`）、constitution 冲突检查（移至后续版本）
