import { Check, Plus, Target } from "lucide-react";
import { useState } from "react";
import { useWorkbenchStore } from "../stores/workbenchStore";
import BentoCard from "../components/ui/BentoCard";

export default function ActionsView() {
  const tasks = useWorkbenchStore((s) => s.tasks);
  const addTask = useWorkbenchStore((s) => s.addTask);
  const setTaskStatus = useWorkbenchStore((s) => s.setTaskStatus);
  const setTaskToday = useWorkbenchStore((s) => s.setTaskToday);
  const [title, setTitle] = useState("");
  const [todayOnly, setTodayOnly] = useState(false);

  const todayTasks = tasks.filter((t) => t.isToday).slice(0, 3);
  const list = todayOnly ? tasks.filter((t) => t.isToday) : tasks;

  const add = async () => {
    if (!title.trim()) return;
    await addTask(title.trim(), true);
    setTitle("");
  };

  return (
    <div className="view-enter flex h-full flex-col gap-4 overflow-y-auto p-4">
      <BentoCard title="Today Focus" subtitle="今日 3 件事" icon={Target} colSpan={12}>
        <div className="grid gap-2 md:grid-cols-3">
          {todayTasks.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => void setTaskStatus(t.id, t.status === "done" ? "todo" : "done")}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs ${
                t.status === "done"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"
              }`}
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-md border ${
                  t.status === "done" ? "border-emerald-500/40 bg-emerald-500/20" : "border-white/20"
                }`}
              >
                {t.status === "done" && <Check size={11} />}
              </span>
              <span className="truncate">{t.title}</span>
            </button>
          ))}
          {todayTasks.length < 3 && (
            <div className="flex items-center justify-center rounded-xl border border-dashed border-white/10 px-3 py-2.5 text-[11px] text-slate-600">
              Add up to 3 focus items
            </div>
          )}
        </div>
      </BentoCard>

      <BentoCard title="Fast list" subtitle="Enter 快速新建" colSpan={12}>
        <div className="mb-3 flex items-center gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void add();
              }
            }}
            placeholder="New task..."
            className="h-9 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs text-slate-200 outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
          />
          <button
            type="button"
            onClick={() => void add()}
            className="flex h-9 items-center gap-1 rounded-xl bg-emerald-500/20 px-3 text-xs text-emerald-400 hover:bg-emerald-500/30"
          >
            <Plus size={14} /> Add
          </button>
          <button
            type="button"
            onClick={() => setTodayOnly((v) => !v)}
            className={`h-9 rounded-xl border px-3 text-[11px] ${
              todayOnly ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-white/10 text-slate-500 hover:text-slate-300"
            }`}
          >
            Today
          </button>
        </div>
        <div className="flex flex-col gap-1.5">
          {list.map((t) => (
            <div key={t.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
              <button
                type="button"
                onClick={() => void setTaskStatus(t.id, t.status === "done" ? "todo" : "done")}
                className={`flex h-5 w-5 items-center justify-center rounded-lg border ${
                  t.status === "done" ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-400" : "border-white/20 text-transparent"
                }`}
                aria-label="Toggle status"
              >
                <Check size={12} />
              </button>
              <span className={`min-w-0 flex-1 truncate text-xs ${t.status === "done" ? "text-slate-600 line-through" : "text-slate-300"}`}>
                {t.title}
              </span>
              <button
                type="button"
                onClick={() => void setTaskToday(t.id, !t.isToday)}
                className={`rounded-md px-2 py-1 text-[10px] ${
                  t.isToday ? "bg-[#007AFF]/15 text-[#7FB4FF]" : "text-slate-600 hover:text-slate-400"
                }`}
              >
                Focus
              </button>
            </div>
          ))}
          {list.length === 0 && <div className="py-8 text-center text-xs text-slate-600">No tasks</div>}
        </div>
      </BentoCard>
    </div>
  );
}
