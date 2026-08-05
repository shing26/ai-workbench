import { BookOpen, Clock, FolderOpen, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import * as db from "../lib/db";
import { useWorkbenchStore } from "../stores/workbenchStore";
import BentoCard from "../components/ui/BentoCard";
import ModelBadge from "../components/ui/ModelBadge";

export default function KnowledgeView() {
  const thoughts = useWorkbenchStore((s) => s.thoughts);
  const addThought = useWorkbenchStore((s) => s.addThought);
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("#work");
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<db.RagSearchResult[] | null>(null);
  const [indexStatus, setIndexStatus] = useState<db.RagIndexStatus | null>(null);
  const [vaultPath, setVaultPath] = useState("");
  const [ignorePatterns, setIgnorePatterns] = useState("");
  const [indexConcurrency, setIndexConcurrency] = useState("4");
  const [useAutoConcurrency, setUseAutoConcurrency] = useState(false);
  const [recommendedConcurrency, setRecommendedConcurrency] = useState(4);
  const [vaultStatus, setVaultStatus] = useState<db.KnowledgeIndexStatus | null>(null);
  const [watchStatus, setWatchStatus] = useState<db.VaultWatchStatus | null>(null);
  const [vaultTargets, setVaultTargets] = useState<db.VaultWatchTarget[]>([]);
  const [targetStats, setTargetStats] = useState<db.VaultTargetStats[]>([]);
  const [watchEvents, setWatchEvents] = useState<db.VaultWatchEvent[]>([]);
  const [knowledgeDocs, setKnowledgeDocs] = useState<db.KnowledgeFileRecord[]>([]);
  const [docVaultFilter, setDocVaultFilter] = useState("all");
  const [expandedTimeline, setExpandedTimeline] = useState<string | null>(null);
  const [lastIgnored, setLastIgnored] = useState(0);
  const [lastConcurrencyUsed, setLastConcurrencyUsed] = useState(0);
  const [indexProgress, setIndexProgress] = useState<db.IndexProgress | null>(null);
  const [indexQueueStatus, setIndexQueueStatus] = useState<db.VaultIndexQueueStatus | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
  }, []);

  const loadWatchEvents = async (vaultPath?: string) => {
    setWatchEvents(await db.listVaultWatchEvents(vaultPath, 50));
  };

  const loadDocs = async (vaultPath?: string) => {
    setKnowledgeDocs(await db.listKnowledgeFiles(vaultPath, 100));
  };

  useEffect(() => {
    let disposed = false;
    void (async () => {
      const config = await db.getVaultWatchConfig();
      if (disposed) return;
      if (config.path) setVaultPath(config.path);
      if (config.ignorePatterns.length > 0) {
        setIgnorePatterns(config.ignorePatterns.join(", "));
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
        void loadDocs(docVaultFilter === "all" ? undefined : docVaultFilter);
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
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlisten = () => {};
    void db
      .listenVaultIndexProgress((progress) => {
        if (disposed) return;
        setIndexProgress(progress);
        if (progress.status === "done") {
          setLastIgnored(progress.ignored);
          setLastConcurrencyUsed(progress.concurrencyUsed);
          void loadTargets();
          void loadDocs(docVaultFilter === "all" ? undefined : docVaultFilter);
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
  }, []);

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

  const allTags = Array.from(new Set(thoughts.flatMap((t) => t.tags.split(",").map((x) => x.trim()).filter(Boolean))));
  const filtered = filter === "all" ? thoughts : thoughts.filter((t) => t.tags.includes(filter));
  const visibleThoughts = results ?? filtered;
  const selected = visibleThoughts.find((t) => t.id === selectedId) ?? visibleThoughts[0] ?? null;

  const add = async () => {
    if (!content.trim()) return;
    await addThought(content.trim(), tags, "inbox");
    setContent("");
  };

  const runSearch = async () => {
    if (!query.trim()) {
      setResults(null);
      return;
    }
    setResults(await db.searchThoughts(query.trim(), 5));
  };

  const parseIgnore = () =>
    ignorePatterns
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

  const runIndex = async () => {
    if (!vaultPath.trim()) return;
    const concurrency = useAutoConcurrency
      ? 0
      : Math.max(1, Math.min(16, Number(indexConcurrency) || 4));
    const runId = await db.startVaultIndex(vaultPath.trim(), parseIgnore(), concurrency);
    setIndexProgress({
      runId,
      path: vaultPath.trim(),
      done: 0,
      total: 0,
      files: 0,
      ignored: 0,
      concurrencyUsed: 0,
      status: "running",
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

  const loadTargets = async () => {
    setVaultTargets(await db.listVaultWatchTargets());
    setWatchStatus(await db.getVaultWatchStatus());
    setTargetStats(await db.listVaultTargetStats());
  };

  const changeDocVaultFilter = (vaultPath: string) => {
    setDocVaultFilter(vaultPath);
    void loadDocs(vaultPath === "all" ? undefined : vaultPath);
  };

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
    await loadDocs(docVaultFilter === "all" ? undefined : docVaultFilter);
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
    await loadDocs(docVaultFilter === "all" ? undefined : docVaultFilter);
    setVaultStatus(await db.getKnowledgeIndexStatus());
    setIndexStatus(await db.getRagIndexStatus());
  };

  const removeTarget = async (target: db.VaultWatchTarget) => {
    await db.deleteVaultWatchTarget(target.path);
    await loadTargets();
    await loadWatchEvents();
    await loadDocs(docVaultFilter === "all" ? undefined : docVaultFilter);
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

  return (
    <div className="view-enter flex h-full flex-col gap-4 p-4">
      <BentoCard title="Thought Inbox" subtitle="Command+N 闪念速记" icon={BookOpen} colSpan={12}>
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
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
      </BentoCard>

      <BentoCard title="Vault Index" subtitle="Obsidian / Markdown 文件夹纳入 RAG" icon={FolderOpen} colSpan={12}>
        <div className="flex items-end gap-2">
          <input
            value={vaultPath}
            onChange={(e) => setVaultPath(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void runIndex();
              }
            }}
            placeholder="Vault path..."
            className="h-9 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs text-slate-200 outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
          />
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
            data-vault-watch={currentWatching ? "on" : "off"}
            className="flex h-9 items-center gap-1 rounded-xl bg-emerald-500/20 px-3 text-xs text-emerald-400 hover:bg-emerald-500/30"
          >
            <RefreshCw size={14} className={currentWatching ? "animate-spin" : ""} />
            {currentWatching ? "Stop watch" : "Watch vault"}
          </button>
          <span data-vault-watch-status={currentWatching ? "on" : "off"}>
            <ModelBadge
              label="Watch"
              tone="green"
              status={currentWatching ? "watching" : "off"}
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
              status={vaultStatus ? `${vaultStatus.files} files` : "pending"}
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
            data-index-concurrency={useAutoConcurrency ? String(recommendedConcurrency) : indexConcurrency}
            placeholder="Threads"
            className="h-8 w-20 shrink-0 rounded-xl border border-white/10 bg-white/[0.03] px-2 text-[11px] text-slate-300 outline-none focus:border-emerald-500/40 placeholder:text-slate-600 disabled:opacity-50"
          />
          <button
            type="button"
            aria-label="Auto index concurrency"
            aria-pressed={useAutoConcurrency}
            data-index-concurrency-auto={useAutoConcurrency ? "on" : "off"}
            data-recommended-concurrency={recommendedConcurrency}
            onClick={() => setUseAutoConcurrency((value) => !value)}
            className={`flex h-8 items-center rounded-lg px-2 text-[10px] ${
              useAutoConcurrency
                ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                : "bg-white/5 text-slate-300 hover:bg-white/10"
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
                ? "border-amber-500/25 bg-amber-500/10 text-amber-300"
                : "border-white/10 bg-white/[0.04] text-slate-500"
            }`}
          >
            Skipped {lastIgnored}
          </span>
          <span
            data-index-result-workers={lastConcurrencyUsed}
            className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-400"
          >
            {lastConcurrencyUsed > 0 ? `${lastConcurrencyUsed} workers` : "auto pending"}
          </span>
        </div>
        {indexProgress &&
          (() => {
            const percent =
              indexProgress.total > 0
                ? Math.round((indexProgress.done / indexProgress.total) * 100)
                : indexProgress.status === "done"
                  ? 100
                  : 0;
            return (
              <div data-index-progress={percent} className="mt-2 flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full accent-bg"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <span
                  data-index-progress-status
                  className="shrink-0 text-[9px] text-slate-500"
                >
                  {indexProgress.status === "done"
                    ? `Indexed ${indexProgress.files} files`
                    : indexProgress.status === "running"
                      ? `Indexing ${indexProgress.done}/${indexProgress.total}`
                      : indexProgress.status === "queued"
                        ? "Queued behind active index"
                        : indexProgress.status === "cancelled"
                          ? "Cancelled"
                          : indexProgress.status}
                </span>
                {(indexProgress.status === "running" || indexProgress.status === "queued") && (
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
                className="flex max-w-[240px] items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[9px] text-slate-400"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full accent-bg" />
                <span className="truncate">{indexQueueStatus.active.path}</span>
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
                className="max-w-[180px] truncate rounded-md bg-white/[0.04] px-2 py-1 text-[9px] text-slate-500"
              >
                {entry.path}
              </span>
            ))}
          </div>
        )}
        {vaultTargets.length > 0 && (
          <div data-vault-target-list className="mt-3 space-y-1.5">
            {vaultTargets.map((target) => {
              const targetWatching =
                watchStatus?.paths?.includes(target.path) ?? target.enabled;
              const targetStat = targetStats.find((stat) => stat.path === target.path);
              const targetFileCount = targetStat?.files ?? 0;
              return (
                <div
                  key={target.path}
                  data-vault-target
                  data-vault-target-path={target.path}
                  data-vault-target-watch={targetWatching ? "on" : "off"}
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
                        ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                        : "bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    {targetWatching ? "Stop" : "Watch"}
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
                        ? "bg-sky-500/15 text-sky-300"
                        : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
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
                          {watchEvents.filter((event) => event.vaultPath === target.path).length}{" "}
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
                        <div className="py-1 text-[9px] text-slate-600">
                          No watch events yet
                        </div>
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
                                event.eventKind === "created"
                                  ? "text-emerald-400"
                                  : event.eventKind === "modified"
                                    ? "text-sky-400"
                                    : "text-rose-400"
                              }`}
                            >
                              {event.eventKind === "created"
                                ? "+"
                                : event.eventKind === "modified"
                                  ? "~"
                                  : "-"}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[9px] text-slate-400">
                              {event.filePath}
                            </span>
                            <span className="shrink-0 text-[8px] text-slate-600">
                              {new Date(event.createdAt).toLocaleTimeString("zh-CN", {
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
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[10px] font-medium text-slate-300">
              Document status
            </span>
            <span
              data-knowledge-docs-count
              className="rounded-md bg-white/5 px-1.5 py-0.5 text-[9px] text-slate-500"
            >
              {knowledgeDocs.length} docs
            </span>
            <select
              data-knowledge-doc-filter
              value={docVaultFilter}
              onChange={(e) => changeDocVaultFilter(e.target.value)}
              aria-label="Document vault filter"
              className="ml-auto h-6 rounded-md border border-white/10 bg-white/[0.03] px-1 text-[9px] text-slate-400 outline-none"
            >
              <option value="all">All vaults</option>
              {vaultTargets.map((target) => (
                <option key={target.path} value={target.path}>
                  {target.path}
                </option>
              ))}
            </select>
          </div>
          <div className="max-h-44 space-y-1 overflow-y-auto">
            {knowledgeDocs.length === 0 && (
              <div className="py-3 text-center text-[9px] text-slate-600">
                No indexed documents
              </div>
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
                  <span className="block truncate text-[8px] text-slate-600">
                    {doc.path}
                  </span>
                </span>
                {doc.vaultPath && (
                  <span className="shrink-0 rounded bg-sky-500/10 px-1.5 py-0.5 text-[8px] text-sky-300">
                    {doc.vaultPath}
                  </span>
                )}
                <span className="shrink-0 text-[8px] text-slate-600">
                  {doc.indexedAt > 0
                    ? new Date(doc.indexedAt).toLocaleDateString("zh-CN")
                    : "n/a"}
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
            onClick={() => setFilter("all")}
            className={`rounded-lg px-2 py-1.5 text-left text-[11px] ${
              filter === "all" ? "bg-emerald-500/20 text-emerald-400" : "text-slate-400 hover:bg-white/[0.06]"
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
                filter === t ? "bg-emerald-500/20 text-emerald-400" : "text-slate-400 hover:bg-white/[0.06]"
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
                  if (e.key === "Enter") {
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
                    setQuery("");
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
          {results !== null && results.length > 0 && (
            <div className="shrink-0 border-b border-white/10 pb-2 text-[10px] text-slate-500">
              {results.length} RAG matches
            </div>
          )}
          {visibleThoughts.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedId(t.id)}
              className={`rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
                selected?.id === t.id
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                  : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"
              }`}
            >
              <span className="block truncate">{t.content.split("\n")[0]}</span>
              {"score" in t && typeof t.score === "number" && (
                <span className="mt-0.5 block text-[10px] text-slate-500">score {t.score.toFixed(2)}</span>
              )}
            </button>
          ))}
          {visibleThoughts.length === 0 && <div className="py-10 text-center text-xs text-slate-600">No thoughts</div>}
        </div>
        <div
          key={selected?.id ?? "empty"}
          className={`col-span-5 flex min-h-0 flex-col overflow-y-auto rounded-2xl border border-white/10 bg-[#18181C] p-4 shadow-xl ${
            selected ? "detail-enter" : ""
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
              status={indexStatus?.indexed ? `${indexStatus.documents} docs` : "pending"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
