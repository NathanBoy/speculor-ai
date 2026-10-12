import { describe, expect, it } from 'vitest';
import {
  parsePlanDoc,
  normalizeText,
  validatePlan,
  planTargets,
  segmentBody,
  snippetOf,
  overlapLength,
} from '../src/core/plan.js';
import { parseSpecDoc } from '../src/core/loader.js';

function specDoc(body = '- ✅ fp', criteria: string[] = ['criterion alpha']) {
  const fm = ['---', 'id: auth-login', 'capability: auth', 'acceptanceCriteria:'];
  for (const c of criteria) fm.push(`  - "${c}"`);
  fm.push('---', '# t', body);
  return parseSpecDoc('/p/.specdev/changes/login/spec.md', fm.join('\n'));
}

describe('parsePlanDoc', () => {
  it('parses plan frontmatter fields', () => {
    const content = [
      '---',
      'spec: auth-login',
      'modules: [auth, session]',
      'covers: [foo]',
      '---',
      '# plan',
    ].join('\n');
    const plan = parsePlanDoc('/p/plan.md', content);
    expect(plan.spec).toBe('auth-login');
    expect(plan.modules).toEqual(['auth', 'session']);
    expect(plan.covers).toEqual(['foo']);
  });
});

describe('normalizeText', () => {
  it('lowercases and strips punctuation', () => {
    expect(normalizeText('  登录 功能, A. B!!')).toBe('登录功能ab');
  });
});

describe('planTargets', () => {
  it('excludes pending items but includes criteria, with unique ids', () => {
    const spec = specDoc('- ✅ a\n- ⚠️ b', ['c1', 'c2']);
    const targets = planTargets(spec);
    expect(targets.map((t) => t.text)).toEqual(['a', 'c1', 'c2']);
    expect(targets.map((t) => t.id)).toEqual(['fp:1', 'ac:1', 'ac:2']);
    expect(targets[0]?.kind).toBe('fp');
    expect(targets[1]?.kind).toBe('ac');
  });
});

describe('segmentBody', () => {
  it('cuts body at headings and records line numbers', () => {
    const segs = segmentBody('# 方案\n第一行\n## 子模块\n第二行');
    expect(segs).toHaveLength(2);
    expect(segs[0]).toMatchObject({ heading: '方案', startLine: 1, endLine: 2 });
    expect(segs[1]).toMatchObject({ heading: '子模块', startLine: 3, endLine: 4 });
    expect(segs[0]?.text).toContain('第一行');
  });
});

describe('snippetOf', () => {
  it('takes the first non-empty line and sentence-bounds at SNIPPET_MAX', () => {
    expect(snippetOf('\n  关键实现。\n  其他。')).toBe('关键实现。');
    const long = '句子一。'.repeat(200);
    const s = snippetOf(long);
    expect(s.length).toBeLessThanOrEqual(161);
    expect(s.endsWith('…') || s.endsWith('。')).toBe(true);
  });
});

describe('overlapLength', () => {
  it('finds the longest common substring', () => {
    expect(overlapLength('abcdef', 'xabcz')).toBe(3); // "abc"
  });
});

describe('validatePlan', () => {
  it('passes when plan covers everything via real body text (conf 0.7)', () => {
    const spec = specDoc('- ✅ 登录页重定向', ['未登录访问重定向到登录页']);
    const plan = parsePlanDoc(
      '/p/plan.md',
      '---\nspec: auth-login\n---\n# 方案\n实现登录页重定向，未登录访问重定向到登录页。',
    );
    const r = validatePlan(plan, spec);
    expect(r.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    expect(r.coverage).toBe(1);
    for (const ev of r.evidence) {
      expect(ev.status).toBe('covered');
      expect(ev.confidence).toBe(0.7);
      expect(ev.source).not.toBeNull();
      expect(ev.source?.section).toBe('方案');
    }
  });

  it('flags uncovered targets and offers a near-miss hint', () => {
    const spec = specDoc('- ✅ 会话过期 30 分钟', ['会话有效期 30 分钟']);
    const plan = parsePlanDoc(
      '/p/plan.md',
      '---\nspec: auth-login\n---\n# 方案\n只做了登录页重定向。',
    );
    const r = validatePlan(plan, spec);
    expect(r.coverage).toBe(0);
    expect(r.issues.some((i) => i.severity === 'error' && i.message.includes('未覆盖'))).toBe(true);
    const nc = r.evidence.filter((e) => e.status === 'not-covered');
    expect(nc.length).toBe(2);
    expect(nc[0]?.source).toBeNull();
    expect(nc[0]?.nearMiss).toBeUndefined(); // no overlapping substring
    // a genuinely close-but-not-matched target does carry a near-miss
    const spec2 = specDoc('- ✅ 会话过期 30 分钟', []);
    const plan2 = parsePlanDoc(
      '/p/plan.md',
      '---\nspec: auth-login\n---\n# 方案\n实现会话过期处理。',
    );
    const r2 = validatePlan(plan2, spec2);
    const nc2 = r2.evidence[0]!;
    expect(nc2.status).toBe('not-covered');
    expect(nc2.nearMiss?.section).toBe('方案');
  });

  it('covers + body corroboration → covered with highest confidence', () => {
    const spec = specDoc('- ✅ 某个奇怪功能', []);
    const plan = parsePlanDoc(
      '/p/plan.md',
      '---\nspec: auth-login\ncovers: [某个奇怪功能]\n---\n# 方案\n设计并实现某个奇怪功能的完整方案。',
    );
    const r = validatePlan(plan, spec);
    expect(r.coverage).toBe(1);
    const ev = r.evidence[0]!;
    expect(ev.status).toBe('covered');
    expect(ev.confidence).toBe(0.9);
    expect(ev.matchKind).toEqual(['explicit-covers', 'text-match']);
    expect(ev.needsReview).toBe(false);
  });

  it('covers alone without body corroboration → partial, needs review, blocks', () => {
    const spec = specDoc('- ✅ 某个奇怪功能', []);
    const plan = parsePlanDoc(
      '/p/plan.md',
      '---\nspec: auth-login\ncovers: [某个奇怪功能]\n---\n# 方案',
    );
    const r = validatePlan(plan, spec);
    expect(r.coverage).toBe(0); // self-declared only → not a trustworthy pass
    const ev = r.evidence[0]!;
    expect(ev.status).toBe('partial');
    expect(ev.needsReview).toBe(true);
    expect(ev.confidence).toBe(0.4);
    expect(ev.source?.section).toBe('(frontmatter covers)');
    expect(r.issues.some((i) => i.message.includes('需人工确认'))).toBe(true);
  });

  it('echo (body merely repeats the target) → partial, low confidence', () => {
    const spec = specDoc('- ✅ 会话有效期 30 分钟', []);
    const plan = parsePlanDoc(
      '/p/plan.md',
      '---\nspec: auth-login\n---\n# 方案\n会话有效期 30 分钟。',
    );
    const r = validatePlan(plan, spec);
    const ev = r.evidence[0]!;
    expect(ev.status).toBe('partial');
    expect(ev.needsReview).toBe(true);
    expect(ev.confidence).toBe(0.3);
    expect(r.coverage).toBe(0);
  });

  it('records planRef when supplied', () => {
    const spec = specDoc('- ✅ a', ['c1']);
    const plan = parsePlanDoc('/p/plan.md', '---\nspec: auth-login\n---\n# 方案\n覆盖a和c1');
    plan.planRef = '2026-10-12T00:00:00.000Z';
    const r = validatePlan(plan, spec);
    expect(r.evidence.every((e) => e.planRef === '2026-10-12T00:00:00.000Z')).toBe(true);
  });

  it('reports spec id mismatch', () => {
    const spec = specDoc('- ✅ a', ['c1']);
    const plan = parsePlanDoc('/p/plan.md', '---\nspec: other\n---\n# 方案\n覆盖a和c1');
    const r = validatePlan(plan, spec);
    expect(r.issues.some((i) => i.message.includes('不一致'))).toBe(true);
  });

  it('reports missing spec field', () => {
    const spec = specDoc('- ✅ a', ['c1']);
    const plan = parsePlanDoc('/p/plan.md', '---\n---\n# 方案\n覆盖a和c1');
    const r = validatePlan(plan, spec);
    expect(r.issues.some((i) => i.message.includes('缺少 spec 字段'))).toBe(true);
  });
});
