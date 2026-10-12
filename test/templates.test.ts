import { describe, expect, it } from 'vitest';
import { initTemplates, newSpecTemplate, planPrompt, tasksPrompt } from '../src/core/templates.js';
import { parseSpecDoc } from '../src/core/loader.js';

describe('initTemplates', () => {
  it('provides constitution + specs + changes dirs', () => {
    const files = initTemplates();
    expect(files.map((f) => f.path)).toEqual(
      expect.arrayContaining(['constitution.md', 'specs/.gitkeep', 'changes/.gitkeep']),
    );
    expect(files[0]?.content).toContain('项目原则');
  });
});

describe('newSpecTemplate', () => {
  it('embeds the change name and tri-state markers', () => {
    const t = newSpecTemplate('auth-login');
    expect(t).toContain('id: auth-login');
    expect(t).toContain('✅');
    expect(t).toContain('⚠️');
    expect(t).toContain('acceptanceCriteria');
  });
});

describe('planPrompt', () => {
  it('lists feature points and criteria for the agent', () => {
    const spec = parseSpecDoc(
      '/p/spec.md',
      '---\nid: a\ncapability: auth\nacceptanceCriteria:\n  - "c1"\n---\n# t\n- ✅ fp',
    );
    const p = planPrompt(spec);
    expect(p).toContain('c1');
    expect(p).toContain('fp');
    expect(p).toContain('covers');
  });
});

describe('tasksPrompt', () => {
  it('mentions modules and structured tasks', () => {
    const p = tasksPrompt('a', ['m1', 'm2']);
    expect(p).toContain('spec: a');
    expect(p).toContain('m1');
    expect(p).toContain('dependsOn');
  });
});
