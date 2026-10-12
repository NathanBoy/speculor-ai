import type { ValidationIssue } from '../types.js';

/**
 * plan → tasks checking: completeness, acyclic dependency graph, topological
 * order, and parallel batches.
 *
 * A `tasks.md` declares tasks in its body under a `## 任务` heading, one per
 * line in a machine-parseable Markdown form:
 *
 *     - [ ] [auth] 实现登录接口 #t1 dependsOn:[]
 *     - [ ] [session] 写入会话 #t2 dependsOn:[t1]
 *
 * Each task carries a module (in `[...]`), a description, a stable id (`#tN`),
 * and an optional `dependsOn:[...]`. speculor-ai checks that every module of the
 * plan is covered, that the dependency graph is a DAG, and produces a
 * topological order plus batches of tasks that can run in parallel.
 */

export interface Task {
  id: string;
  module: string;
  description: string;
  dependsOn: string[];
}

export interface TasksDoc {
  path: string;
  /** The spec id this task list implements. */
  spec: string;
  tasks: Task[];
}

const TASK_LINE = /^- \[ \] \[(.+?)\] (.+?)(?: #(\S+))?(?: dependsOn:\[(.*?)\])?$/;

/** Parse the `## 任务` section of a tasks.md body. */
export function parseTasks(path: string, body: string): TasksDoc {
  const tasks: Task[] = [];
  let spec = '';
  const lines = body.split(/\r?\n/);
  let inTasks = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('## ')) {
      inTasks = line.slice(3).trim().toLowerCase() === '任务';
      continue;
    }
    if (!inTasks) continue;
    if (line.startsWith('spec:')) {
      spec = line.slice(5).trim();
      continue;
    }
    const m = TASK_LINE.exec(line);
    if (!m) continue;
    const [, module, description, id, depRaw] = m;
    tasks.push({
      module: (module ?? '').trim(),
      description: (description ?? '').trim(),
      id: (id ?? `t${tasks.length + 1}`).trim(),
      dependsOn: (depRaw ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    });
  }
  return { path, spec, tasks };
}

export interface TasksValidationResult {
  issues: ValidationIssue[];
  /** Topological order of task ids (empty when the graph has a cycle). */
  topo: string[];
  /** Batches of task ids that can be executed in parallel. */
  batches: string[][];
}

/**
 * Validate task completeness against the plan's modules, detect dependency
 * cycles, and derive a topological order plus parallel batches (Kahn's
 * algorithm).
 */
export function validateTasks(doc: TasksDoc, planModules: string[]): TasksValidationResult {
  const issues: ValidationIssue[] = [];

  // --- structural checks ----------------------------------------------------
  const ids = new Set(doc.tasks.map((t) => t.id));
  if (ids.size !== doc.tasks.length) {
    issues.push({ severity: 'error', file: doc.path, message: '任务 id 必须唯一' });
  }
  const byId = new Map(doc.tasks.map((t) => [t.id, t]));
  for (const t of doc.tasks) {
    for (const dep of t.dependsOn) {
      if (!byId.has(dep)) {
        issues.push({
          severity: 'error',
          file: doc.path,
          message: `任务 ${t.id} 依赖不存在的任务 "${dep}"`,
        });
      }
    }
  }

  // --- completeness: every plan module covered ------------------------------
  const coveredModules = new Set(doc.tasks.map((t) => t.module));
  const missingModules = planModules.filter((m) => !coveredModules.has(m));
  if (missingModules.length > 0) {
    issues.push({
      severity: 'error',
      file: doc.path,
      message: `plan 的模块未被任何任务覆盖：${missingModules.join('、')}`,
    });
  }

  // --- DAG + topological order + batches (Kahn) ------------------------------
  const order: string[] = [];
  const batches: string[][] = [];
  // Only run graph analysis when the task set is structurally sound enough.
  const soundIds = new Set<string>();
  for (const t of doc.tasks) {
    if (t.dependsOn.every((d) => byId.has(d))) soundIds.add(t.id);
  }

  if (soundIds.size === doc.tasks.length && doc.tasks.length > 0) {
    // prereq[t] = how many of t's dependencies are not yet done.
    // dependents[x] = tasks that list x in their dependsOn.
    const prereq = new Map<string, number>();
    const dependents = new Map<string, string[]>();
    for (const t of doc.tasks) {
      prereq.set(t.id, t.dependsOn.length);
      for (const d of t.dependsOn) {
        const list = dependents.get(d) ?? [];
        list.push(t.id);
        dependents.set(d, list);
      }
    }

    const ready = doc.tasks.filter((t) => (prereq.get(t.id) ?? 0) === 0).map((t) => t.id);
    const queue = [...ready];

    while (queue.length > 0) {
      // current batch = all currently-ready tasks (they can run in parallel)
      const batch = [...queue];
      batches.push(batch);
      order.push(...batch);
      queue.length = 0;
      for (const done of batch) {
        for (const next of dependents.get(done) ?? []) {
          const v = (prereq.get(next) ?? 1) - 1;
          prereq.set(next, v);
          if (v === 0) queue.push(next);
        }
      }
    }

    if (order.length !== doc.tasks.length) {
      issues.push({ severity: 'error', file: doc.path, message: '任务依赖存在环，无法拓扑排序' });
    }
  } else if (doc.tasks.length > 0) {
    issues.push({
      severity: 'error',
      file: doc.path,
      message: '存在无效依赖，跳过依赖/批次分析',
    });
  }

  return { issues, topo: order, batches };
}
