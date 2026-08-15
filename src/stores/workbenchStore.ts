import { create } from 'zustand';
import * as db from '../lib/db';
import type { InspectorMetrics } from '../types/llm';

export type ViewId = 'ai-studio' | 'dashboard' | 'projects' | 'knowledge' | 'actions';
export type InspectorSection = { label: string; value: string };
export type InspectorState = {
  title: string;
  sections: InspectorSection[];
  metrics: InspectorMetrics | null;
};

export type VibeContext = {
  projectId: string;
  projectName: string;
  journeyDocPath: string | null;
  path: string;
  branch: string;
  head: string;
  commitCount: number;
  latestCommit: string;
  changes: string[];
  mountedAt: number;
};

export type NoteContext = {
  thoughtId: string;
  title: string;
  content: string;
  tags: string;
  type: string;
  mountedAt: number;
};

export type ActionContext = {
  taskId: string;
  title: string;
  status: string;
  dueDate: string | null;
  isToday: boolean;
  mountedAt: number;
};

type WorkbenchState = {
  activeView: ViewId;
  setActiveView: (view: ViewId) => void;
  loaded: boolean;
  tasks: db.Task[];
  projects: db.Project[];
  thoughts: db.Thought[];
  sessions: db.Session[];
  clipboard: db.ClipboardItem[];
  logs: db.ErrorLog[];
  inspector: InspectorState | null;
  vibeContext: VibeContext | null;
  noteContext: NoteContext | null;
  actionContext: ActionContext | null;
  eventLogs: { id: string; type: string; message: string; timestamp: string }[];
  init: () => Promise<void>;
  restoreWorkspace: () => Promise<boolean>;
  addEventLog: (type: string, message: string) => void;
  refreshMountedGitStatus: () => Promise<void>;
  refreshTasks: () => Promise<void>;
  addTask: (
    title: string,
    isToday: boolean,
    projectId?: string | null,
    isDod?: boolean,
  ) => Promise<void>;
  setTaskStatus: (id: string, status: db.TaskStatus) => Promise<void>;
  setTaskToday: (id: string, isToday: boolean) => Promise<void>;
  setTaskDueDate: (id: string, dueDate: string | null) => Promise<void>;
  updateTaskTitle: (id: string, title: string) => Promise<void>;
  deleteTask: (id: string, confirmed?: boolean) => Promise<void>;
  addProject: (name: string, path: string) => Promise<void>;
  updateProject: (id: string, status: string, revenue: number) => Promise<void>;
  updateProjectJourney: (
    id: string,
    stage: db.ProjectJourneyStage,
    journeyDocPath?: string | null,
  ) => Promise<void>;
  setProjectMaterial: (id: string, material: string) => Promise<void>;
  deleteProject: (id: string, confirmed?: boolean) => Promise<void>;
  reorderProjects: (ids: string[]) => Promise<void>;
  setProjects: (projects: db.Project[]) => void;
  addThought: (content: string, tags: string, type: db.ThoughtType) => Promise<void>;
  updateThoughtTags: (id: string, tags: string) => Promise<void>;
  updateThoughtContent: (id: string, content: string) => Promise<void>;
  updateThoughtType: (id: string, type: db.ThoughtType) => Promise<void>;
  deleteThought: (id: string, confirmed?: boolean) => Promise<void>;
  refreshSystem: () => Promise<void>;
  reportError: (
    source: string,
    message: string,
    stack: string | null,
    severity: string,
  ) => Promise<void>;
  openInspector: (title: string, sections: InspectorSection[], keepMetrics?: boolean) => void;
  setInspectorMetrics: (patch: Partial<InspectorMetrics>) => void;
  setVibeContext: (ctx: VibeContext) => void;
  clearVibeContext: () => void;
  setNoteContext: (ctx: NoteContext) => void;
  clearNoteContext: () => void;
  setActionContext: (ctx: ActionContext) => void;
  clearActionContext: () => void;
  closeInspector: () => void;
};

export const useWorkbenchStore = create<WorkbenchState>((set, get) => ({
  activeView: 'dashboard',
  setActiveView: (activeView) => set({ activeView }),
  loaded: false,
  tasks: [],
  projects: [],
  thoughts: [],
  sessions: [],
  clipboard: [],
  logs: [],
  inspector: null,
  vibeContext: null,
  noteContext: null,
  actionContext: null,
  eventLogs: [],
  init: async () => {
    if (get().loaded) return;
    await db.initDb();
    const [tasks, projects, thoughts, sessions, clipboard, logs] = await Promise.all([
      db.listTasks(),
      db.listProjects(),
      db.listThoughts(),
      db.listSessions(),
      db.listClipboard(),
      db.listErrorLogs(),
    ]);
    set({
      tasks,
      projects,
      thoughts,
      sessions,
      clipboard,
      logs,
      loaded: true,
    });
  },
  restoreWorkspace: async () => {
    if (get().loaded) return true;
    await db.initDb();
    try {
      const summary = await db.getWorkspaceSummary();
      const [clipboard, logs] = await Promise.all([db.listClipboard(), db.listErrorLogs()]);
      set({
        projects: summary.projects,
        tasks: summary.tasks,
        thoughts: summary.thoughts,
        sessions: summary.sessions,
        clipboard,
        logs,
        loaded: true,
      });
      return true;
    } catch {
      return false;
    }
  },
  addTask: async (title, isToday, projectId = null, isDod = false) => {
    await db.createTask(title, isToday, projectId, isDod);
    set({ tasks: await db.listTasks() });
  },
  setTaskStatus: async (id, status) => {
    await db.updateTaskStatus(id, status);
    set({ tasks: await db.listTasks() });
  },
  setTaskToday: async (id, isToday) => {
    await db.setTaskToday(id, isToday);
    set({ tasks: await db.listTasks() });
  },
  setTaskDueDate: async (id, dueDate) => {
    await db.setTaskDueDate(id, dueDate);
    set({ tasks: await db.listTasks() });
  },
  updateTaskTitle: async (id, title) => {
    await db.updateTaskTitle(id, title);
    set({ tasks: await db.listTasks() });
  },
  deleteTask: async (id, confirmed = false) => {
    await db.deleteTask(id, confirmed);
    set({ tasks: await db.listTasks() });
  },
  addProject: async (name, path) => {
    await db.createProject(name, path);
    set({ projects: await db.listProjects() });
  },
  updateProject: async (id, status, revenue) => {
    await db.updateProject(id, status, revenue);
    set({ projects: await db.listProjects() });
  },
  updateProjectJourney: async (id, stage, journeyDocPath = null) => {
    await db.updateProjectJourney(id, stage, journeyDocPath);
    set({ projects: await db.listProjects() });
  },
  setProjectMaterial: async (id, material) => {
    await db.updateProjectMaterial(id, material);
    set({ projects: await db.listProjects() });
  },
  deleteProject: async (id, confirmed = false) => {
    await db.deleteProject(id, confirmed);
    set({ projects: await db.listProjects() });
  },
  reorderProjects: async (ids) => {
    await db.reorderProjects(ids);
    set({ projects: await db.listProjects() });
  },
  setProjects: (projects) => set({ projects }),
  addThought: async (content, tags, type) => {
    await db.createThought(content, tags, type);
    set({ thoughts: await db.listThoughts() });
  },
  updateThoughtTags: async (id, tags) => {
    await db.updateThoughtTags(id, tags);
    set({ thoughts: await db.listThoughts() });
  },
  updateThoughtContent: async (id, content) => {
    await db.updateThoughtContent(id, content);
    set({ thoughts: await db.listThoughts() });
  },
  updateThoughtType: async (id, type) => {
    await db.updateThoughtType(id, type);
    set({ thoughts: await db.listThoughts() });
  },
  deleteThought: async (id, confirmed = false) => {
    await db.deleteThought(id, confirmed);
    set({ thoughts: await db.listThoughts() });
  },
  refreshSystem: async () => {
    const [clipboard, logs] = await Promise.all([db.listClipboard(), db.listErrorLogs()]);
    set({ clipboard, logs });
  },
  reportError: async (source, message, stack, severity) => {
    try {
      await db.reportFrontendError({ source, message, stack, severity });
    } catch {
      return;
    }
    set({ logs: await db.listErrorLogs() });
  },
  openInspector: (title, sections, keepMetrics) =>
    set((state) => ({
      inspector: {
        title,
        sections,
        metrics: keepMetrics ? (state.inspector?.metrics ?? null) : null,
      },
    })),
  setInspectorMetrics: (patch) =>
    set((state) => {
      if (!state.inspector) return state;
      return {
        inspector: {
          ...state.inspector,
          metrics: {
            providerName: '',
            modelName: '',
            baseUrl: '',
            temperature: 0,
            ttftMs: null,
            totalTokens: 0,
            tokensPerSec: 0,
            contextUsed: 0,
            contextLimit: 128000,
            status: 'idle',
            ...state.inspector.metrics,
            ...patch,
          },
        },
      };
    }),
  closeInspector: () => set({ inspector: null }),
  setVibeContext: (ctx) => set({ vibeContext: ctx }),
  clearVibeContext: () => set({ vibeContext: null }),
  setNoteContext: (ctx) => set({ noteContext: ctx }),
  clearNoteContext: () => set({ noteContext: null }),
  setActionContext: (ctx) => set({ actionContext: ctx }),
  clearActionContext: () => set({ actionContext: null }),
  addEventLog: (type, message) => {
    const timestamp = new Date().toTimeString().split(' ')[0];
    set((state) => ({
      eventLogs: [
        { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, type, message, timestamp },
        ...state.eventLogs,
      ].slice(0, 100),
    }));
  },
  refreshMountedGitStatus: async () => {
    const vibe = get().vibeContext;
    if (!vibe || !vibe.path) return;
    try {
      const ctx = await db.getProjectGitContext(vibe.path);
      set({
        vibeContext: {
          ...vibe,
          branch: ctx.branch,
          head: ctx.head,
          commitCount: ctx.commitCount,
          latestCommit: ctx.latestCommit,
          changes: ctx.changes,
        },
      });
    } catch {
      /* git context unavailable */
    }
  },
  refreshTasks: async () => {
    set({ tasks: await db.listTasks() });
  },
}));
