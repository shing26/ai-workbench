import { ChevronRight, TrendingUp, DollarSign, BarChart3, Plus, Sparkles } from "lucide-react";
import { useMonetizationStore } from "../stores/monetizationStore";

export default function MonetizationView() {
  const projects = useMonetizationStore((s) => s.projects); const monthlyRevenue = useMonetizationStore((s) => s.monthlyRevenue); 

  return (
    <div className="flex h-full w-full">
      {/* === MID PANEL: Project list === */}
      <aside className="scrollbar-mid shrink-0 flex flex-col overflow-hidden"
        style={{ width: "var(--chat-mid-panel-min)", minWidth: "var(--chat-mid-panel-min)", maxWidth: "var(--chat-mid-panel-max)", background: "var(--color-surface)", borderRight: "1px solid var(--color-border)" }}>
        <div className="flex items-center justify-between px-3 pt-3 pb-1">
          <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Projects</span>
          <button className="p-1 rounded transition-colors" style={{ color: "var(--color-text-muted)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-surface-hover)"; e.currentTarget.style.color = "var(--color-accent)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--color-text-muted)"; }}>
            <Plus size={13} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-mid">
          {projects.map((p) => (
            <div key={p.id} className="px-3 py-2 transition-colors" style={{ borderLeft: "2px solid var(--color-accent)" }}>
              <div className="text-[12px] font-medium" style={{ color: "var(--color-text-primary)" }}>{p.name}</div>
              <div className="flex items-center gap-2 mt-0.5 text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                <span>${useMonetizationStore.getState().projectRevenue(p.id).toFixed(2)}/mo</span>
                <span>·</span>
                <span>{p.status}</span>
              </div>
            </div>
          ))}
          {projects.length === 0 && (
            <div className="px-3 py-8 text-center text-[11px]" style={{ color: "var(--color-text-muted)" }}>No projects yet</div>
          )}
        </div>
      </aside>

      {/* === RIGHT PANEL: Revenue dashboard === */}
      <div className="flex-1 flex flex-col min-w-0" style={{ background: "var(--color-bg-primary)" }}>
        <div className="flex items-center h-[40px] px-4 shrink-0 border-b" style={{ borderColor: "var(--color-border)" }}>
          <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
            <span>AI Workbench</span><ChevronRight size={10} /><span className="font-medium" style={{ color: "var(--color-text-secondary)" }}>Monetization</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-content p-6">
          <div className="max-w-3xl mx-auto">
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label: "Monthly Revenue", value: `$${monthlyRevenue().toFixed(2)}`, icon: DollarSign },
                { label: "Growth", value: `+${0}%`, icon: TrendingUp },
                { label: "Active Products", value: projects.length.toString().toString(), icon: BarChart3 },
              ].map((card) => (
                <div key={card.label} className="p-4 rounded-[var(--radius-lg)]" style={{ background: "var(--color-bg-secondary)", border: "1px solid var(--color-border)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <card.icon size={14} style={{ color: "var(--color-accent)" }} />
                    <span className="text-[10px] font-medium uppercase" style={{ color: "var(--color-text-muted)" }}>{card.label}</span>
                  </div>
                  <div className="text-xl font-semibold" style={{ color: "var(--color-text-primary)" }}>{card.value}</div>
                </div>
              ))}
            </div>
            <div className="rounded-[var(--radius-lg)] p-6" style={{ background: "var(--color-bg-secondary)", border: "1px solid var(--color-border)" }}>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={16} style={{ color: "var(--color-accent)" }} />
                <h2 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>Idea Launchpad</h2>
              </div>
              <p className="text-[12px] mb-4" style={{ color: "var(--color-text-muted)" }}>Turn your ideas into revenue streams. Start by describing a product concept.</p>
              <button className="px-4 py-2 rounded-[var(--radius-md)] text-[13px] font-medium transition-all duration-150 active:scale-[0.98]"
                style={{ background: "var(--color-accent)", color: "#121214" }}>
                <Plus size={14} className="inline mr-1.5" /> New Idea
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
