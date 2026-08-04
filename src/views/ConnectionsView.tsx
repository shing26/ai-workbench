import { useState } from "react";
import { ChevronRight, Link2, Bell, MessageSquare, Zap, BookOpen, Code2, Filter } from "lucide-react";
import { useConnectionStore } from "../stores/connectionStore";
import { useAppStore } from "../stores/appStore";

const sourceIcons: Record<string, React.ReactNode> = {
  chat: <MessageSquare size={12} />,
  automation: <Zap size={12} />,
  knowledge: <BookOpen size={12} />,
  vibe: <Code2 size={12} />,
  system: <Link2 size={12} />,
};

const sourceLabels: Record<string, string> = {
  chat: "Chat", automation: "Automation", knowledge: "Knowledge", vibe: "Vibe Coding", system: "System",
};

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return Math.floor(diff / 60_000) + "m ago";
  if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + "h ago";
  return Math.floor(diff / 86_400_000) + "d ago";
}

export default function ConnectionsView() {
  const { events } = useConnectionStore();
  const setActiveView = useAppStore((s) => s.setActiveView);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState<string | null>(null);

  const filtered = events.filter(e => {
    if (sourceFilter && e.source !== sourceFilter) return false;
    if (levelFilter && e.level !== levelFilter) return false;
    return true;
  });

  const sources = [...new Set(events.map(e => e.source))];

  return (
    <div className="flex h-full w-full">
      {/* === MID PANEL: Filters === */}
      <aside className="scrollbar-mid shrink-0 flex flex-col overflow-hidden"
        style={{ width: "var(--chat-mid-panel-min)", minWidth: "var(--chat-mid-panel-min)", maxWidth: "var(--chat-mid-panel-max)", background: "var(--color-surface)", borderRight: "1px solid var(--color-border)" }}>
        <div className="px-3 pt-3 pb-1">
          <div className="flex items-center gap-1.5 mb-3">
            <Filter size={12} style={{ color: "var(--color-text-muted)" }} />
            <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Filters</span>
          </div>
          <div className="mb-3">
            <span className="text-[9px] font-medium uppercase mb-1.5 block" style={{ color: "var(--color-text-muted)" }}>Source</span>
            <div className="flex flex-wrap gap-1">
              <button onClick={() => setSourceFilter(null)}
                className="px-2 py-1 rounded text-[10px] transition-colors"
                style={{ background: !sourceFilter ? "var(--color-accent-muted)" : "transparent", color: !sourceFilter ? "var(--color-accent)" : "var(--color-text-muted)", border: !sourceFilter ? "1px solid rgba(16,185,129,0.3)" : "1px solid transparent" }}>
                All
              </button>
              {sources.map((s) => (
                <button key={s} onClick={() => setSourceFilter(sourceFilter === s ? null : s)}
                  className="px-2 py-1 rounded text-[10px] transition-colors"
                  style={{ background: sourceFilter === s ? "var(--color-accent-muted)" : "transparent", color: sourceFilter === s ? "var(--color-accent)" : "var(--color-text-muted)", border: sourceFilter === s ? "1px solid rgba(16,185,129,0.3)" : "1px solid transparent" }}>
                  {sourceLabels[s] ?? s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="text-[9px] font-medium uppercase mb-1.5 block" style={{ color: "var(--color-text-muted)" }}>Level</span>
            <div className="flex gap-1">
              {["urgent", "quiet"].map((l) => (
                <button key={l} onClick={() => setLevelFilter(levelFilter === l ? null : l)}
                  className="px-2 py-1 rounded text-[10px] capitalize transition-colors"
                  style={{ background: levelFilter === l ? "var(--color-accent-muted)" : "transparent", color: levelFilter === l ? "var(--color-accent)" : l === "urgent" ? "var(--color-error)" : "var(--color-text-muted)", border: levelFilter === l ? "1px solid rgba(16,185,129,0.3)" : "1px solid transparent" }}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* === RIGHT PANEL: Timeline === */}
      <div className="flex-1 flex flex-col min-w-0" style={{ background: "var(--color-bg-primary)" }}>
        <div className="flex items-center h-[40px] px-4 shrink-0 border-b" style={{ borderColor: "var(--color-border)" }}>
          <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
            <span>AI Workbench</span><ChevronRight size={10} /><span className="font-medium" style={{ color: "var(--color-text-secondary)" }}>Connections</span>
          </div>
          <div className="flex-1" />
          <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>{filtered.length} events</span>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-content py-2">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Bell size={28} className="mx-auto mb-3" style={{ color: "var(--color-text-muted)" }} />
                <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>No events match your filters</p>
              </div>
            </div>
          ) : (
            filtered.map((evt) => (
              <button key={evt.id} onClick={() => { if (evt.targetView) setActiveView(evt.targetView as any); }}
                className="flex items-start gap-3 w-full px-4 py-2.5 text-left transition-colors"
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-surface-hover)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                <span className="mt-0.5 shrink-0" style={{ color: evt.level === "urgent" ? "var(--color-error)" : "var(--color-text-muted)" }}>
                  {sourceIcons[evt.source] ?? <Bell size={12} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] font-medium" style={{ color: "var(--color-text-primary)" }}>{evt.title}</span>
                    <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: "var(--color-surface-hover)", color: "var(--color-text-muted)" }}>{sourceLabels[evt.source] ?? evt.source}</span>
                  </div>
                  <div className="text-[11px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>{evt.body}</div>
                </div>
                <span className="text-[9px] shrink-0 tabular-nums" style={{ color: "var(--color-text-muted)" }}>{relativeTime(evt.timestamp)}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}