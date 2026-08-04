import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  Code2,
  BookOpen,
  Zap,
  TrendingUp,
  Link2,
} from "lucide-react";
import { useAppStore, type ViewId } from "../stores/appStore";

interface Command {
  id: ViewId;
  label: string;
  icon: React.ReactNode;
}

const commands: Command[] = [
  { id: "chat", label: "对话中枢", icon: <MessageSquare size={16} /> },
  { id: "vibe-coding", label: "Vibe Coding 工场", icon: <Code2 size={16} /> },
  { id: "knowledge", label: "知识中枢", icon: <BookOpen size={16} /> },
  { id: "automation", label: "自动化执行台", icon: <Zap size={16} /> },
  { id: "monetization", label: "创收工作台", icon: <TrendingUp size={16} /> },
  { id: "connections", label: "连接组织", icon: <Link2 size={16} /> },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const setActiveView = useAppStore((s) => s.setActiveView);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = commands.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase())
  );

  const dismiss = useCallback(() => {
    setOpen(false);
    setQuery("");
    setSelectedIdx(0);
  }, []);

  const activate = useCallback(
    (cmd: Command) => {
      setActiveView(cmd.id);
      dismiss();
    },
    [setActiveView, dismiss]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        dismiss();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && filtered[selectedIdx]) {
        e.preventDefault();
        activate(filtered[selectedIdx]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, selectedIdx, dismiss, activate]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      setSelectedIdx(0);
    }
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="absolute inset-0 bg-black/50"
            onClick={dismiss}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-[480px] max-h-[380px] overflow-hidden rounded-[var(--radius-lg)] shadow-2xl"
            style={{
              background: "rgba(10,10,10,0.92)",
              backdropFilter: "blur(16px)",
              border: "1px solid var(--color-border)",
            }}
          >
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIdx(0);
              }}
              placeholder="Search views or commands..."
              className="w-full px-4 py-3 text-sm bg-transparent outline-none"
              style={{
                color: "var(--color-text-primary)",
                borderBottom: "1px solid var(--color-border)",
              }}
            />
            <div className="overflow-y-auto max-h-[316px] py-1">
              {filtered.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
                  No results
                </div>
              ) : (
                filtered.map((cmd, i) => (
                  <button
                    key={cmd.id}
                    onClick={() => activate(cmd)}
                    className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-all duration-100 ${
                      i === selectedIdx
                        ? ""
                        : ""
                    }`}
                    style={i === selectedIdx ? {
                      background: "var(--color-accent-muted)",
                      color: "var(--color-accent)",
                      borderLeft: "2px solid var(--color-accent)",
                    } : {
                      color: "var(--color-text-secondary)",
                      borderLeft: "2px solid transparent",
                    }}
                    onMouseEnter={(e) => { if (i !== selectedIdx) { e.currentTarget.style.background = "var(--color-surface-hover)"; } }}
                    onMouseLeave={(e) => { if (i !== selectedIdx) { e.currentTarget.style.background = "transparent"; } }}
                  >
                    <span
                      style={i === selectedIdx
                        ? { color: "var(--color-accent)" }
                        : { color: "var(--color-text-muted)" }
                      }
                    >
                      {cmd.icon}
                    </span>
                    {cmd.label}
                  </button>
                ))
              )}
            </div>
            {/* Footer hints */}
            <div className="flex items-center gap-3 px-4 py-2 text-[10px] border-t" style={{ color: "var(--color-text-muted)", borderColor: "var(--color-border)" }}>
              <span><kbd className="font-mono text-[9px] px-1 py-0.5 rounded" style={{ background: "var(--color-surface-hover)" }}>↑↓</kbd> navigate</span>
              <span><kbd className="font-mono text-[9px] px-1 py-0.5 rounded" style={{ background: "var(--color-surface-hover)" }}>↵</kbd> open</span>
              <span><kbd className="font-mono text-[9px] px-1 py-0.5 rounded" style={{ background: "var(--color-surface-hover)" }}>esc</kbd> close</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
