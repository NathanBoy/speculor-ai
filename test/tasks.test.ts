import { describe, expect, it } from 'vitest';
import { parseTasks, validateTasks } from '../src/core/tasks.js';

const BODY = `## 任务
- [ ] [auth] 实现登录接口 #t1 dependsOn:[]
- [ ] [session] 写入会话 #t2 dependsOn:[t1]
- [ ] [session] 会话过期 #t3 dependsOn:[t2]
`;

describe('parseTasks', () => {
  it('parses tasks from the 任务 section', () => {
    const doc = parseTasks('/p/tasks.md', BODY);
    expect(doc.tasks).toHaveLength(3);
    expect(doc.tasks[0]!).toMatchObject({ id: 't1', module: 'auth', dependsOn: [] });
    expect(doc.tasks[1]!.dependsOn).toEqual(['t1']);
  });

  it('ignores non-task sections and assigns fallback ids', () => {
    const doc = parseTasks(
      '/p/tasks.md',
      '## 其他\n- [ ] [x] not a task\n## 任务\n- [ ] [auth] do #a',
    );
    expect(doc.tasks).toHaveLength(1);
    expect(doc.tasks[0]!.id).toBe('a');
  });
});

describe('validateTasks', () => {
  it('reports missing plan modules', () => {
    const doc = parseTasks('/p/tasks.md', '## 任务\n- [ ] [auth] only #t1');
    const r = validateTasks(doc, ['auth', 'session']);
    expect(r.issues.some((i) => i.message.includes('session'))).toBe(true);
  });

  it('reports unknown dependency', () => {
    const doc = parseTasks('/p/tasks.md', '## 任务\n- [ ] [auth] a #t1 dependsOn:[ghost]');
    const r = validateTasks(doc, ['auth']);
    expect(r.issues.some((i) => i.message.includes('不存在的任务 "ghost"'))).toBe(true);
  });

  it('reports duplicate ids', () => {
    const doc = parseTasks('/p/tasks.md', '## 任务\n- [ ] [auth] a #t1\n- [ ] [auth] b #t1');
    const r = validateTasks(doc, ['auth']);
    expect(r.issues.some((i) => i.message.includes('id 必须唯一'))).toBe(true);
  });

  it('produces topological order and batches', () => {
    const doc = parseTasks('/p/tasks.md', BODY);
    const r = validateTasks(doc, ['auth', 'session']);
    expect(r.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    expect(r.topo).toEqual(['t1', 't2', 't3']);
    expect(r.batches[0]).toEqual(['t1']);
    expect(r.batches[1]).toEqual(['t2']);
  });

  it('puts independent tasks in the same batch', () => {
    const body =
      '## 任务\n- [ ] [a] a #t1 dependsOn:[]\n- [ ] [b] b #t2 dependsOn:[]\n- [ ] [c] c #t3 dependsOn:[t1,t2]';
    const doc = parseTasks('/p/tasks.md', body);
    const r = validateTasks(doc, ['a', 'b', 'c']);
    expect(r.batches[0]).toEqual(['t1', 't2']);
    expect(r.batches[1]).toEqual(['t3']);
  });

  it('detects a dependency cycle', () => {
    const body = '## 任务\n- [ ] [a] a #t1 dependsOn:[t2]\n- [ ] [b] b #t2 dependsOn:[t1]';
    const doc = parseTasks('/p/tasks.md', body);
    const r = validateTasks(doc, ['a', 'b']);
    expect(r.issues.some((i) => i.message.includes('存在环'))).toBe(true);
    expect(r.topo.length).toBe(0);
  });
});
