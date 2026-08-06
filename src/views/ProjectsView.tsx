import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FolderKanban,
  GitBranch,
  GitMerge,
  Orbit,
  Plus,
  RefreshCw,
  Trash2,
  Undo2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import * as db from '../lib/db';
import {
  detectLanguage,
  highlightLine,
  parseDiffLines,
  type DiffLineKind,
} from '../lib/diffHighlight';
import { useWorkbenchStore } from '../stores/workbenchStore';
import BentoCard from '../components/ui/BentoCard';
import ProjectCarousel from '../components/ui/ProjectCarousel';
import StatPill from '../components/ui/StatPill';
import ModelBadge from '../components/ui/ModelBadge';
import { resetTilt, tiltCard } from '../lib/tilt';

const PROJECT_MATERIALS = ['cyan', 'original', 'rain', 'chrome'] as const;
const GIT_RANGES = [
  { value: 'all', label: 'All time', ms: 0 },
  { value: '24h', label: '24 hours', ms: 86_400_000 },
  { value: '7d', label: '7 days', ms: 7 * 86_400_000 },
  { value: '30d', label: '30 days', ms: 30 * 86_400_000 },
];
const GIT_CHANGE_GROUPS = [
  { key: 'staged', label: 'Staged' },
  { key: 'unstaged', label: 'Unstaged' },
  { key: 'untracked', label: 'Untracked' },
  { key: 'both', label: 'Both' },
] as const;

function diffLineClass(kind: DiffLineKind): string {
  switch (kind) {
    case 'file':
      return 'text-slate-500';
    case 'hunk':
      return 'text-cyan-300/90';
    case 'add':
      return 'bg-emerald-500/10 text-emerald-300/90';
    case 'del':
      return 'bg-rose-500/10 text-rose-300/90';
    default:
      return 'text-slate-400';
  }
}

function FileVersionPane({
  title,
  dataKey,
  content,
  language,
}: {
  title: string;
  dataKey: string;
  content: string;
  language: string;
}) {
  const lines = content ? content.split('\n') : [];
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-black/30">
      <div className="border-b border-white/10 px-2 py-1 text-[8px] uppercase tracking-normal text-slate-500">
        {title}
      </div>
      <div className="max-h-56 overflow-auto">
        {lines.length === 0 ? (
          <div className="px-2 py-1 text-[9px] text-slate-600">empty</div>
        ) : (
          lines.map((line, index) => (
            <div
              key={index}
              data-git-file-version={dataKey}
              className="flex gap-2 px-1 text-[9px] leading-relaxed"
            >
              <span className="w-6 shrink-0 select-none text-right text-slate-700">
                {index + 1}
              </span>
              <span className="min-w-0 whitespace-pre-wrap text-slate-300">
                {highlightLine(line, language)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function ProjectsView() {
  const projects = useWorkbenchStore((s) => s.projects);
  const addProject = useWorkbenchStore((s) => s.addProject);
  const updateProject = useWorkbenchStore((s) => s.updateProject);
  const deleteProject = useWorkbenchStore((s) => s.deleteProject);
  const openInspector = useWorkbenchStore((s) => s.openInspector);
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [gitCtx, setGitCtx] = useState<Record<string, db.GitContext>>({});
  const [drafts, setDrafts] = useState<Record<string, db.CommitPrDraft>>({});
  const [commitResults, setCommitResults] = useState<Record<string, db.GitCommitResult>>({});
  const [prResults, setPrResults] = useState<Record<string, db.RemotePrResult>>({});
  const [commitErrors, setCommitErrors] = useState<Record<string, string>>({});
  const [prErrors, setPrErrors] = useState<Record<string, string>>({});
  const [rebaseResults, setRebaseResults] = useState<Record<string, db.GitRebaseResult>>({});
  const [rebaseErrors, setRebaseErrors] = useState<Record<string, string>>({});
  const [resolveResults, setResolveResults] = useState<Record<string, db.ConflictResolutionResult>>(
    {},
  );
  const [gitActivity, setGitActivity] = useState<db.GitActivityBoard | null>(null);
  const [gitRange, setGitRange] = useState('all');
  const [gitCommitter, setGitCommitter] = useState('');
  const [expandedPreview, setExpandedPreview] = useState<string | null>(null);
  const [gitDiffs, setGitDiffs] = useState<Record<string, db.GitFileDiff>>({});
  const [loadingDiffs, setLoadingDiffs] = useState<Record<string, boolean>>({});
  const [sideBySide, setSideBySide] = useState<Record<string, boolean>>({});
  const [fileVersions, setFileVersions] = useState<Record<string, db.GitFileVersions>>({});
  const [loadingVersions, setLoadingVersions] = useState<Record<string, boolean>>({});
  const [batchDiff, setBatchDiff] = useState<{
    projectId: string;
    content: string;
  } | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Record<string, string[]>>({});
  const [lintGate, setLintGate] = useState<Record<string, { issues: db.GitLintIssue[] }>>({});
  const [exportOpen, setExportOpen] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const [projectEdits, setProjectEdits] = useState<
    Record<string, { status: string; revenue: string }>
  >({});
  const [projectEditResults, setProjectEditResults] = useState<Record<string, string>>({});
  const [confirmDeleteProjectId, setConfirmDeleteProjectId] = useState<string | null>(null);
  const projectKey = projects.map((p) => `${p.id}:${p.path}`).join('|');
  const commitTrendMax = gitActivity
    ? Math.max(1, ...gitActivity.commitTrend.buckets.map((bucket) => bucket.count))
    : 1;

  const totalRevenue = projects.reduce((sum, p) => sum + (p.revenue || 0), 0);
  const activeProjects = projects.filter((p) => p.status === 'active').length;
  const pausedProjects = projects.filter((p) => p.status === 'paused').length;
  const weekCommitPeak = gitActivity
    ? Math.max(0, ...gitActivity.commitTrend.buckets.map((b) => b.count))
    : 0;

  const portfolioReport = (() => {
    const rows = projects
      .map(
        (p) => `| ${p.name} | ${p.status} | $${(p.revenue || 0).toFixed(2)} | ${p.path || '-'} |`,
      )
      .join('\n');
    const gitRows = (gitActivity?.items ?? [])
      .map(
        (item) =>
          `| ${item.projectName} | ${item.commitCount} | ${item.branch || '-'} | ${item.dirty ? 'dirty' : 'clean'} | ${item.latestCommit || '-'} |`,
      )
      .join('\n');
    const trend = (gitActivity?.commitTrend.buckets ?? [])
      .map((bucket) => `- ${new Date(bucket.dayMs).toLocaleDateString('en')}: ${bucket.count}`)
      .join('\n');
    return `# Portfolio Summary

Generated: ${new Date().toLocaleString()}

## Overview

- Projects: ${projects.length}
- Revenue: $${totalRevenue.toFixed(2)}
- Active: ${activeProjects}
- Paused: ${pausedProjects}
- Commits: ${gitActivity?.totalCommits ?? 0}
- Dirty: ${gitActivity?.dirtyProjects ?? 0}
- Week commit peak: ${weekCommitPeak}

## Projects

| Name | Status | Revenue | Path |
| --- | --- | --- | --- |
${rows}

## Git Activity

| Project | Commits | Branch | State | Latest |
| --- | --- | --- | --- | --- |
${gitRows}

## Commit Trend

${trend}
`;
  })();

  const copyReport = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(portfolioReport);
        setCopyState('copied');
        setTimeout(() => setCopyState('idle'), 1600);
        return;
      }
    } catch {
      /* fall through to legacy copy */
    }
    try {
      const textarea = document.createElement('textarea');
      textarea.value = portfolioReport;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 1600);
    } catch {
      setCopyState('idle');
    }
  };

  const toggleGitDiff = (projectId: string, projectPath: string, file: string) => {
    const key = `${projectId}:${file}`;
    if (gitDiffs[key]) {
      setGitDiffs((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }
    if (loadingDiffs[key]) return;
    setLoadingDiffs((prev) => ({ ...prev, [key]: true }));
    void db.getGitFileDiff(projectPath, file).then((diff) => {
      setGitDiffs((prev) => ({ ...prev, [key]: diff }));
      setLoadingDiffs((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    });
  };

  const toggleSideBySide = (projectId: string, projectPath: string, file: string) => {
    const key = `${projectId}:${file}`;
    setSideBySide((prev) => ({ ...prev, [key]: !prev[key] }));
    if (!fileVersions[key] && !loadingVersions[key]) {
      setLoadingVersions((prev) => ({ ...prev, [key]: true }));
      void db.getGitFileVersions(projectPath, file).then((versions) => {
        setFileVersions((prev) => ({ ...prev, [key]: versions }));
        setLoadingVersions((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      });
    }
  };

  const loadBatchPreview = async (projectId: string, projectPath: string, files: string[]) => {
    if (batchLoading) return;
    if (batchDiff?.projectId === projectId) {
      setBatchDiff(null);
      return;
    }
    setBatchLoading(true);
    const parts: string[] = [];
    for (const file of files) {
      try {
        const diff = await db.getGitFileDiff(projectPath, file);
        parts.push(`# ${file}${diff.status ? ` (${diff.status})` : ''}\n${diff.diff}`);
      } catch {
        parts.push(`# ${file}\n(error reading diff)`);
      }
    }
    setBatchDiff({ projectId, content: parts.join('\n\n') });
    setBatchLoading(false);
  };

  const toggleSelectFile = (projectId: string, file: string) => {
    setSelectedFiles((prev) => {
      const current = prev[projectId] ?? [];
      const next = current.includes(file) ? current.filter((f) => f !== file) : [...current, file];
      return { ...prev, [projectId]: next };
    });
  };

  const commitSelected = async (item: db.GitActivityItem) => {
    const files = selectedFiles[item.projectId] ?? [];
    if (files.length === 0) return;
    try {
      const issues = await db.runCommitLintGate(item.path, files);
      if (issues.length > 0) {
        setLintGate((prev) => ({ ...prev, [item.projectId]: { issues } }));
        setCommitResults((prev) => {
          const next = { ...prev };
          delete next[item.projectId];
          return next;
        });
        return;
      }
      setLintGate((prev) => {
        const next = { ...prev };
        delete next[item.projectId];
        return next;
      });
      let draft = drafts[item.projectId];
      if (!draft) {
        draft = await db.generateCommitPrDraft(item.path, item.projectName);
        setDrafts((prev) => ({ ...prev, [item.projectId]: draft }));
      }
      const result = await db.commitGitFiles(item.path, files, draft.commitMessage);
      setCommitResults((prev) => ({ ...prev, [item.projectId]: result }));
      setCommitErrors((prev) => {
        const next = { ...prev };
        delete next[item.projectId];
        return next;
      });
      setSelectedFiles((prev) => ({ ...prev, [item.projectId]: [] }));
      setBatchDiff((prev) => (prev?.projectId === item.projectId ? null : prev));
      const board = await db.getGitActivity({});
      setGitActivity(board);
    } catch (error) {
      setCommitErrors((prev) => ({
        ...prev,
        [item.projectId]: error instanceof Error ? error.message : String(error),
      }));
    }
  };

  useEffect(() => {
    let disposed = false;
    const range = GIT_RANGES.find((r) => r.value === gitRange);
    const sinceMs = range && range.ms > 0 ? Date.now() - range.ms : undefined;
    void db.getGitActivity({ sinceMs, committer: gitCommitter || undefined }).then((board) => {
      if (!disposed) setGitActivity(board);
    });
    return () => {
      disposed = true;
    };
  }, [gitRange, gitCommitter, projectKey]);

  useEffect(() => {
    let disposed = false;
    void Promise.all(
      projects
        .filter((p) => p.path)
        .map(async (p) => [p.id, await db.getProjectGitContext(p.path ?? '')] as const),
    ).then((entries) => {
      if (!disposed) setGitCtx(Object.fromEntries(entries));
    });
    return () => {
      disposed = true;
    };
  }, [projectKey, projects]);

  const create = async () => {
    if (!name.trim()) return;
    await addProject(name.trim(), path.trim());
    setName('');
    setPath('');
  };

  const saveProjectEdit = async (project: db.Project) => {
    const draft = projectEdits[project.id];
    if (!draft) return;
    const revenue = Number(draft.revenue);
    await updateProject(
      project.id,
      draft.status,
      Number.isFinite(revenue) ? Math.max(0, revenue) : 0,
    );
    setProjectEditResults((prev) => ({ ...prev, [project.id]: 'Saved' }));
    setProjectEdits((prev) => {
      const next = { ...prev };
      delete next[project.id];
      return next;
    });
  };

  const deleteProjectRow = async (project: db.Project) => {
    await deleteProject(project.id);
    setConfirmDeleteProjectId(null);
    setProjectEdits((prev) => {
      const next = { ...prev };
      delete next[project.id];
      return next;
    });
    setProjectEditResults((prev) => {
      const next = { ...prev };
      delete next[project.id];
      return next;
    });
  };

  const aiCoding = async (project: db.Project) => {
    const ctx = await db.getProjectGitContext(project.path ?? '');
    openInspector('AI Coding', [
      { label: 'Project', value: project.name },
      { label: 'HEAD', value: ctx.head },
      { label: 'Modified files', value: ctx.changes.join('\n') || 'none' },
    ]);
  };

  const generateDraft = async (project: db.Project) => {
    const draft = await db.generateCommitPrDraft(project.path ?? '', project.name);
    setDrafts((prev) => ({ ...prev, [project.id]: draft }));
  };

  const applyDraft = async (project: db.Project) => {
    const draft = drafts[project.id];
    if (!draft) return;
    try {
      const result = await db.applyCommit(project.path ?? '', draft.commitMessage);
      setCommitResults((prev) => ({ ...prev, [project.id]: result }));
      setCommitErrors((prev) => {
        const next = { ...prev };
        delete next[project.id];
        return next;
      });
      const ctx = await db.getProjectGitContext(project.path ?? '');
      setGitCtx((prev) => ({ ...prev, [project.id]: ctx }));
    } catch (error) {
      setCommitErrors((prev) => ({
        ...prev,
        [project.id]: error instanceof Error ? error.message : String(error),
      }));
    }
  };

  const createPr = async (project: db.Project) => {
    const draft = drafts[project.id];
    if (!draft) return;
    try {
      const result = await db.createRemotePr(project.path ?? '', draft.prTitle, draft.prBody);
      setPrResults((prev) => ({ ...prev, [project.id]: result }));
      setPrErrors((prev) => {
        const next = { ...prev };
        delete next[project.id];
        return next;
      });
    } catch (error) {
      setPrErrors((prev) => ({
        ...prev,
        [project.id]: error instanceof Error ? error.message : String(error),
      }));
    }
  };

  const rebaseProject = async (project: db.Project) => {
    try {
      const result = await db.rebaseBranch(project.path ?? '', 'main');
      setRebaseResults((prev) => ({ ...prev, [project.id]: result }));
      setRebaseErrors((prev) => {
        const next = { ...prev };
        delete next[project.id];
        return next;
      });
      const ctx = await db.getProjectGitContext(project.path ?? '');
      setGitCtx((prev) => ({ ...prev, [project.id]: ctx }));
    } catch (error) {
      setRebaseErrors((prev) => ({
        ...prev,
        [project.id]: error instanceof Error ? error.message : String(error),
      }));
    }
  };

  const abortProjectRebase = async (project: db.Project) => {
    try {
      await db.abortRebase(project.path ?? '');
      setRebaseResults((prev) => {
        const next = { ...prev };
        delete next[project.id];
        return next;
      });
      setRebaseErrors((prev) => {
        const next = { ...prev };
        delete next[project.id];
        return next;
      });
      const ctx = await db.getProjectGitContext(project.path ?? '');
      setGitCtx((prev) => ({ ...prev, [project.id]: ctx }));
    } catch (error) {
      setRebaseErrors((prev) => ({
        ...prev,
        [project.id]: error instanceof Error ? error.message : String(error),
      }));
    }
  };

  const resolveConflicts = async (project: db.Project, strategy: string) => {
    try {
      const result = await db.resolveRebaseConflicts(project.path ?? '', strategy);
      setResolveResults((prev) => ({ ...prev, [project.id]: result }));
      setRebaseResults((prev) => {
        const next = { ...prev };
        delete next[project.id];
        return next;
      });
      setRebaseErrors((prev) => {
        const next = { ...prev };
        delete next[project.id];
        return next;
      });
      const ctx = await db.getProjectGitContext(project.path ?? '');
      setGitCtx((prev) => ({ ...prev, [project.id]: ctx }));
    } catch (error) {
      setRebaseErrors((prev) => ({
        ...prev,
        [project.id]: error instanceof Error ? error.message : String(error),
      }));
    }
  };

  const renderGitFiles = (item: db.GitActivityItem) => {
    const groups =
      item.changeGroups.length > 0
        ? item.changeGroups
        : item.changedPaths.map((path) => ({
            path,
            status: '',
            group: 'unstaged' as const,
          }));
    return GIT_CHANGE_GROUPS.flatMap((meta) => {
      const files = groups.filter((entry) => entry.group === meta.key);
      if (files.length === 0) return [];
      return [
        <div key={meta.key} className="flex flex-col gap-1">
          <div
            data-git-change-group-header={meta.key}
            className="rounded bg-white/[0.03] px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-[0.08em] text-slate-500"
          >
            {meta.label} · {files.length}
          </div>
          {files.map((entry) => (
            <div
              key={entry.path}
              data-git-file={entry.path}
              data-git-change-group={entry.group}
              className="flex min-w-0 flex-col gap-1"
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <input
                  type="checkbox"
                  data-git-select-file={entry.path}
                  checked={(selectedFiles[item.projectId] ?? []).includes(entry.path)}
                  onChange={() => toggleSelectFile(item.projectId, entry.path)}
                  aria-label={`Select ${entry.path}`}
                  className="h-3 w-3 shrink-0 accent-emerald-500"
                />
                <span className="min-w-0 flex-1 truncate rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-slate-500">
                  {entry.path}
                </span>
                <button
                  type="button"
                  data-git-diff-toggle={entry.path}
                  onClick={() => toggleGitDiff(item.projectId, item.path, entry.path)}
                  className="shrink-0 rounded bg-white/[0.05] px-1.5 py-0.5 text-[9px] text-slate-400 hover:bg-white/[0.08]"
                >
                  {loadingDiffs[`${item.projectId}:${entry.path}`]
                    ? 'Loading'
                    : gitDiffs[`${item.projectId}:${entry.path}`]
                      ? 'Hide diff'
                      : 'Diff'}
                </button>
              </div>
              {gitDiffs[`${item.projectId}:${entry.path}`] && (
                <div
                  data-git-diff-content={entry.path}
                  data-git-diff-status={gitDiffs[`${item.projectId}:${entry.path}`].status}
                  className="rounded-lg border border-white/10 bg-black/30"
                >
                  <div className="flex items-center gap-2 border-b border-white/10 px-2 py-1">
                    <span className="text-[8px] uppercase tracking-normal text-slate-500">
                      diff
                    </span>
                    <button
                      type="button"
                      data-git-side-by-side-toggle={entry.path}
                      onClick={() => toggleSideBySide(item.projectId, item.path, entry.path)}
                      className="ml-auto rounded bg-white/[0.05] px-1.5 py-0.5 text-[9px] text-slate-400 hover:bg-white/[0.08]"
                    >
                      {sideBySide[`${item.projectId}:${entry.path}`] ? 'Inline' : 'Side by side'}
                    </button>
                  </div>
                  {sideBySide[`${item.projectId}:${entry.path}`] ? (
                    loadingVersions[`${item.projectId}:${entry.path}`] ? (
                      <div className="px-2 py-1 text-[9px] text-slate-500">Loading versions...</div>
                    ) : fileVersions[`${item.projectId}:${entry.path}`] ? (
                      <div
                        data-git-side-by-side={entry.path}
                        className="grid grid-cols-2 gap-2 p-2"
                      >
                        <FileVersionPane
                          title="HEAD"
                          dataKey="old"
                          content={fileVersions[`${item.projectId}:${entry.path}`].oldContent}
                          language={detectLanguage(entry.path)}
                        />
                        <FileVersionPane
                          title="Working tree"
                          dataKey="new"
                          content={fileVersions[`${item.projectId}:${entry.path}`].newContent}
                          language={detectLanguage(entry.path)}
                        />
                      </div>
                    ) : null
                  ) : (
                    <div
                      data-git-diff-lines={entry.path}
                      className="max-h-40 overflow-auto px-2 py-1.5"
                    >
                      {parseDiffLines(gitDiffs[`${item.projectId}:${entry.path}`].diff).map(
                        (line, index) => (
                          <div
                            key={index}
                            data-git-diff-line={entry.path}
                            data-git-diff-line-type={line.kind}
                            className={`whitespace-pre-wrap rounded px-1 text-[9px] leading-relaxed ${diffLineClass(line.kind)}`}
                          >
                            {highlightLine(line.text, detectLanguage(entry.path))}
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>,
      ];
    });
  };

  return (
    <div className="view-enter flex h-full flex-col gap-4 overflow-y-auto p-4">
      <BentoCard title="New project" subtitle="从想法到代码落地" icon={FolderKanban} colSpan={12}>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name"
            className="h-9 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs text-slate-200 outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
          />
          <input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="Local path (optional)"
            className="h-9 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs text-slate-200 outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
          />
          <button
            type="button"
            onClick={() => void create()}
            className="flex h-9 items-center gap-1.5 rounded-xl bg-emerald-500/20 px-3 text-xs font-medium text-emerald-400 hover:bg-emerald-500/30"
          >
            <Plus size={14} /> Create
          </button>
        </div>
      </BentoCard>

      <BentoCard
        title="Portfolio summary"
        subtitle="收益 · 状态 · Git 进度汇总"
        icon={Download}
        colSpan={12}
      >
        <div data-portfolio-summary className="space-y-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
            <StatPill label="Projects" value={String(projects.length)} />
            <StatPill label="Revenue" value={`$${totalRevenue.toFixed(2)}`} tone="green" />
            <StatPill label="Active" value={String(activeProjects)} tone="blue" />
            <StatPill label="Paused" value={String(pausedProjects)} tone="neutral" />
            <StatPill label="Commits" value={String(gitActivity?.totalCommits ?? 0)} tone="blue" />
            <StatPill
              label="Dirty"
              value={String(gitActivity?.dirtyProjects ?? 0)}
              tone={gitActivity?.dirtyProjects ? 'neutral' : 'green'}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-portfolio-export
              onClick={() => setExportOpen((v) => !v)}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-emerald-500/15 px-2.5 text-[11px] text-emerald-300 hover:bg-emerald-500/25"
            >
              <Download size={12} />
              {exportOpen ? 'Hide report' : 'Export summary'}
            </button>
            {exportOpen && (
              <button
                type="button"
                data-portfolio-copy
                onClick={() => void copyReport()}
                className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] transition-colors ${
                  copyState === 'copied'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-white/10 text-slate-400 hover:bg-white/[0.06] hover:text-slate-300'
                }`}
              >
                <Copy size={12} />
                {copyState === 'copied' ? 'Copied' : 'Copy'}
              </button>
            )}
            <span data-portfolio-week-peak className="font-mono text-[10px] text-slate-500">
              week peak {weekCommitPeak}
            </span>
          </div>
          {exportOpen && (
            <pre
              data-portfolio-export-preview
              className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-[10px] leading-relaxed text-slate-300"
            >
              {portfolioReport}
            </pre>
          )}
        </div>
      </BentoCard>

      {gitActivity && (
        <BentoCard
          title="Git activity"
          subtitle={`${gitActivity.totalProjects} projects`}
          icon={GitBranch}
          colSpan={12}
        >
          <div data-git-activity className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <select
                data-git-activity-range
                value={gitRange}
                onChange={(e) => setGitRange(e.target.value)}
                className="h-7 rounded-lg border border-white/10 bg-white/[0.03] px-2 text-[10px] text-slate-300 outline-none focus:border-emerald-500/40"
              >
                {GIT_RANGES.map((range) => (
                  <option key={range.value} value={range.value}>
                    {range.label}
                  </option>
                ))}
              </select>
              <select
                data-git-activity-committer-select
                value={gitCommitter}
                onChange={(e) => setGitCommitter(e.target.value)}
                className="h-7 rounded-lg border border-white/10 bg-white/[0.03] px-2 text-[10px] text-slate-300 outline-none focus:border-emerald-500/40"
              >
                <option value="">All committers</option>
                {gitActivity.committers.map((committer) => (
                  <option key={committer} value={committer}>
                    {committer}
                  </option>
                ))}
              </select>
            </div>
            <div
              data-git-activity-total={gitActivity.totalProjects}
              data-git-activity-commits={gitActivity.totalCommits}
              data-git-activity-dirty={gitActivity.dirtyProjects}
              className="flex flex-wrap items-center gap-2"
            >
              <StatPill label="Projects" value={String(gitActivity.totalProjects)} />
              <StatPill label="Commits" value={String(gitActivity.totalCommits)} tone="blue" />
              <StatPill
                label="Dirty"
                value={String(gitActivity.dirtyProjects)}
                tone={gitActivity.dirtyProjects > 0 ? 'neutral' : 'green'}
              />
            </div>
            <div
              data-git-activity-trend
              className="grid grid-cols-7 items-end gap-1.5 rounded-lg bg-white/[0.02] p-2"
            >
              {gitActivity.commitTrend.buckets.map((bucket) => (
                <div key={bucket.dayMs} className="flex min-w-0 flex-col items-center gap-1">
                  <span
                    data-git-trend-bar
                    data-git-trend-bar-count={bucket.count}
                    data-git-trend-bar-day={bucket.dayMs}
                    className="block w-full rounded-sm bg-blue-500/30"
                    style={{
                      height: `${Math.max(3, Math.round((bucket.count / commitTrendMax) * 28))}px`,
                    }}
                  />
                  <span className="truncate text-[8px] text-slate-600">
                    {new Date(bucket.dayMs).toLocaleDateString('en', { weekday: 'short' })}
                  </span>
                </div>
              ))}
            </div>
            {gitActivity.items.map((item) => (
              <div
                key={item.projectId}
                data-git-activity-project
                data-git-activity-branch={item.branch}
                data-git-activity-commits={item.commitCount}
                data-git-activity-changed={item.changedFiles}
                data-git-activity-latest={item.latestCommit}
                data-git-activity-committer={item.committer}
                data-git-activity-dirty={item.dirty}
                className="rounded-lg bg-white/[0.03]"
              >
                <div className="flex flex-wrap items-center gap-2 px-2 py-1.5">
                  <span className="text-[10px] font-medium text-slate-300">{item.projectName}</span>
                  <ModelBadge label={item.branch} tone="blue" />
                  <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-slate-400">
                    {item.committer || 'unknown'}
                  </span>
                  <span className="text-[9px] text-slate-500">{item.commitCount} commits</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[8px] ${
                      item.dirty
                        ? 'bg-amber-500/10 text-amber-300'
                        : 'bg-emerald-500/10 text-emerald-300'
                    }`}
                  >
                    {item.dirty ? 'dirty' : 'clean'}
                  </span>
                  {item.dirty && (
                    <button
                      type="button"
                      data-git-activity-preview={item.projectId}
                      onClick={() =>
                        setExpandedPreview(
                          expandedPreview === item.projectId ? null : item.projectId,
                        )
                      }
                      className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[9px] text-slate-400 hover:bg-white/[0.08]"
                    >
                      {expandedPreview === item.projectId ? 'Hide' : 'Preview'}
                    </button>
                  )}
                  <span className="min-w-0 flex-1 truncate text-[9px] text-slate-400">
                    {item.latestCommit}
                  </span>
                </div>
                {expandedPreview === item.projectId && item.changedPaths.length > 0 && (
                  <div
                    data-git-activity-preview-files={item.projectId}
                    className="mx-2 mb-2 flex flex-col gap-1.5 rounded-lg bg-black/20 p-2"
                  >
                    <div className="flex flex-col gap-1.5">
                      <button
                        type="button"
                        data-git-batch-preview={item.projectId}
                        onClick={() =>
                          void loadBatchPreview(item.projectId, item.path, item.changedPaths)
                        }
                        className="self-start rounded bg-white/[0.05] px-1.5 py-0.5 text-[9px] text-slate-400 hover:bg-white/[0.08]"
                      >
                        {batchLoading
                          ? 'Loading'
                          : batchDiff?.projectId === item.projectId
                            ? 'Hide batch'
                            : 'Preview all'}
                      </button>
                      {batchDiff?.projectId === item.projectId && (
                        <pre
                          data-git-batch-preview-content={item.projectId}
                          className="max-h-44 overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 px-2 py-1.5 text-[9px] leading-relaxed text-slate-400"
                        >
                          {batchDiff.content}
                        </pre>
                      )}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          data-git-commit-selected={item.projectId}
                          onClick={() => void commitSelected(item)}
                          disabled={(selectedFiles[item.projectId] ?? []).length === 0}
                          className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] text-emerald-300 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Commit selected ({selectedFiles[item.projectId]?.length ?? 0})
                        </button>
                        {(commitResults[item.projectId] || commitErrors[item.projectId]) && (
                          <span
                            data-git-commit-selected-result={item.projectId}
                            className={`min-w-0 truncate rounded px-1.5 py-0.5 text-[9px] ${
                              commitErrors[item.projectId]
                                ? 'bg-rose-500/10 text-rose-300'
                                : 'bg-emerald-500/10 text-emerald-300'
                            }`}
                          >
                            {commitErrors[item.projectId]
                              ? commitErrors[item.projectId]
                              : commitResults[item.projectId]?.committed
                                ? `Committed ${commitResults[item.projectId]?.hash} on ${commitResults[item.projectId]?.branch}`
                                : 'Nothing to commit'}
                          </span>
                        )}
                        {lintGate[item.projectId] && (
                          <span
                            data-git-lint-gate={item.projectId}
                            data-git-lint-gate-issues={lintGate[item.projectId].issues.length}
                            className="min-w-0 truncate rounded bg-rose-500/10 px-1.5 py-0.5 text-[9px] text-rose-300"
                          >
                            Lint gate blocked:{' '}
                            {lintGate[item.projectId].issues
                              .map((issue) => `${issue.file}:${issue.line} ${issue.message}`)
                              .join('; ')}
                          </span>
                        )}
                      </div>
                    </div>
                    {renderGitFiles(item)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </BentoCard>
      )}

      <BentoCard
        title="Project carousel"
        subtitle="Orbit / fan project explorer"
        icon={Orbit}
        colSpan={12}
      >
        <ProjectCarousel />
      </BentoCard>

      {projects.map((p, i) => (
        <BentoCard
          key={p.id}
          title={p.name}
          subtitle={p.status}
          icon={GitBranch}
          colSpan={i % 2 === 0 ? 7 : 5}
          material={PROJECT_MATERIALS[i % PROJECT_MATERIALS.length]}
          className="tilt-card"
          onPointerMove={tiltCard}
          onPointerLeave={resetTilt}
        >
          <div className="mb-3 grid grid-cols-2 gap-2">
            <StatPill label="Revenue" value={`$${p.revenue.toFixed(2)}`} tone="green" />
            <StatPill label="Status" value={p.status} />
          </div>
          <div
            data-project-edit={p.id}
            className="mb-3 rounded-xl border border-white/10 bg-white/[0.02] p-2"
          >
            <div className="mb-1.5 text-[9px] uppercase tracking-normal text-slate-500">
              Project settings
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <select
                data-project-status={p.id}
                value={projectEdits[p.id]?.status ?? p.status}
                onChange={(e) =>
                  setProjectEdits((prev) => ({
                    ...prev,
                    [p.id]: {
                      status: e.target.value,
                      revenue: prev[p.id]?.revenue ?? String(p.revenue),
                    },
                  }))
                }
                className="h-7 rounded-lg border border-white/10 bg-white/[0.03] px-2 text-[10px] text-slate-300 outline-none focus:border-emerald-500/40"
              >
                <option value="active">active</option>
                <option value="paused">paused</option>
              </select>
              <div className="flex h-7 items-center rounded-lg border border-white/10 bg-white/[0.03] px-2">
                <span className="text-[9px] text-slate-500">$</span>
                <input
                  data-project-revenue={p.id}
                  type="number"
                  min="0"
                  step="0.01"
                  value={projectEdits[p.id]?.revenue ?? String(p.revenue)}
                  onChange={(e) =>
                    setProjectEdits((prev) => ({
                      ...prev,
                      [p.id]: {
                        status: prev[p.id]?.status ?? p.status,
                        revenue: e.target.value,
                      },
                    }))
                  }
                  className="w-20 bg-transparent px-1 text-[10px] text-slate-200 outline-none"
                />
              </div>
              <button
                type="button"
                data-project-save={p.id}
                onClick={() => void saveProjectEdit(p)}
                disabled={!projectEdits[p.id]}
                className="flex h-7 items-center gap-1 rounded-lg bg-emerald-500/15 px-2 text-[10px] text-emerald-300 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Check size={11} /> Save
              </button>
              {projectEditResults[p.id] && (
                <span
                  data-project-edit-result={p.id}
                  className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] text-emerald-300"
                >
                  {projectEditResults[p.id]}
                </span>
              )}
              {confirmDeleteProjectId === p.id ? (
                <span className="flex items-center gap-1 rounded-lg border border-rose-500/20 bg-rose-500/10 px-1 py-0.5">
                  <button
                    type="button"
                    data-project-delete-confirm={p.id}
                    onClick={() => void deleteProjectRow(p)}
                    className="h-6 rounded-md bg-rose-500/25 px-2 text-[9px] text-rose-200 hover:bg-rose-500/35"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    data-project-delete-cancel={p.id}
                    onClick={() => setConfirmDeleteProjectId(null)}
                    className="h-6 rounded-md border border-white/10 px-2 text-[9px] text-slate-500 hover:text-slate-300"
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  data-project-delete={p.id}
                  onClick={() => setConfirmDeleteProjectId(p.id)}
                  className="flex h-7 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2 text-[10px] text-slate-400 hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300"
                >
                  <Trash2 size={11} /> Delete
                </button>
              )}
            </div>
          </div>
          <p className="mb-3 truncate text-[11px] text-slate-500">{p.path || 'No local path'}</p>
          {gitCtx[p.id] && (
            <div className="project-git-graph mb-3 rounded-xl border border-white/10 bg-black/20 p-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <ModelBadge label={gitCtx[p.id].branch} tone="blue" />
                <span className="text-[10px] text-slate-500">
                  {gitCtx[p.id].commitCount} commits
                </span>
                <span className="ml-auto flex items-center gap-1 text-[9px] text-slate-500">
                  <GitBranch size={9} /> {gitCtx[p.id].head}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <span className="accent-dot accent-dot-ring h-2 w-2 rounded-full ring-2" />
                  <span className="h-px w-3 bg-white/15" />
                  <span className="h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-emerald-400/20" />
                </div>
                <span className="truncate text-[10px] text-slate-400">
                  {gitCtx[p.id].latestCommit}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {gitCtx[p.id].changes.slice(0, 3).map((file) => (
                  <span
                    key={file}
                    className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-slate-500"
                  >
                    {file}
                  </span>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  aria-label="Rebase onto main"
                  data-rebase-branch
                  onClick={() => void rebaseProject(p)}
                  className="flex h-6 items-center gap-1 rounded-md accent-bg-15 px-1.5 text-[9px] accent-text-strong accent-hover-bg-25"
                >
                  <RefreshCw size={9} /> Rebase onto main
                </button>
                {rebaseResults[p.id] && (
                  <span
                    data-rebase-result
                    className={`rounded-md border px-1.5 py-0.5 text-[9px] ${
                      rebaseResults[p.id].conflict
                        ? 'border-amber-500/25 bg-amber-500/10 text-amber-300'
                        : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                    }`}
                  >
                    {rebaseResults[p.id].conflict
                      ? `Conflicts: ${rebaseResults[p.id].files.join(', ') || 'unknown files'}`
                      : `Rebased ${rebaseResults[p.id].branch} onto ${rebaseResults[p.id].base} (${rebaseResults[p.id].head})`}
                  </span>
                )}
                {rebaseResults[p.id]?.conflict && (
                  <>
                    <button
                      type="button"
                      aria-label="Resolve conflicts with ours"
                      data-resolve-conflicts="ours"
                      onClick={() => void resolveConflicts(p, 'ours')}
                      className="flex h-6 items-center gap-1 rounded-md accent-bg-15 px-1.5 text-[9px] accent-text-strong accent-hover-bg-25"
                    >
                      <GitBranch size={9} /> Take feature
                    </button>
                    <button
                      type="button"
                      aria-label="Resolve conflicts with theirs"
                      data-resolve-conflicts="theirs"
                      onClick={() => void resolveConflicts(p, 'theirs')}
                      className="flex h-6 items-center gap-1 rounded-md accent-bg-15 px-1.5 text-[9px] accent-text-strong accent-hover-bg-25"
                    >
                      <RefreshCw size={9} /> Take main
                    </button>
                    <button
                      type="button"
                      aria-label="Resolve conflicts with union"
                      data-resolve-conflicts="union"
                      onClick={() => void resolveConflicts(p, 'union')}
                      className="flex h-6 items-center gap-1 rounded-md bg-emerald-500/15 px-1.5 text-[9px] text-emerald-300 hover:bg-emerald-500/25"
                    >
                      <GitMerge size={9} /> Union merge
                    </button>
                    <button
                      type="button"
                      aria-label="Abort rebase"
                      data-abort-rebase
                      onClick={() => void abortProjectRebase(p)}
                      className="flex h-6 items-center gap-1 rounded-md bg-rose-500/15 px-1.5 text-[9px] text-rose-300 hover:bg-rose-500/25"
                    >
                      <Undo2 size={9} /> Abort rebase
                    </button>
                  </>
                )}
                {resolveResults[p.id] && (
                  <span
                    data-resolve-result
                    className={`rounded-md border px-1.5 py-0.5 text-[9px] ${
                      resolveResults[p.id].rebased
                        ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                        : 'border-amber-500/25 bg-amber-500/10 text-amber-300'
                    }`}
                  >
                    {resolveResults[p.id].message}
                  </span>
                )}
                {rebaseErrors[p.id] && (
                  <span
                    data-rebase-error
                    className="rounded-md border border-rose-500/20 bg-rose-500/[0.06] px-1.5 py-0.5 text-[9px] text-rose-300/90"
                  >
                    {rebaseErrors[p.id]}
                  </span>
                )}
              </div>
            </div>
          )}
          {drafts[p.id] && (
            <div className="commit-pr-draft mb-3 rounded-xl border border-violet-500/20 bg-violet-500/[0.04] p-2.5">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-[10px] font-medium text-violet-300">Commit / PR draft</span>
                <span className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-slate-500">
                  {drafts[p.id].branch}
                </span>
              </div>
              <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/20 p-2 text-[10px] leading-relaxed text-emerald-300/90">
                {drafts[p.id].commitMessage}
              </pre>
              <pre className="mt-1.5 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/20 p-2 text-[10px] leading-relaxed text-slate-400">
                {drafts[p.id].prBody}
              </pre>
              <div className="mt-1.5 flex gap-1.5">
                <button
                  type="button"
                  aria-label="Copy commit message"
                  onClick={() => void navigator.clipboard?.writeText(drafts[p.id].commitMessage)}
                  className="flex h-6 items-center gap-1 rounded-md bg-violet-500/15 px-1.5 text-[9px] text-violet-300 hover:bg-violet-500/25"
                >
                  <Copy size={9} /> Copy commit
                </button>
                <button
                  type="button"
                  aria-label="Copy PR body"
                  onClick={() => void navigator.clipboard?.writeText(drafts[p.id].prBody)}
                  className="flex h-6 items-center gap-1 rounded-md bg-white/5 px-1.5 text-[9px] text-slate-400 hover:text-slate-200"
                >
                  <Copy size={9} /> Copy PR
                </button>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  aria-label="Apply commit"
                  data-apply-commit
                  onClick={() => void applyDraft(p)}
                  className="flex h-6 items-center gap-1 rounded-md bg-emerald-500/15 px-1.5 text-[9px] text-emerald-300 hover:bg-emerald-500/25"
                >
                  <Check size={9} /> Commit changes
                </button>
                <button
                  type="button"
                  aria-label="Create remote PR"
                  data-create-pr
                  onClick={() => void createPr(p)}
                  className="flex h-6 items-center gap-1 rounded-md accent-bg-15 px-1.5 text-[9px] accent-text-strong accent-hover-bg-25"
                >
                  <ExternalLink size={9} /> Create PR
                </button>
              </div>
              {commitResults[p.id] && (
                <div
                  data-commit-result
                  className="mt-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/[0.06] px-1.5 py-1 text-[9px] text-emerald-300/90"
                >
                  {commitResults[p.id].committed
                    ? `Committed ${commitResults[p.id].hash} on ${commitResults[p.id].branch}`
                    : `Nothing to commit on ${commitResults[p.id].branch}`}
                </div>
              )}
              {commitErrors[p.id] && (
                <div
                  data-commit-error
                  className="mt-1.5 rounded-md border border-rose-500/20 bg-rose-500/[0.06] px-1.5 py-1 text-[9px] text-rose-300/90"
                >
                  {commitErrors[p.id]}
                </div>
              )}
              {prResults[p.id] && (
                <div
                  data-pr-result
                  className="mt-1.5 truncate rounded-md accent-border-20 accent-bg-6 px-1.5 py-1 text-[9px] accent-text-strong"
                >
                  {prResults[p.id].url ? (
                    <a href={prResults[p.id].url ?? undefined} target="_blank" rel="noreferrer">
                      {prResults[p.id].url}
                    </a>
                  ) : (
                    `PR created on ${prResults[p.id].branch}`
                  )}
                </div>
              )}
              {prErrors[p.id] && (
                <div
                  data-pr-error
                  className="mt-1.5 rounded-md border border-rose-500/20 bg-rose-500/[0.06] px-1.5 py-1 text-[9px] text-rose-300/90"
                >
                  {prErrors[p.id]}
                </div>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void aiCoding(p)}
              className="flex h-8 items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 text-[11px] text-emerald-400 hover:bg-emerald-500/20"
            >
              AI Coding
            </button>
            <button
              type="button"
              aria-label="Generate commit PR draft"
              onClick={() => void generateDraft(p)}
              className="flex h-8 items-center gap-1.5 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 text-[11px] text-violet-300 hover:bg-violet-500/20"
            >
              Commit/PR draft
            </button>
          </div>
        </BentoCard>
      ))}
    </div>
  );
}
