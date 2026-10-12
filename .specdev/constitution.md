# 开发原则（constitution）

## 设计边界

- 保持零运行时依赖（本项目最核心卖点）。
- speculor-ai 是校验者，不是生成者——永不替 AI 产出 plan/tasks 内容。
- agent 无关，不绑定任何特定编码 Agent / IDE。

## 工程规范

- 任何代码必须通过 `typecheck` / `lint` / `format:check`。
- 必须保持测试全绿并守住覆盖率门槛（85/85/90/80）。
- 提交使用 conventional commit（`feat:` / `fix:` / `chore:` …），以支撑 release-please 自动发版。
