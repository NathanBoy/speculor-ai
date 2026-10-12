# 证据链（Evidence Chain）技术方案

> 对齐校验可信度演进的第一步（PROPOSAL §8.5.1）。
> 目标：把 `plan` 对齐校验从"机器判定"升级为"**机器判定 + 可复核证据**"。
> 状态：**已评审并实施（v0.2）**。本版已吸收独立评审（`docs/evidence-chain-review.md`）的 P0/P1 修正。

---

## 1. 背景与问题

当前 `plan` 对齐校验的判定逻辑是双通道：

1. **explicit covers**：plan frontmatter 里 `covers: [...]` 显式声明覆盖了哪些 spec 条目；
2. **normalized text match**：plan 正文与 spec 条目做归一化后匹配。

判定结果只有二元结论，**没有证据**。两个可信度问题：

- **不可复核（黑箱）**：人无法确认"它凭什么判覆盖"，FN（误报漏）无法追溯；
- **不可度量**：字面命中与语义命中等价，无法区分"精确声明"与"措辞沾边"，FP（误放行）无标记。

## 2. 目标与非目标

### 目标

- 每一项覆盖判定产出它在 plan 中的**证据位置**（章节定位 / 行号 / 摘录）；
- `plan` 命令报告可审计：`✔ 已覆盖 [conf 0.9] ← plan.md §2.1 L24-27 "…"`；
- 顺带**倒逼 AI 生成 plan 时自我声明证据**；
- 为 8.5.2 置信度分层提供**置信度种子**；
- **兑现 FN 可追溯**：未覆盖也给出近失（near-miss）线索。

### 非目标（留给后续演进）

- **不做语义匹配**（那是 `--deep`，另立）；
- **不改 `plan.md` 契约格式**（向后兼容）；
- **不改变门控语义与阈值**（required 仍须全覆盖才放行；本版 `partial` ⇒ block，8.5.2 再放宽）；
- **不引入任何运行时依赖**（全部自写）。

## 3. 核心设计

### 3.1 证据模型（Evidence）— 已实施

```ts
interface Evidence {
  targetId: string; // 带类型前缀，如 fp:3 / ac:2（唯一可解析）
  targetText: string;
  status: 'covered' | 'partial' | 'not-covered'; // 三态，支撑 8.5.2
  needsReview: boolean; // 低置信 / 弱佐证 / 疑似回声时 true
  confidence: number; // 佐证强度 0–1
  matchKind: MatchKind[]; // 数组，可表达双通道交叉佐证
  planRef?: string; // plan 快照锚点（文件 mtime）
  source: EvidenceSource | null; // 仅"无任何命中"为 null
  nearMiss?: NearMiss; // 未覆盖时的最近正文段线索
}
interface EvidenceSource {
  section: string;
  startLine?: number;
  endLine?: number;
  snippet: string;
}
```

### 3.2 confidence 语义（佐证强度，非单通道可信度）

评审核心修正：**covers 是 AI 自我声明，不可默认给高可信**。两通道作为**交叉佐证信号**：

| 判定组合                                               | 语义             | confidence | status                   |
| ------------------------------------------------------ | ---------------- | ---------- | ------------------------ |
| covers + 正文精确命中                                  | 声明被正文佐证   | 0.9        | covered                  |
| 仅正文精确命中（非回声）                               | 有实质内容       | 0.7        | covered                  |
| 仅 covers + 正文 near-miss（措辞漂移但正文仍讨论该点） | 弱佐证           | 0.5        | covered，**needsReview** |
| 仅 covers，正文无任何关联                              | 纯自证，最可疑   | 0.4        | partial，needsReview     |
| 正文命中但为**回声**（复述目标原文、几无实现内容）     | 形似覆盖实则偏离 | 0.3        | partial，needsReview     |
| 都未命中                                               | 未覆盖           | 0          | not-covered（+nearMiss） |

**门控**：`covered` 放行（0.5 档需人工确认但通过）；`partial` ⇒ **block**（保守，8.5.2 再放宽）。

### 3.3 段定位（按段切分重构）

- 现状整篇 `includes` 拿不到命中位置 → **改为按 `#`/`##`/`###` 标题切段**，记录 `L起-L止`；
- **章节名 + 摘录为主锚**，行号仅作参考（`startLine/endLine` 可选），不参与对账；
- 摘录规则：**命中段首个非空行 + 句界截断 ≤160**（具名常量 `SNIPPET_MAX`），删除非确定性"关键句"。
- **已知回归**：跨段拼接才命中的目标可能不再命中 → 覆盖率可能微降，属预期内，测试显式断言。

### 3.4 回声检测（Echo Detection）

空/短降级拦不住"长度正常的字面复述"。新增：

- 正文命中段归一化后若 `includes(targetNorm)` 且**超出部分 ≤ 6 字符**（`ECHO_FILLER`）→ 判**回声**，非有效证据 → partial 0.3。
- 这使 8.5.4 的对抗承诺（"凑字面不给方案"）可测。

### 3.5 near-miss（FN 可追溯）

- 未覆盖项也扫正文，找**归一化重叠度最高**（最长公共子串 ≥3 字符）的段；
- 报告：`✖ 未覆盖 …（最接近的正文在 §方案 L5 "实现会话过期处理"）`——给人/AI 一个追查入口。

## 4. 数据流

```
spec.md + plan.md
   │
   ▼
segmentBody(plan.body) 按标题切段
   ▼
validatePlan：双通道判定 × 每段 → 佐证强度 + 回声检测 + near-miss
   │
   ▼
Evidence[]
   ├─► renderer：证据行（conf + 章节 + 行号 + 摘录）
   └─► cmdPlan：覆盖率 + 未覆盖/需人工确认 error issue
```

## 5. 变更文件清单（已实施）

| 文件                   | 变更                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `src/types.ts`         | 新增 `Evidence` / `EvidenceStatus` / `MatchKind` / `EvidenceSource` / `NearMiss`    |
| `src/core/plan.ts`     | 段切分 `segmentBody`、双通道佐证 confidence、回声检测、near-miss、产出 `Evidence[]` |
| `src/core/renderer.ts` | `renderEvidenceLine`：证据行（conf + 位置 + 摘录 + near-miss）                      |
| `src/cli/commands.ts`  | `cmdPlan` 用证据渲染；`planRef` 取 plan 文件 mtime                                  |
| `test/plan.test.ts`    | 三态 / 段定位 / 回声 / near-miss / 双通道佐证 / planRef                             |

> `--json` 结构化输出、templates 倒逼自证、partial 接入门控 → **v0.3**（评审建议，类型已定好）。

## 6. 测试策略

- explicit covers 仅声明无正文 → partial 0.4 block；
- covers + 正文精确命中 → covered 0.9，`matchKind` 双通道；
- covers + 正文 near-miss → covered 0.5 needsReview；
- 正文精确命中（非回声）→ covered 0.7；
- 回声（正文复述原文）→ partial 0.3；
- 未覆盖 → not-covered，`source=null`，近失段带 `nearMiss`；
- 段定位 / 行号区间 / 摘录句界截断 / `planRef`。

## 7. 风险与权衡

| 风险                                             | 缓解                                                                 |
| ------------------------------------------------ | -------------------------------------------------------------------- |
| **证据"伪造"**：AI 在 plan 里"见 spec"无实质内容 | 回声检测 + 仅 covers 无佐证 → partial block                          |
| **行号漂移**                                     | 章节 + 摘录为主锚，行号仅参考                                        |
| **摘录断章取义**                                 | 首行 + 句界截断                                                      |
| **破坏向后兼容**                                 | 契约不改；证据是增量输出；门控语义等价（原"覆盖才过"仍成立，仅更严） |
| **引入依赖**                                     | 全部自写，零新增依赖                                                 |

## 8. 待办（后续演进，见 PROPOSAL §8.5）

1. 8.5.2 置信度分层：`partial` 接入门控（不再一律 block）；
2. `--json` 结构化输出（类型已定）；
3. 8.5.4 对抗测试全集；
4. `--deep` 语义对齐（可选模式）。
