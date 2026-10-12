import type { SpecDoc } from '../types.js';
import { markFor } from './triState.js';

/**
 * Content templates for scaffolding and for the "prompt" artifacts that hand a
 * spec / plan to any coding agent.
 *
 * Keeping these as plain functions (not file templates) keeps them testable and
 * lets the CLI write them with exact paths.
 */

export interface InitFile {
  /** Path relative to the `.specdev/` directory. */
  path: string;
  content: string;
}

const CONSTITUTION_TEMPLATE = `# 项目原则（constitution）

> 这些原则会在 \`plan\` 对齐校验时作为参考边界。按项目实际补充。

## 技术栈边界
- （例）优先使用项目既有技术栈，不引入未经评估的新框架。

## 工程规范
- （例）任何代码必须通过现有 lint / typecheck / 测试。
`;

const SPECS_DIR = 'specs';
const CHANGES_DIR = 'changes';

/** Files created by `speculor-ai init`. */
export function initTemplates(): InitFile[] {
  return [
    { path: 'constitution.md', content: CONSTITUTION_TEMPLATE },
    { path: `${SPECS_DIR}/.gitkeep`, content: '' },
    { path: `${CHANGES_DIR}/.gitkeep`, content: '' },
  ];
}

/**
 * The `spec.md` scaffold produced by `speculor-ai new <name>`.
 * Includes frontmatter plus example tri-state feature points, so an AI agent
 * can fill it in from a PRD without guessing the contract.
 */
export function newSpecTemplate(name: string): string {
  return `---
id: ${name}
capability: ${name}
status: proposed
priority: P1
dependsOn: []
acceptanceCriteria:
  - "第一个验收标准（写成可验证的行为）"
  - "第二个验收标准"
---

# ${name}

## 背景 / 动机
（为什么做，用户的痛点，不含技术方案）

## 功能点（三态：${markFor('confirmed')}已确认 / ${markFor('default')}默认方案 / ${markFor('pending')}待确认）
- ${markFor('confirmed')} 功能点一（已确认）
- ${markFor('default')} 功能点二（默认方案，未显式确认）
- ${markFor('pending')} 功能点三（待确认，会阻塞 validate）

## 范围
- 包含：…
- 不包含：…
`;
}

/**
 * The generation instruction handed to an arbitrary coding agent to produce a
 * `plan.md` from a spec. This is what keeps the workflow agent-agnostic: the
 * instruction is plain prose any agent can follow.
 */
export function planPrompt(spec: SpecDoc): string {
  const fp = spec.items.map((i) => `  - ${i.text}`).join('\n');
  const criteria = spec.frontmatter.acceptanceCriteria.map((c) => `  - ${c}`).join('\n');
  return `按下面的 spec 生成技术方案，将 plan.md 保存到与 spec.md 相同的目录。

要求：
1. 必须覆盖 spec 中所有 ${markFor('confirmed')} 与 ${markFor('default')} 的功能点，以及全部 acceptanceCriteria。
2. 技术决策不得与 constitution.md 的项目原则冲突。
3. 在 plan.md 开头用 frontmatter 声明：
   ---
   spec: ${spec.frontmatter.id}
   modules: [模块名1, 模块名2]
   covers: [功能点原文或标识]
   ---

spec 的功能点：
${fp || '  （无）'}

spec 的验收标准：
${criteria || '  （无）'}
`;
}

/** The generation instruction to split a plan into `tasks.md`. */
export function tasksPrompt(planSpecId: string, modules: string[]): string {
  return `把技术方案拆解成可执行任务，保存为 tasks.md（与 plan.md 同目录）。

要求：
1. 每个任务对应 plan 的一个模块。
2. tasks.md 开头用 frontmatter 声明结构化任务数组：
   ---
   spec: ${planSpecId}
   tasks:
     - id: t1
       module: ${modules[0] ?? '模块A'}
       description: 任务描述
       dependsOn: []
   ---
3. 依赖用 dependsOn 声明（引用其他任务的 id），依赖必须无环。
`;
}
