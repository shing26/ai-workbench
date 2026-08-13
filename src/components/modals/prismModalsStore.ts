import { create } from 'zustand';
import * as db from '../../lib/db';

export type CliKind = string;

export type CliModalPayload = {
  projectName?: string;
  specPath?: string;
  prompt?: string;
  tasks?: string[];
  taskId?: string;
  isFix?: boolean;
};

export type AttachModalPayload = {
  taskId?: string;
  taskTitle?: string;
};

export type PrismModal =
  | { kind: 'search' }
  | { kind: 'shortcuts' }
  | { kind: 'cli'; payload: CliModalPayload }
  | { kind: 'attach'; payload: AttachModalPayload }
  | { kind: 'provider' }
  | null;

type PrismModalsState = {
  modal: PrismModal;
  cliKind: CliKind;
  attachedPaths: string[];
  detectedCliTools: db.CliToolDetection[];
  openSearch: () => void;
  openShortcuts: () => void;
  openCli: (payload: CliModalPayload) => void;
  openAttach: (payload: AttachModalPayload) => void;
  openProvider: () => void;
  closeModal: () => void;
  setCliKind: (kind: CliKind) => void;
  setAttachedPaths: (paths: string[]) => void;
  refreshCliTools: () => Promise<void>;
};

export const usePrismModals = create<PrismModalsState>((set, get) => ({
  modal: null,
  cliKind: 'claude',
  attachedPaths: [],
  detectedCliTools: [],
  openSearch: () => set({ modal: { kind: 'search' } }),
  openShortcuts: () => set({ modal: { kind: 'shortcuts' } }),
  openCli: (payload) => set({ modal: { kind: 'cli', payload } }),
  openAttach: (payload) => set({ modal: { kind: 'attach', payload } }),
  openProvider: () => set({ modal: { kind: 'provider' } }),
  closeModal: () => set({ modal: null }),
  setCliKind: (cliKind) => set({ cliKind }),
  setAttachedPaths: (attachedPaths) => set({ attachedPaths }),
  refreshCliTools: async () => {
    const tools = await db.detectCliTools();
    const detected = tools.filter((tool) => tool.detected);
    set({ detectedCliTools: tools });
    if (detected.length === 0) return;
    const current = get().cliKind;
    if (!detected.some((tool) => tool.bin === current)) {
      const preferred = detected.find((tool) => tool.bin === 'claude') ?? detected[0];
      if (preferred) set({ cliKind: preferred.bin });
    }
  },
}));
