import { useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { useWorkbenchStore, type ViewId } from '../../stores/workbenchStore';
import { usePrismModals } from '../modals/prismModalsStore';
import { useProviderControlSnapshot } from '../../hooks/useProviderControl';
import { activeProviderFromSnapshot } from '../../lib/providerControl';
import * as db from '../../lib/db';

const CLI_LABELS: Record<string, string> = {
  claude: '⚡ Claude Code',
  aider: '🧊 Aider Local',
  codex: '🟦 Codex CLI',
  gemini: '✨ Gemini CLI',
  opencode: '🧩 OpenCode',
  qwen: '🌐 Qwen Code',
  cursor: '🖱️ Cursor CLI',
  windsurf: '🏄 Windsurf',
};

const JOURNEY_STAGES: { id: ViewId; code: string; label: string }[] = [
  { id: 'dashboard', code: 'SYS.00', label: '总览' },
  { id: 'projects', code: 'SYS.01', label: '构想' },
  { id: 'ai-studio', code: 'SYS.02', label: '论证' },
  { id: 'actions', code: 'SYS.03', label: '落地' },
  { id: 'knowledge', code: 'SYS.04', label: '归档' },
];

export default function AppHeader() {
  const activeView = useWorkbenchStore((s) => s.activeView);
  const setActiveView = useWorkbenchStore((s) => s.setActiveView);
  const vibePath = useWorkbenchStore((s) => s.vibeContext?.path ?? null);
  const openSearch = usePrismModals((s) => s.openSearch);
  const openProvider = usePrismModals((s) => s.openProvider);
  const cliKind = usePrismModals((s) => s.cliKind);
  const setCliKind = usePrismModals((s) => s.setCliKind);
  const detectedCliTools = usePrismModals((s) => s.detectedCliTools);
  const refreshCliTools = usePrismModals((s) => s.refreshCliTools);
  const provider = useProviderControlSnapshot();

  useEffect(() => {
    void refreshCliTools();
  }, [refreshCliTools]);

  const detected = detectedCliTools.filter((tool) => tool.detected);

  const openVault = () => {
    void db.openObsidian(vibePath || 'D:\\ai-workbench', 'docs').catch(() => {});
  };

  return (
    <header className="z-10 flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.06] bg-[#0a0e15]/85 px-4 shadow-[inset_0_-1px_0_rgba(34,211,238,0.1)] backdrop-blur-xl">
      <div className="hidden min-w-0 items-center gap-2 font-mono text-[10px] text-slate-500 xl:flex">
        <span className="prism-breathing-emblem" aria-hidden="true" />
        <span className="font-semibold text-cyan-200/80">PRISM STATION</span>
        <span className="rounded border border-cyan-500/20 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] text-cyan-300">
          v1.0.0
        </span>
      </div>

      <nav className="journey flex-1" aria-label="Product journey stages">
        {JOURNEY_STAGES.map((stage, index) => (
          <span key={stage.id} className="contents">
            {index > 0 && (
              <span className="stage-arrow" aria-hidden="true">
                <ChevronRight size={13} />
              </span>
            )}
            <button
              type="button"
              className={`stage ${activeView === stage.id ? 'active' : ''}`}
              onClick={() => setActiveView(stage.id)}
              aria-current={activeView === stage.id ? 'page' : undefined}
            >
              <span className="stage-dot" aria-hidden="true" />
              <span className="stage-num">{stage.code}</span>
              <span>{stage.label}</span>
            </button>
          </span>
        ))}
      </nav>

      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          data-provider-open
          aria-label="Provider Control"
          onClick={openProvider}
          className="flex h-8 items-center gap-1.5 rounded border border-cyan-500/30 bg-cyan-500/10 px-2.5 font-mono text-[10px] text-cyan-300 transition-colors hover:bg-cyan-500/20"
          title="Provider Control"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span className="hidden max-w-36 truncate lg:inline">
            {activeProviderFromSnapshot(provider)?.name || 'Provider'}
          </span>
        </button>
        <button
          type="button"
          data-header-obsidian
          onClick={openVault}
          className="flex h-8 items-center gap-1.5 rounded border border-purple-500/30 bg-purple-500/10 px-2.5 font-mono text-[10px] text-purple-300 transition-colors hover:bg-purple-500/20"
          title="Obsidian 直达"
        >
          <span className="text-purple-400">🔮</span>
          <span className="hidden xl:inline">Obsidian 直达</span>
        </button>

        <div className="flex h-8 items-center gap-2 rounded border border-white/10 bg-white/[0.04] px-2.5 font-mono text-[10px]">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          <span className="hidden text-slate-400 lg:inline">当前本地 CLI:</span>
          <select
            data-cli-selector
            value={cliKind}
            onChange={(e) => setCliKind(e.target.value)}
            className="max-w-28 cursor-pointer bg-transparent font-mono text-xs font-medium text-cyan-200 outline-none"
            aria-label="Current CLI tool"
          >
            {detected.map((tool) => (
              <option key={tool.bin} value={tool.bin}>
                {CLI_LABELS[tool.bin] ?? tool.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          data-command-trigger
          aria-label="Search commands"
          onClick={openSearch}
          className="hidden h-8 items-center justify-between gap-2 rounded border border-white/10 bg-white/[0.04] px-3 font-mono text-[10px] text-slate-400 transition-colors hover:border-cyan-500/30 hover:text-cyan-200 xl:flex"
        >
          <span>🔍 全局搜索</span>
          <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] text-slate-300">⌘K</kbd>
        </button>
      </div>
    </header>
  );
}
