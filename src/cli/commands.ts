import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { SPECDEV_DIR, SPECS_DIR, CHANGES_DIR } from '../core/loader.js';
import type { SpecDoc } from '../types.js';
import { parseSpecDoc, loadAllSpecs } from '../core/loader.js';
import { validateAll, hasBlockingErrors } from '../core/validator.js';
import { parsePlanDoc, validatePlan } from '../core/plan.js';
import { parseTasks, validateTasks } from '../core/tasks.js';
import { renderChecklist, renderEvidenceLine } from '../core/renderer.js';
import { initTemplates, newSpecTemplate, planPrompt, tasksPrompt } from '../core/templates.js';

/**
 * CLI command implementations.
 *
 * Each command is a pure-ish function: it takes a project root (cwd) plus an
 * optional `out` sink for printing, and returns a process exit code. Keeping
 * IO injectable makes the commands testable without spawning a subprocess.
 */

export interface CommandContext {
  root: string;
  out: (line: string) => void;
}

export class CliError extends Error {}

const CHANGE_NAME = /^[a-z0-9][a-z0-9-]*$/;

function changesDir(root: string): string {
  return join(root, SPECDEV_DIR, CHANGES_DIR);
}

/** Resolve which change to operate on: an explicit name, or the sole one. */
async function resolveChange(root: string, name?: string): Promise<{ name: string; dir: string }> {
  const base = changesDir(root);
  let entries: string[];
  try {
    entries = (await readdir(base)).filter((e) => e !== '.gitkeep' && !e.startsWith('.'));
  } catch {
    throw new CliError('还没有 .specdev/changes，先运行 `speculor-ai new <name>`');
  }
  let target: string;
  if (name) {
    if (!entries.includes(name)) throw new CliError(`change "${name}" 不存在`);
    target = name;
  } else if (entries.length === 1) {
    target = entries[0] as string;
  } else if (entries.length === 0) {
    throw new CliError('还没有 change，先运行 `speculor-ai new <name>`');
  } else {
    throw new CliError(`有多个 change（${entries.join('、')}），请指定：speculor-ai <命令> <name>`);
  }
  return { name: target, dir: join(base, target) };
}

async function readSpec(changeDir: string): Promise<SpecDoc> {
  const file = join(changeDir, 'spec.md');
  const content = await readFile(file, 'utf8');
  return parseSpecDoc(file, content);
}

export async function cmdInit(ctx: CommandContext, force: boolean): Promise<number> {
  const base = join(ctx.root, SPECDEV_DIR);
  let existed = false;
  try {
    await readdir(base);
    existed = true;
  } catch {
    /* not present yet */
  }
  if (existed && !force) {
    ctx.out(`✖ .specdev/ 已存在，使用 --force 覆盖`);
    return 1;
  }
  for (const f of initTemplates()) {
    const full = join(base, f.path);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, f.content);
  }
  ctx.out(`✔ 已创建 .specdev/（constitution.md、${SPECS_DIR}/、${CHANGES_DIR}/）`);
  return 0;
}

export async function cmdNew(ctx: CommandContext, name: string): Promise<number> {
  if (!CHANGE_NAME.test(name)) {
    ctx.out(`✖ 变更名 "${name}" 非法，需匹配 ${CHANGE_NAME}`);
    return 1;
  }
  const dir = join(changesDir(ctx.root), name);
  try {
    await readdir(dir);
    ctx.out(`✖ change "${name}" 已存在`);
    return 1;
  } catch {
    /* ok */
  }
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'spec.md'), newSpecTemplate(name));
  ctx.out(`✔ 已创建 changes/${name}/spec.md`);
  return 0;
}

export async function cmdValidate(
  ctx: CommandContext,
  options: { allowPending: boolean },
): Promise<number> {
  const docs = await loadAllSpecs(ctx.root);
  const issues = validateAll(docs, { root: ctx.root, allowPending: options.allowPending });
  if (issues.length === 0) {
    ctx.out(`✔ 校验通过（${docs.length} 个 spec）`);
    return 0;
  }
  for (const i of issues) {
    const tag = i.severity === 'error' ? '✖' : '⚠';
    ctx.out(`${tag} ${i.severity === 'error' ? 'ERROR' : 'WARN'} ${i.file}: ${i.message}`);
  }
  return hasBlockingErrors(issues) ? 1 : 0;
}

export async function cmdPlan(
  ctx: CommandContext,
  changeName: string | undefined,
  options: { prompt: boolean },
): Promise<number> {
  const change = await resolveChange(ctx.root, changeName);
  const spec = await readSpec(change.dir);

  if (options.prompt) {
    ctx.out(planPrompt(spec));
    return 0;
  }

  let planContent: string;
  try {
    planContent = await readFile(join(change.dir, 'plan.md'), 'utf8');
  } catch {
    ctx.out(
      `✖ 缺少 ${change.name}/plan.md，先让编码 Agent 生成（可用 speculor-ai plan --prompt 取指令）`,
    );
    return 1;
  }
  const plan = parsePlanDoc(join(change.dir, 'plan.md'), planContent);
  try {
    plan.planRef = (await stat(join(change.dir, 'plan.md'))).mtime.toISOString();
  } catch {
    /* planRef is a best-effort audit anchor */
  }
  const r = validatePlan(plan, spec);
  const pct = Math.round(r.coverage * 100);
  for (const ev of r.evidence) ctx.out(renderEvidenceLine(ev));
  ctx.out(
    `── 覆盖率 ${pct}%（${r.evidence.filter((e) => e.status === 'covered').length}/${r.evidence.length}）──`,
  );
  for (const i of r.issues) ctx.out(`✖ ERROR ${i.message}`);
  return r.issues.some((i) => i.severity === 'error') ? 1 : 0;
}

export async function cmdTasks(
  ctx: CommandContext,
  changeName: string | undefined,
  options: { prompt: boolean },
): Promise<number> {
  const change = await resolveChange(ctx.root, changeName);
  let planContent: string;
  try {
    planContent = await readFile(join(change.dir, 'plan.md'), 'utf8');
  } catch {
    ctx.out(`✖ 缺少 ${change.name}/plan.md，先让编码 Agent 生成 plan（speculor-ai plan --prompt）`);
    return 1;
  }
  const plan = parsePlanDoc(join(change.dir, 'plan.md'), planContent);

  if (options.prompt) {
    ctx.out(tasksPrompt(plan.spec, plan.modules));
    return 0;
  }

  let tasksContent: string;
  try {
    tasksContent = await readFile(join(change.dir, 'tasks.md'), 'utf8');
  } catch {
    ctx.out(
      `✖ 缺少 ${change.name}/tasks.md，先让编码 Agent 生成（可用 speculor-ai tasks --prompt 取指令）`,
    );
    return 1;
  }
  const tasksDoc = parseTasks(join(change.dir, 'tasks.md'), tasksContent);
  const r = validateTasks(tasksDoc, plan.modules);

  ctx.out(`── 任务报告（${tasksDoc.tasks.length} 个任务）──`);
  for (const i of r.issues) ctx.out(`✖ ERROR ${i.message}`);
  if (r.topo.length === tasksDoc.tasks.length && r.topo.length > 0) {
    ctx.out(`✔ 依赖无环，拓扑序: ${r.topo.join(' → ')}`);
    ctx.out(`✔ 建议批次:`);
    r.batches.forEach((b, idx) => ctx.out(`   批次${idx + 1}: [${b.join(', ')}]`));
  }
  return r.issues.some((i) => i.severity === 'error') ? 1 : 0;
}

export async function cmdCheck(
  ctx: CommandContext,
  changeName: string | undefined,
): Promise<number> {
  const change = await resolveChange(ctx.root, changeName);
  const spec = await readSpec(change.dir);
  const content = renderChecklist(change.name, spec);
  const file = join(change.dir, 'checklist.md');
  await writeFile(file, content);
  ctx.out(`✔ 已生成 ${file.replace(ctx.root + '/', '')}`);
  if (spec.frontmatter.acceptanceCriteria.length === 0) {
    ctx.out(`⚠ 该 spec 没有 acceptanceCriteria，请补充后再验收`);
  }
  return 0;
}
