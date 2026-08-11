import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useWorkbenchStore, type ViewId } from '../../stores/workbenchStore';
import CommandPalette from '../CommandPalette';
import ThemeSwitcher from '../ui/ThemeSwitcher';
import { emitEvent, TOPICS } from '../../stores/events';
import { t } from '../../lib/i18n';

const TITLES: Record<ViewId, string> = {
  dashboard: 'view.dashboard',
  'ai-studio': 'view.aiStudio',
  projects: 'view.projects',
  knowledge: 'view.knowledge',
  actions: 'view.actions',
  system: 'view.system',
};

export default function AppHeader() {
  const activeView = useWorkbenchStore((s) => s.activeView);
  const qualityGate = useWorkbenchStore((s) => s.qualityGate);
  const refreshQualityGate = useWorkbenchStore((s) => s.refreshQualityGate);
  const vibePath = useWorkbenchStore((s) => s.vibeContext?.path ?? null);
  const [gateOpen, setGateOpen] = useState(false);

  useEffect(() => {
    if (vibePath && !qualityGate) void refreshQualityGate();
  }, [vibePath, qualityGate, refreshQualityGate]);

  return (
    <header className="relative z-20 flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-slate-950/40 px-4 backdrop-blur-2xl">
      <div className="flex min-w-0 items-center gap-3">
        <span className="truncate text-sm font-semibold text-slate-100">
          {t(TITLES[activeView])}
        </span>
        <span className="hidden truncate text-[10px] font-mono uppercase tracking-widest text-cyan-300/70 md:inline">
          PRISM ENGINE · {t('app.subtitle')}
        </span>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        {qualityGate && (
          <div className="relative">
            <button
              type="button"
              data-quality-gate
              data-quality-status={qualityGate.status}
              onClick={() => {
                setGateOpen((v) => !v);
                if (qualityGate.status === 'GREEN') void refreshQualityGate();
              }}
              title="Quality gate（点击刷新）"
              className={`flex h-7 items-center gap-1.5 rounded-lg border px-2 text-[10px] transition-colors ${
                qualityGate.status === 'GREEN'
                  ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
                  : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {qualityGate.status === 'GREEN' ? t('app.allGreen') : t('app.checkFailed')}
            </button>
            {gateOpen && qualityGate.status !== 'GREEN' && (
              <div
                data-quality-gate-errors
                className="prism-glass-surface absolute right-0 top-11 z-50 w-80 rounded-xl p-2 shadow-2xl"
              >
                <div className="mb-1 px-1 text-[10px] font-semibold text-rose-300">
                  Quality Gate · {qualityGate.projectPath.split(/[\\/]/).pop()}
                </div>
                <div className="max-h-56 space-y-1 overflow-y-auto">
                  {qualityGate.errors.length === 0 && (
                    <div className="px-1 py-2 text-[10px] text-slate-400">
                      无错误（或命令不可用）
                    </div>
                  )}
                  {qualityGate.errors.slice(0, 30).map((err, idx) => (
                    <div
                      key={idx}
                      className="truncate rounded bg-rose-500/[0.06] px-1.5 py-1 font-mono text-[9px] text-rose-300/90"
                      title={err}
                    >
                      {err}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <ThemeSwitcher />
        <button
          type="button"
          data-command-trigger
          aria-label="Search commands"
          aria-haspopup="dialog"
          onClick={() => emitEvent(TOPICS.COMMAND_PALETTE_TOGGLE)}
          className="flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs text-slate-300 transition-colors hover:border-cyan-500/30 hover:text-cyan-200"
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
