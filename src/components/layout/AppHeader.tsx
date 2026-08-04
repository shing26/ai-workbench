import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useWorkbenchStore, type ViewId } from "../../stores/workbenchStore";

const TITLES: Record<ViewId, string> = {
  "ai-studio": "AI Studio",
  projects: "Projects",
  knowledge: "Knowledge & Inbox",
  actions: "Actions & Schedule",
  system: "System & Automation",
};

export default function AppHeader() {
  const activeView = useWorkbenchStore((s) => s.activeView);
  const setActiveView = useWorkbenchStore((s) => s.setActiveView);
  const providers = useWorkbenchStore((s) => s.providers);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const activeProvider = providers.find((p) => p.isActive);

  const items = useMemo(
    () => (Object.keys(TITLES) as ViewId[]).filter((id) => TITLES[id].toLowerCase().includes(query.toLowerCase())),
    [query],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

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
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs text-slate-400 transition-colors hover:border-white/20 hover:text-slate-200"
          >
            <Search size={14} />
            <span className="hidden md:inline">Search</span>
            <kbd className="rounded-md border border-white/10 bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-400">Ctrl K</kbd>
          </button>
          {open && (
            <div className="search-pop absolute right-0 top-11 w-72 overflow-hidden rounded-2xl border border-white/10 bg-[#18181C] shadow-xl">
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && items[0]) {
                    setActiveView(items[0]);
                    setOpen(false);
                    setQuery("");
                  }
                }}
                placeholder="Jump to view..."
                className="h-11 w-full border-b border-white/10 bg-transparent px-3 text-sm text-slate-200 outline-none placeholder:text-slate-600"
              />
              <div className="p-1.5">
                {items.length === 0 && <div className="px-3 py-6 text-center text-xs text-slate-600">No results</div>}
                {items.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setActiveView(id);
                      setOpen(false);
                      setQuery("");
                    }}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs text-slate-300 hover:bg-white/[0.06]"
                  >
                    <span>{TITLES[id]}</span>
                    {id === activeView && <span className="text-emerald-400">Active</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
