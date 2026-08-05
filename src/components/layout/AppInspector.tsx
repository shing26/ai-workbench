import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useWorkbenchStore } from '../../stores/workbenchStore';

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

  return (
    <aside
      aria-hidden={!inspector}
      aria-label={inspector?.title}
      className={`drawer-panel absolute inset-y-0 right-0 z-40 w-60 overflow-y-auto border-l border-white/[0.06] bg-[#16161A]/90 shadow-2xl backdrop-blur-2xl ${
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
