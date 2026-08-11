import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useWorkbenchStore, type ViewId } from '../../stores/workbenchStore';
import CommandPalette from '../CommandPalette';
import ThemeSwitcher from '../ui/ThemeSwitcher';
import MaterialDrawer from './MaterialDrawer';
import { emitEvent, TOPICS } from '../../stores/events';
import { LOCALES, t, useLocale } from '../../lib/i18n';

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
  const providers = useWorkbenchStore((s) => s.providers);
  const activeProvider = providers.find((p) => p.isActive);
  const qualityGate = useWorkbenchStore((s) => s.qualityGate);
  const refreshQualityGate = useWorkbenchStore((s) => s.refreshQualityGate);
  const vibePath = useWorkbenchStore((s) => s.vibeContext?.path ?? null);
  const [gateOpen, setGateOpen] = useState(false);
  const [localeOpen, setLocaleOpen] = useState(false);
  const { locale, setLocale } = useLocale();

  useEffect(() => {
    if (vibePath && !qualityGate) void refreshQualityGate();
  }, [vibePath, qualityGate, refreshQualityGate]);

  return (
    <header className="relative z-20 flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#16161A]/80 px-4 backdrop-blur-2xl">
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-sm font-semibold text-slate-200">
          {t(TITLES[activeView])}
        </span>
        <span className="hidden truncate text-xs text-slate-500 md:inline">
          {t('app.subtitle')}
        </span>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        {activeProvider && (
          <span
            title={activeProvider.name}
            className="flex max-w-44 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-400"
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
            <span className="truncate">{activeProvider.name}</span>
          </span>
        )}
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
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {qualityGate.status === 'GREEN' ? t('app.allGreen') : t('app.checkFailed')}
            </button>
            {gateOpen && qualityGate.status !== 'GREEN' && (
              <div
                data-quality-gate-errors
                className="absolute right-0 top-11 z-50 w-80 rounded-xl border border-white/10 bg-[#18181C] p-2 shadow-2xl"
              >
                <div className="mb-1 px-1 text-[10px] font-semibold text-rose-300">
                  Quality Gate · {qualityGate.projectPath.split(/[\\/]/).pop()}
                </div>
                <div className="max-h-56 space-y-1 overflow-y-auto">
                  {qualityGate.errors.length === 0 && (
                    <div className="px-1 py-2 text-[10px] text-slate-500">
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
        <div className="relative">
          <button
            type="button"
            data-locale
            aria-label="Locale"
            onClick={() => setLocaleOpen((v) => !v)}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 text-xs text-slate-400 transition-colors hover:border-white/20 hover:text-slate-200"
          >
            <span aria-hidden>🌐</span>
            <span>{LOCALES.find((l) => l.code === locale)?.label ?? '中文'}</span>
          </button>
          {localeOpen && (
            <div
              data-locale-popover
              className="absolute right-0 top-11 z-50 w-36 rounded-xl border border-white/10 bg-[#18181C] p-1 shadow-2xl"
            >
              {LOCALES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  data-locale-option={l.code}
                  aria-pressed={locale === l.code}
                  onClick={() => {
                    setLocale(l.code);
                    setLocaleOpen(false);
                  }}
                  className={`flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] transition-colors hover:bg-white/[0.06] ${
                    locale === l.code ? 'text-emerald-300' : 'text-slate-400'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          )}
        </div>
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
