import { create } from "zustand";
import { runCodex } from "../lib/backend";
import { useConnectionStore } from "./connectionStore";
import { useMonetizationStore } from "./monetizationStore";

export type VibePhase =
  | "idle"
  | "capture"
  | "clarifying"
  | "implementing"
  | "running"
  | "done"
  | "accepted";

export interface Clarification {
  question: string;
  options: string[];
  selected: string | null;
}

const MOCK_CLARIFICATIONS: Clarification[] = [
  {
    question: "这个项目的目标平台是什么？",
    options: ["Web 应用", "桌面应用", "CLI 工具", "移动端"],
    selected: null,
  },
  {
    question: "你倾向什么技术栈？",
    options: ["React + TypeScript", "Vue + JS", "纯 HTML/CSS/JS", "Python"],
    selected: null,
  },
  {
    question: "是否需要后端服务？",
    options: ["需要完整后端", "仅前端静态页面", "使用现有 API", "不确定"],
    selected: null,
  },
];

interface VibeState {
  phase: VibePhase;
  idea: string;
  clarifications: Clarification[];
  progress: string;
  generatedCode: string;
  runOutput: string;

  setIdea: (idea: string) => void;
  startClarifying: () => void;
  selectClarification: (index: number, value: string) => void;
  startImplementing: () => void;
  startRunning: () => void;
  accept: () => void;
  reset: () => void;
}

export const useVibeStore = create<VibeState>((set, get) => ({
  phase: "capture",
  idea: "",
  clarifications: MOCK_CLARIFICATIONS.map((c) => ({ ...c })),
  progress: "",
  generatedCode: "",
  runOutput: "",

  setIdea: (idea) => set({ idea }),

  startClarifying: () => set({ phase: "clarifying" }),

  selectClarification: (index, value) =>
    set((s) => ({
      clarifications: s.clarifications.map((c, i) =>
        i === index ? { ...c, selected: value } : c
      ),
    })),

  startImplementing: () => {
    const { idea, clarifications } = get();
    set({ phase: "implementing", progress: "正在通过 Codex CLI 实现..." });

    const clarificationsJson = JSON.stringify(
      clarifications
        .filter((c) => c.selected)
        .map((c) => ({ question: c.question, selected: c.selected }))
    );

    runCodex(idea, clarificationsJson)
      .then((code) => {
        set({
          progress: "实现完成！",
          generatedCode: code,
        });
      })
      .catch((err) => {
        set({
          progress: `实现失败: ${err}`,
          generatedCode: `// Error: ${err}`,
        });
      });
  },

  startRunning: () => {
    set({ phase: "running", runOutput: "正在执行..." });
    setTimeout(() => {
      set({
        runOutput:
          "✓ 构建成功\n✓ 0 errors, 0 warnings\n✓ Development server started",
      });
    }, 1500);
    setTimeout(() => {
      useConnectionStore.getState().addEvent({
        source: "vibe",
        title: "Implementation complete",
        body: "Vibe Coding project \"" + get().idea.slice(0, 50) + "\" is ready for review",
        targetView: "vibe-coding",
      });
      set({ phase: "done" });
    }, 2000);
  },

  accept: () => {
    const { idea, generatedCode } = get();
    useMonetizationStore.getState().addProject(idea || "Untitled Project", generatedCode);
    set({ phase: "accepted" });
  },

  reset: () =>
    set({
      phase: "capture",
      idea: "",
      clarifications: MOCK_CLARIFICATIONS.map((c) => ({ ...c })),
      progress: "",
      generatedCode: "",
      runOutput: "",
    }),
}));
