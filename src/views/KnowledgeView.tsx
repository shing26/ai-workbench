import { BookOpen, Clock, FolderOpen, Plus, RefreshCw, Save, Search, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import * as db from '../lib/db';
import { loadRecapDraft, markRecapDraftSaved, type RecapDraft } from '../lib/recapDraft';
import { useWorkbenchStore } from '../stores/workbenchStore';
import BentoCard from '../components/ui/BentoCard';
import ModelBadge from '../components/ui/ModelBadge';

export default function KnowledgeView() {
  const thoughts = useWorkbenchStore((s) => s.thoughts);
  const addThought = useWorkbenchStore((s) => s.addThought);
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('#work');
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<db.RagSearchResult[] | null>(null);
  const [crossFileFilter, setCrossFileFilter] = useState<string[] | null>(null);
  const [indexStatus, setIndexStatus] = useState<db.RagIndexStatus | null>(null);
  const [vaultPath, setVaultPath] = useState('');
  const [ignorePatterns, setIgnorePatterns] = useState('');
  const [indexConcurrency, setIndexConcurrency] = useState('4');
  const [useAutoConcurrency, setUseAutoConcurrency] = useState(false);
  const [indexPriority, setIndexPriority] = useState('0');
  const [recommendedConcurrency, setRecommendedConcurrency] = useState(4);
  const [vaultStatus, setVaultStatus] = useState<db.KnowledgeIndexStatus | null>(null);
  const [watchStatus, setWatchStatus] = useState<db.VaultWatchStatus | null>(null);
  const [vaultTargets, setVaultTargets] = useState<db.VaultWatchTarget[]>([]);
  const [targetStats, setTargetStats] = useState<db.VaultTargetStats[]>([]);
  const [watchEvents, setWatchEvents] = useState<db.VaultWatchEvent[]>([]);
  const [knowledgeDocs, setKnowledgeDocs] = useState<db.KnowledgeFileRecord[]>([]);
  const [docVaultFilter, setDocVaultFilter] = useState('all');
  const [cleanResult, setCleanResult] = useState<db.KnowledgeCleanupResult | null>(null);
  const [docAutoConfig, setDocAutoConfig] = useState<db.DocHealthAutoConfig | null>(null);
  const [docAutoInterval, setDocAutoInterval] = useState('60');
  const [docAutoRunning, setDocAutoRunning] = useState(false);
  const [docHealthHistory, setDocHealthHistory] = useState<db.DocHealthRunRecord[]>([]);
  const [docHealthAlertDismissedAt, setDocHealthAlertDismissedAt] = useState(0);
  const [expandedTimeline, setExpandedTimeline] = useState<string | null>(null);
  const [lastIgnored, setLastIgnored] = useState(0);
  const [lastConcurrencyUsed, setLastConcurrencyUsed] = useState(0);
  const [indexProgress, setIndexProgress] = useState<db.IndexProgress | null>(null);
  const [indexQueueStatus, setIndexQueueStatus] = useState<db.VaultIndexQueueStatus | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [recapDraft, setRecapDraft] = useState<RecapDraft | null>(() => loadRecapDraft());

  const loadWatchEvents = useCallback(async (vaultPath?: string) => {
    setWatchEvents(await db.listVaultWatchEvents(vaultPath, 50));
  }, []);

  const loadDocs = useCallback(async (vaultPath?: string) => {
    setKnowledgeDocs(await db.listKnowledgeFiles(vaultPath, 100));
  }, []);

  const loadTargets = useCallback(async () => {
    setVaultTargets(await db.listVaultWatchTargets());
    setWatchStatus(await db.getVaultWatchStatus());
    setTargetStats(await db.listVaultTargetStats());
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    void db.getRagIndexStatus().then(setIndexStatus);
  }, [thoughts.length]);

  useEffect(() => {
    void db.getKnowledgeIndexStatus().then(setVaultStatus);
    void db.recommendIndexConcurrency().then((r) => setRecommendedConcurrency(r.recommended));
  }, []);

  useEffect(() => {
    void db.getVaultWatchStatus().then(setWatchStatus);
    void db.listVaultWatchTargets().then(setVaultTargets);
    void db.listVaultTargetStats().then(setTargetStats);
    void loadDocs();
    void loadWatchEvents();
  }, [loadDocs, loadWatchEvents]);

  useEffect(() => {
    let disposed = false;
    void db.getDocHealthAutoConfig().then((config) => {
      if (disposed) return;
      setDocAutoConfig(config);
      setDocAutoInterval(String(Math.max(1, Math.round(config.intervalMs / 60_000))));
    });
    void db.getDocHealthRunHistory().then((history) => {
      if (!disposed) setDocHealthHistory(history);
    });
    void db.getDocHealthAlertDismissedAt().then((timestamp) => {
      if (!disposed) setDocHealthAlertDismissedAt(timestamp);
    });
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    void (async () => {
      const config = await db.getVaultWatchConfig();
      if (disposed) return;
      if (config.path) setVaultPath(config.path);
      if (config.ignorePatterns.length > 0) {
        setIgnorePatterns(config.ignorePatterns.join(', '));
      }
      if (config.enabled && config.path) {
        const status = await db.getVaultWatchStatus();
        if (!disposed && !status.watching) {
          setWatchStatus(await db.startVaultWatch(config.path, config.ignorePatterns));
        }
      }
    })();
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlisten = () => {};
    void db
      .listenVaultWatchUpdated((status) => {
        if (disposed) return;
        setWatchStatus(status);
        void loadWatchEvents();
        void loadDocs(docVaultFilter === 'all' ? undefined : docVaultFilter);
        void db.getKnowledgeIndexStatus().then((next) => {
          if (!disposed) setVaultStatus(next);
        });
        void db.getRagIndexStatus().then((next) => {
          if (!disposed) setIndexStatus(next);
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
  }, [docVaultFilter, loadDocs, loadWatchEvents]);

  useEffect(() => {
    let disposed = false;
    let unlisten = () => {};
    void db
      .listenVaultIndexProgress((progress) => {
        if (disposed) return;
        setIndexProgress(progress);
        if (progress.status === 'done') {
          setLastIgnored(progress.ignored);
          setLastConcurrencyUsed(progress.concurrencyUsed);
          void loadTargets();
          void loadDocs(docVaultFilter === 'all' ? undefined : docVaultFilter);
          void db.getKnowledgeIndexStatus().then(setVaultStatus);
          void db.getRagIndexStatus().then(setIndexStatus);
        }
      })
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      });
    return () => {
      disposed = true;
      unlisten();
    };
  }, [docVaultFilter, loadDocs, loadTargets]);

  useEffect(() => {
    let disposed = false;
    let unlisten = () => {};
    void db.getVaultIndexQueueStatus().then((status) => {
      if (!disposed) setIndexQueueStatus(status);
    });
    void db
      .listenVaultIndexQueue((status) => {
        if (disposed) return;
        setIndexQueueStatus(status);
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

  const allTags = Array.from(
    new Set(
      thoughts.flatMap((t) =>
        t.tags
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
      ),
    ),
  );
  const filtered = filter === 'all' ? thoughts : thoughts.filter((t) => t.tags.includes(filter));
  const docFiles = results
    ? Array.from(new Set(results.filter((r) => r.type === 'doc').map((r) => r.id)))
    : [];
  const docFileCounts = results
    ? results.reduce<Record<string, number>>((acc, r) => {
        if (r.type === 'doc') acc[r.id] = (acc[r.id] ?? 0) + 1;
        return acc;
      }, {})
    : {};
  const filteredResults =
    results && crossFileFilter && crossFileFilter.length < docFiles.length
      ? results.filter((r) => r.type !== 'doc' || crossFileFilter.includes(r.id))
      : results;
  const visibleThoughts = filteredResults ?? filtered;
  const selected = visibleThoughts.find((t) => t.id === selectedId) ?? visibleThoughts[0] ?? null;

  const add = async () => {
    if (!content.trim()) return;
    await addThought(content.trim(), tags, 'inbox');
    setContent('');
  };

  const saveRecapDraftNote = async () => {
    if (!recapDraft || recapDraft.saved) return;
    await addThought(
      `# 今日复盘 ${recapDraft.date}\n\n${recapDraft.content}`,
      '#daily,#recap',
      'note',
    );
    setRecapDraft(markRecapDraftSaved(recapDraft));
  };

  const runSearch = async () => {
    if (!query.trim()) {
      setResults(null);
      return;
    }
    setCrossFileFilter(null);
    setResults(await db.searchThoughts(query.trim(), 5));
  };

  const toggleCrossFile = (path: string) => {
    setCrossFileFilter((prev) => {
      const current = prev ?? docFiles;
      return current.includes(path) ? current.filter((file) => file !== path) : [...current, path];
    });
  };

  const parseIgnore = () =>
    ignorePatterns
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

  const runIndex = async () => {
    if (!vaultPath.trim()) return;
    const concurrency = useAutoConcurrency
      ? 0
      : Math.max(1, Math.min(16, Number(indexConcurrency) || 4));
    const priority = indexPriority === '1' ? 1 : 0;
    const runId = await db.startVaultIndex(vaultPath.trim(), parseIgnore(), concurrency, priority);
    setIndexProgress({
      runId,
      path: vaultPath.trim(),
      done: 0,
      total: 0,
      files: 0,
      ignored: 0,
      concurrencyUsed: 0,
      status: 'running',
    });
    void db.getVaultIndexQueueStatus().then(setIndexQueueStatus);
    await db.upsertVaultWatchTarget({
      path: vaultPath.trim(),
      ignorePatterns: parseIgnore(),
      enabled: watchStatus?.paths?.includes(vaultPath.trim()) ?? false,
      updatedAt: Date.now(),
      lastEventAt: 0,
      eventCount: 0,
      createdEvents: 0,
      modifiedEvents: 0,
      removedEvents: 0,
    });
  };

  const changeDocVaultFilter = (vaultPath: string) => {
    setDocVaultFilter(vaultPath);
    void loadDocs(vaultPath === 'all' ? undefined : vaultPath);
  };

  const cleanDocs = async () => {
    const ranAt = Date.now();
    const result = await db.cleanupKnowledgeFiles(
      docVaultFilter === 'all' ? undefined : docVaultFilter,
    );
    setCleanResult(result);
    setDocHealthHistory(
      await db.appendDocHealthRun({
        ranAt,
        removed: result.removed,
        reindexed: result.reindexed,
        failed: result.failed,
        triggeredBy: 'manual',
        alert: result.removed + result.reindexed + result.failed > 0,
      }),
    );
    void loadDocs(docVaultFilter === 'all' ? undefined : docVaultFilter);
    void loadTargets();
    void db.getKnowledgeIndexStatus().then(setVaultStatus);
    void db.getRagIndexStatus().then(setIndexStatus);
  };

  const runDocHealthAutoInspect = useCallback(
    async (config: db.DocHealthAutoConfig) => {
      setDocAutoRunning(true);
      try {
        const ranAt = Date.now();
        const result = await db.cleanupKnowledgeFiles(
          docVaultFilter === 'all' ? undefined : docVaultFilter,
        );
        const next: db.DocHealthAutoConfig = {
          ...config,
          lastRunAt: ranAt,
          lastResult: result,
        };
        setDocAutoConfig(next);
        await db.setDocHealthAutoConfig(next);
        setDocHealthHistory(
          await db.appendDocHealthRun({
            ranAt,
            removed: result.removed,
            reindexed: result.reindexed,
            failed: result.failed,
            triggeredBy: 'auto',
            alert: result.removed + result.reindexed + result.failed > 0,
          }),
        );
        await loadDocs(docVaultFilter === 'all' ? undefined : docVaultFilter);
        await loadTargets();
        setVaultStatus(await db.getKnowledgeIndexStatus());
        setIndexStatus(await db.getRagIndexStatus());
      } finally {
        setDocAutoRunning(false);
      }
    },
    [docVaultFilter, loadDocs, loadTargets],
  );

  const dismissDocHealthAlert = async () => {
    if (!docHealthAlert) return;
    await db.setDocHealthAlertDismissedAt(docHealthAlert.ranAt);
    setDocHealthAlertDismissedAt(docHealthAlert.ranAt);
  };

  const toggleDocAuto = async () => {
    const current = docAutoConfig ?? {
      enabled: false,
      intervalMs: 60 * 60 * 1000,
      lastRunAt: 0,
      lastResult: null,
    };
    const next: db.DocHealthAutoConfig = {
      ...current,
      enabled: !current.enabled,
      intervalMs: Number(docAutoInterval) * 60 * 1000,
    };
    setDocAutoConfig(next);
    await db.setDocHealthAutoConfig(next);
    if (next.enabled) {
      await runDocHealthAutoInspect(next);
    }
  };

  const changeDocAutoInterval = (value: string) => {
    setDocAutoInterval(value);
    if (!docAutoConfig?.enabled) return;
    const next: db.DocHealthAutoConfig = {
      ...docAutoConfig,
      intervalMs: Number(value) * 60 * 1000,
    };
    setDocAutoConfig(next);
    void db.setDocHealthAutoConfig(next);
  };

  useEffect(() => {
    if (!docAutoConfig?.enabled) return;
    const intervalMs = Math.max(docAutoConfig.intervalMs, 10_000);
    const timer = window.setInterval(() => {
      void db.getDocHealthAutoConfig().then((latest) => {
        if (latest.enabled) void runDocHealthAutoInspect(latest);
      });
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [docAutoConfig?.enabled, docAutoConfig?.intervalMs, runDocHealthAutoInspect]);

  const toggleWatch = async () => {
    const currentWatching =
      watchStatus?.paths?.includes(vaultPath.trim()) ?? watchStatus?.watching ?? false;
    if (!vaultPath.trim() && !currentWatching) return;
    const next = currentWatching
      ? await db.stopVaultWatch(vaultPath.trim() || undefined)
      : await db.startVaultWatch(vaultPath.trim(), parseIgnore());
    setWatchStatus(next);
    await loadTargets();
    await loadWatchEvents();
    await loadDocs(docVaultFilter === 'all' ? undefined : docVaultFilter);
    setVaultStatus(await db.getKnowledgeIndexStatus());
    setIndexStatus(await db.getRagIndexStatus());
  };

  const toggleTargetWatch = async (target: db.VaultWatchTarget) => {
    const active = watchStatus?.paths?.includes(target.path) ?? target.enabled;
    const next = active
      ? await db.stopVaultWatch(target.path)
      : await db.startVaultWatch(target.path, target.ignorePatterns);
    setWatchStatus(next);
    await loadTargets();
    await loadWatchEvents();
    await loadDocs(docVaultFilter === 'all' ? undefined : docVaultFilter);
    setVaultStatus(await db.getKnowledgeIndexStatus());
    setIndexStatus(await db.getRagIndexStatus());
  };

  const removeTarget = async (target: db.VaultWatchTarget) => {
    await db.deleteVaultWatchTarget(target.path);
    await loadTargets();
    await loadWatchEvents();
    await loadDocs(docVaultFilter === 'all' ? undefined : docVaultFilter);
    if (expandedTimeline === target.path) setExpandedTimeline(null);
    setVaultStatus(await db.getKnowledgeIndexStatus());
    setIndexStatus(await db.getRagIndexStatus());
  };

  const clearTargetEvents = async (target: db.VaultWatchTarget) => {
    await db.clearVaultWatchEvents(target.path);
    await loadWatchEvents();
  };

  const currentWatching =
    watchStatus?.paths?.includes(vaultPath.trim()) ?? watchStatus?.watching ?? false;
  const missingDocCount = knowledgeDocs.filter((doc) => !doc.exists).length;
  const staleDocCount = knowledgeDocs.filter((doc) => doc.exists && doc.stale).length;
  const latestAutoRun = docHealthHistory.find((record) => record.triggeredBy === 'auto');
  const docHealthAlert =
    latestAutoRun && latestAutoRun.alert && latestAutoRun.ranAt > docHealthAlertDismissedAt
      ? latestAutoRun
      : null;

  return (
    <div className="view-enter flex h-full flex-col gap-4 p-4">
      <BentoCard title="Thought Inbox" subtitle="Command+N 闪念速记" icon={BookOpen} colSpan={12}>
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void add();
              }
            }}
            rows={2}
            placeholder="Capture a thought..."
            className="min-h-0 flex-1 resize-none rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-200 outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
          />
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="h-9 w-28 rounded-xl border border-white/10 bg-white/[0.03] px-2 text-[11px] text-slate-300 outline-none"
            placeholder="#tags"
          />
          <button
            type="button"
            onClick={() => void add()}
            className="flex h-9 items-center gap-1 rounded-xl bg-emerald-500/20 px-3 text-xs text-emerald-400 hover:bg-emerald-500/30"
          >
            <Plus size={14} /> Add
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-knowledge-recap-save
            onClick={() => void saveRecapDraftNote()}
            disabled={!recapDraft || recapDraft.saved}
            className="flex h-7 items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 text-[10px] text-emerald-300 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size={11} />
            {!recapDraft ? '暂无复盘草稿' : recapDraft.saved ? '复盘已保存' : '保存最近复盘'}
          </button>
          <span data-knowledge-recap-status className="text-[9px] text-slate-500">
            {recapDraft
              ? `${recapDraft.date} · ${recapDraft.saved ? 'saved' : 'draft'}`
              : '完成 AI Studio 今日复盘后可一键存档'}
          </span>
        </div>
      </BentoCard>

      <BentoCard
        title="Vault Index"
        subtitle="Obsidian / Markdown 文件夹纳入 RAG"
        icon={FolderOpen}
        colSpan={12}
      >
        <div className="flex items-end gap-2">
          <input
            value={vaultPath}
            onChange={(e) => setVaultPath(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void runIndex();
              }
            }}
            placeholder="Vault path..."
            className="h-9 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs text-slate-200 outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
          />
          <select
            data-index-priority
            value={indexPriority}
            onChange={(e) => setIndexPriority(e.target.value)}
            className="h-9 rounded-xl border border-white/10 bg-white/[0.03] px-2 text-[11px] text-slate-300 outline-none focus:border-emerald-500/40"
          >
            <option value="0">Normal priority</option>
            <option value="1">High priority</option>
          </select>
          <button
            type="button"
            onClick={() => void runIndex()}
            data-accent-token="index-vault"
            className="flex h-9 items-center rounded-xl accent-bg-20 px-3 text-xs accent-text-strong accent-hover-bg-30"
          >
            Index vault
          </button>
          <button
            type="button"
            onClick={() => void toggleWatch()}
            data-vault-watch={currentWatching ? 'on' : 'off'}
            className="flex h-9 items-center gap-1 rounded-xl bg-emerald-500/20 px-3 text-xs text-emerald-400 hover:bg-emerald-500/30"
          >
            <RefreshCw size={14} className={currentWatching ? 'animate-spin' : ''} />
            {currentWatching ? 'Stop watch' : 'Watch vault'}
          </button>
          <span data-vault-watch-status={currentWatching ? 'on' : 'off'}>
            <ModelBadge
              label="Watch"
              tone="green"
              status={currentWatching ? 'watching' : 'off'}
              pulse={currentWatching}
            />
          </span>
          <span data-vault-watch-count={watchStatus?.paths?.length ?? 0}>
            <ModelBadge
              label="Active"
              tone="green"
              status={`${watchStatus?.paths?.length ?? 0} vault(s)`}
            />
          </span>
          <span data-vault-files={vaultStatus?.files ?? 0}>
            <ModelBadge
              label="Vault"
              tone="blue"
              status={vaultStatus ? `${vaultStatus.files} files` : 'pending'}
            />
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            value={useAutoConcurrency ? String(recommendedConcurrency) : indexConcurrency}
            onChange={(e) => setIndexConcurrency(e.target.value)}
            type="number"
            min={1}
            max={16}
            disabled={useAutoConcurrency}
            aria-label="Index concurrency"
            data-index-concurrency={
              useAutoConcurrency ? String(recommendedConcurrency) : indexConcurrency
            }
            placeholder="Threads"
            className="h-8 w-20 shrink-0 rounded-xl border border-white/10 bg-white/[0.03] px-2 text-[11px] text-slate-300 outline-none focus:border-emerald-500/40 placeholder:text-slate-600 disabled:opacity-50"
          />
          <button
            type="button"
            aria-label="Auto index concurrency"
            aria-pressed={useAutoConcurrency}
            data-index-concurrency-auto={useAutoConcurrency ? 'on' : 'off'}
            data-recommended-concurrency={recommendedConcurrency}
            onClick={() => setUseAutoConcurrency((value) => !value)}
            className={`flex h-8 items-center rounded-lg px-2 text-[10px] ${
              useAutoConcurrency
                ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            Auto
          </button>
          <input
            value={ignorePatterns}
            onChange={(e) => setIgnorePatterns(e.target.value)}
            placeholder="Ignore patterns (comma separated)"
            className="h-8 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-[11px] text-slate-300 outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
          />
          <span
            data-vault-ignored={lastIgnored}
            className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] ${
              lastIgnored > 0
                ? 'border-amber-500/25 bg-amber-500/10 text-amber-300'
                : 'border-white/10 bg-white/[0.04] text-slate-500'
            }`}
          >
            Skipped {lastIgnored}
          </span>
          <span
            data-index-result-workers={lastConcurrencyUsed}
            className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-400"
          >
            {lastConcurrencyUsed > 0 ? `${lastConcurrencyUsed} workers` : 'auto pending'}
          </span>
        </div>
        {indexProgress &&
          (() => {
            const percent =
              indexProgress.total > 0
                ? Math.round((indexProgress.done / indexProgress.total) * 100)
                : indexProgress.status === 'done'
                  ? 100
                  : 0;
            return (
              <div data-index-progress={percent} className="mt-2 flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full accent-bg" style={{ width: `${percent}%` }} />
                </div>
                <span data-index-progress-status className="shrink-0 text-[9px] text-slate-500">
                  {indexProgress.status === 'done'
                    ? `Indexed ${indexProgress.files} files`
                    : indexProgress.status === 'running'
                      ? `Indexing ${indexProgress.done}/${indexProgress.total}`
                      : indexProgress.status === 'queued'
                        ? 'Queued behind active index'
                        : indexProgress.status === 'cancelled'
                          ? 'Cancelled'
                          : indexProgress.status}
                </span>
                {(indexProgress.status === 'running' || indexProgress.status === 'queued') && (
                  <button
                    type="button"
                    data-index-cancel
                    aria-label="Cancel vault index"
                    onClick={() => void db.cancelVaultIndex(indexProgress.runId)}
                    className="h-5 shrink-0 rounded-md border border-red-500/25 bg-red-500/10 px-2 text-[9px] text-red-300 hover:bg-red-500/20"
                  >
                    Cancel
                  </button>
                )}
              </div>
            );
          })()}
        {indexQueueStatus && (indexQueueStatus.active || indexQueueStatus.queue.length > 0) && (
          <div data-vault-index-queue className="mt-2 flex flex-wrap items-center gap-1.5">
            {indexQueueStatus.active && (
              <span
                data-vault-index-queue-active={indexQueueStatus.active.path}
                data-vault-index-queue-active-priority={indexQueueStatus.active.priority}
                data-vault-index-queue-active-attempts={indexQueueStatus.active.attempts}
                data-vault-index-queue-active-retry-delay={indexQueueStatus.active.retryDelayMs}
                className="flex max-w-[240px] items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[9px] text-slate-400"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full accent-bg" />
                <span className="truncate">{indexQueueStatus.active.path}</span>
                <span className="shrink-0 rounded bg-white/[0.04] px-1 text-[8px] text-slate-500">
                  {indexQueueStatus.active.priority === 1 ? 'high' : 'normal'}
                  {indexQueueStatus.active.attempts > 0
                    ? ` retry ${indexQueueStatus.active.attempts} · ${indexQueueStatus.active.retryDelayMs}ms`
                    : ''}
                </span>
              </span>
            )}
            {indexQueueStatus.queue.length > 0 && (
              <span
                data-vault-index-queue-count={indexQueueStatus.queue.length}
                className="shrink-0 rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[9px] text-amber-300"
              >
                {indexQueueStatus.queue.length} queued
              </span>
            )}
            {indexQueueStatus.queue.map((entry) => (
              <span
                key={entry.runId}
                data-vault-index-queued-path={entry.path}
                data-vault-index-queue-priority={entry.priority}
                data-vault-index-queue-attempts={entry.attempts}
                data-vault-index-queue-retry-delay={entry.retryDelayMs}
                className="max-w-[180px] truncate rounded-md bg-white/[0.04] px-2 py-1 text-[9px] text-slate-500"
              >
                {entry.path}
                {entry.attempts > 0 ? ` (retry ${entry.attempts} · ${entry.retryDelayMs}ms)` : ''}
              </span>
            ))}
          </div>
        )}
        {vaultTargets.length > 0 && (
          <div data-vault-target-list className="mt-3 space-y-1.5">
            {vaultTargets.map((target) => {
              const targetWatching = watchStatus?.paths?.includes(target.path) ?? target.enabled;
              const targetStat = targetStats.find((stat) => stat.path === target.path);
              const targetFileCount = targetStat?.files ?? 0;
              return (
                <div
                  key={target.path}
                  data-vault-target
                  data-vault-target-path={target.path}
                  data-vault-target-watch={targetWatching ? 'on' : 'off'}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
                >
                  <span className="min-w-0 flex-1 truncate text-[10px] text-slate-300">
                    {target.path}
                  </span>
                  <span
                    data-vault-target-files={targetFileCount}
                    className="rounded-md bg-white/5 px-1.5 py-0.5 text-[9px] text-slate-500"
                  >
                    {targetFileCount} files
                  </span>
                  <span
                    data-vault-target-events={target.eventCount ?? 0}
                    className="rounded-md bg-white/5 px-1.5 py-0.5 text-[9px] text-slate-500"
                  >
                    {target.eventCount ?? 0} events
                  </span>
                  <span
                    data-vault-created={targetStat?.createdEvents ?? 0}
                    className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[9px] text-emerald-400"
                  >
                    +{targetStat?.createdEvents ?? 0}
                  </span>
                  <span
                    data-vault-modified={targetStat?.modifiedEvents ?? 0}
                    className="rounded-md bg-sky-500/10 px-1.5 py-0.5 text-[9px] text-sky-400"
                  >
                    ~{targetStat?.modifiedEvents ?? 0}
                  </span>
                  <span
                    data-vault-removed={targetStat?.removedEvents ?? 0}
                    className="rounded-md bg-rose-500/10 px-1.5 py-0.5 text-[9px] text-rose-400"
                  >
                    -{targetStat?.removedEvents ?? 0}
                  </span>
                  {target.ignorePatterns.length > 0 && (
                    <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[9px] text-slate-500">
                      {target.ignorePatterns.length} pattern(s)
                    </span>
                  )}
                  <button
                    type="button"
                    data-vault-target-toggle
                    aria-label={`Toggle watch ${target.path}`}
                    onClick={() => void toggleTargetWatch(target)}
                    className={`flex h-6 items-center rounded-md px-2 text-[9px] ${
                      targetWatching
                        ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                        : 'bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {targetWatching ? 'Stop' : 'Watch'}
                  </button>
                  <button
                    type="button"
                    data-vault-target-timeline
                    aria-label={`Timeline ${target.path}`}
                    onClick={() => {
                      if (expandedTimeline === target.path) {
                        setExpandedTimeline(null);
                      } else {
                        setExpandedTimeline(target.path);
                        void loadWatchEvents();
                      }
                    }}
                    className={`flex h-6 items-center gap-1 rounded-md px-2 text-[9px] ${
                      expandedTimeline === target.path
                        ? 'bg-sky-500/15 text-sky-300'
                        : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
                    }`}
                  >
                    <Clock size={11} />
                    Timeline
                  </button>
                  <button
                    type="button"
                    data-vault-target-remove
                    aria-label={`Remove vault ${target.path}`}
                    onClick={() => void removeTarget(target)}
                    className="flex h-6 items-center rounded-md bg-rose-500/10 px-2 text-[9px] text-rose-300 hover:bg-rose-500/20"
                  >
                    <Trash2 size={11} />
                  </button>
                  {expandedTimeline === target.path && (
                    <div
                      data-vault-watch-timeline
                      data-vault-watch-timeline-path={target.path}
                      className="mt-1 w-full space-y-1 rounded-lg border border-white/5 bg-black/20 p-2"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] uppercase tracking-wide text-slate-600">
                          Event timeline
                        </span>
                        <span
                          data-vault-watch-events-count
                          className="rounded-md bg-white/5 px-1.5 py-0.5 text-[9px] text-slate-500"
                        >
                          {watchEvents.filter((event) => event.vaultPath === target.path).length}{' '}
                          events
                        </span>
                        <button
                          type="button"
                          data-vault-watch-events-clear
                          aria-label={`Clear watch timeline ${target.path}`}
                          onClick={() => void clearTargetEvents(target)}
                          className="ml-auto flex h-5 items-center rounded-md bg-rose-500/10 px-1.5 text-[9px] text-rose-300 hover:bg-rose-500/20"
                        >
                          Clear
                        </button>
                      </div>
                      {watchEvents.filter((event) => event.vaultPath === target.path).length ===
                        0 && (
                        <div className="py-1 text-[9px] text-slate-600">No watch events yet</div>
                      )}
                      {watchEvents
                        .filter((event) => event.vaultPath === target.path)
                        .map((event) => (
                          <div
                            key={event.id}
                            data-vault-watch-event
                            data-vault-watch-event-kind={event.eventKind}
                            data-vault-watch-event-path={event.filePath}
                            className="flex items-start gap-1.5 rounded-md bg-white/[0.03] px-1.5 py-1"
                          >
                            <span
                              className={`mt-0.5 shrink-0 text-[10px] font-medium ${
                                event.eventKind === 'created'
                                  ? 'text-emerald-400'
                                  : event.eventKind === 'modified'
                                    ? 'text-sky-400'
                                    : 'text-rose-400'
                              }`}
                            >
                              {event.eventKind === 'created'
                                ? '+'
                                : event.eventKind === 'modified'
                                  ? '~'
                                  : '-'}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[9px] text-slate-400">
                              {event.filePath}
                            </span>
                            <span className="shrink-0 text-[8px] text-slate-600">
                              {new Date(event.createdAt).toLocaleTimeString('zh-CN', {
                                hour12: false,
                              })}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div
          data-knowledge-docs
          className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] p-3"
        >
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-medium text-slate-300">Document status</span>
            <span
              data-knowledge-docs-count
              className="rounded-md bg-white/5 px-1.5 py-0.5 text-[9px] text-slate-500"
            >
              {knowledgeDocs.length} docs
            </span>
            <span
              data-knowledge-docs-missing={missingDocCount}
              className="rounded-md bg-rose-500/10 px-1.5 py-0.5 text-[9px] text-rose-300"
            >
              {missingDocCount} missing
            </span>
            <span
              data-knowledge-docs-stale={staleDocCount}
              className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[9px] text-amber-300"
            >
              {staleDocCount} stale
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                aria-label="Toggle auto doc health inspect"
                data-doc-health-auto={docAutoConfig?.enabled ? 'on' : 'off'}
                onClick={() => void toggleDocAuto()}
                className={`flex h-6 items-center gap-1 rounded-md border px-2 text-[9px] ${
                  docAutoConfig?.enabled
                    ? 'border-emerald-500/25 bg-emerald-500/15 text-emerald-300'
                    : 'border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.06]'
                }`}
              >
                <Clock size={11} className={docAutoRunning ? 'animate-spin' : ''} />
                Auto {docAutoConfig?.enabled ? 'on' : 'off'}
              </button>
              <select
                data-doc-health-auto-interval
                value={docAutoInterval}
                onChange={(e) => changeDocAutoInterval(e.target.value)}
                aria-label="Auto doc health interval"
                className="h-6 rounded-md border border-white/10 bg-white/[0.03] px-1 text-[9px] text-slate-400 outline-none"
              >
                <option value="5">5m</option>
                <option value="15">15m</option>
                <option value="30">30m</option>
                <option value="60">1h</option>
                <option value="360">6h</option>
              </select>
              <select
                data-knowledge-doc-filter
                value={docVaultFilter}
                onChange={(e) => changeDocVaultFilter(e.target.value)}
                aria-label="Document vault filter"
                className="h-6 rounded-md border border-white/10 bg-white/[0.03] px-1 text-[9px] text-slate-400 outline-none"
              >
                <option value="all">All vaults</option>
                {vaultTargets.map((target) => (
                  <option key={target.path} value={target.path}>
                    {target.path}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void cleanDocs()}
                data-knowledge-docs-clean
                className="h-6 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 text-[9px] text-emerald-300 hover:bg-emerald-500/20"
              >
                Clean
              </button>
              {cleanResult && (
                <span
                  data-knowledge-clean-result
                  className="rounded-md bg-white/5 px-1.5 py-0.5 text-[9px] text-slate-400"
                >
                  removed {cleanResult.removed} reindexed {cleanResult.reindexed}
                </span>
              )}
              {docAutoConfig && docAutoConfig.lastRunAt > 0 && (
                <span
                  data-doc-health-last-run={docAutoConfig.lastRunAt}
                  className="rounded-md bg-white/5 px-1.5 py-0.5 text-[9px] text-slate-500"
                >
                  {new Date(docAutoConfig.lastRunAt).toLocaleTimeString('zh-CN', {
                    hour12: false,
                  })}
                </span>
              )}
              {docAutoConfig?.lastResult && (
                <span
                  data-doc-health-result={`removed ${docAutoConfig.lastResult.removed} reindexed ${docAutoConfig.lastResult.reindexed}`}
                  className="rounded-md bg-sky-500/10 px-1.5 py-0.5 text-[9px] text-sky-300"
                >
                  removed {docAutoConfig.lastResult.removed} reindexed{' '}
                  {docAutoConfig.lastResult.reindexed}
                </span>
              )}
            </div>
          </div>
          {docHealthAlert && (
            <div
              data-doc-health-alert
              className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2 py-1.5 text-[9px] text-amber-200"
            >
              <span>
                Auto inspect removed {docHealthAlert.removed}, reindexed {docHealthAlert.reindexed},
                failed {docHealthAlert.failed}
              </span>
              <button
                type="button"
                data-doc-health-dismiss
                onClick={() => void dismissDocHealthAlert()}
                className="rounded-md bg-white/10 px-1.5 py-0.5 text-[8px] text-slate-200 hover:bg-white/20"
              >
                Dismiss
              </button>
            </div>
          )}
          {docHealthHistory.length > 0 && (
            <div data-doc-health-history className="mb-2 flex flex-wrap items-center gap-1.5">
              {docHealthHistory.slice(0, 5).map((record) => (
                <span
                  key={record.id}
                  data-doc-health-run
                  data-doc-health-run-time={record.ranAt}
                  data-doc-health-removed={record.removed}
                  data-doc-health-reindexed={record.reindexed}
                  data-doc-health-failed={record.failed}
                  data-doc-health-triggered={record.triggeredBy}
                  className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[8px] text-slate-500"
                >
                  {new Date(record.ranAt).toLocaleTimeString('zh-CN', { hour12: false })}
                  <span className="ml-1">{record.triggeredBy}</span>
                </span>
              ))}
            </div>
          )}
          <div className="max-h-44 space-y-1 overflow-y-auto">
            {knowledgeDocs.length === 0 && (
              <div className="py-3 text-center text-[9px] text-slate-600">No indexed documents</div>
            )}
            {knowledgeDocs.map((doc) => (
              <div
                key={doc.id}
                data-knowledge-doc
                data-knowledge-doc-vault={doc.vaultPath}
                data-knowledge-doc-path={doc.path}
                data-knowledge-doc-title={doc.title}
                className="flex items-start gap-2 rounded-lg bg-white/[0.03] px-2 py-1.5"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[10px] text-slate-300">
                    {doc.title || doc.path}
                  </span>
                  <span className="block truncate text-[8px] text-slate-600">{doc.path}</span>
                </span>
                <span
                  data-knowledge-doc-status={!doc.exists ? 'missing' : doc.stale ? 'stale' : 'ok'}
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[8px] ${
                    !doc.exists
                      ? 'bg-rose-500/10 text-rose-300'
                      : doc.stale
                        ? 'bg-amber-500/10 text-amber-300'
                        : 'bg-emerald-500/10 text-emerald-300'
                  }`}
                >
                  {!doc.exists ? 'missing' : doc.stale ? 'stale' : 'ok'}
                </span>
                {doc.vaultPath && (
                  <span className="shrink-0 rounded bg-sky-500/10 px-1.5 py-0.5 text-[8px] text-sky-300">
                    {doc.vaultPath}
                  </span>
                )}
                <span className="shrink-0 text-[8px] text-slate-600">
                  {doc.indexedAt > 0 ? new Date(doc.indexedAt).toLocaleDateString('zh-CN') : 'n/a'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </BentoCard>

      <div className="grid min-h-0 flex-1 grid-cols-12 gap-4">
        <div className="col-span-2 flex min-h-0 flex-col gap-2 overflow-y-auto rounded-2xl border border-white/10 bg-[#18181C] p-3 shadow-xl">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`rounded-lg px-2 py-1.5 text-left text-[11px] ${
              filter === 'all'
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'text-slate-400 hover:bg-white/[0.06]'
            }`}
          >
            All
          </button>
          {allTags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFilter(t)}
              className={`rounded-lg px-2 py-1.5 text-left text-[11px] ${
                filter === t
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'text-slate-400 hover:bg-white/[0.06]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="col-span-5 flex min-h-0 flex-col gap-2 overflow-y-auto rounded-2xl border border-white/10 bg-[#18181C] p-3 shadow-xl">
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-2 focus-within:border-emerald-500/40">
              <Search size={12} className="shrink-0 text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void runSearch();
                  }
                }}
                placeholder="RAG search..."
                className="h-8 min-w-0 flex-1 bg-transparent text-[11px] text-slate-200 outline-none placeholder:text-slate-600"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setResults(null);
                  }}
                  className="text-[10px] text-slate-500 hover:text-slate-300"
                >
                  Clear
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => void runSearch()}
              className="flex h-8 items-center rounded-xl bg-emerald-500/20 px-2.5 text-[11px] text-emerald-400 hover:bg-emerald-500/30"
            >
              Search
            </button>
          </div>
          {results && docFiles.length >= 2 && (
            <div
              data-cross-file-hits
              className="flex shrink-0 flex-wrap items-center gap-1.5 rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1.5"
            >
              <span className="text-[9px] text-slate-500">Files</span>
              {docFiles.map((file) => {
                const active = !crossFileFilter || crossFileFilter.includes(file);
                return (
                  <button
                    key={file}
                    type="button"
                    data-cross-file-hit={file}
                    data-cross-file-active={String(active)}
                    onClick={() => toggleCrossFile(file)}
                    className={`rounded-md border px-1.5 py-0.5 text-[9px] transition-colors ${
                      active
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                        : 'border-white/10 bg-white/[0.03] text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {file.split(/[\\/]/).pop() ?? file} · {docFileCounts[file] ?? 0}
                  </button>
                );
              })}
            </div>
          )}
          {results !== null && results.length > 0 && (
            <div className="shrink-0 border-b border-white/10 pb-2 text-[10px] text-slate-500">
              {results.length} RAG matches
            </div>
          )}
          {visibleThoughts.map((t) => (
            <button
              key={t.id}
              type="button"
              data-rag-result
              data-rag-vector-score={
                'vectorScore' in t && typeof t.vectorScore === 'number'
                  ? t.vectorScore.toFixed(2)
                  : ''
              }
              data-rag-file={t.type === 'doc' ? t.id : ''}
              onClick={() => setSelectedId(t.id)}
              className={`rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
                selected?.id === t.id
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                  : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]'
              }`}
            >
              <span className="block truncate">{t.content.split('\n')[0]}</span>
              {'score' in t && typeof t.score === 'number' && (
                <span className="mt-0.5 block text-[10px] text-slate-500">
                  score {t.score.toFixed(2)}
                  {typeof t.vectorScore === 'number' && (
                    <span className="ml-2 text-slate-600">vector {t.vectorScore.toFixed(2)}</span>
                  )}
                </span>
              )}
            </button>
          ))}
          {visibleThoughts.length === 0 && (
            <div className="py-10 text-center text-xs text-slate-600">No thoughts</div>
          )}
        </div>
        <div
          key={selected?.id ?? 'empty'}
          className={`col-span-5 flex min-h-0 flex-col overflow-y-auto rounded-2xl border border-white/10 bg-[#18181C] p-4 shadow-xl ${
            selected ? 'detail-enter' : ''
          }`}
        >
          {selected ? (
            <>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-200">{selected.type}</span>
                <ModelBadge label={selected.tags} tone="green" />
              </div>
              <div className="markdown-body min-h-0 flex-1 overflow-y-auto text-xs leading-relaxed text-slate-300">
                <ReactMarkdown>{selected.content}</ReactMarkdown>
              </div>
            </>
          ) : (
            <div className="py-10 text-center text-xs text-slate-600">Select a thought</div>
          )}
          <div className="mt-auto pt-4">
            <ModelBadge
              label="RAG index"
              tone="blue"
              status={indexStatus?.indexed ? `${indexStatus.documents} docs` : 'pending'}
            />
            <span
              data-vector-status={indexStatus?.vectorIndexed ? 'on' : 'off'}
              className="mt-1.5 inline-block rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[9px] text-slate-500"
            >
              vector {indexStatus?.vectorIndexed ? 'on' : 'off'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
