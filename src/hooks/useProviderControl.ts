import { useSyncExternalStore } from 'react';
import { providerControlOrchestrator } from '../lib/providerControl';

export function useProviderControlSnapshot() {
  return useSyncExternalStore(
    (listener) => providerControlOrchestrator.subscribe(listener),
    () => providerControlOrchestrator.getSnapshot(),
    () => providerControlOrchestrator.getSnapshot(),
  );
}
