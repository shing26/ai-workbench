import { Check, Copy, ExternalLink, FolderKanban, GitBranch, Plus, RefreshCw, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import * as db from "../lib/db";
import { useWorkbenchStore } from "../stores/workbenchStore";
import BentoCard from "../components/ui/BentoCard";
import StatPill from "../components/ui/StatPill";
import ModelBadge from "../components/ui/ModelBadge";
import { resetTilt, tiltCard } from "../lib/tilt";

const PROJECT_MATERIALS = ["cyan", "original", "rain", "chrome"] as const;

export default function ProjectsView() {
  const projects = useWorkbenchStore((s) => s.projects);
  const addProject = useWorkbenchStore((s) => s.addProject);
  const openInspector = useWorkbenchStore((s) => s.openInspector);
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [gitCtx, setGitCtx] = useState<Record<string, db.GitContext>>({});
  const [drafts, setDrafts] = useState<Record<string, db.CommitPrDraft>>({});
  const [commitResults, setCommitResults] = useState<Record<string, db.GitCommitResult>>({});
  const [prResults, setPrResults] = useState<Record<string, db.RemotePrResult>>({});
  const [commitErrors, setCommitErrors] = useState<Record<string, string>>({});
  const [prErrors, setPrErrors] = useState<Record<string, string>>({});
  const [rebaseResults, setRebaseResults] = useState<Record<string, db.GitRebaseResult>>({});
  const [rebaseErrors, setRebaseErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let disposed = false;
    void Promise.all(
      projects
        .filter((p) => p.path)
        .map(async (p) => [p.id, await db.getProjectGitContext(p.path ?? "")] as const),
    ).then((entries) => {
      if (!disposed) setGitCtx(Object.fromEntries(entries));
    });
    return () => {
      disposed = true;
    };
  }, [projects.map((p) => `${p.id}:${p.path}`).join("|")]);

  const create = async () => {
    if (!name.trim()) return;
    await addProject(name.trim(), path.trim());
    setName("");
    setPath("");
  };

  const aiCoding = async (project: db.Project) => {
    const ctx = await db.getProjectGitContext(project.path ?? "");
    openInspector("AI Coding", [
      { label: "Project", value: project.name },
      { label: "HEAD", value: ctx.head },
      { label: "Modified files", value: ctx.changes.join("\n") || "none" },
    ]);
  };

  const generateDraft = async (project: db.Project) => {
    const draft = await db.generateCommitPrDraft(project.path ?? "", project.name);
    setDrafts((prev) => ({ ...prev, [project.id]: draft }));
  };

  const applyDraft = async (project: db.Project) => {
    const draft = drafts[project.id];
    if (!draft) return;
    try {
      const result = await db.applyCommit(project.path ?? "", draft.commitMessage);
      setCommitResults((prev) => ({ ...prev, [project.id]: result }));
      setCommitErrors((prev) => {
        const next = { ...prev };
        delete next[project.id];
        return next;
      });
      const ctx = await db.getProjectGitContext(project.path ?? "");
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
      const result = await db.createRemotePr(project.path ?? "", draft.prTitle, draft.prBody);
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
      const result = await db.rebaseBranch(project.path ?? "", "main");
      setRebaseResults((prev) => ({ ...prev, [project.id]: result }));
      setRebaseErrors((prev) => {
        const next = { ...prev };
        delete next[project.id];
        return next;
      });
      const ctx = await db.getProjectGitContext(project.path ?? "");
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
      await db.abortRebase(project.path ?? "");
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
      const ctx = await db.getProjectGitContext(project.path ?? "");
      setGitCtx((prev) => ({ ...prev, [project.id]: ctx }));
    } catch (error) {
      setRebaseErrors((prev) => ({
        ...prev,
        [project.id]: error instanceof Error ? error.message : String(error),
      }));
    }
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
          <p className="mb-3 truncate text-[11px] text-slate-500">{p.path || "No local path"}</p>
          {gitCtx[p.id] && (
            <div className="project-git-graph mb-3 rounded-xl border border-white/10 bg-black/20 p-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <ModelBadge label={gitCtx[p.id].branch} tone="blue" />
                <span className="text-[10px] text-slate-500">{gitCtx[p.id].commitCount} commits</span>
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
                <span className="truncate text-[10px] text-slate-400">{gitCtx[p.id].latestCommit}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {gitCtx[p.id].changes.slice(0, 3).map((file) => (
                  <span key={file} className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-slate-500">
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
                        ? "border-amber-500/25 bg-amber-500/10 text-amber-300"
                        : "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                    }`}
                  >
                    {rebaseResults[p.id].conflict
                      ? `Conflicts: ${rebaseResults[p.id].files.join(", ") || "unknown files"}`
                      : `Rebased ${rebaseResults[p.id].branch} onto ${rebaseResults[p.id].base} (${rebaseResults[p.id].head})`}
                  </span>
                )}
                {rebaseResults[p.id]?.conflict && (
                  <button
                    type="button"
                    aria-label="Abort rebase"
                    data-abort-rebase
                    onClick={() => void abortProjectRebase(p)}
                    className="flex h-6 items-center gap-1 rounded-md bg-rose-500/15 px-1.5 text-[9px] text-rose-300 hover:bg-rose-500/25"
                  >
                    <Undo2 size={9} /> Abort rebase
                  </button>
                )}
                {rebaseErrors[p.id] && (
                  <span data-rebase-error className="rounded-md border border-rose-500/20 bg-rose-500/[0.06] px-1.5 py-0.5 text-[9px] text-rose-300/90">
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
                <div data-commit-error className="mt-1.5 rounded-md border border-rose-500/20 bg-rose-500/[0.06] px-1.5 py-1 text-[9px] text-rose-300/90">
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
                <div data-pr-error className="mt-1.5 rounded-md border border-rose-500/20 bg-rose-500/[0.06] px-1.5 py-1 text-[9px] text-rose-300/90">
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
