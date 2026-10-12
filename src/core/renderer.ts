import type { Priority, SpecDoc, Evidence } from '../types.js';

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
    '> 由 `speculor-ai check` 生成。逐项验证；可在每项后补充"如何验证"后交给编码 Agent 自测。',
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

/**
 * Render one line of the `plan` alignment report from an evidence record:
 * the verdict, its corroboration confidence, and (when present) the auditable
 * location + snippet in the plan. `section + snippet` is the primary anchor;
 * the line range is a best-effort reference only.
 */
export function renderEvidenceLine(e: Evidence): string {
  const tag =
    e.status === 'covered' ? '✔ 已覆盖' : e.status === 'partial' ? '⚠ 需人工确认' : '✖ 未覆盖';
  const conf = `[conf ${e.confidence.toFixed(1)}]`;
  let line = `  ${tag} ${conf}: ${e.targetText}`;
  if (e.source) {
    const loc = `${e.source.section}${e.source.startLine ? ` L${e.source.startLine}${e.source.endLine && e.source.endLine !== e.source.startLine ? `-${e.source.endLine}` : ''}` : ''}`;
    line += ` ← ${loc} "${e.source.snippet}"`;
  }
  if (e.nearMiss) {
    const loc = `${e.nearMiss.section}${e.nearMiss.startLine ? ` L${e.nearMiss.startLine}` : ''}`;
    line += ` （最接近的正文在 ${loc} "${e.nearMiss.snippet}"，但归一化未命中）`;
  }
  return line;
}
