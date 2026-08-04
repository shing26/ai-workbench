import { create } from "zustand";
import * as db from "../lib/db";

export type ViewId = "ai-studio" | "projects" | "knowledge" | "actions" | "system";
export type InspectorSection = { label: string; value: string };
export type InspectorState = { title: string; sections: InspectorSection[] };

type WorkbenchState = {
  activeView: ViewId;
  setActiveView: (view: ViewId) => void;
  loaded: boolean;
  tasks: db.Task[];
  projects: db.Project[];
  thoughts: db.Thought[];
  providers: db.Provider[];
  sessions: db.Session[];
  habits: db.Habit[];
  scheduleEvents: db.ScheduleEvent[];
  clipboard: db.ClipboardItem[];
  logs: db.ErrorLog[];
  inspector: InspectorState | null;
  init: () => Promise<void>;
  addTask: (title: string, isToday: boolean) => Promise<void>;
  setTaskStatus: (id: string, status: db.TaskStatus) => Promise<void>;
  setTaskToday: (id: string, isToday: boolean) => Promise<void>;
  addProject: (name: string, path: string) => Promise<void>;
  addThought: (content: string, tags: string, type: db.ThoughtType) => Promise<void>;
  addProvider: (name: string, baseUrl: string, apiKey: string) => Promise<void>;
  toggleProvider: (id: string, isActive: boolean) => Promise<void>;
  addHabit: (name: string, weekGoal: number, color: db.Habit["color"]) => Promise<void>;
  toggleHabit: (id: string) => Promise<void>;
  addScheduleEvent: (title: string, startTime: string, tag: string) => Promise<void>;
  toggleEventDone: (id: string) => Promise<void>;
  openInspector: (title: string, sections: InspectorSection[]) => void;
  closeInspector: () => void;
};

export const useWorkbenchStore = create<WorkbenchState>((set, get) => ({
  activeView: "ai-studio",
  setActiveView: (activeView) => set({ activeView }),
  loaded: false,
  tasks: [],
  projects: [],
  thoughts: [],
  providers: [],
  sessions: [],
  habits: [],
  scheduleEvents: [],
  clipboard: [],
  logs: [],
  inspector: null,
  init: async () => {
    if (get().loaded) return;
    await db.initDb();
    const [tasks, projects, thoughts, providers, sessions, habits, scheduleEvents, clipboard, logs] = await Promise.all([
      db.listTasks(),
      db.listProjects(),
      db.listThoughts(),
      db.listProviders(),
      db.listSessions(),
      db.listHabits(),
      db.listScheduleEvents(),
      db.listClipboard(),
      db.listErrorLogs(),
    ]);
    set({ tasks, projects, thoughts, providers, sessions, habits, scheduleEvents, clipboard, logs, loaded: true });
  },
  addTask: async (title, isToday) => {
    await db.createTask(title, isToday);
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
  addProject: async (name, path) => {
    await db.createProject(name, path);
    set({ projects: await db.listProjects() });
  },
  addThought: async (content, tags, type) => {
    await db.createThought(content, tags, type);
    set({ thoughts: await db.listThoughts() });
  },
  addProvider: async (name, baseUrl, apiKey) => {
    await db.createProvider(name, baseUrl, apiKey);
    set({ providers: await db.listProviders() });
  },
  toggleProvider: async (id, isActive) => {
    await db.setProviderActive(id, isActive);
    set({ providers: await db.listProviders() });
  },
  addHabit: async (name, weekGoal, color) => {
    await db.createHabit(name, weekGoal, color);
    set({ habits: await db.listHabits() });
  },
  toggleHabit: async (id) => {
    await db.toggleHabit(id);
    set({ habits: await db.listHabits() });
  },
  addScheduleEvent: async (title, startTime, tag) => {
    await db.createScheduleEvent(title, startTime, tag);
    set({ scheduleEvents: await db.listScheduleEvents() });
  },
  toggleEventDone: async (id) => {
    await db.toggleEventDone(id);
    set({ scheduleEvents: await db.listScheduleEvents() });
  },
  openInspector: (title, sections) => set({ inspector: { title, sections } }),
  closeInspector: () => set({ inspector: null }),
}));
