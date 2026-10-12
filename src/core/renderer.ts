import type { Priority, SpecDoc } from '../types.js';

/**
 * Rendering of human- and agent-readable artifacts: acceptance checklists and
 * validation reports.
 */

/** Render a `checklist.md` from a spec's acceptance criteria. */
export function renderChecklist(changeName: string, spec: SpecDoc): string {
  const priority: Priority = spec.frontmatter.priority;
  const criteria = spec.frontmatter.acceptanceCriteria;

  const lines: string[] = [
    `# 验收清单（${changeName}）`,
    '',
    '> 由 `specdev check` 生成。逐项验证；可在每项后补充"如何验证"后交给编码 Agent 自测。',
    '',
  ];
  if (criteria.length === 0) {
    lines.push('（无 acceptanceCriteria —— 请在 spec 中补充，否则没有可验收的项。）', '');
    return lines.join('\n');
  }
  for (const c of criteria) {
    lines.push(`- [ ] [${priority}] ${c}`);
  }
  return lines.join('\n') + '\n';
}

export interface ReportStyle {
  ok: string;
  warn: string;
  err: string;
  dim: string;
  reset: string;
}

/** Minimal ANSI color helper (no deps). Enabled only when the caller opts in. */
export function colorize(enabled: boolean): ReportStyle {
  if (!enabled) {
    return { ok: '', warn: '', err: '', dim: '', reset: '' };
  }
  return {
    ok: '\u001b[32m',
    warn: '\u001b[33m',
    err: '\u001b[31m',
    dim: '\u001b[2m',
    reset: '\u001b[0m',
  };
}
