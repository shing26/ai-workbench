import { beforeEach, describe, expect, it } from 'vitest';
import { useViewStateStore } from './viewState';

const EMPTY = {
  'ai-studio': {},
  dashboard: {},
  projects: {},
  knowledge: {},
  actions: {},
};

beforeEach(() => {
  useViewStateStore.setState({ viewState: structuredClone(EMPTY) });
});

describe('viewState store', () => {
  it('persists keyed state per view without cross-view leakage', () => {
    useViewStateStore.getState().setViewState('ai-studio', 'input', 'hello');
    useViewStateStore.getState().setViewState('dashboard', 'input', 'world');
    expect(useViewStateStore.getState().viewState['ai-studio'].input).toBe('hello');
    expect(useViewStateStore.getState().viewState['dashboard'].input).toBe('world');
  });

  it('resetView clears only the target view', () => {
    useViewStateStore.getState().setViewState('projects', 'tab', 'grid');
    useViewStateStore.getState().setViewState('actions', 'tab', 'queue');
    useViewStateStore.getState().resetView('projects');
    expect(useViewStateStore.getState().viewState['projects']).toEqual({});
    expect(useViewStateStore.getState().viewState['actions']).toEqual({ tab: 'queue' });
  });
});
