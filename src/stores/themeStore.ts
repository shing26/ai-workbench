import { create } from "zustand";
import { applyTheme, readAccent, readTheme, resolveTheme, type AccentName, type ThemePreference } from "../lib/theme";

type ThemeState = {
  theme: ThemePreference;
  accent: AccentName;
  resolved: "dark" | "light";
  init: () => void;
  setTheme: (theme: ThemePreference) => void;
  setAccent: (accent: AccentName) => void;
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: "dark",
  accent: "emerald",
  resolved: "dark",
  init: () => {
    const theme = readTheme();
    const accent = readAccent();
    const resolved = resolveTheme(theme);
    applyTheme(theme, accent);
    set({ theme, accent, resolved });
  },
  setTheme: (theme) => {
    applyTheme(theme, get().accent);
    set({ theme, resolved: resolveTheme(theme) });
  },
  setAccent: (accent) => {
    applyTheme(get().theme, accent);
    set({ accent });
  },
}));
