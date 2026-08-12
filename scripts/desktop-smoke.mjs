import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
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

function resolveCargo() {
  if (process.env.CARGO) return process.env.CARGO;
  if (process.platform === 'win32') {
    const candidate = path.join(
      process.env.RUSTUP_HOME || path.join(process.env.USERPROFILE || '', '.rustup'),
      'toolchains',
      'stable-x86_64-pc-windows-msvc',
      'bin',
      'cargo.exe',
    );
    if (fs.existsSync(candidate)) return candidate;
  }
  const which = run(process.platform === 'win32' ? 'where.exe' : 'which', ['cargo'], 5000);
  if (which.status === 0) {
    const found = which.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
    if (found && /\.exe$/i.test(found)) return found;
  }
  return 'cargo';
}

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

function runCargoTest() {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(resolveCargo(), ['test', '--quiet'], {
      cwd: path.join(root, 'src-tauri'),
      windowsHide: true,
      env: { ...process.env, FORCE_COLOR: '0' },
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) child.kill();
    }, 300000);
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ status: 'FAILED', durationMs: Date.now() - startedAt, errors: [err.message] });
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const text = `${stdout}\n${stderr}`;
      const results = text
        .split(/\r?\n/)
        .filter((line) => line.includes('test result:'))
        .map((line) => line.trim());
      resolve({
        status: code === 0 ? 'GREEN' : 'FAILED',
        durationMs: Date.now() - startedAt,
        summary: results,
        errors:
          code === 0
            ? []
            : text
                .split(/\r?\n/)
                .filter((line) => /error|failed|panic/i.test(line))
                .slice(0, 20),
      });
    });
  });
}

const cli = CLI_WHITELIST.map(detectCli);
const obsidian = checkObsidian();
const cargoTest = await runCargoTest();

const degraded = [
  ...cli.filter((entry) => !entry.found).map((entry) => `CLI not found: ${entry.name}`),
  ...(obsidian.available ? [] : ['Obsidian protocol not available, vault actions will fall back']),
];

console.log(
  JSON.stringify(
    {
      cli,
      obsidian,
      cargoTest,
      degraded,
    },
    null,
    2,
  ),
);

if (cargoTest.status !== 'GREEN') {
  console.error('DESKTOP_SMOKE_FAILED: cargo test did not pass');
  process.exit(1);
}
console.log('DESKTOP_SMOKE_EXIT=0');
