import { BookOpen, CheckSquare, FolderKanban, MessageSquare, Settings, Sparkles } from "lucide-react";
import { useWorkbenchStore, type ViewId } from "../../stores/workbenchStore";

const NAV: { id: ViewId; label: string; icon: typeof MessageSquare }[] = [
  { id: "ai-studio", label: "AI Studio", icon: MessageSquare },
  { id: "projects", label: "Projects", icon: FolderKanban },
  { id: "knowledge", label: "Knowledge", icon: BookOpen },
  { id: "actions", label: "Actions", icon: CheckSquare },
  { id: "system", label: "System", icon: Settings },
];

export default function AppDock() {
  const activeView = useWorkbenchStore((s) => s.activeView);
  const setActiveView = useWorkbenchStore((s) => s.setActiveView);

  return (
    <nav className="flex w-[60px] shrink-0 flex-col items-center gap-1 border-r border-white/[0.06] bg-[#16161A]/80 py-3 backdrop-blur-2xl">
      <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-emerald-500/15 text-emerald-400" title="AI Workbench">
        <Sparkles size={17} />
      </div>
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = activeView === item.id;
        return (
          <button
            key={item.id}
            type="button"
            title={item.label}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            onClick={() => setActiveView(item.id)}
            className={`dock-item flex h-10 w-10 items-center justify-center rounded-xl border ${
              active
                ? "dock-item-active border-emerald-500/30 bg-emerald-500/20 text-emerald-400"
                : "border-transparent text-slate-500 hover:border-white/10 hover:bg-white/[0.06] hover:text-slate-200"
            }`}
          >
            <Icon size={18} />
          </button>
        );
      })}
    </nav>
  );
}
