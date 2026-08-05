import { create } from 'zustand';

interface SettingsState {
  vaultPath: string;
  setVaultPath: (path: string) => void;
  isConfigured: () => boolean;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  vaultPath: '',
  setVaultPath: (path) => set({ vaultPath: path }),
  isConfigured: () => get().vaultPath.trim().length > 0,
}));
