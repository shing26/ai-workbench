import { useState, useRef } from "react";
import { ChevronRight, Lightbulb, HelpCircle, Code2, Play, CheckCircle, Terminal, FileText } from "lucide-react";
import { useVibeStore } from "../stores/vibeStore";

const phases = [
  { key: "capture", label: "Idea Capture", icon: Lightbulb, desc: "Describe what you want to build" },
  { key: "clarifying", label: "Clarify", icon: HelpCircle, desc: "AI asks 1-3 key questions" },
  { key: "implementing", label: "Implement", icon: Code2, desc: "Codex generates code" },
  { key: "running", label: "Run and Fix", icon: Play, desc: "Execute, read errors, repair" },
  { key: "accept", label: "Accept", icon: CheckCircle, desc: "Review and sign off" },
];

export default function VibeCodingView() {
  const { idea, phase, setIdea, startClarifying, selectClarification, startImplementing, accept, reset } = useVibeStore();
  const [input, setInput] = useState(idea);
  const codeRef = useRef<HTMLPreElement>(null);

  const phaseIdx = phases.findIndex(p => {
    if (phase === "idle") return false;
    if (p.key === "accept" && (phase === "done" || phase === "accepted")) return true;
    return p.key === phase;
  });

  return (
    <div className="flex h-full w-full">
      <aside className="scrollbar-mid shrink-0 flex flex-col overflow-hidden" style={{ width: "var(--chat-mid-panel-min)", minWidth: "var(--chat-mid-panel-min)", maxWidth: "var(--chat-mid-panel-max)", background: "var(--color-surface)", borderRight: "1px solid var(--color-border)" }}>
        <div className="px-3 pt-3 pb-1"><span className="text-[10px] font-medium uppercase tracking-wider mb-2 block" style={{ color: "var(--color-text-muted)" }}>Process</span></div>
        <div className="flex-1 overflow-y-auto scrollbar-mid px-2">
          {phases.map((p, i) => {
            const active = i === phaseIdx;
            const done = i < phaseIdx;
            return (
              <div key={p.key} className="flex gap-2 mb-0.5">
                <div className="flex flex-col items-center pt-2 shrink-0" style={{ width: "20px" }}>
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: done ? "var(--color-accent)" : active ? "var(--color-accent)" : "var(--color-text-muted)", boxShadow: active ? "0 0 6px var(--color-accent)" : "none", animation: active ? "pulse-dot 2s ease-in-out infinite" : "none" }} />
                  {i < phases.length - 1 && <div className="w-px flex-1 my-0.5" style={{ background: done ? "var(--color-accent)" : "var(--color-border-subtle)" }} />}
                </div>
                <div className="flex-1 px-2.5 py-2 rounded-[var(--radius-sm)]" style={{ background: active ? "var(--color-accent-muted)" : "transparent", borderLeft: active ? "2px solid var(--color-accent)" : "2px solid transparent" }}>
                  <div className="flex items-center gap-1.5">
                    <p.icon size={14} style={{ color: done || active ? "var(--color-accent)" : "var(--color-text-muted)" }} />
                    <span className="text-[12px] font-medium" style={{ color: done || active ? "var(--color-text-primary)" : "var(--color-text-muted)" }}>{p.label}</span>
                  </div>
                  <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>{p.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0" style={{ background: "var(--color-bg-primary)" }}>
        <div className="flex items-center h-[40px] px-4 shrink-0 border-b" style={{ borderColor: "var(--color-border)" }}>
          <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
            <span>AI Workbench</span><ChevronRight size={10} /><span className="font-medium" style={{ color: "var(--color-text-secondary)" }}>Vibe Coding</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-content p-6">
          {phase === "idle" ? (
            <div className="max-w-xl mx-auto mt-16">
              <div className="p-6 rounded-[var(--radius-lg)]" style={{ background: "var(--color-bg-secondary)", border: "1px solid var(--color-border)" }}>
                <div className="flex items-center gap-2 mb-4"><Lightbulb size={18} style={{ color: "var(--color-accent)" }} /><h2 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>What do you want to build?</h2></div>
                <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Describe your idea in one sentence..." rows={3} className="w-full bg-transparent resize-none outline-none text-sm px-3 py-2 rounded-[var(--radius-md)] mb-4" style={{ background: "var(--color-bg-primary)", color: "var(--color-text-primary)", border: "1px solid var(--color-border)" }} />
                <button onClick={() => { setIdea(input); startClarifying(); }} disabled={!input.trim()} className="px-4 py-2 rounded-[var(--radius-md)] text-[13px] font-medium transition-all duration-150 active:scale-[0.98] disabled:opacity-30" style={{ background: "var(--color-accent)", color: "#121214" }}>Start Building</button>
              </div>
            </div>
          ) : phase === "clarifying" ? (
            <div className="max-w-xl mx-auto mt-16">
              <div className="p-6 rounded-[var(--radius-lg)]" style={{ background: "var(--color-bg-secondary)", border: "1px solid var(--color-border)" }}>
                <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text-primary)" }}>Clarifying your idea</h2>
                <p className="text-[12px] mb-4" style={{ color: "var(--color-text-muted)" }}>Answer these questions to help the AI understand better:</p>
                <div className="space-y-3">
                  {[{ q: "What platform is this for?", opts: ["Web", "CLI", "Desktop", "Mobile"] }].map((cq, i) => (
                    <div key={i} className="p-3 rounded-[var(--radius-sm)]" style={{ background: "var(--color-bg-primary)" }}>
                      <p className="text-[12px] font-medium mb-2" style={{ color: "var(--color-text-secondary)" }}>{cq.q}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {cq.opts.map((opt) => (
                          <button key={opt} onClick={() => selectClarification(i, opt)} className="px-2.5 py-1 rounded text-[11px] transition-all duration-150 active:scale-95" style={{ background: "var(--color-surface-hover)", color: "var(--color-text-secondary)", border: "1px solid var(--color-border-subtle)" }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-accent-muted)"; e.currentTarget.style.color = "var(--color-accent)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--color-surface-hover)"; e.currentTarget.style.color = "var(--color-text-secondary)"; }}>{opt}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={startImplementing} className="mt-4 px-4 py-2 rounded-[var(--radius-md)] text-[13px] font-medium transition-all duration-150 active:scale-[0.98]" style={{ background: "var(--color-accent)", color: "#121214" }}>Start Implementation</button>
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-accent)", animation: "pulse-dot 2s ease-in-out infinite" }} />
                <span className="text-[11px]" style={{ color: "var(--color-accent)" }}>{phase === "implementing" ? "Implementing..." : phase === "running" ? "Running..." : phase === "done" ? "Done - review the output" : "Accepted"}</span>
              </div>
              <div className="rounded-[var(--radius-lg)] overflow-hidden border" style={{ background: "var(--color-bg-secondary)", borderColor: "var(--color-border)" }}>
                <div className="flex items-center gap-1.5 px-3 py-1.5 border-b text-[10px]" style={{ borderColor: "var(--color-border-subtle)", color: "var(--color-text-muted)", background: "var(--color-bg-primary)" }}>
                  <Terminal size={10} /><span>Output</span><div className="flex-1" /><FileText size={10} /><span>main.ts</span>
                </div>
                <pre ref={codeRef} className="code-block px-4 py-3 overflow-x-auto whitespace-pre-wrap text-sm" style={{ color: "var(--color-text-primary)", borderLeft: "2px solid var(--color-accent)" }}>{phase === "accepted" ? "// Build complete and accepted." : "// Code output will appear here..."}</pre>
              </div>
              {(phase === "done" || phase === "accepted") && (
                <div className="flex gap-2 mt-4">
                  <button onClick={() => { accept(); }} className="px-4 py-2 rounded-[var(--radius-md)] text-[13px] font-medium transition-all duration-150 active:scale-[0.98]" style={{ background: "var(--color-accent)", color: "#121214" }}>Accept and Finish</button>
                  <button onClick={() => { reset(); }} className="px-4 py-2 rounded-[var(--radius-md)] text-[13px] transition-all duration-150 active:scale-[0.98]" style={{ background: "var(--color-surface-hover)", color: "var(--color-text-secondary)", border: "1px solid var(--color-border)" }}>New Idea</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}