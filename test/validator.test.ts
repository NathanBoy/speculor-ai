import { describe, expect, it } from 'vitest';
import { validateAll, hasBlockingErrors } from '../src/core/validator.js';
import { parseSpecDoc } from '../src/core/loader.js';
import type { SpecDoc } from '../src/types.js';

interface SpecOver {
  id?: string;
  capability?: string;
  dependsOn?: string[];
  acceptanceCriteria?: string[];
  includeFm?: boolean;
}

function spec(over: SpecOver, body = '- ✅ fp'): SpecDoc {
  const fm: string[] = [];
  if (over.includeFm !== false) {
    fm.push('---', `id: ${over.id ?? 'x'}`, `capability: ${over.capability ?? 'auth'}`);
    if (over.dependsOn?.length) fm.push(`dependsOn: [${over.dependsOn.join(', ')}]`);
    if (over.acceptanceCriteria?.length) {
      fm.push('acceptanceCriteria:');
      for (const c of over.acceptanceCriteria) fm.push(`  - "${c}"`);
    }
    fm.push('---');
  }
  return parseSpecDoc('/proj/.specdev/specs/auth/spec.md', [...fm, '# t', body].join('\n'));
}

describe('validateAll', () => {
  it('reports structural errors', () => {
    const doc = parseSpecDoc('/p/.specdev/specs/a/spec.md', '---\nid: Bad\n---');
    const issues = validateAll([doc], { root: '/p' });
    expect(issues.some((i) => i.severity === 'error' && i.message.includes('id'))).toBe(true);
  });

  it('reports duplicate ids', () => {
    const a = spec({ id: 'dup' });
    const b = { ...a, path: '/proj/.specdev/specs/b/spec.md' };
    const issues = validateAll([a, b], { root: '/proj' });
    expect(issues.some((i) => i.message.includes('duplicate spec id "dup"'))).toBe(true);
  });

  it('reports unresolvable dependsOn', () => {
    const doc = spec({ id: 'a', dependsOn: ['ghost'] });
    const issues = validateAll([doc], { root: '/proj' });
    expect(issues.some((i) => i.message.includes('"ghost" does not resolve'))).toBe(true);
  });

  it('blocks pending items by default, allows with allowPending', () => {
    const doc = spec({ id: 'x' }, '- ⚠️ unresolved');
    expect(hasBlockingErrors(validateAll([doc], { root: '/proj' }))).toBe(true);
    expect(hasBlockingErrors(validateAll([doc], { root: '/proj', allowPending: true }))).toBe(
      false,
    );
  });

  it('emits warnings for missing criteria / items', () => {
    const doc = spec({ id: 'a', includeFm: false }, '# t');
    const issues = validateAll([doc], { root: '/proj' });
    expect(
      issues.some((i) => i.severity === 'warning' && i.message.includes('acceptanceCriteria')),
    ).toBe(true);
  });

  it('passes a clean spec', () => {
    const doc = spec({ id: 'ok', acceptanceCriteria: ['c1'] });
    expect(validateAll([doc], { root: '/proj' })).toHaveLength(0);
  });
});
