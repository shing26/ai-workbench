import { spawnSync } from 'node:child_process';

const CLI_WHITELIST = [
  'claude',
  'aider',
  'codex',
  'gemini',
  'opencode',
  'qwen',
  'cursor',
  'windsurf',
];

function run(command, args, timeoutMs = 8000) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    timeout: timeoutMs,
    windowsHide: true,
    shell: process.platform === 'win32' && /\.(cmd|bat)$/i.test(command),
  });
}

function detectCli(name) {
  const which = run(process.platform === 'win32' ? 'where.exe' : 'which', [name], 5000);
  if (which.status !== 0) {
    return { name, found: false, bin: null, version: null };
  }
  const bin = which.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  const probe = run(bin, ['--version'], 8000);
  const version =
    probe.status === 0
      ? `${probe.stdout || probe.stderr}`
          .split(/\r?\n/)
          .map((line) => line.trim())
          .find(Boolean) || null
      : null;
  return { name, found: true, bin, version };
}

function checkObsidian() {
  if (process.platform === 'win32') {
    const reg = run('reg', ['query', 'HKCU\\Software\\Classes\\obsidian', '/ve'], 5000);
    return {
      available: reg.status === 0,
      detail: reg.status === 0 ? 'obsidian protocol registered' : 'obsidian protocol not found',
    };
  }
  const xdg = run('xdg-mime', ['query', 'default', 'x-scheme-handler/obsidian'], 5000);
  return {
    available: xdg.status === 0 && xdg.stdout.trim().length > 0,
    detail: xdg.status === 0 ? xdg.stdout.trim() : 'obsidian protocol not found',
  };
}

const cli = CLI_WHITELIST.map(detectCli);
const obsidian = checkObsidian();

const degraded = [
  ...cli.filter((entry) => !entry.found).map((entry) => `CLI not found: ${entry.name}`),
  ...(obsidian.available ? [] : ['Obsidian protocol not available, vault actions will fall back']),
];

console.log(
  JSON.stringify(
    {
      cli,
      obsidian,
      degraded,
    },
    null,
    2,
  ),
);

console.log('DESKTOP_SMOKE_EXIT=0');
