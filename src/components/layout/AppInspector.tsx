import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useWorkbenchStore } from '../../stores/workbenchStore';

const STATUS_STYLE: Record<string, { dot: string; label: string }> = {
  idle: { dot: 'bg-slate-500', label: 'idle' },
  connecting: { dot: 'bg-amber-400 animate-ping', label: 'connecting' },
  streaming: { dot: 'bg-emerald-400 animate-pulse', label: 'streaming' },
  completed: { dot: 'bg-emerald-400', label: 'completed' },
  error: { dot: 'bg-rose-500', label: 'error' },
};

export default function AppInspector() {
  const inspector = useWorkbenchStore((s) => s.inspector);
  const closeInspector = useWorkbenchStore((s) => s.closeInspector);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!inspector) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeInspector();
    };
    window.addEventListener('keydown', onKey);
    const timer = window.setTimeout(() => closeRef.current?.focus(), 100);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [inspector, closeInspector]);

  const metrics = inspector?.metrics ?? null;
  const contextPercentage =
    metrics && metrics.contextLimit > 0
      ? Math.min(100, Math.round((metrics.contextUsed / metrics.contextLimit) * 100))
      : 0;
  const status = metrics ? (STATUS_STYLE[metrics.status] ?? STATUS_STYLE.idle) : null;

  return (
    <aside
      aria-hidden={!inspector}
      aria-label={inspector?.title}
      className={`drawer-panel absolute inset-y-0 right-0 z-40 w-72 overflow-y-auto border-l border-white/[0.06] bg-[#16161A]/90 shadow-2xl backdrop-blur-2xl ${
        inspector
          ? 'pointer-events-auto translate-x-0 opacity-100'
          : 'pointer-events-none translate-x-full opacity-0'
      }`}
    >
      {inspector && (
        <div className="flex h-full flex-col">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-3">
            <span className="truncate text-xs font-medium text-slate-200">{inspector.title}</span>
            <button
              ref={closeRef}
              type="button"
              onClick={closeInspector}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-white/[0.06] hover:text-slate-200"
              aria-label="Close inspector"
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex-1 space-y-3 p-3">
            {metrics && (
              <>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <span className="text-[10px] uppercase tracking-wide text-slate-500">
                    Stream status
                  </span>
                  {status && (
                    <span className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${status.dot}`} />
                      <span className="text-[11px] font-medium capitalize text-slate-300">
                        {status.label}
                      </span>
                    </span>
                  )}
                </div>

                <div className="rounded-xl border border-white/10 bg-[#18181C] p-3">
                  <div className="mb-1.5 text-[10px] uppercase tracking-wide text-slate-500">
                    Active provider
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-medium text-slate-200">
                      {metrics.providerName || '—'}
                    </span>
                    {metrics.modelName && (
                      <span className="shrink-0 rounded-md border border-sky-500/20 bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-300">
                        {metrics.modelName}
                      </span>
                    )}
                  </div>
                  {metrics.baseUrl && (
                    <div className="mt-1 truncate font-mono text-[10px] text-slate-500">
                      {metrics.baseUrl}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-white/10 bg-[#18181C] p-3">
                    <div className="text-[10px] text-slate-500">TTFT 延迟</div>
                    <div className="mt-1 font-mono text-base font-bold text-emerald-400">
                      {metrics.ttftMs !== null ? `${metrics.ttftMs}ms` : '--'}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-[#18181C] p-3">
                    <div className="text-[10px] text-slate-500">速率 (TPS)</div>
                    <div className="mt-1 font-mono text-base font-bold text-sky-400">
                      {metrics.tokensPerSec > 0 ? `${metrics.tokensPerSec} t/s` : '--'}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-[#18181C] p-3">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-500">Context window</span>
                    <span className="font-mono text-slate-300">{contextPercentage}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-sky-500/80 transition-[width] duration-300 ease-out"
                      style={{ width: `${contextPercentage}%` }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between font-mono text-[10px] text-slate-500">
                    <span>{metrics.contextUsed} tk</span>
                    <span>{metrics.contextLimit} tk</span>
                  </div>
                </div>

                {metrics.lastError && (
                  <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-[11px] leading-relaxed text-rose-400">
                    <div className="mb-1 text-[10px] font-semibold uppercase">Stream error</div>
                    {metrics.lastError}
                  </div>
                )}
              </>
            )}
            {inspector.sections.map((section) => (
              <div
                key={section.label}
                className="drawer-section rounded-xl border border-white/10 bg-white/[0.03] p-3"
              >
                <div className="text-[10px] uppercase tracking-wide text-slate-500">
                  {section.label}
                </div>
                <div className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-300">
                  {section.value || '—'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
