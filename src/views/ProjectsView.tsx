import { FolderKanban, GitBranch, Plus } from "lucide-react";
import { useState } from "react";
import * as db from "../lib/db";
import { useWorkbenchStore } from "../stores/workbenchStore";
import BentoCard from "../components/ui/BentoCard";
import StatPill from "../components/ui/StatPill";

export default function ProjectsView() {
  const projects = useWorkbenchStore((s) => s.projects);
  const addProject = useWorkbenchStore((s) => s.addProject);
  const openInspector = useWorkbenchStore((s) => s.openInspector);
  const [name, setName] = useState("");
  const [path, setPath] = useState("");

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
          className="tilt-card"
          onPointerMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width - 0.5;
            const y = (e.clientY - rect.top) / rect.height - 0.5;
            e.currentTarget.style.setProperty("--rx", `${(-y * 6).toFixed(2)}deg`);
            e.currentTarget.style.setProperty("--ry", `${(x * 8).toFixed(2)}deg`);
          }}
          onPointerLeave={(e) => {
            e.currentTarget.style.setProperty("--rx", "0deg");
            e.currentTarget.style.setProperty("--ry", "0deg");
          }}
        >
          <div className="mb-3 grid grid-cols-2 gap-2">
            <StatPill label="Revenue" value={`$${p.revenue.toFixed(2)}`} tone="green" />
            <StatPill label="Status" value={p.status} />
          </div>
          <p className="mb-3 truncate text-[11px] text-slate-500">{p.path || "No local path"}</p>
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
