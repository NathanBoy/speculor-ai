import { argv } from 'node:process';
import {
  cmdInit,
  cmdNew,
  cmdValidate,
  cmdPlan,
  cmdTasks,
  cmdCheck,
  CliError,
  type CommandContext,
} from './commands.js';

const VERSION = '0.1.0';

const HELP = `specdev — Spec-Driven Development toolkit

用法:
  specdev init [--force]                    初始化 .specdev/ 脚手架
  specdev new <name>                        新建一个 change（生成 spec.md 模板）
  specdev validate [--allow-pending]        校验 spec（结构/引用/三态门控）
  specdev plan [--prompt] [<change>]        校验 plan 对齐 spec；--prompt 输出生成指令
  specdev tasks [--prompt] [<change>]       校验任务完备/依赖；--prompt 输出生成指令
  specdev check [<change>]                  生成验收清单 checklist.md
  specdev --help | --version

说明:
  specdev 是"校验者"：AI 生成 spec/plan/tasks，specdev 验 AI 是否忠实覆盖 spec。
  agent 无关、零依赖。换 IDE / Agent 只改规则文件，不改 specdev。
`;

function run(print: (s: string) => void): Promise<number> {
  const raw = argv.slice(2);

  if (raw.length === 0 || raw.includes('-h') || raw.includes('--help')) {
    print(HELP);
    return Promise.resolve(0);
  }
  if (raw.includes('-v') || raw.includes('--version')) {
    print(`specdev ${VERSION}`);
    return Promise.resolve(0);
  }

  const flags = new Set(raw.filter((a) => a.startsWith('--')));
  const positional = raw.filter((a) => !a.startsWith('--'));

  const [cmd, maybeName] = positional;
  const ctx: CommandContext = { root: process.cwd(), out: (s) => print(s) };

  switch (cmd) {
    case 'init':
      return cmdInit(ctx, flags.has('--force'));
    case 'new': {
      if (!maybeName) {
        print('✖ 用法: specdev new <name>');
        return Promise.resolve(1);
      }
      return cmdNew(ctx, maybeName);
    }
    case 'validate':
      return cmdValidate(ctx, { allowPending: flags.has('--allow-pending') });
    case 'plan':
      return cmdPlan(ctx, maybeName, { prompt: flags.has('--prompt') });
    case 'tasks':
      return cmdTasks(ctx, maybeName, { prompt: flags.has('--prompt') });
    case 'check':
      return cmdCheck(ctx, maybeName);
    default:
      print(`✖ 未知命令 "${cmd ?? ''}"。运行 specdev --help 查看用法。`);
      return Promise.resolve(1);
  }
}

run((s) => console.log(s))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    if (err instanceof CliError) {
      console.error(`✖ ${err.message}`);
      process.exitCode = 1;
    } else {
      console.error(err);
      process.exitCode = 1;
    }
  });
