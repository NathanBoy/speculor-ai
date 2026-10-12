# 证据链（Evidence Chain）技术方案

> 对齐校验可信度演进的第一步（PROPOSAL §8.5.1）。
> 目标：把 `plan` 对齐校验从"机器判定"升级为"**机器判定 + 可复核证据**"。
> 状态：技术方案（待评审）。版本：0.1。

---

## 1. 背景与问题

当前 `plan` 对齐校验（`src/core/plan.ts`）的判定逻辑是双通道：

1. **explicit covers**：plan frontmatter 里 `covers: [...]` 显式声明覆盖了哪些 spec 条目；
2. **normalized text match**：plan 正文与 spec 条目做归一化（去空格/标点/大小写）后 `includes` 双向匹配。

判定结果只有 `covered / not-covered` 二元结论，**没有证据**。这带来两个可信度问题：

- **不可复核（黑箱）**：报告只告诉人"这条覆盖了"，人无法确认"它凭什么判覆盖"，FN（误报漏）无法追溯；
- **不可度量**：字面命中和语义命中等价，无法区分"精确声明"与"措辞沾边"，FP（误放行）风险无标记。

**本质**：监督器给结论，但拿不出论据——门禁的可信度有天花板。

## 2. 目标与非目标

### 目标

- 每一项覆盖判定都产出它在 plan 中的**证据位置**（章节定位 / 行号区间 / 一句摘录）；
- `plan` 命令报告可审计：`✅ 已覆盖 ← 证据：plan.md §2.1 L24-27 "路由守卫用 middleware…"`；
- 顺带**倒逼 AI 生成 plan 时自我声明证据**（它知道会被追溯，会更忠实）；
- 为 8.5.2 置信度分层提供**置信度种子**。

### 非目标（本方案不做，留给后续演进）

- **不做语义匹配**（那是 `--deep` 可选模式，另立方案）；
- **不改 `plan.md` 契约格式**（`covers`/`modules` 字段不变，向后兼容）；
- **不改变门控语义与阈值**（required FP 仍须 100% 覆盖，覆盖才放行）；
- **不引入任何运行时依赖**（core 保持零依赖，全部自写）。

## 3. 核心设计

### 3.1 证据模型（Evidence）

新增 TypeScript 类型（`src/core/types.ts`）：

```ts
/** 一条覆盖判定的证据 */
export interface Evidence {
  /** spec 中目标条目的标识（FP 或 acceptanceCriteria 的索引/文本） */
  targetId: string;
  /** 该目标条目的原文 */
  targetText: string;
  /** 判定结论 */
  status: 'covered' | 'not-covered';
  /** 匹配置信度 0–1（8.5.2 的种子；本版只输出值，门控仍按 status） */
  confidence: number;
  /** 命中的通道 */
  matchKind: 'explicit-covers' | 'text-match' | 'none';
  /** 证据位置；not-covered 或 confidence 过低时为 null */
  source: {
    /** 定位：`plan.md §<章节> L<起>-<止>`；行号标注"可能随编辑漂移" */
    location: string;
    /** 证据摘录（命中段落的关键句，保留上下文窗口） */
    snippet: string;
  } | null;
}
```

### 3.2 证据如何产生（在现有双通道上记录命中位置）

改造 `src/core/plan.ts` 的判定流程，在命中时**记录位置**而非只返回布尔：

| 通道              | 判定                                            | 证据                                                                          |
| ----------------- | ----------------------------------------------- | ----------------------------------------------------------------------------- |
| `explicit-covers` | frontmatter `covers` 中命中该条目               | 证据 = 命中该 covers 声明项 + frontmatter 位置；`confidence = 1.0`            |
| `text-match`      | 正文某段落归一化后与目标 `includes`（任一方向） | 证据 = 命中段落（章节 + 行号区间 + 摘录）；`confidence = 0.7`（措辞可能漂移） |
| 双通道都命中      | 取更高 confidence，可合并                       | 报告标注两路证据                                                              |
| 都不命中          | `not-covered`                                   | `source = null`，`matchKind = 'none'`，`confidence = 0`                       |

### 3.3 行号与段落定位

- `plan.md` 按行解析，**行号 + 章节名**（`#`/`##`/`###` 标题）双定位；
- 段落区间：以标题为边界切分，记录 `L起-L止`；
- 摘录：取命中段落的**首句或关键句**，保留上下文窗口（前后各一句），截断到 ≤ 160 字符，避免断章取义；
- **行号漂移**：plan 被后续编辑后行号会变——方案：location 以"章节名 + 摘录"为主锚点，行号作为参考，报告标注"行号可能随编辑漂移"。

### 3.4 置信度种子（为 8.5.2 铺垫）

- `explicit-covers` 精确命中 → `1.0`；
- `text-match`（归一化 includes）→ `0.7`；
- 部分命中 / 相似但归一化不含 → `0.4`，`source.snippet` 标记 `⚠ 需人工确认`；
- `not-covered` → `0`。

本版**门控仍按 `status`（covered/not-covered）判定**，`confidence` 只输出、不改变放行逻辑（保持向后兼容）；8.5.2 再将其接入门控。

### 3.5 报告输出（`plan` 命令增强）

- 每项目前格式扩展为：
  `✅ 已覆盖 [conf 1.0] ← 证据 plan.md §2.1 L24-27`
  `⚠ 未覆盖 ← 建议补到 plan 的"路由守卫"小节`
- 覆盖率尾部加**证据摘要**（N 条覆盖来自 covers / N 条来自正文命中 / N 条待确认）；
- `--json` 模式输出结构化 `Evidence[]`（供 CI / 工具消费）。

## 4. 数据流

```
spec.md + plan.md
   │
   ▼
plan.ts 对齐校验（双通道判定）
   │   每项判定 + 命中位置 + matchKind + confidence
   ▼
Evidence[]（types.ts）
   │
   ├─► renderer：终端报告（证据行 + 摘要）
   └─► --json：结构化输出（CI / 工具）
```

## 5. 变更文件清单

| 文件                       | 变更                                                           |
| -------------------------- | -------------------------------------------------------------- |
| `src/core/types.ts`        | 新增 `Evidence` 类型                                           |
| `src/core/plan.ts`         | 判定时记录命中位置 / matchKind / confidence，返回 `Evidence[]` |
| `src/core/renderer.ts`     | 报告输出证据行 + 摘要；`--json` 结构化序列化                   |
| `src/cli/commands.ts`      | `plan` 命令解析 `--json`，透传渲染                             |
| `src/core/templates.ts`    | plan 生成指令追加"请在每个模块写明证据锚点"（可选，倒逼自证）  |
| `test/plan.test.ts`        | 证据断言：explicit / text / none 三态 + 行号 + confidence      |
| `test/renderer.test.ts`    | 报告格式 + `--json` 结构                                       |
| `test/adversarial.test.ts` | （配合 8.5.4）"只字面复述 FP 无方案"应判 not-covered 或低置信  |

## 6. 测试策略

- **explicit covers**：证据指向 covers 声明项，confidence 1.0；
- **text-match 兜底**：正文命中段落，证据摘录正确、行号区间正确；
- **未覆盖**：source 为 null，matchKind none；
- **行号区间**：多章节、跨行段落定位正确；
- **`--json`**：输出合法 JSON 且含全部 Evidence 字段；
- **adversarial 种子**：构造"只在正文复述 FP 原文、不给任何实现方案"的 plan——应判 not-covered 或低置信（防止"凑字面"糊弄）。

## 7. 风险与权衡

| 风险                                                            | 缓解                                           |
| --------------------------------------------------------------- | ---------------------------------------------- |
| **证据"伪造"**：AI 在 plan 里写"见 spec"而无实质内容 → 证据为空 | 空/过短摘录 → confidence 降级 + 标记需人工确认 |
| **行号漂移**：plan 编辑后行号失准                               | 以"章节名 + 摘录"为主锚，行号标参考 + 警告     |
| **摘录断章取义**                                                | 保留上下文窗口（前后各一句）                   |
| **破坏向后兼容**                                                | 契约不改、门控仍按 status；证据是**增量输出**  |
| **引入依赖**                                                    | 全部自写，零新增依赖                           |

## 8. 实施步骤（分阶段）

1. `types.ts` 加 `Evidence` 模型；
2. `plan.ts` 双通道判定记录命中位置，产出 `Evidence[]`；
3. `renderer.ts` 报告输出证据行 + 摘要；
4. `commands.ts` 支持 `--json` 结构化输出；
5. 测试补齐（正常三态 + 行号 + `--json` + adversarial 种子）；
6. 文档落地：PROPOSAL §8.5.1 状态更新 + CHANGELOG。

---

## 待评审问题（给 review 的重点）

1. 证据模型是否遗漏关键字段（是否够支撑 8.5.2 置信度分层）？
2. 双通道命中时"取更高 confidence / 合并"是否合理？
3. "行号 + 章节"双定位 vs 仅"章节 + 摘录"，是否过度设计？
4. 空/短证据的降级策略是否足以防"凑字面糊弄"？
5. 证据摘录截断策略（160 字符 + 上下文窗口）是否合适？
6. 是否有更轻的落地路径，能把证据链尽快交付而不引入新复杂度？
