export type TaskStatus = "todo" | "in_progress" | "done";

export type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  isToday: boolean;
  dueDate: string | null;
  createdAt: number;
};

export type Project = {
  id: string;
  name: string;
  path: string | null;
  revenue: number;
  status: string;
  createdAt: number;
};

export type ThoughtType = "inbox" | "note" | "doc";

export type Thought = {
  id: string;
  content: string;
  tags: string;
  type: ThoughtType;
  createdAt: number;
};

export type Session = {
  id: string;
  projectId: string | null;
  title: string;
  model: string;
  createdAt: number;
};

export type ChatMessage = {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  createdAt: number;
};

export type MessageVersion = {
  id: string;
  messageId: string;
  content: string;
  createdAt: number;
  parentVersionId: string | null;
};

export type MessageDiff = {
  added: string[];
  removed: string[];
};

export type Provider = {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  isActive: boolean;
};

export type ProviderHealth = {
  ok: boolean;
  latencyMs: number;
  message: string;
};

export type ProviderHeartbeatEntry = {
  id: string;
  name: string;
  ok: boolean;
  latencyMs: number;
  message: string;
  checked: boolean;
  consecutiveFailures: number;
  alert: boolean;
};

export type ProviderHeartbeatSnapshot = {
  providers: ProviderHeartbeatEntry[];
  alerts: ProviderHeartbeatEntry[];
  checkedAt: number;
};

export type Habit = {
  id: string;
  name: string;
  weekGoal: number;
  currentStreak: number;
  color: "emerald" | "blue" | "amber" | "rose";
  doneToday: boolean;
  createdAt: number;
};

export type ScheduleEvent = {
  id: string;
  title: string;
  startTime: string;
  done: boolean;
  tag: string;
  createdAt: number;
};

export type ClipboardItem = {
  id: string;
  content: string;
  source: string;
  timestamp: number;
  updatedAt: number;
};

export type ErrorLog = {
  id: string;
  source: string;
  message: string;
  stack: string | null;
  severity: string;
  timestamp: number;
  updatedAt: number;
};

export type SyncSnapshot = {
  deviceId: string;
  exportedAt: number;
  clipboard: ClipboardItem[];
  logs: ErrorLog[];
};

export type SyncResult = {
  deviceId: string;
  syncedAt: number;
  clipboardAdded: number;
  clipboardUpdated: number;
  logsAdded: number;
  logsUpdated: number;
};

export type SyncStatus = {
  deviceId: string;
  lastSyncedAt: number | null;
};

export type GitContext = {
  head: string;
  branch: string;
  commitCount: number;
  latestCommit: string;
  changes: string[];
};

export type RagSearchResult = {
  id: string;
  content: string;
  tags: string;
  type: ThoughtType;
  score: number;
};

export type RagIndexStatus = {
  documents: number;
  indexed: boolean;
  lastIndexedAt: number;
};

export type KnowledgeIndexStatus = {
  files: number;
  indexedAt: number;
};

export type IndexResult = {
  files: number;
};

const LS_KEY = "ai-workbench:db:v1";
const VAULT_LS_KEY = "ai-workbench:vault:v1";

type LocalShape = {
  tasks: Task[];
  projects: Project[];
  thoughts: Thought[];
  providers: Provider[];
  sessions: Session[];
  chatMessages: ChatMessage[];
  messageVersions: MessageVersion[];
  habits: Habit[];
  scheduleEvents: ScheduleEvent[];
  clipboard: ClipboardItem[];
  logs: ErrorLog[];
  syncDeviceId: string;
  lastSyncedAt: number;
};

const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

const makeId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`);

function emptyShape(): LocalShape {
  return {
    tasks: [],
    projects: [],
    thoughts: [],
    providers: [],
    sessions: [],
    chatMessages: [],
    messageVersions: [],
    habits: [],
    scheduleEvents: [],
    clipboard: [],
    logs: [],
    syncDeviceId: "",
    lastSyncedAt: 0,
  };
}

function seedShape(): LocalShape {
  const now = Date.now();
  const existing = readLocal();
  return {
    tasks: [
      { id: makeId(), title: "Ship App Shell", status: "in_progress", isToday: true, dueDate: null, createdAt: now - 3000 },
      { id: makeId(), title: "Review design tokens", status: "todo", isToday: true, dueDate: null, createdAt: now - 2000 },
      { id: makeId(), title: "Write Sprint 1 retro", status: "todo", isToday: false, dueDate: null, createdAt: now - 1000 },
    ],
    projects: [
      { id: makeId(), name: "AI Workbench", path: "D:\\ai-workbench", revenue: 0, status: "active", createdAt: now - 86400000 },
      { id: makeId(), name: "Hermes Station", path: "D:\\HermesData\\ai-workbench", revenue: 0, status: "paused", createdAt: now - 172800000 },
    ],
    thoughts: [
      { id: makeId(), content: "Keep the dock at exactly 5 views.", tags: "#work", type: "inbox", createdAt: now - 4000 },
      { id: makeId(), content: "# Sprint 3 笔记\n\n## 本周节奏\n\n- 早间：阅读 30 分钟\n- 下午：Sprint 验收\n\n```ts\nconst focus = tasks.filter(t => t.isToday);\n```\n\n> 先冻结范围，再写代码。", tags: "#work,#life", type: "note", createdAt: now - 3000 },
      { id: makeId(), content: "RAG index stays pending in Sprint 1.", tags: "#work,#life", type: "doc", createdAt: now - 2000 },
    ],
    providers: [
      { id: makeId(), name: "OpenAI", baseUrl: "https://api.openai.com/v1", apiKey: "OPENAI_API_KEY", isActive: true },
      { id: makeId(), name: "Ollama", baseUrl: "http://localhost:11434", apiKey: "", isActive: true },
      { id: makeId(), name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", apiKey: "OPENROUTER_API_KEY", isActive: false },
    ],
    sessions: [
      { id: makeId(), projectId: null, title: "Workbench planning", model: "openai", createdAt: now - 60000 },
    ],
    chatMessages: [],
    messageVersions: [],
    habits: [
      { id: makeId(), name: "晨间阅读", weekGoal: 5, currentStreak: 3, color: "emerald", doneToday: false, createdAt: now - 86400000 },
      { id: makeId(), name: "深水工作", weekGoal: 4, currentStreak: 2, color: "blue", doneToday: false, createdAt: now - 172800000 },
      { id: makeId(), name: "运动 30 分钟", weekGoal: 3, currentStreak: 5, color: "amber", doneToday: false, createdAt: now - 259200000 },
    ],
    scheduleEvents: [
      { id: makeId(), title: "每日复盘", startTime: "09:30", done: false, tag: "routine", createdAt: now - 3600000 },
      { id: makeId(), title: "Sprint 3 验收", startTime: "14:00", done: false, tag: "work", createdAt: now - 1800000 },
    ],
    clipboard: [
      { id: makeId(), content: "pnpm run dev", source: "terminal", timestamp: now - 5000, updatedAt: now - 5000 },
      { id: makeId(), content: "bg-[#18181C] border-white/10 rounded-2xl", source: "editor", timestamp: now - 4000, updatedAt: now - 4000 },
    ],
    logs: [
      { id: makeId(), source: "tauri", message: "DB initialized", stack: null, severity: "info", timestamp: now - 7000, updatedAt: now - 7000 },
    ],
    syncDeviceId: existing.syncDeviceId || makeId(),
    lastSyncedAt: existing.lastSyncedAt ?? 0,
  };
}

function readLocal(): LocalShape {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "") as LocalShape;
  } catch {
    return emptyShape();
  }
}

function writeLocal(shape: LocalShape) {
  localStorage.setItem(LS_KEY, JSON.stringify(shape));
}

export async function initDb(): Promise<void> {
  if (isTauri()) {
    await invoke("init_db");
    return;
  }
  if (!localStorage.getItem(LS_KEY)) writeLocal(seedShape());
}

export async function listTasks(): Promise<Task[]> {
  return isTauri() ? invoke<Task[]>("list_tasks") : readLocal().tasks;
}

export async function createTask(title: string, isToday: boolean): Promise<Task> {
  if (isTauri()) return invoke<Task>("create_task", { title, isToday });
  const shape = readLocal();
  const task: Task = { id: makeId(), title, status: "todo", isToday, dueDate: null, createdAt: Date.now() };
  shape.tasks.unshift(task);
  writeLocal(shape);
  return task;
}

export async function updateTaskStatus(id: string, status: TaskStatus): Promise<void> {
  if (isTauri()) {
    await invoke("update_task_status", { id, status });
    return;
  }
  const shape = readLocal();
  const task = shape.tasks.find((t) => t.id === id);
  if (task) task.status = status;
  writeLocal(shape);
}

export async function setTaskToday(id: string, isToday: boolean): Promise<void> {
  if (isTauri()) {
    await invoke("set_task_today", { id, isToday });
    return;
  }
  const shape = readLocal();
  const task = shape.tasks.find((t) => t.id === id);
  if (task) task.isToday = isToday;
  writeLocal(shape);
}

export async function listProjects(): Promise<Project[]> {
  return isTauri() ? invoke<Project[]>("list_projects") : readLocal().projects;
}

export async function createProject(name: string, path: string): Promise<Project> {
  if (isTauri()) return invoke<Project>("create_project", { name, path });
  const shape = readLocal();
  const project: Project = { id: makeId(), name, path: path || null, revenue: 0, status: "active", createdAt: Date.now() };
  shape.projects.unshift(project);
  writeLocal(shape);
  return project;
}

export async function listThoughts(): Promise<Thought[]> {
  return isTauri() ? invoke<Thought[]>("list_thoughts") : readLocal().thoughts;
}

export async function createThought(content: string, tags: string, type: ThoughtType): Promise<Thought> {
  if (isTauri()) return invoke<Thought>("create_thought", { content, tags, type });
  const shape = readLocal();
  const thought: Thought = { id: makeId(), content, tags, type, createdAt: Date.now() };
  shape.thoughts.unshift(thought);
  writeLocal(shape);
  return thought;
}

export async function listProviders(): Promise<Provider[]> {
  return isTauri() ? invoke<Provider[]>("list_providers") : readLocal().providers;
}

export async function createProvider(name: string, baseUrl: string, apiKey: string): Promise<Provider> {
  if (isTauri()) return invoke<Provider>("create_provider", { name, baseUrl, apiKey });
  const shape = readLocal();
  const provider: Provider = { id: makeId(), name, baseUrl, apiKey, isActive: false };
  shape.providers.unshift(provider);
  writeLocal(shape);
  return provider;
}

export async function setProviderActive(id: string, isActive: boolean): Promise<void> {
  if (isTauri()) {
    await invoke("set_provider_active", { id, isActive });
    return;
  }
  const shape = readLocal();
  const provider = shape.providers.find((p) => p.id === id);
  if (provider) provider.isActive = isActive;
  writeLocal(shape);
}

export async function checkProviderHealth(providerId: string): Promise<ProviderHealth> {
  if (isTauri()) return invoke<ProviderHealth>("check_provider_health", { providerId });
  await new Promise((resolve) => setTimeout(resolve, 120));
  return { ok: true, latencyMs: 120, message: "ok" };
}

const localHeartbeatHandlers = new Set<(snapshot: ProviderHeartbeatSnapshot) => void>();

function emitLocalHeartbeat(snapshot: ProviderHeartbeatSnapshot) {
  for (const handler of localHeartbeatHandlers) handler(snapshot);
}

export async function runProviderHeartbeat(providerIds?: string[]): Promise<ProviderHeartbeatSnapshot> {
  if (isTauri()) {
    return invoke<ProviderHeartbeatSnapshot>("run_provider_heartbeat", {
      providerIds: providerIds ?? [],
    });
  }
  const providers = await listProviders();
  const entries: ProviderHeartbeatEntry[] = providers.map((p) => {
    if (p.name === "Ollama") {
      return {
        id: p.id,
        name: p.name,
        ok: false,
        latencyMs: 0,
        message: "Connection failed: provider unreachable",
        checked: true,
        consecutiveFailures: 2,
        alert: true,
      };
    }
    return {
      id: p.id,
      name: p.name,
      ok: true,
      latencyMs: 80 + p.name.length * 7,
      message: "ok",
      checked: true,
      consecutiveFailures: 0,
      alert: false,
    };
  });
  const snapshot: ProviderHeartbeatSnapshot = {
    providers: entries,
    alerts: entries.filter((entry) => entry.alert),
    checkedAt: Date.now(),
  };
  emitLocalHeartbeat(snapshot);
  return snapshot;
}

export async function listenProviderHeartbeat(
  handler: (snapshot: ProviderHeartbeatSnapshot) => void,
): Promise<() => void> {
  if (isTauri()) {
    const { listen } = await import("@tauri-apps/api/event");
    return listen<ProviderHeartbeatSnapshot>("provider-heartbeat", (event) => handler(event.payload));
  }
  localHeartbeatHandlers.add(handler);
  return () => localHeartbeatHandlers.delete(handler);
}

export type RouteResult = {
  provider: Provider | null;
  health: ProviderHealth | null;
  candidates: { id: string; name: string; ok: boolean; latencyMs: number }[];
  fallbackFrom: string | null;
};

export async function routeProvider(providerIds: string[]): Promise<RouteResult> {
  const ids = [...new Set(providerIds)];
  const providers = (await listProviders()).filter((p) => ids.includes(p.id));
  const candidates = await Promise.all(
    providers.map(async (p) => {
      const health = await checkProviderHealth(p.id);
      return { id: p.id, name: p.name, ok: health.ok, latencyMs: health.latencyMs };
    }),
  );
  const healthy = providers.filter((p) => candidates.find((c) => c.id === p.id)?.ok);
  if (healthy.length === 0) {
    return { provider: null, health: null, candidates, fallbackFrom: null };
  }
  const chosen = healthy[0];
  const fallbackFrom = providers
    .filter((p) => p.id !== chosen.id && candidates.find((c) => c.id === p.id)?.ok === false)
    .map((p) => p.name)
    .join(", ") || null;
  return {
    provider: chosen,
    health: { ok: true, latencyMs: candidates.find((c) => c.id === chosen.id)?.latencyMs ?? 0, message: "ok" },
    candidates,
    fallbackFrom,
  };
}

export async function listSessions(): Promise<Session[]> {
  return isTauri() ? invoke<Session[]>("list_sessions") : readLocal().sessions;
}

export async function createSession(title: string, model: string): Promise<Session> {
  if (isTauri()) return invoke<Session>("create_session", { title, model });
  const shape = readLocal();
  const session: Session = { id: makeId(), projectId: null, title, model, createdAt: Date.now() };
  shape.sessions.unshift(session);
  writeLocal(shape);
  return session;
}

export async function renameSession(id: string, title: string): Promise<void> {
  if (isTauri()) {
    await invoke("rename_session", { id, title });
    return;
  }
  const shape = readLocal();
  const session = shape.sessions.find((s) => s.id === id);
  if (session) session.title = title;
  writeLocal(shape);
}

export async function deleteSession(id: string): Promise<void> {
  if (isTauri()) {
    await invoke("delete_session", { id });
    return;
  }
  const shape = readLocal();
  shape.sessions = shape.sessions.filter((s) => s.id !== id);
  shape.chatMessages = shape.chatMessages.filter((m) => m.sessionId !== id);
  const remainingMessageIds = new Set(shape.chatMessages.map((m) => m.id));
  shape.messageVersions = (shape.messageVersions ?? []).filter((v) => remainingMessageIds.has(v.messageId));
  writeLocal(shape);
}

export async function saveChatMessage(
  sessionId: string,
  role: string,
  content: string,
  id?: string,
): Promise<ChatMessage> {
  if (isTauri()) return invoke<ChatMessage>("save_chat_message", { sessionId, role, content, id });
  const shape = readLocal();
  shape.chatMessages = shape.chatMessages ?? [];
  const message: ChatMessage = { id: id ?? makeId(), sessionId, role, content, createdAt: Date.now() };
  shape.chatMessages.push(message);
  writeLocal(shape);
  return message;
}

export async function listChatMessages(sessionId: string): Promise<ChatMessage[]> {
  if (isTauri()) return invoke<ChatMessage[]>("list_chat_messages", { sessionId });
  return (readLocal().chatMessages ?? [])
    .filter((m) => m.sessionId === sessionId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function updateChatMessage(id: string, content: string): Promise<void> {
  if (isTauri()) {
    await invoke("update_chat_message", { id, content });
    return;
  }
  const shape = readLocal();
  const message = shape.chatMessages.find((m) => m.id === id);
  if (message && message.content !== content) {
    shape.messageVersions = shape.messageVersions ?? [];
    const parent = shape.messageVersions
      .filter((v) => v.messageId === id)
      .sort((a, b) => b.createdAt - a.createdAt)[0]?.id ?? null;
    shape.messageVersions.push({
      id: makeId(),
      messageId: id,
      content: message.content,
      createdAt: Date.now(),
      parentVersionId: parent,
    });
    message.content = content;
  }
  writeLocal(shape);
}

export async function truncateChatMessages(sessionId: string, keepMessageId: string): Promise<void> {
  if (isTauri()) {
    await invoke("truncate_chat_messages", { sessionId, keepMessageId });
    return;
  }
  const shape = readLocal();
  const keep = shape.chatMessages.find((m) => m.id === keepMessageId);
  if (keep) {
    shape.chatMessages = shape.chatMessages.filter(
      (m) => m.sessionId !== sessionId || m.createdAt <= keep.createdAt || m.id === keepMessageId,
    );
    const remainingMessageIds = new Set(shape.chatMessages.map((m) => m.id));
    shape.messageVersions = (shape.messageVersions ?? []).filter((v) => remainingMessageIds.has(v.messageId));
  }
  writeLocal(shape);
}

export async function saveMessageVersion(messageId: string, content: string): Promise<MessageVersion> {
  if (isTauri()) return invoke<MessageVersion>("save_message_version", { messageId, content });
  const shape = readLocal();
  shape.messageVersions = shape.messageVersions ?? [];
  const version: MessageVersion = {
    id: makeId(),
    messageId,
    content,
    createdAt: Date.now(),
    parentVersionId: null,
  };
  shape.messageVersions.push(version);
  writeLocal(shape);
  return version;
}

export async function listMessageVersions(messageId: string): Promise<MessageVersion[]> {
  if (isTauri()) return invoke<MessageVersion[]>("list_message_versions", { messageId });
  return (readLocal().messageVersions ?? [])
    .filter((v) => v.messageId === messageId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function restoreMessageVersion(messageId: string, versionId: string): Promise<string> {
  if (isTauri()) return invoke<string>("restore_message_version", { messageId, versionId });
  const shape = readLocal();
  const version = (shape.messageVersions ?? []).find((v) => v.id === versionId && v.messageId === messageId);
  if (!version) throw new Error("message version not found");
  await updateChatMessage(messageId, version.content);
  return version.content;
}

export async function diffMessageVersionWithCurrent(
  messageId: string,
  versionId: string,
): Promise<MessageDiff> {
  if (isTauri()) {
    return invoke<MessageDiff>("diff_message_version_with_current", { messageId, versionId });
  }
  const shape = readLocal();
  const version = (shape.messageVersions ?? []).find((v) => v.id === versionId && v.messageId === messageId);
  const message = shape.chatMessages.find((m) => m.id === messageId);
  if (!version || !message) throw new Error("message version not found");
  return lineDiff(version.content, message.content);
}

function lineDiff(a: string, b: string): MessageDiff {
  const aLines = a.split("\n");
  const bLines = b.split("\n");
  const width = bLines.length + 1;
  const height = aLines.length + 1;
  const dp = Array.from({ length: height }, () => new Int32Array(width));
  for (let i = height - 2; i >= 0; i--) {
    for (let j = width - 2; j >= 0; j--) {
      dp[i][j] =
        aLines[i] === bLines[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const added: string[] = [];
  const removed: string[] = [];
  let i = 0;
  let j = 0;
  while (i < aLines.length && j < bLines.length) {
    if (aLines[i] === bLines[j]) {
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      removed.push(aLines[i]);
      i++;
    } else {
      added.push(bLines[j]);
      j++;
    }
  }
  while (i < aLines.length) {
    removed.push(aLines[i]);
    i++;
  }
  while (j < bLines.length) {
    added.push(bLines[j]);
    j++;
  }
  return { added, removed };
}

export async function listHabits(): Promise<Habit[]> {
  return isTauri() ? invoke<Habit[]>("list_habits") : readLocal().habits;
}

export async function createHabit(name: string, weekGoal: number, color: Habit["color"]): Promise<Habit> {
  if (isTauri()) return invoke<Habit>("create_habit", { name, weekGoal, color });
  const shape = readLocal();
  const habit: Habit = { id: makeId(), name, weekGoal, currentStreak: 0, color, doneToday: false, createdAt: Date.now() };
  shape.habits.unshift(habit);
  writeLocal(shape);
  return habit;
}

export async function toggleHabit(id: string): Promise<Habit> {
  if (isTauri()) return invoke<Habit>("toggle_habit", { id });
  const shape = readLocal();
  const habit = shape.habits.find((h) => h.id === id);
  if (habit) habit.doneToday = !habit.doneToday;
  writeLocal(shape);
  return habit ?? shape.habits[0];
}

export async function listScheduleEvents(): Promise<ScheduleEvent[]> {
  return isTauri() ? invoke<ScheduleEvent[]>("list_schedule_events") : readLocal().scheduleEvents;
}

export async function createScheduleEvent(title: string, startTime: string, tag: string): Promise<ScheduleEvent> {
  if (isTauri()) return invoke<ScheduleEvent>("create_schedule_event", { title, startTime, tag });
  const shape = readLocal();
  const event: ScheduleEvent = { id: makeId(), title, startTime, done: false, tag, createdAt: Date.now() };
  shape.scheduleEvents.push(event);
  writeLocal(shape);
  return event;
}

export async function toggleEventDone(id: string): Promise<void> {
  if (isTauri()) {
    await invoke("toggle_event_done", { id });
    return;
  }
  const shape = readLocal();
  const event = shape.scheduleEvents.find((e) => e.id === id);
  if (event) event.done = !event.done;
  writeLocal(shape);
}

export async function listClipboard(): Promise<ClipboardItem[]> {
  return isTauri() ? invoke<ClipboardItem[]>("list_clipboard") : readLocal().clipboard;
}

export async function listErrorLogs(): Promise<ErrorLog[]> {
  return isTauri() ? invoke<ErrorLog[]>("list_error_logs") : readLocal().logs;
}

export async function reportFrontendError(input: {
  source: string;
  message: string;
  stack: string | null;
  severity: string;
}): Promise<void> {
  if (isTauri()) {
    await invoke("report_frontend_error", input);
    return;
  }
  const shape = readLocal();
  const log: ErrorLog = {
    id: makeId(),
    source: input.source,
    message: input.message,
    stack: input.stack,
    severity: input.severity,
    timestamp: Date.now(),
    updatedAt: Date.now(),
  };
  shape.logs.unshift(log);
  writeLocal(shape);
}

export async function captureClipboard(content: string): Promise<ClipboardItem> {
  if (isTauri()) return invoke<ClipboardItem>("capture_clipboard", { content });
  const shape = readLocal();
  const now = Date.now();
  const item: ClipboardItem = { id: makeId(), content, source: "system", timestamp: now, updatedAt: now };
  shape.clipboard.unshift(item);
  writeLocal(shape);
  return item;
}

export async function listenClipboardUpdated(
  handler: (item: ClipboardItem) => void,
): Promise<() => void> {
  if (isTauri()) {
    const { listen } = await import("@tauri-apps/api/event");
    return listen<ClipboardItem>("clipboard-updated", (event) => handler(event.payload));
  }
  return () => {};
}

const SYNC_LS_KEY = "ai-workbench:sync-snapshot:v1";

export async function exportSyncSnapshot(): Promise<SyncSnapshot> {
  if (isTauri()) return invoke<SyncSnapshot>("export_sync_snapshot");
  const shape = readLocal();
  const snapshot: SyncSnapshot = {
    deviceId: shape.syncDeviceId || makeId(),
    exportedAt: Date.now(),
    clipboard: shape.clipboard,
    logs: shape.logs,
  };
  localStorage.setItem(SYNC_LS_KEY, JSON.stringify(snapshot));
  return snapshot;
}

export async function importSyncSnapshot(): Promise<SyncResult> {
  if (isTauri()) return invoke<SyncResult>("import_sync_snapshot");
  const raw = localStorage.getItem(SYNC_LS_KEY);
  if (!raw) throw new Error("sync snapshot not found");
  const remote = JSON.parse(raw) as SyncSnapshot;
  const shape = readLocal();
  let clipboardAdded = 0;
  let clipboardUpdated = 0;
  for (const item of remote.clipboard) {
    const local = shape.clipboard.find((c) => c.id === item.id);
    if (!local) {
      shape.clipboard.push(item);
      clipboardAdded++;
    } else if (item.updatedAt > local.updatedAt) {
      Object.assign(local, item);
      clipboardUpdated++;
    }
  }
  let logsAdded = 0;
  let logsUpdated = 0;
  for (const log of remote.logs) {
    const local = shape.logs.find((l) => l.id === log.id);
    if (!local) {
      shape.logs.push(log);
      logsAdded++;
    } else if (log.updatedAt > local.updatedAt) {
      Object.assign(local, log);
      logsUpdated++;
    }
  }
  shape.clipboard.sort((a, b) => b.updatedAt - a.updatedAt);
  shape.logs.sort((a, b) => b.updatedAt - a.updatedAt);
  const result: SyncResult = {
    deviceId: remote.deviceId,
    syncedAt: Date.now(),
    clipboardAdded,
    clipboardUpdated,
    logsAdded,
    logsUpdated,
  };
  shape.lastSyncedAt = result.syncedAt;
  writeLocal(shape);
  return result;
}

export async function getSyncStatus(): Promise<SyncStatus> {
  if (isTauri()) {
    const shape = readLocal();
    return { deviceId: shape.syncDeviceId || "tauri-device", lastSyncedAt: shape.lastSyncedAt || null };
  }
  const shape = readLocal();
  return { deviceId: shape.syncDeviceId || makeId(), lastSyncedAt: shape.lastSyncedAt || null };
}

function tokenizeSearch(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9\u4e00-\u9fa5]+/)
        .filter((t) => t.length > 1),
    ),
  );
}

type VaultFileRecord = {
  path: string;
  title: string;
  tags: string;
  content: string;
};

function readVaultFiles(): VaultFileRecord[] {
  try {
    return JSON.parse(localStorage.getItem(VAULT_LS_KEY) ?? "[]") as VaultFileRecord[];
  } catch {
    return [];
  }
}

export async function indexVault(vaultPath: string): Promise<IndexResult> {
  if (isTauri()) return invoke<IndexResult>("index_vault", { vaultPath });
  const existing = readVaultFiles();
  const sample: VaultFileRecord[] = [
    {
      path: `${vaultPath}\\Obsidian Roadmap.md`,
      title: "Obsidian Roadmap",
      tags: "#work,#vault",
      content: "# Obsidian Roadmap\n\n## Vault sync\n\n- 把本地 Markdown 纳入 RAG\n- 支持 frontmatter 标题与标签",
    },
    {
      path: `${vaultPath}\\Daily Notes\\2026-08-05.md`,
      title: "Daily Note",
      tags: "#life",
      content: "# 每日闪念\n\n- vault 索引让 AI 能引用本地文件",
    },
  ];
  const merged = existing.length > 0 ? existing : sample;
  localStorage.setItem(VAULT_LS_KEY, JSON.stringify(merged));
  return { files: merged.length };
}

export async function getKnowledgeIndexStatus(): Promise<KnowledgeIndexStatus> {
  if (isTauri()) return invoke<KnowledgeIndexStatus>("get_knowledge_index_status");
  const files = readVaultFiles();
  return { files: files.length, indexedAt: files.length ? Date.now() : 0 };
}

export async function searchThoughts(query: string, limit = 5): Promise<RagSearchResult[]> {
  if (isTauri()) return invoke<RagSearchResult[]>("search_thoughts", { query, limit });
  const shape = readLocal();
  const tokens = tokenizeSearch(query);
  if (tokens.length === 0) return [];
  const docs = [
    ...shape.thoughts.map((t) => ({ id: t.id, content: t.content, tags: t.tags, type: t.type })),
    ...readVaultFiles().map((f) => ({
      id: f.path,
      content: f.content,
      tags: f.tags,
      type: "doc" as ThoughtType,
    })),
  ];
  const scored = docs
    .map((t) => {
      const hay = tokenizeSearch(t.content);
      const score = tokens.reduce((sum, term) => sum + (hay.includes(term) ? 1 : 0), 0);
      return { id: t.id, content: t.content, tags: t.tags, type: t.type, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored;
}

export async function getRagIndexStatus(): Promise<RagIndexStatus> {
  if (isTauri()) return invoke<RagIndexStatus>("get_rag_index_status");
  const shape = readLocal();
  const vaultFiles = readVaultFiles();
  const total = shape.thoughts.length + vaultFiles.length;
  return {
    documents: total,
    indexed: total > 0,
    lastIndexedAt: shape.thoughts[0]?.createdAt ?? (vaultFiles.length ? Date.now() : 0),
  };
}

export async function sendAiMessage(args: {
  providerIds: string[];
  messages: { role: string; content: string }[];
  moa: boolean;
}): Promise<string> {
  if (isTauri()) {
    return invoke<string>("send_ai_message", {
      providerIds: args.providerIds,
      messages: args.messages,
      moa: args.moa,
    });
  }
  const label = args.moa ? "MOA consensus" : "assistant";
  return `[${label}] Browser fallback: the desktop app provides live model routing. Providers: ${args.providerIds.join(", ") || "none"}.`;
}

export type StreamChunk = {
  id: string;
  delta: string;
  done: boolean;
  error: string | null;
  cancelled: boolean;
};

const localCancelledRuns = new Set<string>();

export async function sendAiMessageStream(args: {
  providerIds: string[];
  messages: { role: string; content: string }[];
  moa: boolean;
  runId: string;
}): Promise<void> {
  if (isTauri()) {
    await invoke("stream_ai_message", {
      providerIds: args.providerIds,
      messages: args.messages,
      moa: args.moa,
      runId: args.runId,
    });
    return;
  }

  const lastUserContent = [...args.messages].reverse().find((m) => m.role === "user")?.content ?? "";
  if (lastUserContent.toLowerCase().includes("sprint 15 timeout check")) {
    window.setTimeout(() => {
      localCancelledRuns.delete(args.runId);
      emitLocalStreamChunk({
        id: args.runId,
        delta: "",
        done: true,
        error: "Request timeout: provider did not respond in time",
        cancelled: false,
      });
    }, 120);
    return;
  }

  const reply =
    "Streaming fallback: 这条回复由浏览器分块模拟，逐段到达。\n\n- 第一段已就绪\n- 第二段继续\n- 第三段完成";
  const words = reply.split(" ");
  let index = 0;
  await new Promise<void>((resolve) => {
    const timer = window.setInterval(() => {
      const wasCancelled = localCancelledRuns.has(args.runId);
      if (index >= words.length || wasCancelled) {
        window.clearInterval(timer);
        localCancelledRuns.delete(args.runId);
        emitLocalStreamChunk({
          id: args.runId,
          delta: "",
          done: true,
          error: null,
          cancelled: wasCancelled,
        });
        resolve();
        return;
      }
      emitLocalStreamChunk({
        id: args.runId,
        delta: `${words[index]} `,
        done: false,
        error: null,
        cancelled: false,
      });
      index += 1;
    }, 60);
  });
}

export async function cancelAiStream(runId: string): Promise<void> {
  if (isTauri()) {
    await invoke("cancel_ai_stream", { runId });
    return;
  }
  localCancelledRuns.add(runId);
}

const localChunkHandlers = new Set<(chunk: StreamChunk) => void>();

function emitLocalStreamChunk(chunk: StreamChunk) {
  for (const handler of localChunkHandlers) handler(chunk);
}

export async function listenStreamChunks(handler: (chunk: StreamChunk) => void): Promise<() => void> {
  if (isTauri()) {
    const { listen } = await import("@tauri-apps/api/event");
    return listen<StreamChunk>("stream-chunk", (event) => handler(event.payload));
  }
  localChunkHandlers.add(handler);
  return () => localChunkHandlers.delete(handler);
}

export async function getProjectGitContext(path: string): Promise<GitContext> {
  if (isTauri()) return invoke<GitContext>("get_project_git_context", { path });
  return {
    head: "main",
    branch: "develop",
    commitCount: 21,
    latestCommit: "d676ced feat(sprint-20): message version graph with parent lineage",
    changes: ["docs/plans/sprint-21-project-git-graph.md", "src/views/ProjectsView.tsx"],
  };
}
