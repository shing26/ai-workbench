import {
  BookOpen,
  CheckSquare,
  FolderKanban,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Sparkles,
} from 'lucide-react';
import { useWorkbenchStore, type ViewId } from '../../stores/workbenchStore';

const NAV: { id: ViewId; label: string; aria: string; icon: typeof MessageSquare }[] = [
  { id: 'dashboard', label: '总览控制塔', aria: 'Dashboard', icon: LayoutDashboard },
  { id: 'ai-studio', label: '需求论证 Canvas', aria: 'AI Studio', icon: MessageSquare },
  { id: 'projects', label: '项目矩阵', aria: 'Projects', icon: FolderKanban },
  { id: 'knowledge', label: '活体知识库', aria: 'Knowledge', icon: BookOpen },
  { id: 'actions', label: '交付终端', aria: 'Actions', icon: CheckSquare },
  { id: 'system', label: '系统与自动化', aria: 'System', icon: Settings },
];

export default function AppDock() {
  const activeView = useWorkbenchStore((s) => s.activeView);
  const setActiveView = useWorkbenchStore((s) => s.setActiveView);

  return (
    <nav className="flex w-[60px] shrink-0 flex-col items-center gap-1 border-r border-white/[0.06] bg-slate-950/60 py-3 backdrop-blur-2xl">
      <div
        className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 via-cyan-500 to-teal-500 font-bold text-white shadow-lg shadow-cyan-500/20 ring-1 ring-white/30"
        title="Prism Station"
      >
        P
      </div>
      <div className="mb-2 flex flex-col items-center gap-1.5">
        <div className="prism-breathing-emblem" aria-hidden="true" />
        <span className="font-mono text-[7px] font-semibold uppercase tracking-widest text-cyan-300/80">
          PRISM
        </span>
        <span className="font-mono text-[7px] font-semibold uppercase tracking-widest text-cyan-300/80">
          ENGINE
        </span>
      </div>
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = activeView === item.id;
        return (
          <button
            key={item.id}
            type="button"
            title={item.label}
            aria-label={item.aria}
            aria-current={active ? 'page' : undefined}
            onClick={() => setActiveView(item.id)}
            className={`dock-item flex h-10 w-10 items-center justify-center rounded-xl border ${
              active
                ? 'dock-item-active border-cyan-500/30 bg-cyan-500/20 text-cyan-300'
                : 'border-transparent text-slate-500 hover:border-white/10 hover:bg-white/[0.06] hover:text-slate-200'
            }`}
          >
            <Icon size={18} />
          </button>
        );
      })}
      <div className="mt-auto pt-2">
        <div className="flex flex-col items-center gap-1">
          <Sparkles size={14} className="text-slate-600" />
          <span className="font-mono text-[7px] text-slate-600">v1.2.3</span>
        </div>
      </div>
    </nav>
  );
}
