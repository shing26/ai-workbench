import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const srcTauri = path.join(root, 'src-tauri');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'verify.matrix.json'), 'utf8'));
const results = [];

function platformCommand(command) {
  if (process.platform === 'win32' && (command === 'npx' || command === 'npm')) {
    return `${command}.cmd`;
  }
  return command;
}

function resolveCwd(cwd) {
  return cwd === 'src-tauri' ? srcTauri : root;
}

function requirementMet(requires) {
  switch (requires) {
    case 'ts':
      return fs.existsSync(path.join(root, 'tsconfig.json'));
    case 'cargo':
      return (
        fs.existsSync(path.join(root, 'Cargo.toml')) ||
        fs.existsSync(path.join(srcTauri, 'Cargo.toml'))
      );
    case 'pkg':
      return fs.existsSync(path.join(root, 'package.json'));
    case 'ui':
      return (
        fs.existsSync(path.join(root, 'package.json')) &&
        fs.existsSync(path.join(root, 'scripts', 'ui-verify.mjs'))
      );
    default:
      return true;
  }
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

function secretRuleHit(text, rule) {
  if (rule.contains) {
    return text.toLowerCase().includes(rule.contains.toLowerCase());
  }
  if (rule.prefix) {
    const lower = text.toLowerCase();
    const prefix = rule.prefix.toLowerCase();
    const idx = lower.indexOf(prefix);
    if (idx < 0) return false;
    const rest = (text.slice(idx + rule.prefix.length).match(/^[A-Za-z0-9_-]*/) || [''])[0];
    return rest.length >= (rule.minLength ?? 16);
  }
  return false;
}

function debugCallHit(line, needle) {
  const trimmed = line.trimStart();
  return trimmed.startsWith(needle) && trimmed.slice(needle.length).trimStart().startsWith('(');
}

async function runSecurityScan() {
  const startedAt = Date.now();
  const errors = [];
  const porcelain = await gitPorcelain();
  const changed = porcelain
    .split(/\r?\n/)
    .map((line) => line.slice(3).trim())
    .filter(Boolean);
  const rules = manifest.securityRules;
  for (const file of changed) {
    if (
      (rules.ignorePaths || []).some((pattern) => {
        const normalized = pattern.replace(/[\\/]+$/, '');
        return file === normalized || file.startsWith(`${normalized}/`);
      })
    ) {
      continue;
    }
    const full = path.join(root, file);
    const exists = fs.existsSync(full);
    if (exists && !fs.statSync(full).isFile()) continue;
    const added = exists ? await gitDiffAdded(file) : '';
    const addedOrAll = added || (exists ? fs.readFileSync(full, 'utf8') : '');
    const hitRule = rules.secrets.find((rule) => secretRuleHit(addedOrAll, rule));
    if (hitRule) {
      errors.push(`${file}: 变更可能包含硬编码敏感信息（${hitRule.id}）`);
    }
    const normalized = file.replaceAll('\\', '/');
    const lang = /^src\/.*\.(ts|tsx)$/.test(normalized)
      ? 'ts'
      : /^src-tauri\/src\/.*\.rs$/.test(normalized)
        ? 'rs'
        : null;
    if (lang) {
      const needles = rules.debugCalls[lang] || [];
      const debugHit = addedOrAll
        .split(/\r?\n/)
        .some((line) => needles.some((needle) => debugCallHit(line, needle)));
      if (debugHit) {
        errors.push(`${file}: 残留调试输出`);
      }
    }
  }
  return { errors, durationMs: Date.now() - startedAt };
}

async function main() {
  const failFast = manifest.failFast ?? 'level';
  for (const level of manifest.levels) {
    if (level.level > 3) continue;
    let levelFailed = false;
    for (const check of level.checks) {
      if (check.program === 'internal') continue;
      if (check.requires && !requirementMet(check.requires)) continue;
      const ok = await runCommand(
        check.name,
        level.level,
        resolveCwd(check.cwd),
        check.program,
        check.args,
        check.timeoutMs ?? 120000,
      );
      if (!ok) levelFailed = true;
    }
    if (failFast === 'level' && levelFailed) break;
  }

  const l4Meta = manifest.levels.find((level) => level.level === 4);
  const { errors: l4Errors, durationMs: l4Duration } = await runSecurityScan();
  results.push({
    level: 4,
    name: `${l4Meta?.name ?? 'AI DoD 语义对齐与安全审计'}（安全扫描 · AI audit 需在 app 内执行）`,
    status: l4Errors.length ? 'FAILED' : 'SKIPPED',
    durationMs: l4Duration,
    errors: l4Errors,
  });

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
