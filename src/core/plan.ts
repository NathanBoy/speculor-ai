import type { SpecDoc, ValidationIssue, Evidence, MatchKind } from '../types.js';
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
 *
 * Since v0.1 evidence chain (PROPOSAL §8.5.1), every judgement also produces an
 * auditable evidence record (location + snippet + corroboration confidence), and
 * the two channels are treated as *corroborating signals* rather than a race:
 *   - covers alone (no body corroboration) → low confidence, needs review;
 *   - body match that merely echoes the target text → treated as partial;
 *   - a real not-covered still reports the nearest body segment (near-miss).
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
  /** Optional snapshot anchor (e.g. file mtime) for auditability. */
  planRef?: string;
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
  /** Per-target auditable evidence (replaces the old boolean `targets`). */
  evidence: Evidence[];
  /** Coverage ratio in [0, 1] (only true `covered` counts). */
  coverage: number;
}

/** A single plan body segment, cut at heading boundaries, with line numbers. */
interface Segment {
  heading: string;
  startLine: number;
  endLine: number;
  text: string;
}

/** Identity of a coverage target. */
export interface PlanTarget {
  /** e.g. `fp:3` / `ac:2` — uniquely resolvable for machine consumers. */
  id: string;
  kind: 'fp' | 'ac';
  text: string;
}

/** Targets a plan must cover: confirmed/default feature points + all criteria. */
export function planTargets(spec: SpecDoc): PlanTarget[] {
  const fp = spec.items
    .filter((i) => i.state !== 'pending')
    .map((i) => i.text)
    .map((text, idx) => ({ id: `fp:${idx + 1}`, kind: 'fp' as const, text }));
  const ac = spec.frontmatter.acceptanceCriteria.map((text, idx) => ({
    id: `ac:${idx + 1}`,
    kind: 'ac' as const,
    text,
  }));
  return [...fp, ...ac];
}

/** Cut the plan body into segments at markdown heading boundaries. */
export function segmentBody(body: string): Segment[] {
  const lines = body.split('\n');
  const segments: Segment[] = [];
  let cur: Segment | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const m = /^\s*#{1,6}\s+(.+?)\s*$/.exec(line);
    if (m) {
      if (cur) segments.push(cur);
      cur = { heading: m[1]!.trim(), startLine: i + 1, endLine: i + 1, text: line };
    } else if (cur) {
      cur.text += '\n' + line;
      cur.endLine = i + 1;
    }
  }
  if (cur) segments.push(cur);
  return segments;
}

/** First line as a deterministic "key sentence", sentence-bounded to ≤ SNIPPET_MAX. */
export const SNIPPET_MAX = 160;
export function snippetOf(text: string): string {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  let first = lines[0] ?? '';
  if (first.length === 0) first = lines[1] ?? '';
  if (first.length <= SNIPPET_MAX) return first;
  const cut = first.slice(0, SNIPPET_MAX);
  const boundary = Math.max(
    cut.lastIndexOf('。'),
    cut.lastIndexOf('；'),
    cut.lastIndexOf('. '),
    cut.lastIndexOf(';'),
  );
  return (boundary > 20 ? cut.slice(0, boundary + 1) : cut) + '…';
}

/** Longest common substring length (normalized), for near-miss ranking. */
export function overlapLength(a: string, b: string): number {
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  let best = 0;
  for (let i = 0; i < shorter.length; i++) {
    // Scan j from longest down; the first hit for this i is its max.
    for (let j = shorter.length; j > best; j--) {
      if (longer.includes(shorter.slice(i, j))) {
        if (j - i > best) best = j - i;
        break;
      }
    }
  }
  return best;
}

/** Min overlap (normalized chars) for a segment to count as a near-miss hint. */
const NEAR_MISS_MIN = 3;

/** The segment whose normalized text overlaps a target most (≥ NEAR_MISS_MIN). */
function findNearMiss(segments: Segment[], norm: string): Segment | null {
  let bestSeg: Segment | null = null;
  let bestOverlap = 0;
  for (const s of segments) {
    const sn = normalizeText(s.text);
    if (sn.length === 0) continue;
    const ov = overlapLength(sn, norm);
    if (ov >= NEAR_MISS_MIN && ov > bestOverlap) {
      bestOverlap = ov;
      bestSeg = s;
    }
  }
  return bestSeg;
}

function toSource(seg: Segment): NonNullable<Evidence['source']> {
  return {
    section: seg.heading || '(无标题段)',
    startLine: seg.startLine,
    endLine: seg.endLine,
    snippet: snippetOf(seg.text),
  };
}

export function validatePlan(plan: PlanDoc, spec: SpecDoc): PlanValidationResult {
  const issues: ValidationIssue[] = [];
  const targets = planTargets(spec);
  const segments = segmentBody(plan.body);
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

  const evidence: Evidence[] = targets.map((t) => {
    const norm = normalizeText(t.text);

    // Channel 1: explicit covers (AI self-declaration — lowest intrinsic trust).
    const coversHit = coversNorm.some(
      (c) => c.length > 0 && (c.includes(norm) || norm.includes(c)),
    );

    // Channel 2: per-segment text match (real body content).
    const hitSeg = segments.find((s) => {
      const sn = normalizeText(s.text);
      return sn.length > 0 && (sn.includes(norm) || norm.includes(sn));
    });

    if (hitSeg) {
      const segNorm = normalizeText(hitSeg.text);
      // Echo detection: the segment essentially just repeats the target text
      // with no extra implementation substance (≤ a few connective chars)
      // → not a real piece of evidence. Heuristic; the constant bounds how much
      // "filler" an echoed segment may carry.
      const ECHO_FILLER = 6;
      const isEcho = segNorm.includes(norm) && segNorm.length - norm.length <= ECHO_FILLER;
      if (!isEcho) {
        // Real body match; covers (if also hit) corroborates it.
        const corroborated = coversHit;
        return {
          targetId: t.id,
          targetText: t.text,
          status: 'covered' as const,
          needsReview: false,
          confidence: corroborated ? 0.9 : 0.7,
          matchKind: corroborated
            ? (['explicit-covers', 'text-match'] as MatchKind[])
            : ['text-match'],
          planRef: plan.planRef,
          source: toSource(hitSeg),
        };
      }
      // Echo → looks covered but drifts; treat as partial, needs review.
      return {
        targetId: t.id,
        targetText: t.text,
        status: 'partial' as const,
        needsReview: true,
        confidence: 0.3,
        matchKind: ['text-match'] as MatchKind[],
        planRef: plan.planRef,
        source: toSource(hitSeg),
      };
    }

    if (coversHit) {
      // Covers declared but nothing in the body matches literally. Distinguish
      // "weak corroboration" (the body still discusses the target closely enough
      // to be a near-miss) from "pure self-declaration" (nothing relevant at all).
      const weak = findNearMiss(segments, norm);
      if (weak) {
        return {
          targetId: t.id,
          targetText: t.text,
          status: 'covered',
          needsReview: true, // wording drifted — human confirms
          confidence: 0.5,
          matchKind: ['explicit-covers'],
          planRef: plan.planRef,
          source: toSource(weak),
        };
      }
      return {
        targetId: t.id,
        targetText: t.text,
        status: 'partial',
        needsReview: true,
        confidence: 0.4,
        matchKind: ['explicit-covers'],
        planRef: plan.planRef,
        source: { section: '(frontmatter covers)', snippet: snippetOf(plan.covers[0] ?? '') },
      };
    }

    // Not covered — still hand back the closest body segment (near-miss).
    const bestSeg = findNearMiss(segments, norm);
    const ev: Evidence = {
      targetId: t.id,
      targetText: t.text,
      status: 'not-covered',
      needsReview: false,
      confidence: 0,
      matchKind: [],
      planRef: plan.planRef,
      source: null,
    };
    if (bestSeg) {
      ev.nearMiss = {
        section: bestSeg.heading || '(无标题段)',
        startLine: bestSeg.startLine,
        endLine: bestSeg.endLine,
        snippet: snippetOf(bestSeg.text),
      };
    }
    return ev;
  });

  const coveredCount = evidence.filter((e) => e.status === 'covered').length;
  const coverage = targets.length === 0 ? 1 : coveredCount / targets.length;

  const uncovered = evidence.filter((e) => e.status === 'not-covered');
  if (uncovered.length > 0) {
    issues.push({
      severity: 'error',
      file: plan.path,
      message: `plan 未覆盖 ${uncovered.length} 项（覆盖率 ${Math.round(coverage * 100)}%）：${uncovered
        .map((e) => e.targetText)
        .join('；')}`,
    });
  }

  // Partial (needs review) also blocks: a self-declared or echoed item is not a
  // trustworthy pass. This keeps the gate conservative until 8.5.2 relaxes it.
  const reviewNeeded = evidence.filter((e) => e.status === 'partial');
  if (reviewNeeded.length > 0) {
    issues.push({
      severity: 'error',
      file: plan.path,
      message: `plan ${reviewNeeded.length} 项需人工确认（仅声明无正文佐证或疑似回声，暂不放行）：${reviewNeeded
        .map((e) => e.targetText)
        .join('；')}`,
    });
  }

  return { issues, evidence, coverage };
}
