import { create } from "zustand";

export type ViewId =
  | "chat"
  | "vibe-coding"
  | "knowledge"
  | "automation"
  | "monetization"
  | "connections";

interface AppState {
  activeView: ViewId;
  setActiveView: (view: ViewId) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeView: "chat",
  setActiveView: (view) => set({ activeView: view }),
}));
