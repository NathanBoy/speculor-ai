import { describe, expect, it } from 'vitest';
import {
  parseFrontmatterYaml,
  splitFrontmatter,
  parseItems,
  parseSpecDoc,
  changeNameOf,
} from '../src/core/loader.js';

describe('parseFrontmatterYaml', () => {
  it('parses scalars with type coercion', () => {
    expect(parseFrontmatterYaml('id: auth\ncount: 3\nok: true')).toEqual({
      id: 'auth',
      count: 3,
      ok: true,
    });
  });

  it('parses inline arrays', () => {
    expect(parseFrontmatterYaml('dependsOn: [a, b]')).toEqual({ dependsOn: ['a', 'b'] });
    expect(parseFrontmatterYaml('dependsOn: []')).toEqual({ dependsOn: [] });
  });

  it('parses multi-line arrays stripping quotes', () => {
    const yaml = ['acceptanceCriteria:', '  - "first"', '  - second'].join('\n');
    expect(parseFrontmatterYaml(yaml)).toEqual({ acceptanceCriteria: ['first', 'second'] });
  });

  it('skips comments and blank lines', () => {
    expect(parseFrontmatterYaml('# note\n\nid: x')).toEqual({ id: 'x' });
  });

  it('ignores lines without a key', () => {
    expect(parseFrontmatterYaml('just text')).toEqual({});
  });
});

describe('splitFrontmatter', () => {
  it('splits a document with frontmatter', () => {
    const { frontmatter, body, raw } = splitFrontmatter('---\nid: x\n---\n# body');
    expect(frontmatter).toEqual({ id: 'x' });
    expect(body).toContain('# body');
    expect(raw).toBe('id: x');
  });

  it('returns full content when no frontmatter', () => {
    const { frontmatter, body, raw } = splitFrontmatter('# no fm');
    expect(frontmatter).toEqual({});
    expect(body).toBe('# no fm');
    expect(raw).toBeNull();
  });

  it('handles missing closing fence', () => {
    const { body } = splitFrontmatter('---\nid: x');
    expect(body).toContain('---');
  });
});

describe('parseItems', () => {
  it('extracts tri-state items from body', () => {
    const items = parseItems('- ✅ a\n- 🟡 b\nplain\n- ⚠️ c');
    expect(items.map((i) => i.state)).toEqual(['confirmed', 'default', 'pending']);
    expect(items.map((i) => i.text)).toEqual(['a', 'b', 'c']);
  });
});

describe('parseSpecDoc', () => {
  it('parses frontmatter + body + items', () => {
    const content = ['---', 'id: auth', 'capability: auth', '---', '# t', '- ✅ fp'].join('\n');
    const doc = parseSpecDoc('/x/spec.md', content);
    expect(doc.frontmatter.id).toBe('auth');
    expect(doc.body).toContain('# t');
    expect(doc.items).toHaveLength(1);
  });
});

describe('changeNameOf', () => {
  it('derives the change name from a change spec path', () => {
    const doc = { path: '/proj/.specdev/changes/feat-x/spec.md' } as never;
    expect(changeNameOf(doc, '/proj')).toBe('feat-x');
  });
});
