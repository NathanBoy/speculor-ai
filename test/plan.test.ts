import { describe, expect, it } from 'vitest';
import { parsePlanDoc, normalizeText, validatePlan, planTargets } from '../src/core/plan.js';
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
  it('excludes pending items but includes criteria', () => {
    const spec = specDoc('- ✅ a\n- ⚠️ b', ['c1']);
    const targets = planTargets(spec);
    expect(targets).toContain('a');
    expect(targets).not.toContain('b');
    expect(targets).toContain('c1');
  });
});

describe('validatePlan', () => {
  it('passes when plan covers everything via body text', () => {
    const spec = specDoc('- ✅ 登录页重定向', ['未登录访问重定向到登录页']);
    const plan = parsePlanDoc(
      '/p/plan.md',
      '---\nspec: auth-login\n---\n# 方案\n实现登录页重定向，未登录访问重定向到登录页。',
    );
    const r = validatePlan(plan, spec);
    expect(r.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    expect(r.coverage).toBe(1);
  });

  it('flags uncovered targets', () => {
    const spec = specDoc('- ✅ 会话过期 30 分钟', ['会话有效期 30 分钟']);
    const plan = parsePlanDoc(
      '/p/plan.md',
      '---\nspec: auth-login\n---\n# 方案\n只做了登录页重定向。',
    );
    const r = validatePlan(plan, spec);
    expect(r.coverage).toBe(0);
    expect(r.issues.some((i) => i.severity === 'error' && i.message.includes('未覆盖'))).toBe(true);
  });

  it('honours explicit covers declarations', () => {
    const spec = specDoc('- ✅ 某个奇怪功能', []);
    const plan = parsePlanDoc(
      '/p/plan.md',
      '---\nspec: auth-login\ncovers: [某个奇怪功能]\n---\n# 方案',
    );
    const r = validatePlan(plan, spec);
    expect(r.coverage).toBe(1);
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
