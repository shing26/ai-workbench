import {
  Archive,
  ArchiveRestore,
  BookOpen,
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
  ListChecks,
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
import {
  clearSearchHistory,
  loadSearchHistory,
  recordSearchHistory,
  summarizeSearchHits,
  type SessionSearchHistoryEntry,
} from '../lib/searchHistory';
import {
  estimateTokens,
  formatTokens,
  getBudgetStatus,
  recordTokenUsage,
  type TokenBudgetStatus,
} from '../lib/tokenBudget';
import {
  loadRecapDraft,
  markRecapDraftSaved,
  saveRecapDraft,
  type RecapDraft,
} from '../lib/recapDraft';
import { useWorkbenchStore } from '../stores/workbenchStore';
import type { InspectorSection } from '../stores/workbenchStore';
import { useViewState } from '../stores/viewState';
import { renderRichContent } from '../components/CodeBlockContent';
import ModelBadge from '../components/ui/ModelBadge';

type Message = { role: 'user' | 'assistant'; content: string; id?: string; laneKey?: string };
type ApiMessage = { role: 'user' | 'assistant' | 'system'; content: string };

function buildNoteSystemMessage(note: import('../stores/workbenchStore').NoteContext): string {
  return (
    `[知识笔记上下文] 当前挂载笔记：${note.title}\n` +
    `标签: ${note.tags || '无'}\n` +
    `类型: ${note.type}\n` +
    `笔记正文:\n${note.content.slice(0, 6000)}` +
    `\n请基于以上笔记内容执行用户的提炼 / 扩展 / 重构指令，引用时注明来源笔记。`
  );
}

function buildActionSystemMessage(
  action: import('../stores/workbenchStore').ActionContext,
): string {
  return (
    `[任务上下文] 当前挂载任务：${action.title}\n` +
    `状态: ${action.status}\n` +
    `截止: ${action.dueDate || '未设定'}\n` +
    `今日焦点: ${action.isToday ? '是' : '否'}\n` +
    `请帮我把该任务拆解为可执行的 Markdown 步骤清单，或给出解决方案 / 建议。`
  );
}

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
  const setInspectorMetrics = useWorkbenchStore((s) => s.setInspectorMetrics);
  const vibeContext = useWorkbenchStore((s) => s.vibeContext);
  const clearVibeContext = useWorkbenchStore((s) => s.clearVibeContext);
  const noteContext = useWorkbenchStore((s) => s.noteContext);
  const clearNoteContext = useWorkbenchStore((s) => s.clearNoteContext);
  const actionContext = useWorkbenchStore((s) => s.actionContext);
  const clearActionContext = useWorkbenchStore((s) => s.clearActionContext);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Ready. Ask anything or switch to MOA for multi-model consensus.',
    },
  ]);
  const [input, setInput] = useViewState('ai-studio', 'input', '');
  const [providerId, setProviderId] = useState('');
  const [moa, setMoa] = useState(false);
  const [moaChain, setMoaChain] = useState(false);
  const [autoRoute, setAutoRoute] = useState(false);
  const [routedProvider, setRoutedProvider] = useState<{
    name: string;
    fallbackFrom: string | null;
  } | null>(null);
  const [fallbackChain, setFallbackChain] = useState<db.StreamFallback[]>([]);
  const fallbackChainRef = useRef<db.StreamFallback[]>([]);
  const [budgetStatus, setBudgetStatus] = useState<TokenBudgetStatus | null>(null);
  const budgetStatusRef = useRef<TokenBudgetStatus | null>(null);
  const [budgetDegraded, setBudgetDegraded] = useState(false);
  const budgetDegradedRef = useRef(false);
  const [departments, setDepartments] = useState<db.Department[]>([]);
  const [agents, setAgents] = useState<db.Agent[]>([]);
  const [agentId, setAgentId] = useState('');
  const [routedAgent, setRoutedAgent] = useState<db.Agent | null>(null);
  const [teamMode, setTeamMode] = useState(false);
  const [teamDeptId, setTeamDeptId] = useState('');
  const [prismSeats, setPrismSeats] = useState<db.AgentSpec[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<Set<string>>(new Set());
  const teamRunIdsRef = useRef<string[]>([]);
  const teamPendingRef = useRef(0);
  const teamResultsRef = useRef(new Map<string, string>());
  const moaRunIdsRef = useRef<string[]>([]);
  const moaPendingRef = useRef(0);
  const moaProviderRunIdsRef = useRef<string[]>([]);
  const moaConsensusRunIdRef = useRef<string | null>(null);
  const moaConsensusLaneKeyRef = useRef<string | null>(null);
  const moaLaneResultsRef = useRef(new Map<string, string>());
  const moaLaneFailedRef = useRef(new Set<string>());
  const moaLaneMetaRef = useRef(
    new Map<
      string,
      {
        runId: string;
        providerId: string;
        providerName: string;
        kind: 'parallel' | 'chain' | 'consensus';
        baseHistoryLength: number;
        laneKey: string;
      }
    >(),
  );
  const [useRag, setUseRag] = useState(true);
  const [ragHits, setRagHits] = useState<db.RagSearchResult[]>([]);
  const [ragConfirmMode, setRagConfirmMode] = useState(false);
  const [ragSourcePref, setRagSourcePref] = useState<db.RagSourcePreference>(() =>
    db.getRagSourcePreference(),
  );
  const [pendingSourceFilter, setPendingSourceFilter] = useState<Set<string> | null>(null);
  const [rememberRagSources, setRememberRagSources] = useState(false);
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
  const [activeLaneKeys, setActiveLaneKeys] = useState<Set<string>>(new Set());
  const [sessions, setSessions] = useState<db.Session[]>([]);
  const [sessionId, setSessionId] = useViewState<string | null>('ai-studio', 'sessionId', null);
  const [sessionQuery, setSessionQuery] = useState('');
  const [sessionRange, setSessionRange] = useState('all');
  const [sessionFullText, setSessionFullText] = useState(true);
  const [sessionArchiveTab, setSessionArchiveTab] = useState<'active' | 'archived'>('active');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [sessionHits, setSessionHits] = useState<db.SessionSearchHit[] | null>(null);
  const [sessionSearchBusy, setSessionSearchBusy] = useState(false);
  const [sessionHistory, setSessionHistory] = useState<SessionSearchHistoryEntry[]>(() =>
    loadSearchHistory(),
  );
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [exportSession, setExportSession] = useState<db.Session | null>(null);
  const [exportMarkdown, setExportMarkdown] = useState('');
  const [exportCopied, setExportCopied] = useState(false);
  const [exportKnowledgeBusy, setExportKnowledgeBusy] = useState(false);
  const [exportKnowledgeResult, setExportKnowledgeResult] = useState('');
  const [exportSummary, setExportSummary] = useState<db.SessionSummary | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null);
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
  const [recapDraft, setRecapDraft] = useState<RecapDraft | null>(() => loadRecapDraft());
  const recapArmedRef = useRef(false);
  const [historyOpen, setHistoryOpen] = useState<string | null>(null);
  const [historyVersions, setHistoryVersions] = useState<db.MessageVersion[]>([]);
  const [diffVersionId, setDiffVersionId] = useState<string | null>(null);
  const [versionDiff, setVersionDiff] = useState<db.MessageDiff | null>(null);
  const runIdRef = useRef(0);
  const sessionIdRef = useRef<string | null>(null);
  const runsRef = useRef(new Map<string, { content: string; index: number; label?: string }>());
  const inspectorStartRef = useRef(0);
  const inspectorFirstTokenRef = useRef<number | null>(null);
  const inspectorTokensRef = useRef(0);
  const inspectorActiveRef = useRef(false);
  const retryTargetRef = useRef<Message | null>(null);
  const activeProvider =
    providers.find((p) => p.id === providerId) ?? providers.find((p) => p.isActive);
  const activeProviders = [...providers.filter((p) => p.isActive)].sort(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
  );
  const moaProviders = activeProviders.slice(0, 3);
  const teamAgents = teamMode
    ? agents.filter((a) => a.departmentId === teamDeptId && a.isActive).slice(0, 3)
    : [];
  const selectedDepartment = departments.find((d) => d.id === teamDeptId) ?? null;
  const pickMoaProviders = () => {
    const currentBudget = getBudgetStatus();
    const localProviders = activeProviders.filter((p) => db.isOllamaProvider(p.name, p.baseUrl));
    const routeProviders =
      currentBudget.over && currentBudget.autoDegrade && localProviders.length > 0
        ? localProviders
        : activeProviders;
    return routeProviders.slice(0, 3);
  };
  const buildMoaPlaceholders = (runId: string): Message[] => {
    const lanes = pickMoaProviders();
    if (lanes.length === 0) return [{ role: 'assistant', content: '__stream__' }];
    const lanePlaceholders: Message[] = [
      ...lanes.map((_, index) => ({
        role: 'assistant' as const,
        content: '__stream__',
        laneKey: `${runId}-lane-${index}`,
      })),
    ];
    if (moaChain) return lanePlaceholders;
    return [
      ...lanePlaceholders,
      {
        role: 'assistant' as const,
        content: '__stream__',
        laneKey: `${runId}-lane-${lanes.length}`,
      },
    ];
  };

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

  const activeView = useWorkbenchStore((s) => s.activeView);
  useEffect(() => {
    if (activeView !== 'ai-studio') return;
    void refreshQuickPrompts();
    setRecapDraft(loadRecapDraft());
  }, [activeView]);

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
          const teamRun = teamPendingRef.current > 0 && teamRunIdsRef.current.includes(chunk.id);
          const moaRun = moaPendingRef.current > 0 && moaRunIdsRef.current.includes(chunk.id);
          const finalContent = chunk.error
            ? `请求失败: ${chunk.error}`
            : chunk.cancelled && !run.content.endsWith('[stopped]')
              ? `${run.content}${run.content ? ' ' : ''}[stopped]`
              : run.content;
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
          if (teamRun && run.label) {
            teamResultsRef.current.set(chunk.id, run.content);
          }
          if (moaRun) {
            moaLaneResultsRef.current.set(chunk.id, run.content);
            if (chunk.error) moaLaneFailedRef.current.add(chunk.id);
            else moaLaneFailedRef.current.delete(chunk.id);
            let laneKeyToRemove: string | null = null;
            for (const [key, value] of moaLaneMetaRef.current) {
              if (value.runId === chunk.id) {
                laneKeyToRemove = key;
                break;
              }
            }
            if (laneKeyToRemove) {
              const key = laneKeyToRemove;
              setActiveLaneKeys((prev) => {
                if (!prev.has(key)) return prev;
                const next = new Set(prev);
                next.delete(key);
                return next;
              });
            }
          }
          if (!chunk.error && !chunk.cancelled && run.content) {
            const nextBudget = recordTokenUsage(estimateTokens(run.content));
            budgetStatusRef.current = getBudgetStatus(nextBudget);
            setBudgetStatus(budgetStatusRef.current);
          }
          runsRef.current.delete(chunk.id);
          if (sessionIdRef.current && (run.content || chunk.error || chunk.cancelled)) {
            if (recapArmedRef.current && !chunk.error && !chunk.cancelled) {
              const today = new Date().toISOString().slice(0, 10);
              setRecapDraft(saveRecapDraft(today, run.content));
              recapArmedRef.current = false;
            }
            void db
              .saveChatMessage(sessionIdRef.current, 'assistant', finalContent)
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
          if (moaRun) {
            moaPendingRef.current -= 1;
            if (moaPendingRef.current > 0) {
              setStreamStatus('streaming');
              return;
            }
            moaRunIdsRef.current = [];
          }
          if (chunk.error) {
            setStreamStatus('error');
            setStreamError(chunk.error);
            if (inspectorActiveRef.current) {
              setInspectorMetrics({
                status: 'error',
                lastError: chunk.error,
              });
            }
          } else if (chunk.cancelled) {
            setStreamStatus('stopped');
            setStreamError(null);
            if (inspectorActiveRef.current) {
              setInspectorMetrics({ status: 'completed' });
            }
          } else {
            setStreamStatus('idle');
            setStreamError(null);
            retryTargetRef.current = null;
            if (inspectorActiveRef.current) {
              setInspectorMetrics({
                status: 'completed',
                totalTokens: inspectorTokensRef.current,
                tokensPerSec: 0,
                contextUsed: inspectorTokensRef.current,
              });
            }
          }
          setBusy(false);
          return;
        }
        setStreamStatus('streaming');
        const delta = run.label && !run.content ? `${run.label}\n\n${chunk.delta}` : chunk.delta;
        run.content += delta;
        if (inspectorActiveRef.current && !chunk.error) {
          if (inspectorFirstTokenRef.current === null) {
            inspectorFirstTokenRef.current = performance.now();
            const ttft = Math.max(
              0,
              Math.round(inspectorFirstTokenRef.current - inspectorStartRef.current),
            );
            setInspectorMetrics({ ttftMs: ttft, status: 'streaming' });
          }
          inspectorTokensRef.current += Math.max(1, estimateTokens(chunk.delta));
          const elapsedSec =
            (performance.now() - (inspectorFirstTokenRef.current || inspectorStartRef.current)) /
            1000;
          const tps =
            elapsedSec > 0 ? Math.max(0, Math.round(inspectorTokensRef.current / elapsedSec)) : 0;
          setInspectorMetrics({
            totalTokens: inspectorTokensRef.current,
            tokensPerSec: tps,
            contextUsed: inspectorTokensRef.current,
          });
        }
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
  }, [setInspectorMetrics]);

  useEffect(() => {
    let disposed = false;
    void db.listSessions().then(async (list) => {
      if (disposed) return;
      setSessions(list);
      const first = list.find((s) => !s.archived) ?? list[0];
      if (first) {
        sessionIdRef.current = first.id;
        setSessionId(first.id);
        setHighlightMessageId(null);
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
  }, [setSessionId]);

  useEffect(() => {
    let disposed = false;
    let unlisten = () => {};
    void db
      .listenStreamFallbacks((fallback) => {
        if (disposed) return;
        fallbackChainRef.current = [...fallbackChainRef.current, fallback].slice(-4);
        setFallbackChain(fallbackChainRef.current);
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
    const status = getBudgetStatus();
    budgetStatusRef.current = status;
    setBudgetStatus(status);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (sessionArchiveTab === 'archived') {
      setSessionHits(null);
      setSessionSearchBusy(false);
      return;
    }
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
          if (cancelled) return;
          setSessionHits(hits);
          if (q.length >= 2) setSessionHistory(recordSearchHistory(q, hits.length));
        })
        .finally(() => {
          if (!cancelled) setSessionSearchBusy(false);
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [sessionQuery, sessionRange, sessionFullText, sessionArchiveTab, sessions]);

  const loaded = useWorkbenchStore((s) => s.loaded);
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
  }, [loaded]);

  useEffect(() => {
    const projectPath = vibeContext?.path;
    if (!projectPath) {
      setPrismSeats([]);
      return;
    }
    let disposed = false;
    void (async () => {
      try {
        await db.ensureAgentSpecs(projectPath);
        const specs = await db.listAgentSpecs(projectPath);
        if (!disposed) setPrismSeats(specs);
      } catch {
        /* spec loading optional */
      }
    })();
    return () => {
      disposed = true;
    };
  }, [vibeContext?.path]);

  const stopStreaming = async () => {
    const targetRuns = new Set<string>();
    if (teamPendingRef.current > 0) {
      teamRunIdsRef.current.forEach((id) => targetRuns.add(id));
    }
    if (moaPendingRef.current > 0) {
      moaRunIdsRef.current.forEach((id) => targetRuns.add(id));
      targetRuns.add(`ai-${runIdRef.current}`);
    }
    if (targetRuns.size === 0) targetRuns.add(`ai-${runIdRef.current}`);
    runIdRef.current += 1;
    setBusy(false);
    setStreamStatus('stopped');
    setStreamError(null);
    setActiveLaneKeys(new Set());
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
    moaPendingRef.current = 0;
    moaRunIdsRef.current = [];
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
    setHighlightMessageId(null);
    runsRef.current.clear();
    retryTargetRef.current = null;
    inspectorActiveRef.current = false;
    inspectorFirstTokenRef.current = null;
    inspectorTokensRef.current = 0;
    setActiveLaneKeys(new Set());
    teamPendingRef.current = 0;
    teamRunIdsRef.current = [];
    teamResultsRef.current.clear();
    moaPendingRef.current = 0;
    moaRunIdsRef.current = [];
    moaProviderRunIdsRef.current = [];
    moaConsensusRunIdRef.current = null;
    moaConsensusLaneKeyRef.current = null;
    moaLaneResultsRef.current.clear();
    moaLaneMetaRef.current.clear();
    setStreamStatus('idle');
    setStreamError(null);
    setInput('');
    setRagHits([]);
    setPendingSend(null);
    setPendingSelected(null);
    setPendingSourceFilter(null);
    setRememberRagSources(false);
    setRecapReady(false);
    setRecapSaveResult(null);
  };

  const focusMessage = (id: string) => {
    setHighlightMessageId(id);
    window.setTimeout(() => {
      const escaped = window.CSS.escape(id);
      const el = document.querySelector(`[data-message-id="${escaped}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  };

  const selectSession = async (id: string, focusMessageId?: string | null) => {
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
    setHighlightMessageId(null);
    retryTargetRef.current = null;
    setActiveLaneKeys(new Set());
    teamPendingRef.current = 0;
    teamRunIdsRef.current = [];
    teamResultsRef.current.clear();
    moaPendingRef.current = 0;
    moaRunIdsRef.current = [];
    moaProviderRunIdsRef.current = [];
    moaConsensusRunIdRef.current = null;
    moaConsensusLaneKeyRef.current = null;
    moaLaneResultsRef.current.clear();
    moaLaneMetaRef.current.clear();
    setStreamStatus('idle');
    setStreamError(null);
    setInput('');
    setRagHits([]);
    setPendingSend(null);
    setPendingSelected(null);
    setPendingSourceFilter(null);
    setRememberRagSources(false);
    if (focusMessageId) focusMessage(focusMessageId);
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

  const setSessionArchive = async (session: db.Session, archived: boolean) => {
    await db.setSessionArchived(session.id, archived);
    const list = await db.listSessions();
    setSessions(list);
    if (!archived) {
      setSessionArchiveTab('active');
      return;
    }
    if (sessionIdRef.current !== session.id) return;
    const next = list.find((s) => !s.archived);
    if (next) {
      sessionIdRef.current = next.id;
      setSessionId(next.id);
      const stored = await db.listChatMessages(next.id);
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
      sessionIdRef.current = null;
      setSessionId(null);
      setMessages([
        {
          role: 'assistant',
          content: 'Ready. Ask anything or switch to MOA for multi-model consensus.',
        },
      ]);
    }
  };

  const duplicateSessionRow = async (session: db.Session) => {
    const copy = await db.duplicateSession(session.id);
    setSessions(await db.listSessions());
    await selectSession(copy.id);
  };

  const openSessionExport = async (session: db.Session) => {
    const messages = await db.listChatMessages(session.id);
    const auxList = await db.listMessageAux(session.id);
    const auxByMessageId = new Map(auxList.map((aux) => [aux.messageId, aux]));
    setExportSession(session);
    setExportMarkdown(db.buildSessionMarkdown(session, messages, auxByMessageId));
    setExportSummary(db.buildSessionSummary(messages));
    setExportCopied(false);
    setExportKnowledgeBusy(false);
    setExportKnowledgeResult('');
  };

  const closeSessionExport = () => {
    setExportSession(null);
    setExportMarkdown('');
    setExportSummary(null);
    setExportCopied(false);
    setExportKnowledgeBusy(false);
    setExportKnowledgeResult('');
  };

  const saveSessionExportToKnowledge = async () => {
    if (!exportSession || !exportMarkdown || exportKnowledgeBusy) return;
    setExportKnowledgeBusy(true);
    setExportKnowledgeResult('');
    try {
      await addThought(exportMarkdown, '#chat,#session', 'note');
      setExportKnowledgeResult('Saved to Knowledge');
    } catch {
      setExportKnowledgeResult('Save failed');
    } finally {
      setExportKnowledgeBusy(false);
    }
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
  const isMessageHit = (hit?: db.SessionSearchHit) =>
    hit?.matchType === 'message' || hit?.matchType === 'pinyin-message';
  const searchStats = sessionHits ? summarizeSearchHits(sessionHits) : null;
  const activeSessions = sessions.filter((s) => !s.archived);
  const archivedSessions = sessions.filter((s) => s.archived);
  const tabSessions = sessionArchiveTab === 'active' ? activeSessions : archivedSessions;
  const filteredSessions = tabSessions
    .filter((s) => {
      const q = sessionQuery.trim().toLowerCase();
      if (!q) return true;
      return `${s.title} ${s.model}`.toLowerCase().includes(q);
    })
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt);
  const visibleSessions = sessionHits
    ? sessionHits
        .filter((hit) =>
          sessionArchiveTab === 'active' ? !hit.session.archived : hit.session.archived,
        )
        .map((hit) => hit.session)
    : filteredSessions;

  const sessionDayKey = (ts: number) => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  };
  const todayKey = sessionDayKey(Date.now());
  const yesterdayKey = sessionDayKey(Date.now() - 86_400_000);
  const sessionGroups =
    !sessionQuery.trim() && !sessionHits
      ? (() => {
          const order = ['pinned', 'today', 'yesterday', '7d', 'older'];
          const buckets = new Map<string, db.Session[]>();
          for (const session of visibleSessions) {
            const label = session.pinned
              ? 'pinned'
              : sessionDayKey(session.createdAt) === todayKey
                ? 'today'
                : sessionDayKey(session.createdAt) === yesterdayKey
                  ? 'yesterday'
                  : Date.now() - session.createdAt <= 7 * 86_400_000
                    ? '7d'
                    : 'older';
            const bucket = buckets.get(label) ?? [];
            bucket.push(session);
            buckets.set(label, bucket);
          }
          return order
            .map((label) => ({ label, sessions: buckets.get(label) ?? [] }))
            .filter((group) => group.sessions.length > 0);
        })()
      : null;

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

  const runStream = async (
    history: Message[],
    runId: string,
    hits: db.RagSearchResult[],
    userMessageId?: string,
  ) => {
    if (!moa && !runsRef.current.has(runId)) {
      runsRef.current.set(runId, { content: '', index: history.length });
    }
    fallbackChainRef.current = [];
    setFallbackChain([]);
    const currentBudget = getBudgetStatus();
    budgetStatusRef.current = currentBudget;
    setBudgetStatus(currentBudget);
    budgetDegradedRef.current = false;
    setBudgetDegraded(false);
    const selectedAgent = agentId ? (agents.find((a) => a.id === agentId) ?? null) : null;
    let providerIds: string[];
    let routedName: string | null = null;
    let fallbackFrom: string | null = null;
    if (currentBudget.over && !currentBudget.autoDegrade) {
      setMessages((prev) =>
        prev.map((m) =>
          m.content === '__stream__' ? { ...m, content: '请求失败: token budget exceeded' } : m,
        ),
      );
      setBusy(false);
      setStreamStatus('error');
      setStreamError('token budget exceeded');
      setRoutedProvider(null);
      return;
    }
    const localProviders = activeProviders.filter((p) => db.isOllamaProvider(p.name, p.baseUrl));
    const routeProviders =
      currentBudget.over && currentBudget.autoDegrade && localProviders.length > 0
        ? localProviders
        : activeProviders;
    if (routeProviders !== activeProviders) {
      budgetDegradedRef.current = true;
      setBudgetDegraded(true);
    }
    if (moa) {
      providerIds = routeProviders.slice(0, 3).map((p) => p.id);
    } else if (autoRoute) {
      const routed = await db.routeProvider(routeProviders.map((p) => p.id));
      if (routed.provider) {
        providerIds = routeProviders.map((p) => p.id);
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
        : routeProviders.length > 0
          ? routeProviders.map((p) => p.id)
          : [];
    }
    const chain = moa && moaChain;
    if (moa) {
      const lanePrefix = chain ? 's' : 'p';
      const providerRuns = providerIds.map((_, index) => `${runId}-${lanePrefix}${index}`);
      const consensusRunId = chain ? null : `${runId}-c`;
      const consensusLaneKey = chain ? null : `${runId}-lane-${providerIds.length}`;
      const laneKeys = providerIds.map((_, index) => `${runId}-lane-${index}`);
      setActiveLaneKeys((prev) => {
        const next = new Set(prev);
        laneKeys.forEach((key) => next.add(key));
        return next;
      });
      moaProviderRunIdsRef.current = providerRuns;
      moaConsensusRunIdRef.current = consensusRunId;
      moaConsensusLaneKeyRef.current = consensusLaneKey;
      moaRunIdsRef.current = consensusRunId ? [...providerRuns, consensusRunId] : [...providerRuns];
      moaPendingRef.current = moaRunIdsRef.current.length;
      moaLaneResultsRef.current.clear();
      moaLaneFailedRef.current.clear();
      providerIds.forEach((pid, index) => {
        const subRunId = providerRuns[index];
        const provider = routeProviders.find((p) => p.id === pid);
        const laneKey = `${runId}-lane-${index}`;
        runsRef.current.set(subRunId, { content: '', index: history.length + index });
        moaLaneMetaRef.current.set(laneKey, {
          runId: subRunId,
          providerId: pid,
          providerName: provider?.name ?? `Provider ${index + 1}`,
          kind: chain ? 'chain' : 'parallel',
          baseHistoryLength: history.length,
          laneKey,
        });
      });
      if (consensusRunId && consensusLaneKey) {
        runsRef.current.set(consensusRunId, {
          content: '',
          index: history.length + providerIds.length,
        });
        moaLaneMetaRef.current.set(consensusLaneKey, {
          runId: consensusRunId,
          providerId: '',
          providerName: 'MOA Consensus',
          kind: 'consensus',
          baseHistoryLength: history.length,
          laneKey: consensusLaneKey,
        });
      }
    }
    if (selectedAgent) setRoutedAgent(selectedAgent);
    setRoutedProvider(routedName ? { name: routedName, fallbackFrom } : null);
    inspectorStartRef.current = performance.now();
    inspectorFirstTokenRef.current = null;
    inspectorTokensRef.current = 0;
    inspectorActiveRef.current = true;
    openInspector('Streaming', []);
    const preProvider = moaProviders[0] ?? activeProvider;
    setInspectorMetrics({
      providerName: preProvider?.name ?? (moa ? 'MOA' : 'Unknown'),
      modelName: preProvider?.model ?? selectedAgent?.model ?? '',
      baseUrl: preProvider?.baseUrl ?? '',
      temperature: 0.7,
      ttftMs: null,
      totalTokens: 0,
      tokensPerSec: 0,
      contextUsed: 0,
      contextLimit: 128000,
      status: 'connecting',
    });
    if (preProvider?.id) {
      db.listCachedProviderModels(preProvider.id)
        .then((models) => models.find((m) => m.id === preProvider.model)?.contextWindow ?? 128000)
        .catch(() => 128000)
        .then((limit) => {
          setInspectorMetrics({ contextLimit: limit });
        });
    }
    const apiMessages: ApiMessage[] = history.filter((m) => m.content !== '__stream__');
    if (vibeContext) {
      apiMessages.unshift({
        role: 'system',
        content:
          `[Vibe Coding 上下文] 当前挂载项目：${vibeContext.projectName}\n` +
          `Path: ${vibeContext.path}\n` +
          `Branch: ${vibeContext.branch} · HEAD: ${vibeContext.head} · Commits: ${vibeContext.commitCount}\n` +
          `最新提交: ${vibeContext.latestCommit}\n` +
          `当前变更文件:\n${vibeContext.changes.map((c) => `- ${c}`).join('\n') || '- 无未提交变更'}\n` +
          `请基于以上工程上下文执行用户的代码重构 / 修改指令，注意变更文件与分支约束。`,
      });
    }
    if (noteContext) {
      apiMessages.unshift({ role: 'system', content: buildNoteSystemMessage(noteContext) });
    }
    if (actionContext) {
      apiMessages.unshift({ role: 'system', content: buildActionSystemMessage(actionContext) });
    }
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
        autoFallback: !moa && (autoRoute || !selectedAgent),
        moaChain: chain,
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
    let consensusSummary = '';
    if (moa && !chain && moaConsensusRunIdRef.current) {
      consensusSummary = moaLaneResultsRef.current.get(moaConsensusRunIdRef.current) ?? '';
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
      sections.push({
        label: 'Providers',
        value: providerIds.length ? providerIds.join(', ') : 'none',
      });
      sections.push({ label: 'Status', value: chain ? 'chain' : '3-way consensus' });
      if (chain) {
        sections.push({
          label: 'Chain',
          value: moaProviders.map((p) => p.name).join(' → '),
        });
        const finalProvider = moaProviders[moaProviders.length - 1];
        if (finalProvider) {
          sections.push({ label: 'Final', value: finalProvider.name });
        }
      } else if (consensusSummary) {
        sections.push({
          label: 'Consensus',
          value: consensusSummary.replace(/\s+/g, ' ').slice(0, 140),
        });
      }
    } else if (routedName) {
      sections.push({ label: 'Router', value: `auto → ${routedName}` });
      sections.push({ label: 'Fallback from', value: fallbackFrom || 'none' });
    }
    if (fallbackChainRef.current.length > 0) {
      sections.push({
        label: 'Fallback chain',
        value: fallbackChainRef.current
          .map((fallback) => `${fallback.from} → ${fallback.to}`)
          .join(', '),
      });
    }
    if (budgetStatusRef.current) {
      sections.push({
        label: 'Budget',
        value: `${budgetStatusRef.current.usedTokens}/${budgetStatusRef.current.monthlyLimit} tokens${
          budgetDegradedRef.current ? ' · degraded' : ''
        }`,
      });
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
      const traceTitle = selectedAgent
        ? hits.length > 0
          ? 'Agent Trace + RAG'
          : 'Agent Trace'
        : moa && hits.length > 0
          ? chain
            ? 'MOA Chain Trace + RAG'
            : 'MOA Trace + RAG'
          : hits.length > 0
            ? 'RAG Context'
            : fallbackChainRef.current.length > 0
              ? 'Router Trace'
              : chain
                ? 'MOA Chain Trace'
                : 'MOA Trace';
      openInspector(traceTitle, sections, true);
      if (userMessageId) {
        const payload = JSON.stringify({
          rag: hits,
          trace: sections.length > 0 ? { title: traceTitle, sections } : null,
        });
        await db.saveMessageAux(userMessageId, payload).catch(() => {});
      }
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
      if (vibeContext) {
        apiMessages.unshift({
          role: 'system',
          content:
            `[Vibe Coding 上下文] 当前挂载项目：${vibeContext.projectName}\n` +
            `Path: ${vibeContext.path}\n` +
            `Branch: ${vibeContext.branch} · HEAD: ${vibeContext.head} · Commits: ${vibeContext.commitCount}\n` +
            `最新提交: ${vibeContext.latestCommit}\n` +
            `当前变更文件:\n${vibeContext.changes.map((c) => `- ${c}`).join('\n') || '- 无未提交变更'}`,
        });
      }
      if (noteContext) {
        apiMessages.unshift({ role: 'system', content: buildNoteSystemMessage(noteContext) });
      }
      if (actionContext) {
        apiMessages.unshift({ role: 'system', content: buildActionSystemMessage(actionContext) });
      }
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
    inspectorStartRef.current = performance.now();
    inspectorFirstTokenRef.current = null;
    inspectorTokensRef.current = 0;
    inspectorActiveRef.current = true;
    openInspector('Team Streaming', []);
    const teamPreProvider = teamRunIdsRef.current[0]
      ? providers.find((p) => p.id === teamRunIdsRef.current[0])
      : null;
    setInspectorMetrics({
      providerName: teamPreProvider?.name ?? 'Team',
      modelName: teamPreProvider?.model ?? '',
      baseUrl: teamPreProvider?.baseUrl ?? '',
      temperature: 0.7,
      ttftMs: null,
      totalTokens: 0,
      tokensPerSec: 0,
      contextUsed: 0,
      contextLimit: 128000,
      status: 'connecting',
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
    openInspector(traceTitle, sections, true);
    const teamFirstAgent = selectedAgents[0] ?? null;
    const teamProvider = teamFirstAgent?.providerId
      ? providers.find((p) => p.id === teamFirstAgent.providerId)
      : null;
    const teamContextPromise = teamProvider
      ? db
          .listCachedProviderModels(teamProvider.id)
          .then(
            (models) => models.find((m) => m.id === teamProvider.model)?.contextWindow ?? 128000,
          )
          .catch(() => 128000)
      : Promise.resolve(128000);
    void teamContextPromise.then((limit) => {
      setInspectorMetrics({
        contextLimit: limit,
      });
    });
    if (messageId) {
      const payload = JSON.stringify({ rag: hits, trace: { title: traceTitle, sections } });
      await db.saveMessageAux(messageId, payload).catch(() => {});
    }
  };

  const sendRoundtable = async (text: string, hits: db.RagSearchResult[]) => {
    const seats = prismSeats.filter((s) => selectedSeats.has(s.id) && s.active).slice(0, 5);
    if (seats.length < 2) {
      setBusy(false);
      setStreamError('请至少勾选 2 位高管席位');
      return;
    }
    const runId = `prism-${++runIdRef.current}`;
    const messageId =
      crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const userMessage: Message = { id: messageId, role: 'user', content: text };
    const placeholders: Message[] = seats.map(() => ({ role: 'assistant', content: '__stream__' }));
    const next: Message[] = [...messages, userMessage, ...placeholders];
    setMessages(next);
    retryTargetRef.current = userMessage;
    setStreamStatus('connecting');
    setStreamError(null);
    setInput('');
    const session = await ensureSession(text);
    await db.saveChatMessage(session.id, 'user', text, messageId);
    const history: Message[] = next.slice(0, next.length - seats.length);
    const providerBase = activeProvider?.id ?? '';
    teamPendingRef.current = seats.length;
    teamRunIdsRef.current = [];
    const seatRuns = seats.map((seat, index) => {
      const subRunId = `${runId}-s${index}`;
      teamRunIdsRef.current.push(subRunId);
      const providerIds = providerBase ? [providerBase] : [];
      const apiMessages: ApiMessage[] = history.filter((m) => m.content !== '__stream__');
      if (vibeContext) {
        apiMessages.unshift({
          role: 'system',
          content:
            `[Vibe Coding 上下文] 当前挂载项目：${vibeContext.projectName}\n` +
            `Path: ${vibeContext.path}\nBranch: ${vibeContext.branch}\n` +
            `当前变更文件:\n${vibeContext.changes.map((c) => `- ${c}`).join('\n') || '- 无'}`,
        });
      }
      apiMessages.unshift({ role: 'system', content: seat.prompt.trim() });
      if (hits.length > 0) {
        apiMessages.unshift({
          role: 'system',
          content: `Knowledge context:\n${hits.map((h) => `- ${h.content}`).join('\n')}`,
        });
      }
      runsRef.current.set(subRunId, {
        content: '',
        index: history.length + index,
        label: `${seat.name} · ${seat.role}`,
      });
      return db.sendAiMessageStream({
        providerIds,
        messages: apiMessages,
        moa: false,
        runId: subRunId,
      });
    });
    openInspector('Prism Roundtable', []);
    await Promise.all(seatRuns.map((p) => p.catch(() => {})));
    const outputs = teamRunIdsRef.current.map((id) => teamResultsRef.current.get(id) ?? '');
    const sections: InspectorSection[] = [
      { label: 'Seats', value: seats.map((s) => s.name).join(', ') },
      { label: 'KPI', value: seats.map((s) => s.kpi).join(' / ') },
      { label: 'Status', value: 'parallel deliberation' },
    ];
    seats.forEach((s, i) => {
      const opinion = (outputs[i] ?? '').replace(/\s+/g, ' ').slice(0, 90);
      sections.push({ label: `${s.name} 观点`, value: opinion || '—' });
    });
    openInspector('Prism Roundtable + Summary', sections, true);
  };

  const dispatchSend = async (text: string, hits: db.RagSearchResult[]) => {
    setBusy(true);
    const seatCount = prismSeats.filter((s) => selectedSeats.has(s.id) && s.active).length;
    if (seatCount >= 2) {
      await sendRoundtable(text, hits);
      return;
    }
    if (teamMode) {
      await sendTeam(text, hits);
      return;
    }
    const runId = `ai-${++runIdRef.current}`;
    const messageId =
      crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const userMessage: Message = { id: messageId, role: 'user', content: text };
    const placeholders: Message[] = moa
      ? buildMoaPlaceholders(runId)
      : [{ role: 'assistant', content: '__stream__' }];
    const next: Message[] = [...messages, userMessage, ...placeholders];
    setMessages(next);
    retryTargetRef.current = userMessage;
    setStreamStatus('connecting');
    setStreamError(null);
    setInput('');
    const session = await ensureSession(text);
    await db.saveChatMessage(session.id, 'user', text, messageId);
    const history: Message[] = next.slice(0, next.length - placeholders.length);
    await runStream(history, runId, hits, messageId);
  };

  const sendText = async (text: string) => {
    if (!text.trim() || busy) return;
    setRecapReady(false);
    setRecapSaveResult(null);
    let hits: db.RagSearchResult[] = [];
    if (useRag) {
      try {
        hits = await db.searchThoughts(text, 5, ragSourcePref.enabled ? ragSourcePref : undefined);
      } catch {
        hits = [];
      }
    }
    setRagHits(hits);
    if (useRag && ragConfirmMode && hits.length > 0) {
      setPendingSend({ text, hits });
      setPendingSelected(new Set(hits.map((hit) => hit.id)));
      setPendingSourceFilter(
        new Set(hits.map((hit) => hit.sourceFile).filter((path): path is string => !!path)),
      );
      setRememberRagSources(false);
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
    let selected = hits.filter((hit) => pendingSelected.has(hit.id));
    if (pendingSourceFilter) {
      selected = selected.filter(
        (hit) =>
          !hit.sourceFile || hit.sourceKind !== 'file' || pendingSourceFilter.has(hit.sourceFile),
      );
    }
    if (rememberRagSources) {
      const filePaths = hits
        .map((hit) => hit.sourceFile)
        .filter((path): path is string => !!path)
        .filter((path) => pendingSourceFilter?.has(path) ?? true);
      const pref = db.setRagSourcePreference({
        enabled: filePaths.length > 0,
        mode: filePaths.length > 0 ? 'selected' : 'all',
        filePaths,
      });
      setRagSourcePref(pref);
    }
    setPendingSend(null);
    setPendingSelected(null);
    setPendingSourceFilter(null);
    setRememberRagSources(false);
    setRagHits(selected);
    await dispatchSend(text, selected);
  };

  const cancelRagSend = () => {
    setPendingSend(null);
    setPendingSelected(null);
    setPendingSourceFilter(null);
    setRememberRagSources(false);
    setRagHits([]);
  };

  const resetRagSourcePref = () => {
    const pref = db.setRagSourcePreference({ enabled: false, mode: 'all', filePaths: [] });
    setRagSourcePref(pref);
  };

  const togglePendingSource = (path: string) => {
    setPendingSourceFilter((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const send = async () => {
    await sendText(input.trim());
  };

  const runDailyRecap = async () => {
    if (busy) return;
    recapArmedRef.current = true;
    await sendText(buildDailyRecapPrompt(tasks, habits, scheduleEvents));
    recapArmedRef.current = false;
    setRecapReady(true);
  };

  const persistRecapNote = async (content: string, date: string) => {
    if (recapSaving) return;
    setRecapSaving(true);
    setRecapSaveResult(null);
    try {
      await addThought(`# 今日复盘 ${date}\n\n${content}`, '#daily,#recap', 'note');
      const draft = loadRecapDraft() ?? saveRecapDraft(date, content);
      setRecapDraft(markRecapDraftSaved(draft));
      setRecapSaveResult(`Saved recap note (${date})`);
    } catch (error) {
      setRecapSaveResult(error instanceof Error ? error.message : String(error));
    } finally {
      setRecapSaving(false);
    }
  };

  const saveRecapNote = async () => {
    if (!recapReady || recapSaving || recapDraft?.saved) return;
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
    const date = recapDraft?.date ?? new Date().toISOString().slice(0, 10);
    await persistRecapNote(reply, date);
  };

  const saveRecapMessage = async (message: Message) => {
    if (!recapDraft || recapDraft.saved || recapSaving || message.content !== recapDraft.content) {
      return;
    }
    await persistRecapNote(message.content, recapDraft.date);
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
    const placeholders: Message[] = moa
      ? buildMoaPlaceholders(runId)
      : [{ role: 'assistant', content: '__stream__' }];
    const history: Message[] = [...truncated, ...placeholders];
    if (!moa) {
      runsRef.current.set(runId, { content: '', index: truncated.length });
    }
    setMessages(history);
    await runStream(truncated, runId, hits);
  };

  const retryLast = () => {
    const target = retryTargetRef.current;
    if (target) void regenerateMessage(target);
  };

  const cancelMoaLane = async (laneKey: string) => {
    const meta = moaLaneMetaRef.current.get(laneKey);
    if (!meta) return;
    await db.cancelAiStream(meta.runId);
  };

  const retryMoaLane = async (laneKey: string) => {
    const meta = moaLaneMetaRef.current.get(laneKey);
    if (!meta || busy || !sessionIdRef.current) return;
    setBusy(true);
    setStreamStatus('connecting');
    setStreamError(null);
    const current = messages;
    const userMessage = current[meta.baseHistoryLength - 1];
    retryTargetRef.current = userMessage ?? null;
    const removed = current.slice(meta.baseHistoryLength);
    await Promise.all(
      removed
        .filter((m) => m.id && m.content && m.content !== '__stream__')
        .map((m) => db.saveMessageVersion(m.id as string, m.content)),
    );
    if (userMessage?.id) {
      await db.truncateChatMessages(sessionIdRef.current, userMessage.id);
    }
    const laneIndex = current.findIndex((m) => m.laneKey === laneKey);
    const targetIndex = laneIndex >= 0 ? laneIndex : meta.baseHistoryLength;
    const consensusKey = moaConsensusLaneKeyRef.current;
    const chainEnd = meta.kind === 'chain' ? targetIndex : current.length - 1;
    const next = current
      .map((m, i) => {
        if (i === targetIndex) return { ...m, content: '__stream__' };
        if (consensusKey && m.laneKey === consensusKey) return { ...m, content: '__stream__' };
        return m;
      })
      .filter((m, i) => i <= chainEnd || (consensusKey && m.laneKey === consensusKey));
    setMessages(next);
    setActiveLaneKeys((prev) => {
      const nextSet = new Set(prev);
      nextSet.add(laneKey);
      return nextSet;
    });
    for (let i = meta.baseHistoryLength; i < next.length; i += 1) {
      const m = next[i];
      if (m.role === 'assistant' && m.id && m.content && m.content !== '__stream__') {
        await db.saveChatMessage(sessionIdRef.current, 'assistant', m.content, m.id);
      }
    }
    const newRunId = `ai-${++runIdRef.current}`;
    const subRunId = `${newRunId}-r`;
    runsRef.current.set(subRunId, {
      content: '',
      index: targetIndex,
      label: `## ${meta.providerName}`,
    });
    moaProviderRunIdsRef.current = moaProviderRunIdsRef.current.map((id) =>
      id === meta.runId ? subRunId : id,
    );
    moaRunIdsRef.current = [subRunId];
    moaPendingRef.current = 1;
    moaLaneMetaRef.current.set(laneKey, { ...meta, runId: subRunId });
    moaLaneResultsRef.current.delete(subRunId);
    const history: Message[] = current.slice(0, meta.baseHistoryLength);
    const apiMessages: ApiMessage[] = history.filter((m) => m.content !== '__stream__');
    const selectedAgent = agentId ? (agents.find((a) => a.id === agentId) ?? null) : null;
    if (vibeContext) {
      apiMessages.unshift({
        role: 'system',
        content:
          `[Vibe Coding 上下文] 当前挂载项目：${vibeContext.projectName}\n` +
          `Path: ${vibeContext.path}\n` +
          `Branch: ${vibeContext.branch} · HEAD: ${vibeContext.head} · Commits: ${vibeContext.commitCount}\n` +
          `当前变更文件:\n${vibeContext.changes.map((c) => `- ${c}`).join('\n') || '- 无未提交变更'}`,
      });
    }
    if (noteContext) {
      apiMessages.unshift({ role: 'system', content: buildNoteSystemMessage(noteContext) });
    }
    if (actionContext) {
      apiMessages.unshift({ role: 'system', content: buildActionSystemMessage(actionContext) });
    }
    if (selectedAgent?.systemPrompt?.trim()) {
      apiMessages.unshift({ role: 'system', content: selectedAgent.systemPrompt.trim() });
    }
    let hits: db.RagSearchResult[] = [];
    if (useRag) {
      try {
        hits = await db.searchThoughts(userMessage?.content ?? '', 5);
      } catch {
        hits = [];
      }
    }
    setRagHits(hits);
    if (hits.length > 0) {
      apiMessages.unshift({
        role: 'system',
        content: `Knowledge context:\n${hits.map((h) => `- ${h.content}`).join('\n')}`,
      });
    }
    try {
      await db.sendAiMessageStream({
        providerIds: [meta.providerId],
        messages: apiMessages,
        moa: false,
        runId: subRunId,
      });
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.laneKey === laneKey ? { ...m, content: '请求失败: stream unavailable' } : m,
        ),
      );
      setStreamStatus('error');
      setStreamError('stream unavailable');
      setBusy(false);
      return;
    }
    if (moaLaneFailedRef.current.has(subRunId)) {
      const previousConsensus = next.find((m) => m.laneKey === consensusKey);
      setMessages((prev) =>
        prev.map((m) =>
          m.laneKey === consensusKey && previousConsensus
            ? { ...m, content: previousConsensus.content }
            : m,
        ),
      );
      setStreamStatus('error');
      setStreamError('lane retry failed');
      setBusy(false);
      return;
    }
    if (!consensusKey || meta.kind !== 'parallel') {
      setBusy(false);
      setStreamStatus('idle');
      setStreamError(null);
      retryTargetRef.current = null;
      return;
    }
    const outputs = moaProviderRunIdsRef.current.map(
      (id) => moaLaneResultsRef.current.get(id) ?? '',
    );
    const consensus = await db.buildMoaConsensus(outputs);
    const consensusContent = `## MOA Consensus\n\n${consensus.summary}`;
    const consensusMessage = next.find((m) => m.laneKey === consensusKey);
    const savedConsensus = await db.saveChatMessage(
      sessionIdRef.current,
      'assistant',
      consensusContent,
      consensusMessage?.id,
    );
    setMessages((prev) =>
      prev.map((m) =>
        m.laneKey === consensusKey ? { ...m, content: consensusContent, id: savedConsensus.id } : m,
      ),
    );
    setBusy(false);
    setStreamStatus('idle');
    setStreamError(null);
    retryTargetRef.current = null;
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

  const renderSessionRow = (s: db.Session) =>
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
            s.pinned ? 'text-amber-300 hover:text-amber-200' : 'text-slate-600 hover:text-amber-300'
          }`}
        >
          {s.pinned ? <Pin size={10} /> : <PinOff size={10} />}
        </button>
        <button
          type="button"
          aria-label="Open session"
          onClick={() =>
            void selectSession(
              s.id,
              isMessageHit(sessionHitBy.get(s.id))
                ? (sessionHitBy.get(s.id)?.messageId ?? null)
                : null,
            )
          }
          data-session-message-id={
            isMessageHit(sessionHitBy.get(s.id)) ? (sessionHitBy.get(s.id)?.messageId ?? '') : ''
          }
          data-session-archived={s.archived ? 'true' : 'false'}
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
              {isMessageHit(sessionHitBy.get(s.id)) ? '  →' : ''}
            </span>
          ) : null}
          <span
            className={`${sessionHitBy.get(s.id) ? 'hidden' : ''} mt-0.5 block truncate text-[9px] text-slate-600`}
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
            {s.archived ? (
              <button
                type="button"
                aria-label="Restore session"
                data-session-restore={s.id}
                onClick={() => void setSessionArchive(s, false)}
                className="flex h-5 w-5 items-center justify-center rounded-md bg-white/5 text-slate-400 hover:text-emerald-300"
              >
                <ArchiveRestore size={10} />
              </button>
            ) : (
              <button
                type="button"
                aria-label="Archive session"
                data-session-archive={s.id}
                onClick={() => void setSessionArchive(s, true)}
                className="flex h-5 w-5 items-center justify-center rounded-md bg-white/5 text-slate-400 hover:text-cyan-300"
              >
                <Archive size={10} />
              </button>
            )}
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
    );

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
          {moa && (
            <ModelBadge label="MOA" tone="blue" status={moaChain ? 'chain' : '3-way+summary'} />
          )}
          {moa && moaChain && moaProviders.length > 1 && (
            <span
              data-moa-chain-badge
              className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[11px] text-violet-300"
            >
              <GitCompare size={11} />
              {moaProviders.map((p) => p.name).join(' → ')}
            </span>
          )}
          {fallbackChain.length > 0 && (
            <span
              data-ai-fallback-chain
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-300"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              auto fallback ×{fallbackChain.length}
              <span className="opacity-70">
                {fallbackChain.map((f) => `${f.from} → ${f.to}`).join(', ')}
              </span>
            </span>
          )}
          {budgetStatus && (
            <span
              data-token-budget-badge
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${
                budgetStatus.over
                  ? 'border-rose-500/40 bg-rose-500/15 text-rose-300'
                  : budgetStatus.near
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                    : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              tokens {formatTokens(budgetStatus.usedTokens)}/
              {formatTokens(budgetStatus.monthlyLimit)}
              {budgetDegraded && <span className="opacity-80">· degraded</span>}
              {budgetStatus.over && <span className="opacity-80">· over</span>}
            </span>
          )}
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
          {prismSeats.length > 0 && (
            <div
              data-prism-seats
              className="flex flex-wrap items-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1"
            >
              <span className="px-1 text-[9px] uppercase tracking-wide text-emerald-400/80">
                高管席位
              </span>
              {prismSeats.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  data-prism-seat={s.id}
                  aria-pressed={selectedSeats.has(s.id)}
                  onClick={() =>
                    setSelectedSeats((prev) => {
                      const next = new Set(prev);
                      if (next.has(s.id)) next.delete(s.id);
                      else next.add(s.id);
                      return next;
                    })
                  }
                  className={`rounded-md px-2 py-0.5 text-[10px] transition-colors ${
                    selectedSeats.has(s.id)
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'text-slate-500 hover:bg-white/[0.06] hover:text-slate-300'
                  }`}
                  title={`${s.role} · ${s.kpi}`}
                >
                  @{s.id}
                </button>
              ))}
            </div>
          )}
          {moa && (
            <div
              data-moa-chain-toggle
              className="flex overflow-hidden rounded-xl border border-violet-500/20 bg-white/[0.04] p-0.5"
            >
              <button
                type="button"
                data-moa-chain-mode="parallel"
                aria-pressed={!moaChain}
                onClick={() => setMoaChain(false)}
                className={`rounded-[10px] px-2.5 py-1.5 text-[11px] ${
                  !moaChain
                    ? 'bg-violet-500/20 text-violet-300'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Parallel
              </button>
              <button
                type="button"
                data-moa-chain-mode="chain"
                aria-pressed={moaChain}
                onClick={() => setMoaChain(true)}
                className={`rounded-[10px] px-2.5 py-1.5 text-[11px] ${
                  moaChain
                    ? 'bg-violet-500/20 text-violet-300'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Chain
              </button>
            </div>
          )}
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
          <div className="flex h-6 shrink-0 items-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
            <button
              type="button"
              data-session-archive-tab="active"
              onClick={() => setSessionArchiveTab('active')}
              className={`flex h-5 flex-1 items-center justify-center gap-1 rounded-md text-[9px] transition-colors ${
                sessionArchiveTab === 'active'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Active
              <span className="rounded bg-white/10 px-1 text-[8px] leading-3 text-slate-400">
                {activeSessions.length}
              </span>
            </button>
            <button
              type="button"
              data-session-archive-tab="archived"
              onClick={() => setSessionArchiveTab('archived')}
              className={`flex h-5 flex-1 items-center justify-center gap-1 rounded-md text-[9px] transition-colors ${
                sessionArchiveTab === 'archived'
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Archived
              <span className="rounded bg-white/10 px-1 text-[8px] leading-3 text-slate-400">
                {archivedSessions.length}
              </span>
            </button>
          </div>
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
          {sessionHistory.length > 0 && (
            <div className="flex h-7 shrink-0 items-center gap-1 overflow-hidden">
              <History size={10} className="shrink-0 text-slate-600" />
              <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
                {sessionHistory.slice(0, 4).map((entry) => (
                  <button
                    key={entry.query}
                    type="button"
                    data-session-history-query={entry.query}
                    onClick={() => setSessionQuery(entry.query)}
                    className="shrink-0 rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[9px] text-slate-400 hover:border-emerald-500/30 hover:text-emerald-300"
                  >
                    {entry.query}
                  </button>
                ))}
              </div>
              <button
                type="button"
                aria-label="Clear session search history"
                data-session-history-clear
                onClick={() => setSessionHistory(clearSearchHistory())}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-slate-600 hover:text-rose-400"
              >
                <X size={10} />
              </button>
            </div>
          )}
          {searchStats ? (
            <div
              data-session-search-stats
              className="shrink-0 rounded-lg border border-cyan-500/20 bg-cyan-500/[0.06] px-2 py-1 text-[9px] leading-4 text-cyan-300/90"
            >
              {searchStats.totalHits} hits · {searchStats.sessions} sessions ·{' '}
              {searchStats.titleHits} title · {searchStats.modelHits} model ·{' '}
              {searchStats.messageHits} message · {searchStats.pinyinHits} pinyin · avg{' '}
              {searchStats.avgScore}
            </div>
          ) : null}
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {sessionGroups
              ? sessionGroups.map((group) => {
                  const collapsed = !!collapsedGroups[group.label];
                  return (
                    <div key={group.label} data-session-group={group.label} className="space-y-1">
                      <button
                        type="button"
                        data-session-group-toggle={group.label}
                        data-session-group-label={group.label}
                        data-session-group-count={group.sessions.length}
                        data-session-group-collapsed={collapsed ? 'true' : 'false'}
                        onClick={() =>
                          setCollapsedGroups((prev) => ({
                            ...prev,
                            [group.label]: !prev[group.label],
                          }))
                        }
                        className="flex h-6 w-full items-center justify-between rounded-md px-1.5 text-[9px] uppercase tracking-wide text-slate-500 hover:text-slate-300"
                      >
                        <span>{group.label}</span>
                        <span className="flex items-center gap-1 font-mono text-[8px] text-slate-600">
                          {group.sessions.length}
                          <ChevronDown
                            size={9}
                            className={`transition-transform ${collapsed ? '-rotate-90' : ''}`}
                          />
                        </span>
                      </button>
                      {!collapsed && group.sessions.map((s) => renderSessionRow(s))}
                    </div>
                  );
                })
              : visibleSessions.map((s) => renderSessionRow(s))}
            {visibleSessions.length === 0 && (
              <div className="py-6 text-center text-[10px] text-slate-600">
                {sessionQuery.trim()
                  ? sessionSearchBusy
                    ? 'Searching...'
                    : 'No matching sessions'
                  : sessionArchiveTab === 'archived'
                    ? 'No archived sessions'
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
                key={m.id ?? i}
                data-message-id={m.id ?? ''}
                className={`group relative ${
                  m.role === 'user' ? 'self-end' : 'self-start'
                } ${m.id && m.id === highlightMessageId ? 'message-jump-highlight' : ''}`}
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
                  {m.content === '__stream__'
                    ? ''
                    : renderRichContent(m.content, vibeContext?.path)}
                  {m.content === '__stream__' && busy && <span className="stream-caret" />}
                  {m.laneKey && activeLaneKeys.has(m.laneKey) && (
                    <span className="mt-1.5 flex items-center gap-1.5">
                      <button
                        type="button"
                        aria-label="Stop lane"
                        data-moa-lane-stop={m.laneKey}
                        onClick={() => {
                          if (m.laneKey) void cancelMoaLane(m.laneKey);
                        }}
                        className="flex h-6 shrink-0 items-center gap-1 rounded-md border border-rose-500/25 bg-rose-500/10 px-2 text-[10px] text-rose-300 transition-colors hover:bg-rose-500/20"
                      >
                        <Square size={9} /> Stop
                      </button>
                    </span>
                  )}
                  {m.laneKey &&
                    (m.content.startsWith('请求失败') || m.content.endsWith('[stopped]')) && (
                      <span className="mt-1.5 flex items-center gap-1.5">
                        <button
                          type="button"
                          aria-label="Retry lane"
                          data-moa-lane-retry={m.laneKey}
                          onClick={() => {
                            if (m.laneKey) void retryMoaLane(m.laneKey);
                          }}
                          className="flex h-6 shrink-0 items-center gap-1 rounded-md border border-amber-500/25 bg-amber-500/10 px-2 text-[10px] text-amber-300 transition-colors hover:bg-amber-500/20"
                        >
                          <RefreshCw size={9} /> Retry
                        </button>
                      </span>
                    )}
                  {m.laneKey && m.content.startsWith('请求失败') && (
                    <span
                      data-moa-node-status="disconnected"
                      className="mt-1.5 inline-flex items-center gap-1.5 rounded-md border border-rose-500/25 bg-rose-500/10 px-2 text-[10px] text-rose-300"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" /> Disconnected
                    </span>
                  )}
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
                    {recapDraft && m.content === recapDraft.content && (
                      <button
                        type="button"
                        aria-label="Save recap message"
                        data-ai-recap-message-save
                        onClick={() => void saveRecapMessage(m)}
                        disabled={recapDraft.saved || recapSaving}
                        title={recapDraft.saved ? 'Recap saved' : 'Save recap note'}
                        className={`flex h-6 w-6 items-center justify-center rounded-md ${
                          recapDraft.saved
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-white/5 text-slate-500 hover:text-blue-300'
                        }`}
                      >
                        <Save size={11} />
                      </button>
                    )}
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
              {ragSourcePref.enabled && (
                <span
                  data-rag-source-summary
                  className="rounded-md border border-violet-500/20 bg-violet-500/10 px-1.5 py-0.5 text-violet-300"
                >
                  {ragSourcePref.mode === 'selected'
                    ? `${ragSourcePref.filePaths.length} source(s) remembered`
                    : 'all sources'}
                </span>
              )}
              {ragSourcePref.enabled && (
                <button
                  type="button"
                  data-rag-source-reset
                  onClick={resetRagSourcePref}
                  className="rounded-md bg-white/[0.05] px-1.5 py-0.5 text-slate-500 hover:text-slate-300"
                >
                  Reset
                </button>
              )}
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
              {pendingSourceFilter && (
                <div
                  data-rag-source-panel
                  className="mb-1.5 rounded-lg border border-white/10 bg-white/[0.02] p-1.5"
                >
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    {Array.from(pendingSourceFilter).map((path) => (
                      <label
                        key={path}
                        className="flex cursor-pointer items-center gap-1 rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-slate-400"
                      >
                        <input
                          type="checkbox"
                          data-rag-source-option={path}
                          checked={pendingSourceFilter.has(path)}
                          onChange={() => togglePendingSource(path)}
                          className="h-2.5 w-2.5 accent-violet-400"
                        />
                        <span className="max-w-[180px] truncate">{path.split(/[\\/]/).pop()}</span>
                      </label>
                    ))}
                  </div>
                  <label className="flex cursor-pointer items-center gap-1.5 text-[9px] text-slate-500">
                    <input
                      type="checkbox"
                      data-rag-source-remember
                      checked={rememberRagSources}
                      onChange={(e) => setRememberRagSources(e.target.checked)}
                      className="h-2.5 w-2.5 accent-emerald-400"
                    />
                    Remember this source selection for next RAG search
                  </label>
                </div>
              )}
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
              data-recap-saved={recapDraft?.saved ? 'true' : 'false'}
              disabled={!recapReady || recapSaving || !!recapDraft?.saved}
              className="flex h-6 items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 text-[9px] text-slate-500 transition-colors hover:border-blue-500/30 hover:bg-blue-500/10 hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Save size={10} />
              {recapSaving ? 'Saving' : recapDraft?.saved ? '已保存' : '保存复盘'}
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
          {vibeContext && (
            <div
              data-vibe-context
              className="mb-2 flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-3 py-2"
            >
              <Sparkles size={13} className="shrink-0 text-emerald-400" />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium text-emerald-300">
                  Vibe Coding · {vibeContext.projectName}
                </div>
                <div className="truncate font-mono text-[9px] text-slate-500">
                  {vibeContext.branch} · {vibeContext.changes.length} changed file(s) · context
                  mounted
                </div>
              </div>
              <button
                type="button"
                data-vibe-context-dismiss
                onClick={clearVibeContext}
                className="flex h-6 shrink-0 items-center rounded-md border border-white/10 px-2 text-[10px] text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
              >
                卸载
              </button>
            </div>
          )}
          {noteContext && (
            <div
              data-note-context
              className="mb-2 flex items-center gap-2 rounded-xl border border-sky-500/25 bg-sky-500/[0.06] px-3 py-2"
            >
              <BookOpen size={13} className="shrink-0 text-sky-400" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-medium text-sky-300">
                  Knowledge · {noteContext.title}
                </div>
                <div className="truncate font-mono text-[9px] text-slate-500">
                  {noteContext.tags || 'untagged'} · {noteContext.type} · context mounted
                </div>
              </div>
              <button
                type="button"
                data-note-context-dismiss
                onClick={clearNoteContext}
                className="flex h-6 shrink-0 items-center rounded-md border border-white/10 px-2 text-[10px] text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
              >
                卸载
              </button>
            </div>
          )}
          {actionContext && (
            <div
              data-action-context
              className="mb-2 flex items-center gap-2 rounded-xl border border-violet-500/25 bg-violet-500/[0.06] px-3 py-2"
            >
              <ListChecks size={13} className="shrink-0 text-violet-400" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-medium text-violet-300">
                  Actions · {actionContext.title}
                </div>
                <div className="truncate font-mono text-[9px] text-slate-500">
                  {actionContext.status}
                  {actionContext.dueDate ? ` · due ${actionContext.dueDate}` : ''} · context mounted
                </div>
              </div>
              <button
                type="button"
                data-action-context-dismiss
                onClick={clearActionContext}
                className="flex h-6 shrink-0 items-center rounded-md border border-white/10 px-2 text-[10px] text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
              >
                卸载
              </button>
            </div>
          )}
          <div className="composer flex shrink-0 items-end gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-2 focus-within:border-emerald-500/40">
            <textarea
              ref={composerRef}
              data-composer
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
            {exportSummary && (
              <div data-session-summary className="border-b border-white/10 px-4 py-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span data-session-summary-stats className="text-[9px] text-slate-500">
                    {exportSummary.questionCount} questions · {exportSummary.keywords.length}{' '}
                    keywords
                  </span>
                  {exportSummary.keywords.map((keyword) => (
                    <span
                      key={keyword}
                      data-session-summary-keyword
                      className="rounded-md bg-white/5 px-1.5 py-0.5 text-[9px] text-slate-300"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
                <ul className="mt-1.5 space-y-1">
                  {exportSummary.points.map((point, index) => (
                    <li
                      key={`${point.question}-${index}`}
                      data-session-summary-point
                      className="text-[10px] leading-relaxed text-slate-400"
                    >
                      Q: {point.question || '—'} / A: {point.answer || '—'}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <pre
              data-session-export-preview
              className="max-h-[50vh] overflow-auto whitespace-pre-wrap px-4 py-3 text-[11px] leading-relaxed text-slate-300"
            >
              {exportMarkdown}
            </pre>
            <div className="flex flex-wrap items-center gap-2 border-t border-white/10 px-4 py-3">
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
                aria-label="Save session transcript to Knowledge"
                data-session-export-knowledge
                onClick={() => void saveSessionExportToKnowledge()}
                disabled={exportKnowledgeBusy}
                className="flex h-8 items-center gap-1.5 rounded-lg bg-blue-500/20 px-3 text-[11px] text-blue-300 hover:bg-blue-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save size={12} />
                {exportKnowledgeBusy ? 'Saving' : '存入知识库'}
              </button>
              {exportKnowledgeResult && (
                <span
                  data-session-export-knowledge-result
                  className="rounded-md bg-white/[0.04] px-2 py-1 text-[10px] text-slate-400"
                >
                  {exportKnowledgeResult}
                </span>
              )}
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
