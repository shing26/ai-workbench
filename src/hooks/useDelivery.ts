import { useSyncExternalStore } from 'react';
import { deliveryOrchestrator } from '../lib/delivery';

export function useDeliverySnapshot() {
  return useSyncExternalStore(
    (listener) => deliveryOrchestrator.subscribe(listener),
    () => deliveryOrchestrator.getSnapshot(),
    () => deliveryOrchestrator.getSnapshot(),
  );
}
