import { Copy, Play, Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as db from '../../lib/db';
import { useDeliverySnapshot } from '../../hooks/useDelivery';
import { deliveryOrchestrator } from '../../lib/delivery';
import { emitEvent, TOPICS } from '../../stores/events';
import { useWorkbenchStore, type ViewId } from '../../stores/workbenchStore';
import { usePrismModals } from './prismModalsStore';

const VIEWS: { id: ViewId; label: string; icon: string }[] = [
  { id: 'dashboard', label: '总览控制塔', icon: '📊' },
  { id: 'projects', label: '项目矩阵', icon: '📁' },
  { id: 'ai-studio', label: '需求论证 Canvas', icon: '💬' },
  { id: 'actions', label: '交付终端', icon: '🎯' },
  { id: 'knowledge', label: '活体知识库', icon: '📚' },
];

const CLI_LABELS: Record<string, { label: string; emoji: string }> = {
  claude: { label: 'Claude Code', emoji: '⚡' },
  aider: { label: 'Aider', emoji: '🧊' },
  codex: { label: 'Codex CLI', emoji: '🟦' },
  gemini: { label: 'Gemini CLI', emoji: '✨' },
  opencode: { label: 'OpenCode', emoji: '🧩' },
  qwen: { label: 'Qwen Code', emoji: '🌐' },
  cursor: { label: 'Cursor CLI', emoji: '🖱️' },
  windsurf: { label: 'Windsurf', emoji: '🏄' },
};

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="slate-glass flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl"
      >
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-4">
          <span className="text-sm font-semibold text-slate-200">{title}</span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-white/10 hover:text-slate-200"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

function SearchModal() {
  const setActiveView = useWorkbenchStore((s) => s.setActiveView);
  const closeModal = usePrismModals((s) => s.closeModal);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<db.RagSearchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    let disposed = false;
    setBusy(true);
    const timer = window.setTimeout(async () => {
      try {
        const hits = await db.searchThoughts(query.trim(), 8);
        if (!disposed) setResults(hits);
      } catch {
        if (!disposed) setResults([]);
      } finally {
        if (!disposed) setBusy(false);
      }
    }, 220);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const open = useCallback(
    (result: db.RagSearchResult) => {
      void db.recordThoughtReference(result.id).catch(() => {});
      setActiveView('knowledge');
      emitEvent(TOPICS.COMMAND_OPEN_THOUGHT, { thoughtId: result.id });
      closeModal();
    },
    [setActiveView, closeModal],
  );

  return (
    <ModalShell title="全局语义搜索" onClose={closeModal}>
      <div className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3">
        <Search size={14} className="shrink-0 text-cyan-300" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="输入自然语言查询，如：上次 UI 降噪的方案是什么？"
          className="h-full min-w-0 flex-1 bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-600"
        />
        <kbd className="rounded border border-white/10 bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
          Enter
        </kbd>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {VIEWS.map((view) => (
          <button
            key={view.id}
            type="button"
            onClick={() => {
              setActiveView(view.id);
              closeModal();
            }}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] text-slate-400 hover:border-cyan-500/30 hover:text-cyan-200"
          >
            <span>{view.icon}</span>
            <span>{view.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-1.5">
        {busy && <div className="text-[10px] text-slate-500">搜索中...</div>}
        {!busy && query.trim() && results.length === 0 && (
          <div className="py-6 text-center text-[11px] text-slate-600">没有匹配的知识</div>
        )}
        {results.map((result) => (
          <button
            key={result.id}
            type="button"
            onClick={() => open(result)}
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left transition-colors hover:border-cyan-500/30 hover:bg-cyan-500/[0.06]"
          >
            <span className="block truncate text-xs text-slate-200">
              {result.content.split('\n')[0] || result.id}
            </span>
            <span className="mt-1 flex items-center gap-2 text-[9px] text-slate-500">
              <span>{result.sourceKind === 'file' ? '📄 文档' : '💡 闪念'}</span>
              {typeof result.vectorScore === 'number' && result.vectorScore > 0 && (
                <span>vector {result.vectorScore.toFixed(2)}</span>
              )}
              {result.sourceFile && <span className="truncate">{result.sourceFile}</span>}
            </span>
          </button>
        ))}
      </div>
    </ModalShell>
  );
}

function ShortcutsModal() {
  const closeModal = usePrismModals((s) => s.closeModal);
  const shortcuts: [string, string][] = [
    ['⌘K', '全局语义搜索'],
    ['# / @', '挂载记忆 / 呼出专家'],
    ['⌘Enter', 'Agency 圆桌秒级发送'],
    ['j / k / c / v', '交付终端极客流'],
    ['n', '快速新建任务'],
    ['Esc', '关闭当前弹窗'],
  ];
  return (
    <ModalShell title="全局极客快捷键" onClose={closeModal}>
      <div className="space-y-2">
        {shortcuts.map(([keys, desc]) => (
          <div
            key={keys}
            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
          >
            <span className="font-mono text-[11px] text-cyan-300">{keys}</span>
            <span className="text-[11px] text-slate-400">{desc}</span>
          </div>
        ))}
      </div>
    </ModalShell>
  );
}

function buildCliPrompt(
  specPath: string,
  tasks: string[],
  attached: string[],
  promptOverride?: string,
): string {
  if (promptOverride) return promptOverride;
  const attachedText = attached.length > 0 ? `，并参考关联知识 ${attached.join('、')}` : '';
  const taskText = tasks.length > 0 ? `实现任务: ${tasks.join('、')}` : '执行交付任务';
  const specText = specPath
    ? `请读取 ${specPath}`
    : '当前项目尚未生成旅程文档，请先阅读项目内已有文档';
  return `${specText}${attachedText}，${taskText}`;
}

function CliModal() {
  const payload = usePrismModals((s) => (s.modal?.kind === 'cli' ? s.modal.payload : null));
  const cliKind = usePrismModals((s) => s.cliKind);
  const setCliKind = usePrismModals((s) => s.setCliKind);
  const detectedCliTools = usePrismModals((s) => s.detectedCliTools);
  const refreshCliTools = usePrismModals((s) => s.refreshCliTools);
  const attachedPaths = usePrismModals((s) => s.attachedPaths);
  const closeModal = usePrismModals((s) => s.closeModal);
  const vibePath = useWorkbenchStore((s) => s.vibeContext?.path ?? '');
  const delivery = useDeliverySnapshot();
  const activeCli = delivery.activeCli;
  const logs = useMemo(() => activeCli?.logs ?? [], [activeCli]);
  const running = activeCli?.running ?? false;
  const exitCode = activeCli?.exitCode ?? null;
  const logEndRef = useRef<HTMLDivElement>(null);

  const specPath = payload?.specPath ?? '';
  const tasks = payload?.tasks ?? [];
  const prompt = buildCliPrompt(specPath, tasks, attachedPaths, payload?.prompt);
  const command = cliKind;
  const commandText = `${command} "${prompt}"`;
  const detected = detectedCliTools.filter((tool) => tool.detected);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: 'end' });
  }, [logs]);

  useEffect(() => {
    void refreshCliTools();
  }, [refreshCliTools]);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(commandText);
    } catch {
      /* clipboard may be unavailable in browser fallback */
    }
  }, [commandText]);

  const run = useCallback(async () => {
    await deliveryOrchestrator.startCli({
      projectPath: vibePath,
      command,
      args: [prompt],
      prompt,
    });
  }, [vibePath, command, prompt]);

  return (
    <ModalShell title="本地 CLI 派发" onClose={closeModal}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] text-slate-500">当前本地 CLI:</span>
        {detected.map((tool) => (
          <button
            key={tool.bin}
            type="button"
            data-cli-kind={tool.bin}
            onClick={() => setCliKind(tool.bin)}
            className={`rounded-lg border px-2 py-1 text-[10px] ${
              cliKind === tool.bin
                ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
                : 'border-white/10 bg-white/[0.03] text-slate-500 hover:text-slate-300'
            }`}
          >
            {CLI_LABELS[tool.bin]?.emoji ?? '🟢'} {CLI_LABELS[tool.bin]?.label ?? tool.bin}
          </button>
        ))}
        <button
          type="button"
          data-cli-refresh
          onClick={() => void refreshCliTools()}
          className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] text-slate-400 hover:text-slate-200"
        >
          刷新探测
        </button>
      </div>
      {detected.length === 0 && (
        <div className="mt-2 text-[10px] text-amber-300/90">
          未检测到可用的本地 CLI，请安装 claude / aider / codex / gemini / opencode / qwen / cursor
          / windsurf 后刷新。
        </div>
      )}

      <div className="mt-3 break-words rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-[11px] text-cyan-200">
        {commandText}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => void copy()}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-[10px] text-slate-300 hover:border-cyan-500/30 hover:text-cyan-200"
        >
          <Copy size={12} />
          复制指令
        </button>
        <button
          type="button"
          data-cli-run
          onClick={() => void run()}
          disabled={running}
          className="cool-btn-primary flex h-8 items-center gap-1.5 rounded-lg px-3 text-[10px] font-semibold disabled:opacity-60"
        >
          <Play size={12} />
          {running ? '运行中...' : '运行'}
        </button>
        {exitCode !== null && (
          <span
            data-cli-exit-code={exitCode}
            className={`text-[10px] ${exitCode === 0 ? 'text-emerald-400' : 'text-rose-400'}`}
          >
            exit {exitCode}
          </span>
        )}
      </div>

      {logs.length > 0 && (
        <div
          data-cli-terminal
          className="mt-3 max-h-56 space-y-1 overflow-y-auto break-words rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-[10px] text-slate-300"
        >
          {logs.map((line, idx) => (
            <div
              key={`${line.runId}-${idx}`}
              className={line.stream === 'stderr' ? 'text-rose-400' : ''}
            >
              {line.line}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      )}
    </ModalShell>
  );
}

function AttachModal() {
  const payload = usePrismModals((s) => (s.modal?.kind === 'attach' ? s.modal.payload : null));
  const attachedPaths = usePrismModals((s) => s.attachedPaths);
  const setAttachedPaths = usePrismModals((s) => s.setAttachedPaths);
  const closeModal = usePrismModals((s) => s.closeModal);
  const [cards, setCards] = useState<db.Thought[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let disposed = false;
    void db
      .listThoughts()
      .then((all) => {
        if (!disposed) setCards(all.filter((t) => t.type === 'note' || t.type === 'doc'));
      })
      .catch(() => {});
    return () => {
      disposed = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter(
      (card) => card.content.toLowerCase().includes(q) || card.tags.toLowerCase().includes(q),
    );
  }, [cards, query]);

  const attach = useCallback(
    (card: db.Thought) => {
      void db.recordThoughtReference(card.id).catch(() => {});
      const path = card.id;
      setAttachedPaths(attachedPaths.includes(path) ? attachedPaths : [...attachedPaths, path]);
    },
    [attachedPaths, setAttachedPaths],
  );

  return (
    <ModalShell title="📎 为任务关联知识卡片" onClose={closeModal}>
      <div className="mb-2 text-[11px] text-slate-400">
        {payload?.taskTitle ? `任务: ${payload.taskTitle}` : '选择一个任务后关联'}
      </div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="输入搜索词..."
        className="h-9 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-[11px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-500/40"
      />
      <div className="mt-3 grid gap-1.5">
        {filtered.slice(0, 20).map((card) => {
          const attached = attachedPaths.includes(card.id);
          return (
            <button
              key={card.id}
              type="button"
              data-attach-knowledge-option={card.id}
              onClick={() => attach(card)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left ${
                attached
                  ? 'border-cyan-500/40 bg-cyan-500/10'
                  : 'border-white/10 bg-white/[0.03] hover:border-white/20'
              }`}
            >
              <span className="text-[10px]">{attached ? '✓' : '选择 ➔'}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] text-slate-200">
                  {card.content.split('\n')[0] || card.id}
                </span>
                <span className="block truncate text-[9px] text-slate-500">{card.tags}</span>
              </span>
            </button>
          );
        })}
      </div>
      {attachedPaths.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[9px] text-slate-500">已关联:</span>
          {attachedPaths.map((path) => (
            <span
              key={path}
              data-attach-linked
              className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] text-cyan-300"
            >
              {path}
            </span>
          ))}
        </div>
      )}
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          data-attach-done
          onClick={closeModal}
          className="cool-btn-primary h-8 rounded-lg px-4 text-[10px] font-semibold"
        >
          完成关联
        </button>
      </div>
    </ModalShell>
  );
}

export default function PrismModals() {
  const modal = usePrismModals((s) => s.modal);
  const closeModal = usePrismModals((s) => s.closeModal);
  const openSearch = usePrismModals((s) => s.openSearch);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (modal) closeModal();
        else openSearch();
      } else if (e.key === 'Escape' && modal) {
        closeModal();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal, closeModal, openSearch]);

  if (!modal) return null;
  if (modal.kind === 'search') return <SearchModal />;
  if (modal.kind === 'shortcuts') return <ShortcutsModal />;
  if (modal.kind === 'cli') return <CliModal />;
  if (modal.kind === 'attach') return <AttachModal />;
  return null;
}
