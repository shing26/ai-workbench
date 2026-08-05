import { create } from 'zustand';
import { sendChat } from '../lib/backend';

export type ModelRoute = 'cloud' | 'codex' | 'ollama' | 'auto';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ChatThread {
  id: string;
  title: string;
  model: ModelRoute;
  messages: ChatMessage[];
  createdAt: number;
}

interface ChatState {
  threads: ChatThread[];
  activeThreadId: string | null;
  selectedModel: ModelRoute;
  ollamaModel: string;
  budgetUsed: number;
  budgetLimit: number;
  isResponding: boolean;

  createThread: () => string;
  setActiveThread: (id: string) => void;
  sendMessage: (content: string) => void;
  setModel: (model: ModelRoute) => void;
  setOllamaModel: (name: string) => void;
  removeThread: (id: string) => void;
}

let msgCounter = 0;
function genId() {
  return `${Date.now()}-${++msgCounter}`;
}

export const useChatStore = create<ChatState>((set, get) => ({
  threads: [],
  activeThreadId: null,
  selectedModel: 'auto',
  budgetUsed: 1.2,
  budgetLimit: 10,
  isResponding: false,
  ollamaModel: 'qwen2.5:3b',

  createThread: () => {
    const id = genId();
    const thread: ChatThread = {
      id,
      title: '新对话',
      model: get().selectedModel,
      messages: [],
      createdAt: Date.now(),
    };
    set((s) => ({
      threads: [...s.threads, thread],
      activeThreadId: id,
    }));
    return id;
  },

  setActiveThread: (id) => set({ activeThreadId: id }),

  sendMessage: (content) => {
    const { activeThreadId, budgetUsed, budgetLimit, isResponding } = get();
    if (!activeThreadId || !content.trim() || isResponding) return;

    const userMsg: ChatMessage = {
      id: genId(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    set((s) => ({
      threads: s.threads.map((t) =>
        t.id === activeThreadId
          ? {
              ...t,
              title:
                t.messages.length === 0
                  ? content.slice(0, 30) + (content.length > 30 ? '...' : '')
                  : t.title,
              messages: [...t.messages, userMsg],
            }
          : t,
      ),
      budgetUsed: Math.min(budgetUsed + 0.01, budgetLimit),
      isResponding: true,
    }));

    const thread = get().threads.find((t) => t.id === activeThreadId);
    const messages = (thread?.messages ?? [])
      .concat(userMsg)
      .map((m) => ({ role: m.role, content: m.content }));

    sendChat(get().selectedModel, JSON.stringify(messages), get().ollamaModel)
      .then((response) => {
        set((s) => ({
          threads: s.threads.map((t) =>
            t.id === activeThreadId
              ? {
                  ...t,
                  messages: [
                    ...t.messages,
                    { id: genId(), role: 'assistant', content: response, timestamp: Date.now() },
                  ],
                }
              : t,
          ),
          budgetUsed: Math.min(get().budgetUsed + 0.02, get().budgetLimit),
          isResponding: false,
        }));
      })
      .catch((err) => {
        set((s) => ({
          threads: s.threads.map((t) =>
            t.id === activeThreadId
              ? {
                  ...t,
                  messages: [
                    ...t.messages,
                    {
                      id: genId(),
                      role: 'assistant',
                      content: `请求失败: ${err}`,
                      timestamp: Date.now(),
                    },
                  ],
                }
              : t,
          ),
          isResponding: false,
        }));
      });
  },

  setModel: (model) => set({ selectedModel: model }),
  setOllamaModel: (name) => set({ ollamaModel: name }),

  removeThread: (id) =>
    set((s) => {
      const remaining = s.threads.filter((t) => t.id !== id);
      const nextActive = s.activeThreadId === id ? (remaining[0]?.id ?? null) : s.activeThreadId;
      return { threads: remaining, activeThreadId: nextActive };
    }),
}));
