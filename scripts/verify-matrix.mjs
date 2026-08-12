import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const srcTauri = path.join(root, 'src-tauri');
const results = [];

function platformCommand(command) {
  if (process.platform === 'win32' && (command === 'npx' || command === 'npm')) {
    return `${command}.cmd`;
  }
  return command;
}

function runCommand(name, level, cwd, command, args, timeoutMs = 120000) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const env = { ...process.env, FORCE_COLOR: '0' };
    const child =
      process.platform === 'win32'
        ? spawn(`${platformCommand(command)} ${args.join(' ')}`, {
            cwd,
            shell: true,
            windowsHide: true,
            env,
          })
        : spawn(platformCommand(command), args, { cwd, env });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) child.kill();
    }, timeoutMs);
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
      results.push({
        level,
        name,
        status: 'FAILED',
        durationMs: Date.now() - startedAt,
        errors: [err.message],
      });
      resolve(false);
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const text = `${stdout}\n${stderr}`;
      const errors =
        code === 0
          ? []
          : text
              .split(/\r?\n/)
              .filter((line) => {
                const lower = line.toLowerCase();
                return (
                  lower.includes('error') || lower.includes('failed') || lower.includes('panic')
                );
              })
              .slice(0, 20);
      results.push({
        level,
        name,
        status: code === 0 ? 'GREEN' : 'FAILED',
        durationMs: Date.now() - startedAt,
        errors: errors.length ? errors : code === 0 ? [] : [text.trim() || `exited ${code}`],
      });
      resolve(code === 0);
    });
  });
}

function gitPorcelain() {
  return new Promise((resolve) => {
    const child = spawn('git', ['status', '--porcelain'], {
      cwd: root,
      windowsHide: true,
    });
    let out = '';
    child.stdout.on('data', (chunk) => {
      out += chunk;
    });
    child.on('close', () => resolve(out));
    child.on('error', () => resolve(''));
  });
}

function gitDiffAdded(file) {
  return new Promise((resolve) => {
    const child = spawn('git', ['diff', 'HEAD', '--unified=0', '--no-color', '--', file], {
      cwd: root,
      windowsHide: true,
    });
    let out = '';
    child.stdout.on('data', (chunk) => {
      out += chunk;
    });
    child.on('close', () => {
      const added = out
        .split(/\r?\n/)
        .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
        .map((line) => line.slice(1))
        .join('\n');
      resolve(added);
    });
    child.on('error', () => resolve(''));
  });
}

async function runL4Mock() {
  const startedAt = Date.now();
  const errors = [];
  const porcelain = await gitPorcelain();
  const changed = porcelain
    .split(/\r?\n/)
    .map((line) => line.slice(3).trim())
    .filter(Boolean);
  const secretPatterns = [
    /\bsk-[A-Za-z0-9_-]{16,}\b/,
    /-----BEGIN [A-Z ]+PRIVATE KEY-----/,
    /\bAKIA[0-9A-Z]{16}\b/,
  ];
  for (const file of changed) {
    const full = path.join(root, file);
    const exists = fs.existsSync(full);
    if (exists && !fs.statSync(full).isFile()) continue;
    const added = exists ? await gitDiffAdded(file) : '';
    const addedOrAll = added || (exists ? fs.readFileSync(full, 'utf8') : '');
    for (const pattern of secretPatterns) {
      if (pattern.test(addedOrAll)) {
        errors.push(`${file}: 变更可能包含硬编码敏感信息`);
        break;
      }
    }
    const normalized = file.replaceAll('\\', '/');
    const isFrontend = /^src\/.*\.(ts|tsx)$/.test(normalized);
    const isRust = /^src-tauri\/src\/.*\.rs$/.test(normalized);
    if (isFrontend && /^\s*console\.log\s*\(/m.test(addedOrAll)) {
      errors.push(`${file}: 前端残留调试输出`);
    }
    if (isRust && /^\s*dbg!\s*\(/m.test(addedOrAll)) {
      errors.push(`${file}: Rust 残留调试输出`);
    }
  }
  results.push({
    level: 4,
    name: 'AI DoD 语义对齐与安全审计（MOCK 降级）',
    status: errors.length ? 'FAILED' : 'GREEN',
    durationMs: Date.now() - startedAt,
    errors,
    note: 'MOCK 模式：完整 L4 由应用内 run_quality_gate 调用 Agency QA/CISO 审查。',
  });
  return errors.length === 0;
}

async function main() {
  const l1Checks = [
    ['npx', ['tsc', '--noEmit'], root, 'L1 tsc'],
    ['npx', ['eslint', '.'], root, 'L1 eslint'],
    ['cargo', ['fmt', '--check'], srcTauri, 'L1 cargo fmt'],
    [
      'cargo',
      ['clippy', '--all-targets', '--all-features', '--', '-D', 'warnings'],
      srcTauri,
      'L1 clippy',
    ],
  ];
  for (const [command, args, cwd, name] of l1Checks) {
    await runCommand(name, 1, cwd, command, args, 120000);
  }

  await runCommand('L2 cargo test', 2, srcTauri, 'cargo', ['test', '--quiet'], 180000);
  await runCommand('L2 vitest', 2, root, 'npm', ['run', 'test:unit'], 120000);
  await runCommand('L2 build', 2, root, 'npm', ['run', 'build'], 180000);
  await runCommand('L3 preview verify', 3, root, 'node', ['scripts/preview-verify.mjs'], 240000);
  await runL4Mock();

  const failed = results.filter((result) => result.status === 'FAILED');
  console.log(JSON.stringify(results, null, 2));
  if (failed.length) {
    console.error(`VERIFY_MATRIX_FAILED: ${failed.length} level(s) failed`);
    process.exit(1);
  }
  console.log('VERIFY_MATRIX_EXIT=0');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
