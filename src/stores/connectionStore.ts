import { create } from 'zustand';
import { useChatStore } from './chatStore';

export type SignalSource = 'chat' | 'automation' | 'knowledge' | 'vibe' | 'system';
export type SignalLevel = 'urgent' | 'quiet';

export interface ConnectionEvent {
  id: string;
  source: SignalSource;
  level: SignalLevel;
  title: string;
  body: string;
  timestamp: number;
  targetView?: string;
  targetId?: string;
}

interface ConnectionState {
  events: ConnectionEvent[];
  badgeCount: number;

  addEvent: (
    evt: Omit<ConnectionEvent, 'id' | 'timestamp' | 'level'> & { level?: SignalLevel },
  ) => void;
  clearBadge: () => void;
  filteredEvents: (filters: {
    level?: SignalLevel | 'all';
    source?: SignalSource | 'all';
    search?: string;
  }) => ConnectionEvent[];
}

let counter = 0;
function genId() {
  return `conn-${Date.now()}-${++counter}`;
}

const RULES: Record<
  string,
  (evt: { source: SignalSource; title: string; body: string }) => SignalLevel
> = {
  automation: (evt) => {
    const b = evt.body.toLowerCase();
    if (b.includes('error') || b.includes('warning') || b.includes('alert')) return 'urgent';
    return 'quiet';
  },
};

function classify(evt: {
  source: SignalSource;
  level?: SignalLevel;
  title: string;
  body: string;
}): SignalLevel {
  if (evt.level) return evt.level;
  const rule = RULES[evt.source];
  if (rule) return rule(evt);
  return 'quiet';
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  events: [],
  badgeCount: 0,

  addEvent: (evt) => {
    const level = classify(evt);
    const entry: ConnectionEvent = {
      ...evt,
      id: genId(),
      level,
      timestamp: Date.now(),
    };

    set((s) => ({
      events: [entry, ...s.events],
      badgeCount: level === 'urgent' ? s.badgeCount + 1 : s.badgeCount,
    }));

    // Auto-create chat thread for urgent automation events
    if (evt.source === 'automation' && level === 'urgent') {
      const chatState = useChatStore.getState();
      chatState.createThread();
      chatState.sendMessage('[Automation Alert: ' + evt.title + '] ' + evt.body);
    }
  },

  clearBadge: () => set({ badgeCount: 0 }),

  filteredEvents: (filters) => {
    let result = get().events;
    if (filters.level && filters.level !== 'all') {
      result = result.filter((e) => e.level === filters.level);
    }
    if (filters.source && filters.source !== 'all') {
      result = result.filter((e) => e.source === filters.source);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (e) => e.title.toLowerCase().includes(q) || e.body.toLowerCase().includes(q),
      );
    }
    return result;
  },
}));
