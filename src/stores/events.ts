import { useEffect } from 'react';

type Listener<T = unknown> = (payload: T) => void;

const listeners = new Map<string, Set<Listener<unknown>>>();

export const TOPICS = {
  WEBHOOK_DELIVERIES_UPDATED: 'workbench:webhook-deliveries-updated',
  EVENT_BUS_UPDATED: 'workbench:event-bus-updated',
  CLIPBOARD_UPDATED: 'clipboard-updated',
  PROVIDER_HEARTBEAT: 'provider-heartbeat',
  COMMAND_PALETTE_TOGGLE: 'workbench:command-palette-toggle',
  COMMAND_OPEN_SESSION: 'workbench:command-open-session',
  COMMAND_OPEN_THOUGHT: 'workbench:command-open-thought',
  COMMAND_OPEN_PROJECT: 'workbench:command-open-project',
} as const;

export function subscribeEvent<T = unknown>(topic: string, handler: Listener<T>): () => void {
  const set = listeners.get(topic) ?? new Set<Listener<unknown>>();
  set.add(handler as Listener<unknown>);
  listeners.set(topic, set);
  return () => {
    set.delete(handler as Listener<unknown>);
    if (set.size === 0) listeners.delete(topic);
  };
}

export function emitEvent<T = unknown>(topic: string, payload?: T): void {
  const set = listeners.get(topic);
  if (!set) return;
  for (const handler of set) handler(payload);
}

export function useEvent<T = unknown>(topic: string, handler: Listener<T>): void {
  useEffect(() => subscribeEvent(topic, handler), [topic, handler]);
}

export function emitBrowserEvent<T = unknown>(name: string, detail?: T): void {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

const BRIDGED_EVENTS = [
  TOPICS.WEBHOOK_DELIVERIES_UPDATED,
  TOPICS.EVENT_BUS_UPDATED,
  TOPICS.CLIPBOARD_UPDATED,
  TOPICS.PROVIDER_HEARTBEAT,
] as const;

let bridgeInstalled = false;

function installWindowBridge() {
  if (bridgeInstalled || typeof window === 'undefined') return;
  bridgeInstalled = true;
  for (const name of BRIDGED_EVENTS) {
    window.addEventListener(name, (event) => {
      emitEvent(name, (event as CustomEvent<unknown>).detail);
    });
  }
}

installWindowBridge();
