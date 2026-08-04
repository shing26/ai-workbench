import { create } from "zustand";

export type ProjectStatus = "pending" | "active" | "archived";

export interface TemplateStep {
  label: string;
  done: boolean;
}

export interface MonetizationTemplate {
  name: string;
  steps: TemplateStep[];
}

export interface RevenueEntry {
  amount: number;
  source: string;
  timestamp: number;
}

export interface MonetizationProject {
  id: string;
  name: string;
  template: string | null;
  templateSteps: TemplateStep[];
  revenueLog: RevenueEntry[];
  generatedCode: string;
  status: ProjectStatus;
  createdAt: number;
}

export const TEMPLATES: MonetizationTemplate[] = [
  {
    name: "Landing Page",
    steps: [
      { label: "Buy domain", done: false },
      { label: "Deploy to Vercel / Netlify", done: false },
      { label: "Configure DNS", done: false },
      { label: "Add analytics", done: false },
    ],
  },
  {
    name: "Chrome Extension",
    steps: [
      { label: "Bundle as .crx", done: false },
      { label: "Submit to Chrome Web Store", done: false },
      { label: "Write description", done: false },
      { label: "Add screenshots", done: false },
    ],
  },
  {
    name: "Paid Content",
    steps: [
      { label: "Organize as document / course", done: false },
      { label: "Pick platform (Gumroad, etc.)", done: false },
      { label: "Set price", done: false },
      { label: "Publish", done: false },
    ],
  },
];

interface MonetizationState {
  projects: MonetizationProject[];
  selectedProjectId: string | null;

  addProject: (name: string, generatedCode: string) => string;
  selectTemplate: (id: string, templateName: string) => void;
  toggleStep: (id: string, stepIndex: number) => void;
  addRevenue: (id: string, amount: number, source: string) => void;
  updateProject: (id: string, partial: Partial<Pick<MonetizationProject, "name" | "template">>) => void;
  archiveProject: (id: string) => void;
  setSelectedProjectId: (id: string | null) => void;
  monthlyRevenue: () => number;
  allTimeRevenue: () => number;
  projectRevenue: (id: string) => number;
}

let counter = 0;
function genId() { return `mon-${Date.now()}-${++counter}`; }

export const useMonetizationStore = create<MonetizationState>((set, get) => ({
  projects: [],
  selectedProjectId: null,

  addProject: (name, generatedCode) => {
    const id = genId();
    const project: MonetizationProject = {
      id, name, template: null, templateSteps: [], revenueLog: [],
      generatedCode, status: "pending", createdAt: Date.now(),
    };
    set((s) => ({ projects: [...s.projects, project], selectedProjectId: id }));
    return id;
  },

  selectTemplate: (id, templateName) => {
    const tpl = TEMPLATES.find((t) => t.name === templateName);
    if (!tpl) return;
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === id
          ? { ...p, template: templateName, templateSteps: tpl.steps.map((st) => ({ ...st })), status: "active" as const }
          : p
      ),
    }));
  },

  toggleStep: (id, stepIndex) =>
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === id
          ? { ...p, templateSteps: p.templateSteps.map((st, i) => (i === stepIndex ? { ...st, done: !st.done } : st)) }
          : p
      ),
    })),

  addRevenue: (id, amount, source) =>
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === id
          ? { ...p, revenueLog: [...p.revenueLog, { amount, source, timestamp: Date.now() }] }
          : p
      ),
    })),

  updateProject: (id, partial) =>
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? { ...p, ...partial } : p)),
    })),

  archiveProject: (id) =>
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? { ...p, status: "archived" as const } : p)),
    })),

  setSelectedProjectId: (id) => set({ selectedProjectId: id }),

  monthlyRevenue: () => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return get().projects.reduce((sum, p) =>
      sum + p.revenueLog
        .filter((r) => r.timestamp >= monthStart)
        .reduce((s, r) => s + r.amount, 0), 0
    );
  },

  allTimeRevenue: () =>
    get().projects.reduce((sum, p) =>
      sum + p.revenueLog.reduce((s, r) => s + r.amount, 0), 0
    ),

  projectRevenue: (id) => {
    const p = get().projects.find((p) => p.id === id);
    return p ? p.revenueLog.reduce((s, r) => s + r.amount, 0) : 0;
  },
}));
