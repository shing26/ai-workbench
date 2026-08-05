import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const APP_URL = process.env.AIWB_APP_URL || "http://localhost:1420";
const OUT_DIR = "D:/ai-workbench/.screenshots";
const SHOT_PREFIX = process.env.AIWB_SHOT_PREFIX || "sprint1";
const APP_HOST = new URL(APP_URL).host;
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

function durationSeconds(value) {
  const parts = String(value || "").split(",").map((s) => s.trim());
  const nums = parts.map((part) => {
    if (part.endsWith("ms")) return Number(part.slice(0, -2)) / 1000;
    if (part.endsWith("s")) return Number(part.slice(0, -1));
    return 0;
  });
  return Math.max(0, ...nums);
}

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
      const page = list.find((t) => t.type === "page" && t.url.includes(APP_HOST));
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
    const details = result.exceptionDetails.exception?.description
      ?? result.exceptionDetails.exception?.value
      ?? JSON.stringify(result.exceptionDetails);
    throw new Error(`evaluate failed: ${details}`);
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
  let clicked = false;
  for (let attempt = 0; attempt < 10; attempt++) {
    clicked = await evaluate(`(() => {
      const btn = [...document.querySelectorAll('nav button[aria-label]')]
        .find((b) => b.getAttribute('aria-label') === ${JSON.stringify(label)});
      if (!btn) return false;
      btn.click();
      return true;
    })()`);
    if (clicked) break;
    await delay(150);
  }
  if (!clicked) throw new Error(`dock button missing: ${label}`);
  await delay(450);
}

async function clickDockFast(label) {
  let clicked = false;
  for (let attempt = 0; attempt < 10; attempt++) {
    clicked = await evaluate(`(() => {
      const btn = [...document.querySelectorAll('nav button[aria-label]')]
        .find((b) => b.getAttribute('aria-label') === ${JSON.stringify(label)});
      if (!btn) return false;
      btn.click();
      return true;
    })()`);
    if (clicked) break;
    await delay(150);
  }
  if (!clicked) throw new Error(`dock button missing: ${label}`);
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
    const shot = await capture(`${SHOT_PREFIX}-${view.id}.png`);
    const tokens = await sampleTokens();
    results.views.push({ id: view.id, label: view.label, state, shot, tokens });
  }

  results.motion = await evaluate(`(() => {
    const main = document.querySelector('main');
    const navBtn = document.querySelector('nav button');
    const viewEl = document.querySelector('.view-enter');
    return {
      ambientBackground: main ? getComputedStyle(main).backgroundImage : "",
      navTransitionDuration: navBtn ? getComputedStyle(navBtn).transitionDuration : "",
      viewAnimationDuration: viewEl ? getComputedStyle(viewEl).animationDuration : "",
      bodyOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  })()`);

  await clickDock("AI Studio");
  results.uiDynamics = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const click = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return false;
      el.click();
      return true;
    };
    const themeBtn = document.querySelector('button[aria-label="Theme and accent"]');
    if (!themeBtn) return { ok: false, reason: "theme button missing" };
    themeBtn.click();
    await sleep(120);
    if (!click('[data-theme-option="light"]')) return { ok: false, reason: "light option missing" };
    await sleep(120);
    const themeLight = document.documentElement.dataset.theme === "light";
    const storedLight = localStorage.getItem("ai-workbench:theme") === "light";
    if (!click('[data-accent-option="ocean"]')) return { ok: false, reason: "ocean swatch missing" };
    await sleep(120);
    const accentOcean = document.documentElement.dataset.accent === "ocean";
    const storedAccent = localStorage.getItem("ai-workbench:accent") === "ocean";
    const pressed = document.querySelector('[data-accent-option="ocean"]')?.getAttribute("aria-pressed") === "true";
    const accentVar = getComputedStyle(document.documentElement).getPropertyValue("--color-accent").trim();
    if (!click('[data-theme-option="system"]')) return { ok: false, reason: "system option missing" };
    await sleep(100);
    const systemPending = document.documentElement.dataset.theme === "system";
    const stage = document.querySelector(".conversation-stage");
    const composer = document.querySelector(".composer");
    return {
      ok: themeLight && storedLight && accentOcean && storedAccent && pressed && systemPending,
      themeLight,
      storedLight,
      accentOcean,
      storedAccent,
      pressed,
      accentVar,
      systemPending,
      stagePresent: !!stage,
      composerPresent: !!composer,
      composerTransition: composer ? getComputedStyle(composer).transitionDuration : "",
      stageStreamingOff: stage ? stage.dataset.streaming === "false" : false,
    };
  })()`);
  if (!results.uiDynamics.ok || !results.uiDynamics.stagePresent || !results.uiDynamics.composerPresent) {
    throw new Error(`UI theme/stage assertion failed: ${JSON.stringify(results.uiDynamics)}`);
  }

  results.uiDynamics.agentSelect = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 20; i++) {
      const select = document.querySelector('select[aria-label="Dispatch agent"]');
      if (select && select.options.length >= 12) {
        return { ok: true, options: select.options.length, selected: select.value };
      }
      await sleep(100);
    }
    const select = document.querySelector('select[aria-label="Dispatch agent"]');
    return { ok: false, options: select?.options.length ?? 0 };
  })()`);
  if (!results.uiDynamics.agentSelect.ok) {
    throw new Error(`AI Studio agent selector assertion failed: ${JSON.stringify(results.uiDynamics.agentSelect)}`);
  }

  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-color-scheme", value: "light" }],
  });
  await delay(200);
  const systemResolved = await evaluate(`document.documentElement.dataset.themeResolved === "light"`);
  await send("Emulation.setEmulatedMedia", { features: [] });
  const restored = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    document.querySelector('[data-theme-option="dark"]')?.click();
    await sleep(120);
    document.querySelector('[data-accent-option="emerald"]')?.click();
    await sleep(120);
    document.querySelector('button[aria-label="Theme and accent"]')?.click();
    await sleep(100);
    return document.documentElement.dataset.theme === "dark" && document.documentElement.dataset.accent === "emerald";
  })()`);
  if (!systemResolved || !restored) {
    throw new Error(`UI system theme assertion failed: systemResolved=${systemResolved} restored=${restored}`);
  }

  await clickDock("Knowledge");
  results.accentTokens = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let btn = null;
    for (let i = 0; i < 20; i++) {
      btn = document.querySelector('[data-accent-token="index-vault"]');
      if (btn) break;
      await sleep(100);
    }
    if (!btn) return { ok: false, reason: "no accent token element" };
    const themeBtn = document.querySelector('button[aria-label="Theme and accent"]');
    if (!themeBtn) return { ok: false, reason: "no theme button" };
    themeBtn.click();
    await sleep(100);
    const ocean = document.querySelector('[data-accent-option="ocean"]');
    if (!ocean) return { ok: false, reason: "no ocean swatch" };
    ocean.click();
    await sleep(150);
    const oceanColor = getComputedStyle(btn).color;
    const emerald = document.querySelector('[data-accent-option="emerald"]');
    if (!emerald) return { ok: false, reason: "no emerald swatch" };
    emerald.click();
    await sleep(150);
    const emeraldColor = getComputedStyle(btn).color;
    themeBtn.click();
    await sleep(80);
    const accentReset = document.documentElement.dataset.accent === "emerald";
    return { ok: oceanColor !== emeraldColor && accentReset, oceanColor, emeraldColor, accentReset };
  })()`);
  if (!results.accentTokens.ok) {
    throw new Error(`Accent token assertion failed: ${JSON.stringify(results.accentTokens)}`);
  }

  results.materialDrawer = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const setNativeValue = (el, value) => {
      const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
      el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
    };
    const openBtn = document.querySelector("[data-material-settings-open]");
    if (!openBtn) return { ok: false, reason: "material open button missing" };
    openBtn.click();
    let drawer = null;
    for (let i = 0; i < 20; i++) {
      drawer = document.querySelector("[data-material-drawer]");
      if (drawer?.classList.contains("open")) break;
      await sleep(100);
    }
    if (!drawer?.classList.contains("open")) return { ok: false, reason: "drawer not open" };
    const preset = document.querySelector("[data-material-preset]");
    const opacity = document.querySelector("[data-material-opacity]");
    const blur = document.querySelector("[data-material-blur]");
    if (!preset || !opacity || !blur) return { ok: false, reason: "material controls missing" };
    setNativeValue(preset, "rain");
    await sleep(120);
    setNativeValue(opacity, "0.55");
    await sleep(120);
    setNativeValue(blur, "30");
    await sleep(120);
    const root = document.documentElement;
    const card = document.querySelector(".material-card[data-material]");
    const computedOpacity = card ? getComputedStyle(card).getPropertyValue("--material-opacity").trim() : "";
    const computedBlur = card ? getComputedStyle(card).getPropertyValue("--material-blur").trim() : "";
    const stored = JSON.parse(localStorage.getItem("ai-workbench:material-settings:v1") ?? "{}");
    const applied = root.dataset.materialGlobal === "rain"
      && root.style.getPropertyValue("--material-opacity-base") === "0.55"
      && root.style.getPropertyValue("--material-blur-base") === "30px"
      && computedOpacity === "0.55"
      && computedBlur === "30px"
      && stored.preset === "rain"
      && stored.opacity === 0.55
      && stored.blur === 30;
    document.querySelector("[data-material-drawer-close]")?.click();
    await sleep(150);
    const closed = !document.querySelector("[data-material-drawer]")?.classList.contains("open");
    openBtn.click();
    await sleep(120);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await sleep(150);
    const escClosed = !document.querySelector("[data-material-drawer]")?.classList.contains("open");
    setNativeValue(preset, "cyan");
    setNativeValue(opacity, "0.3");
    setNativeValue(blur, "18");
    return {
      ok: applied && closed && escClosed,
      applied,
      closed,
      escClosed,
      computedOpacity,
      computedBlur,
      stored,
    };
  })()`);
  if (!results.materialDrawer.ok) {
    throw new Error(`Material drawer assertion failed: ${JSON.stringify(results.materialDrawer)}`);
  }

  await clickDock("Actions");
  results.uiDynamics.material = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const card = document.querySelector(".material-card[data-material]");
    if (!card) return { ok: false, reason: "no material card" };
    const presets = ["cyan", "original", "rain", "chrome"];
    const valid = presets.includes(card.dataset.material);
    const before = [card.offsetWidth, card.offsetHeight];
    card.classList.add("hovering");
    await sleep(180);
    const pseudo = getComputedStyle(card, "::before").animationDuration;
    const after = [card.offsetWidth, card.offsetHeight];
    card.classList.remove("hovering");
    const fixed = before[0] === after[0] && before[1] === after[1];
    const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    const transition = getComputedStyle(card).transitionDuration;
    return { ok: valid && fixed && overflow <= 1, valid, fixed, overflow, transition, pseudo };
  })()`);
  if (
    !results.uiDynamics.material.ok ||
    durationSeconds(results.uiDynamics.material.transition) > 0.16 ||
    durationSeconds(results.uiDynamics.material.pseudo) > 0.16 ||
    durationSeconds(results.uiDynamics.composerTransition) > 0.16
  ) {
    throw new Error(`UI material assertion failed: ${JSON.stringify(results.uiDynamics.material)}`);
  }

  await clickDock("AI Studio");
  results.quickPrompts = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const chips = [...document.querySelectorAll("[data-quick-prompt]")];
    const input = document.querySelector('textarea[placeholder="Ask anything..."]');
    if (chips.length < 4 || !input) {
      return { ok: false, chips: chips.length, hasInput: !!input };
    }
    const labels = chips.map((chip) => chip.getAttribute("data-quick-prompt-label"));
    const categories = chips.map((chip) => chip.getAttribute("data-quick-prompt-category"));
    document.querySelector('[data-quick-prompt="daily-recap"]')?.click();
    await sleep(80);
    const dailyValue = input.value;
    document.querySelector('[data-quick-prompt="week-plan"]')?.click();
    await sleep(80);
    const weekValue = input.value;
    const ok =
      dailyValue.includes("复盘") &&
      weekValue.includes("本周") &&
      categories.includes("life") &&
      categories.includes("work");
    return {
      ok,
      chips: chips.length,
      labels,
      dailyValue: dailyValue.slice(0, 60),
      weekValue: weekValue.slice(0, 60),
    };
  })()`);
  if (!results.quickPrompts.ok) {
    throw new Error(`Quick prompt assertion failed: ${JSON.stringify(results.quickPrompts)}`);
  }
  results.quickPromptManager = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    document.querySelector("[data-quick-prompt-manage]")?.click();
    await sleep(80);
    const manager = document.querySelector("[data-quick-prompt-manager]");
    if (!manager) return { ok: false, reason: "manager panel missing" };
    const name = document.querySelector("[data-quick-prompt-name]");
    const text = document.querySelector("[data-quick-prompt-text]");
    const category = document.querySelector("[data-quick-prompt-category]");
    if (!name || !text || !category) return { ok: false, reason: "manager inputs missing" };
    const setInput = (el, value) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    setInput(name, "Review day");
    setInput(text, "帮我复盘今天，并给明天定 3 件优先事。");
    await sleep(60);
    document.querySelector("[data-quick-prompt-add]")?.click();
    await sleep(120);
    const chip = [...document.querySelectorAll("[data-quick-prompt]")].find(
      (el) => el.getAttribute("data-quick-prompt-label") === "Review day",
    );
    const stored = JSON.parse(localStorage.getItem("ai-workbench:quick-prompts:v1") ?? "[]");
    const storedOk = Array.isArray(stored) && stored.some((p) => p.label === "Review day" && p.category === "work");
    if (!chip) return { ok: false, reason: "custom chip missing", stored };
    const chipCategory = chip.getAttribute("data-quick-prompt-category");
    chip.click();
    await sleep(80);
    const input = document.querySelector('textarea[placeholder="Ask anything..."]');
    const filled = input ? input.value.includes("复盘今天") : false;
    return { ok: storedOk && filled && chipCategory === "work", stored, filled, chipCategory };
  })()`);
  if (!results.quickPromptManager.ok) {
    throw new Error(`Quick prompt manager assertion failed: ${JSON.stringify(results.quickPromptManager)}`);
  }
  await send("Page.reload", { ignoreCache: true });
  await waitForApp();
  await clickDockFast("AI Studio");
  results.quickPromptPersist = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const persisted = [...document.querySelectorAll("[data-quick-prompt]")].some(
      (el) => el.getAttribute("data-quick-prompt-label") === "Review day",
    );
    document.querySelector("[data-quick-prompt-manage]")?.click();
    await sleep(80);
    const deleteBtn = [...document.querySelectorAll("[data-quick-prompt-custom-delete]")].find(
      (btn) => btn.parentElement?.textContent?.includes("Review day"),
    );
    if (!deleteBtn) return { ok: false, reason: "delete button missing", persisted };
    deleteBtn.click();
    await sleep(120);
    const gone = ![...document.querySelectorAll("[data-quick-prompt]")].some(
      (el) => el.getAttribute("data-quick-prompt-label") === "Review day",
    );
    const stored = JSON.parse(localStorage.getItem("ai-workbench:quick-prompts:v1") ?? "[]");
    const storedGone = !stored.some((p) => p.label === "Review day");
    return { ok: persisted && gone && storedGone, persisted, gone, storedGone };
  })()`);
  if (!results.quickPromptPersist.ok) {
    throw new Error(`Quick prompt persistence assertion failed: ${JSON.stringify(results.quickPromptPersist)}`);
  }
  await evaluate(`(async () => {
    localStorage.removeItem("ai-workbench:quick-prompt-usage:v1");
    return { ok: true };
  })()`);
  await send("Page.reload", { ignoreCache: true });
  await waitForApp();
  await clickDockFast("AI Studio");
  results.quickPromptUsage = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const chips = () => [...document.querySelectorAll("[data-quick-prompt]")];
    const firstLabel = () => chips()[0]?.getAttribute("data-quick-prompt-label") ?? "";
    const first = firstLabel();
    document.querySelector('[data-quick-prompt="daily-recap"]')?.click();
    await sleep(80);
    document.querySelector('[data-quick-prompt="daily-recap"]')?.click();
    await sleep(80);
    const afterTwo = firstLabel();
    const dailyUsage = chips()
      .find((el) => el.getAttribute("data-quick-prompt") === "daily-recap")
      ?.getAttribute("data-quick-prompt-usage");
    document.querySelector('[data-quick-prompt="wind-down"]')?.click();
    await sleep(80);
    document.querySelector('[data-quick-prompt="wind-down"]')?.click();
    await sleep(80);
    document.querySelector('[data-quick-prompt="wind-down"]')?.click();
    await sleep(80);
    const afterWindDown = firstLabel();
    const order = chips().map((el) => el.getAttribute("data-quick-prompt"));
    const stored = JSON.parse(localStorage.getItem("ai-workbench:quick-prompt-usage:v1") ?? "{}");
    const ok =
      first === "Daily recap" &&
      afterTwo === "Daily recap" &&
      dailyUsage === "2" &&
      afterWindDown === "Wind down" &&
      order[0] === "wind-down" &&
      order[1] === "daily-recap" &&
      stored["daily-recap"] === 2 &&
      stored["wind-down"] === 3;
    return {
      ok,
      first,
      afterTwo,
      dailyUsage,
      afterWindDown,
      order: order.slice(0, 4),
      stored,
    };
  })()`);
  if (!results.quickPromptUsage.ok) {
    throw new Error(`Quick prompt usage assertion failed: ${JSON.stringify(results.quickPromptUsage)}`);
  }
  await send("Page.reload", { ignoreCache: true });
  await waitForApp();
  await clickDockFast("AI Studio");
  results.quickPromptUsagePersist = await evaluate(`(async () => {
    const chips = () => [...document.querySelectorAll("[data-quick-prompt]")];
    const order = chips().map((el) => el.getAttribute("data-quick-prompt"));
    const stored = JSON.parse(localStorage.getItem("ai-workbench:quick-prompt-usage:v1") ?? "{}");
    const ok =
      order[0] === "wind-down" &&
      order[1] === "daily-recap" &&
      stored["wind-down"] === 3 &&
      stored["daily-recap"] === 2;
    return { ok, order: order.slice(0, 4), stored };
  })()`);
  if (!results.quickPromptUsagePersist.ok) {
    throw new Error(
      `Quick prompt usage persistence assertion failed: ${JSON.stringify(results.quickPromptUsagePersist)}`,
    );
  }

  await clickDock("System");
  results.quickPromptSync = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const remote = {
      deviceId: "device-sync-quick",
      exportedAt: Date.now() + 1000,
      clipboard: [],
      logs: [],
      quickPrompts: [
        {
          id: "sync-quick-custom",
          label: "Sync quick",
          category: "work",
          text: "sprint 87 sync quick prompt",
          custom: true,
          updatedAt: Date.now() + 1000,
          createdAt: Date.now() + 1000,
        },
      ],
      quickPromptUsage: [
        { id: "sync-quick-custom", count: 2, updatedAt: Date.now() + 1000 },
        { id: "daily-recap", count: 5, updatedAt: Date.now() + 1000 },
      ],
    };
    localStorage.setItem("ai-workbench:sync-snapshot:v1", JSON.stringify(remote));
    document.querySelector('button[aria-label="Import sync snapshot"]')?.click();
    let imported = false;
    for (let i = 0; i < 20; i++) {
      const stored = JSON.parse(localStorage.getItem("ai-workbench:quick-prompts:v1") ?? "[]");
      const usage = JSON.parse(localStorage.getItem("ai-workbench:quick-prompt-usage:v1") ?? "{}");
      imported =
        stored.some((p) => p.id === "sync-quick-custom") &&
        usage["sync-quick-custom"] === 2 &&
        usage["daily-recap"] === 5;
      if (imported) break;
      await sleep(100);
    }
    return { ok: imported, imported };
  })()`);
  if (!results.quickPromptSync.ok) {
    throw new Error(`Quick prompt sync merge assertion failed: ${JSON.stringify(results.quickPromptSync)}`);
  }
  await clickDock("AI Studio");
  results.quickPromptSyncVisible = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let chips = [];
    for (let i = 0; i < 20; i++) {
      chips = [...document.querySelectorAll("[data-quick-prompt]")];
      if (chips.some((el) => el.getAttribute("data-quick-prompt") === "sync-quick-custom")) break;
      await sleep(100);
    }
    const order = chips.map((el) => el.getAttribute("data-quick-prompt"));
    const syncChip = chips.find((el) => el.getAttribute("data-quick-prompt") === "sync-quick-custom");
    const dailyChip = chips.find((el) => el.getAttribute("data-quick-prompt") === "daily-recap");
    const ok =
      !!syncChip &&
      order[0] === "daily-recap" &&
      dailyChip?.getAttribute("data-quick-prompt-usage") === "5" &&
      syncChip.getAttribute("data-quick-prompt-usage") === "2";
    return {
      ok,
      order: order.slice(0, 5),
      dailyUsage: dailyChip?.getAttribute("data-quick-prompt-usage") ?? "",
      syncUsage: syncChip?.getAttribute("data-quick-prompt-usage") ?? "",
    };
  })()`);
  if (!results.quickPromptSyncVisible.ok) {
    throw new Error(
      `Quick prompt sync visibility assertion failed: ${JSON.stringify(results.quickPromptSyncVisible)}`,
    );
  }
  await send("Page.reload", { ignoreCache: true });
  await waitForApp();
  await clickDockFast("AI Studio");
  results.quickPromptSyncPersist = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let chips = [];
    for (let i = 0; i < 20; i++) {
      chips = [...document.querySelectorAll("[data-quick-prompt]")];
      if (chips.some((el) => el.getAttribute("data-quick-prompt") === "sync-quick-custom")) break;
      await sleep(100);
    }
    const stored = JSON.parse(localStorage.getItem("ai-workbench:quick-prompts:v1") ?? "[]");
    const usage = JSON.parse(localStorage.getItem("ai-workbench:quick-prompt-usage:v1") ?? "{}");
    const ok =
      chips.some((el) => el.getAttribute("data-quick-prompt") === "sync-quick-custom") &&
      stored.some((p) => p.id === "sync-quick-custom") &&
      usage["sync-quick-custom"] === 2 &&
      usage["daily-recap"] === 5;
    return { ok, stored, usage };
  })()`);
  if (!results.quickPromptSyncPersist.ok) {
    throw new Error(
      `Quick prompt sync persistence assertion failed: ${JSON.stringify(results.quickPromptSyncPersist)}`,
    );
  }

  results.quickPromptEditSort = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const setInput = (el, value) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    document.querySelector("[data-quick-prompt-manage]")?.click();
    await sleep(100);
    const addPrompt = async (label, text) => {
      const name = document.querySelector("[data-quick-prompt-name]");
      const promptText = document.querySelector("[data-quick-prompt-text]");
      if (!name || !promptText) return false;
      setInput(name, label);
      setInput(promptText, text);
      await sleep(60);
      document.querySelector("[data-quick-prompt-add]")?.click();
      await sleep(160);
      return !![...document.querySelectorAll("[data-quick-prompt-custom-row]")].some(
        (row) => row.textContent?.includes(label),
      );
    };
    const alphaAdded = await addPrompt("Alpha", "alpha text");
    const betaAdded = await addPrompt("Beta", "beta text");
    if (!alphaAdded || !betaAdded) {
      return { ok: false, reason: "custom prompts not added", alphaAdded, betaAdded };
    }
    const rows = () => [...document.querySelectorAll("[data-quick-prompt-custom-row]")];
    const alphaRow = rows().find((row) => row.textContent?.includes("Alpha"));
    const editBtn = alphaRow?.querySelector("[data-quick-prompt-custom-edit]");
    if (!editBtn) return { ok: false, reason: "edit button missing" };
    const before = JSON.parse(localStorage.getItem("ai-workbench:quick-prompts:v1") ?? "[]");
    const beforeAlpha = before.find((p) => p.label === "Alpha");
    editBtn.click();
    await sleep(100);
    const name = document.querySelector("[data-quick-prompt-name]");
    const promptText = document.querySelector("[data-quick-prompt-text]");
    const prefilled = name?.value === "Alpha" && promptText?.value === "alpha text";
    setInput(name, "Alpha edited");
    setInput(promptText, "edited text");
    await sleep(60);
    document.querySelector("[data-quick-prompt-save]")?.click();
    await sleep(200);
    const chipVisible = [...document.querySelectorAll("[data-quick-prompt]")].some(
      (el) => el.getAttribute("data-quick-prompt-label") === "Alpha edited",
    );
    const after = JSON.parse(localStorage.getItem("ai-workbench:quick-prompts:v1") ?? "[]");
    const afterAlpha = after.find((p) => p.label === "Alpha edited");
    const editedOk =
      prefilled &&
      chipVisible &&
      !!afterAlpha &&
      afterAlpha.text === "edited text" &&
      (afterAlpha.updatedAt ?? 0) >= (beforeAlpha?.updatedAt ?? 0);
    const alphaId = afterAlpha?.id;
    const betaId = after.find((p) => p.label === "Beta")?.id;
    const alphaRowAfter = rows().find((row) => row.textContent?.includes("Alpha edited"));
    alphaRowAfter?.querySelector("[data-quick-prompt-custom-move-down]")?.click();
    await sleep(200);
    const reorderedRows = rows();
    const rowIds = reorderedRows.map((row) => row.getAttribute("data-quick-prompt-custom-row"));
    const storedOrder = JSON.parse(localStorage.getItem("ai-workbench:quick-prompts:v1") ?? "[]");
    const alphaOrder = storedOrder.find((p) => p.id === alphaId)?.order;
    const betaOrder = storedOrder.find((p) => p.id === betaId)?.order;
    const alphaIndex = rowIds.indexOf(alphaId);
    const betaIndex = rowIds.indexOf(betaId);
    const sortedOk =
      alphaIndex > betaIndex &&
      alphaOrder > betaOrder &&
      storedOrder.filter((p) => p.custom === true).every((p, index) => p.order === index);
    return {
      ok: editedOk && sortedOk,
      editedOk,
      sortedOk,
      prefilled,
      chipVisible,
      rowIds,
      alphaOrder,
      betaOrder,
      stored: storedOrder.map((p) => ({ label: p.label, order: p.order })),
    };
  })()`);
  if (!results.quickPromptEditSort.ok) {
    throw new Error(
      `Quick prompt edit/sort assertion failed: ${JSON.stringify(results.quickPromptEditSort)}`,
    );
  }
  await send("Page.reload", { ignoreCache: true });
  await waitForApp();
  await clickDockFast("AI Studio");
  results.quickPromptEditSortPersist = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let chips = [];
    for (let i = 0; i < 20; i++) {
      chips = [...document.querySelectorAll("[data-quick-prompt]")];
      if (chips.some((el) => el.getAttribute("data-quick-prompt-label") === "Alpha edited")) break;
      await sleep(100);
    }
    const stored = JSON.parse(localStorage.getItem("ai-workbench:quick-prompts:v1") ?? "[]");
    const alpha = stored.find((p) => p.label === "Alpha edited");
    const beta = stored.find((p) => p.label === "Beta");
    const ok =
      chips.some((el) => el.getAttribute("data-quick-prompt-label") === "Alpha edited") &&
      !!alpha &&
      alpha.text === "edited text" &&
      alpha.order > (beta?.order ?? -1);
    return { ok, stored: stored.map((p) => ({ label: p.label, order: p.order, text: p.text })) };
  })()`);
  if (!results.quickPromptEditSortPersist.ok) {
    throw new Error(
      `Quick prompt edit/sort persistence assertion failed: ${JSON.stringify(results.quickPromptEditSortPersist)}`,
    );
  }

  results.aiDailyRecap = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const btn = document.querySelector("[data-ai-daily-recap]");
    if (!btn) return { ok: false, reason: "no recap button" };
    btn.click();
    let userText = "";
    for (let i = 0; i < 20; i++) {
      const bubbles = [...document.querySelectorAll(".message-in")].map((n) => n.textContent ?? "");
      userText = bubbles.find((t) => t.includes("请帮我生成今日复盘")) ?? "";
      if (userText) break;
      await sleep(80);
    }
    if (!userText) return { ok: false, reason: "recap user message missing" };
    let reply = "";
    for (let i = 0; i < 60; i++) {
      const bubbles = [...document.querySelectorAll(".message-in")].map((n) => n.textContent ?? "");
      reply =
        bubbles.find((t) => t.includes("Streaming fallback") && !t.includes("请帮我生成今日复盘")) ??
        "";
      if (reply) break;
      await sleep(100);
    }
    let idle = false;
    for (let i = 0; i < 40; i++) {
      if (
        !document.querySelector(".stream-caret") &&
        !document.querySelector(".thinking-dot") &&
        !document.querySelector('[data-streaming="true"]')
      ) {
        idle = true;
        break;
      }
      await sleep(100);
    }
    const newChatBtn = [...document.querySelectorAll("main button")].find(
      (b) => b.textContent?.trim() === "New chat",
    );
    newChatBtn?.click();
    await sleep(200);
    const ok =
      userText.includes("Ship App Shell") &&
      userText.includes("晨间阅读") &&
      userText.includes("每日复盘") &&
      userText.includes("Overall") &&
      reply.length > 0 &&
      idle &&
      !!newChatBtn;
    return {
      ok,
      hasFocus: userText.includes("Ship App Shell"),
      hasHabit: userText.includes("晨间阅读"),
      hasEvent: userText.includes("每日复盘"),
      hasOverall: userText.includes("Overall"),
      replySeen: !!reply,
      idle,
      freshStarted: !!newChatBtn,
      userPreview: userText.slice(0, 90),
      replyPreview: reply.slice(0, 60),
    };
  })()`);
  if (!results.aiDailyRecap.ok) {
    throw new Error(`AI daily recap assertion failed: ${JSON.stringify(results.aiDailyRecap)}`);
  }
  results.aiRecapSave = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const btn = document.querySelector("[data-ai-daily-recap]");
    if (!btn) return { ok: false, reason: "no recap button" };
    const recapPrompt = "请帮我生成今日复盘";
    const userBefore = [...document.querySelectorAll(".message-in")].filter(
      (n) => (n.textContent ?? "").includes(recapPrompt),
    ).length;
    btn.click();
    let userAdded = false;
    for (let i = 0; i < 20; i++) {
      const count = [...document.querySelectorAll(".message-in")].filter(
        (n) => (n.textContent ?? "").includes(recapPrompt),
      ).length;
      if (count > userBefore) {
        userAdded = true;
        break;
      }
      await sleep(100);
    }
    let reply = "";
    for (let i = 0; i < 60; i++) {
      const bubbles = [...document.querySelectorAll(".message-in")].map((n) => n.textContent ?? "");
      reply = [...bubbles]
        .reverse()
        .find((t) => t.includes("Streaming fallback") && !t.includes(recapPrompt)) ?? "";
      if (reply) break;
      await sleep(100);
    }
    if (!reply) return { ok: false, reason: "recap reply missing" };
    let idle = false;
    for (let i = 0; i < 40; i++) {
      if (
        !document.querySelector(".stream-caret") &&
        !document.querySelector(".thinking-dot") &&
        !document.querySelector('[data-streaming="true"]')
      ) {
        idle = true;
        break;
      }
      await sleep(100);
    }
    const saveBtn = document.querySelector("[data-ai-recap-save]");
    if (!saveBtn) return { ok: false, reason: "no save button" };
    let enabled = false;
    for (let i = 0; i < 40; i++) {
      if (!saveBtn.disabled) {
        enabled = true;
        break;
      }
      await sleep(100);
    }
    if (!enabled) return { ok: false, reason: "save button disabled", idle, userAdded };
    if (!userAdded) return { ok: false, reason: "recap user message not added", idle };
    saveBtn.click();
    let result = "";
    for (let i = 0; i < 30; i++) {
      result = document.querySelector("[data-ai-recap-save-result]")?.textContent ?? "";
      if (result.includes("Saved")) break;
      await sleep(100);
    }
    const stored = JSON.parse(localStorage.getItem("ai-workbench:db:v1") ?? "{}");
    const saved = (stored.thoughts ?? []).find((t) => (t.content ?? "").includes("# 今日复盘"));
    const ok =
      result.includes("Saved") &&
      !!saved &&
      saved.tags === "#daily,#recap" &&
      saved.type === "note";
    return {
      ok,
      idle,
      userAdded,
      result,
      savedTags: saved?.tags,
      savedType: saved?.type,
      replyPreview: reply.slice(0, 60),
    };
  })()`);
  if (!results.aiRecapSave.ok) {
    throw new Error(`AI recap save assertion failed: ${JSON.stringify(results.aiRecapSave)}`);
  }
  await clickDock("Knowledge");
  results.aiRecapKnowledgeVisible = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 20; i++) {
      const body = document.body.innerText;
      if (body.includes("# 今日复盘") || body.includes("今日复盘")) {
        return { ok: true, visible: true };
      }
      await sleep(100);
    }
    return { ok: false, visible: false, body: document.body.innerText.slice(0, 200) };
  })()`);
  if (!results.aiRecapKnowledgeVisible.ok) {
    throw new Error(
      `AI recap knowledge visibility assertion failed: ${JSON.stringify(results.aiRecapKnowledgeVisible)}`,
    );
  }
  await clickDock("AI Studio");
  await evaluate(`[...document.querySelectorAll("main button")].find((b) => b.textContent?.trim() === "New chat")?.click();`);
  await delay(200);
  const streamStarted = await evaluate(`(async () => {
    const input = document.querySelector('textarea[placeholder="Ask anything..."]');
    if (!input) return { ok: false, reason: "no chat input" };
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    setter.call(input, "sprint RAG check");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 120));
    const send = document.querySelector('main button[aria-label="Send"]');
    if (!send) return { ok: false, reason: "no send button" };
    send.click();
    let earlyCaret = false;
    for (let i = 0; i < 12; i++) {
      if (document.querySelector(".stream-caret") || document.querySelector(".thinking-dot")) {
        earlyCaret = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 30));
    }
    await new Promise((r) => setTimeout(r, 900));
    const bodyText = document.body.innerText;
    let ragBadge = "";
    let inspectorText = "";
    for (let i = 0; i < 20; i++) {
      ragBadge = document.querySelector(".rag-badge")?.textContent?.trim() ?? "";
      inspectorText = document.querySelector("aside.drawer-panel")?.innerText ?? "";
      if (ragBadge.includes("RAG +") && inspectorText.toLowerCase().includes("rag context")) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    return {
      ok: true,
      earlyCaret,
      replyVisible: bodyText.includes("Streaming fallback") || bodyText.includes("分块模拟"),
      streamingCaretGone: !document.querySelector(".stream-caret"),
      busyGone: !document.querySelector(".thinking-dot"),
      ragBadge,
      inspectorText,
    };
  })()`);
  if (!streamStarted.ok || !streamStarted.earlyCaret || !streamStarted.replyVisible) {
    throw new Error("AI Studio streaming assertion failed");
  }
  if (!streamStarted.ragBadge.includes("RAG +") || !streamStarted.inspectorText.toLowerCase().includes("rag context")) {
    throw new Error(
      `AI Studio RAG injection assertion failed: badge=${JSON.stringify(streamStarted.ragBadge)} inspector=${JSON.stringify(streamStarted.inspectorText.slice(0, 160))}`,
    );
  }
  if (
    !streamStarted.inspectorText.toLowerCase().includes("department") ||
    !streamStarted.inspectorText.includes("UI Designer") ||
    !streamStarted.inspectorText.includes("设计部")
  ) {
    throw new Error(
      `AI Studio agent trace assertion failed: ${JSON.stringify(streamStarted.inspectorText.slice(0, 220))}`,
    );
  }
  results.streaming = streamStarted;
  await evaluate(`document.querySelector('aside button[aria-label="Close inspector"]')?.click()`);
  await delay(250);

  const ragConfirmSend = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    [...document.querySelectorAll("main button")].find((b) => b.textContent?.trim() === "New chat")?.click();
    await sleep(200);
    const modeToggle = document.querySelector("[data-rag-confirm-mode]");
    const input = document.querySelector('textarea[placeholder="Ask anything..."]');
    if (!modeToggle || !input) return { ok: false, reason: "rag confirm controls missing" };
    if (modeToggle.getAttribute("aria-checked") !== "true") modeToggle.click();
    await sleep(120);
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    setter.call(input, "sprint rag confirm");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await sleep(120);
    const send = document.querySelector('main button[aria-label="Send"]');
    send.click();
    let panel = null;
    let hitRows = 0;
    for (let i = 0; i < 20; i++) {
      panel = document.querySelector("[data-rag-confirm-panel]");
      hitRows = panel ? panel.querySelectorAll("[data-rag-confirm-hit]").length : 0;
      if (panel && hitRows > 0) break;
      await sleep(100);
    }
    if (!panel || hitRows === 0) {
      return { ok: false, reason: "confirm panel not shown", hitRows };
    }
    panel.querySelector("[data-rag-confirm-hit]")?.click();
    await sleep(120);
    const sendBtn = panel.querySelector("[data-rag-confirm-send]");
    const expected = hitRows - 1;
    const countOk = (sendBtn?.textContent ?? "").includes(String(expected));
    sendBtn.click();
    let badge = "";
    let replySeen = false;
    for (let i = 0; i < 20; i++) {
      badge = document.querySelector(".rag-badge")?.textContent?.trim() ?? "";
      replySeen =
        document.body.innerText.includes("Streaming fallback") ||
        document.body.innerText.includes("分块模拟");
      if (badge.includes("RAG +" + expected) && replySeen) break;
      await sleep(150);
    }
    const badgeOk = badge.includes("RAG +" + expected);
    for (let i = 0; i < 20; i++) {
      if (document.querySelector('main button[aria-label="Send"]')) break;
      await sleep(100);
    }
    modeToggle.click();
    await sleep(100);
    setter.call(input, "sprint rag direct");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await sleep(120);
    const send2 = document.querySelector('main button[aria-label="Send"]');
    send2.click();
    let directOk = true;
    let inputCleared = false;
    for (let i = 0; i < 12; i++) {
      if (document.querySelector("[data-rag-confirm-panel]")) {
        directOk = false;
        break;
      }
      if (!input.value) inputCleared = true;
      await sleep(100);
    }
    return {
      ok: countOk && badgeOk && replySeen && directOk && inputCleared,
      hitRows,
      expected,
      countOk,
      badgeOk,
      replySeen,
      directOk,
      inputCleared,
    };
  })()`);
  if (!ragConfirmSend.ok) {
    throw new Error(
      `RAG confirm send assertion failed: ${JSON.stringify(ragConfirmSend)}`,
    );
  }
  results.ragConfirmSend = ragConfirmSend;

  const streamStop = await evaluate(`(async () => {
    const input = document.querySelector('textarea[placeholder="Ask anything..."]');
    if (!input) return { ok: false, reason: "no chat input" };
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    setter.call(input, "stop check");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 80));
    const send = document.querySelector('main button[aria-label="Send"]');
    if (!send) return { ok: false, reason: "no send button" };
    send.click();
    let caretSeen = false;
    for (let i = 0; i < 12; i++) {
      if (document.querySelector(".stream-caret") || document.querySelector(".thinking-dot")) {
        caretSeen = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 30));
    }
    if (!caretSeen) return { ok: false, reason: "no caret before stop" };
    const stopBtn = document.querySelector('main button[aria-label="Stop streaming"]');
    if (!stopBtn) return { ok: false, reason: "no stop button" };
    stopBtn.click();
    await new Promise((r) => setTimeout(r, 250));
    const stoppedMessage = () => {
      const el = [...document.querySelectorAll(".message-in")].find((n) => n.textContent.includes("[stopped]"));
      return el ? el.textContent : "";
    };
    const beforeWait = stoppedMessage();
    const busyGone = !document.querySelector(".stream-caret") && !document.querySelector(".thinking-dot");
    await new Promise((r) => setTimeout(r, 500));
    const afterWait = stoppedMessage();
    return {
      ok: true,
      caretSeen,
      stopped: beforeWait.endsWith("[stopped]"),
      stable: beforeWait.length > 0 && beforeWait === afterWait,
      busyGone,
    };
  })()`);
  if (!streamStop.ok || !streamStop.stopped || !streamStop.stable || !streamStop.busyGone) {
    throw new Error(`AI Studio stream stop assertion failed: ${JSON.stringify(streamStop)}`);
  }
  results.streamStop = streamStop;

  results.teamDispatch = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const teamBtn = [...document.querySelectorAll("main button")].find((b) => b.textContent.trim() === "Team");
    if (!teamBtn) return { ok: false, reason: "no team mode button" };
    teamBtn.click();
    await sleep(120);
    const deptSelect = document.querySelector('select[aria-label="Dispatch department"]');
    if (!deptSelect) return { ok: false, reason: "no department select" };
    const designOption = [...deptSelect.options].find((o) => o.textContent.includes("设计部"));
    if (designOption) {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
      setter.call(deptSelect, designOption.value);
      deptSelect.dispatchEvent(new Event("change", { bubbles: true }));
    }
    await sleep(120);
    const input = document.querySelector('textarea[placeholder="Ask anything..."]');
    if (!input) return { ok: false, reason: "no chat input" };
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    setter.call(input, "team dispatch check");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await sleep(80);
    const send = document.querySelector('main button[aria-label="Send"]');
    if (!send) return { ok: false, reason: "no send button" };
    send.click();
    let busySeen = false;
    for (let i = 0; i < 12; i++) {
      if (document.querySelector(".thinking-dot")) {
        busySeen = true;
        break;
      }
      await sleep(30);
    }
    let inspectorText = "";
    for (let i = 0; i < 60; i++) {
      const bubbles = [...document.querySelectorAll(".message-in")].map((n) => n.textContent ?? "");
      inspectorText = document.querySelector("aside.drawer-panel")?.innerText ?? "";
      const summaryBubble = document.querySelector(".team-summary");
      const allThree =
        bubbles.some((t) => t.includes("UI Designer")) &&
        bubbles.some((t) => t.includes("Frontend Developer")) &&
        bubbles.some((t) => t.includes("UI Finish-Gate Reviewer"));
      if (
        allThree &&
        summaryBubble &&
        !document.querySelector(".thinking-dot") &&
        inspectorText.toLowerCase().includes("team trace")
      ) {
        break;
      }
      await sleep(120);
    }
    const bubbles = [...document.querySelectorAll(".message-in")].map((n) => n.textContent ?? "");
    const summaryBubble = document.querySelector(".team-summary");
    return {
      ok: true,
      busySeen,
      busyGone: !document.querySelector(".thinking-dot"),
      designBubbles: bubbles.filter(
        (t) => t.includes("UI Designer") || t.includes("Frontend Developer") || t.includes("UI Finish-Gate Reviewer"),
      ).length,
      teamVisible: inspectorText.toLowerCase().includes("team trace"),
      hasAgents: inspectorText.includes("UI Designer") && inspectorText.includes("Frontend Developer"),
      summaryOk:
        !!summaryBubble &&
        summaryBubble.textContent.includes("Team Summary") &&
        summaryBubble.textContent.split(/\\n/).length >= 2,
      inspectorText: inspectorText.slice(0, 160),
    };
  })()`);
  if (
    !results.teamDispatch.ok ||
    !results.teamDispatch.busySeen ||
    !results.teamDispatch.busyGone ||
    results.teamDispatch.designBubbles < 3 ||
    !results.teamDispatch.teamVisible ||
    !results.teamDispatch.hasAgents ||
    !results.teamDispatch.summaryOk
  ) {
    throw new Error(`AI Studio team dispatch assertion failed: ${JSON.stringify(results.teamDispatch)}`);
  }
  await evaluate(`document.querySelector('aside button[aria-label="Close inspector"]')?.click(); [...document.querySelectorAll("main button")].find((b) => b.textContent.trim() === "Single")?.click();`);
  await delay(250);

  await clickDock("Projects");
  results.projectCarousel = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let carousel = null;
    for (let i = 0; i < 20; i++) {
      carousel = document.querySelector("[data-project-carousel]");
      if (carousel) break;
      await sleep(100);
    }
    if (!carousel) return { ok: false, reason: "project carousel missing" };
    const scene = document.querySelector("[data-carousel-scene]");
    const cards = [...document.querySelectorAll("[data-carousel-card]")];
    if (!scene || cards.length < 2) {
      return { ok: false, reason: "carousel cards missing", cards: cards.length };
    }
    const firstSelected = cards.find((c) => c.getAttribute("data-carousel-selected") === "true")?.getAttribute("data-carousel-project");
    document.querySelector("[data-carousel-next]")?.click();
    await sleep(200);
    const afterNext = document.querySelector("[data-carousel-index]")?.textContent ?? "";
    const secondSelected = cards.find((c) => c.getAttribute("data-carousel-selected") === "true")?.getAttribute("data-carousel-project");
    const orbitOk = afterNext.includes("2 /") && firstSelected !== secondSelected;
    document.querySelector('[data-carousel-mode="fan"]')?.click();
    await sleep(200);
    const fanMode = scene.getAttribute("data-carousel-scene-mode") === "fan";
    const fanPressed = document.querySelector('[data-carousel-mode="fan"]')?.getAttribute("aria-pressed") === "true";
    const playBtn = document.querySelector("[data-carousel-play]");
    playBtn?.click();
    await sleep(120);
    const playing = playBtn?.getAttribute("aria-pressed") === "true"
      && playBtn?.getAttribute("data-carousel-playing") === "true";
    playBtn?.click();
    await sleep(120);
    const paused = playBtn?.getAttribute("data-carousel-playing") === "false";
    const ok = orbitOk && fanMode && fanPressed && playing && paused;
    return {
      ok,
      cards: cards.length,
      firstSelected,
      secondSelected,
      afterNext,
      fanMode,
      fanPressed,
      playing,
      paused,
    };
  })()`);
  if (!results.projectCarousel.ok) {
    throw new Error(`Project carousel assertion failed: ${JSON.stringify(results.projectCarousel)}`);
  }
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  await delay(200);
  results.projectCarouselReduced = await evaluate(`(() => {
    const card = document.querySelector("[data-carousel-card]");
    const playBtn = document.querySelector("[data-carousel-play]");
    const transition = card ? getComputedStyle(card).transitionDuration : "";
    const playState = playBtn?.getAttribute("aria-pressed") ?? "";
    return { transition, playState };
  })()`);
  await send("Emulation.setEmulatedMedia", { features: [] });
  results.projectCarouselReduced.ok =
    durationSeconds(results.projectCarouselReduced.transition) <= 0.02 &&
    results.projectCarouselReduced.playState === "false";
  if (!results.projectCarouselReduced.ok) {
    throw new Error(
      `Project carousel reduced motion assertion failed: ${JSON.stringify(results.projectCarouselReduced)}`,
    );
  }

  const gitGraph = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 20; i++) {
      const graph = document.querySelector(".project-git-graph");
      if (graph?.textContent?.includes("develop") && graph.textContent.includes("21 commits")) {
        return {
          ok: true,
          branch: graph.textContent.includes("develop"),
          commits: graph.textContent.includes("21 commits"),
          latest: graph.textContent.includes("sprint-20"),
          changes: graph.textContent.includes("ProjectsView.tsx"),
        };
      }
      await sleep(100);
    }
    return { ok: false, text: document.body.innerText.slice(0, 300) };
  })()`);
  if (!gitGraph.ok) {
    throw new Error(`project git graph assertion failed: ${JSON.stringify(gitGraph)}`);
  }
  results.gitGraph = gitGraph;
  const gitActivity = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const board = () => document.querySelector("[data-git-activity]");
    for (let i = 0; i < 20; i++) {
      const projects = board()?.querySelectorAll("[data-git-activity-project]") ?? [];
      if (projects.length >= 2) break;
      await sleep(100);
    }
    const projects = [...document.querySelectorAll("[data-git-activity-project]")];
    const summary = document.querySelector("[data-git-activity-total]");
    const totalProjects = Number(summary?.getAttribute("data-git-activity-total") ?? 0);
    const totalCommits = Number(summary?.getAttribute("data-git-activity-commits") ?? 0);
    const dirtyProjects = Number(summary?.getAttribute("data-git-activity-dirty") ?? 0);
    const branches = projects.map((p) => p.getAttribute("data-git-activity-branch"));
    const dirtyRows = projects.filter(
      (p) => p.getAttribute("data-git-activity-dirty") === "true",
    );
    const commits = projects.reduce(
      (sum, p) => sum + Number(p.getAttribute("data-git-activity-commits") ?? 0),
      0,
    );
    const latestOk = projects.some((p) =>
      (p.getAttribute("data-git-activity-latest") ?? "").includes("sprint-20"),
    );
    const ok =
      projects.length >= 2 &&
      totalProjects === projects.length &&
      totalCommits === commits &&
      dirtyProjects >= 1 &&
      dirtyRows.length >= 1 &&
      branches.includes("develop") &&
      latestOk;
    return {
      ok,
      totalProjects,
      totalCommits,
      dirtyProjects,
      branches,
      rows: projects.length,
      latestOk,
    };
  })()`);
  if (!gitActivity.ok) {
    throw new Error(`Git activity board assertion failed: ${JSON.stringify(gitActivity)}`);
  }
  results.gitActivity = gitActivity;
  results.gitActivityFilters = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const board = () => document.querySelector("[data-git-activity]");
    const setSelect = (selector, value) => {
      const el = document.querySelector(selector);
      if (!el) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
      setter.call(el, value);
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    };
    for (let i = 0; i < 20; i++) {
      if (board()?.querySelectorAll("[data-git-activity-project]").length >= 2) break;
      await sleep(100);
    }
    const initialRows = board()?.querySelectorAll("[data-git-activity-project]").length ?? 0;
    const committerOptions = [...document.querySelectorAll("[data-git-activity-committer-select] option")]
      .map((o) => o.textContent.trim())
      .filter((t) => t !== "All committers");
    setSelect("[data-git-activity-range]", "24h");
    await sleep(400);
    const after24h = board()?.querySelectorAll("[data-git-activity-project]").length ?? 0;
    const after24hTotal = Number(document.querySelector("[data-git-activity-total]")?.getAttribute("data-git-activity-total") ?? 0);
    const after24hCommits = Number(document.querySelector("[data-git-activity-commits]")?.getAttribute("data-git-activity-commits") ?? 0);
    setSelect("[data-git-activity-range]", "all");
    await sleep(400);
    const afterAll = board()?.querySelectorAll("[data-git-activity-project]").length ?? 0;
    setSelect("[data-git-activity-committer-select]", "Alice");
    await sleep(400);
    const afterAlice = board()?.querySelectorAll("[data-git-activity-project]").length ?? 0;
    const aliceRows = [...(board()?.querySelectorAll("[data-git-activity-project]") ?? [])]
      .filter((p) => p.getAttribute("data-git-activity-committer") === "Alice").length;
    const ok =
      initialRows >= 2 &&
      committerOptions.includes("Alice") &&
      committerOptions.includes("Bob") &&
      after24h === 1 &&
      after24hTotal === 1 &&
      after24hCommits === 21 &&
      afterAll === initialRows &&
      afterAlice === 1 &&
      aliceRows === 1;
    return { ok, initialRows, committerOptions, after24h, after24hTotal, after24hCommits, afterAll, afterAlice, aliceRows };
  })()`);
  if (!results.gitActivityFilters.ok) {
    throw new Error(`Git activity filters assertion failed: ${JSON.stringify(results.gitActivityFilters)}`);
  }
  results.gitDirtyPreview = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 20; i++) {
      const dirty = [...document.querySelectorAll("[data-git-activity-project]")].find(
        (row) => row.getAttribute("data-git-activity-dirty") === "true",
      );
      if (dirty) {
        const button = dirty.querySelector("[data-git-activity-preview]");
        if (button) {
          const projectId = button.getAttribute("data-git-activity-preview");
          button.click();
          for (let j = 0; j < 20; j++) {
            const panel = document.querySelector(
              '[data-git-activity-preview-files="' + projectId + '"]',
            );
            if (panel && panel.textContent.includes("ProjectsView.tsx")) {
              const filesText = panel.textContent;
              button.click();
              for (let k = 0; k < 20; k++) {
                if (!document.querySelector('[data-git-activity-preview-files="' + projectId + '"]')) {
                  return {
                    ok: true,
                    projectId,
                    filesText,
                    collapsed: true,
                  };
                }
                await sleep(100);
              }
              return { ok: false, reason: "preview did not collapse", filesText };
            }
            await sleep(100);
          }
          return { ok: false, reason: "preview files missing", projectId };
        }
      }
      await sleep(100);
    }
    return { ok: false, reason: "no dirty project row" };
  })()`);
  if (!results.gitDirtyPreview.ok) {
    throw new Error(`Git dirty preview assertion failed: ${JSON.stringify(results.gitDirtyPreview)}`);
  }
  results.gitStagedUnstaged = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 20; i++) {
      const dirty = [...document.querySelectorAll("[data-git-activity-project]")].find(
        (row) => row.getAttribute("data-git-activity-dirty") === "true",
      );
      if (!dirty) {
        await sleep(100);
        continue;
      }
      const previewBtn = dirty.querySelector("[data-git-activity-preview]");
      if (!previewBtn) return { ok: false, reason: "no preview button" };
      const projectId = previewBtn.getAttribute("data-git-activity-preview");
      if (!document.querySelector('[data-git-activity-preview-files="' + projectId + '"]')) {
        previewBtn.click();
        await sleep(120);
      }
      const panel = document.querySelector(
        '[data-git-activity-preview-files="' + projectId + '"]',
      );
      const headers = [...(panel?.querySelectorAll("[data-git-change-group-header]") ?? [])].map(
        (el) => el.getAttribute("data-git-change-group-header"),
      );
      const fileGroups = [...(panel?.querySelectorAll("[data-git-change-group]") ?? [])].map(
        (el) => ({
          file: el.getAttribute("data-git-file"),
          group: el.getAttribute("data-git-change-group"),
        }),
      );
      const staged = fileGroups.find(
        (g) => (g.file ?? "").includes("ProjectsView.tsx") && g.group === "staged",
      );
      const unstaged = fileGroups.find(
        (g) =>
          (g.file ?? "").includes("sprint-21-project-git-graph.md") && g.group === "unstaged",
      );
      const untracked = fileGroups.find(
        (g) => (g.file ?? "").includes("broken-lint.json") && g.group === "untracked",
      );
      if (
        headers.includes("staged") &&
        headers.includes("unstaged") &&
        headers.includes("untracked") &&
        staged &&
        unstaged &&
        untracked
      ) {
        previewBtn.click();
        for (let k = 0; k < 20; k++) {
          if (!document.querySelector('[data-git-activity-preview-files="' + projectId + '"]')) {
            break;
          }
          await sleep(50);
        }
        return {
          ok: true,
          projectId,
          headers,
          staged: staged.file,
          unstaged: unstaged.file,
          untracked: untracked.file,
        };
      }
      return {
        ok: false,
        reason: "group assertions missing",
        headers,
        fileGroups: fileGroups.slice(0, 8),
      };
    }
    return { ok: false, reason: "no dirty project row" };
  })()`);
  if (!results.gitStagedUnstaged.ok) {
    throw new Error(`Git staged/unstaged grouping assertion failed: ${JSON.stringify(results.gitStagedUnstaged)}`);
  }
  results.gitDirtyDiff = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 20; i++) {
      const dirty = [...document.querySelectorAll("[data-git-activity-project]")].find(
        (row) => row.getAttribute("data-git-activity-dirty") === "true",
      );
      if (!dirty) {
        await sleep(100);
        continue;
      }
      const preview = dirty.querySelector("[data-git-activity-preview]");
      if (!preview) return { ok: false, reason: "no preview button" };
      preview.click();
      await sleep(80);
      const toggle = [...dirty.querySelectorAll("[data-git-diff-toggle]")].find((btn) =>
        (btn.getAttribute("data-git-diff-toggle") || "").includes("ProjectsView.tsx"),
      );
      if (!toggle) return { ok: false, reason: "no diff toggle for ProjectsView.tsx" };
      toggle.click();
      for (let j = 0; j < 20; j++) {
        const pre = dirty.querySelector('[data-git-diff-content="src/views/ProjectsView.tsx"]');
        const text = pre?.textContent ?? "";
        if (pre && text.includes("diff --git") && text.includes("+added line") && text.includes("-removed line")) {
          return {
            ok: true,
            status: pre.getAttribute("data-git-diff-status"),
            hasHeader: text.includes("diff --git"),
            hasAdded: text.includes("+added line"),
            hasRemoved: text.includes("-removed line"),
          };
        }
        await sleep(100);
      }
      return { ok: false, reason: "diff content missing" };
    }
    return { ok: false, reason: "no dirty project row" };
  })()`);
  if (!results.gitDirtyDiff.ok) {
    throw new Error(`Git dirty diff assertion failed: ${JSON.stringify(results.gitDirtyDiff)}`);
  }
  results.gitInlineDiffSideBySide = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const panel = document.querySelector(
      '[data-git-diff-content="src/views/ProjectsView.tsx"]',
    );
    if (!panel) return { ok: false, reason: "diff panel missing" };
    const lines = [...panel.querySelectorAll("[data-git-diff-line]")];
    const types = new Set(lines.map((el) => el.getAttribute("data-git-diff-line-type")));
    const highlighted = !!panel.querySelector(
      '[data-git-diff-line] span[class*="text-"]',
    );
    const inlineOk =
      lines.length > 0 &&
      ["add", "del", "hunk", "context"].every((kind) => types.has(kind)) &&
      highlighted;
    const toggle = panel.querySelector("[data-git-side-by-side-toggle]");
    if (!toggle) return { ok: false, reason: "side-by-side toggle missing", inlineOk };
    toggle.click();
    let sideOk = false;
    for (let i = 0; i < 20; i++) {
      const side = panel.querySelector('[data-git-side-by-side="src/views/ProjectsView.tsx"]');
      const oldLines = panel.querySelectorAll('[data-git-file-version="old"]');
      const newLines = panel.querySelectorAll('[data-git-file-version="new"]');
      const firstOld = oldLines[0];
      const firstNew = newLines[0];
      sideOk =
        !!side &&
        oldLines.length > 0 &&
        newLines.length > 0 &&
        (firstOld?.textContent ?? "").includes("1") &&
        (firstNew?.textContent ?? "").includes("1");
      if (sideOk) break;
      await sleep(100);
    }
    toggle.click();
    await sleep(120);
    const backToInline = !!panel.querySelector("[data-git-diff-line]");
    return {
      ok: inlineOk && sideOk && backToInline,
      inlineOk,
      sideOk,
      backToInline,
      types: [...types],
      lineCount: lines.length,
      highlighted,
    };
  })()`);
  if (!results.gitInlineDiffSideBySide.ok) {
    throw new Error(
      `Git inline diff / side-by-side assertion failed: ${JSON.stringify(results.gitInlineDiffSideBySide)}`,
    );
  }
  results.gitBatchPreview = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 20; i++) {
      const dirty = [...document.querySelectorAll("[data-git-activity-project]")].find(
        (row) => row.getAttribute("data-git-activity-dirty") === "true",
      );
      if (!dirty) {
        await sleep(100);
        continue;
      }
      const previewBtn = dirty.querySelector("[data-git-activity-preview]");
      if (!previewBtn) return { ok: false, reason: "no preview button" };
      const projectId = previewBtn.getAttribute("data-git-activity-preview");
      const panel = document.querySelector(
        '[data-git-activity-preview-files="' + projectId + '"]',
      );
      if (!panel) {
        previewBtn.click();
        for (let j = 0; j < 20; j++) {
          if (document.querySelector('[data-git-activity-preview-files="' + projectId + '"]')) {
            break;
          }
          await sleep(100);
        }
      }
      const batchBtn = dirty.querySelector("[data-git-batch-preview]");
      if (!batchBtn) return { ok: false, reason: "no batch preview button", projectId };
      batchBtn.click();
      for (let j = 0; j < 30; j++) {
        const pre = document.querySelector(
          '[data-git-batch-preview-content="' + projectId + '"]',
        );
        const text = pre?.textContent ?? "";
        const diffCount = (text.match(/diff --git/g) ?? []).length;
        if (
          pre &&
          diffCount >= 2 &&
          text.includes("ProjectsView.tsx") &&
          text.includes("sprint-21-project-git-graph.md")
        ) {
          batchBtn.click();
          await sleep(120);
          const collapsed = !document.querySelector(
            '[data-git-batch-preview-content="' + projectId + '"]',
          );
          return {
            ok: collapsed,
            projectId,
            diffCount,
            hasProjects: text.includes("ProjectsView.tsx"),
            hasPlanDoc: text.includes("sprint-21-project-git-graph.md"),
            collapsed,
          };
        }
        await sleep(100);
      }
      return { ok: false, reason: "batch content missing", projectId };
    }
    return { ok: false, reason: "no dirty project row" };
  })()`);
  if (!results.gitBatchPreview.ok) {
    throw new Error(`Git batch preview assertion failed: ${JSON.stringify(results.gitBatchPreview)}`);
  }
  results.gitCommitSelected = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 20; i++) {
      const dirty = [...document.querySelectorAll("[data-git-activity-project]")].find(
        (row) => row.getAttribute("data-git-activity-dirty") === "true",
      );
      if (!dirty) {
        await sleep(100);
        continue;
      }
      const previewBtn = dirty.querySelector("[data-git-activity-preview]");
      if (!previewBtn) return { ok: false, reason: "no preview button" };
      const projectId = previewBtn.getAttribute("data-git-activity-preview");
      if (!document.querySelector('[data-git-activity-preview-files="' + projectId + '"]')) {
        previewBtn.click();
        await sleep(120);
      }
      const checkbox = dirty.querySelector(
        '[data-git-select-file="src/views/ProjectsView.tsx"]',
      );
      if (!checkbox) return { ok: false, reason: "no select checkbox" };
      checkbox.click();
      await sleep(80);
      const commitBtn = dirty.querySelector("[data-git-commit-selected]");
      if (!commitBtn) return { ok: false, reason: "no commit selected button" };
      commitBtn.click();
      for (let j = 0; j < 30; j++) {
        const result =
          dirty.querySelector('[data-git-commit-selected-result="' + projectId + '"]')
            ?.textContent ?? "";
        if (result.includes("Committed")) {
          const stillChecked = dirty.querySelector(
            '[data-git-select-file="src/views/ProjectsView.tsx"]',
          )?.checked;
          return {
            ok: stillChecked === false,
            projectId,
            result: result.slice(0, 60),
            selectionCleared: stillChecked === false,
          };
        }
        await sleep(100);
      }
      return { ok: false, reason: "commit result missing", projectId };
    }
    return { ok: false, reason: "no dirty project row" };
  })()`);
  if (!results.gitCommitSelected.ok) {
    throw new Error(`Git commit selected assertion failed: ${JSON.stringify(results.gitCommitSelected)}`);
  }
  results.gitCommitLintGate = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 20; i++) {
      const dirty = [...document.querySelectorAll("[data-git-activity-project]")].find(
        (row) => row.getAttribute("data-git-activity-dirty") === "true",
      );
      if (!dirty) {
        await sleep(100);
        continue;
      }
      const previewBtn = dirty.querySelector("[data-git-activity-preview]");
      if (!previewBtn) return { ok: false, reason: "no preview button" };
      const projectId = previewBtn.getAttribute("data-git-activity-preview");
      if (!document.querySelector('[data-git-activity-preview-files="' + projectId + '"]')) {
        previewBtn.click();
        await sleep(120);
      }
      const checkbox = dirty.querySelector('[data-git-select-file="broken-lint.json"]');
      if (!checkbox) return { ok: false, reason: "no broken-lint.json checkbox" };
      checkbox.click();
      await sleep(80);
      const commitBtn = dirty.querySelector("[data-git-commit-selected]");
      if (!commitBtn) return { ok: false, reason: "no commit selected button" };
      commitBtn.click();
      for (let j = 0; j < 30; j++) {
        const gate = dirty.querySelector('[data-git-lint-gate="' + projectId + '"]');
        const issues = Number(gate?.getAttribute("data-git-lint-gate-issues") ?? 0);
        const result =
          dirty.querySelector('[data-git-commit-selected-result="' + projectId + '"]')
            ?.textContent ?? "";
        const text = gate?.textContent ?? "";
        if (
          gate &&
          issues >= 1 &&
          text.includes("Lint gate blocked") &&
          !result.includes("Committed")
        ) {
          return {
            ok: true,
            projectId,
            issues,
            text: text.slice(0, 140),
            noCommit: true,
          };
        }
        await sleep(100);
      }
      return { ok: false, reason: "lint gate result missing", projectId };
    }
    return { ok: false, reason: "no dirty project row" };
  })()`);
  if (!results.gitCommitLintGate.ok) {
    throw new Error(`Git commit lint gate assertion failed: ${JSON.stringify(results.gitCommitLintGate)}`);
  }
  results.gitCommitTrend = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 20; i++) {
      const bars = [...document.querySelectorAll("[data-git-trend-bar]")];
      if (bars.length >= 7) {
        const counts = bars.map((bar) => Number(bar.getAttribute("data-git-trend-bar-count") ?? 0));
        const days = bars.map((bar) => Number(bar.getAttribute("data-git-trend-bar-day") ?? 0));
        const max = Math.max(...counts);
        const total = counts.reduce((sum, count) => sum + count, 0);
        const ok = max > 0 && total > 0 && days.every((day) => day > 0);
        return { ok, bars: bars.length, max, total, days };
      }
      await sleep(100);
    }
    return { ok: false, bars: 0 };
  })()`);
  if (!results.gitCommitTrend.ok) {
    throw new Error(`Git commit trend assertion failed: ${JSON.stringify(results.gitCommitTrend)}`);
  }
  results.rebaseApply = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const btn = document.querySelector('[data-rebase-branch]');
    if (!btn) return { ok: false, reason: "no rebase button" };
    btn.click();
    for (let i = 0; i < 20; i++) {
      if (document.querySelector('[data-rebase-result]')) break;
      await sleep(100);
    }
    const text = document.querySelector('[data-rebase-result]')?.textContent ?? "";
    return { ok: text.includes("Rebased"), text };
  })()`);
  if (!results.rebaseApply.ok) {
    throw new Error(`Git rebase assertion failed: ${JSON.stringify(results.rebaseApply)}`);
  }
  results.rebaseResolve = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const buttons = document.querySelectorAll('[data-rebase-branch]');
    if (buttons.length < 2) {
      return { ok: false, reason: "second rebase button missing", count: buttons.length };
    }
    const card = buttons[1].closest(".project-git-graph");
    buttons[1].click();
    let conflicted = false;
    for (let i = 0; i < 20; i++) {
      const text = card?.querySelector('[data-rebase-result]')?.textContent ?? "";
      conflicted = text.includes("Conflicts") && text.includes("docs/conflict.md");
      if (conflicted) break;
      await sleep(100);
    }
    if (!conflicted) {
      return { ok: false, reason: "conflict result missing", text: document.body.innerText.slice(0, 300) };
    }
    const unionBtn = card?.querySelector('[data-resolve-conflicts="union"]');
    if (!unionBtn) return { ok: false, reason: "union resolve button missing" };
    unionBtn.click();
    let resolved = false;
    for (let i = 0; i < 20; i++) {
      const text = card?.querySelector('[data-resolve-result]')?.textContent ?? "";
      resolved = text.includes("Resolved") && text.includes("continued rebase");
      if (resolved) break;
      await sleep(100);
    }
    return { ok: conflicted && resolved, conflicted, resolved };
  })()`);
  if (!results.rebaseResolve.ok) {
    throw new Error(`rebase conflict resolution assertion failed: ${JSON.stringify(results.rebaseResolve)}`);
  }
  results.commitPrDraft = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const btn = [...document.querySelectorAll("main button")].find(
      (b) => b.getAttribute("aria-label") === "Generate commit PR draft",
    );
    if (!btn) return { ok: false, reason: "no draft button" };
    btn.click();
    for (let i = 0; i < 20; i++) {
      if (document.querySelector(".commit-pr-draft")) break;
      await sleep(100);
    }
    const panel = document.querySelector(".commit-pr-draft");
    if (!panel) return { ok: false, reason: "no draft panel" };
    const text = panel.innerText;
    return {
      ok: true,
      conventional: text
        .split("\\n")
        .some((line) => /^(feat|fix|docs|test|chore)\\([^)]+\\): /.test(line.trim())),
      hasDoD: text.includes("DoD") && text.includes("- [ ]"),
      hasChanges: text.includes("Changes") && text.includes("- docs/plans"),
      hasSummary: text.includes("AI Workbench"),
    };
  })()`);
  if (
    !results.commitPrDraft.ok ||
    !results.commitPrDraft.conventional ||
    !results.commitPrDraft.hasDoD ||
    !results.commitPrDraft.hasChanges ||
    !results.commitPrDraft.hasSummary
  ) {
    throw new Error(`Commit PR draft assertion failed: ${JSON.stringify(results.commitPrDraft)}`);
  }
  results.commitApply = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const applyBtn = document.querySelector('[data-apply-commit]');
    if (!applyBtn) return { ok: false, reason: "no apply commit button" };
    applyBtn.click();
    for (let i = 0; i < 20; i++) {
      if (document.querySelector('[data-commit-result]')) break;
      await sleep(100);
    }
    const result = document.querySelector('[data-commit-result]')?.textContent ?? "";
    const ok = result.includes("Committed local-") || result.includes("Nothing to commit");
    const graphRefreshed = document.querySelector(".project-git-graph")?.textContent?.includes("develop") ?? false;
    return { ok, result, graphRefreshed };
  })()`);
  if (!results.commitApply.ok) {
    throw new Error(`Commit apply assertion failed: ${JSON.stringify(results.commitApply)}`);
  }
  results.remotePr = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const prBtn = document.querySelector('[data-create-pr]');
    if (!prBtn) return { ok: false, reason: "no create pr button" };
    prBtn.click();
    for (let i = 0; i < 20; i++) {
      if (document.querySelector('[data-pr-result]')) break;
      await sleep(100);
    }
    const result = document.querySelector('[data-pr-result]')?.textContent ?? "";
    return { ok: result.includes("pull/1"), result };
  })()`);
  if (!results.remotePr.ok) {
    throw new Error(`Remote PR assertion failed: ${JSON.stringify(results.remotePr)}`);
  }
  const widthBefore = await evaluate(`document.querySelector('main').getBoundingClientRect().width`);
  const inspectorOpened = await evaluate(`(() => {
    const btn = [...document.querySelectorAll('main button')].find((b) => b.textContent.trim() === "AI Coding");
    if (!btn) return false;
    btn.click();
    return true;
  })()`);
  if (!inspectorOpened) throw new Error("AI Coding button missing for inspector layout check");
  await delay(300);
  const inspectorInfo = await evaluate(`(() => {
    const aside = document.querySelector('aside.drawer-panel');
    const main = document.querySelector('main');
    return {
      asideWidth: aside ? getComputedStyle(aside).width : "",
      mainWidth: main?.getBoundingClientRect().width ?? 0,
      asideTransform: aside ? getComputedStyle(aside).transform : "",
    };
  })()`);
  await evaluate(`document.querySelector('aside button[aria-label="Close inspector"]')?.click()`);
  await delay(250);
  const widthAfterClose = await evaluate(`document.querySelector('main').getBoundingClientRect().width`);
  const layoutStable =
    widthBefore === inspectorInfo.mainWidth &&
    widthAfterClose === inspectorInfo.mainWidth &&
    inspectorInfo.asideWidth === "240px";
  results.motion.inspector = { widthBefore, inspectorInfo, widthAfterClose, layoutStable };

  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  await delay(150);
  results.motion.reducedMotion = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const material = document.querySelector('.material-card[data-material]');
    const tilt = document.querySelector('.tilt-card');
    let tiltTransform = tilt ? getComputedStyle(tilt).transform : "";
    for (let i = 0; i < 30 && tiltTransform !== "none"; i++) {
      await sleep(100);
      tiltTransform = tilt ? getComputedStyle(tilt).transform : "";
    }
    return {
      viewAnimationDuration: getComputedStyle(document.querySelector('.view-enter')).animationDuration,
      dockTransitionDuration: getComputedStyle(document.querySelector('nav button')).transitionDuration,
      materialAnimationDuration: material ? getComputedStyle(material, '::before').animationDuration : "",
      tiltTransform,
    };
  })()`);
  await send("Emulation.setEmulatedMedia", { features: [] });

  const maxNav = durationSeconds(results.motion.navTransitionDuration);
  const maxView = durationSeconds(results.motion.viewAnimationDuration);
  const reducedView = durationSeconds(results.motion.reducedMotion.viewAnimationDuration);
  const reducedDock = durationSeconds(results.motion.reducedMotion.dockTransitionDuration);
  const reducedMaterial = durationSeconds(results.motion.reducedMotion.materialAnimationDuration);
  const reducedTilt = results.motion.reducedMotion.tiltTransform;
  results.motion.pass =
    maxNav <= 0.16 &&
    maxView <= 0.16 &&
    results.motion.bodyOverflowX <= 1 &&
    layoutStable &&
    reducedView <= 0.02 &&
    reducedDock <= 0.02 &&
    reducedMaterial <= 0.02 &&
    reducedTilt === "none";
  if (!results.motion.pass) {
    throw new Error(`UI motion DoD assertion failed: ${JSON.stringify(results.motion)}`);
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
  results.dailyProgress = await evaluate(`(() => {
    const focus = document.querySelector("[data-daily-focus]")?.getAttribute("data-daily-focus") ?? "";
    const habits = document.querySelector("[data-daily-habits]")?.getAttribute("data-daily-habits") ?? "";
    const schedule = document.querySelector("[data-daily-schedule]")?.getAttribute("data-daily-schedule") ?? "";
    const next = document.querySelector("[data-daily-next-event]")?.textContent ?? "";
    const overall = document.querySelector("[data-daily-overall]")?.textContent ?? "";
    const progressBar = document.querySelector("[data-daily-progress-bar]");
    const focusParts = focus.split("/").map(Number);
    const habitParts = habits.split("/").map(Number);
    const scheduleParts = schedule.split("/").map(Number);
    const ok =
      focus === "0/3" &&
      habits === "0/3" &&
      schedule === "0/2" &&
      focusParts.length === 2 &&
      habitParts.length === 2 &&
      scheduleParts.length === 2 &&
      focusParts.every(Number.isFinite) &&
      habitParts.every(Number.isFinite) &&
      scheduleParts.every(Number.isFinite) &&
      next.includes("每日复盘") &&
      !!progressBar;
    return { ok, focus, habits, schedule, next, overall };
  })()`);
  if (!results.dailyProgress.ok) {
    throw new Error(`Daily progress assertion failed: ${JSON.stringify(results.dailyProgress)}`);
  }
  await delay(400);
  const beforeReload = await evaluate(`document.body.innerText.includes("DoD persistence check")`);
  const habitToggle = await evaluate(`(async () => {
    const btn = [...document.querySelectorAll("main button[aria-label]")]
      .find((b) => (b.getAttribute("aria-label") || "").startsWith("Toggle ") && (b.getAttribute("aria-label") || "") !== "Toggle status");
    if (!btn) return { ok: false, reason: "no habit toggle" };
    btn.click();
    await new Promise((r) => setTimeout(r, 350));
    const row = btn.parentElement;
    const doneClass = row ? row.className.includes("border-emerald-500/30") : false;
    return { ok: true, doneClass };
  })()`);
  const actionsSections = await evaluate(`(() => {
    const titles = [...document.querySelectorAll("main section h2")].map((h) => h.textContent.trim());
    const rects = [...document.querySelectorAll("main section")].map((el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    });
    let overlap = 0;
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) overlap += 1;
      }
    }
    return { titles, overlap };
  })()`);
  results.actions = { habitToggle, sections: actionsSections };
  await send("Page.reload", { ignoreCache: true });
  await waitForApp();
  await clickDock("Actions");
  const afterReload = await evaluate(`document.body.innerText.includes("DoD persistence check")`);
  const habitPersisted = await evaluate(`(() => {
    const btn = [...document.querySelectorAll("main button[aria-label]")]
      .find((b) => (b.getAttribute("aria-label") || "").startsWith("Toggle ") && (b.getAttribute("aria-label") || "") !== "Toggle status");
    if (!btn) return false;
    const row = btn.parentElement;
    return row ? row.className.includes("border-emerald-500/30") : false;
  })()`);
  results.persistence = { created, beforeReload, afterReload, habitPersisted };

  await clickDock("Knowledge");
  const selectedMarkdownThought = await evaluate(`(async () => {
    const btn = [...document.querySelectorAll("main button")]
      .find((b) => (b.textContent || "").trim().startsWith("# Sprint 3 笔记"));
    if (!btn) return false;
    btn.click();
    await new Promise((r) => setTimeout(r, 300));
    return true;
  })()`);
  results.knowledge = await evaluate(`(() => {
    const preview = document.querySelector(".markdown-body");
    const heading = preview?.querySelector("h1, h2")?.textContent ?? "";
    const code = preview?.querySelector("pre code")?.textContent ?? "";
    const list = preview?.querySelectorAll("li").length ?? 0;
    const rawText = preview?.textContent ?? "";
    const badgeText = [...document.querySelectorAll("main span")].map((s) => s.textContent ?? "").join(" | ");
    return { hasMarkdown: !!preview, heading, code, list, rawText, badgeText };
  })()`);
  const ragSearch = await evaluate(`(async () => {
    const input = document.querySelector('input[placeholder="RAG search..."]');
    if (!input) return { ok: false, reason: "no rag input" };
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, "sprint");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 80));
    const searchBtn = [...document.querySelectorAll("main button")].find((b) => b.textContent.trim() === "Search");
    if (!searchBtn) return { ok: false, reason: "no search button" };
    searchBtn.click();
    await new Promise((r) => setTimeout(r, 400));
    return {
      ok: true,
      matches: document.body.innerText.includes("RAG matches"),
      resultVisible: document.body.innerText.includes("Sprint 3"),
      indexStatusVisible: document.body.innerText.includes("docs") || document.body.innerText.includes("pending"),
    };
  })()`);
  if (!ragSearch.ok || !ragSearch.matches || !ragSearch.resultVisible || !ragSearch.indexStatusVisible) {
    throw new Error("RAG search assertion failed");
  }
  results.ragSearch = ragSearch;
  const vaultIndex = await evaluate(`(async () => {
    const input = document.querySelector('input[placeholder="Vault path..."]');
    if (!input) return { ok: false, reason: "no vault input" };
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, "C:/vault");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 80));
    const concurrencyInput = document.querySelector('input[aria-label="Index concurrency"]');
    if (!concurrencyInput) return { ok: false, reason: "no concurrency input" };
    setter.call(concurrencyInput, "2");
    concurrencyInput.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 80));
    const indexBtn = [...document.querySelectorAll("main button")].find((b) => b.textContent.trim() === "Index vault");
    if (!indexBtn) return { ok: false, reason: "no index button" };
    indexBtn.click();
    let workersAttr = "";
    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 100));
      workersAttr =
        document.querySelector("[data-index-result-workers]")?.getAttribute("data-index-result-workers") ?? "";
      if (workersAttr && Number(workersAttr) >= 1) break;
    }
    const filesVisible = document.body.innerText.includes(" files");
    const search = document.querySelector('input[placeholder="RAG search..."]');
    if (!search) return { ok: false, reason: "no rag search input" };
    setter.call(search, "vault");
    search.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 80));
    const searchBtn = [...document.querySelectorAll("main button")].find((b) => b.textContent.trim() === "Search");
    if (!searchBtn) return { ok: false, reason: "no search button" };
    searchBtn.click();
    await new Promise((r) => setTimeout(r, 400));
    const fileResultVisible =
      document.body.innerText.includes("Obsidian Roadmap") || document.body.innerText.includes("Obsidian");
    return {
      ok: true,
      filesVisible,
      fileResultVisible,
      concurrencyVisible: concurrencyInput.getAttribute("data-index-concurrency") === "2",
      concurrencyUsed: Number(workersAttr) >= 1 && Number(workersAttr) <= 2,
    };
  })()`);
  if (
    !vaultIndex.ok ||
    !vaultIndex.filesVisible ||
    !vaultIndex.fileResultVisible ||
    !vaultIndex.concurrencyVisible ||
    !vaultIndex.concurrencyUsed
  ) {
    throw new Error(`Vault index assertion failed: ${JSON.stringify(vaultIndex)}`);
  }
  results.vaultIndex = vaultIndex;

  const vectorRagCrossFile = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const search = document.querySelector('input[placeholder="RAG search..."]');
    if (!search) return { ok: false, reason: "no rag search input" };
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(search, "vault");
    search.dispatchEvent(new Event("input", { bubbles: true }));
    await sleep(80);
    const searchBtn = [...document.querySelectorAll("main button")].find((b) => b.textContent.trim() === "Search");
    if (!searchBtn) return { ok: false, reason: "no search button" };
    searchBtn.click();
    await sleep(400);
    const picker = document.querySelector("[data-cross-file-hits]");
    if (!picker) return { ok: false, reason: "no cross file picker" };
    const chips = [...picker.querySelectorAll("[data-cross-file-hit]")];
    if (chips.length < 2) {
      return {
        ok: false,
        reason: "cross file chips below 2",
        chips: chips.map((el) => el.getAttribute("data-cross-file-hit") ?? ""),
      };
    }
    const vectorScores = [...document.querySelectorAll("[data-rag-vector-score]")]
      .map((el) => el.getAttribute("data-rag-vector-score") ?? "")
      .filter((value) => Number(value) > 0);
    const vectorStatus = document.querySelector("[data-vector-status]")?.getAttribute("data-vector-status") ?? "";
    const firstPath = chips[0].getAttribute("data-cross-file-hit") ?? "";
    chips[0].click();
    await sleep(150);
    const visibleDocFiles = [...document.querySelectorAll("[data-rag-result][data-rag-file]")]
      .map((el) => el.getAttribute("data-rag-file") ?? "")
      .filter(Boolean);
    const activeAfterToggle =
      document.querySelectorAll("[data-cross-file-hit]")[0]?.getAttribute("data-cross-file-active") === "false";
    const onlyOtherFile = visibleDocFiles.every((file) => file !== firstPath);
    document.querySelectorAll("[data-cross-file-hit]")[0]?.click();
    await sleep(150);
    const restoredActive = [...document.querySelectorAll("[data-cross-file-hit]")]
      .every((el) => el.getAttribute("data-cross-file-active") === "true");
    return {
      ok: true,
      chipCount: chips.length,
      hasVectorScore: vectorScores.length > 0,
      vectorStatus,
      activeAfterToggle,
      onlyOtherFile,
      restoredActive,
    };
  })()`);
  if (
    !vectorRagCrossFile.ok ||
    vectorRagCrossFile.chipCount < 2 ||
    !vectorRagCrossFile.hasVectorScore ||
    vectorRagCrossFile.vectorStatus !== "on" ||
    !vectorRagCrossFile.activeAfterToggle ||
    !vectorRagCrossFile.onlyOtherFile ||
    !vectorRagCrossFile.restoredActive
  ) {
    throw new Error(`Vector RAG cross file assertion failed: ${JSON.stringify(vectorRagCrossFile)}`);
  }
  results.vectorRagCrossFile = vectorRagCrossFile;

  const concurrencyAuto = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const autoBtn = document.querySelector("[data-index-concurrency-auto]");
    const input = document.querySelector('input[aria-label="Index concurrency"]');
    if (!autoBtn || !input) {
      return { ok: false, reason: "no auto concurrency control" };
    }
    autoBtn.click();
    await sleep(180);
    const autoOn = autoBtn.getAttribute("data-index-concurrency-auto") === "on";
    const value = Number(input.value || 0);
    const inRange = value >= 1 && value <= 16;
    const disabled = input.disabled;
    autoBtn.click();
    await sleep(180);
    const autoOff = autoBtn.getAttribute("data-index-concurrency-auto") === "off";
    const manualEnabled = !input.disabled;
    return {
      ok: autoOn && inRange && disabled && autoOff && manualEnabled,
      autoOn,
      value,
      inRange,
      disabled,
      autoOff,
      manualEnabled,
    };
  })()`);
  if (!concurrencyAuto.ok) {
    throw new Error(`Concurrency auto assertion failed: ${JSON.stringify(concurrencyAuto)}`);
  }
  results.concurrencyAuto = concurrencyAuto;

  const autoScaleIndex = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const autoBtn = document.querySelector("[data-index-concurrency-auto]");
    if (!autoBtn) return { ok: false, reason: "no auto concurrency control" };
    if (autoBtn.getAttribute("data-index-concurrency-auto") !== "on") {
      autoBtn.click();
      await sleep(150);
    }
    const indexBtn = [...document.querySelectorAll("main button")].find(
      (b) => b.textContent.trim() === "Index vault",
    );
    if (!indexBtn) return { ok: false, reason: "no index button" };
    indexBtn.click();
    let workers = 0;
    for (let i = 0; i < 30; i++) {
      await sleep(100);
      workers = Number(
        document.querySelector("[data-index-result-workers]")?.getAttribute("data-index-result-workers") ?? 0,
      );
      if (workers > 0) break;
    }
    const ok = workers >= 1 && workers <= 16;
    return { ok, workers, autoOn: autoBtn.getAttribute("data-index-concurrency-auto") === "on" };
  })()`);
  if (!autoScaleIndex.ok) {
    throw new Error(`Auto scale index assertion failed: ${JSON.stringify(autoScaleIndex)}`);
  }
  results.autoScaleIndex = autoScaleIndex;

  const cancelIndex = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const indexBtn = [...document.querySelectorAll("main button")].find(
      (b) => b.textContent.trim() === "Index vault",
    );
    if (!indexBtn) return { ok: false, reason: "no index button" };
    indexBtn.click();
    let cancelBtn = null;
    for (let i = 0; i < 30; i++) {
      cancelBtn = document.querySelector("[data-index-cancel]");
      if (cancelBtn) break;
      await sleep(10);
    }
    if (!cancelBtn) return { ok: false, reason: "no cancel button" };
    cancelBtn.click();
    let status = "";
    for (let i = 0; i < 40; i++) {
      status = document.querySelector("[data-index-progress-status]")?.textContent ?? "";
      if (status.includes("Cancelled") || status.includes("Indexed")) break;
      await sleep(25);
    }
    return { ok: status.includes("Cancelled"), status };
  })()`);
  if (!cancelIndex.ok) {
    throw new Error(`Index cancel assertion failed: ${JSON.stringify(cancelIndex)}`);
  }
  results.cancelIndex = cancelIndex;

  const indexQueue = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const input = document.querySelector('input[placeholder="Vault path..."]');
    if (!input) return { ok: false, reason: "no vault input" };
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, "C:/vault");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await sleep(80);
    const clickIndex = () => {
      const btn = [...document.querySelectorAll("main button")].find(
        (b) => b.textContent.trim() === "Index vault",
      );
      if (btn) btn.click();
    };
    clickIndex();
    await sleep(60);
    clickIndex();
    let sawQueue = false;
    let drained = false;
    for (let i = 0; i < 80; i++) {
      await sleep(100);
      const count = Number(
        document.querySelector("[data-vault-index-queue-count]")?.getAttribute("data-vault-index-queue-count") ?? 0,
      );
      const active = document.querySelector("[data-vault-index-queue-active]")?.getAttribute("data-vault-index-queue-active") ?? "";
      if (count > 0) sawQueue = true;
      if (sawQueue && count === 0 && !active) {
        drained = true;
        break;
      }
    }
    return { ok: sawQueue && drained, sawQueue, drained };
  })()`);
  if (!indexQueue.ok) {
    throw new Error(`Index queue assertion failed: ${JSON.stringify(indexQueue)}`);
  }
  results.indexQueue = indexQueue;

  await evaluate(`(() => {
    const records = Array.from({ length: 6 }, (_, i) => ({
      runId: "persist-run-" + (i + 1),
      path: "C:/persist-" + (i + 1),
      ignorePatterns: [],
      concurrency: 4,
      status: "queued",
    }));
    localStorage.setItem("ai-workbench:vault-index-queue:v1", JSON.stringify(records));
    return { ok: true, seeded: records.length };
  })()`);
  await send("Page.reload", { ignoreCache: true });
  await waitForApp();
  await clickDock("Knowledge");
  const indexQueuePersist = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let sawQueue = false;
    let activeSeen = "";
    let drained = false;
    for (let i = 0; i < 120; i++) {
      await sleep(100);
      const count = Number(
        document.querySelector("[data-vault-index-queue-count]")?.getAttribute("data-vault-index-queue-count") ?? 0,
      );
      const active =
        document.querySelector("[data-vault-index-queue-active]")?.getAttribute("data-vault-index-queue-active") ?? "";
      if (count > 0) sawQueue = true;
      if (active) activeSeen = active;
      let records = [];
      try {
        records = JSON.parse(
          localStorage.getItem("ai-workbench:vault-index-queue:v1") ?? "[]",
        );
      } catch {}
      if ((sawQueue || activeSeen) && records.length === 0) {
        drained = true;
        break;
      }
    }
    return {
      ok: sawQueue && drained,
      sawQueue,
      activeSeen,
      drained,
      seedFiles: 6,
    };
  })()`);
  if (!indexQueuePersist.ok) {
    throw new Error(
      `Index queue persist assertion failed: ${JSON.stringify(indexQueuePersist)}`,
    );
  }
  results.indexQueuePersist = indexQueuePersist;

  await evaluate(`(() => {
    const records = [
      {
        runId: "prio-low",
        path: "C:/priority-low",
        ignorePatterns: [],
        concurrency: 4,
        priority: 0,
        attempts: 0,
        lastError: "",
        status: "queued",
      },
      {
        runId: "prio-high",
        path: "C:/priority-high",
        ignorePatterns: [],
        concurrency: 4,
        priority: 1,
        attempts: 0,
        lastError: "",
        status: "queued",
      },
    ];
    localStorage.setItem("ai-workbench:vault-index-queue:v1", JSON.stringify(records));
    return { ok: true, seeded: records.length };
  })()`);
  await send("Page.reload", { ignoreCache: true });
  await waitForApp();
  await clickDock("Knowledge");
  const indexQueuePriority = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let firstActive = "";
    let sawHigh = false;
    let queuedPaths = [];
    for (let i = 0; i < 120; i++) {
      await sleep(50);
      const active =
        document.querySelector("[data-vault-index-queue-active]")?.getAttribute("data-vault-index-queue-active") ?? "";
      const activePriority =
        document.querySelector("[data-vault-index-queue-active-priority]")?.getAttribute("data-vault-index-queue-active-priority") ?? "";
      if (active) {
        if (!firstActive) firstActive = active;
        if (activePriority === "1") sawHigh = true;
      }
      queuedPaths = [...document.querySelectorAll("[data-vault-index-queued-path]")].map(
        (el) => el.getAttribute("data-vault-index-queued-path") ?? "",
      );
      if (firstActive && queuedPaths.length > 0) break;
    }
    let drained = false;
    for (let i = 0; i < 120; i++) {
      await sleep(100);
      const active =
        document.querySelector("[data-vault-index-queue-active]")?.getAttribute("data-vault-index-queue-active") ?? "";
      const count = Number(
        document.querySelector("[data-vault-index-queue-count]")?.getAttribute("data-vault-index-queue-count") ?? 0,
      );
      const records = JSON.parse(
        localStorage.getItem("ai-workbench:vault-index-queue:v1") ?? "[]",
      );
      if (!active && count === 0 && records.length === 0) {
        drained = true;
        break;
      }
    }
    return {
      ok: firstActive.includes("priority-high") && sawHigh && drained,
      firstActive,
      sawHigh,
      queuedPaths,
      drained,
    };
  })()`);
  if (!indexQueuePriority.ok) {
    throw new Error(`Index queue priority assertion failed: ${JSON.stringify(indexQueuePriority)}`);
  }
  results.indexQueuePriority = indexQueuePriority;

  await evaluate(`(() => {
    localStorage.setItem(
      "ai-workbench:vault-index-queue:v1",
      JSON.stringify([
        {
          runId: "retry-run",
          path: "C:/retry-vault",
          ignorePatterns: [],
          concurrency: 4,
          priority: 1,
          attempts: 0,
          lastError: "",
          status: "queued",
        },
      ]),
    );
    return { ok: true };
  })()`);
  await send("Page.reload", { ignoreCache: true });
  await waitForApp();
  await clickDockFast("Knowledge");
  const indexQueueRetry = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const attemptsSeen = new Set();
    const delaysSeen = new Set();
    let errorSeen = false;
    let drained = false;
    for (let i = 0; i < 240; i++) {
      await sleep(20);
      for (const el of document.querySelectorAll("[data-vault-index-queued-path]")) {
        const attempts = Number(el.getAttribute("data-vault-index-queue-attempts") ?? 0);
        if (attempts > 0) attemptsSeen.add(attempts);
        const delay = Number(el.getAttribute("data-vault-index-queue-retry-delay") ?? 0);
        if (attempts > 0 && delay > 0) delaysSeen.add(delay);
      }
      const activeAttempts = Number(
        document.querySelector("[data-vault-index-queue-active-attempts]")?.getAttribute("data-vault-index-queue-active-attempts") ?? 0,
      );
      if (activeAttempts > 0) attemptsSeen.add(activeAttempts);
      const activeDelay = Number(
        document.querySelector("[data-vault-index-queue-active-retry-delay]")?.getAttribute("data-vault-index-queue-active-retry-delay") ?? 0,
      );
      if (activeAttempts > 0 && activeDelay > 0) delaysSeen.add(activeDelay);
      const status = document.querySelector("[data-index-progress-status]")?.textContent ?? "";
      if (status.includes("simulated failure")) errorSeen = true;
      const active =
        document.querySelector("[data-vault-index-queue-active]")?.getAttribute("data-vault-index-queue-active") ?? "";
      const count = Number(
        document.querySelector("[data-vault-index-queue-count]")?.getAttribute("data-vault-index-queue-count") ?? 0,
      );
      const records = JSON.parse(
        localStorage.getItem("ai-workbench:vault-index-queue:v1") ?? "[]",
      );
      if (!active && count === 0 && records.length === 0 && errorSeen) {
        drained = true;
        break;
      }
    }
    return {
      ok:
        attemptsSeen.has(1) &&
        attemptsSeen.has(2) &&
        delaysSeen.has(500) &&
        delaysSeen.has(1000) &&
        errorSeen &&
        drained,
      attemptsSeen: [...attemptsSeen],
      retryDelays: [...delaysSeen],
      errorSeen,
      drained,
    };
  })()`);
  if (!indexQueueRetry.ok) {
    throw new Error(`Index queue retry assertion failed: ${JSON.stringify(indexQueueRetry)}`);
  }
  results.indexQueueRetry = indexQueueRetry;

  await evaluate(`(() => {
    localStorage.setItem(
      "ai-workbench:vault-index-queue:v1",
      JSON.stringify([
        {
          runId: "backoff-run",
          path: "C:/backoff-retry-vault",
          ignorePatterns: [],
          concurrency: 4,
          priority: 1,
          attempts: 0,
          lastError: "",
          status: "queued",
        },
      ]),
    );
    return { ok: true };
  })()`);
  await send("Page.reload", { ignoreCache: true });
  await waitForApp();
  await clickDockFast("Knowledge");
  results.indexQueueBackoff = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const attemptsSeen = new Set();
    const delaysSeen = new Set();
    let drained = false;
    for (let i = 0; i < 240; i++) {
      await sleep(20);
      for (const el of document.querySelectorAll("[data-vault-index-queued-path]")) {
        const attempts = Number(el.getAttribute("data-vault-index-queue-attempts") ?? 0);
        if (attempts > 0) attemptsSeen.add(attempts);
        const delay = Number(el.getAttribute("data-vault-index-queue-retry-delay") ?? 0);
        if (attempts > 0 && delay > 0) delaysSeen.add(delay);
      }
      const activeAttempts = Number(
        document.querySelector("[data-vault-index-queue-active-attempts]")?.getAttribute("data-vault-index-queue-active-attempts") ?? 0,
      );
      if (activeAttempts > 0) attemptsSeen.add(activeAttempts);
      const activeDelay = Number(
        document.querySelector("[data-vault-index-queue-active-retry-delay]")?.getAttribute("data-vault-index-queue-active-retry-delay") ?? 0,
      );
      if (activeAttempts > 0 && activeDelay > 0) delaysSeen.add(activeDelay);
      const active = document.querySelector("[data-vault-index-queue-active]")?.getAttribute("data-vault-index-queue-active") ?? "";
      const count = Number(
        document.querySelector("[data-vault-index-queue-count]")?.getAttribute("data-vault-index-queue-count") ?? 0,
      );
      const records = JSON.parse(
        localStorage.getItem("ai-workbench:vault-index-queue:v1") ?? "[]",
      );
      if (!active && count === 0 && records.length === 0) {
        drained = true;
        break;
      }
    }
    return {
      ok:
        attemptsSeen.has(1) &&
        attemptsSeen.has(2) &&
        delaysSeen.has(500) &&
        delaysSeen.has(1000) &&
        drained,
      attemptsSeen: [...attemptsSeen],
      retryDelays: [...delaysSeen],
      drained,
    };
  })()`);
  if (!results.indexQueueBackoff.ok) {
    throw new Error(`Index queue backoff assertion failed: ${JSON.stringify(results.indexQueueBackoff)}`);
  }

  await evaluate(`(() => {
    const input = document.querySelector('input[placeholder="Vault path..."]');
    if (input) {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(input, "C:/vault");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    return true;
  })()`);

  const indexProgressCheck = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const indexBtn = [...document.querySelectorAll("main button")].find(
      (b) => b.textContent.trim() === "Index vault",
    );
    if (!indexBtn) return { ok: false, reason: "no index button" };
    indexBtn.click();
    let status = "";
    let bar = 0;
    for (let i = 0; i < 30; i++) {
      status = document.querySelector("[data-index-progress-status]")?.textContent ?? "";
      bar = Number(document.querySelector("[data-index-progress]")?.getAttribute("data-index-progress") ?? 0);
      if (status.includes("Indexed") && bar === 100) break;
      await sleep(100);
    }
    return { ok: status.includes("Indexed") && bar === 100, status, bar };
  })()`);
  if (!indexProgressCheck.ok) {
    throw new Error(`Index progress assertion failed: ${JSON.stringify(indexProgressCheck)}`);
  }
  results.indexProgress = indexProgressCheck;

  const vaultIgnore = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const ignoreInput = document.querySelector('input[placeholder="Ignore patterns (comma separated)"]');
    if (!ignoreInput) return { ok: false, reason: "no ignore input" };
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(ignoreInput, "Daily Notes");
    ignoreInput.dispatchEvent(new Event("input", { bubbles: true }));
    const indexBtn = [...document.querySelectorAll("main button")].find((b) => b.textContent.trim() === "Index vault");
    if (!indexBtn) return { ok: false, reason: "no index button" };
    indexBtn.click();
    let ignored = false;
    for (let i = 0; i < 20; i++) {
      const skipped = Number(document.querySelector('[data-vault-ignored]')?.getAttribute("data-vault-ignored") ?? 0);
      const files = Number(document.querySelector('[data-vault-files]')?.getAttribute("data-vault-files") ?? 0);
      ignored = skipped === 1 && files === 1;
      if (ignored) break;
      await sleep(100);
    }
    return { ok: ignored };
  })()`);
  if (!vaultIgnore.ok) {
    throw new Error(`Vault ignore assertion failed: ${JSON.stringify(vaultIgnore)}`);
  }
  results.vaultIgnore = vaultIgnore;
  const vaultWatch = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const filesBefore = Number(document.querySelector('[data-vault-files]')?.getAttribute("data-vault-files") ?? 0);
    const watchBtn = document.querySelector('[data-vault-watch]');
    if (!watchBtn) return { ok: false, reason: "no vault watch button" };
    watchBtn.click();
    await sleep(350);
    const statusOn =
      document.querySelector('[data-vault-watch-status]')?.getAttribute("data-vault-watch-status") === "on";
    const watchingText = document.body.innerText.includes("watching");
    const stopText = document.querySelector('[data-vault-watch]')?.textContent.includes("Stop watch") ?? false;
    const skippedVisible =
      document.querySelector('[data-vault-ignored]')?.textContent.includes("Skipped 1") ?? false;
    const filesAfter = Number(document.querySelector('[data-vault-files]')?.getAttribute("data-vault-files") ?? 0);
    document.querySelector('[data-vault-watch]')?.click();
    await sleep(250);
    const statusOff =
      document.querySelector('[data-vault-watch-status]')?.getAttribute("data-vault-watch-status") === "off";
    return {
      ok: statusOn && watchingText && stopText && statusOff && filesAfter > filesBefore && skippedVisible,
      statusOn,
      watchingText,
      stopText,
      statusOff,
      skippedVisible,
      filesBefore,
      filesAfter,
    };
  })()`);
  if (!vaultWatch.ok) {
    throw new Error(`Vault watch assertion failed: ${JSON.stringify(vaultWatch)}`);
  }
  results.vaultWatch = vaultWatch;
  const vaultWatchReady = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const watchBtn = document.querySelector('[data-vault-watch]');
    if (!watchBtn) return { ok: false, reason: "no vault watch button" };
    if (watchBtn.getAttribute("data-vault-watch") !== "on") {
      watchBtn.click();
      await sleep(350);
    }
    const path = document.querySelector('input[placeholder="Vault path..."]')?.value ?? "";
    const ignore =
      document.querySelector('input[placeholder="Ignore patterns (comma separated)"]')?.value ?? "";
    return {
      ok: path === "C:/vault" && ignore.includes("Daily Notes"),
      path,
      ignore,
    };
  })()`);
  if (!vaultWatchReady.ok) {
    throw new Error(`Vault watch persistence setup failed: ${JSON.stringify(vaultWatchReady)}`);
  }
  await send("Page.reload", { ignoreCache: true });
  await waitForApp();
  await clickDock("Knowledge");
  const vaultWatchPersisted = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let restored = false;
    for (let i = 0; i < 30; i++) {
      const path = document.querySelector('input[placeholder="Vault path..."]')?.value ?? "";
      const ignore =
        document.querySelector('input[placeholder="Ignore patterns (comma separated)"]')?.value ?? "";
      const watch =
        document.querySelector('[data-vault-watch-status]')?.getAttribute("data-vault-watch-status") ?? "";
      restored = path === "C:/vault" && ignore.includes("Daily Notes") && watch === "on";
      if (restored) break;
      await sleep(100);
    }
    document.querySelector('[data-vault-watch]')?.click();
    await sleep(250);
    const stopped =
      document.querySelector('[data-vault-watch-status]')?.getAttribute("data-vault-watch-status") === "off";
    return { ok: restored && stopped, restored, stopped };
  })()`);
  if (!vaultWatchPersisted.ok) {
    throw new Error(
      `Vault watch persistence assertion failed: ${JSON.stringify(vaultWatchPersisted)}`,
    );
  }
  results.vaultWatchPersisted = vaultWatchPersisted;

  const multiVaultWatch = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    const pathInput = document.querySelector('input[placeholder="Vault path..."]');
    if (!pathInput) return { ok: false, reason: "no vault path input" };
    setter.call(pathInput, "D:/vault");
    pathInput.dispatchEvent(new Event("input", { bubbles: true }));
    await sleep(120);
    document.querySelector('[data-vault-watch]')?.click();
    await sleep(400);
    let rows = [...document.querySelectorAll("[data-vault-target]")];
    const secondOn = rows.some(
      (row) =>
        row.getAttribute("data-vault-target-path") === "D:/vault" &&
        row.getAttribute("data-vault-target-watch") === "on",
    );
    if (!secondOn) {
      return {
        ok: false,
        reason: "second target not watching",
        paths: rows.map((row) => row.getAttribute("data-vault-target-path")),
      };
    }
    const firstRow = rows.find(
      (row) => row.getAttribute("data-vault-target-path") === "C:/vault",
    );
    firstRow?.querySelector("[data-vault-target-toggle]")?.click();
    await sleep(400);
    rows = [...document.querySelectorAll("[data-vault-target]")];
    const bothOn = rows.every((row) => row.getAttribute("data-vault-target-watch") === "on");
    const count =
      document.querySelector("[data-vault-watch-count]")?.getAttribute("data-vault-watch-count") ?? "";
    for (const row of [...document.querySelectorAll("[data-vault-target-watch='on']")]) {
      row.querySelector("[data-vault-target-toggle]")?.click();
      await sleep(150);
    }
    await sleep(300);
    const allOff = [...document.querySelectorAll("[data-vault-target]")].every(
      (row) => row.getAttribute("data-vault-target-watch") === "off",
    );
    return { ok: bothOn && count === "2" && allOff, bothOn, count, allOff };
  })()`);
  if (!multiVaultWatch.ok) {
    throw new Error(`Multi vault watch assertion failed: ${JSON.stringify(multiVaultWatch)}`);
  }
  results.multiVaultWatch = multiVaultWatch;

  const vaultTargetStats = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const targets = ["C:/vault", "D:/vault"];
    let counts = {};
    let events = {};
    let created = {};
    let modified = {};
    let removed = {};
    for (let i = 0; i < 30; i++) {
      counts = Object.fromEntries(
        [...document.querySelectorAll("[data-vault-target]")].map((row) => [
          row.getAttribute("data-vault-target-path"),
          Number(
            row.querySelector("[data-vault-target-files]")?.getAttribute("data-vault-target-files") ?? 0,
          ),
        ]),
      );
      events = Object.fromEntries(
        [...document.querySelectorAll("[data-vault-target]")].map((row) => [
          row.getAttribute("data-vault-target-path"),
          Number(
            row.querySelector("[data-vault-target-events]")?.getAttribute("data-vault-target-events") ?? 0,
          ),
        ]),
      );
      created = Object.fromEntries(
        [...document.querySelectorAll("[data-vault-target]")].map((row) => [
          row.getAttribute("data-vault-target-path"),
          Number(
            row.querySelector("[data-vault-created]")?.getAttribute("data-vault-created") ?? 0,
          ),
        ]),
      );
      modified = Object.fromEntries(
        [...document.querySelectorAll("[data-vault-target]")].map((row) => [
          row.getAttribute("data-vault-target-path"),
          Number(
            row.querySelector("[data-vault-modified]")?.getAttribute("data-vault-modified") ?? 0,
          ),
        ]),
      );
      removed = Object.fromEntries(
        [...document.querySelectorAll("[data-vault-target]")].map((row) => [
          row.getAttribute("data-vault-target-path"),
          Number(
            row.querySelector("[data-vault-removed]")?.getAttribute("data-vault-removed") ?? 0,
          ),
        ]),
      );
      if (targets.every((path) => (counts[path] ?? 0) > 0) && targets.some((path) => (events[path] ?? 0) > 0)) {
        break;
      }
      await sleep(200);
    }
    return {
      ok:
        targets.every((path) => (counts[path] ?? 0) > 0) &&
        targets.some((path) => (events[path] ?? 0) > 0) &&
        targets.some((path) => (created[path] ?? 0) > 0),
      counts,
      events,
      created,
      modified,
      removed,
    };
  })()`);
  if (!vaultTargetStats.ok) {
    throw new Error(`Vault target stats assertion failed: ${JSON.stringify(vaultTargetStats)}`);
  }
  results.vaultTargetStats = vaultTargetStats;

  const vaultWatchTimeline = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const target = [...document.querySelectorAll("[data-vault-target]")]
      .find((row) => row.getAttribute("data-vault-target-path") === "C:/vault");
    if (!target) return { ok: false, reason: "no C:/vault target" };
    const timelineBtn = target.querySelector("[data-vault-target-timeline]");
    if (!timelineBtn) return { ok: false, reason: "no timeline button" };
    timelineBtn.click();
    let events = [];
    for (let i = 0; i < 30; i++) {
      events = [...document.querySelectorAll("[data-vault-watch-event]")];
      if (events.length > 0) break;
      await sleep(100);
    }
    const kinds = [...new Set(events.map((el) => el.getAttribute("data-vault-watch-event-kind")))];
    const paths = events.map((el) => el.getAttribute("data-vault-watch-event-path") ?? "");
    const countText =
      document.querySelector("[data-vault-watch-events-count]")?.textContent ?? "";
    const countOk =
      Number(countText.replace(/[^0-9]/g, "") || 0) === events.length;
    const clearBtn = document.querySelector("[data-vault-watch-events-clear]");
    if (!clearBtn) {
      return { ok: false, reason: "no clear button", events: events.length, kinds, countOk };
    }
    clearBtn.click();
    let cleared = false;
    for (let i = 0; i < 20; i++) {
      await sleep(100);
      cleared = document.querySelectorAll("[data-vault-watch-event]").length === 0;
      if (cleared) break;
    }
    return {
      ok:
        events.length > 0 &&
        kinds.includes("created") &&
        paths.some((path) => path.includes("Watch Sync Note")) &&
        countOk &&
        cleared,
      events: events.length,
      kinds,
      paths,
      countOk,
      cleared,
    };
  })()`);
  if (!vaultWatchTimeline.ok) {
    throw new Error(
      `Vault watch timeline assertion failed: ${JSON.stringify(vaultWatchTimeline)}`,
    );
  }
  results.vaultWatchTimeline = vaultWatchTimeline;

  const knowledgeDocSeed = await evaluate(`(() => {
    const dayMs = 86_400_000;
    const startOfToday = Math.floor(Date.now() / dayMs) * dayMs;
    localStorage.setItem(
      "ai-workbench:vault:v1",
      JSON.stringify([
        {
          path: "C:/vault\\\\Obsidian Roadmap.md",
          title: "Obsidian Roadmap",
          tags: "#work",
          content: "roadmap",
          indexedAt: startOfToday - dayMs,
        },
        {
          path: "C:/vault\\\\Daily Notes\\\\2026-08-05.md",
          title: "Daily Note",
          tags: "#life",
          content: "daily",
          indexedAt: startOfToday - 3_600_000,
        },
        {
          path: "D:/vault\\\\Notes.md",
          title: "Notes",
          tags: "#work,#life",
          content: "notes",
          indexedAt: startOfToday - 7_200_000,
        },
      ]),
    );
    return { ok: true, files: 3 };
  })()`);
  await send("Page.reload", { ignoreCache: true });
  await waitForApp();
  await clickDock("Knowledge");
  const knowledgeDocStatus = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const panel = () => document.querySelector("[data-knowledge-docs]");
    let docs = [];
    for (let i = 0; i < 30; i++) {
      docs = [...document.querySelectorAll("[data-knowledge-doc]")];
      if (
        docs.length >= 3 &&
        docs.every(
          (doc) => doc.querySelector("[data-knowledge-doc-status]") !== null,
        )
      ) {
        break;
      }
      await sleep(100);
    }
    if (docs.length < 3) {
      return {
        ok: false,
        reason: "not enough knowledge docs",
        count: docs.length,
        panel: panel()?.textContent ?? "",
      };
    }
    const countText = document.querySelector("[data-knowledge-docs-count]")?.textContent ?? "";
    const count = Number(countText.replace(/[^0-9]/g, "") || 0);
    const vaults = [
      ...new Set(docs.map((doc) => doc.getAttribute("data-knowledge-doc-vault"))),
    ];
    const hasC = docs.some((doc) =>
      (doc.getAttribute("data-knowledge-doc-path") ?? "").includes("C:/vault"),
    );
    const hasD = docs.some((doc) =>
      (doc.getAttribute("data-knowledge-doc-path") ?? "").includes("D:/vault"),
    );
    const statuses = docs.map((doc) =>
      doc
        .querySelector("[data-knowledge-doc-status]")
        ?.getAttribute("data-knowledge-doc-status"),
    );
    const missingCount = Number(
      document
        .querySelector("[data-knowledge-docs-missing]")
        ?.getAttribute("data-knowledge-docs-missing") ?? 0,
    );
    const staleCount = Number(
      document
        .querySelector("[data-knowledge-docs-stale]")
        ?.getAttribute("data-knowledge-docs-stale") ?? 0,
    );
    const statusOk =
      statuses.every((status) => status === "ok") &&
      missingCount === 0 &&
      staleCount === 0;
    const select = document.querySelector("[data-knowledge-doc-filter]");
    let filterOk = false;
    let filteredCount = 0;
    let targetsRaw = "";
    let targetPaths = [];
    try {
      targetsRaw =
        localStorage.getItem("ai-workbench:vault-watch-targets:v1") ?? "missing";
      targetPaths = JSON.parse(targetsRaw).map((t) => t.path);
    } catch {}
    if (select) {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
      setter.call(select, "C:/vault");
      select.dispatchEvent(new Event("change", { bubbles: true }));
      for (let i = 0; i < 20; i++) {
        await sleep(100);
        docs = [...document.querySelectorAll("[data-knowledge-doc]")];
        filteredCount = docs.length;
        filterOk =
          filteredCount === 2 &&
          docs.every(
            (doc) => doc.getAttribute("data-knowledge-doc-vault") === "C:/vault",
          );
        if (filterOk) break;
      }
      setter.call(select, "all");
      select.dispatchEvent(new Event("change", { bubbles: true }));
      await sleep(200);
    }
    return {
      ok:
        count === 3 &&
        vaults.includes("C:/vault") &&
        vaults.includes("D:/vault") &&
        hasC &&
        hasD &&
        statusOk &&
        filterOk,
      count,
      vaults,
      statuses,
      missingCount,
      staleCount,
      statusOk,
      filterOk,
      filteredCount,
      targetsRaw,
      targetPaths,
      seedFiles: true,
    };
  })()`);
  if (!knowledgeDocStatus.ok) {
    throw new Error(
      `Knowledge document status assertion failed: ${JSON.stringify(knowledgeDocStatus)}`,
    );
  }
  results.knowledgeDocStatus = knowledgeDocStatus;

  const knowledgeDocCleanSeed = await evaluate(`(() => {
    const dayMs = 86_400_000;
    const startOfToday = Math.floor(Date.now() / dayMs) * dayMs;
    localStorage.setItem(
      "ai-workbench:vault:v1",
      JSON.stringify([
        {
          path: "C:/vault\\\\Stale.md",
          title: "Stale",
          tags: "#work",
          content: "old",
          indexedAt: startOfToday - 7_200_000,
          stale: true,
        },
        {
          path: "C:/vault\\\\Missing.md",
          title: "Missing",
          tags: "#life",
          content: "gone",
          indexedAt: startOfToday - 86_400_000,
          exists: false,
        },
        {
          path: "D:/vault\\\\Notes.md",
          title: "Notes",
          tags: "#work,#life",
          content: "notes",
          indexedAt: startOfToday - 3_600_000,
        },
      ]),
    );
    return { ok: true, files: 3 };
  })()`);
  await send("Page.reload", { ignoreCache: true });
  await waitForApp();
  await clickDock("Knowledge");
  const knowledgeDocClean = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let docs = [];
    for (let i = 0; i < 30; i++) {
      docs = [...document.querySelectorAll("[data-knowledge-doc]")];
      if (
        docs.length >= 3 &&
        docs.every(
          (doc) => doc.querySelector("[data-knowledge-doc-status]") !== null,
        )
      ) {
        break;
      }
      await sleep(100);
    }
    const beforeStatuses = docs.map((doc) =>
      doc
        .querySelector("[data-knowledge-doc-status]")
        ?.getAttribute("data-knowledge-doc-status"),
    );
    const missingBefore = Number(
      document
        .querySelector("[data-knowledge-docs-missing]")
        ?.getAttribute("data-knowledge-docs-missing") ?? 0,
    );
    const staleBefore = Number(
      document
        .querySelector("[data-knowledge-docs-stale]")
        ?.getAttribute("data-knowledge-docs-stale") ?? 0,
    );
    const cleanBtn = document.querySelector("[data-knowledge-docs-clean]");
    if (!cleanBtn) {
      return {
        ok: false,
        reason: "no clean button",
        beforeStatuses,
        missingBefore,
        staleBefore,
      };
    }
    cleanBtn.click();
    let cleanResult = null;
    for (let i = 0; i < 40; i++) {
      const text =
        document.querySelector("[data-knowledge-clean-result]")?.textContent ?? "";
      const match = text.match(/removed ([0-9]+) reindexed ([0-9]+)/);
      if (match) {
        cleanResult = {
          removed: Number(match[1]),
          reindexed: Number(match[2]),
        };
        break;
      }
      await sleep(100);
    }
    for (let i = 0; i < 20; i++) {
      docs = [...document.querySelectorAll("[data-knowledge-doc]")];
      if (docs.length === 2) break;
      await sleep(100);
    }
    const resultText =
      document.querySelector("[data-knowledge-clean-result]")?.textContent ?? "";
    const spanExists = !!document.querySelector("[data-knowledge-clean-result]");
    const afterStatuses = docs.map((doc) =>
      doc
        .querySelector("[data-knowledge-doc-status]")
        ?.getAttribute("data-knowledge-doc-status"),
    );
    return {
      ok:
        beforeStatuses.includes("missing") &&
        beforeStatuses.includes("stale") &&
        missingBefore === 1 &&
        staleBefore === 1 &&
        cleanResult?.removed === 1 &&
        cleanResult?.reindexed === 1 &&
        docs.length === 2 &&
        afterStatuses.every((status) => status === "ok"),
      beforeStatuses,
      missingBefore,
      staleBefore,
      cleanResult,
      resultText,
      spanExists,
      afterStatuses,
      docs: docs.length,
      seedFiles: 3,
    };
  })()`);
  if (!knowledgeDocClean.ok) {
    throw new Error(
      `Knowledge document clean assertion failed: ${JSON.stringify(knowledgeDocClean)}`,
    );
  }
  results.knowledgeDocClean = knowledgeDocClean;

  const docHealthAutoSeed = await evaluate(`(() => {
    const dayMs = 86_400_000;
    const startOfToday = Math.floor(Date.now() / dayMs) * dayMs;
    localStorage.setItem(
      "ai-workbench:vault:v1",
      JSON.stringify([
        {
          path: "C:/vault\\\\Auto Stale.md",
          title: "Auto Stale",
          tags: "#work",
          content: "old",
          indexedAt: startOfToday - 7_200_000,
          stale: true,
        },
        {
          path: "C:/vault\\\\Auto Missing.md",
          title: "Auto Missing",
          tags: "#life",
          content: "gone",
          indexedAt: startOfToday - 86_400_000,
          exists: false,
        },
        {
          path: "D:/vault\\\\Auto Notes.md",
          title: "Auto Notes",
          tags: "#work,#life",
          content: "notes",
          indexedAt: startOfToday - 3_600_000,
        },
      ]),
    );
    localStorage.setItem(
      "ai-workbench:doc-health-auto:v1",
      JSON.stringify({ enabled: false, intervalMs: 60000, lastRunAt: 0, lastResult: null }),
    );
    return { ok: true, files: 3 };
  })()`);
  await send("Page.reload", { ignoreCache: true });
  await waitForApp();
  await clickDock("Knowledge");
  const docHealthAuto = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let docs = [];
    for (let i = 0; i < 30; i++) {
      docs = [...document.querySelectorAll("[data-knowledge-doc]")];
      if (docs.length >= 3) break;
      await sleep(100);
    }
    const autoBtn = () => document.querySelector("[data-doc-health-auto]");
    for (let i = 0; i < 20 && !autoBtn(); i++) {
      await sleep(100);
    }
    const initialAuto = autoBtn()?.getAttribute("data-doc-health-auto") ?? "missing";
    autoBtn()?.click();
    let enabled = false;
    let resultText = "";
    let lastRun = 0;
    let docsAfter = 0;
    for (let i = 0; i < 40; i++) {
      docs = [...document.querySelectorAll("[data-knowledge-doc]")];
      enabled = autoBtn()?.getAttribute("data-doc-health-auto") === "on";
      resultText = document.querySelector("[data-doc-health-result]")?.textContent ?? "";
      lastRun = Number(
        document.querySelector("[data-doc-health-last-run]")?.getAttribute("data-doc-health-last-run") ?? 0,
      );
      docsAfter = docs.length;
      if (enabled && resultText.includes("removed 1 reindexed 1") && docsAfter === 2 && lastRun > 0) {
        break;
      }
      await sleep(100);
    }
    let stored = null;
    try {
      stored = JSON.parse(localStorage.getItem("ai-workbench:doc-health-auto:v1") ?? "null");
    } catch {}
    const ok =
      initialAuto === "off" &&
      enabled &&
      resultText.includes("removed 1 reindexed 1") &&
      docsAfter === 2 &&
      lastRun > 0 &&
      stored?.enabled === true &&
      stored?.lastResult?.removed === 1 &&
      stored?.lastResult?.reindexed === 1;
    return {
      ok,
      initialAuto,
      enabled,
      resultText,
      docsAfter,
      lastRun,
      stored,
    };
  })()`);
  if (!docHealthAuto.ok) {
    throw new Error(`Doc health auto inspect assertion failed: ${JSON.stringify(docHealthAuto)}`);
  }
  results.docHealthAuto = docHealthAuto;

  await send("Page.reload", { ignoreCache: true });
  await waitForApp();
  await clickDock("Knowledge");
  const docHealthAutoPersist = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let auto = "";
    let docs = 0;
    for (let i = 0; i < 30; i++) {
      auto = document.querySelector("[data-doc-health-auto]")?.getAttribute("data-doc-health-auto") ?? "";
      docs = document.querySelectorAll("[data-knowledge-doc]").length;
      if (auto === "on" && docs === 2) break;
      await sleep(100);
    }
    const resultText = document.querySelector("[data-doc-health-result]")?.textContent ?? "";
    return {
      ok: auto === "on" && docs === 2 && resultText.includes("removed 1 reindexed 1"),
      auto,
      docs,
      resultText,
    };
  })()`);
  if (!docHealthAutoPersist.ok) {
    throw new Error(
      `Doc health auto persist assertion failed: ${JSON.stringify(docHealthAutoPersist)}`,
    );
  }
  results.docHealthAutoPersist = docHealthAutoPersist;

  const docHealthHistory = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let alert = null;
    let runs = [];
    for (let i = 0; i < 30; i++) {
      alert = document.querySelector("[data-doc-health-alert]");
      runs = [...document.querySelectorAll("[data-doc-health-run]")];
      if (alert && runs.length > 0) break;
      await sleep(100);
    }
    const alertText = alert?.textContent ?? "";
    const latest = runs[0];
    const latestRemoved = Number(latest?.getAttribute("data-doc-health-removed") ?? -1);
    const latestReindexed = Number(latest?.getAttribute("data-doc-health-reindexed") ?? -1);
    const latestTriggered = latest?.getAttribute("data-doc-health-triggered") ?? "";
    const latestTime = Number(latest?.getAttribute("data-doc-health-run-time") ?? 0);
    const okBeforeDismiss =
      !!alert &&
      alertText.includes("removed 1") &&
      alertText.includes("reindexed 1") &&
      latestRemoved === 1 &&
      latestReindexed === 1 &&
      latestTriggered === "auto";
    const dismissBtn = document.querySelector("[data-doc-health-dismiss]");
    if (!okBeforeDismiss || !dismissBtn) {
      return {
        ok: okBeforeDismiss,
        alertText,
        latestRemoved,
        latestReindexed,
        latestTriggered,
        runs: runs.length,
      };
    }
    dismissBtn.click();
    let dismissed = false;
    for (let i = 0; i < 20; i++) {
      if (!document.querySelector("[data-doc-health-alert]")) {
        dismissed = true;
        break;
      }
      await sleep(50);
    }
    const storedDismissed = Number(
      localStorage.getItem("ai-workbench:doc-health-alert-dismissed:v1") ?? 0,
    );
    return {
      ok: okBeforeDismiss && dismissed && storedDismissed === latestTime,
      alertText,
      latestRemoved,
      latestReindexed,
      latestTriggered,
      runs: runs.length,
      dismissed,
      storedDismissed,
      latestTime,
    };
  })()`);
  if (!docHealthHistory.ok) {
    throw new Error(`Doc health run history assertion failed: ${JSON.stringify(docHealthHistory)}`);
  }
  results.docHealthHistory = docHealthHistory;

  await send("Page.reload", { ignoreCache: true });
  await waitForApp();
  await clickDock("Knowledge");
  const docHealthDismissPersist = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let alertGone = false;
    for (let i = 0; i < 20; i++) {
      if (!document.querySelector("[data-doc-health-alert]")) {
        alertGone = true;
        break;
      }
      await sleep(100);
    }
    return { ok: alertGone, alertGone };
  })()`);
  if (!docHealthDismissPersist.ok) {
    throw new Error(
      `Doc health dismiss persistence assertion failed: ${JSON.stringify(docHealthDismissPersist)}`,
    );
  }
  results.docHealthDismissPersist = docHealthDismissPersist;

  if (!selectedMarkdownThought) {
    throw new Error("markdown thought button missing");
  }
  if (!results.knowledge.hasMarkdown || results.knowledge.heading === "" || results.knowledge.code === "") {
    throw new Error("Knowledge markdown preview assertion failed");
  }
  if (!results.actions.habitToggle.ok || !results.actions.habitToggle.doneClass) {
    throw new Error("habit toggle assertion failed");
  }
  if (results.actions.sections.overlap > 0) {
    throw new Error(`actions sections overlap: ${results.actions.sections.overlap}`);
  }

  results.overlay = await evaluate(`(() => ({
    viteOverlay: !!document.querySelector("vite-error-overlay, .vite-error-overlay, [class*='error-overlay']"),
    devIssuesText: document.body.innerText.includes("Dev Issues") || document.body.innerText.includes("Internal server error"),
  }))()`);

  await clickDock("System");
  for (let i = 0; i < 20; i++) {
    const ready = await evaluate(`[...document.querySelectorAll("main section h2")].some((h) => h.textContent.trim() === "Clipboard history")`);
    if (ready) break;
    await delay(150);
  }
  results.system = await evaluate(`(() => {
    const cards = [...document.querySelectorAll("main section h2")].map((h) => h.textContent.trim());
    const text = document.body.innerText;
    const clipItems = [...document.querySelectorAll("main section")].find((s) => s.querySelector("h2")?.textContent === "Clipboard history");
    const logItems = [...document.querySelectorAll("main section")].find((s) => s.querySelector("h2")?.textContent === "Error logs");
    return {
      cards,
      listening: text.includes("listening"),
      clipEntries: clipItems?.querySelectorAll(".message-in").length ?? 0,
      logEntries: logItems?.querySelectorAll(".message-in").length ?? 0,
      hasSampleClip: text.includes("pnpm run dev"),
    };
  })()`);
  if (!results.system.cards.includes("Clipboard history") || !results.system.cards.includes("Error logs")) {
    throw new Error("system view cards missing");
  }
  if (!results.system.listening || results.system.clipEntries < 1 || results.system.logEntries < 1) {
    throw new Error("system capture assertions failed");
  }
  results.agentDirectory = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const section = [...document.querySelectorAll("main section")]
      .find((s) => s.querySelector("h2")?.textContent === "Agent directory");
    if (!section) return { ok: false, reason: "agent directory missing" };
    const text = section.innerText;
    const designVisible =
      text.includes("设计部") && text.includes("UI Designer") && text.includes("Frontend Developer");
    const select = section.querySelector('select[aria-label="Agent department"]');
    const addBtn = section.querySelector('button[aria-label="Add agent"]');
    const input = section.querySelector('input[placeholder="Agent name"]');
    const roleInput = section.querySelector('input[placeholder="Role"]');
    if (!select || !addBtn || !input || !roleInput) {
      return { ok: false, reason: "agent form missing", designVisible };
    }
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, "QA Agent");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    setter.call(roleInput, "Verify");
    roleInput.dispatchEvent(new Event("input", { bubbles: true }));
    await sleep(100);
    addBtn.click();
    await sleep(300);
    const created = section.innerText.includes("QA Agent");
    const editBtn = section.querySelector('button[aria-label="Edit agent prompt: QA Agent"]');
    let promptSaved = false;
    let persistedPrompt = false;
    if (editBtn) {
      editBtn.click();
      await sleep(120);
      const textarea = section.querySelector('textarea[aria-label="Agent system prompt"]');
      if (textarea) {
        const textSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
        textSetter.call(textarea, "You are a QA agent that verifies work with evidence.");
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
        await sleep(80);
        const saveBtn = section.querySelector('button[aria-label="Save agent prompt"]');
        saveBtn?.click();
        await sleep(250);
        const currentEditBtn = section.querySelector('button[aria-label="Edit agent prompt: QA Agent"]');
        const qaContainer = currentEditBtn?.closest("div")?.parentElement;
        promptSaved =
          !!qaContainer && qaContainer.textContent.includes("You are a QA agent that verifies work with evidence.");
        const stored = JSON.parse(localStorage.getItem("ai-workbench:db:v1") || "{}");
        const storedAgent = (stored.agents ?? []).find((a) => a.name === "QA Agent");
        persistedPrompt =
          storedAgent?.systemPrompt ===
          "You are a QA agent that verifies work with evidence.";

        const editBtn2 = section.querySelector('button[aria-label="Edit agent prompt: QA Agent"]');
        if (editBtn2) {
          editBtn2.click();
          await sleep(120);
          const textarea2 = section.querySelector('textarea[aria-label="Agent system prompt"]');
          if (textarea2) {
            const textSetter2 = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
            textSetter2.call(textarea2, "v2 QA prompt");
            textarea2.dispatchEvent(new Event("input", { bubbles: true }));
            await sleep(80);
            section.querySelector('button[aria-label="Save agent prompt"]')?.click();
            await sleep(250);
          }
        }
        const editBtn3 = section.querySelector('button[aria-label="Edit agent prompt: QA Agent"]');
        if (editBtn3) {
          editBtn3.click();
          await sleep(120);
          section.querySelector('button[aria-label="Show prompt versions"]')?.click();
          await sleep(200);
        }
        const versionRows = section.querySelectorAll(".prompt-version-list > div").length;
        section.querySelector('button[aria-label="Restore prompt version 2"]')?.click();
        await sleep(250);
        section.querySelector('button[aria-label="Cancel agent prompt"]')?.click();
        await sleep(150);
        const restoredEditBtn = section.querySelector('button[aria-label="Edit agent prompt: QA Agent"]');
        const restoredContainer = restoredEditBtn?.closest("div")?.parentElement;
        const restoredToV1 =
          !!restoredContainer &&
          restoredContainer.textContent.includes("You are a QA agent that verifies work with evidence.") &&
          !restoredContainer.textContent.includes("v2 QA prompt");
        const storedAfter = JSON.parse(localStorage.getItem("ai-workbench:db:v1") || "{}");
        const storedQa = (storedAfter.agents ?? []).find((a) => a.name === "QA Agent");
        const versionsPersisted =
          (storedAfter.promptVersions ?? []).filter((v) => v.agentId === storedQa?.id).length >= 3;
        return {
          ok:
            designVisible &&
            created &&
            promptSaved &&
            persistedPrompt &&
            versionRows >= 2 &&
            restoredToV1 &&
            versionsPersisted,
          designVisible,
          created,
          promptSaved,
          persistedPrompt,
          versionRows,
          restoredToV1,
          versionsPersisted,
        };
      }
    }
    return {
      ok: designVisible && created && promptSaved && persistedPrompt,
      designVisible,
      created,
      promptSaved,
      persistedPrompt,
      versionRows: 0,
      restoredToV1: false,
      versionsPersisted: false,
    };
  })()`);
  if (!results.agentDirectory.ok) {
    throw new Error(`System agent directory assertion failed: ${JSON.stringify(results.agentDirectory)}`);
  }
  const healthCheck = await evaluate(`(async () => {
    const btn = [...document.querySelectorAll("main button")].find((b) => b.textContent.trim() === "Check");
    if (!btn) return { ok: false, reason: "no health check button" };
    btn.click();
    await new Promise((r) => setTimeout(r, 250));
    const card = document.querySelector(".provider-card")?.innerText ?? "";
    return { ok: true, cardText: card };
  })()`);
  if (!healthCheck.ok || !healthCheck.cardText.includes("ok") || !healthCheck.cardText.includes("ms")) {
    throw new Error(`Provider health assertion failed: ${JSON.stringify(healthCheck)}`);
  }
  results.health = healthCheck;

  const heartbeatCheck = await evaluate(`(async () => {
    const btn = [...document.querySelectorAll("main button")].find((b) => b.textContent.trim() === "Heartbeat");
    if (!btn) return { ok: false, reason: "no heartbeat button" };
    btn.click();
    await new Promise((r) => setTimeout(r, 350));
    const alertText = document.querySelector(".heartbeat-alert")?.textContent ?? "";
    const cards = [...document.querySelectorAll(".provider-card")].map((c) => c.textContent).join(" | ");
    return {
      ok: true,
      alertVisible: alertText.includes("Ollama") && alertText.includes("Connection failed"),
      degradedVisible: cards.includes("degraded"),
      okVisible: cards.includes("ok"),
    };
  })()`);
  if (
    !heartbeatCheck.ok ||
    !heartbeatCheck.alertVisible ||
    !heartbeatCheck.degradedVisible ||
    !heartbeatCheck.okVisible
  ) {
    throw new Error(`Provider heartbeat assertion failed: ${JSON.stringify(heartbeatCheck)}`);
  }
  results.heartbeat = heartbeatCheck;

  const streamSmokeCheck = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const btn = document.querySelector('[data-stream-test]');
    if (!btn) return { ok: false, reason: "no stream test button" };
    btn.click();
    for (let i = 0; i < 20; i++) {
      if (document.querySelector('[data-stream-smoke-result]')) break;
      await sleep(100);
    }
    const text = document.querySelector('[data-stream-smoke-result]')?.textContent ?? "";
    return { ok: text.includes("2 chunk"), text };
  })()`);
  if (!streamSmokeCheck.ok) {
    throw new Error(`Provider stream smoke assertion failed: ${JSON.stringify(streamSmokeCheck)}`);
  }
  results.streamSmoke = streamSmokeCheck;

  const webhookDelivery = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const urlInput = document.querySelector('input[placeholder="Webhook URL"]');
    const payloadInput = document.querySelector('textarea[placeholder="Payload (JSON)"]');
    const deliverBtn = document.querySelector('[data-webhook-deliver]');
    if (!urlInput || !payloadInput || !deliverBtn) {
      return { ok: false, reason: "webhook controls missing" };
    }
    const setValue = (el, value) => {
      const proto =
        el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    setValue(urlInput, "https://hooks.example.test/ai-workbench");
    setValue(payloadInput, '{"event":"daily.summary","ok":true}');
    await sleep(80);
    deliverBtn.click();
    let text = "";
    for (let i = 0; i < 20; i++) {
      const el = document.querySelector("[data-webhook-result]");
      if (el) {
        text = el.textContent ?? "";
        if (text.includes("HTTP 200")) break;
      }
      await sleep(100);
    }
    return { ok: text.includes("HTTP 200"), text };
  })()`);
  if (!webhookDelivery.ok) {
    throw new Error(`Webhook delivery assertion failed: ${JSON.stringify(webhookDelivery)}`);
  }
  results.webhookDelivery = webhookDelivery;

  const webhookSignRetry = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const setValue = (el, value) => {
      const proto =
        el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const urlInput = document.querySelector('input[placeholder="Webhook URL"]');
    const payloadInput = document.querySelector('textarea[placeholder="Payload (JSON)"]');
    const secretInput = document.querySelector("[data-webhook-secret]");
    const retriesSelect = document.querySelector("[data-webhook-retries]");
    const deliverBtn = document.querySelector("[data-webhook-deliver]");
    if (!urlInput || !payloadInput || !secretInput || !retriesSelect || !deliverBtn) {
      return { ok: false, reason: "webhook sign/retry controls missing" };
    }
    setValue(urlInput, "https://hooks.example.test/signed");
    setValue(payloadInput, '{"event":"signed.delivery"}');
    setValue(secretInput, "test-secret");
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(
      retriesSelect,
      "2",
    );
    retriesSelect.dispatchEvent(new Event("change", { bubbles: true }));
    retriesSelect.dispatchEvent(new Event("input", { bubbles: true }));
    await sleep(200);
    deliverBtn.click();
    let attempts = "";
    let signed = "";
    for (let i = 0; i < 20; i++) {
      attempts = document.querySelector("[data-webhook-attempts]")?.textContent ?? "";
      signed = document.querySelector("[data-webhook-signed]")?.textContent ?? "";
      if (attempts === "3" && signed === "signed") break;
      await sleep(100);
    }
    const delivered = attempts === "3" && signed === "signed";
    const nameInput = document.querySelector("[data-webhook-rule-name]");
    const intervalInput = document.querySelector("[data-webhook-rule-interval]");
    const saveBtn = document.querySelector("[data-webhook-rule-save]");
    if (!nameInput || !intervalInput || !saveBtn) {
      return { ok: false, reason: "webhook rule controls missing" };
    }
    setValue(urlInput, "https://hooks.example.test/signed-rule");
    setValue(nameInput, "Signed scheduled webhook");
    setValue(intervalInput, "60");
    await sleep(80);
    saveBtn.click();
    let item = null;
    for (let i = 0; i < 20; i++) {
      item = document.querySelector("[data-webhook-rule-item]");
      if (item && item.textContent.includes("Signed scheduled webhook")) break;
      await sleep(100);
    }
    const ruleRetries = item?.querySelector("[data-webhook-rule-retries]")?.textContent ?? "";
    const ruleSigned = !!item?.querySelector("[data-webhook-rule-secret]");
    const stored = JSON.parse(localStorage.getItem("ai-workbench:webhook-rules:v1") || "[]");
    const persisted = stored.some(
      (r) => r.name === "Signed scheduled webhook" && r.secret === "test-secret" && r.retries === 2,
    );
    item?.querySelector("[data-webhook-rule-delete]")?.click();
    return {
      ok: delivered && ruleRetries.includes("2") && ruleSigned && persisted,
      delivered,
      ruleRetries,
      ruleSigned,
      persisted,
      attempts,
      signed,
    };
  })()`);
  if (!webhookSignRetry.ok) {
    throw new Error(
      `Webhook sign/retry assertion failed: ${JSON.stringify(webhookSignRetry)}`,
    );
  }
  results.webhookSignRetry = webhookSignRetry;

  const webhookRules = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    localStorage.setItem("ai-workbench:webhook-rules:v1", "[]");
    const setValue = (el, value) => {
      const proto =
        el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const urlInput = document.querySelector('input[placeholder="Webhook URL"]');
    const nameInput = document.querySelector("[data-webhook-rule-name]");
    const intervalInput = document.querySelector("[data-webhook-rule-interval]");
    const saveBtn = document.querySelector("[data-webhook-rule-save]");
    if (!urlInput || !nameInput || !intervalInput || !saveBtn) {
      return { ok: false, reason: "webhook rule controls missing" };
    }
    setValue(urlInput, "https://hooks.example.test/scheduled");
    setValue(nameInput, "Daily sync webhook");
    setValue(intervalInput, "60");
    await sleep(80);
    saveBtn.click();
    let item = null;
    for (let i = 0; i < 20; i++) {
      item = document.querySelector("[data-webhook-rule-item]");
      if (item && item.textContent.includes("Daily sync webhook")) break;
      await sleep(100);
    }
    if (!item) return { ok: false, reason: "scheduled rule not created" };
    const createdText = item.textContent;
    const created =
      createdText.includes("Daily sync webhook") && createdText.includes("every 60s");
    const storedBefore = JSON.parse(
      localStorage.getItem("ai-workbench:webhook-rules:v1") || "[]",
    );
    const persisted = storedBefore.some((r) => r.name === "Daily sync webhook");
    const enabledBefore = storedBefore.find((r) => r.name === "Daily sync webhook")?.enabled;
    item.querySelector("[data-webhook-rule-toggle]")?.click();
    await sleep(200);
    const storedAfter = JSON.parse(
      localStorage.getItem("ai-workbench:webhook-rules:v1") || "[]",
    );
    const enabledAfter = storedAfter.find((r) => r.name === "Daily sync webhook")?.enabled;
    const toggled =
      enabledBefore !== undefined && enabledAfter !== undefined && enabledBefore !== enabledAfter;
    item = document.querySelector("[data-webhook-rule-item]");
    item?.querySelector("[data-webhook-rule-run]")?.click();
    let ran = false;
    for (let i = 0; i < 20; i++) {
      item = document.querySelector("[data-webhook-rule-item]");
      if (item && item.textContent.includes("HTTP 200")) {
        ran = true;
        break;
      }
      await sleep(100);
    }
    item?.querySelector("[data-webhook-rule-delete]")?.click();
    let deleted = false;
    for (let i = 0; i < 20; i++) {
      const stored = JSON.parse(localStorage.getItem("ai-workbench:webhook-rules:v1") || "[]");
      if (stored.length === 0 && !document.querySelector("[data-webhook-rule-item]")) {
        deleted = true;
        break;
      }
      await sleep(100);
    }
    return {
      ok: created && persisted && toggled && ran && deleted,
      created,
      persisted,
      toggled,
      ran,
      deleted,
      createdText,
    };
  })()`);
  if (!webhookRules.ok) {
    throw new Error(`Webhook scheduled rules assertion failed: ${JSON.stringify(webhookRules)}`);
  }
  results.webhookRules = webhookRules;

  const webhookQueueEvent = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    localStorage.setItem("ai-workbench:webhook-rules:v1", "[]");
    localStorage.setItem("ai-workbench:webhook-deliveries:v1", "[]");
    const setValue = (el, value) => {
      const proto =
        el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const urlInput = document.querySelector('input[placeholder="Webhook URL"]');
    const nameInput = document.querySelector("[data-webhook-rule-name]");
    const triggerInput = document.querySelector("[data-webhook-rule-trigger-input]");
    const saveBtn = document.querySelector("[data-webhook-rule-save]");
    if (!urlInput || !nameInput || !triggerInput || !saveBtn) {
      return { ok: false, reason: "trigger controls missing" };
    }
    setValue(urlInput, "https://hooks.example.test/event");
    setValue(nameInput, "Event sync hook");
    setValue(triggerInput, "sync.completed");
    await sleep(80);
    saveBtn.click();
    let item = null;
    for (let i = 0; i < 20; i++) {
      item = document.querySelector("[data-webhook-rule-item]");
      if (
        item &&
        item.textContent.includes("Event sync hook") &&
        item.textContent.includes("event: sync.completed")
      ) {
        break;
      }
      await sleep(100);
    }
    if (!item) return { ok: false, reason: "trigger rule not created" };
    const ruleBadge = item.querySelector("[data-webhook-rule-trigger]")?.textContent ?? "";
    const triggerBtn = document.querySelector('[data-webhook-event-trigger="sync.completed"]');
    if (!triggerBtn) return { ok: false, reason: "event trigger button missing" };
    triggerBtn.click();
    let delivery = null;
    for (let i = 0; i < 20; i++) {
      delivery = document.querySelector("[data-webhook-delivery-item]");
      if (
        delivery &&
        delivery.textContent.includes("sync.completed") &&
        delivery.textContent.includes("success")
      ) {
        break;
      }
      await sleep(100);
    }
    if (!delivery) return { ok: false, reason: "delivery not queued" };
    const statusAfterTrigger =
      delivery.querySelector("[data-webhook-delivery-status]")?.textContent ?? "";
    delivery.querySelector("[data-webhook-delivery-retry]")?.click();
    await sleep(150);
    delivery = document.querySelector("[data-webhook-delivery-item]");
    const statusAfterRetry =
      delivery?.querySelector("[data-webhook-delivery-status]")?.textContent ?? "";
    const attemptsAfterRetry =
      delivery?.querySelector("[data-webhook-delivery-attempts]")?.textContent ?? "";
    delivery?.querySelector("[data-webhook-delivery-delete]")?.click();
    await sleep(150);
    const deleted = !document.querySelector("[data-webhook-delivery-item]");
    return {
      ok:
        ruleBadge.includes("sync.completed") &&
        statusAfterTrigger === "success" &&
        statusAfterRetry === "queued" &&
        attemptsAfterRetry.startsWith("0/") &&
        deleted,
      ruleBadge,
      statusAfterTrigger,
      statusAfterRetry,
      attemptsAfterRetry,
      deleted,
    };
  })()`);
  if (!webhookQueueEvent.ok) {
    throw new Error(`Webhook queue/event assertion failed: ${JSON.stringify(webhookQueueEvent)}`);
  }
  results.webhookQueueEvent = webhookQueueEvent;

  const webhookPayloadTemplate = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    localStorage.setItem("ai-workbench:webhook-rules:v1", "[]");
    localStorage.setItem("ai-workbench:webhook-deliveries:v1", "[]");
    const setValue = (el, value) => {
      const proto =
        el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const urlInput = document.querySelector('input[placeholder="Webhook URL"]');
    const payloadInput = document.querySelector("[data-webhook-payload]");
    const nameInput = document.querySelector("[data-webhook-rule-name]");
    const triggerInput = document.querySelector("[data-webhook-rule-trigger-input]");
    const saveBtn = document.querySelector("[data-webhook-rule-save]");
    if (!urlInput || !payloadInput || !nameInput || !triggerInput || !saveBtn) {
      return { ok: false, reason: "template controls missing" };
    }
    setValue(
      urlInput,
      "https://hooks.example.test/template",
    );
    setValue(
      payloadInput,
      '{"event":{{event}},"ts":{{ts}},"note":{{context.note}},"count":{{context.count}},"kept":"plain"}',
    );
    setValue(nameInput, "Template hook");
    setValue(triggerInput, "sync.completed");
    await sleep(80);
    saveBtn.click();
    let item = null;
    for (let i = 0; i < 20; i++) {
      item = document.querySelector("[data-webhook-rule-item]");
      if (item && item.textContent.includes("Template hook")) break;
      await sleep(100);
    }
    if (!item) return { ok: false, reason: "template rule not created" };
    const contextInput = document.querySelector("[data-webhook-event-context]");
    if (!contextInput) return { ok: false, reason: "context input missing" };
    setValue(contextInput, '{"note":"from verify","count":7}');
    await sleep(80);
    document.querySelector("[data-webhook-payload-preview]")?.click();
    let previewText = "";
    for (let i = 0; i < 20; i++) {
      previewText =
        document.querySelector("[data-webhook-payload-preview-text]")?.textContent?.trim() ?? "";
      if (previewText.includes('"event":"sync.completed"') && previewText.includes("7")) break;
      await sleep(100);
    }
    const previewOk =
      previewText.includes('"event":"sync.completed"') &&
      previewText.includes('"note":"from verify"') &&
      previewText.includes('"count":7') &&
      previewText.includes('"kept":"plain"') &&
      !previewText.includes("{{");
    document.querySelector('[data-webhook-event-trigger="sync.completed"]')?.click();
    let delivery = null;
    let payloadText = "";
    for (let i = 0; i < 20; i++) {
      delivery = document.querySelector("[data-webhook-delivery-item]");
      payloadText =
        delivery?.querySelector("[data-webhook-delivery-payload]")?.textContent?.trim() ?? "";
      if (payloadText.includes('"event":"sync.completed"') && payloadText.includes("7")) break;
      await sleep(100);
    }
    const deliveryOk =
      payloadText.includes('"event":"sync.completed"') &&
      payloadText.includes('"note":"from verify"') &&
      payloadText.includes('"count":7') &&
      payloadText.includes('"kept":"plain"') &&
      !payloadText.includes("{{");
    return {
      ok: previewOk && deliveryOk,
      previewText,
      payloadText,
      previewOk,
      deliveryOk,
    };
  })()`);
  if (!webhookPayloadTemplate.ok) {
    throw new Error(
      `Webhook payload template assertion failed: ${JSON.stringify(webhookPayloadTemplate)}`,
    );
  }
  results.webhookPayloadTemplate = webhookPayloadTemplate;

  const syncCheck = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const exportBtn = document.querySelector('button[aria-label="Export sync snapshot"]');
    if (!exportBtn) return { ok: false, reason: "export button missing" };
    exportBtn.click();
    await sleep(250);
    const remote = {
      deviceId: "device-b-verify",
      exportedAt: Date.now() + 1000,
      clipboard: [
        {
          id: "sync-clip-remote",
          content: "sprint 19 remote clipboard",
          source: "remote",
          timestamp: Date.now() + 1000,
          updatedAt: Date.now() + 1000,
        },
      ],
      logs: [
        {
          id: "sync-log-remote",
          source: "remote",
          message: "sprint 19 remote error",
          stack: null,
          severity: "error",
          timestamp: Date.now() + 1000,
          updatedAt: Date.now() + 1000,
          deviceId: "device-remote",
        },
      ],
    };
    localStorage.setItem("ai-workbench:sync-snapshot:v1", JSON.stringify(remote));
    document.querySelector('button[aria-label="Import sync snapshot"]')?.click();
    let merged = false;
    for (let i = 0; i < 20; i++) {
      const body = document.body.innerText;
      merged =
        body.includes("sprint 19 remote clipboard") && body.includes("sprint 19 remote error");
      if (merged) break;
      await sleep(100);
    }
    return { ok: merged, merged };
  })()`);
  if (!syncCheck.ok) {
    throw new Error(`sync snapshot assertion failed: ${JSON.stringify(syncCheck)}`);
  }
  results.sync = syncCheck;

  const remoteSyncCheck = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    const urlInput = document.querySelector('input[placeholder="Remote URL"]');
    const pushBtn = document.querySelector('button[aria-label="Push sync snapshot"]');
    const pullBtn = document.querySelector('button[aria-label="Pull sync snapshot"]');
    if (!urlInput || !pushBtn || !pullBtn) {
      return { ok: false, reason: "remote sync controls missing" };
    }
    setter.call(urlInput, "https://sync.example.test/workbench");
    urlInput.dispatchEvent(new Event("input", { bubbles: true }));
    pushBtn.click();
    let pushed = false;
    for (let i = 0; i < 20; i++) {
      const msg = document.querySelector("[data-sync-message]")?.textContent ?? "";
      pushed = msg.includes("Pushed snapshot to remote");
      if (pushed) break;
      await sleep(100);
    }
    pullBtn.click();
    let pulled = false;
    for (let i = 0; i < 20; i++) {
      const msg = document.querySelector("[data-sync-message]")?.textContent ?? "";
      const body = document.body.innerText;
      const conflictVisible =
        document.querySelector("[data-sync-conflicts]")?.textContent.includes("1 conflict") ?? false;
      pulled =
        msg.includes("Merged +1 clips") &&
        body.includes("sprint 33 remote clipboard") &&
        conflictVisible;
      if (pulled) break;
      await sleep(100);
    }
    return { ok: pushed && pulled, pushed, pulled };
  })()`);
  if (!remoteSyncCheck.ok) {
    throw new Error(`remote sync assertion failed: ${JSON.stringify(remoteSyncCheck)}`);
  }
  results.remoteSync = remoteSyncCheck;

  const syncE2eCheck = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const setValue = (el, value) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    localStorage.removeItem("ai-workbench:sync-encrypted:v1");
    const toggle = document.querySelector("[data-sync-e2e-toggle]");
    const exportBtn = document.querySelector('button[aria-label="Export sync snapshot"]');
    const importBtn = document.querySelector('button[aria-label="Import sync snapshot"]');
    if (!toggle || !exportBtn || !importBtn) {
      return { ok: false, reason: "e2e controls missing" };
    }
    if (!toggle.checked) toggle.click();
    await sleep(120);
    const passInput = document.querySelector("[data-sync-passphrase]");
    if (!passInput) return { ok: false, reason: "passphrase input missing" };
    setValue(passInput, "test-passphrase");
    await sleep(120);
    exportBtn.click();
    let exported = false;
    let envelopeRaw = "";
    for (let i = 0; i < 20; i++) {
      const msg = document.querySelector("[data-sync-message]")?.textContent ?? "";
      envelopeRaw = localStorage.getItem("ai-workbench:sync-encrypted:v1") ?? "";
      if (msg.includes("Exported encrypted snapshot") && envelopeRaw) {
        exported = true;
        break;
      }
      await sleep(100);
    }
    let envelope = null;
    try {
      envelope = JSON.parse(envelopeRaw);
    } catch {
      envelope = null;
    }
    const envelopeOk =
      !!envelope &&
      envelope.v === 1 &&
      envelope.alg === "AES-256-GCM" &&
      !!envelope.salt &&
      !!envelope.iv &&
      !!envelope.ciphertext &&
      !envelopeRaw.includes("device-local");
    importBtn.click();
    let imported = false;
    for (let i = 0; i < 20; i++) {
      const msg = document.querySelector("[data-sync-message]")?.textContent ?? "";
      if (msg.includes("Merged encrypted +")) {
        imported = true;
        break;
      }
      await sleep(100);
    }
    let wrongFailed = false;
    for (let attempt = 0; attempt < 3 && !wrongFailed; attempt++) {
      setValue(passInput, "wrong-passphrase");
      await sleep(150);
      importBtn.click();
      for (let i = 0; i < 20; i++) {
        const msgEl = document.querySelector("[data-sync-message]");
        if (msgEl && msgEl.className.includes("text-rose-400") && msgEl.textContent) {
          wrongFailed = true;
          break;
        }
        await sleep(100);
      }
    }
    const urlInput = document.querySelector('input[placeholder="Remote URL"]');
    const pushBtn = document.querySelector('button[aria-label="Push sync snapshot"]');
    setValue(urlInput, "https://sync.example.test/e2e");
    await sleep(80);
    pushBtn.click();
    let pushedEncrypted = false;
    for (let i = 0; i < 20; i++) {
      const msg = document.querySelector("[data-sync-message]")?.textContent ?? "";
      if (msg.includes("Pushed encrypted snapshot to remote")) {
        pushedEncrypted = true;
        break;
      }
      await sleep(100);
    }
    setValue(passInput, "");
    await sleep(120);
    if (toggle.checked) toggle.click();
    await sleep(120);
    localStorage.removeItem("ai-workbench:sync-encrypted:v1");
    return {
      ok: exported && envelopeOk && imported && wrongFailed && pushedEncrypted,
      exported,
      envelopeOk,
      imported,
      wrongFailed,
      pushedEncrypted,
      alg: envelope?.alg,
    };
  })()`);
  if (!syncE2eCheck.ok) {
    throw new Error(
      `sync E2E encryption assertion failed: ${JSON.stringify(syncE2eCheck)}`,
    );
  }
  results.syncE2e = syncE2eCheck;

  const syncResolveCheck = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let item = null;
    for (let i = 0; i < 20; i++) {
      item = document.querySelector("[data-sync-conflict-item]");
      if (item) break;
      await sleep(100);
    }
    if (!item) return { ok: false, reason: "no conflict item" };
    const remoteBtn = item.querySelector('[data-resolve-choice="remote"]');
    if (!remoteBtn) return { ok: false, reason: "no keep remote button" };
    remoteBtn.click();
    let resolved = false;
    for (let i = 0; i < 30; i++) {
      const msg = document.querySelector("[data-sync-message]")?.textContent ?? "";
      const body = document.body.innerText;
      const badgeGone = !document.querySelector("[data-sync-conflicts]");
      resolved =
        msg.includes("Resolved clipboard conflict") &&
        body.includes("sprint 38 conflict override") &&
        badgeGone;
      if (resolved) break;
      await sleep(100);
    }
    return { ok: resolved, resolved };
  })()`);
  if (!syncResolveCheck.ok) {
    throw new Error(`sync resolve assertion failed: ${JSON.stringify(syncResolveCheck)}`);
  }
  results.syncResolve = syncResolveCheck;

  const batchResolveCheck = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    document.querySelector('button[aria-label="Pull sync snapshot"]')?.click();
    let conflictSeen = false;
    for (let i = 0; i < 20; i++) {
      conflictSeen = !!document.querySelector("[data-sync-conflict-item]");
      if (conflictSeen) break;
      await sleep(100);
    }
    if (!conflictSeen) return { ok: false, reason: "no conflict after second pull" };
    const unionBtn = document.querySelector('[data-batch-resolve="union"]');
    if (!unionBtn) return { ok: false, reason: "no batch union button" };
    unionBtn.click();
    let merged = false;
    for (let i = 0; i < 30; i++) {
      const msg = document.querySelector("[data-sync-message]")?.textContent ?? "";
      const badgeGone = !document.querySelector("[data-sync-conflicts]");
      merged = msg.includes("Merged") && badgeGone;
      if (merged) break;
      await sleep(100);
    }
    if (!merged) return { ok: false, reason: "batch union not merged", merged };
    document.querySelector('button[aria-label="Pull sync snapshot"]')?.click();
    let secondConflictSeen = false;
    for (let i = 0; i < 20; i++) {
      secondConflictSeen = !!document.querySelector("[data-sync-conflict-item]");
      if (secondConflictSeen) break;
      await sleep(100);
    }
    const batchBtn = document.querySelector('[data-batch-resolve="remote"]');
    if (!secondConflictSeen || !batchBtn) {
      return { ok: false, reason: "no second conflict for batch remote", secondConflictSeen };
    }
    batchBtn.click();
    let resolved = false;
    for (let i = 0; i < 30; i++) {
      const msg = document.querySelector("[data-sync-message]")?.textContent ?? "";
      const badgeGone = !document.querySelector("[data-sync-conflicts]");
      resolved = msg.includes("Resolved") && badgeGone;
      if (resolved) break;
      await sleep(100);
    }
    return { ok: merged && resolved, merged, resolved };
  })()`);
  if (!batchResolveCheck.ok) {
    throw new Error(
      `batch sync resolve assertion failed: ${JSON.stringify(batchResolveCheck)}`,
    );
  }
  results.batchResolve = batchResolveCheck;

  const syncHistoryCheck = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const toggle = document.querySelector("[data-sync-history-toggle]");
    if (!toggle) return { ok: false, reason: "no history toggle" };
    toggle.click();
    let historySeen = false;
    let unionSeen = false;
    for (let i = 0; i < 20; i++) {
      const item = [...document.querySelectorAll("[data-sync-resolved-item]")].find((el) =>
        (el.textContent ?? "").includes("sprint 38 conflict override"),
      );
      historySeen =
        !!item && item.querySelector('[data-resolved-choice="remote"]') !== null;
      unionSeen = !!document.querySelector('[data-resolved-choice="union"]');
      if (historySeen && unionSeen) break;
      await sleep(100);
    }
    return { ok: historySeen && unionSeen, historySeen, unionSeen };
  })()`);
  if (!syncHistoryCheck.ok) {
    throw new Error(`sync history assertion failed: ${JSON.stringify(syncHistoryCheck)}`);
  }
  results.syncHistory = syncHistoryCheck;

  const structuredSyncCheck = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const historyToggle = document.querySelector("[data-sync-history-toggle]");
    if (historyToggle && document.querySelector("[data-sync-resolved-list]")) {
      historyToggle.click();
      await sleep(100);
    }
    const shape = JSON.parse(localStorage.getItem("ai-workbench:db:v1") ?? "{}");
    const base = (shape.clipboard ?? []).find((c) => c.id === "sync-clip-remote-fallback")
      ?? (shape.clipboard ?? [])[0];
    if (!base) return { ok: false, reason: "no base clipboard item" };
    const localContent = JSON.stringify({
      title: "Workbench",
      tags: ["work"],
      meta: { count: 1 },
      notes: [{ id: 1, label: "a" }],
    });
    const remoteContent = JSON.stringify({
      title: "Workbench",
      tags: ["work", "life"],
      meta: { count: 2, done: true },
      notes: [{ label: "a", id: 1 }, { id: 2, label: "b" }],
    });
    base.content = localContent;
    base.updatedAt = Date.now();
    base.timestamp = Date.now();
    localStorage.setItem("ai-workbench:db:v1", JSON.stringify(shape));
    const snapshot = {
      deviceId: "device-structured",
      exportedAt: Date.now(),
      clipboard: [
        {
          id: base.id,
          content: remoteContent,
          source: "remote",
          timestamp: Date.now(),
          updatedAt: Date.now() + 1,
        },
      ],
      logs: [],
    };
    localStorage.setItem("ai-workbench:sync-snapshot:v1", JSON.stringify(snapshot));
    const importBtn = document.querySelector('button[aria-label="Import sync snapshot"]');
    if (!importBtn) return { ok: false, reason: "no import button" };
    importBtn.click();
    let conflict = null;
    for (let i = 0; i < 30; i++) {
      conflict = document.querySelector("[data-sync-conflict-item]");
      if (conflict) break;
      await sleep(100);
    }
    if (!conflict) return { ok: false, reason: "no structured conflict" };
    const mergeBtn = conflict.querySelector("[data-resolve-structured]");
    if (!mergeBtn) return { ok: false, reason: "no structured merge button" };
    mergeBtn.click();
    let merged = false;
    let stored = "";
    let notesLength = 0;
    for (let i = 0; i < 30; i++) {
      const current = JSON.parse(localStorage.getItem("ai-workbench:db:v1") ?? "{}");
      const item = (current.clipboard ?? []).find((c) => c.id === base.id);
      stored = item?.content ?? "";
      try {
        notesLength = JSON.parse(stored).notes?.length ?? 0;
      } catch {}
      merged =
        stored.includes('"life"') &&
        stored.includes('"done": true') &&
        stored.includes('"count": 2') &&
        notesLength === 2 &&
        !document.querySelector("[data-sync-conflicts]");
      if (merged) break;
      await sleep(100);
    }
    return { ok: merged, stored, notesLength };
  })()`);
  if (!structuredSyncCheck.ok) {
    throw new Error(
      `structured sync merge assertion failed: ${JSON.stringify(structuredSyncCheck)}`,
    );
  }
  results.structuredSync = structuredSyncCheck;

  await send("Page.reload", { ignoreCache: true });
  await waitForApp();
  await clickDock("System");
  const syncHistoryPersisted = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let toggle = null;
    for (let i = 0; i < 20; i++) {
      toggle = document.querySelector("[data-sync-history-toggle]");
      if (toggle) break;
      await sleep(100);
    }
    if (!toggle) return { ok: false, reason: "no history toggle after reload" };
    toggle.click();
    let seen = false;
    for (let i = 0; i < 20; i++) {
      const item = [...document.querySelectorAll("[data-sync-resolved-item]")].find((el) =>
        (el.textContent ?? "").includes("sprint 38 conflict override"),
      );
      seen =
        !!item && item.querySelector('[data-resolved-choice="remote"]') !== null;
      if (seen) break;
      await sleep(100);
    }
    return { ok: seen, seen };
  })()`);
  if (!syncHistoryPersisted.ok) {
    throw new Error(
      `sync history persistence assertion failed: ${JSON.stringify(syncHistoryPersisted)}`,
    );
  }
  results.syncHistoryPersisted = syncHistoryPersisted;

  const syncAuditChart = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const chart = () => document.querySelector("[data-sync-audit-chart]");
    let bars = [];
    for (let i = 0; i < 30; i++) {
      bars = [...document.querySelectorAll("[data-sync-audit-bar]")];
      if (bars.length > 0) break;
      await sleep(100);
    }
    if (bars.length === 0) {
      let storedAudit = 0;
      let sample = null;
      let recomputedBuckets = 0;
      try {
        const entries = JSON.parse(localStorage.getItem("ai-workbench:sync-audit:v1") ?? "[]");
        storedAudit = entries.length;
        sample = entries[0] ?? null;
        const dayMs = 86_400_000;
        const groups = new Map();
        for (const entry of entries) {
          const startAt = Math.floor(entry.createdAt / dayMs) * dayMs;
          groups.set(startAt, (groups.get(startAt) ?? 0) + 1);
        }
        recomputedBuckets = groups.size;
      } catch {}
      return {
        ok: false,
        reason: "no audit chart bars",
        storedAudit,
        sample,
        recomputedBuckets,
        chartText: chart()?.textContent ?? "",
        summaryShown: chart()?.textContent?.includes("No activity") ?? false,
      };
    }
    const totalText = document.querySelector("[data-sync-audit-total]")?.textContent ?? "";
    const total = Number(totalText.replace(/[^0-9]/g, "") || 0);
    const barTotal = bars.reduce(
      (sum, bar) => sum + Number(bar.getAttribute("data-audit-count") || 0),
      0,
    );
    const countsMatch = total > 0 && barTotal === total;
    const dayAttr = chart()?.getAttribute("data-audit-granularity");
    document.querySelector("[data-audit-granularity-week]")?.click();
    let weekOk = false;
    let weekBars = 0;
    for (let i = 0; i < 20; i++) {
      await sleep(100);
      weekBars = document.querySelectorAll("[data-sync-audit-bar]").length;
      weekOk =
        chart()?.getAttribute("data-audit-granularity") === "week" && weekBars > 0;
      if (weekOk) break;
    }
    const weekTotalText = document.querySelector("[data-sync-audit-total]")?.textContent ?? "";
    const weekTotal = Number(weekTotalText.replace(/[^0-9]/g, "") || 0);
    document.querySelector("[data-audit-granularity-day]")?.click();
    await sleep(250);
    const dayRestored = chart()?.getAttribute("data-audit-granularity") === "day";
    return {
      ok: countsMatch && weekOk && weekTotal === total && dayRestored,
      total,
      barTotal,
      dayAttr,
      weekBars,
      weekTotal,
      dayRestored,
    };
  })()`);
  if (!syncAuditChart.ok) {
    throw new Error(`Sync audit chart assertion failed: ${JSON.stringify(syncAuditChart)}`);
  }
  results.syncAuditChart = syncAuditChart;

  const errorLogSeed = await evaluate(`(() => {
    const dayMs = 86_400_000;
    const startOfToday = Math.floor(Date.now() / dayMs) * dayMs;
    const shape = JSON.parse(localStorage.getItem("ai-workbench:db:v1") ?? "{}");
    shape.logs = [
      {
        id: "err-today",
        source: "frontend",
        message: "chart error today",
        stack: null,
        severity: "error",
        timestamp: startOfToday + 1000,
        updatedAt: startOfToday + 1000,
        deviceId: "device-local",
      },
      {
        id: "warn-yesterday",
        source: "tauri",
        message: "chart warning yesterday",
        stack: null,
        severity: "warning",
        timestamp: startOfToday - dayMs + 5000,
        updatedAt: startOfToday - dayMs + 5000,
        deviceId: "device-remote",
      },
      {
        id: "info-yesterday",
        source: "frontend",
        message: "chart info yesterday",
        stack: null,
        severity: "info",
        timestamp: startOfToday - dayMs + 6000,
        updatedAt: startOfToday - dayMs + 6000,
        deviceId: "device-local",
      },
      {
        id: "err-week",
        source: "tauri",
        message: "chart error week ago",
        stack: null,
        severity: "error",
        timestamp: startOfToday - dayMs * 7 + 2000,
        updatedAt: startOfToday - dayMs * 7 + 2000,
        deviceId: "device-remote",
      },
    ];
    shape.syncDeviceId = "device-local";
    localStorage.setItem("ai-workbench:db:v1", JSON.stringify(shape));
    return { ok: true, seeded: shape.logs.length };
  })()`);
  await send("Page.reload", { ignoreCache: true });
  await waitForApp();
  await clickDock("System");
  const errorLogTrend = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const chart = () => document.querySelector("[data-error-log-chart]");
    let bars = [];
    for (let i = 0; i < 30; i++) {
      bars = [...document.querySelectorAll("[data-error-log-bar]")];
      if (bars.length > 0) break;
      await sleep(100);
    }
    if (bars.length === 0) {
      return {
        ok: false,
        reason: "no error log chart bars",
        chartText: chart()?.textContent ?? "",
      };
    }
    const totalText = document.querySelector("[data-error-log-total]")?.textContent ?? "";
    const total = Number(totalText.replace(/[^0-9]/g, "") || 0);
    const barTotal = bars.reduce(
      (sum, bar) => sum + Number(bar.getAttribute("data-error-count") || 0),
      0,
    );
    const errorCount = bars.reduce(
      (sum, bar) => sum + Number(bar.getAttribute("data-error-severity-error") || 0),
      0,
    );
    const warningCount = bars.reduce(
      (sum, bar) => sum + Number(bar.getAttribute("data-error-severity-warning") || 0),
      0,
    );
    const infoCount = bars.reduce(
      (sum, bar) => sum + Number(bar.getAttribute("data-error-severity-info") || 0),
      0,
    );
    const countsMatch =
      total === 4 && barTotal === 4 && errorCount === 2 && warningCount === 1 && infoCount === 1;
    const dayAttr = chart()?.getAttribute("data-error-granularity");
    document.querySelector("[data-error-granularity-week]")?.click();
    let weekOk = false;
    let weekBars = 0;
    for (let i = 0; i < 20; i++) {
      await sleep(100);
      weekBars = document.querySelectorAll("[data-error-log-bar]").length;
      weekOk = chart()?.getAttribute("data-error-granularity") === "week" && weekBars === 2;
      if (weekOk) break;
    }
    const weekTotalText = document.querySelector("[data-error-log-total]")?.textContent ?? "";
    const weekTotal = Number(weekTotalText.replace(/[^0-9]/g, "") || 0);
    const select = document.querySelector("[data-error-severity-filter]");
    let filterOk = false;
    let filteredTotal = 0;
    if (select) {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
      setter.call(select, "error");
      select.dispatchEvent(new Event("change", { bubbles: true }));
      for (let i = 0; i < 20; i++) {
        filteredTotal = Number(
          document.querySelector("[data-error-log-total]")?.textContent.replace(/[^0-9]/g, "") || 0,
        );
        filterOk =
          filteredTotal === 2 &&
          [...document.querySelectorAll("[data-error-log-bar]")].every(
            (bar) =>
              Number(bar.getAttribute("data-error-severity-warning") || 0) === 0 &&
              Number(bar.getAttribute("data-error-severity-info") || 0) === 0,
          );
        if (filterOk) break;
        await sleep(100);
      }
      setter.call(select, "all");
      select.dispatchEvent(new Event("change", { bubbles: true }));
      await sleep(200);
    }
    document.querySelector("[data-error-granularity-day]")?.click();
    await sleep(250);
    const dayRestored = chart()?.getAttribute("data-error-granularity") === "day";
    return {
      ok: countsMatch && weekOk && weekTotal === 4 && filterOk && dayRestored,
      total,
      barTotal,
      errorCount,
      warningCount,
      infoCount,
      dayAttr,
      weekBars,
      weekTotal,
      filterOk,
      filteredTotal,
      dayRestored,
      seedOk: true,
    };
  })()`);
  if (!errorLogTrend.ok) {
    throw new Error(`Error log trend assertion failed: ${JSON.stringify(errorLogTrend)}`);
  }
  results.errorLogTrend = errorLogTrend;

  const errorLogSourceDevice = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const setSelect = (selector, value) => {
      const el = document.querySelector(selector);
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
      setter.call(el, value);
      el.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const readTotal = () =>
      Number(document.querySelector("[data-error-log-total]")?.textContent.replace(/[^0-9]/g, "") || 0);
    const readRows = () => [...document.querySelectorAll("[data-error-log-device]")].length;
    const waitFor = async (total) => {
      for (let i = 0; i < 20; i++) {
        if (readTotal() === total) return true;
        await sleep(100);
      }
      return false;
    };
    const sourceSelect = document.querySelector("[data-error-source-filter]");
    const deviceSelect = document.querySelector("[data-error-device-filter]");
    if (!sourceSelect || !deviceSelect) {
      return { ok: false, reason: "missing error source/device filters" };
    }
    const initialTotal = readTotal();
    const initialRows = readRows();

    setSelect("[data-error-source-filter]", "frontend");
    const frontendOk = (await waitFor(2)) && readRows() === 2;
    const frontendRowsOk = [...document.querySelectorAll("[data-error-log-source]")].every(
      (row) => row.getAttribute("data-error-log-source") === "frontend",
    );

    setSelect("[data-error-source-filter]", "all");
    await waitFor(4);
    setSelect("[data-error-device-filter]", "current");
    const currentOk = (await waitFor(2)) && readRows() === 2;
    const currentRowsOk = [...document.querySelectorAll("[data-error-log-device]")].every(
      (row) => row.getAttribute("data-error-log-device") === "device-local",
    );

    setSelect("[data-error-source-filter]", "frontend");
    const comboLocalOk = (await waitFor(2)) && readRows() === 2;
    setSelect("[data-error-source-filter]", "tauri");
    const comboLocalEmptyOk = (await waitFor(0)) && readRows() === 0;
    setSelect("[data-error-device-filter]", "device-remote");
    const comboRemoteOk = (await waitFor(2)) && readRows() === 2;
    const comboRemoteRowsOk =
      [...document.querySelectorAll("[data-error-log-source]")].length === 2 &&
      [...document.querySelectorAll("[data-error-log-source]")].every(
        (row) => row.getAttribute("data-error-log-source") === "tauri",
      ) &&
      [...document.querySelectorAll("[data-error-log-device]")].every(
        (row) => row.getAttribute("data-error-log-device") === "device-remote",
      );

    setSelect("[data-error-source-filter]", "all");
    setSelect("[data-error-device-filter]", "all");
    const restored = await waitFor(4);
    const ok =
      initialTotal === 4 &&
      initialRows === 4 &&
      frontendOk &&
      frontendRowsOk &&
      currentOk &&
      currentRowsOk &&
      comboLocalOk &&
      comboLocalEmptyOk &&
      comboRemoteOk &&
      comboRemoteRowsOk &&
      restored;
    return {
      ok,
      initialTotal,
      initialRows,
      frontendOk,
      currentOk,
      comboLocalOk,
      comboLocalEmptyOk,
      comboRemoteOk,
      restored,
    };
  })()`);
  if (!errorLogSourceDevice.ok) {
    throw new Error(
      `Error log source/device filter assertion failed: ${JSON.stringify(errorLogSourceDevice)}`,
    );
  }
  results.errorLogSourceDevice = errorLogSourceDevice;

  const syncAuditCheck = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let items = [...document.querySelectorAll("[data-sync-audit-item]")];
    for (let i = 0; i < 30 && items.length < 3; i++) {
      await sleep(100);
      items = [...document.querySelectorAll("[data-sync-audit-item]")];
    }
    const text = items.map((el) => el.textContent ?? "").join(" | ");
    const mergeSeen = text.includes("sync.merge");
    const resolveSeen = text.includes("sync.resolve");
    const filter = document.querySelector("[data-sync-audit-filter]");
    const jsonBtn = document.querySelector("[data-sync-audit-export-json]");
    if (!filter || !jsonBtn) {
      return {
        ok: false,
        reason: "no sync audit filter or export",
        mergeSeen,
        resolveSeen,
        count: items.length,
      };
    }
    filter.value = "sync.resolve";
    filter.dispatchEvent(new Event("change", { bubbles: true }));
    let filteredItems = [];
    for (let i = 0; i < 30; i++) {
      await sleep(100);
      filteredItems = [...document.querySelectorAll("[data-sync-audit-item]")];
      const allResolve =
        filteredItems.length > 0 &&
        filteredItems.every(
          (el) => el.querySelector("[data-sync-audit-event]")?.textContent === "sync.resolve",
        );
      if (allResolve) break;
    }
    const filterOk =
      filteredItems.length > 0 &&
      filteredItems.every(
        (el) => el.querySelector("[data-sync-audit-event]")?.textContent === "sync.resolve",
      );
    const sinceSelect = document.querySelector("[data-sync-audit-since]");
    const deviceSelect = document.querySelector("[data-sync-audit-device]");
    if (!sinceSelect || !deviceSelect) {
      return {
        ok: false,
        reason: "no sync audit range controls",
        mergeSeen,
        resolveSeen,
        filterOk,
      };
    }
    sinceSelect.value = "today";
    sinceSelect.dispatchEvent(new Event("change", { bubbles: true }));
    let rangeItems = [];
    for (let i = 0; i < 20; i++) {
      await sleep(100);
      rangeItems = [...document.querySelectorAll("[data-sync-audit-item]")];
      const allResolve =
        rangeItems.length > 0 &&
        rangeItems.every(
          (el) => el.querySelector("[data-sync-audit-event]")?.textContent === "sync.resolve",
        );
      if (allResolve) break;
    }
    const rangeOk =
      rangeItems.length > 0 &&
      rangeItems.every(
        (el) => el.querySelector("[data-sync-audit-event]")?.textContent === "sync.resolve",
      );
    sinceSelect.value = "custom";
    sinceSelect.dispatchEvent(new Event("change", { bubbles: true }));
    await sleep(150);
    const fromInput = document.querySelector("[data-sync-audit-from]");
    const toInput = document.querySelector("[data-sync-audit-to]");
    let customOk = false;
    if (fromInput && toInput) {
      const pad = (n) => String(n).padStart(2, "0");
      const day = (offset) => {
        const d = new Date(Date.now() + offset * 86400000);
        return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
      };
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(fromInput, day(-1));
      fromInput.dispatchEvent(new Event("input", { bubbles: true }));
      fromInput.dispatchEvent(new Event("change", { bubbles: true }));
      setter.call(toInput, day(0));
      toInput.dispatchEvent(new Event("input", { bubbles: true }));
      toInput.dispatchEvent(new Event("change", { bubbles: true }));
      let customItems = [];
      for (let i = 0; i < 20; i++) {
        await sleep(100);
        customItems = [...document.querySelectorAll("[data-sync-audit-item]")];
        if (customItems.length > 0) break;
      }
      const inRange = customItems.length > 0;
      setter.call(fromInput, day(1));
      fromInput.dispatchEvent(new Event("input", { bubbles: true }));
      fromInput.dispatchEvent(new Event("change", { bubbles: true }));
      await sleep(300);
      customOk = inRange && document.querySelectorAll("[data-sync-audit-item]").length === 0;
    }
    sinceSelect.value = "all";
    sinceSelect.dispatchEvent(new Event("change", { bubbles: true }));
    await sleep(250);
    deviceSelect.value = "all";
    deviceSelect.dispatchEvent(new Event("change", { bubbles: true }));
    await sleep(200);
    jsonBtn.click();
    let exportedText = "";
    for (let i = 0; i < 20; i++) {
      await sleep(100);
      exportedText = document.querySelector("[data-sync-audit-exported]")?.textContent ?? "";
      if (exportedText) break;
    }
    const exportOk = /Exported [1-9]\\d* sync audit event\\(s\\)/.test(exportedText);
    filter.value = "all";
    filter.dispatchEvent(new Event("change", { bubbles: true }));
    await sleep(250);
    const clearBtn = document.querySelector("[data-sync-audit-clear]");
    if (!clearBtn) {
      return {
        ok: false,
        reason: "no sync audit clear button",
        mergeSeen,
        resolveSeen,
        filterOk,
        exportOk,
        count: items.length,
      };
    }
    clearBtn.click();
    await sleep(300);
    const cleared = document.querySelectorAll("[data-sync-audit-item]").length === 0;
    return {
      ok: mergeSeen && resolveSeen && filterOk && rangeOk && customOk && exportOk && cleared,
      mergeSeen,
      resolveSeen,
      filterOk,
      rangeOk,
      customOk,
      exportOk,
      cleared,
      count: items.length,
      filteredCount: filteredItems.length,
      exportedText,
    };
  })()`);
  if (!syncAuditCheck.ok) {
    throw new Error(`Sync audit assertion failed: ${JSON.stringify(syncAuditCheck)}`);
  }
  results.syncAudit = syncAuditCheck;

  const autoSyncCheck = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 20; i++) {
      const url = document.querySelector('input[placeholder="Remote URL"]')?.value ?? "";
      if (url.trim()) break;
      await sleep(100);
    }
    const urlInput = document.querySelector('input[placeholder="Remote URL"]');
    if (urlInput && !(urlInput.value ?? "").trim()) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(urlInput, "https://sync.example.test/workbench");
      urlInput.dispatchEvent(new Event("input", { bubbles: true }));
      await sleep(200);
    }
    const toggle = document.querySelector('[data-auto-sync]');
    if (!toggle) return { ok: false, reason: "no auto sync toggle" };
    const initialState = toggle.getAttribute("data-auto-sync");
    if (initialState === "on") {
      toggle.click();
      await sleep(200);
    }
    document.querySelector('[data-auto-sync]')?.click();
    let enabled = false;
    for (let i = 0; i < 20; i++) {
      const msg = document.querySelector("[data-sync-message]")?.textContent ?? "";
      enabled =
        document.querySelector('[data-auto-sync]')?.getAttribute("data-auto-sync") === "on" &&
        msg.includes("Auto sync enabled");
      if (enabled) break;
      await sleep(100);
    }
    document.querySelector('[data-auto-sync]')?.click();
    let disabled = false;
    for (let i = 0; i < 20; i++) {
      const msg = document.querySelector("[data-sync-message]")?.textContent ?? "";
      disabled =
        document.querySelector('[data-auto-sync]')?.getAttribute("data-auto-sync") === "off" &&
        msg.includes("Auto sync disabled");
      if (disabled) break;
      await sleep(100);
    }
    return {
      ok: enabled && disabled,
      enabled,
      disabled,
      initialState,
      remoteUrl: document.querySelector('input[placeholder="Remote URL"]')?.value ?? "",
      autoConfigRaw: localStorage.getItem("ai-workbench:sync-auto:v1") ?? "",
      finalState: document.querySelector('[data-auto-sync]')?.getAttribute("data-auto-sync") ?? "",
      finalMsg: document.querySelector("[data-sync-message]")?.textContent ?? "",
    };
  })()`);
  if (!autoSyncCheck.ok) {
    throw new Error(`auto sync assertion failed: ${JSON.stringify(autoSyncCheck)}`);
  }
  results.autoSync = autoSyncCheck;

  await setViewport(390, 844);
  await clickDock("AI Studio");
  results.mobileShot = await capture(`${SHOT_PREFIX}-mobile-ai-studio.png`);
  results.motion.mobileOverflowX = await evaluate(
    `document.documentElement.scrollWidth - document.documentElement.clientWidth`,
  );
  if (results.motion.mobileOverflowX > 1) {
    throw new Error(`mobile horizontal overflow: ${results.motion.mobileOverflowX}px`);
  }

  await setViewport(1440, 900);
  await send("Page.reload", { ignoreCache: true });
  await waitForApp();
  await clickDock("AI Studio");
  const sessionPersistence = await evaluate(`(async () => {
    let pill = 0;
    for (let i = 0; i < 30; i++) {
      pill = document.querySelectorAll('main button[aria-label="Open session"]').length;
      const text = document.body.innerText;
      if (pill > 0 && text.includes("sprint RAG check") && text.includes("Streaming fallback")) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    const finalText = document.body.innerText;
    return {
      hasSessionPill: pill > 0,
      hasUserMessage: finalText.includes("sprint RAG check"),
      hasAssistantReply: finalText.includes("Streaming fallback"),
      hasStoppedMessage: finalText.includes("[stopped]"),
    };
  })()`);
  if (
    !sessionPersistence.hasSessionPill ||
    !sessionPersistence.hasUserMessage ||
    !sessionPersistence.hasAssistantReply ||
    !sessionPersistence.hasStoppedMessage
  ) {
    throw new Error(`AI Studio session persistence assertion failed: ${JSON.stringify(sessionPersistence)}`);
  }
  results.sessionPersistence = sessionPersistence;

  const sessionManagement = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const setValue = (el, value) => {
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const searchInput = document.querySelector('input[placeholder="Search sessions..."]');
    if (!searchInput) return { ok: false, reason: "no session search input" };
    setValue(searchInput, "sprint RAG");
    await sleep(250);
    const searchPills = document.querySelectorAll('main button[aria-label="Open session"]').length;
    const searchMatched = [...document.querySelectorAll("main aside button[aria-label='Open session']")]
      .some((btn) => btn.textContent?.includes("sprint RAG check"));
    setValue(searchInput, "zzz-no-match");
    await sleep(250);
    const emptyState = document.body.innerText.includes("No matching sessions");
    setValue(searchInput, "");
    await sleep(250);

    const row = [...document.querySelectorAll("main aside button[aria-label='Open session']")]
      .map((btn) => btn.parentElement)
      .find((el) => el?.textContent?.includes("sprint RAG check"));
    if (!row) return { ok: false, reason: "target session row missing", searchPills, searchMatched, emptyState };
    const renameBtn = row.querySelector('button[aria-label="Rename session"]');
    if (!renameBtn) return { ok: false, reason: "rename button missing" };
    renameBtn.click();
    await sleep(200);
    const renameInput = document.querySelector('input[aria-label="Rename session input"]');
    if (!renameInput) return { ok: false, reason: "rename input missing" };
    setValue(renameInput, "Sprint 12 renamed");
    renameInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await sleep(300);
    const renamedVisible = document.body.innerText.includes("Sprint 12 renamed");
    const oldTitleGone = ![...document.querySelectorAll("main aside button[aria-label='Open session']")]
      .some((btn) => btn.textContent?.includes("sprint RAG check"));

    const renamedRow = [...document.querySelectorAll("main aside button[aria-label='Open session']")]
      .map((btn) => btn.parentElement)
      .find((el) => el?.textContent?.includes("Sprint 12 renamed"));
    if (!renamedRow) return { ok: false, reason: "renamed row missing", renamedVisible, oldTitleGone };
    renamedRow.querySelector('button[aria-label="Delete session"]')?.click();
    await sleep(200);
    const confirmBtn = renamedRow.querySelector('button[aria-label="Confirm delete session"]');
    if (!confirmBtn) return { ok: false, reason: "delete confirm missing" };
    confirmBtn.click();
    await sleep(350);
    const deletedGone = !document.body.innerText.includes("Sprint 12 renamed");
    const persistedMessages = (() => {
      const shape = JSON.parse(localStorage.getItem("ai-workbench:db:v1"));
      const remainingSessionIds = new Set((shape.sessions ?? []).map((s) => s.id));
      return shape.chatMessages.filter((m) => !remainingSessionIds.has(m.sessionId)).length;
    })();
    return {
      ok: true,
      searchPills,
      searchMatched,
      emptyState,
      renamedVisible,
      oldTitleGone,
      deletedGone,
      persistedMessages,
    };
  })()`);
  if (
    !sessionManagement.ok ||
    sessionManagement.searchPills < 1 ||
    !sessionManagement.searchMatched ||
    !sessionManagement.emptyState ||
    !sessionManagement.renamedVisible ||
    !sessionManagement.oldTitleGone ||
    !sessionManagement.deletedGone ||
    sessionManagement.persistedMessages !== 0
  ) {
    throw new Error(`AI Studio session management assertion failed: ${JSON.stringify(sessionManagement)}`);
  }
  results.sessionManagement = sessionManagement;

  await clickDock("System");
  const providerToggled = await evaluate(`(async () => {
    const card = [...document.querySelectorAll(".provider-card")].find((c) => c.textContent?.includes("OpenAI"));
    if (!card) return { ok: false, reason: "openai card missing" };
    const disable = [...card.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Disable");
    if (!disable) return { ok: false, reason: "disable button missing" };
    disable.click();
    await new Promise((r) => setTimeout(r, 350));
    return { ok: true, text: card.textContent };
  })()`);
  if (!providerToggled.ok || !providerToggled.text.includes("Enable")) {
    throw new Error(`provider toggle assertion failed: ${JSON.stringify(providerToggled)}`);
  }
  await clickDock("AI Studio");
  const autoRoute = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const autoBtn = [...document.querySelectorAll("main button")].find((b) => b.textContent?.trim() === "Auto");
    if (!autoBtn) return { ok: false, reason: "auto button missing" };
    autoBtn.click();
    await sleep(150);
    const input = document.querySelector('textarea[placeholder="Ask anything..."]');
    if (!input) return { ok: false, reason: "no chat input" };
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    setter.call(input, "auto route check");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await sleep(80);
    document.querySelector('main button[aria-label="Send"]')?.click();
    let routed = "";
    let reply = false;
    for (let i = 0; i < 40; i++) {
      routed = document.querySelector(".model-badge, [class*='rounded-full']")?.textContent ?? document.body.innerText;
      reply = document.body.innerText.includes("Streaming fallback") || document.body.innerText.includes("Browser fallback");
      if (routed.includes("auto →") && reply) break;
      await sleep(100);
    }
    const bodyText = document.body.innerText;
    let inspectorText = document.querySelector("aside.drawer-panel")?.innerText ?? "";
    for (let i = 0; i < 20 && !inspectorText.includes("auto → Ollama"); i++) {
      await sleep(100);
      inspectorText = document.querySelector("aside.drawer-panel")?.innerText ?? "";
    }
    return {
      ok: true,
      routed,
      reply,
      autoBadgeVisible: bodyText.includes("auto → Ollama"),
      inspectorShowsRouter: inspectorText.includes("ROUTER") && inspectorText.includes("auto → Ollama"),
      inspectorText: inspectorText.slice(0, 200),
    };
  })()`);
  if (
    !autoRoute.ok ||
    !autoRoute.autoBadgeVisible ||
    !autoRoute.reply ||
    !autoRoute.inspectorShowsRouter
  ) {
    throw new Error(`AI Studio auto route assertion failed: ${JSON.stringify(autoRoute)}`);
  }
  results.autoRoute = autoRoute;

  const singleBtn = await evaluate(`(() => {
    const btn = [...document.querySelectorAll("main button")].find((b) => b.textContent?.trim() === "Single");
    if (!btn) return false;
    btn.click();
    return true;
  })()`);
  if (!singleBtn) throw new Error("Single mode button missing before edit test");
  const messageEdit = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const setValue = (el, value) => {
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const input = document.querySelector('textarea[placeholder="Ask anything..."]');
    setValue(input, "sprint 14 edit check");
    await sleep(80);
    document.querySelector('main button[aria-label="Send"]')?.click();
    let userSeen = false;
    for (let i = 0; i < 40; i++) {
      if (document.body.innerText.includes("sprint 14 edit check")) {
        userSeen = true;
        break;
      }
      await sleep(100);
    }
    let replySeen = false;
    for (let i = 0; i < 40; i++) {
      if (
        [...document.querySelectorAll(".message-in")].some(
          (el) => el.classList.contains("message-in") && el.textContent?.includes("Streaming fallback") && !el.parentElement?.textContent?.includes("auto route check"),
        )
      ) {
        replySeen = true;
        break;
      }
      await sleep(100);
    }
    let streamIdle = false;
    for (let i = 0; i < 40; i++) {
      const noBusy = !document.querySelector(".stream-caret") && !document.querySelector(".thinking-dot");
      const noPlaceholder = ![...document.querySelectorAll(".message-in")].some((el) => el.textContent?.startsWith("__stream__"));
      if (noBusy && noPlaceholder) {
        streamIdle = true;
        break;
      }
      await sleep(100);
    }
    const group = [...document.querySelectorAll(".message-in")]
      .map((el) => el.parentElement)
      .find((el) => el?.textContent?.includes("sprint 14 edit check"));
    if (!group || !userSeen) {
      const dump = [...document.querySelectorAll(".message-in")].map((el) => el.textContent.slice(0, 80));
      return { ok: false, reason: "user message group missing", userSeen, replySeen, streamIdle, dump };
    }
    const editBtn = group.querySelector('button[aria-label="Edit message"]');
    if (!editBtn) {
      return {
        ok: false,
        reason: "edit button missing",
        replySeen,
        groupText: group.textContent,
        groupButtons: [...group.querySelectorAll("button[aria-label]")].map((b) => b.getAttribute("aria-label")),
      };
    }
    editBtn.click();
    await sleep(300);
    const editInput = document.querySelector('textarea[aria-label="Edit message input"]');
    if (!editInput) {
      const editButtons = [...document.querySelectorAll('button[aria-label="Edit message"]')].length;
      const groups = [...document.querySelectorAll(".message-in")].map((el) => ({
        text: el.textContent.slice(0, 50),
        buttons: [...(el.parentElement?.querySelectorAll("button[aria-label]") ?? [])].map((b) => b.getAttribute("aria-label")),
      }));
      return { ok: false, reason: "edit input missing", replySeen, editButtons, groups };
    }
    setValue(editInput, "sprint 14 edited text");
    await sleep(120);
    document.querySelector('button[aria-label="Save message edit"]')?.click();
    await sleep(300);
    const editedVisible = document.body.innerText.includes("sprint 14 edited text");
    const oldTextGone = !document.body.innerText.includes("sprint 14 edit check");

    const historyGroup = [...document.querySelectorAll(".message-in")]
      .map((el) => el.parentElement)
      .find((el) => el?.textContent?.includes("sprint 14 edited text"));
    if (!historyGroup) {
      return { ok: false, reason: "edited group missing before history", replySeen, editedVisible, oldTextGone };
    }
    historyGroup.querySelector('button[aria-label="Open message history"]')?.click();
    let historySeen = false;
    for (let i = 0; i < 20; i++) {
      const panel = document.querySelector(".version-panel");
      if (panel?.textContent?.includes("sprint 14 edit check")) {
        historySeen = true;
        break;
      }
      await sleep(100);
    }
    const restoreBtn = document.querySelector('button[aria-label="Restore version 1"]');
    if (!historySeen || !restoreBtn) {
      const shape = JSON.parse(localStorage.getItem("ai-workbench:db:v1") ?? "{}");
      return {
        ok: false,
        reason: "version history missing",
        historySeen,
        editedVisible,
        oldTextGone,
        panel: document.querySelector(".version-panel")?.textContent ?? "",
        messages: (shape.chatMessages ?? []).map((m) => ({ id: m.id, content: m.content })),
        versions: (shape.messageVersions ?? []).map((v) => ({ id: v.id, messageId: v.messageId, content: v.content })),
      };
    }
    const graph = document.querySelector(".version-graph");
    const graphOk =
      !!graph &&
      graph.textContent?.includes("Version graph") &&
      graph.querySelectorAll(".version-node").length >= 2 &&
      graph.textContent.includes("current") &&
      graph.textContent.includes("root");
    document.querySelector('button[aria-label="Compare version 1 with current"]')?.click();
    let diffSeen = false;
    let diffCounts = "";
    for (let i = 0; i < 20; i++) {
      const diff = document.querySelector(".version-diff");
      const text = diff?.textContent ?? "";
      if (text.includes("sprint 14 edit check") && text.includes("sprint 14 edited text")) {
        diffSeen = true;
        diffCounts = text.includes("+1") && text.includes("-1") ? "+1 -1" : "";
        break;
      }
      await sleep(100);
    }
    if (!diffSeen) {
      const shape = JSON.parse(localStorage.getItem("ai-workbench:db:v1") ?? "{}");
      return {
        ok: false,
        reason: "version diff missing",
        historySeen,
        panel: document.querySelector(".version-panel")?.textContent ?? "",
        messages: (shape.chatMessages ?? []).map((m) => ({ id: m.id, content: m.content })),
        versions: (shape.messageVersions ?? []).map((v) => ({ id: v.id, messageId: v.messageId, content: v.content })),
      };
    }
    document.querySelector('button[aria-label="Compare version 1 with current"]')?.click();
    await sleep(150);
    restoreBtn.click();
    let restoredVisible = false;
    for (let i = 0; i < 20; i++) {
      if (
        [...document.querySelectorAll(".message-in")].some((el) =>
          el.textContent?.includes("sprint 14 edit check"),
        )
      ) {
        restoredVisible = true;
        break;
      }
      await sleep(100);
    }
    const editedGoneAfterRestore = ![...document.querySelectorAll(".message-in")].some((el) =>
      el.textContent?.includes("sprint 14 edited text"),
    );

    const restoredGroup = [...document.querySelectorAll(".message-in")]
      .map((el) => el.parentElement)
      .find((el) => el?.textContent?.includes("sprint 14 edit check"));
    if (!restoredGroup) {
      return { ok: false, reason: "restored group missing", restoredVisible, editedGoneAfterRestore };
    }
    restoredGroup.querySelector('button[aria-label="Edit message"]')?.click();
    await sleep(200);
    const reeditInput = document.querySelector('textarea[aria-label="Edit message input"]');
    if (!reeditInput) {
      return { ok: false, reason: "re-edit input missing", restoredVisible, editedGoneAfterRestore };
    }
    setValue(reeditInput, "sprint 14 edited text");
    await sleep(120);
    document.querySelector('button[aria-label="Save message edit"]')?.click();
    await sleep(300);
    const finalEditedVisible = document.body.innerText.includes("sprint 14 edited text");
    const finalOldTextGone = ![...document.querySelectorAll(".message-in")].some((el) =>
      el.textContent?.includes("sprint 14 edit check"),
    );

    const editedGroup = [...document.querySelectorAll(".message-in")]
      .map((el) => el.parentElement)
      .find((el) => el?.textContent?.includes("sprint 14 edited text"));
    if (!editedGroup) return { ok: false, reason: "edited group missing", replySeen, editedVisible, oldTextGone };
    editedGroup.querySelector('button[aria-label="Regenerate message"]')?.click();
    let regenerated = false;
    for (let i = 0; i < 40; i++) {
      const lastAssistant = [...document.querySelectorAll(".message-in")]
        .filter((el) => el.parentElement?.className.includes("self-start"))
        .pop();
      if (
        lastAssistant?.textContent?.includes("Streaming fallback") &&
        !lastAssistant.textContent.startsWith("__stream__") &&
        !document.querySelector(".thinking-dot") &&
        !document.querySelector(".stream-caret")
      ) {
        regenerated = true;
        break;
      }
      await sleep(100);
    }
    await sleep(500);
    const messagesAfter = [...document.querySelectorAll(".message-in")].map((el) => el.textContent);
    return {
      ok: true,
      replySeen,
      editedVisible,
      oldTextGone,
      historySeen,
      graphOk,
      diffSeen,
      diffCounts,
      restoredVisible,
      editedGoneAfterRestore,
      finalEditedVisible,
      finalOldTextGone,
      regenerated,
      messagesAfter,
    };
  })()`);
  if (
    !messageEdit.ok ||
    !messageEdit.replySeen ||
    !messageEdit.editedVisible ||
    !messageEdit.oldTextGone ||
    !messageEdit.historySeen ||
    !messageEdit.graphOk ||
    !messageEdit.diffSeen ||
    messageEdit.diffCounts !== "+1 -1" ||
    !messageEdit.restoredVisible ||
    !messageEdit.editedGoneAfterRestore ||
    !messageEdit.finalEditedVisible ||
    !messageEdit.finalOldTextGone ||
    !messageEdit.regenerated
  ) {
    throw new Error(`AI Studio message edit/regenerate assertion failed: ${JSON.stringify(messageEdit)}`);
  }
  results.messageEdit = messageEdit;

  const streamError = await evaluate(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const setValue = (el, value) => {
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const input = document.querySelector('textarea[placeholder="Ask anything..."]');
    if (!input) return { ok: false, reason: "no chat input" };
    setValue(input, "sprint 15 timeout check");
    await sleep(80);
    const sendBtn = document.querySelector('main button[aria-label="Send"]');
    if (!sendBtn) return { ok: false, reason: "no send button" };
    sendBtn.click();
    let statusSeen = false;
    for (let i = 0; i < 30; i++) {
      const status = document.querySelector(".stream-status");
      const caret = document.querySelector(".stream-caret") || document.querySelector(".thinking-dot");
      if (status || caret) statusSeen = true;
      if (document.querySelector('button[aria-label="Retry failed message"]')) break;
      await sleep(100);
    }
    const errorText = [...document.querySelectorAll(".message-in")].map((el) => el.textContent).join(" | ");
    const retryBtn = document.querySelector('button[aria-label="Retry failed message"]');
    return {
      ok: true,
      statusSeen,
      errorMapped: document.body.innerText.includes("Request timeout: provider did not respond in time"),
      errorMessageVisible: errorText.includes("Request timeout"),
      placeholderGone: ![...document.querySelectorAll(".message-in")].some((el) => el.textContent?.startsWith("__stream__")),
      hasRetry: !!retryBtn,
    };
  })()`);
  if (
    !streamError.ok ||
    !streamError.statusSeen ||
    !streamError.errorMapped ||
    !streamError.errorMessageVisible ||
    !streamError.placeholderGone ||
    !streamError.hasRetry
  ) {
    throw new Error(`AI Studio stream error mapping assertion failed: ${JSON.stringify(streamError)}`);
  }
  results.streamError = streamError;

  let liveServer = null;
  try {
    liveServer = http.createServer((req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }
      if (req.url === "/v1/chat/completions") {
        let raw = "";
        req.on("data", (chunk) => (raw += chunk));
        req.on("end", () => {
          const parsed = JSON.parse(raw || "{}");
          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          });
          res.write(`data: {"choices":[{"delta":{"content":"Live provider "}}]}\n\n`);
          res.write(`data: {"choices":[{"delta":{"content":"stream ok "}}]}\n\n`);
          res.write(`data: {"choices":[{"delta":{"content":"model=${parsed.model}"}}]}\n\n`);
          res.write("data: [DONE]\n\n");
          res.end();
        });
        return;
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise((resolve) => liveServer.listen(0, "127.0.0.1", resolve));
    const livePort = liveServer.address().port;
    await evaluate(`(() => {
      const shape = JSON.parse(localStorage.getItem("ai-workbench:db:v1") ?? "{}");
      shape.providers = [{
        id: "live-provider",
        name: "Live Mock",
        baseUrl: "http://127.0.0.1:${livePort}/v1",
        apiKey: "test-key",
        model: "mock-gpt",
        isActive: true,
      }];
      localStorage.setItem("ai-workbench:db:v1", JSON.stringify(shape));
      return true;
    })()`);
    await send("Page.reload", { ignoreCache: true });
    await waitForApp();
    const providerLiveStream = await evaluate(`(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const dock = [...document.querySelectorAll('nav button[aria-label]')]
        .find((b) => b.getAttribute("aria-label") === "AI Studio");
      if (!dock) return { ok: false, reason: "dock missing after reload" };
      dock.click();
      await sleep(350);
      const newChat = [...document.querySelectorAll("main button")]
        .find((b) => b.textContent?.trim() === "New chat");
      newChat?.click();
      await sleep(200);
      const input = document.querySelector('textarea[placeholder="Ask anything..."]');
      if (!input) return { ok: false, reason: "no chat input after reload" };
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      setter.call(input, "live stream check");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await sleep(100);
      const sendBtn = document.querySelector('main button[aria-label="Send"]');
      if (!sendBtn) return { ok: false, reason: "no send button" };
      sendBtn.click();
      let liveSeen = false;
      let modelSeen = false;
      for (let i = 0; i < 30; i++) {
        const body = document.body.innerText;
        liveSeen = body.includes("Live provider stream ok");
        modelSeen = body.includes("model=mock-gpt");
        if (liveSeen && modelSeen) break;
        await sleep(100);
      }
      await sleep(250);
      return {
        ok: liveSeen && modelSeen,
        liveSeen,
        modelSeen,
        busyGone: !document.querySelector(".thinking-dot") && !document.querySelector(".stream-caret"),
      };
    })()`);
    if (!providerLiveStream.ok || !providerLiveStream.busyGone) {
      throw new Error(`Provider live stream assertion failed: ${JSON.stringify(providerLiveStream)}`);
    }
    results.providerLiveStream = providerLiveStream;
  } finally {
    if (liveServer) liveServer.close();
  }

  let modelsServer = null;
  try {
    modelsServer = http.createServer((req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }
      if (req.url === "/v1/models") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            object: "list",
            data: [
              { id: "mock-gpt-4o", owned_by: "mockai" },
              { id: "mock-gpt-mini", owned_by: "mockai" },
              { id: "mock-reasoner", owned_by: "mockai" },
            ],
          }),
        );
        return;
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise((resolve) => modelsServer.listen(0, "127.0.0.1", resolve));
    const modelsPort = modelsServer.address().port;
    await evaluate(`(() => {
      const shape = JSON.parse(localStorage.getItem("ai-workbench:db:v1") ?? "{}");
      shape.providers = [
        {
          id: "models-provider",
          name: "Models Mock",
          baseUrl: "http://127.0.0.1:${modelsPort}/v1",
          apiKey: "test-key",
          model: "",
          isActive: true,
        },
        {
          id: "bad-models-provider",
          name: "Bad Models Mock",
          baseUrl: "http://127.0.0.1:1/v1",
          apiKey: "test-key",
          model: "",
          isActive: true,
        },
      ];
      localStorage.setItem("ai-workbench:db:v1", JSON.stringify(shape));
      return true;
    })()`);
    await send("Page.reload", { ignoreCache: true });
    await waitForApp();
    const providerModels = await evaluate(`(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const dock = [...document.querySelectorAll('nav button[aria-label]')]
        .find((b) => b.getAttribute("aria-label") === "System");
      if (!dock) return { ok: false, reason: "dock missing after reload" };
      dock.click();
      await sleep(350);
      const detect = document.querySelector(
        '[data-provider-id="models-provider"] [data-provider-models-detect]',
      );
      if (!detect) return { ok: false, reason: "no detect button" };
      detect.click();
      let options = [];
      for (let i = 0; i < 20; i++) {
        options = [...document.querySelectorAll("[data-provider-model-option]")]
          .map((b) => b.getAttribute("data-provider-model-option"))
          .filter(Boolean);
        if (options.length >= 3) break;
        await sleep(100);
      }
      const countBadge = document
        .querySelector('[data-provider-id="models-provider"] [data-provider-models]')
        ?.getAttribute("data-provider-models");
      if (options.length < 3) {
        return { ok: false, options, countBadge, reason: "options not loaded" };
      }
      const target = [...document.querySelectorAll("[data-provider-model-option]")]
        .find((b) => b.getAttribute("data-provider-model-option") === "mock-gpt-4o");
      target?.click();
      await sleep(350);
      const stored = JSON.parse(localStorage.getItem("ai-workbench:db:v1") ?? "{}").providers
        .find((p) => p.id === "models-provider");
      const badge = document
        .querySelector('[data-provider-id="models-provider"] [data-provider-model]')
        ?.textContent?.trim();
      const input = document.querySelector(
        '[data-provider-id="models-provider"] [data-provider-model-input]',
      );
      const badDetect = document.querySelector(
        '[data-provider-id="bad-models-provider"] [data-provider-models-detect]',
      );
      badDetect?.click();
      let errorText = "";
      for (let i = 0; i < 20; i++) {
        errorText = document
          .querySelector('[data-provider-id="bad-models-provider"] [data-provider-model-error]')
          ?.textContent?.trim() ?? "";
        if (errorText) break;
        await sleep(100);
      }
      return {
        ok:
          stored?.model === "mock-gpt-4o" &&
          badge === "live" &&
          input?.value === "mock-gpt-4o" &&
          errorText.length > 0,
        options,
        countBadge,
        model: stored?.model ?? "",
        badge,
        inputValue: input?.value ?? "",
        errorText,
      };
    })()`);
    if (!providerModels.ok) {
      throw new Error(`Provider models assertion failed: ${JSON.stringify(providerModels)}`);
    }
    results.providerModels = providerModels;
  } finally {
    if (modelsServer) modelsServer.close();
  }

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
    try {
      fs.rmSync(resolved, { recursive: true, force: true });
    } catch {
      await delay(1000);
      try {
        fs.rmSync(resolved, { recursive: true, force: true });
      } catch {}
    }
  }
}
