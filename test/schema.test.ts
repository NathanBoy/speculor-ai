import { describe, expect, it } from 'vitest';
import { validateFrontmatter, normalizeFrontmatter, SPEC_STATUSES } from '../src/core/schema.js';

function valid(): Record<string, unknown> {
  return {
    id: 'auth-login',
    capability: 'auth',
    status: 'proposed',
    priority: 'P1',
    dependsOn: [],
    acceptanceCriteria: ['a'],
  };
}

describe('validateFrontmatter', () => {
  it('accepts a valid frontmatter', () => {
    expect(validateFrontmatter(valid()).ok).toBe(true);
  });

  it('rejects non-object input', () => {
    expect(validateFrontmatter(null).ok).toBe(false);
    expect(validateFrontmatter('x').ok).toBe(false);
    expect(validateFrontmatter([1]).ok).toBe(false);
  });

  it('requires id and capability', () => {
    const { ok, errors } = validateFrontmatter({ capability: 'auth' });
    expect(ok).toBe(false);
    expect(errors.join()).toContain('id');
  });

  it('rejects invalid id format', () => {
    expect(validateFrontmatter({ ...valid(), id: 'Bad_Id' }).ok).toBe(false);
    expect(validateFrontmatter({ ...valid(), id: 'good-id' }).ok).toBe(true);
  });

  it('rejects invalid status and priority enums', () => {
    expect(validateFrontmatter({ ...valid(), status: 'nope' }).ok).toBe(false);
    expect(validateFrontmatter({ ...valid(), priority: 'P9' }).ok).toBe(false);
  });

  it('rejects non-array dependsOn / acceptanceCriteria', () => {
    expect(validateFrontmatter({ ...valid(), dependsOn: 'x' }).ok).toBe(false);
    expect(validateFrontmatter({ ...valid(), acceptanceCriteria: [1] }).ok).toBe(false);
  });

  it('allows every declared status enum', () => {
    for (const s of SPEC_STATUSES) {
      expect(validateFrontmatter({ ...valid(), status: s }).ok).toBe(true);
    }
  });
});

describe('normalizeFrontmatter', () => {
  it('applies defaults for missing optional fields', () => {
    const n = normalizeFrontmatter({ id: 'x', capability: 'y' });
    expect(n.status).toBe('proposed');
    expect(n.priority).toBe('P1');
    expect(n.dependsOn).toEqual([]);
    expect(n.acceptanceCriteria).toEqual([]);
  });

  it('coerces scalar fields to strings', () => {
    const n = normalizeFrontmatter({ id: 'x', capability: 'y', dependsOn: ['a'] });
    expect(n.dependsOn).toEqual(['a']);
  });
});
