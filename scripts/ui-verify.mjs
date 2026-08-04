import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const APP_URL = "http://localhost:1420";
const OUT_DIR = "D:/ai-workbench/.screenshots";
const VIEWS = [
  { id: "ai-studio", label: "AI Studio", header: "AI Studio" },
  { id: "projects", label: "Projects", header: "Projects" },
  { id: "knowledge", label: "Knowledge", header: "Knowledge & Inbox" },
  { id: "actions", label: "Actions", header: "Actions & Schedule" },
  { id: "system", label: "System", header: "System & Automation" },
];

fs.mkdirSync(OUT_DIR, { recursive: true });

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "aiwb-cdp-"));
const edge = spawn(
  EDGE,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    APP_URL,
  ],
  { windowsHide: true, stdio: "ignore" },
);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const results = { views: [], tokens: {}, persistence: {}, overlay: {} };

async function waitForDevToolsPort() {
  const portFile = path.join(profile, "DevToolsActivePort");
  for (let i = 0; i < 60; i++) {
    if (fs.existsSync(portFile)) {
      const [port] = fs.readFileSync(portFile, "utf8").trim().split(/\r?\n/);
      return Number(port);
    }
    await delay(250);
  }
  throw new Error("Edge DevTools port file not created");
}

async function getPageTarget(port) {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((t) => t.type === "page" && t.url.includes("localhost:1420"));
      if (page) return page;
    } catch {}
    await delay(250);
  }
  throw new Error("page target not found");
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
  const result = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(`evaluate failed: ${result.exceptionDetails.text}`);
  }
  return result.result.value;
}

async function connect(port) {
  const target = await getPageTarget(port);
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error("CDP websocket error"));
  });
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject, timer } = pending.get(msg.id);
      clearTimeout(timer);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  };
  await send("Page.enable");
  await send("Runtime.enable");
}

async function waitForApp() {
  for (let i = 0; i < 80; i++) {
    const ready = await evaluate(`document.querySelectorAll('nav button[aria-label]').length >= 5`);
    if (ready) return;
    await delay(250);
  }
  throw new Error("app shell did not render 5 dock buttons");
}

async function setViewport(width, height) {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
}

async function capture(name) {
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const out = path.join(OUT_DIR, name);
  fs.writeFileSync(out, Buffer.from(shot.data, "base64"));
  return out;
}

async function clickDock(label) {
  const clicked = await evaluate(`(() => {
    const btn = [...document.querySelectorAll('nav button[aria-label]')]
      .find((b) => b.getAttribute('aria-label') === ${JSON.stringify(label)});
    if (!btn) return false;
    btn.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`dock button missing: ${label}`);
  await delay(450);
}

async function sampleTokens() {
  return evaluate(`(() => {
    const bodyBg = getComputedStyle(document.body).backgroundColor;
    const mainBg = getComputedStyle(document.querySelector('main')).backgroundColor;
    const cards = [...document.querySelectorAll('main section[class*="rounded-2xl"]')];
    const bad = cards.filter((el) => {
      const s = getComputedStyle(el);
      return s.backgroundColor === "rgb(0, 0, 0)" || s.borderTopColor === "rgb(0, 0, 0)";
    }).length;
    const okCards = cards.filter((el) => getComputedStyle(el).backgroundColor === "rgb(24, 24, 28)").length;
    return {
      bodyBg,
      mainBg,
      cardCount: cards.length,
      tokenOkCards: okCards,
      blackCards: bad,
    };
  })()`);
}

let port;

try {
  port = await waitForDevToolsPort();
  await connect(port);
  await setViewport(1440, 900);
  await waitForApp();

  for (const view of VIEWS) {
    await clickDock(view.label);
    const state = await evaluate(`(() => {
      const header = document.querySelector('header span')?.textContent || "";
      const main = document.querySelector('main');
      const headings = [...(main?.querySelectorAll('h2') ?? [])].slice(0, 4).map((h) => h.textContent);
      return { header, headings, bodyLength: main?.innerText.length ?? 0 };
    })()`);
    const shot = await capture(`sprint1-${view.id}.png`);
    const tokens = await sampleTokens();
    results.views.push({ id: view.id, label: view.label, state, shot, tokens });
  }

  await clickDock("Actions");
  const created = await evaluate(`(async () => {
    const input = document.querySelector('input[placeholder="New task..."]');
    if (!input) return { ok: false, reason: "no task input" };
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, "DoD persistence check");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 100));
    const add = [...document.querySelectorAll("main button")].find((b) => b.textContent.trim() === "Add");
    if (!add) return { ok: false, reason: "no add button" };
    add.click();
    await new Promise((r) => setTimeout(r, 400));
    const visible = document.body.innerText.includes("DoD persistence check");
    return { ok: true, visible };
  })()`);
  await delay(400);
  const beforeReload = await evaluate(`document.body.innerText.includes("DoD persistence check")`);
  await send("Page.reload", { ignoreCache: true });
  await waitForApp();
  await clickDock("Actions");
  const afterReload = await evaluate(`document.body.innerText.includes("DoD persistence check")`);
  results.persistence = { created, beforeReload, afterReload };

  results.overlay = await evaluate(`(() => ({
    viteOverlay: !!document.querySelector("vite-error-overlay, .vite-error-overlay, [class*='error-overlay']"),
    devIssuesText: document.body.innerText.includes("Dev Issues") || document.body.innerText.includes("Internal server error"),
  }))()`);

  await setViewport(390, 844);
  await clickDock("AI Studio");
  results.mobileShot = await capture("sprint1-mobile-ai-studio.png");

  console.log(JSON.stringify(results, null, 2));
} finally {
  try {
    if (ws && ws.readyState === WebSocket.OPEN) await send("Browser.close");
  } catch {}
  await delay(500);
  if (edge && !edge.killed) edge.kill();
  const resolved = path.resolve(profile);
  const tempRoot = path.resolve(os.tmpdir());
  if (resolved.startsWith(tempRoot) && fs.existsSync(resolved)) {
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}
