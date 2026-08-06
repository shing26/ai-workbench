import { create } from 'zustand';
import * as db from '../lib/db';
import type { WeekPlanTemplate } from '../lib/weekPlanTemplates';

export type ViewId = 'ai-studio' | 'projects' | 'knowledge' | 'actions' | 'system';
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
  setTaskDueDate: (id: string, dueDate: string | null) => Promise<void>;
  addProject: (name: string, path: string) => Promise<void>;
  updateProject: (id: string, status: string, revenue: number) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  reorderProjects: (ids: string[]) => Promise<void>;
  setProjects: (projects: db.Project[]) => void;
  addThought: (content: string, tags: string, type: db.ThoughtType) => Promise<void>;
  updateThoughtTags: (id: string, tags: string) => Promise<void>;
  updateThoughtContent: (id: string, content: string) => Promise<void>;
  updateThoughtType: (id: string, type: db.ThoughtType) => Promise<void>;
  deleteThought: (id: string) => Promise<void>;
  addProvider: (name: string, baseUrl: string, apiKey: string, model?: string) => Promise<void>;
  toggleProvider: (id: string, isActive: boolean) => Promise<void>;
  setProviderModel: (id: string, model: string) => Promise<void>;
  setProviderPriority: (id: string, priority: number) => Promise<void>;
  addHabit: (name: string, weekGoal: number, color: db.Habit['color']) => Promise<void>;
  toggleHabit: (id: string) => Promise<void>;
  updateHabitWeekGoal: (id: string, weekGoal: number) => Promise<void>;
  deleteHabit: (id: string) => Promise<void>;
  addScheduleEvent: (title: string, startTime: string, tag: string, date: string) => Promise<void>;
  applyWeekPlan: (
    template: WeekPlanTemplate,
    weekDays: string[],
    todayKey: string,
  ) => Promise<{ focusCount: number; eventCount: number }>;
  toggleEventDone: (id: string) => Promise<void>;
  refreshSystem: () => Promise<void>;
  reportError: (
    source: string,
    message: string,
    stack: string | null,
    severity: string,
  ) => Promise<void>;
  openInspector: (title: string, sections: InspectorSection[]) => void;
  closeInspector: () => void;
};

export const useWorkbenchStore = create<WorkbenchState>((set, get) => ({
  activeView: 'ai-studio',
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
    const [
      tasks,
      projects,
      thoughts,
      providers,
      sessions,
      habits,
      scheduleEvents,
      clipboard,
      logs,
    ] = await Promise.all([
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
    set({
      tasks,
      projects,
      thoughts,
      providers,
      sessions,
      habits,
      scheduleEvents,
      clipboard,
      logs,
      loaded: true,
    });
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
  setTaskDueDate: async (id, dueDate) => {
    await db.setTaskDueDate(id, dueDate);
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
  deleteProject: async (id) => {
    await db.deleteProject(id);
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
  deleteThought: async (id) => {
    await db.deleteThought(id);
    set({ thoughts: await db.listThoughts() });
  },
  addProvider: async (name, baseUrl, apiKey, model = '') => {
    await db.createProvider(name, baseUrl, apiKey, model);
    set({ providers: await db.listProviders() });
  },
  toggleProvider: async (id, isActive) => {
    await db.setProviderActive(id, isActive);
    set({ providers: await db.listProviders() });
  },
  setProviderModel: async (id, model) => {
    await db.updateProviderModel(id, model);
    set({ providers: await db.listProviders() });
  },
  setProviderPriority: async (id, priority) => {
    await db.setProviderPriority(id, priority);
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
  updateHabitWeekGoal: async (id, weekGoal) => {
    await db.updateHabitWeekGoal(id, weekGoal);
    set({ habits: await db.listHabits() });
  },
  deleteHabit: async (id) => {
    await db.deleteHabit(id);
    set({ habits: await db.listHabits() });
  },
  addScheduleEvent: async (title, startTime, tag, date) => {
    await db.createScheduleEvent(title, startTime, tag, date);
    set({ scheduleEvents: await db.listScheduleEvents() });
  },
  applyWeekPlan: async (template, weekDays, todayKey) => {
    let focusCount = 0;
    let eventCount = 0;
    for (let i = 0; i < template.days.length && i < weekDays.length; i += 1) {
      const day = template.days[i];
      const date = weekDays[i];
      for (const focus of day.focus) {
        if (!focus.trim()) continue;
        const task = await db.createTask(focus.trim(), date === todayKey);
        if (date !== todayKey) await db.setTaskToday(task.id, false);
        await db.setTaskDueDate(task.id, date);
        focusCount += 1;
      }
      for (const event of day.events) {
        if (!event.title.trim()) continue;
        await db.createScheduleEvent(event.title.trim(), event.time, event.tag, date);
        eventCount += 1;
      }
    }
    set({
      tasks: await db.listTasks(),
      scheduleEvents: await db.listScheduleEvents(),
    });
    return { focusCount, eventCount };
  },
  toggleEventDone: async (id) => {
    await db.toggleEventDone(id);
    set({ scheduleEvents: await db.listScheduleEvents() });
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
  openInspector: (title, sections) => set({ inspector: { title, sections } }),
  closeInspector: () => set({ inspector: null }),
}));
