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

export type Provider = {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  isActive: boolean;
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
};

export type ErrorLog = {
  id: string;
  source: string;
  message: string;
  stack: string | null;
  severity: string;
  timestamp: number;
};

const LS_KEY = "ai-workbench:db:v1";

type LocalShape = {
  tasks: Task[];
  projects: Project[];
  thoughts: Thought[];
  providers: Provider[];
  sessions: Session[];
  habits: Habit[];
  scheduleEvents: ScheduleEvent[];
  clipboard: ClipboardItem[];
  logs: ErrorLog[];
};

const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

const makeId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`);

function emptyShape(): LocalShape {
  return { tasks: [], projects: [], thoughts: [], providers: [], sessions: [], habits: [], scheduleEvents: [], clipboard: [], logs: [] };
}

function seedShape(): LocalShape {
  const now = Date.now();
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
      { id: makeId(), content: "pnpm run dev", source: "terminal", timestamp: now - 5000 },
      { id: makeId(), content: "bg-[#18181C] border-white/10 rounded-2xl", source: "editor", timestamp: now - 4000 },
    ],
    logs: [
      { id: makeId(), source: "tauri", message: "DB initialized", stack: null, severity: "info", timestamp: now - 7000 },
    ],
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
  };
  shape.logs.unshift(log);
  writeLocal(shape);
}

export async function captureClipboard(content: string): Promise<ClipboardItem> {
  if (isTauri()) return invoke<ClipboardItem>("capture_clipboard", { content });
  const shape = readLocal();
  const item: ClipboardItem = { id: makeId(), content, source: "system", timestamp: Date.now() };
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

export async function getProjectGitContext(path: string): Promise<{ head: string; changes: string[] }> {
  if (isTauri()) return invoke<{ head: string; changes: string[] }>("get_project_git_context", { path });
  return { head: "main", changes: ["docs/plans/sprint-1-plan.md", "src/App.tsx"] };
}
