import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  GitCompare,
  GitFork,
  GripVertical,
  History,
  Pencil,
  Pin,
  PinOff,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Sparkles,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import * as db from '../lib/db';
import { buildDailyRecapPrompt } from '../lib/dailyRecap';
import { useWorkbenchStore } from '../stores/workbenchStore';
import type { InspectorSection } from '../stores/workbenchStore';
import ModelBadge from '../components/ui/ModelBadge';

type Message = { role: 'user' | 'assistant'; content: string; id?: string };
type ApiMessage = { role: 'user' | 'assistant' | 'system'; content: string };

function SortablePromptRow({
  prompt,
  onEdit,
  onDelete,
  onMove,
}: {
  prompt: db.CustomQuickPrompt;
  onEdit: (prompt: db.CustomQuickPrompt) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: prompt.id,
  });
  return (
    <div
      ref={setNodeRef}
      data-quick-prompt-custom-row={prompt.id}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.55 : 1,
      }}
      className="flex items-center gap-1.5 rounded-md bg-white/[0.04] px-2 py-1 text-[9px] text-slate-400"
    >
      <button
        type="button"
        data-quick-prompt-custom-drag={prompt.id}
        aria-label={`Drag ${prompt.label}`}
        {...attributes}
        {...listeners}
        className="cursor-grab text-slate-600 hover:text-slate-300"
      >
        <GripVertical size={11} />
      </button>
      <span className="max-w-24 truncate text-slate-300">{prompt.label}</span>
      <span className="rounded bg-white/10 px-1 text-[8px] leading-3 text-slate-500">
        {prompt.category}
      </span>
      <button
        type="button"
        data-quick-prompt-custom-edit={prompt.id}
        aria-label={`Edit ${prompt.label}`}
        onClick={() => onEdit(prompt)}
        className="text-slate-600 hover:text-blue-300"
      >
        <Pencil size={10} />
      </button>
      <button
        type="button"
        data-quick-prompt-custom-move-up={prompt.id}
        aria-label={`Move ${prompt.label} up`}
        onClick={() => onMove(prompt.id, -1)}
        className="text-slate-600 hover:text-emerald-300"
      >
        <ChevronUp size={10} />
      </button>
      <button
        type="button"
        data-quick-prompt-custom-move-down={prompt.id}
        aria-label={`Move ${prompt.label} down`}
        onClick={() => onMove(prompt.id, 1)}
        className="text-slate-600 hover:text-emerald-300"
      >
        <ChevronDown size={10} />
      </button>
      <button
        type="button"
        data-quick-prompt-custom-delete={prompt.id}
        aria-label={`Delete ${prompt.label}`}
        onClick={() => onDelete(prompt.id)}
        className="ml-auto text-slate-600 hover:text-rose-400"
      >
        <Trash2 size={10} />
      </button>
    </div>
  );
}

export default function AIStudioView() {
  const providers = useWorkbenchStore((s) => s.providers);
  const tasks = useWorkbenchStore((s) => s.tasks);
  const habits = useWorkbenchStore((s) => s.habits);
  const scheduleEvents = useWorkbenchStore((s) => s.scheduleEvents);
  const addThought = useWorkbenchStore((s) => s.addThought);
  const openInspector = useWorkbenchStore((s) => s.openInspector);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Ready. Ask anything or switch to MOA for multi-model consensus.',
    },
  ]);
  const [input, setInput] = useState('');
  const [providerId, setProviderId] = useState('');
  const [moa, setMoa] = useState(false);
  const [autoRoute, setAutoRoute] = useState(false);
  const [routedProvider, setRoutedProvider] = useState<{
    name: string;
    fallbackFrom: string | null;
  } | null>(null);
  const [departments, setDepartments] = useState<db.Department[]>([]);
  const [agents, setAgents] = useState<db.Agent[]>([]);
  const [agentId, setAgentId] = useState('');
  const [routedAgent, setRoutedAgent] = useState<db.Agent | null>(null);
  const [teamMode, setTeamMode] = useState(false);
  const [teamDeptId, setTeamDeptId] = useState('');
  const teamRunIdsRef = useRef<string[]>([]);
  const teamPendingRef = useRef(0);
  const teamResultsRef = useRef(new Map<string, string>());
  const [useRag, setUseRag] = useState(true);
  const [ragHits, setRagHits] = useState<db.RagSearchResult[]>([]);
  const [ragConfirmMode, setRagConfirmMode] = useState(false);
  const [pendingSend, setPendingSend] = useState<{
    text: string;
    hits: db.RagSearchResult[];
  } | null>(null);
  const [pendingSelected, setPendingSelected] = useState<Set<string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [streamStatus, setStreamStatus] = useState<
    'idle' | 'connecting' | 'streaming' | 'error' | 'stopped'
  >('idle');
  const [streamError, setStreamError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<db.Session[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionQuery, setSessionQuery] = useState('');
  const [sessionRange, setSessionRange] = useState('all');
  const [sessionFullText, setSessionFullText] = useState(true);
  const [sessionHits, setSessionHits] = useState<db.SessionSearchHit[] | null>(null);
  const [sessionSearchBusy, setSessionSearchBusy] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [exportSession, setExportSession] = useState<db.Session | null>(null);
  const [exportMarkdown, setExportMarkdown] = useState('');
  const [exportCopied, setExportCopied] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const [prompts, setPrompts] = useState<db.QuickPrompt[]>([]);
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});
  const [customPrompts, setCustomPrompts] = useState<db.CustomQuickPrompt[]>([]);
  const [manageOpen, setManageOpen] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [customCategory, setCustomCategory] = useState<'life' | 'work'>('work');
  const [customText, setCustomText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const sortedCustomPrompts = [...customPrompts].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const pendingSelectedCount = pendingSelected?.size ?? 0;
  const [recapReady, setRecapReady] = useState(false);
  const [recapSaving, setRecapSaving] = useState(false);
  const [recapSaveResult, setRecapSaveResult] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState<string | null>(null);
  const [historyVersions, setHistoryVersions] = useState<db.MessageVersion[]>([]);
  const [diffVersionId, setDiffVersionId] = useState<string | null>(null);
  const [versionDiff, setVersionDiff] = useState<db.MessageDiff | null>(null);
  const runIdRef = useRef(0);
  const sessionIdRef = useRef<string | null>(null);
  const runsRef = useRef(new Map<string, { content: string; index: number; label?: string }>());
  const retryTargetRef = useRef<Message | null>(null);
  const activeProvider =
    providers.find((p) => p.id === providerId) ?? providers.find((p) => p.isActive);
  const activeProviders = providers.filter((p) => p.isActive);
  const moaProviders = activeProviders.slice(0, 3);
  const teamAgents = teamMode
    ? agents.filter((a) => a.departmentId === teamDeptId && a.isActive).slice(0, 3)
    : [];
  const selectedDepartment = departments.find((d) => d.id === teamDeptId) ?? null;

  const refreshQuickPrompts = async () => {
    const [loadedPrompts, usage, custom] = await Promise.all([
      db.loadQuickPromptsByUsage(),
      db.getQuickPromptUsage(),
      db.listCustomQuickPrompts(),
    ]);
    setPrompts(loadedPrompts);
    setUsageCounts(usage);
    setCustomPrompts(custom);
  };

  const addCustom = async () => {
    if (!customLabel.trim() || !customText.trim()) return;
    await db.addCustomQuickPrompt(customLabel.trim(), customCategory, customText.trim());
    await refreshQuickPrompts();
    setCustomLabel('');
    setCustomText('');
  };

  const startQuickPromptEdit = (prompt: db.CustomQuickPrompt) => {
    setEditingId(prompt.id);
    setCustomLabel(prompt.label);
    setCustomCategory(prompt.category === 'life' ? 'life' : 'work');
    setCustomText(prompt.text);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setCustomLabel('');
    setCustomCategory('work');
    setCustomText('');
  };

  const saveCustom = async () => {
    if (!editingId || !customLabel.trim() || !customText.trim()) return;
    await db.updateCustomQuickPrompt(
      editingId,
      customLabel.trim(),
      customCategory,
      customText.trim(),
    );
    cancelEdit();
    await refreshQuickPrompts();
  };

  const moveCustom = async (id: string, direction: -1 | 1) => {
    const ordered = sortedCustomPrompts;
    const index = ordered.findIndex((prompt) => prompt.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    const next = [...ordered];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    await db.reorderCustomQuickPrompts(next.map((prompt) => prompt.id));
    await refreshQuickPrompts();
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = sortedCustomPrompts.map((prompt) => prompt.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(ids, oldIndex, newIndex);
    await db.reorderCustomQuickPrompts(reordered);
    await refreshQuickPrompts();
  };

  const removeCustom = async (id: string) => {
    await db.deleteCustomQuickPrompt(id);
    await refreshQuickPrompts();
  };

  const setMode = (mode: 'single' | 'team' | 'moa' | 'auto') => {
    setTeamMode(mode === 'team');
    setMoa(mode === 'moa');
    setAutoRoute(mode === 'auto');
  };

  useEffect(() => {
    let disposed = false;
    void Promise.all([
      db.loadQuickPromptsByUsage(),
      db.getQuickPromptUsage(),
      db.listCustomQuickPrompts(),
    ]).then(([loadedPrompts, usage, custom]) => {
      if (disposed) return;
      setPrompts(loadedPrompts);
      setUsageCounts(usage);
      setCustomPrompts(custom);
    });
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlisten = () => {};
    void db
      .listenStreamChunks((chunk) => {
        if (disposed) return;
        const run = runsRef.current.get(chunk.id);
        if (!run) return;
        if (chunk.done) {
          const teamRun = teamPendingRef.current > 0;
          setMessages((prev) => {
            const next = [...prev];
            const idx = run.index;
            if (idx < next.length && next[idx].role === 'assistant') {
              const partial = next[idx].content.startsWith('__stream__')
                ? next[idx].content.slice('__stream__'.length)
                : run.content;
              next[idx] = {
                ...next[idx],
                content: chunk.error
                  ? `请求失败: ${chunk.error}`
                  : chunk.cancelled && !run.content.endsWith('[stopped]')
                    ? `${partial} [stopped]`
                    : partial,
              };
            }
            return next;
          });
          if (run.label) {
            teamResultsRef.current.set(chunk.id, run.content);
          }
          runsRef.current.delete(chunk.id);
          if (!chunk.error && sessionIdRef.current && run.content) {
            void db
              .saveChatMessage(sessionIdRef.current, 'assistant', run.content)
              .then((saved) => {
                setMessages((prev) => {
                  const next = [...prev];
                  if (run.index < next.length && next[run.index].role === 'assistant') {
                    next[run.index] = { ...next[run.index], id: saved.id };
                  }
                  return next;
                });
              });
          }
          if (teamRun) {
            teamPendingRef.current -= 1;
            if (teamPendingRef.current > 0) {
              setStreamStatus('streaming');
              return;
            }
          }
          if (chunk.error) {
            setStreamStatus('error');
            setStreamError(chunk.error);
          } else if (chunk.cancelled) {
            setStreamStatus('stopped');
            setStreamError(null);
          } else {
            setStreamStatus('idle');
            setStreamError(null);
            retryTargetRef.current = null;
          }
          setBusy(false);
          return;
        }
        setStreamStatus('streaming');
        const delta = run.label && !run.content ? `${run.label}\n\n${chunk.delta}` : chunk.delta;
        run.content += delta;
        setMessages((prev) => {
          const next = [...prev];
          const idx = run.index;
          if (idx < next.length && next[idx].role === 'assistant') {
            const base = next[idx].content.startsWith('__stream__')
              ? next[idx].content.slice('__stream__'.length)
              : run.content;
            next[idx] = { ...next[idx], content: `__stream__${base}${delta}` };
          }
          return next;
        });
      })
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      });
    return () => {
      disposed = true;
      unlisten();
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    void db.listSessions().then(async (list) => {
      if (disposed) return;
      setSessions(list);
      const first = list[0];
      if (first) {
        sessionIdRef.current = first.id;
        setSessionId(first.id);
        const stored = await db.listChatMessages(first.id);
        if (disposed) return;
        if (stored.length > 0) {
          setMessages(
            stored.map((m) => ({
              id: m.id,
              role: m.role as 'user' | 'assistant',
              content: m.content,
            })),
          );
        }
      }
    });
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const q = sessionQuery.trim();
    if (!q) {
      setSessionHits(null);
      setSessionSearchBusy(false);
      return;
    }
    const rangeMs =
      sessionRange === 'today'
        ? 86_400_000
        : sessionRange === '7d'
          ? 7 * 86_400_000
          : sessionRange === '30d'
            ? 30 * 86_400_000
            : 0;
    setSessionSearchBusy(true);
    const timer = window.setTimeout(() => {
      void db
        .searchSessions(q, {
          since: rangeMs ? Date.now() - rangeMs : undefined,
          includeMessages: sessionFullText,
          limit: 50,
        })
        .then((hits) => {
          if (!cancelled) setSessionHits(hits);
        })
        .finally(() => {
          if (!cancelled) setSessionSearchBusy(false);
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [sessionQuery, sessionRange, sessionFullText, sessions]);

  useEffect(() => {
    let disposed = false;
    void Promise.all([db.listDepartments(), db.listAgents()]).then(
      ([departmentList, agentList]) => {
        if (disposed) return;
        setDepartments(departmentList);
        setTeamDeptId((current) => current || departmentList[0]?.id || '');
        const active = agentList.filter((a) => a.isActive);
        setAgents(active);
        const first = active[0];
        if (first) {
          setAgentId(first.id);
          setRoutedAgent(first);
        }
      },
    );
    return () => {
      disposed = true;
    };
  }, []);

  const stopStreaming = async () => {
    const targetRuns =
      teamPendingRef.current > 0 ? [...teamRunIdsRef.current] : [`ai-${runIdRef.current}`];
    runIdRef.current += 1;
    setBusy(false);
    setStreamStatus('stopped');
    setStreamError(null);
    const stoppedByIndex = new Map<number, string>();
    for (const id of targetRuns) {
      const run = runsRef.current.get(id);
      if (run) {
        const content = `${run.content} [stopped]`;
        stoppedByIndex.set(run.index, content);
        run.content = content;
        runsRef.current.delete(id);
      }
      await db.cancelAiStream(id);
    }
    setMessages((prev) => {
      const next = [...prev];
      for (const [index, content] of stoppedByIndex) {
        if (next[index]?.role === 'assistant') next[index] = { ...next[index], content };
      }
      return next;
    });
    if (stoppedByIndex.size === 0) {
      setMessages((prev) =>
        prev.map((m) =>
          m.role === 'assistant' && m.content === '__stream__' ? { ...m, content: '[stopped]' } : m,
        ),
      );
    }
    if (sessionIdRef.current) {
      await Promise.all(
        [...stoppedByIndex.values()].map((content) =>
          db.saveChatMessage(sessionIdRef.current as string, 'assistant', content),
        ),
      );
    }
    teamPendingRef.current = 0;
    teamRunIdsRef.current = [];
  };

  const newChat = () => {
    if (busy) return;
    sessionIdRef.current = null;
    setSessionId(null);
    setMessages([
      {
        role: 'assistant',
        content: 'Ready. Ask anything or switch to MOA for multi-model consensus.',
      },
    ]);
    runsRef.current.clear();
    retryTargetRef.current = null;
    setStreamStatus('idle');
    setStreamError(null);
    setInput('');
    setRagHits([]);
    setPendingSend(null);
    setPendingSelected(null);
    setRecapReady(false);
    setRecapSaveResult(null);
  };

  const selectSession = async (id: string) => {
    if (busy) return;
    sessionIdRef.current = id;
    setSessionId(id);
    const stored = await db.listChatMessages(id);
    const loaded = stored.map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
    setMessages(
      loaded.length > 0
        ? loaded
        : [
            {
              role: 'assistant',
              content: 'Ready. Ask anything or switch to MOA for multi-model consensus.',
            },
          ],
    );
    retryTargetRef.current = null;
    setStreamStatus('idle');
    setStreamError(null);
    setInput('');
    setRagHits([]);
    setPendingSend(null);
    setPendingSelected(null);
  };

  const startRename = (session: db.Session) => {
    setConfirmDeleteId(null);
    setRenamingId(session.id);
    setRenameDraft(session.title);
  };

  const submitRename = async (id: string) => {
    const title = renameDraft.trim();
    if (title) {
      await db.renameSession(id, title);
      setSessions(await db.listSessions());
    }
    setRenamingId(null);
    setRenameDraft('');
  };

  const confirmDelete = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    await db.deleteSession(id);
    const list = await db.listSessions();
    setSessions(list);
    setConfirmDeleteId(null);
    if (sessionIdRef.current === id) {
      sessionIdRef.current = null;
      setSessionId(null);
      const first = list[0];
      if (first) {
        sessionIdRef.current = first.id;
        setSessionId(first.id);
        const stored = await db.listChatMessages(first.id);
        setMessages(
          stored.length > 0
            ? stored.map((m) => ({
                id: m.id,
                role: m.role as 'user' | 'assistant',
                content: m.content,
              }))
            : [
                {
                  role: 'assistant',
                  content: 'Ready. Ask anything or switch to MOA for multi-model consensus.',
                },
              ],
        );
      } else {
        setMessages([
          {
            role: 'assistant',
            content: 'Ready. Ask anything or switch to MOA for multi-model consensus.',
          },
        ]);
      }
    }
  };

  const toggleSessionPin = async (session: db.Session) => {
    await db.setSessionPinned(session.id, !session.pinned);
    setSessions(await db.listSessions());
  };

  const duplicateSessionRow = async (session: db.Session) => {
    const copy = await db.duplicateSession(session.id);
    setSessions(await db.listSessions());
    await selectSession(copy.id);
  };

  const openSessionExport = async (session: db.Session) => {
    const messages = await db.listChatMessages(session.id);
    setExportSession(session);
    setExportMarkdown(db.buildSessionMarkdown(session, messages));
    setExportCopied(false);
  };

  const closeSessionExport = () => {
    setExportSession(null);
    setExportMarkdown('');
    setExportCopied(false);
  };

  const copySessionExport = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(exportMarkdown);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = exportMarkdown;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }
      setExportCopied(true);
    } catch {
      setExportCopied(false);
    }
  };

  const downloadSessionExport = () => {
    if (!exportSession || !exportMarkdown) return;
    const blob = new Blob([exportMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${exportSession.title.replace(/[\\/:*?"<>|]/g, '_')}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const sessionHitBy = new Map((sessionHits ?? []).map((hit) => [hit.session.id, hit]));
  const filteredSessions = sessions
    .filter((s) => {
      const q = sessionQuery.trim().toLowerCase();
      if (!q) return true;
      return `${s.title} ${s.model}`.toLowerCase().includes(q);
    })
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt);
  const visibleSessions = sessionHits ? sessionHits.map((hit) => hit.session) : filteredSessions;

  const ensureSession = async (titleHint: string) => {
    if (sessionIdRef.current) {
      const existing = sessions.find((s) => s.id === sessionIdRef.current);
      if (existing) {
        const stored = await db.listChatMessages(existing.id);
        if (stored.length > 0) return existing;
      }
    }
    const session = await db.createSession(
      titleHint.slice(0, 24) || 'New chat',
      activeProvider?.name ?? 'default',
    );
    sessionIdRef.current = session.id;
    setSessionId(session.id);
    setSessions(await db.listSessions());
    return session;
  };

  const runStream = async (history: Message[], runId: string, hits: db.RagSearchResult[]) => {
    if (!runsRef.current.has(runId)) {
      runsRef.current.set(runId, { content: '', index: history.length });
    }
    const selectedAgent = agentId ? (agents.find((a) => a.id === agentId) ?? null) : null;
    let providerIds: string[];
    let routedName: string | null = null;
    let fallbackFrom: string | null = null;
    if (moa) {
      providerIds = providers
        .filter((p) => p.isActive)
        .slice(0, 3)
        .map((p) => p.id);
    } else if (autoRoute) {
      const routed = await db.routeProvider(providers.filter((p) => p.isActive).map((p) => p.id));
      if (routed.provider) {
        providerIds = [routed.provider.id];
        routedName = routed.provider.name;
        fallbackFrom = routed.fallbackFrom;
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.content === '__stream__'
              ? { ...m, content: '请求失败: no healthy provider available' }
              : m,
          ),
        );
        setBusy(false);
        setStreamStatus('error');
        setStreamError('no healthy provider available');
        setRoutedProvider(null);
        return;
      }
    } else {
      providerIds = selectedAgent?.providerId
        ? [selectedAgent.providerId]
        : activeProvider
          ? [activeProvider.id]
          : [];
    }
    if (selectedAgent) setRoutedAgent(selectedAgent);
    setRoutedProvider(routedName ? { name: routedName, fallbackFrom } : null);
    const apiMessages: ApiMessage[] = history.filter((m) => m.content !== '__stream__');
    if (selectedAgent?.systemPrompt?.trim()) {
      apiMessages.unshift({ role: 'system', content: selectedAgent.systemPrompt.trim() });
    }
    if (hits.length > 0) {
      apiMessages.unshift({
        role: 'system',
        content: `Knowledge context:\n${hits.map((h) => `- ${h.content}`).join('\n')}`,
      });
    }
    try {
      await db.sendAiMessageStream({
        providerIds,
        messages: apiMessages,
        moa,
        runId,
      });
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.content === '__stream__' ? { ...m, content: '请求失败: stream unavailable' } : m,
        ),
      );
      setBusy(false);
      setStreamStatus('error');
      setStreamError('stream unavailable');
    }
    const sections: InspectorSection[] = [];
    if (selectedAgent) {
      sections.push(
        { label: 'Department', value: selectedAgent.departmentName },
        { label: 'Agent', value: selectedAgent.name },
        { label: 'Role', value: selectedAgent.role },
        { label: 'Model', value: selectedAgent.model },
      );
    }
    if (moa) {
      sections.push(
        { label: 'Providers', value: providerIds.length ? providerIds.join(', ') : 'none' },
        { label: 'Status', value: 'streaming consensus' },
      );
    } else if (routedName) {
      sections.push({ label: 'Router', value: `auto → ${routedName}` });
      sections.push({ label: 'Fallback from', value: fallbackFrom || 'none' });
    }
    if (hits.length > 0) {
      sections.push({ label: 'RAG context', value: `${hits.length} local thought(s) injected` });
      hits.slice(0, 5).forEach((hit, index) => {
        sections.push({
          label: `Source ${index + 1}`,
          value: hit.content.replace(/\s+/g, ' ').slice(0, 90),
        });
      });
    }
    if (sections.length > 0) {
      openInspector(
        selectedAgent
          ? hits.length > 0
            ? 'Agent Trace + RAG'
            : 'Agent Trace'
          : moa && hits.length > 0
            ? 'MOA Trace + RAG'
            : hits.length > 0
              ? 'RAG Context'
              : 'MOA Trace',
        sections,
      );
    }
  };

  const sendTeam = async (text: string, hits: db.RagSearchResult[]) => {
    const selectedAgents = agents
      .filter((a) => a.departmentId === teamDeptId && a.isActive)
      .slice(0, 3);
    if (selectedAgents.length === 0) {
      setBusy(false);
      setStreamStatus('error');
      setStreamError('no active agents in selected department');
      return;
    }
    const runId = `ai-${++runIdRef.current}`;
    const messageId =
      crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const userMessage: Message = { id: messageId, role: 'user', content: text };
    const placeholders: Message[] = selectedAgents.map(() => ({
      role: 'assistant',
      content: '__stream__',
    }));
    const next: Message[] = [...messages, userMessage, ...placeholders];
    setMessages(next);
    retryTargetRef.current = userMessage;
    setStreamStatus('connecting');
    setStreamError(null);
    setInput('');
    const session = await ensureSession(text);
    await db.saveChatMessage(session.id, 'user', text, messageId);
    const history: Message[] = next.slice(0, next.length - selectedAgents.length);
    const providerBase = activeProvider?.id ?? '';
    teamPendingRef.current = selectedAgents.length;
    teamRunIdsRef.current = [];
    const agentRuns = selectedAgents.map((agent, index) => {
      const subRunId = `${runId}-${index}`;
      teamRunIdsRef.current.push(subRunId);
      const providerIds = agent.providerId
        ? [agent.providerId]
        : providerBase
          ? [providerBase]
          : [];
      const apiMessages: ApiMessage[] = history.filter((m) => m.content !== '__stream__');
      if (agent.systemPrompt?.trim()) {
        apiMessages.unshift({ role: 'system', content: agent.systemPrompt.trim() });
      }
      if (hits.length > 0) {
        apiMessages.unshift({
          role: 'system',
          content: `Knowledge context:\n${hits.map((h) => `- ${h.content}`).join('\n')}`,
        });
      }
      runsRef.current.set(subRunId, {
        content: '',
        index: history.length + index,
        label: `${agent.name} · ${agent.role}`,
      });
      return db.sendAiMessageStream({
        providerIds,
        messages: apiMessages,
        moa: false,
        runId: subRunId,
      });
    });
    await Promise.all(agentRuns.map((promise) => promise.catch(() => {})));
    const teamOutputs = teamRunIdsRef.current.map((id) => teamResultsRef.current.get(id) ?? '');
    const summaryText = await db.buildTeamSummary(teamOutputs);
    const sections: InspectorSection[] = [
      { label: 'Department', value: selectedDepartment?.name ?? '' },
      { label: 'Agents', value: selectedAgents.map((a) => a.name).join(', ') },
      { label: 'Role', value: selectedAgents.map((a) => a.role).join(' / ') },
      { label: 'Model', value: selectedAgents.map((a) => a.model).join(', ') },
      { label: 'Status', value: 'parallel streaming' },
    ];
    if (summaryText.trim()) {
      const summaryContent = `Team Summary\n${summaryText}`;
      setMessages((prev) => [...prev, { role: 'assistant', content: summaryContent }]);
      if (session) {
        await db.saveChatMessage(session.id, 'assistant', summaryContent);
      }
      sections.push({ label: 'Summary', value: summaryText.replace(/\s+/g, ' ').slice(0, 140) });
    }
    if (hits.length > 0) {
      sections.push({ label: 'RAG context', value: `${hits.length} local thought(s) injected` });
      hits.slice(0, 5).forEach((hit, index) => {
        sections.push({
          label: `Source ${index + 1}`,
          value: hit.content.replace(/\s+/g, ' ').slice(0, 90),
        });
      });
    }
    const traceTitle = [
      'Team Trace',
      summaryText.trim() ? 'Summary' : '',
      hits.length > 0 ? 'RAG' : '',
    ]
      .filter(Boolean)
      .join(' + ');
    openInspector(traceTitle, sections);
  };

  const dispatchSend = async (text: string, hits: db.RagSearchResult[]) => {
    setBusy(true);
    if (teamMode) {
      await sendTeam(text, hits);
      return;
    }
    const runId = `ai-${++runIdRef.current}`;
    const messageId =
      crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const userMessage: Message = { id: messageId, role: 'user', content: text };
    const next: Message[] = [
      ...messages,
      userMessage,
      { role: 'assistant', content: '__stream__' },
    ];
    setMessages(next);
    retryTargetRef.current = userMessage;
    setStreamStatus('connecting');
    setStreamError(null);
    setInput('');
    const session = await ensureSession(text);
    await db.saveChatMessage(session.id, 'user', text, messageId);
    const history: Message[] = next.slice(0, next.length - 1);
    await runStream(history, runId, hits);
  };

  const sendText = async (text: string) => {
    if (!text.trim() || busy) return;
    setRecapReady(false);
    setRecapSaveResult(null);
    let hits: db.RagSearchResult[] = [];
    if (useRag) {
      try {
        hits = await db.searchThoughts(text, 5);
      } catch {
        hits = [];
      }
    }
    setRagHits(hits);
    if (useRag && ragConfirmMode && hits.length > 0) {
      setPendingSend({ text, hits });
      setPendingSelected(new Set(hits.map((hit) => hit.id)));
      return;
    }
    await dispatchSend(text, hits);
  };

  const toggleRagHit = (id: string) => {
    setPendingSelected((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confirmRagSend = async () => {
    if (!pendingSend || !pendingSelected) return;
    const { text, hits } = pendingSend;
    const selected = hits.filter((hit) => pendingSelected.has(hit.id));
    setPendingSend(null);
    setPendingSelected(null);
    setRagHits(selected);
    await dispatchSend(text, selected);
  };

  const cancelRagSend = () => {
    setPendingSend(null);
    setPendingSelected(null);
    setRagHits([]);
  };

  const send = async () => {
    await sendText(input.trim());
  };

  const runDailyRecap = async () => {
    if (busy) return;
    await sendText(buildDailyRecapPrompt(tasks, habits, scheduleEvents));
    setRecapReady(true);
  };

  const saveRecapNote = async () => {
    if (!recapReady || recapSaving) return;
    const reply = [...messages]
      .reverse()
      .find(
        (m) =>
          m.role === 'assistant' &&
          m.content &&
          !m.content.startsWith('__stream__') &&
          !m.content.includes('Ready. Ask anything'),
      )?.content;
    if (!reply) return;
    setRecapSaving(true);
    setRecapSaveResult(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await addThought(`# 今日复盘 ${today}\n\n${reply}`, '#daily,#recap', 'note');
      setRecapSaveResult(`Saved recap note (${today})`);
    } catch (error) {
      setRecapSaveResult(error instanceof Error ? error.message : String(error));
    } finally {
      setRecapSaving(false);
    }
  };

  const startEdit = (message: Message) => {
    if (busy || !message.id) return;
    setEditingMessageId(message.id);
    setEditDraft(message.content);
  };

  const saveEdit = async (message: Message) => {
    const content = editDraft.trim();
    if (!message.id || !content || busy) {
      setEditingMessageId(null);
      return;
    }
    await db.updateChatMessage(message.id, content);
    setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, content } : m)));
    setEditingMessageId(null);
    setEditDraft('');
    if (historyOpen === message.id) {
      setHistoryVersions(await db.listMessageVersions(message.id));
    }
  };

  const regenerateMessage = async (message: Message) => {
    if (busy || !message.id || !sessionIdRef.current) return;
    setBusy(true);
    setStreamStatus('connecting');
    setStreamError(null);
    retryTargetRef.current = message;
    setEditingMessageId(null);
    const removedMessages = messages
      .slice(messages.findIndex((m) => m.id === message.id) + 1)
      .filter((m) => m.id && m.content !== '__stream__' && m.content.trim());
    await Promise.all(removedMessages.map((m) => db.saveMessageVersion(m.id as string, m.content)));
    await db.truncateChatMessages(sessionIdRef.current, message.id);
    const truncated = messages
      .map((m) => (m.id === message.id ? { ...m, content: editDraft.trim() || m.content } : m))
      .slice(0, messages.findIndex((m) => m.id === message.id) + 1);
    const history: Message[] = [...truncated, { role: 'assistant', content: '__stream__' }];
    let hits: db.RagSearchResult[] = [];
    if (useRag) {
      try {
        hits = await db.searchThoughts(truncated[truncated.length - 1]?.content ?? '', 5);
      } catch {
        hits = [];
      }
    }
    setRagHits(hits);
    const runId = `ai-${++runIdRef.current}`;
    runsRef.current.set(runId, { content: '', index: history.length - 1 });
    setMessages(history);
    await runStream(history, runId, hits);
  };

  const retryLast = () => {
    const target = retryTargetRef.current;
    if (target) void regenerateMessage(target);
  };

  const toggleHistory = async (message: Message) => {
    if (historyOpen === message.id) {
      setHistoryOpen(null);
      setHistoryVersions([]);
      setDiffVersionId(null);
      setVersionDiff(null);
      return;
    }
    setHistoryOpen(message.id ?? null);
    setHistoryVersions(await db.listMessageVersions(message.id ?? ''));
    setDiffVersionId(null);
    setVersionDiff(null);
  };

  const toggleVersionDiff = async (message: Message, version: db.MessageVersion) => {
    if (!message.id) return;
    if (diffVersionId === version.id) {
      setDiffVersionId(null);
      setVersionDiff(null);
      return;
    }
    setDiffVersionId(version.id);
    setVersionDiff(await db.diffMessageVersionWithCurrent(message.id, version.id));
  };

  const restoreVersion = async (message: Message, version: db.MessageVersion) => {
    const restored = await db.restoreMessageVersion(message.id ?? '', version.id);
    setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, content: restored } : m)));
    if (historyOpen === message.id) {
      setHistoryVersions(await db.listMessageVersions(message.id ?? ''));
    }
  };

  return (
    <div className="view-enter flex h-full flex-col gap-4 p-4">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {autoRoute && routedProvider ? (
            <ModelBadge
              label={`auto → ${routedProvider.name}`}
              tone="green"
              status={routedProvider.fallbackFrom ? 'fallback' : 'active'}
            />
          ) : teamMode ? (
            <ModelBadge
              label={selectedDepartment?.name ?? 'Team'}
              tone="blue"
              status={`${teamAgents.length} agents`}
            />
          ) : moa ? (
            <div className="moa-stack provider-stack">
              {moaProviders.map((p) => (
                <ModelBadge key={p.id} label={p.name} tone="blue" status="active" />
              ))}
            </div>
          ) : routedAgent ? (
            <ModelBadge label={routedAgent.name} tone="blue" status={routedAgent.departmentName} />
          ) : (
            <ModelBadge label={activeProvider?.name ?? 'No provider'} tone="green" />
          )}
          {teamMode && <ModelBadge label="Team" tone="blue" status="parallel" />}
          {moa && <ModelBadge label="MOA" tone="blue" status="3-way" />}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] p-0.5">
            <button
              type="button"
              onClick={() => setMode('single')}
              className={`rounded-[10px] px-3 py-1.5 text-[11px] ${!moa && !autoRoute && !teamMode ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Single
            </button>
            <button
              type="button"
              onClick={() => setMode('team')}
              className={`rounded-[10px] px-3 py-1.5 text-[11px] ${teamMode ? 'bg-violet-500/20 text-violet-300' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Team
            </button>
            <button
              type="button"
              onClick={() => setMode('moa')}
              className={`rounded-[10px] px-3 py-1.5 text-[11px] ${moa ? 'accent-bg-20 accent-text-strong' : 'text-slate-500 hover:text-slate-300'}`}
            >
              MOA
            </button>
            <button
              type="button"
              onClick={() => setMode('auto')}
              className={`rounded-[10px] px-3 py-1.5 text-[11px] ${autoRoute ? 'bg-amber-500/20 text-amber-300' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Auto
            </button>
          </div>
          {teamMode ? (
            <select
              value={teamDeptId}
              onChange={(e) => setTeamDeptId(e.target.value)}
              aria-label="Dispatch department"
              className="h-8 max-w-52 rounded-xl border border-violet-500/25 bg-[#18181C] px-2 text-[11px] text-slate-300 outline-none"
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} · {agents.filter((a) => a.departmentId === d.id).length}
                </option>
              ))}
            </select>
          ) : (
            <>
              <select
                value={agentId}
                onChange={(e) => {
                  setAgentId(e.target.value);
                  setRoutedAgent(agents.find((a) => a.id === e.target.value) ?? null);
                }}
                aria-label="Dispatch agent"
                className="h-8 max-w-48 rounded-xl border border-white/10 bg-[#18181C] px-2 text-[11px] text-slate-300 outline-none"
              >
                <option value="">Default agent</option>
                {departments.map((d) => (
                  <optgroup key={d.id} label={d.name}>
                    {agents
                      .filter((a) => a.departmentId === d.id)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
              <select
                value={providerId}
                onChange={(e) => setProviderId(e.target.value)}
                className="h-8 rounded-xl border border-white/10 bg-[#18181C] px-2 text-[11px] text-slate-300 outline-none"
              >
                <option value="">Default active provider</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </>
          )}
          <button
            type="button"
            role="switch"
            aria-checked={useRag}
            aria-label="Toggle RAG context"
            onClick={() => {
              setUseRag((value) => !value);
              if (useRag) setRagHits([]);
            }}
            className={`flex h-8 shrink-0 items-center gap-1.5 rounded-xl border px-2.5 text-[11px] transition-colors ${
              useRag
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                : 'border-white/10 bg-white/[0.03] text-slate-500 hover:text-slate-300'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${useRag ? 'bg-amber-400' : 'bg-slate-600'}`}
            />
            RAG
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={ragConfirmMode}
            aria-label="Confirm RAG hits before send"
            data-rag-confirm-mode
            onClick={() => setRagConfirmMode((value) => !value)}
            className={`flex h-8 shrink-0 items-center gap-1.5 rounded-xl border px-2.5 text-[11px] transition-colors ${
              ragConfirmMode
                ? 'border-violet-500/30 bg-violet-500/10 text-violet-300'
                : 'border-white/10 bg-white/[0.03] text-slate-500 hover:text-slate-300'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${ragConfirmMode ? 'bg-violet-400' : 'bg-slate-600'}`}
            />
            Confirm hits
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-3">
        <aside className="hidden w-44 shrink-0 flex-col gap-2 rounded-2xl border border-white/10 bg-[#18181C] p-2 md:flex">
          <button
            type="button"
            onClick={newChat}
            className="flex h-9 shrink-0 items-center justify-center gap-1 rounded-xl bg-emerald-500/20 text-[11px] text-emerald-400 hover:bg-emerald-500/30"
          >
            <Plus size={13} /> New chat
          </button>
          <label className="flex h-8 shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-2 focus-within:border-emerald-500/40">
            <Search size={12} className="shrink-0 text-slate-600" />
            <input
              value={sessionQuery}
              onChange={(e) => setSessionQuery(e.target.value)}
              placeholder="Search sessions..."
              data-session-search-input
              className="min-w-0 flex-1 bg-transparent text-[11px] text-slate-300 outline-none placeholder:text-slate-600"
            />
          </label>
          <div className="flex h-6 shrink-0 items-center gap-1">
            <select
              value={sessionRange}
              onChange={(e) => setSessionRange(e.target.value)}
              aria-label="Session time range"
              data-session-range
              className="h-6 min-w-0 flex-1 rounded-lg border border-white/10 bg-[#18181C] px-1 text-[9px] text-slate-400 outline-none"
            >
              <option value="all">Any time</option>
              <option value="today">Today</option>
              <option value="7d">7 days</option>
              <option value="30d">30 days</option>
            </select>
            <label
              title="Include message text"
              className="flex h-6 shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-1.5"
            >
              <input
                type="checkbox"
                checked={sessionFullText}
                onChange={(e) => setSessionFullText(e.target.checked)}
                aria-label="Search message text"
                data-session-fulltext
                className="h-2.5 w-2.5 accent-emerald-500"
              />
              <span className="text-[8px] text-slate-500">Msg</span>
            </label>
          </div>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {visibleSessions.map((s) =>
              renamingId === s.id ? (
                <div
                  key={s.id}
                  className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-1"
                >
                  <input
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void submitRename(s.id);
                      if (e.key === 'Escape') {
                        setRenamingId(null);
                        setRenameDraft('');
                      }
                    }}
                    autoFocus
                    aria-label="Rename session input"
                    className="min-w-0 flex-1 bg-transparent px-1 text-[11px] text-slate-200 outline-none"
                  />
                  <button
                    type="button"
                    aria-label="Save session rename"
                    onClick={() => void submitRename(s.id)}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-500/20 text-emerald-400"
                  >
                    <Check size={11} />
                  </button>
                  <button
                    type="button"
                    aria-label="Cancel session rename"
                    onClick={() => {
                      setRenamingId(null);
                      setRenameDraft('');
                    }}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/5 text-slate-500"
                  >
                    <X size={11} />
                  </button>
                </div>
              ) : (
                <div key={s.id} className="group relative rounded-lg">
                  <button
                    type="button"
                    aria-label={s.pinned ? 'Unpin session' : 'Pin session'}
                    data-session-pin={s.id}
                    data-session-pinned={s.pinned ? 'true' : 'false'}
                    onClick={() => void toggleSessionPin(s)}
                    className={`absolute left-1 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md transition-colors ${
                      s.pinned
                        ? 'text-amber-300 hover:text-amber-200'
                        : 'text-slate-600 hover:text-amber-300'
                    }`}
                  >
                    {s.pinned ? <Pin size={10} /> : <PinOff size={10} />}
                  </button>
                  <button
                    type="button"
                    aria-label="Open session"
                    onClick={() => void selectSession(s.id)}
                    className={`w-full rounded-lg border py-1.5 pl-7 pr-16 text-left ${
                      sessionId === s.id
                        ? 'border-emerald-500/30 bg-emerald-500/10'
                        : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                    }`}
                    data-session-count={s.messageCount}
                  >
                    <span className="block truncate text-[11px] text-slate-300">{s.title}</span>
                    {sessionHitBy.get(s.id) ? (
                      <span
                        data-session-snippet={s.id}
                        data-session-match-type={sessionHitBy.get(s.id)?.matchType ?? ''}
                        className="mt-0.5 block truncate text-[9px] text-cyan-300/80"
                      >
                        {sessionHitBy.get(s.id)?.snippet ?? ''}
                      </span>
                    ) : null}
                    <span
                      className={`${
                        sessionHitBy.get(s.id) ? 'hidden' : ''
                      } mt-0.5 block truncate text-[9px] text-slate-600`}
                    >
                      {s.model} · {s.messageCount} msg(s)
                    </span>
                  </button>
                  {confirmDeleteId === s.id ? (
                    <button
                      type="button"
                      aria-label="Confirm delete session"
                      onClick={() => void confirmDelete(s.id)}
                      className="absolute right-1.5 top-1/2 flex h-5 -translate-y-1/2 items-center gap-1 rounded-md bg-rose-500/25 px-1.5 text-[9px] text-rose-300"
                    >
                      <Trash2 size={10} /> Sure?
                    </button>
                  ) : (
                    <div className="absolute right-1.5 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 group-hover:flex">
                      <button
                        type="button"
                        aria-label="Duplicate session"
                        data-session-duplicate={s.id}
                        onClick={() => void duplicateSessionRow(s)}
                        className="flex h-5 w-5 items-center justify-center rounded-md bg-white/5 text-slate-400 hover:text-blue-300"
                      >
                        <Copy size={10} />
                      </button>
                      <button
                        type="button"
                        aria-label="Export session"
                        data-session-export={s.id}
                        onClick={() => void openSessionExport(s)}
                        className="flex h-5 w-5 items-center justify-center rounded-md bg-white/5 text-slate-400 hover:text-emerald-300"
                      >
                        <Download size={10} />
                      </button>
                      <button
                        type="button"
                        aria-label="Rename session"
                        onClick={() => startRename(s)}
                        className="flex h-5 w-5 items-center justify-center rounded-md bg-white/5 text-slate-400 hover:text-emerald-300"
                      >
                        <Pencil size={10} />
                      </button>
                      <button
                        type="button"
                        aria-label="Delete session"
                        onClick={() => void confirmDelete(s.id)}
                        className="flex h-5 w-5 items-center justify-center rounded-md bg-white/5 text-slate-400 hover:text-rose-300"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  )}
                </div>
              ),
            )}
            {visibleSessions.length === 0 && (
              <div className="py-6 text-center text-[10px] text-slate-600">
                {sessionQuery.trim()
                  ? sessionSearchBusy
                    ? 'Searching...'
                    : 'No matching sessions'
                  : 'No sessions'}
              </div>
            )}
          </div>
        </aside>
        <div
          data-streaming={busy ? 'true' : 'false'}
          className="conversation-stage flex min-h-0 flex-1 flex-col gap-3 rounded-2xl border border-white/10 bg-[#18181C] p-4 shadow-xl"
        >
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`group relative ${m.role === 'user' ? 'self-end' : 'self-start'}`}
              >
                <div
                  className={`message-in max-w-[78%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-emerald-500/15 text-emerald-100'
                      : m.content.startsWith('Team Summary')
                        ? 'team-summary border border-violet-500/25 bg-violet-500/[0.08] text-violet-100'
                        : 'border border-white/10 bg-white/[0.04] text-slate-300'
                  }`}
                >
                  {m.content === '__stream__' ? '' : m.content}
                  {m.content === '__stream__' && busy && <span className="stream-caret" />}
                </div>
                {m.role === 'user' && m.id && editingMessageId === m.id ? (
                  <div className="mt-1 flex items-start gap-1.5">
                    <textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void saveEdit(m);
                        if (e.key === 'Escape') setEditingMessageId(null);
                      }}
                      rows={2}
                      aria-label="Edit message input"
                      className="min-h-0 flex-1 resize-none rounded-lg border border-emerald-500/30 bg-white/[0.04] px-2 py-1.5 text-[11px] text-slate-200 outline-none"
                    />
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        aria-label="Save message edit"
                        onClick={() => void saveEdit(m)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400"
                      >
                        <Check size={12} />
                      </button>
                      <button
                        type="button"
                        aria-label="Cancel message edit"
                        onClick={() => setEditingMessageId(null)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-slate-500"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                ) : m.id && m.content !== '__stream__' ? (
                  <div className="absolute -right-9 top-1 hidden items-center gap-0.5 group-hover:flex">
                    <button
                      type="button"
                      aria-label="Regenerate message"
                      onClick={() => void regenerateMessage(m)}
                      className="flex h-6 w-6 items-center justify-center rounded-md bg-white/5 text-slate-500 hover:text-amber-300"
                    >
                      <RefreshCw size={11} />
                    </button>
                    <button
                      type="button"
                      aria-label="Open message history"
                      onClick={() => void toggleHistory(m)}
                      className="flex h-6 w-6 items-center justify-center rounded-md bg-white/5 text-slate-500 accent-hover-text"
                    >
                      <History size={11} />
                    </button>
                    {m.role === 'user' && (
                      <button
                        type="button"
                        aria-label="Edit message"
                        onClick={() => startEdit(m)}
                        className="flex h-6 w-6 items-center justify-center rounded-md bg-white/5 text-slate-500 hover:text-emerald-300"
                      >
                        <Pencil size={11} />
                      </button>
                    )}
                  </div>
                ) : null}
                {historyOpen === m.id && (
                  <div className="version-panel mt-1 w-[min(480px,90vw)] rounded-xl border border-white/10 bg-[#18181C] p-2 shadow-xl">
                    {historyVersions.length === 0 ? (
                      <div className="px-2 py-3 text-center text-[10px] text-slate-600">
                        No versions yet
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="px-1 text-[9px] uppercase tracking-wide text-slate-500">
                          Version history
                        </div>
                        <div className="version-graph rounded-lg border border-white/10 bg-black/20 p-2">
                          <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wide text-slate-500">
                            <GitFork size={10} className="text-slate-400" />
                            Version graph
                          </div>
                          <div className="mt-1.5 space-y-0">
                            {historyVersions.map((v, i) => (
                              <div key={v.id} className="flex items-stretch gap-2">
                                <div className="flex w-4 shrink-0 flex-col items-center">
                                  <button
                                    type="button"
                                    aria-label={`Graph node version ${i + 1}`}
                                    onClick={() => void toggleVersionDiff(m, v)}
                                    className={`version-node h-2.5 w-2.5 shrink-0 rounded-full transition-colors ${
                                      diffVersionId === v.id
                                        ? 'bg-amber-400 ring-2 ring-amber-400/30'
                                        : 'accent-bg'
                                    }`}
                                  />
                                  {i < historyVersions.length - 1 && (
                                    <span className="w-px flex-1 bg-white/10" />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1 pb-1.5">
                                  <div className="text-[9px] text-slate-500">
                                    v{i + 1}
                                    {v.parentVersionId
                                      ? ` · child of v${historyVersions.findIndex((p) => p.id === v.parentVersionId) + 1}`
                                      : ' · root'}
                                  </div>
                                </div>
                              </div>
                            ))}
                            <div className="flex items-stretch gap-2">
                              <div className="flex w-4 shrink-0 flex-col items-center">
                                <span className="version-node h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400 ring-2 ring-emerald-400/30" />
                              </div>
                              <div className="min-w-0 flex-1 pb-0.5">
                                <div className="text-[9px] text-emerald-400">current</div>
                              </div>
                            </div>
                          </div>
                        </div>
                        {historyVersions.map((v, i) => (
                          <div
                            key={v.id}
                            className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-[9px] text-slate-600">
                                v{i + 1} ·{' '}
                                {new Date(v.createdAt).toLocaleTimeString('zh-CN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                              <p className="max-h-10 overflow-hidden whitespace-pre-wrap break-words text-[10px] leading-relaxed text-slate-300">
                                {v.content}
                              </p>
                            </div>
                            <button
                              type="button"
                              aria-label={`Restore version ${i + 1}`}
                              onClick={() => void restoreVersion(m, v)}
                              className="shrink-0 rounded-md accent-bg-15 px-1.5 py-1 text-[9px] accent-text-strong accent-hover-bg-25"
                            >
                              Restore
                            </button>
                            <button
                              type="button"
                              aria-label={`Compare version ${i + 1} with current`}
                              onClick={() => void toggleVersionDiff(m, v)}
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors ${
                                diffVersionId === v.id
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-white/5 text-slate-400 hover:text-amber-300'
                              }`}
                            >
                              <GitCompare size={10} />
                            </button>
                          </div>
                        ))}
                        {diffVersionId && versionDiff && (
                          <div className="version-diff rounded-lg border border-white/10 bg-black/20 p-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-[9px] uppercase tracking-wide text-slate-500">
                                Diff · v
                                {historyVersions.findIndex((v) => v.id === diffVersionId) + 1} →
                                current
                              </div>
                              <div className="text-[9px] text-slate-500">
                                <span className="text-emerald-400">
                                  +{versionDiff.added.length}
                                </span>{' '}
                                <span className="text-rose-400">-{versionDiff.removed.length}</span>
                              </div>
                            </div>
                            <div className="mt-1.5 max-h-28 space-y-0.5 overflow-y-auto">
                              {versionDiff.removed.map((line, idx) => (
                                <div
                                  key={`r-${idx}`}
                                  className="flex items-start gap-1 rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] leading-relaxed text-rose-300"
                                >
                                  <span className="shrink-0 select-none text-rose-500">-</span>
                                  <span className="min-w-0 whitespace-pre-wrap break-words">
                                    {line}
                                  </span>
                                </div>
                              ))}
                              {versionDiff.added.map((line, idx) => (
                                <div
                                  key={`a-${idx}`}
                                  className="flex items-start gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] leading-relaxed text-emerald-300"
                                >
                                  <span className="shrink-0 select-none text-emerald-500">+</span>
                                  <span className="min-w-0 whitespace-pre-wrap break-words">
                                    {line}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          {(busy || streamStatus === 'error' || streamStatus === 'stopped') && (
            <div className="stream-status flex shrink-0 items-center gap-2 px-1 pb-2">
              {busy ? (
                <span className="flex items-center gap-1.5">
                  <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span
                    className="thinking-dot h-1.5 w-1.5 rounded-full bg-emerald-400"
                    style={{ animationDelay: '150ms' }}
                  />
                  <span
                    className="thinking-dot h-1.5 w-1.5 rounded-full bg-emerald-400"
                    style={{ animationDelay: '300ms' }}
                  />
                  <span className="text-[10px] text-slate-500">
                    {streamStatus === 'connecting' ? 'Connecting' : 'Streaming'}
                  </span>
                </span>
              ) : streamStatus === 'error' ? (
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate rounded-md border border-rose-500/25 bg-rose-500/10 px-1.5 py-0.5 text-[10px] text-rose-300">
                    Failed: {streamError}
                  </span>
                  <button
                    type="button"
                    aria-label="Retry failed message"
                    onClick={retryLast}
                    className="flex h-6 shrink-0 items-center gap-1 rounded-md bg-amber-500/15 px-2 text-[10px] text-amber-300 transition-colors hover:bg-amber-500/25"
                  >
                    <RefreshCw size={10} /> Retry
                  </button>
                </span>
              ) : (
                <span className="text-[10px] text-slate-500">Stopped</span>
              )}
            </div>
          )}
          {ragHits.length > 0 && (
            <div className="rag-badge flex shrink-0 flex-wrap items-center gap-1.5 px-1 pb-1 text-[10px]">
              <span className="rounded-md border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 font-medium text-amber-300">
                RAG +{ragHits.length}
              </span>
              {ragHits.slice(0, 3).map((hit) => (
                <span
                  key={hit.id}
                  className="max-w-[260px] truncate rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-slate-500"
                >
                  {hit.content.replace(/\s+/g, ' ').slice(0, 44)}
                </span>
              ))}
            </div>
          )}
          {pendingSend && (
            <div
              data-rag-confirm-panel
              className="mb-2 rounded-xl border border-violet-500/25 bg-violet-500/5 px-2 py-2"
            >
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-[10px] font-medium text-violet-300">Confirm RAG hits</span>
                <span className="ml-auto rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[9px] text-violet-300">
                  {pendingSelectedCount}/{pendingSend.hits.length} selected
                </span>
              </div>
              <div className="space-y-1">
                {pendingSend.hits.map((hit) => (
                  <label
                    key={hit.id}
                    className="flex items-start gap-2 rounded-lg bg-white/[0.03] px-2 py-1.5"
                  >
                    <input
                      type="checkbox"
                      data-rag-confirm-hit={hit.id}
                      checked={pendingSelected?.has(hit.id) ?? false}
                      onChange={() => toggleRagHit(hit.id)}
                      className="mt-0.5 h-3 w-3 accent-violet-400"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[10px] text-slate-300">
                        {hit.content.replace(/\s+/g, ' ').slice(0, 72)}
                      </span>
                      <span className="text-[9px] text-slate-600">
                        score {hit.score.toFixed(2)}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  data-rag-confirm-send
                  disabled={pendingSelectedCount === 0}
                  onClick={() => void confirmRagSend()}
                  className="flex h-7 items-center rounded-md bg-violet-500/15 px-2 text-[10px] text-violet-300 hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Send with {pendingSelectedCount}
                </button>
                <button
                  type="button"
                  data-rag-confirm-cancel
                  onClick={cancelRagSend}
                  className="flex h-7 items-center rounded-md bg-white/5 px-2 text-[10px] text-slate-400 hover:bg-white/10"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          <div data-quick-prompts className="flex flex-wrap items-center gap-1.5 px-1 pb-2">
            {prompts.map((prompt) => (
              <button
                key={prompt.id}
                type="button"
                data-quick-prompt={prompt.id}
                data-quick-prompt-label={prompt.label}
                data-quick-prompt-category={prompt.category}
                data-quick-prompt-usage={usageCounts[prompt.id] ?? 0}
                onClick={() => {
                  void (async () => {
                    await db.recordQuickPromptUsage(prompt.id);
                    setInput(prompt.text);
                    composerRef.current?.focus();
                    await refreshQuickPrompts();
                  })();
                }}
                className="flex h-6 items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 text-[9px] text-slate-400 transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-300"
              >
                <Sparkles size={10} className="shrink-0" />
                {prompt.label}
                {(usageCounts[prompt.id] ?? 0) > 0 && (
                  <span className="rounded bg-white/10 px-1 text-[8px] leading-3 text-slate-500">
                    {usageCounts[prompt.id]}
                  </span>
                )}
              </button>
            ))}
            <button
              type="button"
              data-ai-daily-recap
              onClick={runDailyRecap}
              className="flex h-6 items-center gap-1 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 text-[9px] text-emerald-300 transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/20 hover:text-emerald-200"
            >
              <CalendarDays size={10} />
              今日复盘
            </button>
            <button
              type="button"
              data-ai-recap-save
              onClick={() => void saveRecapNote()}
              disabled={!recapReady || recapSaving}
              className="flex h-6 items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 text-[9px] text-slate-500 transition-colors hover:border-blue-500/30 hover:bg-blue-500/10 hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Save size={10} />
              {recapSaving ? 'Saving' : '保存复盘'}
            </button>
            {recapSaveResult && (
              <span
                data-ai-recap-save-result
                className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-slate-400"
              >
                {recapSaveResult}
              </span>
            )}
            <button
              type="button"
              data-quick-prompt-manage
              onClick={() => setManageOpen((open) => !open)}
              className="flex h-6 items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 text-[9px] text-slate-500 transition-colors hover:border-blue-500/30 hover:bg-blue-500/10 hover:text-blue-300"
            >
              <Pencil size={10} className="shrink-0" />
              {manageOpen ? 'Close' : 'Manage'}
            </button>
          </div>
          {manageOpen && (
            <div
              data-quick-prompt-manager
              className="mb-2 space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-2"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <input
                  data-quick-prompt-name
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="Label"
                  className="h-7 w-28 rounded-md border border-white/10 bg-white/[0.03] px-2 text-[10px] text-slate-200 outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
                />
                <select
                  data-quick-prompt-category
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value as 'life' | 'work')}
                  className="h-7 rounded-md border border-white/10 bg-white/[0.03] px-2 text-[10px] text-slate-300 outline-none focus:border-emerald-500/40"
                >
                  <option value="work">work</option>
                  <option value="life">life</option>
                </select>
                <input
                  data-quick-prompt-text
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder="Prompt text"
                  className="h-7 min-w-0 flex-1 rounded-md border border-white/10 bg-white/[0.03] px-2 text-[10px] text-slate-200 outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
                />
                {editingId ? (
                  <>
                    <button
                      type="button"
                      data-quick-prompt-save
                      onClick={() => void saveCustom()}
                      className="flex h-7 items-center gap-1 rounded-md bg-emerald-500/20 px-2 text-[10px] text-emerald-400 hover:bg-emerald-500/30"
                    >
                      <Save size={11} /> Save
                    </button>
                    <button
                      type="button"
                      data-quick-prompt-cancel
                      onClick={cancelEdit}
                      className="flex h-7 items-center gap-1 rounded-md bg-white/10 px-2 text-[10px] text-slate-400 hover:bg-white/15"
                    >
                      <X size={11} /> Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    data-quick-prompt-add
                    onClick={() => void addCustom()}
                    className="flex h-7 items-center gap-1 rounded-md bg-emerald-500/20 px-2 text-[10px] text-emerald-400 hover:bg-emerald-500/30"
                  >
                    <Plus size={11} /> Add
                  </button>
                )}
              </div>
              {sortedCustomPrompts.length > 0 && (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(event) => void handleDragEnd(event)}
                >
                  <SortableContext
                    items={sortedCustomPrompts.map((prompt) => prompt.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-1">
                      {sortedCustomPrompts.map((prompt) => (
                        <SortablePromptRow
                          key={prompt.id}
                          prompt={prompt}
                          onEdit={startQuickPromptEdit}
                          onDelete={(id) => void removeCustom(id)}
                          onMove={(id, direction) => void moveCustom(id, direction)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          )}
          <div className="composer flex shrink-0 items-end gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-2 focus-within:border-emerald-500/40">
            <textarea
              ref={composerRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={2}
              placeholder="Ask anything..."
              className="min-h-0 flex-1 resize-none bg-transparent px-2 py-1.5 text-xs text-slate-200 outline-none placeholder:text-slate-600"
            />
            {busy ? (
              <button
                type="button"
                onClick={() => void stopStreaming()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400 transition-colors hover:bg-rose-500/30"
                aria-label="Stop streaming"
              >
                <Square size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void send()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 transition-colors hover:bg-emerald-500/30"
                aria-label="Send"
              >
                <Send size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
      {exportSession && exportMarkdown && (
        <div
          data-session-export-panel
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#18181C] shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-xs font-medium text-slate-200">
                  {exportSession.title}
                </div>
                <div className="text-[10px] text-slate-500">
                  {exportMarkdown.split('\n').length} lines · Markdown
                </div>
              </div>
              <button
                type="button"
                aria-label="Close session export"
                data-session-export-close
                onClick={closeSessionExport}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/5 text-slate-400 hover:text-slate-200"
              >
                <X size={13} />
              </button>
            </div>
            <pre
              data-session-export-preview
              className="max-h-[50vh] overflow-auto whitespace-pre-wrap px-4 py-3 text-[11px] leading-relaxed text-slate-300"
            >
              {exportMarkdown}
            </pre>
            <div className="flex items-center gap-2 border-t border-white/10 px-4 py-3">
              <button
                type="button"
                aria-label="Copy session transcript"
                data-session-export-copy
                onClick={() => void copySessionExport()}
                className="flex h-8 items-center gap-1.5 rounded-lg bg-emerald-500/20 px-3 text-[11px] text-emerald-300 hover:bg-emerald-500/30"
              >
                <Copy size={12} />
                {exportCopied ? 'Copied' : 'Copy'}
              </button>
              <button
                type="button"
                aria-label="Download session transcript"
                data-session-export-download
                onClick={downloadSessionExport}
                className="flex h-8 items-center gap-1.5 rounded-lg bg-white/5 px-3 text-[11px] text-slate-300 hover:bg-white/10"
              >
                <Download size={12} />
                Download .md
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
