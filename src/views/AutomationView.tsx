import { useState } from "react";
import { ChevronRight, Zap, Clock, Play, Pause, Trash2, Plus, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { useAutomationStore, type TaskConfig } from "../stores/automationStore";

const typeLabels: Record<string, { label: string; icon: React.ReactNode }> = {
  rss: { label: "RSS Monitor", icon: <Zap size={12} /> },
  web: { label: "Web Scraper", icon: <Zap size={12} /> },
  "api-price": { label: "Price Tracker", icon: <Zap size={12} /> },
  "api-custom": { label: "Custom API", icon: <Zap size={12} /> },
};

const statusIcons: Record<string, React.ReactNode> = {
  running: <Play size={10} />,
  paused: <Pause size={10} />,
  ok: <CheckCircle size={10} />,
  failed: <XCircle size={10} />,
};

export default function AutomationView() {
  const { tasks, addTask, removeTask, pauseTask, resumeTask } = useAutomationStore();
  const [selectedTask, setSelectedTask] = useState<TaskConfig | null>(null);

  const grouped: Record<string, TaskConfig[]> = {};
  for (const t of tasks) {
    if (!grouped[t.sourceType]) grouped[t.sourceType] = [];
    grouped[t.sourceType].push(t);
  }

  return (
    <div className="flex h-full w-full">
      {/* === MID PANEL: Task list === */}
      <aside className="scrollbar-mid shrink-0 flex flex-col overflow-hidden"
        style={{ width: "var(--chat-mid-panel-min)", minWidth: "var(--chat-mid-panel-min)", maxWidth: "var(--chat-mid-panel-max)", background: "var(--color-surface)", borderRight: "1px solid var(--color-border)" }}>
        <div className="flex items-center justify-between px-3 pt-3 pb-1">
          <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Tasks</span>
          <button onClick={() => addTask('New Task', { sourceType: 'web' as const, sourceUrl: '', schedule: 3600000, alertRules: [], mode: 'silent' as const })}
            className="p-1 rounded transition-colors" style={{ color: "var(--color-text-muted)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-surface-hover)"; e.currentTarget.style.color = "var(--color-accent)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--color-text-muted)"; }}>
            <Plus size={13} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-mid">
          {Object.entries(grouped).map(([type, typeTasks]) => (
            <div key={type}>
              <div className="px-3 py-1.5 text-[9px] font-medium uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                {typeLabels[type]?.label ?? type}
              </div>
              {typeTasks.map((t) => (
                <button key={t.id} onClick={() => setSelectedTask(t)}
                  className="w-full text-left px-3 py-2 transition-colors"
                  style={{ borderLeft: selectedTask?.id === t.id ? "2px solid var(--color-accent)" : "2px solid transparent", background: selectedTask?.id === t.id ? "var(--color-accent-muted)" : "transparent" }}
                  onMouseEnter={(e) => { if (selectedTask?.id !== t.id) e.currentTarget.style.background = "var(--color-surface-hover)"; }}
                  onMouseLeave={(e) => { if (selectedTask?.id !== t.id) e.currentTarget.style.background = "transparent"; }}>
                  <div className="flex items-center gap-1.5">
                    <span style={{ color: t.status === "running" ? "var(--color-accent)" : t.status === "failed" ? "var(--color-error)" : "var(--color-text-muted)" }}>
                      {statusIcons[t.status]}
                    </span>
                    <span className="text-[12px] font-medium truncate" style={{ color: "var(--color-text-primary)" }}>{t.name}</span>
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                    <Clock size={9} className="inline mr-1" />{(t.schedule / 60000).toFixed(0)}min
                  </div>
                </button>
              ))}
            </div>
          ))}
          {tasks.length === 0 && (
            <div className="px-3 py-8 text-center text-[11px]" style={{ color: "var(--color-text-muted)" }}>No tasks configured</div>
          )}
        </div>
      </aside>

      {/* === RIGHT PANEL === */}
      <div className="flex-1 flex flex-col min-w-0" style={{ background: "var(--color-bg-primary)" }}>
        <div className="flex items-center h-[40px] px-4 shrink-0 border-b" style={{ borderColor: "var(--color-border)" }}>
          <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
            <span>AI Workbench</span><ChevronRight size={10} /><span className="font-medium" style={{ color: "var(--color-text-secondary)" }}>Automation</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-content p-6">
          {selectedTask ? (
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>{selectedTask.name}</h2>
                  <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>{selectedTask.sourceUrl || "No URL configured"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { if (selectedTask.status === 'running') pauseTask(selectedTask.id); else resumeTask(selectedTask.id); }}
                    className="px-3 py-1.5 rounded-[var(--radius-sm)] text-[11px] font-medium transition-colors"
                    style={{ background: selectedTask.status === "running" ? "var(--color-error-muted)" : "var(--color-accent-muted)", color: selectedTask.status === "running" ? "var(--color-error)" : "var(--color-accent)" }}>
                    {selectedTask.status === "running" ? "Pause" : "Start"}
                  </button>
                  <button onClick={() => { removeTask(selectedTask.id); setSelectedTask(null); }}
                    className="p-1.5 rounded transition-colors" style={{ color: "var(--color-text-muted)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-error)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-text-muted)"; }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                <div className="p-3 rounded-[var(--radius-md)]" style={{ background: "var(--color-bg-secondary)", border: "1px solid var(--color-border)" }}>
                  <span className="text-[10px] font-medium uppercase mb-2 block" style={{ color: "var(--color-text-muted)" }}>Configuration</span>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div><span style={{ color: "var(--color-text-muted)" }}>Type:</span> <span style={{ color: "var(--color-text-secondary)" }}>{selectedTask.sourceType}</span></div>
                    <div><span style={{ color: "var(--color-text-muted)" }}>Interval:</span> <span style={{ color: "var(--color-text-secondary)" }}>{Math.round(selectedTask.schedule / 60000).toString()} min</span></div>
                    <div><span style={{ color: "var(--color-text-muted)" }}>Status:</span> <span style={{ color: selectedTask.status === "running" ? "var(--color-accent)" : "var(--color-text-muted)" }}>{selectedTask.status}</span></div>
                    <div><span style={{ color: "var(--color-text-muted)" }}>Mode:</span> <span style={{ color: "var(--color-text-secondary)" }}>{selectedTask.mode}</span></div>
                  </div>
                </div>
                {selectedTask.alertRules.length > 0 && (
                  <div className="p-3 rounded-[var(--radius-md)]" style={{ background: "var(--color-bg-secondary)", border: "1px solid var(--color-border)" }}>
                    <span className="text-[10px] font-medium uppercase mb-2 block" style={{ color: "var(--color-text-muted)" }}>Alert Rules</span>
                    {selectedTask.alertRules.map((rule, i) => (
                      <div key={i} className="flex items-center gap-2 text-[11px] py-1">
                        <AlertTriangle size={10} style={{ color: "var(--color-warning)" }} />
                        <span style={{ color: "var(--color-text-secondary)" }}>{rule.field} {rule.operator} {rule.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Zap size={28} className="mx-auto mb-3" style={{ color: "var(--color-text-muted)" }} />
                <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Select a task to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
