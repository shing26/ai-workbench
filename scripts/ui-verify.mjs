import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const APP_URL = process.env.AIWB_APP_URL || 'http://localhost:1420';
const OUT_DIR = 'D:/ai-workbench/.screenshots';
const SHOT_PREFIX = process.env.AIWB_SHOT_PREFIX || 'prism';
const APP_HOST = new URL(APP_URL).host;

const VIEWS = [
  { id: 'dashboard', label: 'Dashboard', selector: '[data-token-sparkline-point]' },
  { id: 'projects', label: 'Projects', selector: '[data-project-add]' },
  { id: 'ai-studio', label: 'AI Studio', selector: '[data-studio-chat-input]' },
  { id: 'actions', label: 'Actions', selector: '[data-task-fast-input]' },
  { id: 'knowledge', label: 'Knowledge', selector: '[data-knowledge-search]' },
];

fs.mkdirSync(OUT_DIR, { recursive: true });

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'aiwb-cdp-'));
const edge = spawn(
  EDGE,
  [
    '--headless=new',
    '--disable-gpu',
    '--disable-extensions',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    APP_URL,
  ],
  { windowsHide: true, stdio: 'ignore' },
);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const results = { views: [], modals: [], exceptions: [] };

function durationSeconds(value) {
  const parts = String(value || '')
    .split(',')
    .map((s) => s.trim());
  const nums = parts.map((part) => {
    if (part.endsWith('ms')) return Number(part.slice(0, -2)) / 1000;
    if (part.endsWith('s')) return Number(part.slice(0, -1));
    return Number(part) || 0;
  });
  return Math.max(...nums);
}

async function waitForDevToolsPort() {
  const portFile = path.join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 60; i++) {
    if (fs.existsSync(portFile)) {
      const [port] = fs.readFileSync(portFile, 'utf8').trim().split(/\r?\n/);
      return Number(port);
    }
    await delay(250);
  }
  throw new Error('Edge DevTools port file not created');
}

async function getPageTarget(port) {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((t) => t.type === 'page' && t.url.includes(APP_HOST));
      if (page) return page;
    } catch {
      /* retry until target appears */
    }
    await delay(250);
  }
  throw new Error('page target not found');
}

let ws;
let nextId = 1;
const pending = new Map();

function send(method, params = {}) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP timeout: ${method}`));
    }, 30000);
    pending.set(id, { resolve, reject, timer });
  });
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    const details =
      result.exceptionDetails.exception?.description ??
      result.exceptionDetails.exception?.value ??
      JSON.stringify(result.exceptionDetails);
    throw new Error(`evaluate failed: ${details}`);
  }
  return result.result.value;
}

async function waitFor(expression, label, tries = 40) {
  for (let i = 0; i < tries; i++) {
    const ok = await evaluate(expression);
    if (ok) return true;
    await delay(250);
  }
  throw new Error(`timeout waiting for ${label}`);
}

async function click(expression) {
  await evaluate(
    `(() => { const el = ${expression}; if (!el) throw new Error('missing element'); el.click(); return true; })()`,
  );
}

async function screenshot(name) {
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const file = path.join(OUT_DIR, `${SHOT_PREFIX}-${name}.png`);
  fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
  return file;
}

async function main() {
  const port = await waitForDevToolsPort();
  const target = await getPageTarget(port);
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const entry = pending.get(msg.id);
      pending.delete(msg.id);
      clearTimeout(entry.timer);
      if (msg.error)
        entry.reject(new Error(`${msg.error.message}: ${JSON.stringify(msg.error.data)}`));
      else entry.resolve(msg.result);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      results.exceptions.push(msg.params.exceptionDetails.text ?? 'exception');
    }
  };
  await send('Runtime.enable');
  await send('Page.enable');

  await waitFor(`document.querySelector('[data-view-pane="dashboard"]') !== null`, 'app boot');
  await delay(600);
  await screenshot('boot');

  results.motion = await evaluate(`(() => {
    const nav = document.querySelector('nav button');
    const view = document.querySelector('[data-view-pane="dashboard"]');
    return {
      navTransitionDuration: nav ? getComputedStyle(nav).transitionDuration : '',
      viewAnimationDuration: view ? getComputedStyle(view).animationDuration : '',
      bodyOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  })()`);
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await delay(250);
  results.motion.reducedViewAnimation = await evaluate(`(() => {
    const view = document.querySelector('[data-view-pane="dashboard"]');
    return view ? getComputedStyle(view).animationDuration : '';
  })()`);
  await send('Emulation.setEmulatedMedia', { features: [] });
  results.motion.pass =
    durationSeconds(results.motion.navTransitionDuration) <= 0.16 &&
    durationSeconds(results.motion.viewAnimationDuration) <= 0.16 &&
    durationSeconds(results.motion.reducedViewAnimation) <= 0.02 &&
    results.motion.bodyOverflowX <= 1;
  if (!results.motion.pass) {
    throw new Error(`UI motion DoD assertion failed: ${JSON.stringify(results.motion)}`);
  }

  for (const view of VIEWS) {
    await click(`document.querySelector('button[aria-label="${view.label}"]')`);
    await waitFor(
      `(() => {
      const pane = document.querySelector('[data-view-pane="${view.id}"]');
      const style = pane ? window.getComputedStyle(pane) : null;
      return style !== null && style.display !== 'none';
    })()`,
      `${view.label} pane visible`,
    );
    await delay(250);
    const selectorOk = await evaluate(`document.querySelector('${view.selector}') !== null`);
    results.views.push({ view: view.id, selectorOk });
    await screenshot(`view-${view.id}`);
    if (!selectorOk) throw new Error(`missing selector ${view.selector} in ${view.label}`);
  }

  await click(`document.querySelector('button[aria-label="Dashboard"]')`);
  await waitFor(
    `document.querySelector('[data-token-sparkline-point]') !== null`,
    'dashboard sparkline',
  );
  for (const sel of [
    '[data-dashboard-today-dod]',
    '[data-dashboard-blocked]',
    '[data-dashboard-risk]',
  ]) {
    const ok = await evaluate(`document.querySelector('${sel}') !== null`);
    results.views.push({ view: `dashboard-${sel}`, selectorOk: ok });
    if (!ok) throw new Error(`missing dashboard selector ${sel}`);
  }

  await click(`document.querySelector('button[aria-label="Projects"]')`);
  await waitFor(`document.querySelector('[data-project-add]') !== null`, 'project add');
  await evaluate(`(() => {
    const name = document.querySelector('[data-project-name]');
    const pathInput = document.querySelector('[data-project-path]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    if (name) {
      setter.call(name, 'Verify Project');
      name.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (pathInput) {
      setter.call(pathInput, 'D:/verify-project');
      pathInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    document.querySelector('[data-project-add]').click();
    return true;
  })()`);
  await waitFor(
    `document.querySelectorAll('[data-project-card]').length > 0`,
    'project card created',
  );
  for (const sel of ['[data-project-mount]', '[data-project-archive]', '[data-project-cli]']) {
    const ok = await evaluate(`document.querySelector('${sel}') !== null`);
    results.views.push({ view: `projects-${sel}`, selectorOk: ok });
    if (!ok) throw new Error(`missing project selector ${sel}`);
  }

  await evaluate(`(() => {
    const card = Array.from(document.querySelectorAll('[data-project-card]')).find((el) =>
      (el.innerText || '').includes('Verify Project'),
    );
    const select = card?.querySelector('[data-project-stage]');
    if (!card || !select) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    setter.call(select, 'ready');
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await delay(250);
  await click(`(() => {
    const card = Array.from(document.querySelectorAll('[data-project-card]')).find((el) =>
      (el.innerText || '').includes('Verify Project'),
    );
    return card?.querySelector('[data-project-archive]');
  })()`);
  await click(`document.querySelector('button[aria-label="Knowledge"]')`);
  await waitFor(`document.querySelector('[data-prism-card]') !== null`, 'archive knowledge card');
  results.archive = await evaluate(`(() => {
    const card = Array.from(document.querySelectorAll('[data-prism-card]')).find((el) =>
      (el.innerText || '').includes('Verify Project'),
    );
    const text = card?.innerText || '';
    return {
      hasCard: card !== null,
      hasProject: text.includes('Verify Project'),
      hasArchived: text.includes('#archived') || text.includes('归档'),
      cardText: text.slice(0, 160),
    };
  })()`);
  if (!results.archive.hasCard || !results.archive.hasProject || !results.archive.hasArchived) {
    throw new Error(`archive flow assertion failed: ${JSON.stringify(results.archive)}`);
  }

  await click(`document.querySelector('button[aria-label="AI Studio"]')`);
  await waitFor(`document.querySelector('[data-studio-chat-input]') !== null`, 'studio input');
  await click(`document.querySelector('[data-agent-dropdown-toggle]')`);
  await waitFor(`document.querySelectorAll('[data-agent-seat]').length >= 2`, 'agent seats');
  await screenshot('studio-seats');

  await click(`document.querySelector('button[aria-label="Actions"]')`);
  await waitFor(`document.querySelector('[data-task-fast-input]') !== null`, 'actions input');
  await evaluate(`(() => {
    const input = document.querySelector('[data-task-fast-input]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'Verify DoD task #dod');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('[data-task-add]').click();
    return true;
  })()`);
  await waitFor(`document.querySelector('[data-task-id]') !== null`, 'task row created');
  await click(`document.querySelector('[data-task-cli]')`);
  await waitFor(`document.querySelector('[role="dialog"]') !== null`, 'cli modal');
  await waitFor(`document.querySelectorAll('[data-cli-kind]').length > 0`, 'cli kinds');
  const cliKinds = await evaluate(
    `Array.from(document.querySelectorAll('[data-cli-kind]')).map((el) => el.dataset.cliKind)`,
  );
  results.modals.push({ name: 'cli', ok: true });
  results.modals.push({
    name: 'cli-kinds',
    ok: cliKinds.length > 0,
    kinds: cliKinds,
  });
  await screenshot('cli-modal');
  await evaluate(`document.querySelector('[role="dialog"] [aria-label="Close"]')?.click()`);
  const gateOk = await evaluate(`document.querySelector('[data-quality-gate]') !== null`);
  results.views.push({ view: 'actions-quality-gate', selectorOk: gateOk });
  if (!gateOk) throw new Error('missing quality gate panel in Actions');

  await click(`document.querySelector('button[aria-label="Knowledge"]')`);
  await waitFor(`document.querySelector('[data-knowledge-search]') !== null`, 'knowledge search');
  await click(`document.querySelector('[data-prism-view-graph]')`);
  await waitFor(`document.querySelector('[data-prism-graph]') !== null`, 'knowledge graph');
  await screenshot('knowledge-graph');

  await evaluate(
    `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))`,
  );
  await waitFor(`document.querySelector('[role="dialog"]') !== null`, 'search modal');
  results.modals.push({ name: 'search', ok: true });
  await evaluate(`document.querySelector('[role="dialog"] [aria-label="Close"]')?.click()`);
  await delay(150);
  await click(`document.querySelector('[data-shortcuts-trigger]')`);
  await waitFor(`document.querySelector('[role="dialog"]') !== null`, 'shortcuts modal');
  results.modals.push({ name: 'shortcuts', ok: true });

  await screenshot('final');
  console.log(JSON.stringify(results, null, 2));
  if (results.exceptions.length > 0) {
    console.error('EXCEPTIONS', results.exceptions);
    process.exitCode = 1;
  }
}

export async function runUiVerify() {
  try {
    await main();
    console.log('UI_VERIFY_EXIT=0');
  } catch (err) {
    console.error(err);
    if (results.exceptions.length > 0) {
      console.error('EXCEPTIONS', results.exceptions);
    }
    try {
      const snapshot = await evaluate(`(() => {
        const raw = localStorage.getItem('ai-workbench:db:v1');
        let projects = [];
        try {
          projects = raw ? JSON.parse(raw).projects ?? [] : [];
        } catch { /* ignore */ }
        return {
          cards: document.querySelectorAll('[data-project-card]').length,
          form: document.querySelector('[data-project-name]') !== null,
          nameValue: document.querySelector('[data-project-name]')?.value ?? null,
          pathValue: document.querySelector('[data-project-path]')?.value ?? null,
          projects: projects.map((p) => ({ name: p.name, path: p.path, stage: p.journeyStage })),
          body: document.body.innerText.slice(0, 300),
        };
      })()`);
      console.error('SNAPSHOT', JSON.stringify(snapshot, null, 2));
    } catch {
      /* page may be gone */
    }
    throw err;
  } finally {
    try {
      ws?.close();
    } catch {
      /* ignore */
    }
    if (!edge.killed) edge.kill();
  }
}

const isDirect = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirect) {
  runUiVerify()
    .catch(() => {
      process.exitCode = 1;
    })
    .finally(() => {
      setTimeout(() => process.exit(process.exitCode || 0), 500);
    });
}
