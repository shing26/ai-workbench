import {
  AlertTriangle,
  BookOpen,
  Clock,
  Database,
  ExternalLink,
  FolderOpen,
  Layers,
  Link2,
  MessageCircle,
  Network,
  Pencil,
  Plus,
  Puzzle,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Tags,
  Trash2,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import * as db from '../lib/db';
import { useWorkbenchStore } from '../stores/workbenchStore';
import { useViewState } from '../stores/viewState';
import BentoCard from '../components/ui/BentoCard';
import ModelBadge from '../components/ui/ModelBadge';

export default function KnowledgeView() {
  const thoughts = useWorkbenchStore((s) => s.thoughts);
  const addThought = useWorkbenchStore((s) => s.addThought);
  const updateThoughtTags = useWorkbenchStore((s) => s.updateThoughtTags);
  const updateThoughtContent = useWorkbenchStore((s) => s.updateThoughtContent);
  const updateThoughtType = useWorkbenchStore((s) => s.updateThoughtType);
  const deleteThought = useWorkbenchStore((s) => s.deleteThought);
  const setNoteContext = useWorkbenchStore((s) => s.setNoteContext);
  const setActiveView = useWorkbenchStore((s) => s.setActiveView);
  const projects = useWorkbenchStore((s) => s.projects);
  const vibeContext = useWorkbenchStore((s) => s.vibeContext);
  const [prismViewMode, setPrismViewMode] = useViewState<'grid' | 'graph'>(
    'knowledge',
    'prismViewMode',
    'grid',
  );
  const [prismHoverId, setPrismHoverId] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<{
    documented: number;
    total: number;
    pct: number;
  } | null>(null);
  const [obsidianResults, setObsidianResults] = useState<Record<string, string>>({});
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('#work');
  const [filter, setFilter] = useViewState('knowledge', 'filter', 'all');
  const [selectedTag, setSelectedTag] = useViewState('knowledge', 'selectedTag', 'all');
  const [selectedId, setSelectedId] = useViewState<string | null>('knowledge', 'selectedId', null);
  const [query, setQuery] = useViewState('knowledge', 'query', '');
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
  const [tagEditId, setTagEditId] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState('');
  const [tagEditResults, setTagEditResults] = useState<Record<string, string>>({});
  const [bodyEditId, setBodyEditId] = useState<string | null>(null);
  const [bodyDraft, setBodyDraft] = useState('');
  const [bodyPreview, setBodyPreview] = useState(false);
  const [bodyEditResults, setBodyEditResults] = useState<Record<string, string>>({});
  const [wikiSuggestions, setWikiSuggestions] = useState<db.WikiLinkSuggestion[]>([]);
  const [wikiActiveIndex, setWikiActiveIndex] = useState(0);
  const [wikiLinkStart, setWikiLinkStart] = useState(0);
  const [wikiLinkEnd, setWikiLinkEnd] = useState(0);
  const [typeEditResults, setTypeEditResults] = useState<Record<string, string>>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteResults, setDeleteResults] = useState<Record<string, string>>({});
  const [embeddingConfig, setEmbeddingConfigState] = useState<db.EmbeddingConfig | null>(null);
  const [embeddingMode, setEmbeddingMode] = useState<db.EmbeddingMode>('local');
  const [embeddingBaseUrl, setEmbeddingBaseUrl] = useState('');
  const [embeddingApiKey, setEmbeddingApiKey] = useState('');
  const [embeddingModel, setEmbeddingModel] = useState('');
  const [embeddingShards, setEmbeddingShards] = useState('8');
  const [embeddingAuto, setEmbeddingAuto] = useState(true);
  const [embeddingAnn, setEmbeddingAnn] = useState(true);
  const [embeddingProbe, setEmbeddingProbe] = useState('2');
  const [vectorStatus, setVectorStatus] = useState<db.VectorIndexStatus | null>(null);
  const [vectorRebuildBusy, setVectorRebuildBusy] = useState(false);
  const [vectorRebuildForce, setVectorRebuildForce] = useState(false);
  const [vectorMessage, setVectorMessage] = useState('');
  const [clusterStatus, setClusterStatus] = useState<db.KnowledgeClusterStatus | null>(null);
  const [clusterThreshold, setClusterThreshold] = useState('0.62');
  const [dedupThreshold, setDedupThreshold] = useState('0.92');
  const [clusterBusy, setClusterBusy] = useState(false);
  const [clusterMessage, setClusterMessage] = useState('');
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);

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

  const loadVectorData = useCallback(async () => {
    const [config, status] = await Promise.all([
      db.getEmbeddingConfig(),
      db.getVectorIndexStatus(),
    ]);
    setEmbeddingConfigState(config);
    setEmbeddingMode(config.mode);
    setEmbeddingBaseUrl(config.baseUrl);
    setEmbeddingApiKey(config.apiKey);
    setEmbeddingModel(config.model);
    setEmbeddingShards(String(config.shardCount));
    setEmbeddingAuto(config.autoRebuild);
    setEmbeddingAnn(config.annEnabled);
    setEmbeddingProbe(String(config.probeCount));
    setVectorStatus(status);
  }, []);

  const loadClusterData = useCallback(async () => {
    const status = await db.getKnowledgeClusterStatus();
    setClusterStatus(status);
    setClusterThreshold(String(status.clusterThreshold));
    setDedupThreshold(String(status.dedupThreshold));
  }, []);

  const runClusterRecompute = async () => {
    if (clusterBusy) return;
    setClusterBusy(true);
    try {
      const status = await db.recomputeKnowledgeClusters(
        Number(clusterThreshold) || undefined,
        Number(dedupThreshold) || undefined,
      );
      setClusterStatus(status);
      setClusterThreshold(String(status.clusterThreshold));
      setDedupThreshold(String(status.dedupThreshold));
      setClusterMessage(`Recomputed ${status.clusters.length} cluster(s)`);
    } catch (err) {
      setClusterMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setClusterBusy(false);
    }
  };

  const dismissDedup = async (id: string) => {
    await db.dismissKnowledgeDuplicate(id);
    setClusterStatus(await db.getKnowledgeClusterStatus());
  };

  const mergeDedup = async (id: string) => {
    await db.mergeKnowledgeDuplicate(id);
    await loadDocs();
    setClusterStatus(await db.getKnowledgeClusterStatus());
  };

  const saveEmbeddingConfig = async () => {
    try {
      const config = await db.setEmbeddingConfig({
        mode: embeddingMode,
        providerId: '',
        baseUrl: embeddingBaseUrl,
        apiKey: embeddingApiKey,
        model: embeddingModel,
        dimension: 256,
        shardCount: Number(embeddingShards) || 8,
        autoRebuild: embeddingAuto,
        annEnabled: embeddingAnn,
        probeCount: Number(embeddingProbe) || 2,
      });
      setEmbeddingConfigState(config);
      setVectorMessage('Embedding config saved');
      await loadVectorData();
    } catch (err) {
      setVectorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const runVectorRebuild = async () => {
    if (vectorRebuildBusy) return;
    setVectorRebuildBusy(true);
    try {
      const result = await db.rebuildVectorIndex(vectorRebuildForce);
      setVectorMessage(
        `Rebuilt ${result.rebuilt} · failed ${result.failed} · skipped ${result.skipped}`,
      );
      await loadVectorData();
    } catch (err) {
      setVectorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setVectorRebuildBusy(false);
    }
  };

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
    void loadVectorData();
  }, [loadVectorData]);

  useEffect(() => {
    void loadClusterData();
  }, [loadClusterData]);

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
  const tagStats = new Map<string, { count: number; inbox: number; note: number; doc: number }>();
  for (const thought of thoughts) {
    const tags = thought.tags
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    for (const tag of tags) {
      const stat = tagStats.get(tag) ?? { count: 0, inbox: 0, note: 0, doc: 0 };
      stat.count += 1;
      stat[thought.type] += 1;
      tagStats.set(tag, stat);
    }
  }
  const tagEntries = [...tagStats.entries()].sort((a, b) => b[1].count - a[1].count);
  const tagThoughts =
    selectedTag === 'all' ? thoughts : thoughts.filter((t) => t.tags.includes(selectedTag));
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
  const selectedLocal = selected ? (thoughts.find((t) => t.id === selected.id) ?? null) : null;
  const linkGraph = useMemo(() => db.buildThoughtLinkGraph(thoughts), [thoughts]);
  const selectedOutgoing = selectedLocal ? (linkGraph.outgoing[selectedLocal.id] ?? []) : [];
  const selectedIncoming = selectedLocal ? (linkGraph.incoming[selectedLocal.id] ?? []) : [];
  const totalLinks = useMemo(
    () => Object.values(linkGraph.outgoing).reduce((sum, refs) => sum + refs.length, 0),
    [linkGraph],
  );
  const missingLinks = useMemo(() => {
    let count = 0;
    for (const thought of thoughts) {
      for (const link of db.extractWikiLinks(thought.content)) {
        if (!db.resolveWikiLinkTarget(thoughts, link.target)) count += 1;
      }
    }
    return count;
  }, [thoughts]);

  const navigateToThought = (id: string) => {
    setResults(null);
    setCrossFileFilter(null);
    setFilter('all');
    setSelectedTag('all');
    setBodyEditId(null);
    setTagEditId(null);
    closeWikiSuggestions();
    setSelectedId(id);
  };

  const add = async () => {
    if (!content.trim()) return;
    const parsed = Array.from(
      new Set(
        content
          .split(/\s+/)
          .map((w) => w.trim())
          .filter((w) => w.startsWith('#'))
          .map((w) => w.replace(/[，。,.!！?？]$/, '')),
      ),
    );
    const mergedTags = Array.from(
      new Set(
        tags
          .split(/[,，]/)
          .map((t) => t.trim().replace(/^#/, ''))
          .filter(Boolean)
          .concat(parsed.map((p) => p.replace(/^#/, ''))),
      ),
    )
      .map((t) => `#${t}`)
      .join(',');
    const cleanedContent = content
      .split(/\s+/)
      .filter((w) => !parsed.includes(w))
      .join(' ');
    await addThought(cleanedContent || '（闪念）', mergedTags, 'inbox');
    setContent('');
    if (parsed.length > 0) setTags(mergedTags);
  };

  const discussNote = (note: db.Thought | db.RagSearchResult) => {
    const title = note.content.split('\n')[0].replace(/^#+\s*/, '') || '未命名笔记';
    setNoteContext({
      thoughtId: note.id,
      title,
      content: note.content,
      tags: note.tags,
      type: note.type,
      mountedAt: Date.now(),
    });
    setActiveView('ai-studio');
  };

  const startTagEdit = (thought: db.Thought) => {
    setTagEditId(thought.id);
    setTagDraft(thought.tags);
    setTagEditResults((prev) => ({ ...prev, [thought.id]: '' }));
  };

  const saveTagEdit = async (thought: db.Thought) => {
    const normalized = Array.from(
      new Set(
        tagDraft
          .split(/[,，]/)
          .map((tag) => tag.trim().replace(/^#/, ''))
          .filter(Boolean),
      ),
    )
      .map((tag) => `#${tag}`)
      .join(',');
    await updateThoughtTags(thought.id, normalized);
    setTagEditId(null);
    setTagEditResults((prev) => ({ ...prev, [thought.id]: 'Saved' }));
  };

  const startBodyEdit = (thought: db.Thought) => {
    setBodyEditId(thought.id);
    setBodyDraft(thought.content);
    setBodyPreview(false);
    setBodyEditResults((prev) => ({ ...prev, [thought.id]: '' }));
    closeWikiSuggestions();
  };

  const closeWikiSuggestions = () => {
    setWikiSuggestions([]);
    setWikiActiveIndex(0);
  };

  const handleBodyDraftChange = (value: string, caret: number) => {
    setBodyDraft(value);
    const before = value.slice(0, caret);
    const match = before.match(/\[\[([^\]\n]*)$/);
    if (!match) {
      closeWikiSuggestions();
      return;
    }
    const query = (match[1] ?? '').trim();
    setWikiLinkStart(caret - match[0].length);
    setWikiLinkEnd(caret);
    if (!query) {
      closeWikiSuggestions();
      return;
    }
    setWikiSuggestions(db.suggestWikiLinkTargets(thoughts, query, 6, selectedLocal?.id));
    setWikiActiveIndex(0);
  };

  const insertWikiSuggestion = (title: string) => {
    const next = `${bodyDraft.slice(0, wikiLinkStart)}[[${title}]]${bodyDraft.slice(wikiLinkEnd)}`;
    setBodyDraft(next);
    closeWikiSuggestions();
    requestAnimationFrame(() => {
      const editor = document.querySelector<HTMLTextAreaElement>(
        `[data-thought-body-input="${selectedLocal?.id ?? ''}"]`,
      );
      if (editor) {
        const position = wikiLinkStart + title.length + 4;
        editor.setSelectionRange(position, position);
        editor.focus();
      }
    });
  };

  const saveBodyEdit = async (thought: db.Thought) => {
    const next = bodyDraft.trim();
    if (!next) return;
    await updateThoughtContent(thought.id, next);
    setBodyEditId(null);
    setBodyDraft('');
    setBodyPreview(false);
    setBodyEditResults((prev) => ({ ...prev, [thought.id]: 'Saved' }));
    closeWikiSuggestions();
  };

  const cancelBodyEdit = () => {
    setBodyEditId(null);
    setBodyDraft('');
    setBodyPreview(false);
    closeWikiSuggestions();
  };

  const convertType = async (thought: db.Thought, type: db.ThoughtType) => {
    if (thought.type === type) return;
    await updateThoughtType(thought.id, type);
    setTypeEditResults((prev) => ({ ...prev, [thought.id]: 'Saved' }));
  };

  const requestDelete = (thought: db.Thought) => {
    setDeleteConfirmId(thought.id);
    setDeleteResults((prev) => ({ ...prev, [thought.id]: '' }));
  };

  const cancelDelete = () => {
    setDeleteConfirmId(null);
  };

  const confirmDeleteThought = async (thought: db.Thought) => {
    await deleteThought(thought.id, true);
    setDeleteConfirmId(null);
    setTagEditId(null);
    setBodyEditId(null);
    setResults(null);
    setSelectedId(null);
    setDeleteResults((prev) => ({ ...prev, [thought.id]: 'Deleted' }));
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

  useEffect(() => {
    const total = projects.length;
    const documented = projects.filter(
      (p) =>
        (p.material && p.material.trim().length > 0) ||
        thoughts.some((t) => t.tags.includes(p.id) || (t.content || '').includes(p.name)),
    ).length;
    setCoverage({
      documented,
      total,
      pct: total > 0 ? Math.round((documented / total) * 100) : 100,
    });
  }, [projects, thoughts]);

  const injectNoteContext = (thought: db.Thought) => {
    void db.recordThoughtReference(thought.id);
    setNoteContext({
      thoughtId: thought.id,
      title: (thought.content || '').split('\n').find((l) => l.trim()) || thought.id,
      content: thought.content,
      tags: thought.tags,
      type: thought.type,
      mountedAt: Date.now(),
    });
    setActiveView('ai-studio');
  };

  const openObsidianFor = async (thought: db.Thought) => {
    void db.recordThoughtReference(thought.id);
    const file = `${thought.id}.md`;
    setObsidianResults((prev) => ({ ...prev, [thought.id]: '打开中…' }));
    try {
      const uri = await db.openObsidian(vibeContext?.path ?? '', file);
      setObsidianResults((prev) => ({ ...prev, [thought.id]: uri.slice(0, 48) }));
    } catch (err) {
      setObsidianResults((prev) => ({
        ...prev,
        [thought.id]: err instanceof Error ? err.message : String(err),
      }));
    }
  };

  const thoughtActivity = (thought: db.Thought): 'hot' | 'cold' | 'warn' => {
    const last = thought.lastReferencedAt ?? thought.createdAt;
    const days = (Date.now() - last) / 86_400_000;
    if (days < 3) return 'hot';
    if (days < 21) return 'warn';
    return 'cold';
  };

  return (
    <div className="view-enter mx-auto grid w-full max-w-7xl grid-cols-12 gap-4 overflow-y-auto p-4">
      <BentoCard
        title="Prism 知识塔"
        subtitle="覆盖率 · 活性 · Graph/Grid 秒切 · Obsidian 联动"
        icon={Layers}
        colSpan={12}
      >
        <div data-prism-knowledge-tower className="space-y-3">
          {coverage && coverage.total > 0 && coverage.pct < 50 && (
            <div
              data-knowledge-coverage-warning
              className="flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-[11px] text-amber-300"
            >
              <AlertTriangle size={13} />
              知识覆盖率 {coverage.pct}%（{coverage.documented}/{coverage.total} 已文档化）低于
              50%，建议为项目固化 Spec。
              <button
                type="button"
                data-knowledge-coverage-go
                onClick={() => {
                  setSelectedTag('all');
                  setFilter('all');
                  setPrismViewMode('grid');
                }}
                className="ml-auto rounded-md bg-amber-500/15 px-2 py-1 text-[9px] text-amber-300 hover:bg-amber-500/25"
              >
                查看知识
              </button>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                data-prism-view-grid
                data-active={prismViewMode === 'grid' ? 'true' : 'false'}
                onClick={() => setPrismViewMode('grid')}
                className={`flex h-7 items-center gap-1 rounded-lg border px-2.5 text-[10px] ${
                  prismViewMode === 'grid'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.06]'
                }`}
              >
                <Layers size={11} /> 田字格
              </button>
              <button
                type="button"
                data-prism-view-graph
                data-active={prismViewMode === 'graph' ? 'true' : 'false'}
                onClick={() => setPrismViewMode('graph')}
                className={`flex h-7 items-center gap-1 rounded-lg border px-2.5 text-[10px] ${
                  prismViewMode === 'graph'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.06]'
                }`}
              >
                <Network size={11} /> 图谱
              </button>
            </div>
            <span className="text-[10px] text-slate-500">
              {thoughts.length} 卡片 · 活性 🔥&lt;3d / ⚠️&lt;21d / ❄️&gt;21d
            </span>
          </div>

          {prismViewMode === 'graph' ? (
            <div
              data-prism-graph
              className="grid gap-2 rounded-xl border border-white/10 bg-black/20 p-3"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}
            >
              {thoughts.slice(0, 24).map((t) => {
                const act = thoughtActivity(t);
                return (
                  <button
                    key={t.id}
                    type="button"
                    data-prism-graph-node={t.id}
                    data-prism-activity={act}
                    onClick={() => injectNoteContext(t)}
                    className={`truncate rounded-lg border px-2 py-1.5 text-[10px] text-left transition-colors ${
                      act === 'hot'
                        ? 'border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300'
                        : act === 'warn'
                          ? 'border-amber-500/20 bg-amber-500/[0.04] text-amber-200/80'
                          : 'border-white/10 bg-white/[0.02] text-slate-500'
                    }`}
                  >
                    {(t.content || '').split('\n').find((l) => l.trim()) || t.id}
                  </button>
                );
              })}
            </div>
          ) : (
            <div data-prism-grid className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {thoughts.slice(0, 12).map((t) => {
                const act = thoughtActivity(t);
                const actLabel = act === 'hot' ? '🔥' : act === 'warn' ? '⚠️' : '❄️';
                return (
                  <div
                    key={t.id}
                    data-prism-card={t.id}
                    data-prism-activity={act}
                    className="group relative rounded-xl border border-white/10 bg-white/[0.03] p-3 transition-colors hover:border-emerald-500/25"
                    onMouseEnter={() => setPrismHoverId(t.id)}
                    onMouseLeave={() => setPrismHoverId(null)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[11px] text-slate-200">
                          {(t.content || '').split('\n').find((l) => l.trim()) || t.id}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-[9px] text-slate-500">
                          <span data-prism-activity-badge>{actLabel}</span>
                          <span className="truncate">{t.tags || '无标签'}</span>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[8px] text-slate-500">
                        {t.type}
                      </span>
                    </div>
                    {prismHoverId === t.id && (
                      <div
                        data-prism-actions
                        className="absolute -bottom-3 left-2 right-2 z-10 flex items-center justify-between gap-1 rounded-lg border border-white/10 bg-[#222226] p-1 shadow-xl"
                      >
                        <button
                          type="button"
                          data-prism-inject-context={t.id}
                          title="⚡ 注入 Context"
                          onClick={() => injectNoteContext(t)}
                          className="flex h-6 w-6 items-center justify-center rounded-md text-emerald-400 hover:bg-emerald-500/15"
                        >
                          <Zap size={11} />
                        </button>
                        <button
                          type="button"
                          data-prism-split-dod={t.id}
                          title="🧩 拆解 DoD"
                          onClick={() => injectNoteContext(t)}
                          className="flex h-6 w-6 items-center justify-center rounded-md text-violet-400 hover:bg-violet-500/15"
                        >
                          <Puzzle size={11} />
                        </button>
                        <button
                          type="button"
                          data-prism-debate={t.id}
                          title="💬 论证"
                          onClick={() => injectNoteContext(t)}
                          className="flex h-6 w-6 items-center justify-center rounded-md text-amber-400 hover:bg-amber-500/15"
                        >
                          <MessageCircle size={11} />
                        </button>
                        <button
                          type="button"
                          data-prism-obsidian={t.id}
                          title="🔮 Obsidian"
                          onClick={() => void openObsidianFor(t)}
                          className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-white/[0.08]"
                        >
                          <ExternalLink size={11} />
                        </button>
                        <span className="ml-auto pr-1 font-mono text-[8px] text-slate-600">
                          {obsidianResults[t.id] ?? ''}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </BentoCard>

      <BentoCard title="Thought Inbox" subtitle="Command+N 闪念速记" icon={BookOpen} colSpan={8}>
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
            data-thought-inbox-input
            placeholder="Capture a thought..."
            className="min-h-0 flex-1 resize-none rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-200 outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
          />
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="h-9 w-28 rounded-xl border border-white/10 bg-white/[0.03] px-2 text-[11px] text-slate-300 outline-none"
            placeholder="#tags"
            title="标签（可在正文用 #tag 自动解析）"
          />
          <button
            type="button"
            data-thought-inbox-add
            onClick={() => void add()}
            className="flex h-9 items-center gap-1 rounded-xl bg-emerald-500/20 px-3 text-xs text-emerald-400 hover:bg-emerald-500/30"
          >
            <Plus size={14} /> Add
          </button>
        </div>
      </BentoCard>

      <BentoCard
        title="Tag Library"
        subtitle="标签云 · 类型分布 · 分类浏览"
        icon={Tags}
        colSpan={4}
      >
        <div data-knowledge-tag-library className="space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              data-knowledge-tag="all"
              data-knowledge-tag-active={selectedTag === 'all' ? 'true' : 'false'}
              data-knowledge-tag-count={thoughts.length}
              onClick={() => {
                setSelectedTag('all');
                setFilter('all');
              }}
              className={`flex h-7 items-center gap-1 rounded-lg border px-2.5 text-[11px] transition-colors ${
                selectedTag === 'all'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.06]'
              }`}
            >
              All
              <span className="font-mono text-[9px] opacity-70">{thoughts.length}</span>
            </button>
            {tagEntries.map(([tag, stat]) => (
              <button
                key={tag}
                type="button"
                data-knowledge-tag={tag}
                data-knowledge-tag-active={selectedTag === tag ? 'true' : 'false'}
                data-knowledge-tag-count={stat.count}
                onClick={() => {
                  setSelectedTag(tag);
                  setFilter(tag);
                }}
                className={`flex h-7 items-center gap-1 rounded-lg border px-2.5 text-[11px] transition-colors ${
                  selectedTag === tag
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.06]'
                }`}
              >
                {tag}
                <span className="font-mono text-[9px] opacity-70">{stat.count}</span>
              </button>
            ))}
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-2.5">
              <div className="mb-2 text-[10px] uppercase tracking-wide text-slate-500">
                Tags · {tagEntries.length}
              </div>
              <div className="flex flex-wrap gap-1">
                {tagEntries.slice(0, 8).map(([tag, stat]) => (
                  <span
                    key={tag}
                    className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-slate-400"
                  >
                    {tag} · {stat.count}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-2.5">
              <div className="mb-2 text-[10px] uppercase tracking-wide text-slate-500">
                Type distribution
              </div>
              <div className="flex flex-col gap-1 text-[10px] text-slate-400">
                <span>inbox {thoughts.filter((t) => t.type === 'inbox').length}</span>
                <span>note {thoughts.filter((t) => t.type === 'note').length}</span>
                <span>doc {thoughts.filter((t) => t.type === 'doc').length}</span>
              </div>
            </div>
            <div
              data-knowledge-tag-notes
              className="rounded-xl border border-white/10 bg-white/[0.02] p-2.5"
            >
              <div className="mb-2 text-[10px] uppercase tracking-wide text-slate-500">
                {selectedTag === 'all' ? 'Recent notes' : selectedTag}
              </div>
              <div className="flex flex-col gap-1">
                {tagThoughts.slice(0, 6).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedId(t.id)}
                    className="truncate rounded-md bg-white/[0.03] px-1.5 py-1 text-left text-[10px] text-slate-300 hover:bg-white/[0.06]"
                  >
                    {t.content.split('\n')[0].slice(0, 48)}
                  </button>
                ))}
                {tagThoughts.length === 0 && (
                  <span className="text-[10px] text-slate-600">No notes</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </BentoCard>

      <BentoCard
        title="Vault Index"
        subtitle="Obsidian / Markdown 文件夹纳入 RAG"
        icon={FolderOpen}
        colSpan={7}
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

      <BentoCard
        title="Vector index"
        subtitle="真实 Embedding 模型、增量重建与分片索引"
        icon={Database}
        colSpan={5}
      >
        <div data-vector-index-status className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <div className="flex flex-col items-center rounded-xl bg-white/[0.03] px-2 py-1.5">
            <span data-vector-total className="text-sm font-semibold text-slate-300">
              {vectorStatus?.total ?? 0}
            </span>
            <span className="text-[9px] text-slate-500">total</span>
          </div>
          <div className="flex flex-col items-center rounded-xl bg-white/[0.03] px-2 py-1.5">
            <span data-vector-pending className="text-sm font-semibold text-amber-300">
              {vectorStatus?.pending ?? 0}
            </span>
            <span className="text-[9px] text-slate-500">pending</span>
          </div>
          <div className="flex flex-col items-center rounded-xl bg-white/[0.03] px-2 py-1.5">
            <span data-vector-indexed className="text-sm font-semibold text-emerald-300">
              {vectorStatus?.indexed ?? 0}
            </span>
            <span className="text-[9px] text-slate-500">indexed</span>
          </div>
          <div className="flex flex-col items-center rounded-xl bg-white/[0.03] px-2 py-1.5">
            <span data-vector-failed className="text-sm font-semibold text-rose-300">
              {vectorStatus?.failed ?? 0}
            </span>
            <span className="text-[9px] text-slate-500">failed</span>
          </div>
          <div className="col-span-2 flex flex-col items-center justify-center rounded-xl bg-white/[0.03] px-2 py-1.5 sm:col-span-1">
            <span
              data-vector-model
              className="max-w-full truncate text-sm font-semibold text-sky-300"
            >
              {vectorStatus?.model || 'local'}
            </span>
            <span className="text-[9px] text-slate-500">model</span>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <select
            value={embeddingMode}
            onChange={(e) => setEmbeddingMode(e.target.value as db.EmbeddingMode)}
            data-embedding-mode
            className="h-9 rounded-xl border border-white/10 bg-white/[0.03] px-2 text-[11px] text-slate-300 outline-none focus:border-emerald-500/40"
          >
            <option value="local">Local baseline</option>
            <option value="openai">OpenAI compatible</option>
            <option value="ollama">Ollama</option>
          </select>
          <input
            value={embeddingBaseUrl}
            onChange={(e) => setEmbeddingBaseUrl(e.target.value)}
            placeholder="Base URL (e.g. http://localhost:11434)"
            data-embedding-base-url
            className="h-9 min-w-0 rounded-xl border border-white/10 bg-white/[0.03] px-3 font-mono text-[11px] text-slate-300 outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
          />
          <input
            value={embeddingModel}
            onChange={(e) => setEmbeddingModel(e.target.value)}
            placeholder="Embedding model (e.g. nomic-embed-text)"
            data-embedding-model
            className="h-9 min-w-0 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-[11px] text-slate-300 outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
          />
        </div>

        <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto_auto]">
          <input
            value={embeddingApiKey}
            onChange={(e) => setEmbeddingApiKey(e.target.value)}
            type="password"
            placeholder="API key (optional)"
            data-embedding-api-key
            className="h-8 min-w-0 rounded-lg border border-white/10 bg-white/[0.03] px-2 text-[10px] text-slate-300 outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
          />
          <input
            value={embeddingShards}
            onChange={(e) => setEmbeddingShards(e.target.value)}
            type="number"
            min={1}
            max={64}
            aria-label="Vector shard count"
            data-embedding-shards
            className="h-8 w-20 rounded-lg border border-white/10 bg-white/[0.03] px-2 text-[10px] text-slate-300 outline-none focus:border-emerald-500/40"
          />
          <input
            value={embeddingProbe}
            onChange={(e) => setEmbeddingProbe(e.target.value)}
            type="number"
            min={1}
            max={64}
            aria-label="ANN probe count"
            data-vector-probe-count
            className="h-8 w-16 rounded-lg border border-white/10 bg-white/[0.03] px-2 text-[10px] text-slate-300 outline-none focus:border-emerald-500/40"
          />
          <label className="flex h-8 items-center gap-1.5 rounded-lg bg-white/[0.03] px-2 text-[9px] text-slate-400">
            <input
              type="checkbox"
              data-vector-ann-enabled
              checked={embeddingAnn}
              onChange={(e) => setEmbeddingAnn(e.target.checked)}
              className="accent-emerald-500"
            />
            ANN
          </label>
          <label className="flex h-8 items-center gap-1.5 rounded-lg bg-white/[0.03] px-2 text-[9px] text-slate-400">
            <input
              type="checkbox"
              data-embedding-auto
              checked={embeddingAuto}
              onChange={(e) => setEmbeddingAuto(e.target.checked)}
              className="accent-emerald-500"
            />
            auto rebuild
          </label>
          <button
            type="button"
            data-embedding-save
            onClick={() => void saveEmbeddingConfig()}
            className="flex h-8 items-center justify-center rounded-lg accent-bg-20 px-3 text-[10px] accent-text-strong accent-hover-bg-30"
          >
            <Save size={12} className="mr-1.5" />
            Save config
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="flex h-8 items-center gap-1.5 rounded-lg bg-white/[0.03] px-2 text-[9px] text-slate-400">
            <input
              type="checkbox"
              data-vector-rebuild-force
              checked={vectorRebuildForce}
              onChange={(e) => setVectorRebuildForce(e.target.checked)}
              className="accent-emerald-500"
            />
            force
          </label>
          <button
            type="button"
            data-vector-rebuild
            onClick={() => void runVectorRebuild()}
            disabled={vectorRebuildBusy}
            className="flex h-8 items-center gap-1.5 rounded-lg accent-bg-20 px-3 text-[10px] accent-text-strong accent-hover-bg-30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={12} className={vectorRebuildBusy ? 'animate-spin' : ''} />
            {vectorRebuildBusy ? 'Rebuilding...' : 'Rebuild index'}
          </button>
          {vectorMessage && (
            <span
              data-vector-rebuild-result
              className="max-w-full truncate rounded-md bg-white/5 px-2 py-1 text-[10px] text-slate-400"
            >
              {vectorMessage}
            </span>
          )}
          {embeddingConfig && (
            <span className="ml-auto text-[9px] text-slate-600">
              config {embeddingConfig.mode} · {embeddingConfig.dimension}d ·{' '}
              {embeddingConfig.shardCount} shards | probe {embeddingConfig.probeCount} | ANN{' '}
              {embeddingConfig.annEnabled ? 'on' : 'off'}
            </span>
          )}
        </div>

        <div
          data-vector-shard-list
          className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-8"
        >
          {(vectorStatus?.shards ?? []).map((shard) => (
            <div
              key={shard.shardId}
              data-vector-shard-item
              data-vector-shard-id={shard.shardId}
              data-vector-shard-centroid={shard.centroid ? 'ready' : ''}
              className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[9px] text-slate-400">shard {shard.shardId}</span>
                <span
                  data-vector-shard-status
                  className={`rounded px-1 text-[8px] ${
                    shard.status === 'ready'
                      ? 'bg-emerald-500/10 text-emerald-300'
                      : 'bg-slate-500/10 text-slate-500'
                  }`}
                >
                  {shard.status}
                </span>
              </div>
              <p
                data-vector-shard-docs={shard.documents}
                className="mt-1 text-[9px] text-slate-500"
              >
                {shard.centroid ? 'centroid ready' : ''}
                {shard.documents} docs · {shard.dimension}d
              </p>
            </div>
          ))}
        </div>
      </BentoCard>

      <BentoCard title="Semantic clusters" subtitle="语义聚类与文档去重" icon={Layers} colSpan={12}>
        <div className="mb-2 grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
          <label className="flex h-8 items-center gap-1.5 rounded-lg bg-white/[0.03] px-2 text-[9px] text-slate-400">
            <span className="shrink-0">cluster</span>
            <input
              value={clusterThreshold}
              onChange={(e) => setClusterThreshold(e.target.value)}
              type="number"
              min={0}
              max={1}
              step={0.01}
              data-cluster-threshold
              className="h-7 min-w-0 flex-1 rounded-md border border-white/10 bg-transparent px-2 font-mono text-[10px] text-slate-300 outline-none focus:border-emerald-500/40"
            />
          </label>
          <label className="flex h-8 items-center gap-1.5 rounded-lg bg-white/[0.03] px-2 text-[9px] text-slate-400">
            <span className="shrink-0">dedup</span>
            <input
              value={dedupThreshold}
              onChange={(e) => setDedupThreshold(e.target.value)}
              type="number"
              min={0}
              max={1}
              step={0.01}
              data-dedup-threshold
              className="h-7 min-w-0 flex-1 rounded-md border border-white/10 bg-transparent px-2 font-mono text-[10px] text-slate-300 outline-none focus:border-emerald-500/40"
            />
          </label>
          <button
            type="button"
            data-cluster-recompute
            onClick={() => void runClusterRecompute()}
            disabled={clusterBusy}
            className="flex h-8 items-center justify-center gap-1.5 rounded-lg accent-bg-20 px-3 text-[10px] accent-text-strong accent-hover-bg-30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={12} className={clusterBusy ? 'animate-spin' : ''} />
            {clusterBusy ? 'Recomputing...' : 'Recompute'}
          </button>
          <span
            data-cluster-message
            className="flex h-8 items-center rounded-md bg-white/5 px-2 text-[10px] text-slate-500"
          >
            {clusterMessage ||
              `${clusterStatus?.clusters.length ?? 0} clusters 路 ${clusterStatus?.dedup.filter((c) => c.status === 'open').length ?? 0} dupes`}
          </span>
        </div>

        <div className="grid gap-2 lg:grid-cols-2">
          <div
            data-cluster-list
            className="grid max-h-64 gap-1.5 overflow-y-auto rounded-xl border border-white/10 bg-white/[0.02] p-2"
          >
            {(clusterStatus?.clusters ?? []).map((cluster) => (
              <div
                key={cluster.id}
                data-cluster-item
                data-cluster-docs={cluster.documents}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5"
              >
                <button
                  type="button"
                  data-cluster-toggle
                  onClick={() =>
                    setExpandedCluster((current) => (current === cluster.id ? null : cluster.id))
                  }
                  className="flex w-full items-center gap-2 text-left"
                >
                  <span data-cluster-id className="text-[9px] text-slate-500">
                    {cluster.id}
                  </span>
                  <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] text-emerald-300">
                    {cluster.documents} docs
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[9px] text-slate-400">
                    {cluster.representative.split('\n')[0] || 'Untitled'}
                  </span>
                </button>
                {expandedCluster === cluster.id && (
                  <div className="mt-1.5 flex flex-col gap-1 border-t border-white/5 pt-1.5">
                    {cluster.members.map((member) => (
                      <div
                        key={member.id}
                        data-cluster-member
                        className="flex items-center gap-2 text-[9px] text-slate-500"
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {member.title || member.path}
                        </span>
                        <span data-cluster-member-similarity className="font-mono text-slate-600">
                          {member.similarity.toFixed(3)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {(clusterStatus?.clusters ?? []).length === 0 && (
              <div className="py-6 text-center text-[10px] text-slate-600">No clusters yet</div>
            )}
          </div>

          <div
            data-dedup-list
            className="grid max-h-64 gap-1.5 overflow-y-auto rounded-xl border border-white/10 bg-white/[0.02] p-2"
          >
            {(clusterStatus?.dedup ?? [])
              .filter((candidate) => candidate.status === 'open')
              .map((candidate) => (
                <div
                  key={candidate.id}
                  data-dedup-item
                  data-dedup-similarity={candidate.similarity.toFixed(3)}
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[9px] text-slate-300">
                      {candidate.titleA} ↔ {candidate.titleB}
                    </span>
                    <span className="block text-[8px] text-slate-600">
                      similarity {candidate.similarity.toFixed(3)}
                    </span>
                  </span>
                  <button
                    type="button"
                    data-dedup-dismiss
                    data-dedup-id={candidate.id}
                    onClick={() => void dismissDedup(candidate.id)}
                    className="rounded-md bg-white/[0.06] px-2 py-1 text-[9px] text-slate-400 hover:bg-white/[0.1]"
                  >
                    Dismiss
                  </button>
                  <button
                    type="button"
                    data-dedup-merge
                    data-dedup-id={candidate.id}
                    onClick={() => void mergeDedup(candidate.id)}
                    className="rounded-md bg-amber-500/15 px-2 py-1 text-[9px] text-amber-300 hover:bg-amber-500/25"
                  >
                    Merge
                  </button>
                </div>
              ))}
            {(clusterStatus?.dedup ?? []).filter((candidate) => candidate.status === 'open')
              .length === 0 && (
              <div className="py-6 text-center text-[10px] text-slate-600">No duplicates found</div>
            )}
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
              data-rag-result={t.id}
              data-rag-vector-score={
                'vectorScore' in t && typeof t.vectorScore === 'number'
                  ? t.vectorScore.toFixed(2)
                  : ''
              }
              data-rag-file={t.type === 'doc' ? t.id : ''}
              data-rag-shard={'shardId' in t && t.shardId ? t.shardId : ''}
              data-rag-embedding-model={
                'embeddingModel' in t && t.embeddingModel ? t.embeddingModel : ''
              }
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
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <div
                    data-thought-type-select={selected.id}
                    data-thought-type-current={selected.type}
                    className="flex h-6 items-center gap-0.5 rounded-md border border-white/10 bg-white/[0.03] p-0.5"
                  >
                    {(['inbox', 'note', 'doc'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        data-thought-type-option={type}
                        data-thought-type-active={selected.type === type ? 'true' : 'false'}
                        onClick={() => {
                          if (selectedLocal) void convertType(selectedLocal, type);
                        }}
                        className={`h-5 rounded px-2 text-[9px] transition-colors ${
                          selected.type === type
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                  {selectedLocal && typeEditResults[selectedLocal.id] && (
                    <span
                      data-thought-type-result={selectedLocal.id}
                      className="inline-block rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] text-emerald-300"
                    >
                      {typeEditResults[selectedLocal.id]}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <ModelBadge label={selected.tags} tone="green" />
                  <button
                    type="button"
                    data-thought-discuss={selected.id}
                    data-thought-discuss-title={selected.content.split('\n')[0]}
                    onClick={() => discussNote(selected)}
                    className="flex h-6 items-center gap-1 rounded-lg bg-emerald-500/15 px-2 text-[9px] font-medium text-emerald-300 hover:bg-emerald-500/25"
                  >
                    <Sparkles size={10} /> 讨论此笔记
                  </button>
                  {selectedLocal && (
                    <button
                      type="button"
                      data-thought-tags-edit={selected.id}
                      data-thought-tags-current={selected.tags}
                      onClick={() => startTagEdit(selectedLocal)}
                      className="flex h-6 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-1.5 text-[9px] text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
                    >
                      <Tags size={10} /> Edit tags
                    </button>
                  )}
                  {selectedLocal && (
                    <button
                      type="button"
                      data-thought-body-edit={selected.id}
                      data-thought-body-current={selected.content}
                      onClick={() => startBodyEdit(selectedLocal)}
                      className="flex h-6 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-1.5 text-[9px] text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
                    >
                      <Pencil size={10} /> Edit body
                    </button>
                  )}
                  {selectedLocal &&
                    (deleteConfirmId === selectedLocal.id ? (
                      <>
                        <button
                          type="button"
                          data-thought-delete-confirm={selectedLocal.id}
                          onClick={() => void confirmDeleteThought(selectedLocal)}
                          className="flex h-6 items-center gap-1 rounded-lg bg-rose-500/25 px-1.5 text-[9px] text-rose-300 hover:bg-rose-500/35"
                        >
                          <Trash2 size={10} /> Sure?
                        </button>
                        <button
                          type="button"
                          data-thought-delete-cancel={selectedLocal.id}
                          onClick={cancelDelete}
                          className="h-6 rounded-lg border border-white/10 px-1.5 text-[9px] text-slate-500 hover:text-slate-300"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        data-thought-delete={selectedLocal.id}
                        onClick={() => requestDelete(selectedLocal)}
                        className="flex h-6 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-1.5 text-[9px] text-slate-400 hover:bg-rose-500/10 hover:text-rose-300"
                      >
                        <Trash2 size={10} /> Delete
                      </button>
                    ))}
                  {selectedLocal && deleteResults[selectedLocal.id] && (
                    <span
                      data-thought-delete-result={selectedLocal.id}
                      className="inline-block rounded bg-rose-500/10 px-1.5 py-0.5 text-[9px] text-rose-300"
                    >
                      {deleteResults[selectedLocal.id]}
                    </span>
                  )}
                </div>
              </div>
              {selectedLocal && tagEditId === selectedLocal.id && (
                <div
                  data-thought-tags-editor={selectedLocal.id}
                  className="mb-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.02] p-1.5"
                >
                  <input
                    data-thought-tags-input={selectedLocal.id}
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void saveTagEdit(selectedLocal);
                      }
                    }}
                    placeholder="#work,#life"
                    className="h-7 min-w-0 flex-1 rounded-md border border-white/10 bg-black/20 px-2 text-[10px] text-slate-200 outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
                  />
                  <button
                    type="button"
                    data-thought-tags-save={selectedLocal.id}
                    onClick={() => void saveTagEdit(selectedLocal)}
                    className="flex h-7 items-center gap-1 rounded-md bg-emerald-500/15 px-2 text-[10px] text-emerald-300 hover:bg-emerald-500/25"
                  >
                    <Save size={10} /> Save
                  </button>
                  <button
                    type="button"
                    data-thought-tags-cancel={selectedLocal.id}
                    onClick={() => setTagEditId(null)}
                    className="h-7 rounded-md border border-white/10 px-2 text-[10px] text-slate-500 hover:text-slate-300"
                  >
                    Cancel
                  </button>
                </div>
              )}
              {selectedLocal && tagEditResults[selectedLocal.id] && (
                <span
                  data-thought-tags-result={selectedLocal.id}
                  className="mb-2 inline-block rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] text-emerald-300"
                >
                  {tagEditResults[selectedLocal.id]}
                </span>
              )}
              {selectedLocal && bodyEditId === selectedLocal.id ? (
                <div
                  data-thought-body-editor={selectedLocal.id}
                  className="relative mb-2 flex min-h-0 flex-1 flex-col gap-1.5 rounded-lg border border-white/10 bg-white/[0.02] p-1.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex h-6 shrink-0 items-center gap-0.5 rounded-md border border-white/10 bg-white/[0.03] p-0.5">
                      <button
                        type="button"
                        data-thought-body-mode="edit"
                        onClick={() => setBodyPreview(false)}
                        className={`h-5 rounded px-2 text-[9px] transition-colors ${
                          !bodyPreview
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        data-thought-body-mode="preview"
                        onClick={() => {
                          closeWikiSuggestions();
                          setBodyPreview(true);
                        }}
                        className={`h-5 rounded px-2 text-[9px] transition-colors ${
                          bodyPreview
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        Preview
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        data-thought-body-save={selectedLocal.id}
                        onClick={() => void saveBodyEdit(selectedLocal)}
                        className="flex h-6 items-center gap-1 rounded-md bg-emerald-500/15 px-2 text-[10px] text-emerald-300 hover:bg-emerald-500/25"
                      >
                        <Save size={10} /> Save
                      </button>
                      <button
                        type="button"
                        data-thought-body-cancel={selectedLocal.id}
                        onClick={cancelBodyEdit}
                        className="h-6 rounded-md border border-white/10 px-2 text-[10px] text-slate-500 hover:text-slate-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                  {!bodyPreview && wikiSuggestions.length > 0 && (
                    <div
                      data-wiki-link-suggestions
                      className="absolute left-1.5 right-1.5 top-9 z-20 max-h-40 overflow-y-auto rounded-lg border border-white/10 bg-[#202024] p-1 shadow-xl"
                    >
                      {wikiSuggestions.map((suggestion, index) => (
                        <button
                          key={suggestion.id}
                          type="button"
                          data-wiki-link-suggestion={suggestion.title}
                          data-wiki-link-active={index === wikiActiveIndex ? 'true' : 'false'}
                          onMouseEnter={() => setWikiActiveIndex(index)}
                          onClick={() => insertWikiSuggestion(suggestion.title)}
                          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[10px] transition-colors ${
                            index === wikiActiveIndex
                              ? 'bg-emerald-500/15 text-emerald-200'
                              : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-200'
                          }`}
                        >
                          <span className="truncate">{suggestion.title}</span>
                          <span className="ml-auto shrink-0 rounded bg-white/5 px-1 py-0.5 font-mono text-[8px] text-slate-500">
                            {suggestion.tags.split(',')[0]?.trim() || 'untagged'}
                          </span>
                          <span className="shrink-0 rounded bg-white/5 px-1 py-0.5 font-mono text-[8px] text-slate-600">
                            {suggestion.type}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {bodyPreview ? (
                    <div
                      data-thought-body-preview={selectedLocal.id}
                      className="markdown-body min-h-0 flex-1 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-2 text-xs leading-relaxed text-slate-300"
                    >
                      <ReactMarkdown>{bodyDraft || '*Empty*'}</ReactMarkdown>
                    </div>
                  ) : (
                    <textarea
                      data-thought-body-input={selectedLocal.id}
                      value={bodyDraft}
                      onChange={(e) => {
                        const value = e.target.value;
                        const caret = e.target.selectionStart ?? value.length;
                        handleBodyDraftChange(value, caret);
                      }}
                      onKeyDown={(e) => {
                        if (wikiSuggestions.length > 0 && e.key === 'ArrowDown') {
                          e.preventDefault();
                          setWikiActiveIndex((prev) => (prev + 1) % wikiSuggestions.length);
                          return;
                        }
                        if (wikiSuggestions.length > 0 && e.key === 'ArrowUp') {
                          e.preventDefault();
                          setWikiActiveIndex(
                            (prev) => (prev - 1 + wikiSuggestions.length) % wikiSuggestions.length,
                          );
                          return;
                        }
                        if (wikiSuggestions.length > 0 && e.key === 'Escape') {
                          e.preventDefault();
                          closeWikiSuggestions();
                          return;
                        }
                        if (wikiSuggestions.length > 0 && (e.key === 'Enter' || e.key === 'Tab')) {
                          e.preventDefault();
                          const suggestion = wikiSuggestions[wikiActiveIndex];
                          if (suggestion) insertWikiSuggestion(suggestion.title);
                          return;
                        }
                        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                          e.preventDefault();
                          void saveBodyEdit(selectedLocal);
                        }
                      }}
                      placeholder="Write markdown..."
                      className="min-h-40 flex-1 resize-none rounded-lg border border-white/10 bg-black/20 p-2 text-[11px] leading-relaxed text-slate-200 outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
                    />
                  )}
                </div>
              ) : (
                <div className="markdown-body min-h-0 flex-1 overflow-y-auto text-xs leading-relaxed text-slate-300">
                  <ReactMarkdown>{selected.content}</ReactMarkdown>
                </div>
              )}
              {selectedLocal && bodyEditResults[selectedLocal.id] && (
                <span
                  data-thought-body-result={selectedLocal.id}
                  className="mt-2 inline-block rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] text-emerald-300"
                >
                  {bodyEditResults[selectedLocal.id]}
                </span>
              )}
              <div
                data-thought-links
                className="mt-3 rounded-lg border border-white/10 bg-white/[0.02] p-2"
              >
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  <Link2 size={10} className="text-slate-500" />
                  <span className="text-[9px] text-slate-500">Wiki links</span>
                  <span
                    data-knowledge-graph-stats
                    className="ml-auto rounded-md bg-white/5 px-1.5 py-0.5 text-[9px] text-slate-400"
                  >
                    {totalLinks} links · {selectedIncoming.length} backlinks · {missingLinks}{' '}
                    missing
                  </span>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <div data-thought-links-outgoing>
                    <div className="mb-1 text-[9px] text-slate-600">
                      Outgoing ({selectedOutgoing.length})
                    </div>
                    {selectedOutgoing.length === 0 && (
                      <div className="text-[9px] text-slate-700">No outgoing links</div>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {selectedOutgoing.map((ref) => (
                        <button
                          key={`${ref.id}-${ref.target}`}
                          type="button"
                          data-thought-link-out
                          data-thought-link-target={ref.target}
                          data-thought-link-alias={ref.alias}
                          onClick={() => navigateToThought(ref.id)}
                          className="flex h-6 items-center rounded-md bg-sky-500/10 px-2 text-[9px] text-sky-300 hover:bg-sky-500/20"
                        >
                          {ref.alias}
                        </button>
                      ))}
                      {selectedLocal &&
                        db
                          .extractWikiLinks(selectedLocal.content)
                          .filter((link) => !db.resolveWikiLinkTarget(thoughts, link.target))
                          .map((link) => (
                            <span
                              key={link.target}
                              data-thought-link-missing
                              data-thought-link-target={link.target}
                              className="flex h-6 items-center rounded-md bg-amber-500/10 px-2 text-[9px] text-amber-300/80"
                            >
                              {link.alias} ?
                            </span>
                          ))}
                    </div>
                  </div>
                  <div data-thought-links-incoming>
                    <div className="mb-1 text-[9px] text-slate-600">
                      Backlinks ({selectedIncoming.length})
                    </div>
                    {selectedIncoming.length === 0 && (
                      <div className="text-[9px] text-slate-700">No backlinks</div>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {selectedIncoming.map((ref) => (
                        <button
                          key={`${ref.id}-${ref.target}`}
                          type="button"
                          data-thought-link-back
                          data-thought-link-target={ref.target}
                          data-thought-link-source={ref.id}
                          onClick={() => navigateToThought(ref.id)}
                          className="flex h-6 items-center rounded-md bg-emerald-500/10 px-2 text-[9px] text-emerald-300 hover:bg-emerald-500/20"
                        >
                          {ref.alias} · {ref.title}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
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
