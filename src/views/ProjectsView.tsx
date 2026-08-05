import { FolderKanban, GitBranch, Plus } from "lucide-react";
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
                  <span className="h-2 w-2 rounded-full bg-[#7FB4FF] ring-2 ring-[#7FB4FF]/20" />
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
            </div>
          )}
          <button
            type="button"
            onClick={() => void aiCoding(p)}
            className="flex h-8 items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 text-[11px] text-emerald-400 hover:bg-emerald-500/20"
          >
            AI Coding
          </button>
        </BentoCard>
      ))}
    </div>
  );
}
