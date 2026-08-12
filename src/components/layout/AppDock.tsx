import { useState } from 'react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  HelpCircle,
  LayoutDashboard,
  MessagesSquare,
  Moon,
  Search,
  Sun,
  Zap,
} from 'lucide-react';
import { useWorkbenchStore, type ViewId } from '../../stores/workbenchStore';
import { useThemeStore } from '../../stores/themeStore';
import * as db from '../../lib/db';
import { usePrismModals } from '../modals/prismModalsStore';

const NAV: { id: ViewId; label: string; aria: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: '总览控制塔', aria: 'Dashboard', icon: LayoutDashboard },
  { id: 'projects', label: '项目矩阵', aria: 'Projects', icon: FolderKanban },
  { id: 'ai-studio', label: '需求论证 Canvas', aria: 'AI Studio', icon: MessagesSquare },
  { id: 'actions', label: '交付终端', aria: 'Actions', icon: Zap },
  { id: 'knowledge', label: '活体知识库', aria: 'Knowledge', icon: BookOpen },
];

export default function AppDock() {
  const activeView = useWorkbenchStore((s) => s.activeView);
  const setActiveView = useWorkbenchStore((s) => s.setActiveView);
  const vibePath = useWorkbenchStore((s) => s.vibeContext?.path ?? null);
  const resolved = useThemeStore((s) => s.resolved);
  const setTheme = useThemeStore((s) => s.setTheme);
  const openShortcuts = usePrismModals((s) => s.openShortcuts);
  const openSearch = usePrismModals((s) => s.openSearch);
  const [collapsed, setCollapsed] = useState(false);

  const toggleDark = () => setTheme(resolved === 'dark' ? 'light' : 'dark');
  const openVault = () => {
    void db.openObsidian(vibePath || 'D:\\ai-workbench', 'docs').catch(() => {});
  };

  return (
    <aside
      className={`z-20 flex shrink-0 select-none flex-col justify-between border-r border-white/[0.06] bg-[#0a0e15]/90 backdrop-blur-xl transition-[width] duration-150 ${
        collapsed ? 'w-16' : 'w-16 xl:w-60'
      }`}
    >
      <div className={`space-y-3 p-3 ${collapsed ? 'xl:p-3' : 'xl:p-4'}`}>
        <div
          className={`flex items-center gap-2 px-1 pt-1 ${collapsed ? 'justify-center' : 'xl:px-2'}`}
        >
          <div className="prism-breathing-emblem" aria-hidden="true" />
          <span
            className={`hidden font-mono text-[11px] font-semibold text-cyan-200/80 ${
              collapsed ? 'hidden' : 'xl:block'
            }`}
          >
            PRISM ENGINE
          </span>
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? 'Expand dock' : 'Collapse dock'}
            className="ml-auto hidden h-6 w-6 items-center justify-center rounded border border-white/10 text-slate-500 transition-colors hover:border-cyan-500/40 hover:text-cyan-300 xl:flex"
          >
            {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
          </button>
        </div>

        <nav className="space-y-1">
          {NAV.map((item) => {
            const active = activeView === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                aria-label={item.aria}
                aria-current={active ? 'page' : undefined}
                onClick={() => setActiveView(item.id)}
                title={collapsed ? item.label : undefined}
                className={`flex w-full items-center gap-3 rounded border-l-2 px-3 py-2.5 font-mono text-[11px] text-left transition-colors ${
                  collapsed ? 'justify-center px-0' : 'max-xl:justify-center max-xl:px-0'
                } ${active ? 'border-cyan-400 bg-cyan-500/10 font-semibold text-cyan-100' : 'border-transparent text-slate-500 hover:bg-white/[0.04] hover:text-slate-200'}`}
              >
                <Icon size={16} className={active ? 'text-cyan-300' : ''} />
                <span className={`hidden ${collapsed ? 'hidden' : 'xl:inline'}`}>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className={`space-y-2 p-3 ${collapsed ? 'xl:p-3' : 'xl:p-4'}`}>
        <button
          type="button"
          onClick={openVault}
          title="Obsidian Vault"
          className={`rounded border border-purple-500/30 bg-purple-500/10 font-mono text-[10px] text-purple-300 transition-colors hover:bg-purple-500/20 ${
            collapsed
              ? 'flex h-9 w-9 items-center justify-center'
              : 'hidden w-full items-center justify-center gap-2 py-2 xl:flex'
          }`}
        >
          <span className="text-purple-400">🔮</span>
          <span className={collapsed ? 'hidden' : 'hidden xl:inline'}>Obsidian Vault</span>
        </button>

        <div
          className={`flex items-center gap-1 ${collapsed ? 'flex-col' : 'justify-between px-1'}`}
        >
          <button
            type="button"
            onClick={toggleDark}
            aria-label="Toggle theme"
            className={`flex items-center gap-1.5 rounded border border-transparent p-1.5 text-slate-400 transition-colors hover:text-white ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            {resolved === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
            <span className={`hidden ${collapsed ? 'hidden' : 'xl:inline'}`}>
              {resolved === 'dark' ? '浅色' : '深色'}
            </span>
          </button>
          <button
            type="button"
            data-shortcuts-trigger
            onClick={openShortcuts}
            className="p-1.5 font-mono text-sm font-bold text-slate-400 transition-colors hover:text-white"
            aria-label="Shortcuts"
            title="快捷键"
          >
            <HelpCircle size={14} />
          </button>
        </div>
        <button
          type="button"
          data-dock-search
          onClick={openSearch}
          title="⌘K 全局搜索"
          className={`items-center gap-1.5 rounded border border-white/10 bg-white/[0.04] font-mono text-[10px] text-slate-500 transition-colors hover:border-cyan-500/30 hover:text-cyan-200 ${
            collapsed
              ? 'flex h-9 w-9 justify-center'
              : 'hidden w-full justify-center py-1.5 xl:flex'
          }`}
        >
          <Search size={13} />
          <span className={collapsed ? 'hidden' : 'hidden xl:inline'}>⌘K 全局搜索</span>
        </button>
      </div>
    </aside>
  );
}
