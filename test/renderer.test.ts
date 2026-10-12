import { describe, expect, it } from 'vitest';
import { renderChecklist, colorize } from '../src/core/renderer.js';
import { parseSpecDoc } from '../src/core/loader.js';

function specWith(criteria: string[], priority = 'P1') {
  const fm = ['---', 'id: a', 'capability: auth', `priority: ${priority}`, 'acceptanceCriteria:'];
  for (const c of criteria) fm.push(`  - "${c}"`);
  fm.push('---', '# t', '- ✅ fp');
  return parseSpecDoc('/p/spec.md', fm.join('\n'));
}

describe('renderChecklist', () => {
  it('renders a checklist with priority per item', () => {
    const out = renderChecklist('login', specWith(['c1', 'c2']));
    expect(out).toContain('# 验收清单（login）');
    expect(out).toContain('- [ ] [P1] c1');
    expect(out).toContain('- [ ] [P1] c2');
  });

  it('uses the spec priority', () => {
    const out = renderChecklist('login', specWith(['c1'], 'P0'));
    expect(out).toContain('- [ ] [P0] c1');
  });

  it('notes when there are no criteria', () => {
    const out = renderChecklist('login', specWith([]));
    expect(out).toContain('无 acceptanceCriteria');
  });
});

describe('colorize', () => {
  it('returns empty codes when disabled', () => {
    const c = colorize(false);
    expect(c.ok).toBe('');
    expect(c.reset).toBe('');
  });
  it('returns ansi codes when enabled', () => {
    const c = colorize(true);
    expect(c.ok).toContain('\u001b[');
  });
});
