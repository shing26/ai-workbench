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

export type Department = {
  id: string;
  name: string;
  description: string;
  color: string;
  agentCount: number;
  createdAt: number;
};

export type Agent = {
  id: string;
  departmentId: string;
  departmentName: string;
  name: string;
  role: string;
  model: string;
  providerId: string | null;
  systemPrompt: string;
  isActive: boolean;
  createdAt: number;
};

export type AgentPromptVersion = {
  id: string;
  agentId: string;
  content: string;
  createdAt: number;
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
  conflicts: SyncConflictItem[];
};

export type SyncConflictItem = {
  id: string;
  kind: "clipboard" | "log";
  localUpdatedAt: number;
  remoteUpdatedAt: number;
  resolvedTo: "remote" | "local";
  preview: string;
  localContent: string;
  remoteContent: string;
};

export type SyncConflictRecord = SyncConflictItem & {
  resolvedChoice: string | null;
  resolvedAt: number | null;
  createdAt: number;
};

export type SyncStatus = {
  deviceId: string;
  lastSyncedAt: number | null;
};

export type SyncAuditEntry = {
  id: number;
  event: string;
  detail: string;
  deviceId: string;
  createdAt: number;
};

export type RemoteSyncPushResult = {
  ok: boolean;
  syncedAt: number;
  message: string;
};

export type GitContext = {
  head: string;
  branch: string;
  commitCount: number;
  latestCommit: string;
  changes: string[];
};

export type CommitPrDraft = {
  branch: string;
  commitMessage: string;
  prTitle: string;
  prBody: string;
  changes: string[];
};

export type GitCommitResult = {
  committed: boolean;
  hash: string;
  branch: string;
  message: string;
};

export type RemotePrResult = {
  created: boolean;
  url: string | null;
  title: string;
  branch: string;
};

export type GitRebaseResult = {
  rebased: boolean;
  conflict: boolean;
  files: string[];
  base: string;
  branch: string;
  head: string;
};

export type ConflictResolutionResult = {
  resolved: boolean;
  strategy: string;
  files: string[];
  rebased: boolean;
  branch: string;
  head: string;
  message: string;
};

export type StreamSmokeResult = {
  ok: boolean;
  chunks: number;
  message: string;
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

export type VaultWatchStatus = {
  watching: boolean;
  path: string | null;
  paths: string[];
  files: number;
  updatedAt: number;
};

export type VaultWatchTarget = {
  path: string;
  ignorePatterns: string[];
  enabled: boolean;
  updatedAt: number;
  lastEventAt: number;
  eventCount: number;
};

export type VaultTargetStats = {
  path: string;
  files: number;
  lastIndexedAt: number;
  lastEventAt: number;
  eventCount: number;
};

export type VaultWatchConfig = {
  path: string;
  ignorePatterns: string[];
  enabled: boolean;
  updatedAt: number;
};

export type IndexResult = {
  files: number;
  ignored: number;
  concurrencyUsed: number;
};

export type IndexProgress = {
  runId: string;
  path: string;
  done: number;
  total: number;
  files: number;
  ignored: number;
  concurrencyUsed: number;
  status: string;
};

export type RecommendedConcurrency = {
  recommended: number;
  cores: number;
};

const LS_KEY = "ai-workbench:db:v1";
const VAULT_LS_KEY = "ai-workbench:vault:v1";
const VAULT_WATCH_LS_KEY = "ai-workbench:vault-watch:v1";
const VAULT_WATCH_TARGETS_LS_KEY = "ai-workbench:vault-watch-targets:v1";

type LocalShape = {
  tasks: Task[];
  projects: Project[];
  thoughts: Thought[];
  providers: Provider[];
  departments: Department[];
  agents: Agent[];
  promptVersions: AgentPromptVersion[];
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
    departments: [],
    agents: [],
    promptVersions: [],
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
  const designId = makeId();
  const productId = makeId();
  const backendId = makeId();
  const aiId = makeId();
  const qualityId = makeId();
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
    promptVersions: [],
    departments: [
      { id: designId, name: "设计部", description: "界面、交互与视觉动效", color: "iris", agentCount: 3, createdAt: now - 9000 },
      { id: productId, name: "产品与体验部", description: "需求、用户路径与优先级", color: "ocean", agentCount: 2, createdAt: now - 8000 },
      { id: backendId, name: "后端与系统部", description: "数据层、Tauri 命令与运维", color: "emerald", agentCount: 2, createdAt: now - 7000 },
      { id: aiId, name: "AI 策略与引擎部", description: "模型路由、Prompt 与多 Agent 编排", color: "amber", agentCount: 3, createdAt: now - 6000 },
      { id: qualityId, name: "质量与工程效率部", description: "测试、DoD 与自动化验收", color: "sakura", agentCount: 2, createdAt: now - 5000 },
    ],
    agents: [
      { id: makeId(), departmentId: designId, departmentName: "设计部", name: "UI Designer", role: "设计系统与动效", model: "openai", providerId: null, systemPrompt: "你是 AI Workbench 的 UI Designer，负责设计系统、动效与视觉验收。输出需遵循 Design Token，并服务于 5 大主视图。", isActive: true, createdAt: now - 4900 },
      { id: makeId(), departmentId: designId, departmentName: "设计部", name: "Frontend Developer", role: "React/Tailwind 实现", model: "openai", providerId: null, systemPrompt: "你是 AI Workbench 的 Frontend Developer，负责 React/Tailwind 实现。输出需可运行、可验证，并保持布局稳定。", isActive: true, createdAt: now - 4800 },
      { id: makeId(), departmentId: designId, departmentName: "设计部", name: "UI Finish-Gate Reviewer", role: "视觉验收", model: "openai", providerId: null, systemPrompt: "你是 AI Workbench 的 UI Finish-Gate Reviewer，负责视觉验收。输出必须给出可测量的验收项与风险。", isActive: true, createdAt: now - 4700 },
      { id: makeId(), departmentId: productId, departmentName: "产品与体验部", name: "Product Manager", role: "范围冻结与验收标准", model: "openai", providerId: null, systemPrompt: "你是 AI Workbench 的 Product Manager，负责范围冻结与验收标准。每个需求必须给出明确的 AC。", isActive: true, createdAt: now - 4600 },
      { id: makeId(), departmentId: productId, departmentName: "产品与体验部", name: "UX Architect", role: "交互与信息架构", model: "openai", providerId: null, systemPrompt: "你是 AI Workbench 的 UX Architect，负责交互与信息架构。输出需考虑工作台高频路径与 5 大主视图。", isActive: true, createdAt: now - 4500 },
      { id: makeId(), departmentId: backendId, departmentName: "后端与系统部", name: "Backend Architect", role: "Tauri 命令与分层设计", model: "openai", providerId: null, systemPrompt: "你是 AI Workbench 的 Backend Architect，负责 Tauri 命令与分层设计。输出需保持模块边界清晰并考虑错误路径。", isActive: true, createdAt: now - 4400 },
      { id: makeId(), departmentId: backendId, departmentName: "后端与系统部", name: "Data Engineer", role: "SQLite 表结构与迁移", model: "openai", providerId: null, systemPrompt: "你是 AI Workbench 的 Data Engineer，负责 SQLite 表结构与迁移。输出需包含索引、外键与迁移脚本。", isActive: true, createdAt: now - 4300 },
      { id: makeId(), departmentId: aiId, departmentName: "AI 策略与引擎部", name: "AI Engineer", role: "模型路由与流式链路", model: "openai", providerId: null, systemPrompt: "你是 AI Workbench 的 AI Engineer，负责模型路由与流式链路。输出需兼容 Tauri 与浏览器 fallback。", isActive: true, createdAt: now - 4200 },
      { id: makeId(), departmentId: aiId, departmentName: "AI 策略与引擎部", name: "Prompt Engineer", role: "Prompt 版本与测试用例", model: "openai", providerId: null, systemPrompt: "你是 AI Workbench 的 Prompt Engineer，负责 Prompt 版本与测试用例。输出需给出可复现的用例。", isActive: true, createdAt: now - 4100 },
      { id: makeId(), departmentId: aiId, departmentName: "AI 策略与引擎部", name: "Multi-Agent Systems Architect", role: "部门与 Agent 编排", model: "openai", providerId: null, systemPrompt: "你是 AI Workbench 的 Multi-Agent Systems Architect，负责部门与 Agent 编排。输出需明确分工、并行度与汇总结论。", isActive: true, createdAt: now - 4000 },
      { id: makeId(), departmentId: qualityId, departmentName: "质量与工程效率部", name: "Test Automation Engineer", role: "自动化验收与回归", model: "openai", providerId: null, systemPrompt: "你是 AI Workbench 的 Test Automation Engineer，负责自动化验收与回归。输出需覆盖 verify:ui 与 Rust 单测。", isActive: true, createdAt: now - 3900 },
      { id: makeId(), departmentId: qualityId, departmentName: "质量与工程效率部", name: "Reality Checker", role: "证据驱动的发布门禁", model: "openai", providerId: null, systemPrompt: "你是 AI Workbench 的 Reality Checker，负责证据驱动的发布门禁。输出必须引用实际文件与命令结果。", isActive: true, createdAt: now - 3800 },
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

export async function listDepartments(): Promise<Department[]> {
  if (isTauri()) return invoke<Department[]>("list_departments");
  const shape = readLocal();
  const departments = shape.departments ?? [];
  return departments.map((department) => ({
    ...department,
    agentCount:
      shape.agents?.filter((a) => a.departmentId === department.id || a.departmentName === department.name).length ??
      department.agentCount,
  }));
}

export async function listAgents(): Promise<Agent[]> {
  if (isTauri()) return invoke<Agent[]>("list_agents");
  const shape = readLocal();
  return shape.agents ?? [];
}

export async function createDepartment(
  name: string,
  description: string,
  color: string,
): Promise<Department> {
  if (isTauri()) return invoke<Department>("create_department", { name, description, color });
  const shape = readLocal();
  const department: Department = {
    id: makeId(),
    name,
    description,
    color,
    agentCount: 0,
    createdAt: Date.now(),
  };
  shape.departments.push(department);
  writeLocal(shape);
  return department;
}

export async function createAgent(
  departmentId: string,
  name: string,
  role: string,
  model: string,
  providerId: string | null,
  systemPrompt: string,
): Promise<Agent> {
  if (isTauri()) {
    return invoke<Agent>("create_agent", {
      departmentId,
      name,
      role,
      model,
      providerId,
      systemPrompt,
    });
  }
  const shape = readLocal();
  const department = shape.departments.find((d) => d.id === departmentId);
  const agent: Agent = {
    id: makeId(),
    departmentId,
    departmentName: department?.name ?? "",
    name,
    role,
    model,
    providerId,
    systemPrompt,
    isActive: true,
    createdAt: Date.now(),
  };
  shape.agents.push(agent);
  writeLocal(shape);
  return agent;
}

export async function updateAgentSystemPrompt(id: string, systemPrompt: string): Promise<Agent> {
  if (isTauri()) {
    return invoke<Agent>("update_agent_system_prompt", { id, systemPrompt });
  }
  const shape = readLocal();
  const agent = shape.agents.find((a) => a.id === id);
  if (!agent) throw new Error("agent not found");
  if (agent.systemPrompt !== systemPrompt) {
    shape.promptVersions = shape.promptVersions ?? [];
    shape.promptVersions.push({
      id: makeId(),
      agentId: id,
      content: agent.systemPrompt,
      createdAt: Date.now(),
    });
    agent.systemPrompt = systemPrompt;
    writeLocal(shape);
  }
  return { ...agent };
}

export async function listAgentPromptVersions(agentId: string): Promise<AgentPromptVersion[]> {
  if (isTauri()) {
    return invoke<AgentPromptVersion[]>("list_agent_prompt_versions", { agentId });
  }
  const shape = readLocal();
  return (shape.promptVersions ?? [])
    .filter((v) => v.agentId === agentId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function restoreAgentPrompt(agentId: string, versionId: string): Promise<Agent> {
  if (isTauri()) {
    return invoke<Agent>("restore_agent_prompt", { agentId, versionId });
  }
  const shape = readLocal();
  const agent = shape.agents.find((a) => a.id === agentId);
  const version = (shape.promptVersions ?? []).find(
    (v) => v.id === versionId && v.agentId === agentId,
  );
  if (!agent || !version) throw new Error("agent or version not found");
  if (agent.systemPrompt !== version.content) {
    shape.promptVersions = shape.promptVersions ?? [];
    shape.promptVersions.push({
      id: makeId(),
      agentId,
      content: agent.systemPrompt,
      createdAt: Date.now(),
    });
    agent.systemPrompt = version.content;
    writeLocal(shape);
  }
  return { ...agent };
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
const SYNC_AUTO_LS_KEY = "ai-workbench:sync-auto:v1";
const SYNC_CONFLICTS_LS_KEY = "ai-workbench:sync-conflicts:v1";
const SYNC_AUDIT_LS_KEY = "ai-workbench:sync-audit:v1";

export type SyncAutoConfig = {
  enabled: boolean;
  intervalMs: number;
  remoteUrl: string;
};

export async function getSyncAutoConfig(): Promise<SyncAutoConfig> {
  try {
    const raw = localStorage.getItem(SYNC_AUTO_LS_KEY);
    if (raw) return JSON.parse(raw) as SyncAutoConfig;
  } catch {
    // fall through to defaults
  }
  return { enabled: false, intervalMs: 60_000, remoteUrl: "" };
}

export async function setSyncAutoConfig(config: SyncAutoConfig): Promise<SyncAutoConfig> {
  localStorage.setItem(SYNC_AUTO_LS_KEY, JSON.stringify(config));
  return config;
}

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
  return mergeSnapshotIntoLocal(JSON.parse(raw) as SyncSnapshot);
}

export async function pushSyncSnapshot(
  remoteUrl: string,
  token?: string,
): Promise<RemoteSyncPushResult> {
  if (isTauri()) {
    return invoke<RemoteSyncPushResult>("push_sync_snapshot", {
      remoteUrl,
      token: token?.trim() ? token.trim() : null,
    });
  }
  const snapshot = await exportSyncSnapshot();
  return {
    ok: true,
    syncedAt: snapshot.exportedAt,
    message: "Pushed snapshot to remote",
  };
}

export async function pullSyncSnapshot(
  remoteUrl: string,
  token?: string,
): Promise<SyncResult> {
  if (isTauri()) {
    return invoke<SyncResult>("pull_sync_snapshot", {
      remoteUrl,
      token: token?.trim() ? token.trim() : null,
    });
  }
  const remote: SyncSnapshot = {
    deviceId: "device-remote-fallback",
    exportedAt: Date.now(),
    clipboard: [
      {
        id: "sync-clip-remote-fallback",
        content: "sprint 33 remote clipboard",
        source: "remote",
        timestamp: Date.now(),
        updatedAt: Date.now(),
      },
    ],
    logs: [],
  };
  const shape = readLocal();
  const baseClip = shape.clipboard[0];
  if (baseClip) {
    remote.clipboard.push({
      id: baseClip.id,
      content: "sprint 38 conflict override",
      source: "remote",
      timestamp: Date.now(),
      updatedAt: baseClip.updatedAt + 1,
    });
  }
  return mergeSnapshotIntoLocal(remote);
}

function mergeSnapshotIntoLocal(remote: SyncSnapshot): SyncResult {
  const shape = readLocal();
  let clipboardAdded = 0;
  let clipboardUpdated = 0;
  const conflicts: SyncConflictItem[] = [];
  for (const item of remote.clipboard) {
    const local = shape.clipboard.find((c) => c.id === item.id);
    if (!local) {
      shape.clipboard.push(item);
      clipboardAdded++;
    } else if (item.updatedAt > local.updatedAt) {
      const localUpdatedAt = local.updatedAt;
      const localContent = local.content;
      Object.assign(local, item);
      clipboardUpdated++;
      conflicts.push({
        id: item.id,
        kind: "clipboard",
        localUpdatedAt,
        remoteUpdatedAt: item.updatedAt,
        resolvedTo: "remote",
        preview: item.content.slice(0, 120),
        localContent,
        remoteContent: item.content,
      });
    } else if (item.updatedAt < local.updatedAt) {
      conflicts.push({
        id: item.id,
        kind: "clipboard",
        localUpdatedAt: local.updatedAt,
        remoteUpdatedAt: item.updatedAt,
        resolvedTo: "local",
        preview: item.content.slice(0, 120),
        localContent: local.content,
        remoteContent: item.content,
      });
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
      const localUpdatedAt = local.updatedAt;
      const localContent = local.message;
      Object.assign(local, log);
      logsUpdated++;
      conflicts.push({
        id: log.id,
        kind: "log",
        localUpdatedAt,
        remoteUpdatedAt: log.updatedAt,
        resolvedTo: "remote",
        preview: log.message.slice(0, 120),
        localContent,
        remoteContent: log.message,
      });
    } else if (log.updatedAt < local.updatedAt) {
      conflicts.push({
        id: log.id,
        kind: "log",
        localUpdatedAt: local.updatedAt,
        remoteUpdatedAt: log.updatedAt,
        resolvedTo: "local",
        preview: log.message.slice(0, 120),
        localContent: local.message,
        remoteContent: log.message,
      });
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
    conflicts,
  };
  shape.lastSyncedAt = result.syncedAt;
  writeLocal(shape);
  persistFallbackConflicts(conflicts);
  appendSyncAudit(
    "sync.merge",
    `clips +${clipboardAdded} / updated ${clipboardUpdated} / logs +${logsAdded} / updated ${logsUpdated} / conflicts ${conflicts.length}`,
  );
  return result;
}

function readSyncConflictRecords(): SyncConflictRecord[] {
  try {
    return JSON.parse(localStorage.getItem(SYNC_CONFLICTS_LS_KEY) ?? "[]") as SyncConflictRecord[];
  } catch {
    return [];
  }
}

function writeSyncConflictRecords(records: SyncConflictRecord[]) {
  localStorage.setItem(SYNC_CONFLICTS_LS_KEY, JSON.stringify(records));
}

function readSyncAudit(): SyncAuditEntry[] {
  try {
    return JSON.parse(localStorage.getItem(SYNC_AUDIT_LS_KEY) ?? "[]") as SyncAuditEntry[];
  } catch {
    return [];
  }
}

function writeSyncAudit(entries: SyncAuditEntry[]) {
  localStorage.setItem(SYNC_AUDIT_LS_KEY, JSON.stringify(entries.slice(0, 200)));
}

function appendSyncAudit(event: string, detail: string) {
  const entries = readSyncAudit();
  entries.unshift({
    id: Date.now() + Math.floor(Math.random() * 1000),
    event,
    detail,
    deviceId: readLocal().syncDeviceId || "local",
    createdAt: Date.now(),
  });
  writeSyncAudit(entries);
}

function persistFallbackConflicts(conflicts: SyncConflictItem[]): SyncConflictRecord[] {
  const records = readSyncConflictRecords();
  const createdAt = Date.now();
  for (const conflict of conflicts) {
    const index = records.findIndex(
      (record) =>
        record.id === conflict.id && record.kind === conflict.kind && !record.resolvedChoice,
    );
    if (index >= 0) {
      records[index] = {
        ...conflict,
        resolvedChoice: null,
        resolvedAt: null,
        createdAt: records[index].createdAt,
      };
    } else {
      records.push({ ...conflict, resolvedChoice: null, resolvedAt: null, createdAt });
    }
  }
  writeSyncConflictRecords(records);
  return records;
}

export async function resolveSyncConflict(
  conflict: SyncConflictItem,
  choice: "local" | "remote",
): Promise<string> {
  if (isTauri()) {
    return invoke<string>("resolve_sync_conflict", { conflict, choice });
  }
  const shape = readLocal();
  const content = choice === "local" ? conflict.localContent : conflict.remoteContent;
  const updatedAt = Date.now();
  if (conflict.kind === "clipboard") {
    const item = shape.clipboard.find((c) => c.id === conflict.id);
    if (!item) throw new Error(`clipboard conflict not found: ${conflict.id}`);
    item.content = content;
    item.timestamp = updatedAt;
    item.updatedAt = updatedAt;
  } else {
    const item = shape.logs.find((l) => l.id === conflict.id);
    if (!item) throw new Error(`log conflict not found: ${conflict.id}`);
    item.message = content;
    item.timestamp = updatedAt;
    item.updatedAt = updatedAt;
  }
  writeLocal(shape);
  const records = readSyncConflictRecords().map((record) =>
    record.id === conflict.id && record.kind === conflict.kind && !record.resolvedChoice
      ? { ...record, resolvedChoice: choice, resolvedAt: updatedAt }
      : record,
  );
  writeSyncConflictRecords(records);
  appendSyncAudit("sync.resolve", `${conflict.kind} ${conflict.id} -> ${choice}`);
  return `Resolved ${conflict.kind} conflict ${conflict.id} with ${choice}`;
}

export async function resolveSyncConflicts(
  conflicts: SyncConflictItem[],
  choice: "local" | "remote",
): Promise<number> {
  if (isTauri()) {
    return invoke<number>("resolve_sync_conflicts", { conflicts, choice });
  }
  for (const conflict of conflicts) {
    await resolveSyncConflict(conflict, choice);
  }
  return conflicts.length;
}

function unionMergeContent(local: string, remote: string): string {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const line of local.split("\n")) {
    if (!seen.has(line)) {
      seen.add(line);
      lines.push(line);
    }
  }
  for (const line of remote.split("\n")) {
    if (!seen.has(line)) {
      seen.add(line);
      lines.push(line);
    }
  }
  return lines.join("\n");
}

export async function resolveSyncConflictUnion(conflict: SyncConflictItem): Promise<string> {
  if (isTauri()) {
    return invoke<string>("resolve_sync_conflict_union", { conflict });
  }
  const shape = readLocal();
  const content = unionMergeContent(conflict.localContent, conflict.remoteContent);
  const updatedAt = Date.now();
  if (conflict.kind === "clipboard") {
    const item = shape.clipboard.find((c) => c.id === conflict.id);
    if (!item) throw new Error(`clipboard conflict not found: ${conflict.id}`);
    item.content = content;
    item.timestamp = updatedAt;
    item.updatedAt = updatedAt;
  } else {
    const item = shape.logs.find((l) => l.id === conflict.id);
    if (!item) throw new Error(`log conflict not found: ${conflict.id}`);
    item.message = content;
    item.timestamp = updatedAt;
    item.updatedAt = updatedAt;
  }
  writeLocal(shape);
  const records = readSyncConflictRecords().map((record) =>
    record.id === conflict.id && record.kind === conflict.kind && !record.resolvedChoice
      ? { ...record, resolvedChoice: "union", resolvedAt: updatedAt }
      : record,
  );
  writeSyncConflictRecords(records);
  appendSyncAudit("sync.resolve.union", `${conflict.kind} ${conflict.id} -> union`);
  return `Merged ${conflict.kind} conflict ${conflict.id} with union`;
}

export async function resolveSyncConflictsUnion(conflicts: SyncConflictItem[]): Promise<number> {
  if (isTauri()) {
    return invoke<number>("resolve_sync_conflicts_union", { conflicts });
  }
  for (const conflict of conflicts) {
    await resolveSyncConflictUnion(conflict);
  }
  return conflicts.length;
}

function mergeJsonValue(local: any, remote: any, preferLocal: boolean): any {
  if (Array.isArray(local) && Array.isArray(remote)) {
    const seen = new Set<string>();
    const out: any[] = [];
    for (const item of [...local, ...remote]) {
      const marker = JSON.stringify(item);
      if (!seen.has(marker)) {
        seen.add(marker);
        out.push(item);
      }
    }
    return out;
  }
  if (
    local !== null &&
    remote !== null &&
    typeof local === "object" &&
    typeof remote === "object"
  ) {
    const out: Record<string, any> = {};
    const keys = new Set([...Object.keys(local), ...Object.keys(remote)]);
    for (const key of [...keys].sort()) {
      const localValue = local[key];
      const remoteValue = remote[key];
      if (localValue === undefined) out[key] = remoteValue;
      else if (remoteValue === undefined) out[key] = localValue;
      else out[key] = mergeJsonValue(localValue, remoteValue, preferLocal);
    }
    return out;
  }
  if (JSON.stringify(local) === JSON.stringify(remote)) return local;
  return preferLocal ? local : remote;
}

function parseFrontmatter(text: string): { fields: [string, string][]; body: string } | null {
  const trimmed = text.replace(/^\uFEFF/, "");
  if (!trimmed.startsWith("---")) return null;
  const rest = trimmed.slice(3);
  const match = rest.match(/\n---/);
  if (!match || match.index === undefined) return null;
  const raw = rest.slice(0, match.index);
  const bodyStart = 3 + match.index + 4;
  const body = trimmed.slice(bodyStart).replace(/^\n+/, "");
  const fields: [string, string][] = [];
  for (const line of raw.split("\n")) {
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) fields.push([key, value]);
  }
  if (fields.length === 0) return null;
  return { fields, body };
}

function mergeFrontmatterValue(local: string, remote: string, preferLocal: boolean): string {
  if (local === remote) return local;
  if (local.includes(",") || remote.includes(",")) {
    const seen = new Set<string>();
    const parts: string[] = [];
    for (const item of [...local.split(","), ...remote.split(",")]) {
      const trimmed = item.trim();
      if (trimmed && !seen.has(trimmed)) {
        seen.add(trimmed);
        parts.push(trimmed);
      }
    }
    return parts.join(", ");
  }
  return preferLocal ? local : remote;
}

function renderFrontmatterMerge(
  localFields: [string, string][],
  remoteFields: [string, string][],
  preferLocal: boolean,
  localBody: string,
  remoteBody: string,
): string {
  const keys = [
    ...new Set([...localFields.map(([key]) => key), ...remoteFields.map(([key]) => key)]),
  ];
  const lines = ["---"];
  for (const key of keys) {
    const localValue = localFields.find(([k]) => k === key)?.[1];
    const remoteValue = remoteFields.find(([k]) => k === key)?.[1];
    const value =
      localValue !== undefined && remoteValue !== undefined
        ? mergeFrontmatterValue(localValue, remoteValue, preferLocal)
        : localValue ?? remoteValue ?? "";
    lines.push(`${key}: ${value}`);
  }
  lines.push("---");
  const head = lines.join("\n");
  const body = unionMergeContent(localBody, remoteBody);
  return body ? `${head}\n\n${body}` : head;
}

function structuredMergeContent(local: string, remote: string, preferLocal: boolean): string {
  try {
    const localJson = JSON.parse(local);
    const remoteJson = JSON.parse(remote);
    const structured =
      (Array.isArray(localJson) || (localJson !== null && typeof localJson === "object")) &&
      (Array.isArray(remoteJson) || (remoteJson !== null && typeof remoteJson === "object"));
    if (structured) {
      return JSON.stringify(mergeJsonValue(localJson, remoteJson, preferLocal), null, 2);
    }
  } catch {}
  const localFrontmatter = parseFrontmatter(local);
  const remoteFrontmatter = parseFrontmatter(remote);
  if (localFrontmatter && remoteFrontmatter) {
    return renderFrontmatterMerge(
      localFrontmatter.fields,
      remoteFrontmatter.fields,
      preferLocal,
      localFrontmatter.body,
      remoteFrontmatter.body,
    );
  }
  return unionMergeContent(local, remote);
}

export async function resolveSyncConflictStructured(conflict: SyncConflictItem): Promise<string> {
  if (isTauri()) {
    return invoke<string>("resolve_sync_conflict_structured", { conflict });
  }
  const shape = readLocal();
  const preferLocal = conflict.localUpdatedAt >= conflict.remoteUpdatedAt;
  const content = structuredMergeContent(
    conflict.localContent,
    conflict.remoteContent,
    preferLocal,
  );
  const updatedAt = Date.now();
  if (conflict.kind === "clipboard") {
    const item = shape.clipboard.find((c) => c.id === conflict.id);
    if (!item) throw new Error(`clipboard conflict not found: ${conflict.id}`);
    item.content = content;
    item.timestamp = updatedAt;
    item.updatedAt = updatedAt;
  } else {
    const item = shape.logs.find((l) => l.id === conflict.id);
    if (!item) throw new Error(`log conflict not found: ${conflict.id}`);
    item.message = content;
    item.timestamp = updatedAt;
    item.updatedAt = updatedAt;
  }
  writeLocal(shape);
  const records = readSyncConflictRecords().map((record) =>
    record.id === conflict.id && record.kind === conflict.kind && !record.resolvedChoice
      ? { ...record, resolvedChoice: "structured", resolvedAt: updatedAt }
      : record,
  );
  writeSyncConflictRecords(records);
  appendSyncAudit("sync.resolve.structured", `${conflict.kind} ${conflict.id} -> structured`);
  return `Merged ${conflict.kind} conflict ${conflict.id} with fields`;
}

export async function resolveSyncConflictsStructured(
  conflicts: SyncConflictItem[],
): Promise<number> {
  if (isTauri()) {
    return invoke<number>("resolve_sync_conflicts_structured", { conflicts });
  }
  for (const conflict of conflicts) {
    await resolveSyncConflictStructured(conflict);
  }
  return conflicts.length;
}

export async function listSyncConflicts(
  status: "unresolved" | "resolved" | "all" = "unresolved",
): Promise<SyncConflictRecord[]> {
  if (isTauri()) return invoke<SyncConflictRecord[]>("list_sync_conflicts", { status });
  const records = readSyncConflictRecords();
  if (status === "unresolved") {
    return records.filter((record) => !record.resolvedChoice).sort((a, b) => b.createdAt - a.createdAt);
  }
  if (status === "resolved") {
    return records
      .filter((record) => record.resolvedChoice)
      .sort((a, b) => (b.resolvedAt ?? 0) - (a.resolvedAt ?? 0));
  }
  return records.sort((a, b) => b.createdAt - a.createdAt);
}

export async function clearResolvedSyncConflicts(): Promise<number> {
  if (isTauri()) return invoke<number>("clear_resolved_sync_conflicts");
  const records = readSyncConflictRecords();
  const remaining = records.filter((record) => !record.resolvedChoice);
  writeSyncConflictRecords(remaining);
  const cleared = records.length - remaining.length;
  appendSyncAudit("sync.history.cleared", `cleared ${cleared} resolved conflict(s)`);
  return cleared;
}

export async function listSyncAudit(
  limit = 50,
  event?: string,
  since?: number,
  deviceId?: string,
): Promise<SyncAuditEntry[]> {
  if (isTauri()) {
    return invoke<SyncAuditEntry[]>("list_sync_audit", {
      limit,
      event: event ?? null,
      since: since ?? null,
      deviceId: deviceId ?? null,
    });
  }
  return readSyncAudit()
    .filter((entry) => !event || entry.event === event)
    .filter((entry) => since == null || entry.createdAt >= since)
    .filter((entry) => !deviceId || entry.deviceId === deviceId)
    .slice(0, Math.max(1, Math.min(200, limit)));
}

export async function exportSyncAudit(
  format: "json" | "csv" = "json",
  event?: string,
  since?: number,
  deviceId?: string,
): Promise<string> {
  if (isTauri()) {
    return invoke<string>("export_sync_audit", {
      format,
      event: event ?? null,
      since: since ?? null,
      deviceId: deviceId ?? null,
    });
  }
  const entries = readSyncAudit()
    .filter((entry) => !event || entry.event === event)
    .filter((entry) => since == null || entry.createdAt >= since)
    .filter((entry) => !deviceId || entry.deviceId === deviceId);
  if (format === "json") return JSON.stringify(entries, null, 2);
  const escapeCsv = (value: string) =>
    /[,"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  const lines = ["id,event,detail,device_id,created_at"];
  for (const entry of entries) {
    lines.push(
      [entry.id, entry.event, entry.detail, entry.deviceId, entry.createdAt]
        .map((value) => escapeCsv(String(value)))
        .join(","),
    );
  }
  return lines.join("\n");
}

export async function clearSyncAudit(): Promise<number> {
  if (isTauri()) return invoke<number>("clear_sync_audit");
  const count = readSyncAudit().length;
  localStorage.removeItem(SYNC_AUDIT_LS_KEY);
  return count;
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

function sampleVaultFiles(vaultPath: string): VaultFileRecord[] {
  return [
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
}

type VaultWatchRecord = {
  watching: boolean;
  path: string | null;
  updatedAt: number;
  ignorePatterns: string[];
};

function readVaultWatchTargets(): VaultWatchTarget[] {
  try {
    const raw = localStorage.getItem(VAULT_WATCH_TARGETS_LS_KEY);
    if (raw) {
      return (JSON.parse(raw) as VaultWatchTarget[]).map((target) => ({
        ...target,
        lastEventAt: target.lastEventAt ?? 0,
        eventCount: target.eventCount ?? 0,
      }));
    }
  } catch {
    // fall through to legacy migration
  }
  const legacy = readVaultWatch();
  if (legacy.path) {
    return [
      {
        path: legacy.path,
        ignorePatterns: legacy.ignorePatterns ?? [],
        enabled: legacy.watching,
        updatedAt: legacy.updatedAt,
        lastEventAt: 0,
        eventCount: 0,
      },
    ];
  }
  return [];
}

function writeVaultWatchTargets(targets: VaultWatchTarget[]): VaultWatchTarget[] {
  localStorage.setItem(VAULT_WATCH_TARGETS_LS_KEY, JSON.stringify(targets));
  const first = targets[0];
  const record: VaultWatchRecord = {
    watching: first?.enabled ?? false,
    path: first?.path ?? null,
    updatedAt: first?.updatedAt ?? Date.now(),
    ignorePatterns: first?.ignorePatterns ?? [],
  };
  localStorage.setItem(VAULT_WATCH_LS_KEY, JSON.stringify(record));
  return targets;
}

function readVaultWatch(): VaultWatchRecord {
  try {
    const record = JSON.parse(localStorage.getItem(VAULT_WATCH_LS_KEY) ?? "null") as VaultWatchRecord | null;
    return record ?? { watching: false, path: null, updatedAt: 0, ignorePatterns: [] };
  } catch {
    return { watching: false, path: null, updatedAt: 0, ignorePatterns: [] };
  }
}

function readVaultWatchConfig(): VaultWatchConfig {
  const record = readVaultWatch();
  return {
    path: record.path ?? "",
    ignorePatterns: record.ignorePatterns ?? [],
    enabled: record.watching,
    updatedAt: record.updatedAt,
  };
}

function writeVaultWatchConfig(config: VaultWatchConfig): VaultWatchConfig {
  const record: VaultWatchRecord = {
    watching: config.enabled,
    path: config.path,
    updatedAt: config.updatedAt || Date.now(),
    ignorePatterns: config.ignorePatterns,
  };
  localStorage.setItem(VAULT_WATCH_LS_KEY, JSON.stringify(record));
  return { ...config, updatedAt: record.updatedAt };
}

export async function getVaultWatchConfig(): Promise<VaultWatchConfig> {
  if (isTauri()) return invoke<VaultWatchConfig>("get_vault_watch_config");
  return readVaultWatchConfig();
}

export async function setVaultWatchConfig(config: VaultWatchConfig): Promise<VaultWatchConfig> {
  if (isTauri()) {
    return invoke<VaultWatchConfig>("set_vault_watch_config", { config });
  }
  return writeVaultWatchConfig(config);
}

export async function listVaultWatchTargets(): Promise<VaultWatchTarget[]> {
  if (isTauri()) return invoke<VaultWatchTarget[]>("list_vault_watch_targets");
  return readVaultWatchTargets();
}

export async function upsertVaultWatchTarget(
  target: VaultWatchTarget,
): Promise<VaultWatchTarget> {
  if (isTauri()) {
    return invoke<VaultWatchTarget>("upsert_vault_watch_target", { target });
  }
  const targets = readVaultWatchTargets();
  const index = targets.findIndex((item) => item.path === target.path);
  const next: VaultWatchTarget = {
    ...target,
    updatedAt: target.updatedAt || Date.now(),
    lastEventAt: target.lastEventAt ?? 0,
    eventCount: target.eventCount ?? 0,
  };
  if (index >= 0) {
    targets[index] = next;
  } else {
    targets.push(next);
  }
  writeVaultWatchTargets(targets);
  return next;
}

export async function deleteVaultWatchTarget(vaultPath: string): Promise<boolean> {
  if (isTauri()) {
    return invoke<boolean>("delete_vault_watch_target", { vaultPath });
  }
  const targets = readVaultWatchTargets();
  const next = targets.filter((target) => target.path !== vaultPath);
  writeVaultWatchTargets(next);
  return next.length !== targets.length;
}

export async function listVaultTargetStats(): Promise<VaultTargetStats[]> {
  if (isTauri()) return invoke<VaultTargetStats[]>("list_vault_target_stats");
  const targets = readVaultWatchTargets();
  const files = readVaultFiles();
  return targets.map((target) => ({
    path: target.path,
    files: files.filter(
      (file) => file.path === target.path || file.path.startsWith(`${target.path}\\`),
    ).length,
    lastIndexedAt: 0,
    lastEventAt: target.lastEventAt ?? 0,
    eventCount: target.eventCount ?? 0,
  }));
}

export async function indexVault(
  vaultPath: string,
  ignorePatterns: string[] = [],
  concurrency = 4,
): Promise<IndexResult> {
  if (isTauri()) {
    return invoke<IndexResult>("index_vault_ex", {
      vaultPath,
      ignorePatterns,
      concurrency,
    });
  }
  const existing = readVaultFiles();
  const sample = sampleVaultFiles(vaultPath);
  const merged = existing.length > 0 ? existing : sample;
  const segments = ignorePatterns.map((p) => p.trim().toLowerCase()).filter(Boolean);
  const filtered = merged.filter(
    (file) => !segments.some((segment) => file.path.toLowerCase().includes(segment)),
  );
  localStorage.setItem(VAULT_LS_KEY, JSON.stringify(filtered));
  const cores = Math.max(1, Math.min(16, navigator.hardwareConcurrency || 4));
  const concurrencyUsed = Math.min(filtered.length || 1, filtered.length <= 32 ? 1 : Math.min(4, cores));
  return {
    files: filtered.length,
    ignored: merged.length - filtered.length,
    concurrencyUsed,
  };
}

const vaultIndexProgressHandlers: ((progress: IndexProgress) => void)[] = [];
const vaultIndexCancelled = new Set<string>();

export async function startVaultIndex(
  vaultPath: string,
  ignorePatterns: string[] = [],
  concurrency = 4,
): Promise<string> {
  if (isTauri()) {
    return invoke<string>("start_vault_index", { vaultPath, ignorePatterns, concurrency });
  }
  const runId = makeId();
  const result = await indexVault(vaultPath, ignorePatterns, concurrency);
  let step = 0;
  const tick = () => {
    step += 1;
    if (vaultIndexCancelled.has(runId)) {
      const progress: IndexProgress = {
        runId,
        path: vaultPath,
        done: 0,
        total: 0,
        files: 0,
        ignored: 0,
        concurrencyUsed: 0,
        status: "cancelled",
      };
      for (const handler of [...vaultIndexProgressHandlers]) handler(progress);
      vaultIndexCancelled.delete(runId);
      return;
    }
    const progress: IndexProgress = {
      runId,
      path: vaultPath,
      done: Math.min(result.files, Math.ceil((result.files * step) / 6)),
      total: result.files,
      files: result.files,
      ignored: result.ignored,
      concurrencyUsed: result.concurrencyUsed,
      status: step >= 6 ? "done" : "running",
    };
    for (const handler of [...vaultIndexProgressHandlers]) handler(progress);
    if (step >= 6) vaultIndexCancelled.delete(runId);
    if (step < 6) setTimeout(tick, 120);
  };
  setTimeout(tick, 30);
  return runId;
}

export async function cancelVaultIndex(runId: string): Promise<boolean> {
  if (isTauri()) return invoke<boolean>("cancel_vault_index", { runId });
  vaultIndexCancelled.add(runId);
  return true;
}

export async function listenVaultIndexProgress(
  handler: (progress: IndexProgress) => void,
): Promise<() => void> {
  if (isTauri()) {
    const { listen } = await import("@tauri-apps/api/event");
    return listen<IndexProgress>("vault-index-progress", (event) => handler(event.payload));
  }
  vaultIndexProgressHandlers.push(handler);
  return () => {
    const index = vaultIndexProgressHandlers.indexOf(handler);
    if (index >= 0) vaultIndexProgressHandlers.splice(index, 1);
  };
}

export async function getKnowledgeIndexStatus(): Promise<KnowledgeIndexStatus> {
  if (isTauri()) return invoke<KnowledgeIndexStatus>("get_knowledge_index_status");
  const files = readVaultFiles();
  return { files: files.length, indexedAt: files.length ? Date.now() : 0 };
}

export async function recommendIndexConcurrency(): Promise<RecommendedConcurrency> {
  if (isTauri()) return invoke<RecommendedConcurrency>("recommend_index_concurrency");
  const cores = navigator.hardwareConcurrency || 4;
  return { recommended: Math.max(1, Math.min(16, cores)), cores };
}

export async function startVaultWatch(
  vaultPath: string,
  ignorePatterns: string[] = [],
): Promise<VaultWatchStatus> {
  if (isTauri()) {
    return invoke<VaultWatchStatus>("start_vault_watch_ex", { vaultPath, ignorePatterns });
  }
  const existing = readVaultFiles();
  const merged = existing.length > 0 ? existing : sampleVaultFiles(vaultPath);
  const segments = ignorePatterns.map((p) => p.trim().toLowerCase()).filter(Boolean);
  const filtered = merged.filter(
    (file) => !segments.some((segment) => file.path.toLowerCase().includes(segment)),
  );
  const syncPath = `${vaultPath}\\Watch Sync Note.md`;
  if (!filtered.some((file) => file.path === syncPath)) {
    filtered.push({
      path: syncPath,
      title: "Watch Sync Note",
      tags: "#work,#vault",
      content: "# Watch Sync Note\n\n- 文件监听会自动把新 Markdown 纳入 RAG",
    });
  }
  localStorage.setItem(VAULT_LS_KEY, JSON.stringify(filtered));
  await upsertVaultWatchTarget({
    path: vaultPath,
    ignorePatterns,
    enabled: true,
    updatedAt: Date.now(),
    lastEventAt: 0,
    eventCount: 0,
  });
  const targets = readVaultWatchTargets().map((target) =>
    target.path === vaultPath
      ? { ...target, lastEventAt: Date.now(), eventCount: target.eventCount + 1 }
      : target,
  );
  writeVaultWatchTargets(targets);
  return getVaultWatchStatus();
}

export async function stopVaultWatch(vaultPath?: string): Promise<VaultWatchStatus> {
  if (isTauri()) {
    return invoke<VaultWatchStatus>(
      "stop_vault_watch",
      vaultPath ? { vaultPath } : {},
    );
  }
  const targets = readVaultWatchTargets().map((target) =>
    !vaultPath || target.path === vaultPath
      ? { ...target, enabled: false, updatedAt: Date.now() }
      : target,
  );
  writeVaultWatchTargets(targets);
  return getVaultWatchStatus();
}

export async function getVaultWatchStatus(): Promise<VaultWatchStatus> {
  if (isTauri()) return invoke<VaultWatchStatus>("get_vault_watch_status");
  const targets = readVaultWatchTargets();
  const watchingTargets = targets.filter((target) => target.enabled);
  return {
    watching: watchingTargets.length > 0,
    path: watchingTargets[0]?.path ?? null,
    paths: watchingTargets.map((target) => target.path),
    files: readVaultFiles().length,
    updatedAt: Math.max(0, ...targets.map((target) => target.updatedAt)),
  };
}

export async function listenVaultWatchUpdated(
  handler: (status: VaultWatchStatus) => void,
): Promise<() => void> {
  if (isTauri()) {
    const { listen } = await import("@tauri-apps/api/event");
    return listen<VaultWatchStatus>("vault-watch-update", (event) => handler(event.payload));
  }
  return () => {};
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

export async function generateCommitPrDraft(path: string, projectName: string): Promise<CommitPrDraft> {
  if (isTauri()) {
    return invoke<CommitPrDraft>("generate_commit_pr_draft", { path, projectName });
  }
  const ctx = await getProjectGitContext(path);
  const changes = ctx.changes.length ? ctx.changes : ["no changed files detected"];
  const commitType = changes.some((c) => c.toLowerCase().includes("docs/") || c.toLowerCase().endsWith(".md"))
    ? "docs"
    : changes.some((c) => {
        const lower = c.toLowerCase();
        return lower.includes("test") || lower.includes("verify") || lower.includes("spec");
      })
      ? "test"
      : ctx.branch.startsWith("fix/")
        ? "fix"
        : ctx.branch.startsWith("feature/") || ctx.branch.startsWith("feat/")
          ? "feat"
          : "chore";
  const scope = ctx.branch
    .replace(/^feature\//, "")
    .replace(/^feat\//, "")
    .replace(/^fix\//, "")
    .replace(/[/_]/g, "-");
  const first = changes[0] ?? "";
  const stem = first.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") ?? "workbench";
  const summaryTokens = stem
    .split(/[-_.\s]+/)
    .filter(
      (t) =>
        t &&
        !/^\d+$/.test(t) &&
        !["sprint", "and", "with", "for", "the", "a", "an"].includes(t.toLowerCase()),
    );
  const summary = (summaryTokens.slice(0, 4).join(" ") || "workbench changes").replace(/^\w/, (c) =>
    c.toUpperCase(),
  );
  const commitMessage = `${commitType}(${scope}): ${summary.toLowerCase()}`;
  const prTitle = `${commitType}(${scope}): ${summary}`;
  const prBody = `## Summary\n\n${projectName}\n\nBranch: \`${ctx.branch}\`\n\n## Changes\n\n${changes
    .map((c) => `- ${c}`)
    .join("\n")}\n\n## DoD\n\n- [ ] Code compiles and tests pass.\n- [ ] UI follows design tokens and stays stable.\n- [ ] Database changes include migrations if needed.\n- [ ] PR description matches the actual diff.\n`;
  return { branch: ctx.branch, commitMessage, prTitle, prBody, changes };
}

export async function applyCommit(path: string, message: string): Promise<GitCommitResult> {
  if (isTauri()) return invoke<GitCommitResult>("apply_commit", { path, message });
  return {
    committed: true,
    hash: `local-${makeId().slice(0, 8)}`,
    branch: "develop",
    message,
  };
}

export async function createRemotePr(
  path: string,
  title: string,
  body: string,
): Promise<RemotePrResult> {
  if (isTauri()) return invoke<RemotePrResult>("create_remote_pr", { path, title, body });
  return {
    created: true,
    url: "https://example.local/ai-workbench/pull/1",
    title,
    branch: "develop",
  };
}

export async function rebaseBranch(path: string, base: string): Promise<GitRebaseResult> {
  if (isTauri()) return invoke<GitRebaseResult>("rebase_branch", { path, baseBranch: base });
  const conflictDemo = path.includes("Hermes");
  return {
    rebased: !conflictDemo,
    conflict: conflictDemo,
    files: conflictDemo ? ["docs/conflict.md", "src/views/ProjectsView.tsx"] : [],
    base,
    branch: conflictDemo ? "feature/hermes" : "feature/sprint-31",
    head: conflictDemo ? "local-conflict" : `local-rebase-${makeId().slice(0, 8)}`,
  };
}

export async function abortRebase(path: string): Promise<string> {
  if (isTauri()) return invoke<string>("abort_rebase", { path });
  return "Rebase aborted on feature/sprint-31";
}

export async function resolveRebaseConflicts(
  path: string,
  strategy: string,
): Promise<ConflictResolutionResult> {
  if (isTauri()) {
    return invoke<ConflictResolutionResult>("resolve_rebase_conflicts", { path, strategy });
  }
  return {
    resolved: true,
    strategy,
    files: ["docs/conflict.md", "src/views/ProjectsView.tsx"],
    rebased: true,
    branch: "feature/hermes",
    head: `local-resolve-${makeId().slice(0, 8)}`,
    message: `Resolved 2 conflicted file(s) with ${strategy} and continued rebase`,
  };
}

export async function runProviderStreamSmokeTest(providerId: string): Promise<StreamSmokeResult> {
  if (isTauri()) {
    return invoke<StreamSmokeResult>("run_provider_stream_smoke_test", { providerId });
  }
  return { ok: true, chunks: 2, message: "Streamed 2 chunk(s)" };
}

export async function buildTeamSummary(contents: string[]): Promise<string> {
  if (isTauri()) return invoke<string>("build_team_summary", { contents });
  const lines = contents.map((content) => {
    const line = content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith("**") && !l.startsWith("-") && !l.startsWith("["));
    return (line || "No output").slice(0, 120);
  });
  return lines.length ? lines.join("\n") : "No agent output collected.";
}
