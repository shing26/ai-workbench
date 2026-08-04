import { spawn } from "node:child_process";
import fs from "node:fs";
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
  results.streaming = streamStarted;
  await evaluate(`document.querySelector('aside button[aria-label="Close inspector"]')?.click()`);
  await delay(250);

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

  await clickDock("Projects");
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
    const aside = document.querySelector('aside');
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
  results.motion.reducedMotion = await evaluate(`(() => ({
    viewAnimationDuration: getComputedStyle(document.querySelector('.view-enter')).animationDuration,
    dockTransitionDuration: getComputedStyle(document.querySelector('nav button')).transitionDuration,
  }))()`);
  await send("Emulation.setEmulatedMedia", { features: [] });

  const maxNav = durationSeconds(results.motion.navTransitionDuration);
  const maxView = durationSeconds(results.motion.viewAnimationDuration);
  const reducedView = durationSeconds(results.motion.reducedMotion.viewAnimationDuration);
  const reducedDock = durationSeconds(results.motion.reducedMotion.dockTransitionDuration);
  results.motion.pass =
    maxNav <= 0.16 &&
    maxView <= 0.16 &&
    results.motion.bodyOverflowX <= 1 &&
    layoutStable &&
    reducedView <= 0.02 &&
    reducedDock <= 0.02;
  if (!results.motion.pass) throw new Error("UI motion DoD assertion failed");

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
    const indexBtn = [...document.querySelectorAll("main button")].find((b) => b.textContent.trim() === "Index vault");
    if (!indexBtn) return { ok: false, reason: "no index button" };
    indexBtn.click();
    await new Promise((r) => setTimeout(r, 300));
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
    return { ok: true, filesVisible, fileResultVisible };
  })()`);
  if (!vaultIndex.ok || !vaultIndex.filesVisible || !vaultIndex.fileResultVisible) {
    throw new Error(`Vault index assertion failed: ${JSON.stringify(vaultIndex)}`);
  }
  results.vaultIndex = vaultIndex;
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
      return shape.chatMessages.filter((m) => m.content.includes("sprint RAG check") || m.content.includes("Streaming fallback")).length;
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
