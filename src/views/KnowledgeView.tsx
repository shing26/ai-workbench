import {
  AlertTriangle,
  BookOpen,
  ExternalLink,
  Layers,
  MessageCircle,
  Network,
  Puzzle,
  Search,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as db from '../lib/db';
import { toast } from '../lib/toast';
import { usePrismModals } from '../components/modals/prismModalsStore';
import { TOPICS, useEvent } from '../stores/events';
import { useWorkbenchStore } from '../stores/workbenchStore';
import { useViewState } from '../stores/viewState';

function thoughtTitle(thought: db.Thought): string {
  return (thought.content || '').split('\n').find((line) => line.trim()) || thought.id;
}

function thoughtPreview(thought: db.Thought): string {
  return (thought.content || '')
    .split('\n')
    .filter((line) => line.trim())
    .slice(1, 4)
    .join(' ')
    .slice(0, 160);
}

function thoughtActivity(thought: db.Thought): 'hot' | 'warn' | 'cold' | 'archived' {
  if (thought.tags.includes('archived')) return 'archived';
  const last = thought.lastReferencedAt ?? thought.createdAt;
  const days = (Date.now() - last) / 86_400_000;
  if (days < 3) return 'hot';
  if (days < 21) return 'warn';
  return 'cold';
}

const ACTIVITY_META: Record<
  'hot' | 'warn' | 'cold' | 'archived',
  { label: string; cls: string; badge: string }
> = {
  hot: {
    label: '近期活跃',
    badge: '🔥',
    cls: 'border-emerald-500/30 text-emerald-300',
  },
  warn: {
    label: '需要关注',
    badge: '⚠️',
    cls: 'border-amber-500/30 text-amber-300',
  },
  cold: {
    label: '长期未激活',
    badge: '❄️',
    cls: 'border-white/10 text-slate-400',
  },
  archived: {
    label: '已归档旅程',
    badge: '📚',
    cls: 'border-cyan-500/30 text-cyan-300',
  },
};

export default function KnowledgeView() {
  const thoughts = useWorkbenchStore((s) => s.thoughts);
  const projects = useWorkbenchStore((s) => s.projects);
  const updateProjectJourney = useWorkbenchStore((s) => s.updateProjectJourney);
  const setNoteContext = useWorkbenchStore((s) => s.setNoteContext);
  const setActiveView = useWorkbenchStore((s) => s.setActiveView);
  const vibeContext = useWorkbenchStore((s) => s.vibeContext);
  const openSearch = usePrismModals((s) => s.openSearch);
  const [prismViewMode, setPrismViewMode] = useViewState<'grid' | 'graph'>(
    'knowledge',
    'prismViewMode',
    'grid',
  );
  const [filter, setFilter] = useViewState<'all' | db.ThoughtType>('knowledge', 'filter', 'all');
  const [query, setQuery] = useViewState('knowledge', 'query', '');
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [obsidianResults, setObsidianResults] = useState<Record<string, string>>({});
  const cardRefs = useRef(new Map<string, HTMLDivElement>());

  const coverage = useMemo(() => {
    const total = projects.length;
    const documented = projects.filter(
      (p) =>
        (p.material && p.material.trim().length > 0) ||
        thoughts.some((t) => t.tags.includes(p.id) || (t.content || '').includes(p.name)),
    ).length;
    return {
      documented,
      total,
      pct: total > 0 ? Math.round((documented / total) * 100) : 100,
    };
  }, [projects, thoughts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (filter === 'all' ? thoughts : thoughts.filter((t) => t.type === filter)).filter(
      (t) => !q || `${thoughtTitle(t)} ${t.content} ${t.tags}`.toLowerCase().includes(q),
    );
  }, [thoughts, filter, query]);

  const graphItems = useMemo(() => {
    const nodes = filtered.slice(0, 24).map((thought, index) => {
      const angle = (index * 137.508 * Math.PI) / 180;
      return {
        thought,
        x: 50 + Math.cos(angle) * 38,
        y: 50 + Math.sin(angle) * 34,
      };
    });
    const edges = nodes.slice(1).map((node, index) => {
      const from = nodes[index];
      const dx = node.x - from.x;
      const dy = node.y - from.y;
      return {
        x1: from.x,
        y1: from.y,
        x2: node.x,
        y2: node.y,
        width: Math.hypot(dx, dy),
        angle: (Math.atan2(dy, dx) * 180) / Math.PI,
      };
    });
    return { nodes, edges };
  }, [filtered]);

  const injectNoteContext = (thought: db.Thought) => {
    void db.recordThoughtReference(thought.id);
    setNoteContext({
      thoughtId: thought.id,
      title: thoughtTitle(thought),
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
    setObsidianResults((prev) => ({ ...prev, [thought.id]: '打开中...' }));
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

  const reopenArchived = async (thought: db.Thought) => {
    const projectTag = thought.tags
      .split(',')
      .map((tag) => tag.trim())
      .find((tag) => tag.startsWith('#project-'));
    const projectId = projectTag?.replace('#project-', '');
    const project = projectId ? projects.find((p) => p.id === projectId) : undefined;
    if (!project) {
      toast.error('未找到关联项目，无法重新打开');
      return;
    }
    await updateProjectJourney(project.id, 'ready', project.journeyDocPath);
    await db.recordThoughtReference(thought.id);
    toast.success(`已重新打开「${project.name}」`);
  };

  useEvent<{ thoughtId: string }>(TOPICS.COMMAND_OPEN_THOUGHT, ({ thoughtId }) => {
    const target = thoughts.find((t) => t.id === thoughtId);
    if (!target) return;
    setFilter('all');
    setHighlightId(thoughtId);
    window.setTimeout(() => {
      const node = cardRefs.current.get(thoughtId);
      node?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
    window.setTimeout(() => setHighlightId(null), 2400);
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key.toLowerCase() === '/') {
        e.preventDefault();
        openSearch();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openSearch]);

  return (
    <div className="mission-view space-y-4 p-4 sm:p-5 lg:space-y-5">
      <div className="pc-section-head">
        <span className="pc-section-code">SYS.05 / LIVING MEMORY</span>
        <span className="pc-section-title">活体知识库</span>
        <span className="pc-section-meta">
          {thoughts.length} 卡片 · 覆盖率 {coverage.pct}%
        </span>
      </div>

      <div className="pc-kb-toolbar">
        <div className="pc-kb-search">
          <Search size={14} className="shrink-0" style={{ color: 'var(--prism-accent-strong)' }} />
          <input
            data-knowledge-search
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="自然语言搜索，如：上次 UI 降噪方案…"
          />
          <kbd>⌘K</kbd>
        </div>

        <div className="pc-seg">
          <button
            type="button"
            data-prism-view-grid
            data-active={prismViewMode === 'grid' ? 'true' : 'false'}
            onClick={() => setPrismViewMode('grid')}
            className={prismViewMode === 'grid' ? 'active' : ''}
          >
            <Layers size={11} />
            田字格
          </button>
          <button
            type="button"
            data-prism-view-graph
            data-active={prismViewMode === 'graph' ? 'true' : 'false'}
            onClick={() => setPrismViewMode('graph')}
            className={prismViewMode === 'graph' ? 'active' : ''}
          >
            <Network size={11} />
            图谱
          </button>
        </div>
      </div>

      {coverage.total > 0 && coverage.pct < 50 && (
        <div
          data-knowledge-coverage-warning
          className="flex items-center gap-2 rounded border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[11px] text-amber-300"
        >
          <AlertTriangle size={14} className="shrink-0" />
          <span>
            知识覆盖率 {coverage.pct}%（{coverage.documented}/{coverage.total} 已文档化）低于
            50%，建议为项目固化 Spec。
          </span>
        </div>
      )}

      {prismViewMode === 'graph' ? (
        <div data-prism-graph className="pc-panel pc-graph-view">
          {graphItems.edges.map((edge, index) => (
            <span
              key={`edge-${index}`}
              className="pc-graph-edge"
              style={{
                left: `${edge.x1}%`,
                top: `${edge.y1}%`,
                width: `${edge.width}%`,
                transform: `rotate(${edge.angle}deg)`,
              }}
            />
          ))}
          {graphItems.nodes.map(({ thought, x, y }) => (
            <button
              key={thought.id}
              type="button"
              data-prism-graph-node={thought.id}
              data-prism-activity={thoughtActivity(thought)}
              onClick={() => injectNoteContext(thought)}
              className="pc-graph-node"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <i />
              <span className="max-w-[130px] truncate">{thoughtTitle(thought)}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="absolute inset-0 grid place-items-center text-[11px] text-slate-600">
              暂无知识卡片，去 AI Studio 论证后固化为知识
            </div>
          )}
        </div>
      ) : (
        <div className="pc-kb-grid">
          {filtered.map((t, index) => {
            const act = thoughtActivity(t);
            const meta = ACTIVITY_META[act];
            const last = t.lastReferencedAt ?? t.createdAt;
            const days = Math.max(0, Math.floor((Date.now() - last) / 86_400_000));
            const highlighted = highlightId === t.id;
            return (
              <div
                key={t.id}
                ref={(node) => {
                  if (node) cardRefs.current.set(t.id, node);
                  else cardRefs.current.delete(t.id);
                }}
                data-prism-card={t.id}
                data-prism-activity={act}
                className={`pc-panel pc-kb-card ${index === 0 ? 'wide' : ''} ${
                  highlighted ? 'ring-2 ring-cyan-400/60' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="pc-badge cyan">
                      {t.type === 'doc' ? '📄 文档' : t.type === 'note' ? '📝 笔记' : '💡 闪念'}
                    </span>
                    <h3 className="pc-kb-title truncate">{thoughtTitle(t)}</h3>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.cls}`}
                  >
                    {meta.badge} {days === 0 ? '今日' : `${days}天`}
                  </span>
                </div>

                {thoughtPreview(t) && (
                  <p className="pc-kb-desc line-clamp-2">{thoughtPreview(t)}</p>
                )}

                <div className="pc-kb-tags">
                  <span className="pc-kb-tag">{meta.label}</span>
                  {t.tags
                    .split(',')
                    .filter((tag) => tag.trim())
                    .slice(0, 3)
                    .map((tag) => (
                      <span key={tag} className="pc-kb-tag">
                        {tag.trim()}
                      </span>
                    ))}
                </div>

                <div className="pc-kb-actions">
                  <button
                    type="button"
                    data-prism-inject-context={t.id}
                    onClick={() => injectNoteContext(t)}
                    title="⚡ 注入 Context 到 AI Studio"
                    className="pc-mini-btn"
                  >
                    <Zap size={10} />
                    注入 Context
                  </button>
                  <button
                    type="button"
                    data-prism-split-dod={t.id}
                    onClick={() => injectNoteContext(t)}
                    title="🧩 拆解 DoD"
                    className="pc-mini-btn"
                    style={{ color: 'var(--color-warning)', borderColor: 'rgba(245,158,11,0.3)' }}
                  >
                    <Puzzle size={10} />
                    拆解 DoD
                  </button>
                  <button
                    type="button"
                    data-prism-debate={t.id}
                    onClick={() => injectNoteContext(t)}
                    title="💬 论证"
                    className="pc-mini-btn"
                  >
                    <MessageCircle size={10} />
                    论证
                  </button>
                  <button
                    type="button"
                    data-prism-obsidian={t.id}
                    onClick={() => void openObsidianFor(t)}
                    title="📓 Obsidian"
                    className="pc-mini-btn"
                    style={{ color: '#a78bfa', borderColor: 'rgba(167,139,250,0.35)' }}
                  >
                    <ExternalLink size={10} />
                    {obsidianResults[t.id] || 'Obsidian'}
                  </button>
                  {act === 'archived' && (
                    <button
                      type="button"
                      data-prism-reopen={t.id}
                      onClick={() => void reopenArchived(t)}
                      title="📂 重新打开项目旅程"
                      className="pc-mini-btn"
                    >
                      <ExternalLink size={10} />
                      重新打开
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full flex flex-col items-center gap-2 py-16 text-xs text-slate-600">
              <BookOpen size={20} className="text-slate-700" />
              暂无知识卡片，去 AI Studio 论证后固化为知识
            </div>
          )}
        </div>
      )}
    </div>
  );
}
