import type { SpecDoc, ValidationIssue } from '../types.js';
import { splitFrontmatter } from './loader.js';

/**
 * spec → plan alignment checking.
 *
 * An AI agent reads a spec and produces a `plan.md`. speculor-ai's job is to answer
 * one question: **does the plan faithfully cover the spec?** It computes a
 * coverage ratio over the spec's confirmed/default feature points and its
 * acceptance criteria, using two channels so it does not over-depend on the
 * agent following an exact format:
 *  1. explicit `covers:` declarations in the plan frontmatter;
 *  2. normalised text matching against the plan body (fallback).
 */

export interface PlanDoc {
  path: string;
  /** The spec id this plan claims to implement. */
  spec: string;
  /** Modules the plan introduces / touches. */
  modules: string[];
  /** Explicitly declared covered feature points / criteria. */
  covers: string[];
  body: string;
}

export function parsePlanDoc(path: string, content: string): PlanDoc {
  const { frontmatter, body } = splitFrontmatter(content);
  return {
    path,
    spec: String(frontmatter.spec ?? ''),
    modules: Array.isArray(frontmatter.modules) ? frontmatter.modules.map(String) : [],
    covers: Array.isArray(frontmatter.covers) ? frontmatter.covers.map(String) : [],
    body,
  };
}

/** Lower-case and strip punctuation so matching tolerates minor phrasing drift. */
export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '')
    .trim();
}

export interface PlanValidationResult {
  issues: ValidationIssue[];
  /** Per-target coverage detail (for reporting). */
  targets: Array<{ text: string; covered: boolean }>;
  /** Coverage ratio in [0, 1]. */
  coverage: number;
}

/** Targets a plan must cover: confirmed/default feature points + all criteria. */
export function planTargets(spec: SpecDoc): string[] {
  const fp = spec.items.filter((i) => i.state !== 'pending').map((i) => i.text);
  return [...fp, ...spec.frontmatter.acceptanceCriteria];
}

export function validatePlan(plan: PlanDoc, spec: SpecDoc): PlanValidationResult {
  const issues: ValidationIssue[] = [];
  const targets = planTargets(spec);
  const bodyNorm = normalizeText(plan.body);
  const coversNorm = plan.covers.map((c) => normalizeText(c));

  if (!plan.spec) {
    issues.push({ severity: 'error', file: plan.path, message: 'plan frontmatter 缺少 spec 字段' });
  }
  if (plan.spec && plan.spec !== spec.frontmatter.id) {
    issues.push({
      severity: 'error',
      file: plan.path,
      message: `plan 声明的 spec "${plan.spec}" 与文件 ${spec.path} 的 id "${spec.frontmatter.id}" 不一致`,
    });
  }

  const detail = targets.map((text) => {
    const norm = normalizeText(text);
    // A covers entry may be a shorthand id or a fuller paraphrase, so match on
    // containment in either direction; body matching is a fallback.
    const covered =
      coversNorm.some((c) => c.length > 0 && (c.includes(norm) || norm.includes(c))) ||
      bodyNorm.includes(norm);
    return { text, covered };
  });

  const coveredCount = detail.filter((d) => d.covered).length;
  const coverage = targets.length === 0 ? 1 : coveredCount / targets.length;
  const uncovered = detail.filter((d) => !d.covered).map((d) => d.text);

  if (uncovered.length > 0) {
    issues.push({
      severity: 'error',
      file: plan.path,
      message: `plan 未覆盖 ${uncovered.length} 项（覆盖率 ${Math.round(coverage * 100)}%）：${uncovered.join('；')}`,
    });
  }

  return { issues, targets: detail, coverage };
}
