import { X } from "lucide-react";
import { useWorkbenchStore } from "../../stores/workbenchStore";

export default function AppInspector() {
  const inspector = useWorkbenchStore((s) => s.inspector);
  const closeInspector = useWorkbenchStore((s) => s.closeInspector);

  return (
    <aside
      className={`shrink-0 overflow-y-auto border-l border-white/[0.06] bg-[#16161A]/80 backdrop-blur-2xl transition-[width] duration-150 ${
        inspector ? "w-60" : "w-0 border-l-0"
      }`}
    >
      {inspector && (
        <div className="flex h-full flex-col">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-3">
            <span className="truncate text-xs font-medium text-slate-200">{inspector.title}</span>
            <button
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
              <div key={section.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="text-[10px] uppercase tracking-wide text-slate-500">{section.label}</div>
                <div className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-300">
                  {section.value || "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
