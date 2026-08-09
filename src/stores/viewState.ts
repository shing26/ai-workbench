import { useCallback } from 'react';
import { create } from 'zustand';

export type ViewId = 'ai-studio' | 'projects' | 'knowledge' | 'actions' | 'system';

export type ViewStateMap = Record<ViewId, Record<string, unknown>>;

type ViewStateStore = {
  viewState: ViewStateMap;
  setViewState: (view: ViewId, key: string, value: unknown) => void;
  resetView: (view: ViewId) => void;
};

export const useViewStateStore = create<ViewStateStore>((set) => ({
  viewState: {
    'ai-studio': {},
    projects: {},
    knowledge: {},
    actions: {},
    system: {},
  },
  setViewState: (view, key, value) =>
    set((state) => ({
      viewState: {
        ...state.viewState,
        [view]: { ...state.viewState[view], [key]: value },
      },
    })),
  resetView: (view) =>
    set((state) => ({
      viewState: { ...state.viewState, [view]: {} },
    })),
}));

export function useViewState<T>(view: ViewId, key: string, initial: T): [T, (value: T) => void] {
  const value = useViewStateStore((s) => s.viewState[view][key] as T | undefined);
  const setViewState = useViewStateStore((s) => s.setViewState);
  const set = useCallback((next: T) => setViewState(view, key, next), [setViewState, view, key]);
  const resolved: T = value === undefined ? initial : value;
  return [resolved, set];
}
