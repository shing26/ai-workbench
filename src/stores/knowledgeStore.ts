import { create } from "zustand";

export interface Note {
  id: string;
  title: string;
  content: string;
  project: string;
  tags: string[];
  fileName: string;
  createdAt: number;
}

interface KnowledgeState {
  notes: Note[];
  selectedProject: string | null;
  selectedTag: string | null;
  searchQuery: string;

  addNote: (note: Omit<Note, "id" | "fileName" | "createdAt">) => string;
  removeNote: (id: string) => void;
  setSelectedProject: (project: string | null) => void;
  setSelectedTag: (tag: string | null) => void;
  setSearchQuery: (query: string) => void;
  projects: () => string[];
  allTags: () => string[];
  filteredNotes: () => Note[];
}

let counter = 0;
function genId() { return `note-${Date.now()}-${++counter}`; }

export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
}

export function inferTitle(content: string): string {
  const line = content.split("\n")[0].replace(/^#+\s*/, "").trim();
  return line.slice(0, 60) || "Untitled";
}

export function inferTags(content: string): string[] {
  const techTerms = [
    "React", "TypeScript", "Rust", "Tauri", "API", "AI", "LLM", "Ollama", "OpenAI",
    "Codex", "Zustand", "Framer Motion", "Tailwind", "Vite", "Node.js", "SQLite",
    "RAG", "向量", "embedding", "prompt", "微调", "部署", "Docker", "Git", "CI/CD",
    "Obsidian", "Markdown", "前端", "后端", "Rust", "Python", "数据库",
  ];
  const found = techTerms.filter((t) => content.toLowerCase().includes(t.toLowerCase()));
  return found.slice(0, 5);
}

function inferProject(content: string): string {
  if (/tauri|desktop|桌面/.test(content.toLowerCase())) return "AI Workbench";
  if (/automation|自动化/.test(content.toLowerCase())) return "Automation";
  return "General";
}

export const useKnowledgeStore = create<KnowledgeState>((set, get) => ({
  notes: [],
  selectedProject: null,
  selectedTag: null,
  searchQuery: "",

  addNote: (note) => {
    const id = genId();
    const fileName = `${slugify(note.title)}-${Date.now()}.md`;
    const entry: Note = { ...note, id, fileName, createdAt: Date.now() };
    set((s) => ({ notes: [...s.notes, entry] }));
    return id;
  },

  removeNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),

  setSelectedProject: (project) => set({ selectedProject: project, selectedTag: null }),
  setSelectedTag: (tag) => set({ selectedTag: tag }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  projects: () => [...new Set(get().notes.map((n) => n.project))],
  allTags: () => [...new Set(get().notes.flatMap((n) => n.tags))],

  filteredNotes: () => {
    const { notes, selectedProject, selectedTag, searchQuery } = get();
    let result = notes;
    if (selectedProject) result = result.filter((n) => n.project === selectedProject);
    if (selectedTag) result = result.filter((n) => n.tags.includes(selectedTag));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return result.sort((a, b) => b.createdAt - a.createdAt);
  },

  // Helpers used by chat integration
  snapshot: () => get(),
}));

export function inferProjectFromContent(content: string): string {
  return inferProject(content);
}
