import { Search } from 'lucide-react';
import { useWorkbenchStore, type ViewId } from '../../stores/workbenchStore';
import CommandPalette from '../CommandPalette';
import ThemeSwitcher from '../ui/ThemeSwitcher';
import MaterialDrawer from './MaterialDrawer';
import { emitEvent, TOPICS } from '../../stores/events';

const TITLES: Record<ViewId, string> = {
  'ai-studio': 'AI Studio',
  projects: 'Projects',
  knowledge: 'Knowledge & Inbox',
  actions: 'Actions & Schedule',
  system: 'System & Automation',
};

export default function AppHeader() {
  const activeView = useWorkbenchStore((s) => s.activeView);
  const providers = useWorkbenchStore((s) => s.providers);
  const activeProvider = providers.find((p) => p.isActive);

  return (
    <header className="relative z-20 flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#16161A]/80 px-4 backdrop-blur-2xl">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-200">{TITLES[activeView]}</span>
        <span className="hidden text-xs text-slate-500 md:inline">Local-first AI Workbench</span>
      </div>
      <div className="flex items-center gap-2">
        {activeProvider && (
          <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {activeProvider.name}
          </span>
        )}
        <MaterialDrawer />
        <ThemeSwitcher />
        <button
          type="button"
          data-command-trigger
          aria-label="Search commands"
          aria-haspopup="dialog"
          onClick={() => emitEvent(TOPICS.COMMAND_PALETTE_TOGGLE)}
          className="flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs text-slate-400 transition-colors hover:border-white/20 hover:text-slate-200"
        >
          <Search size={14} />
          <span className="hidden md:inline">Search</span>
          <kbd className="rounded-md border border-white/10 bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-400">
            Ctrl K
          </kbd>
        </button>
      </div>
      <CommandPalette />
    </header>
  );
}
