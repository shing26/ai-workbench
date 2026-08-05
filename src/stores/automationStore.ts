import { create } from 'zustand';
import { useConnectionStore } from './connectionStore';

// ── Types ────────────────────────────────────────────

export type SourceType = 'rss' | 'web' | 'api-price' | 'api-custom';
export type TaskStatus = 'running' | 'paused' | 'ok' | 'failed';
export type TaskMode = 'live' | 'silent';
export type LogLevel = 'info' | 'warning' | 'error';

export interface AlertRule {
  field: string;
  operator: 'gt' | 'lt' | 'eq' | 'contains';
  value: string;
}

export interface TaskConfig {
  id: string;
  name: string;
  sourceType: SourceType;
  sourceUrl: string;
  schedule: number;
  alertRules: AlertRule[];
  mode: TaskMode;
  status: TaskStatus;
  lastRun: number | null;
  nextRun: number | null;
  createdAt: number;
}

export interface TaskLog {
  id: string;
  taskId: string;
  timestamp: number;
  level: LogLevel;
  message: string;
}

export type AutomationTab = 'active' | 'history' | 'templates';

interface AutomationState {
  tasks: TaskConfig[];
  logs: TaskLog[];
  activeTab: AutomationTab;
  selectedTaskId: string | null;
  alertCount: number;

  addTask: (
    name: string,
    cfg: Omit<TaskConfig, 'id' | 'name' | 'status' | 'lastRun' | 'nextRun' | 'createdAt'>,
  ) => string;
  removeTask: (id: string) => void;
  pauseTask: (id: string) => void;
  resumeTask: (id: string) => void;
  setTaskStatus: (id: string, status: TaskStatus) => void;
  updateLastRun: (id: string) => void;
  addLog: (log: Omit<TaskLog, 'id' | 'timestamp'>) => void;
  setActiveTab: (tab: AutomationTab) => void;
  setSelectedTaskId: (id: string | null) => void;
  clearAlertCount: () => void;
}

let counter = 0;
function genId() {
  return `auto-${Date.now()}-${++counter}`;
}

// ── NL Parser ────────────────────────────────────────

export interface ParsedAutomation {
  name: string;
  sourceType: SourceType;
  sourceUrl: string;
  schedule: number;
}

export function parseAutomationIntent(input: string): ParsedAutomation | null {
  const lower = input.toLowerCase();
  let sourceType: SourceType = 'web';
  if (/rss|feed/.test(lower)) sourceType = 'rss';
  else if (/price|btc|eth|币价|crypto|usd/.test(lower)) sourceType = 'api-price';
  else if (/api|接口|json/.test(lower)) sourceType = 'api-custom';
  const urlMatch = input.match(/(https?:\/\/[^\s]+)/);
  let sourceUrl = urlMatch ? urlMatch[1] : '';
  if (!sourceUrl && sourceType === 'api-price') {
    sourceUrl = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd';
  }
  let schedule = 5 * 60 * 1000;
  if (/hour|小时/.test(lower)) schedule = 60 * 60 * 1000;
  else if (/day|daily|天|日/.test(lower)) schedule = 24 * 60 * 60 * 1000;
  else if (/min|分/.test(lower)) {
    const m = lower.match(/(\d+)\s*(?:min|分)/);
    schedule = m ? parseInt(m[1]) * 60 * 1000 : 5 * 60 * 1000;
  }
  let name = input.slice(0, 40);
  if (name.length >= 40) name = name.slice(0, 37) + '...';
  return { name, sourceType, sourceUrl, schedule };
}

// ── Store ────────────────────────────────────────────

export const useAutomationStore = create<AutomationState>((set, get) => ({
  tasks: [],
  logs: [],
  activeTab: 'active',
  selectedTaskId: null,
  alertCount: 0,

  addTask: (name, cfg) => {
    const id = genId();
    const now = Date.now();
    const task: TaskConfig = {
      ...cfg,
      id,
      name,
      status: 'running',
      lastRun: null,
      nextRun: now + cfg.schedule,
      createdAt: now,
    };
    set((s) => ({ tasks: [...s.tasks, task], selectedTaskId: id }));
    return id;
  },

  removeTask: (id) =>
    set((s) => ({
      tasks: s.tasks.filter((t) => t.id !== id),
      logs: s.logs.filter((l) => l.taskId !== id),
      alertCount: s.logs
        .filter((l) => l.taskId !== id)
        .filter((l) => l.level === 'error' || l.level === 'warning').length,
      selectedTaskId: s.selectedTaskId === id ? null : s.selectedTaskId,
    })),

  pauseTask: (id) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, status: 'paused' as const } : t)),
    })),
  resumeTask: (id) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, status: 'running' as const } : t)),
    })),

  setTaskStatus: (id, status) =>
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, status } : t)) })),

  updateLastRun: (id) => {
    const now = Date.now();
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id ? { ...t, lastRun: now, nextRun: now + t.schedule } : t,
      ),
    }));
  },

  addLog: (log) => {
    const entry: TaskLog = { ...log, id: genId(), timestamp: Date.now() };
    set((s) => ({ logs: [...s.logs, entry] }));
    if (log.level === 'error' || log.level === 'warning') {
      const task = get().tasks.find((t) => t.id === log.taskId);
      const taskName = task?.name ?? 'Automation';
      useConnectionStore.getState().addEvent({
        source: 'automation',
        title: taskName + ' — ' + log.level.toUpperCase(),
        body: log.message,
        targetView: 'chat',
      });
    }
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedTaskId: (id) => set({ selectedTaskId: id }),
  clearAlertCount: () => set({ alertCount: 0 }),
}));
