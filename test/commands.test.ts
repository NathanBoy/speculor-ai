import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  cmdInit,
  cmdNew,
  cmdValidate,
  cmdPlan,
  cmdTasks,
  cmdCheck,
  CliError,
  type CommandContext,
} from '../src/cli/commands.js';

let root: string;
let out: string[];
let ctx: CommandContext;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'specdev-test-'));
  out = [];
  ctx = { root, out: (l) => out.push(l) };
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function w(rel: string, content: string) {
  const full = join(root, rel);
  await mkdir(join(full, '..'), { recursive: true });
  await writeFile(full, content);
}

const SPEC_OK = `---
id: auth-login
capability: auth
status: proposed
priority: P1
dependsOn: []
acceptanceCriteria:
  - "未登录访问受保护路由重定向到登录页"
  - "登录后写入会话 30 分钟内有效"
---
# 登录
## 功能点
- ✅ 未登录访问受保护路由重定向到登录页
- ✅ 登录后写入会话
`;

const PLAN_OK = `---
spec: auth-login
modules: [auth, session]
covers: [未登录访问受保护路由重定向到登录页, 登录后写入会话]
---
# 方案
实现重定向到登录页，登录后写入会话，有效期 30 分钟。
`;

const TASKS_OK = `## 任务
- [ ] [auth] 实现重定向 #t1 dependsOn:[]
- [ ] [session] 写入会话 #t2 dependsOn:[t1]
`;

describe('end-to-end specdev flow', () => {
  it('runs init → new → validate → plan → tasks → check', async () => {
    expect(await cmdInit(ctx, false)).toBe(0);
    expect(out.at(-1)).toContain('.specdev/');

    expect(await cmdNew(ctx, 'auth-login')).toBe(0);
    expect(out.at(-1)).toContain('auth-login/spec.md');

    // template has a pending item → blocks
    expect(await cmdValidate(ctx, { allowPending: false })).toBe(1);
    expect(out.join('\n')).toContain('pending item blocks');

    await w('.specdev/changes/auth-login/spec.md', SPEC_OK);
    expect(await cmdValidate(ctx, { allowPending: false })).toBe(0);

    // plan --prompt yields a prompt
    out.length = 0;
    expect(await cmdPlan(ctx, 'auth-login', { prompt: true })).toBe(0);
    expect(out.join('\n')).toContain('covers');

    // plan missing → error
    expect(await cmdPlan(ctx, 'auth-login', { prompt: false })).toBe(1);

    await w('.specdev/changes/auth-login/plan.md', PLAN_OK);
    expect(await cmdPlan(ctx, 'auth-login', { prompt: false })).toBe(0);
    expect(out.join('\n')).toContain('覆盖率 100%');

    // tasks --prompt
    out.length = 0;
    expect(await cmdTasks(ctx, 'auth-login', { prompt: true })).toBe(0);
    expect(out.join('\n')).toContain('dependsOn');

    // tasks missing → error
    expect(await cmdTasks(ctx, 'auth-login', { prompt: false })).toBe(1);

    await w('.specdev/changes/auth-login/tasks.md', TASKS_OK);
    expect(await cmdTasks(ctx, 'auth-login', { prompt: false })).toBe(0);
    expect(out.join('\n')).toContain('批次1');

    expect(await cmdCheck(ctx, 'auth-login')).toBe(0);
    const checklist = await readFile(
      join(root, '.specdev/changes/auth-login/checklist.md'),
      'utf8',
    );
    expect(checklist).toContain('验收清单');
    expect(checklist).toContain('[P1] 未登录');
  });

  it('rejects a second init without --force', async () => {
    await cmdInit(ctx, false);
    expect(await cmdInit(ctx, false)).toBe(1);
    expect(await cmdInit(ctx, true)).toBe(0);
  });

  it('rejects invalid / duplicate change names', async () => {
    expect(await cmdNew(ctx, 'Bad_Name')).toBe(1);
    await cmdNew(ctx, 'good');
    expect(await cmdNew(ctx, 'good')).toBe(1);
  });

  it('throws CliError when no change exists', async () => {
    await expect(cmdPlan(ctx, undefined, { prompt: false })).rejects.toThrow(CliError);
    await expect(cmdCheck(ctx, undefined)).rejects.toThrow(CliError);
  });

  it('fails plan when plan.md does not cover the spec', async () => {
    await cmdInit(ctx, false);
    await cmdNew(ctx, 'auth-login');
    await w('.specdev/changes/auth-login/spec.md', SPEC_OK);
    await w('.specdev/changes/auth-login/plan.md', '---\nspec: auth-login\n---\n# 缺覆盖');
    expect(await cmdPlan(ctx, 'auth-login', { prompt: false })).toBe(1);
  });
});
