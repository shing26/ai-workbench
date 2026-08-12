import { spawn } from 'node:child_process';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root = process.cwd();
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const preview = spawn(process.execPath, [viteBin, 'preview', '--port', '4173', '--strictPort'], {
  cwd: root,
  windowsHide: true,
  stdio: 'ignore',
});

let exitCode = 0;

try {
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch('http://localhost:4173');
      if (res.ok) {
        ready = true;
        break;
      }
    } catch {
      /* retry until preview is ready */
    }
    await delay(250);
  }
  if (!ready) throw new Error('vite preview did not start');

  process.env.AIWB_APP_URL = 'http://localhost:4173';
  process.env.AIWB_SHOT_PREFIX = 'prod';
  const { runUiVerify } = await import('./ui-verify.mjs');
  await runUiVerify();
  console.log('PREVIEW_VERIFY_EXIT=0');
} catch (err) {
  exitCode = 1;
  console.error(err);
} finally {
  if (!preview.killed) preview.kill();
}

process.exit(exitCode);
