import { useState, useRef, useEffect, useCallback } from "react";
import gsap from "gsap";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Code2, BookOpen, Zap, TrendingUp, Link2, Settings, Bell, Sparkles,
} from "lucide-react";
import { useAppStore, type ViewId } from "../stores/appStore";
import { useConnectionStore, type ConnectionEvent } from "../stores/connectionStore";

const sourceIcons: Record<string, React.ReactNode> = {
  chat: <MessageSquare size={12} />,
  automation: <Zap size={12} />,
  knowledge: <BookOpen size={12} />,
  vibe: <Code2 size={12} />,
  system: <Link2 size={12} />,
};

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return Math.floor(diff / 60_000) + "m";
  if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + "h";
  return Math.floor(diff / 86_400_000) + "d";
}

const navItems: { id: ViewId; icon: React.ReactNode; label: string }[] = [
  { id: "chat", icon: <MessageSquare size={18} />, label: "Chat" },
  { id: "vibe-coding", icon: <Code2 size={18} />, label: "Vibe Coding" },
  { id: "knowledge", icon: <BookOpen size={18} />, label: "Knowledge" },
  { id: "automation", icon: <Zap size={18} />, label: "Automation" },
  { id: "monetization", icon: <TrendingUp size={18} />, label: "Monetization" },
  { id: "connections", icon: <Link2 size={18} />, label: "Connections" },
];

export default function Sidebar() {
  const activeView = useAppStore((s) => s.activeView);
  const setActiveView = useAppStore((s) => s.setActiveView);
  const badgeCount = useConnectionStore((s) => s.badgeCount);
  const events = useConnectionStore((s) => s.events);
  const clearBadge = useConnectionStore((s) => s.clearBadge);

  const [expanded, setExpanded] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<number>(0);
  const leaveTimerRef = useRef<number>(0);

  const urgentEvents = events.filter((e) => e.level === "urgent").slice(0, 5);

  const handleLogoClick = () => {
    setBellOpen((prev) => !prev);
    if (!bellOpen) clearBadge();
  };

  const handleNavigate = (evt: ConnectionEvent) => {
    if (evt.targetView) setActiveView(evt.targetView as any);
    setBellOpen(false);
  };

  const handleMouseEnter = useCallback(() => {
    clearTimeout(leaveTimerRef.current);
    hoverTimerRef.current = window.setTimeout(() => setExpanded(true), 200);
  }, []);

  const handleMouseLeave = useCallback(() => {
    clearTimeout(hoverTimerRef.current);
    leaveTimerRef.current = window.setTimeout(() => setExpanded(false), 150);
  }, []);

  useEffect(() => {
    if (sidebarRef.current) {
      gsap.to(sidebarRef.current, {
        width: expanded ? 180 : 60,
        duration: 0.3,
        ease: "power3.out",
      });
    }
  }, [expanded]);

  useEffect(() => {
    if (!bellOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setBellOpen(false); };
    const onClick = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => { window.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onClick); };
  }, [bellOpen]);

  useEffect(() => {
    return () => { clearTimeout(hoverTimerRef.current); clearTimeout(leaveTimerRef.current); };
  }, []);

  return (
    <nav
      ref={sidebarRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="scrollbar-sidebar flex flex-col items-center gap-0.5 py-3 shrink-0 overflow-hidden relative"
      style={{ width: "var(--sidebar-width)", background: "var(--color-bg-secondary)", borderRight: "1px solid var(--color-border)" }}
    >
      {/* Logo + Notification */}
      <div ref={bellRef} className="relative mb-4">
        <button
          onClick={handleLogoClick}
          className="relative flex items-center justify-center w-9 h-9 rounded-[var(--radius-md)] transition-all duration-150 active:scale-95"
          style={{ background: "var(--color-accent-muted)", color: "var(--color-accent)" }}
          title="AI Workbench"
        >
          <Sparkles size={18} />
          {badgeCount > 0 && (
            <span
              className="absolute -bottom-0.5 -right-0.5 w-[7px] h-[7px] rounded-full"
              style={{
                background: "radial-gradient(circle, var(--color-error), #f87171)",
                animation: "pulse-bell 2s ease-in-out infinite",
              }}
            />
          )}
        </button>

        <AnimatePresence>
          {bellOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -4 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="absolute left-full top-0 ml-2 w-80 max-h-[360px] overflow-hidden rounded-[var(--radius-lg)] z-50"
              style={{ background: "var(--color-bg-secondary)", border: "1px solid var(--color-border)", boxShadow: "0 16px 48px rgba(0,0,0,0.5)" }}
            >
              <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: "var(--color-border)" }}>
                <span className="text-[11px] font-medium" style={{ color: "var(--color-text-primary)" }}>Notifications</span>
              </div>
              <div className="overflow-y-auto max-h-[280px] py-1">
                {urgentEvents.length === 0 ? (
                  <div className="px-4 py-8 text-center text-[11px]" style={{ color: "var(--color-text-muted)" }}>No urgent notifications</div>
                ) : (
                  urgentEvents.map((evt) => (
                    <button
                      key={evt.id}
                      onClick={() => handleNavigate(evt)}
                      className="flex items-start gap-2.5 w-full px-4 py-2.5 text-left transition-colors active:scale-[0.99]"
                      style={{ color: "var(--color-text-primary)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-surface-hover)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <span className="mt-0.5 shrink-0" style={{ color: "var(--color-error)" }}>
                        {sourceIcons[evt.source] ?? <Bell size={12} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-medium truncate">{evt.title}</div>
                        <div className="text-[10px] truncate mt-0.5" style={{ color: "var(--color-text-muted)" }}>{evt.body}</div>
                      </div>
                      <span className="text-[9px] shrink-0 mt-0.5 tabular-nums" style={{ color: "var(--color-text-muted)" }}>{relativeTime(evt.timestamp)}</span>
                    </button>
                  ))
                )}
              </div>
              <div className="border-t px-4 py-2" style={{ borderColor: "var(--color-border)" }}>
                <button
                  onClick={() => { setActiveView("connections"); setBellOpen(false); }}
                  className="w-full text-center text-[10px] transition-colors"
                  style={{ color: "var(--color-text-secondary)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-text-primary)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-text-secondary)"; }}
                >
                  View all events
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav items */}
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => setActiveView(item.id)}
          title={item.label}
          className="relative flex items-center w-full h-9 rounded-[var(--radius-sm)] transition-colors duration-150 active:scale-95 overflow-hidden"
          style={{
            paddingLeft: expanded ? "14px" : "0px",
            justifyContent: expanded ? "flex-start" : "center",
            color: activeView === item.id ? "var(--color-text-primary)" : "var(--color-text-muted)",
            background: activeView === item.id ? "var(--color-accent-muted)" : "transparent",
          }}
          onMouseEnter={(e) => {
            if (activeView !== item.id) { e.currentTarget.style.color = "var(--color-text-secondary)"; e.currentTarget.style.background = "var(--color-surface-hover)"; }
          }}
          onMouseLeave={(e) => {
            if (activeView !== item.id) { e.currentTarget.style.color = "var(--color-text-muted)"; e.currentTarget.style.background = "transparent"; }
          }}
        >
          {activeView === item.id && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full" style={{ background: "var(--color-accent)" }} />
          )}
          <span className="flex items-center justify-center shrink-0" style={{ marginRight: expanded ? "10px" : "0px" }}>
            {item.icon}
          </span>
          <span
            className="text-[12px] font-medium whitespace-nowrap select-none"
            style={{
              opacity: expanded ? 1 : 0,
              transform: expanded ? "translateX(0)" : "translateX(-4px)",
              transition: `opacity 0.2s var(--ease-out) ${navItems.indexOf(item) * 0.04}s, transform 0.25s var(--ease-out) ${navItems.indexOf(item) * 0.04}s`,
              pointerEvents: "none",
            }}
          >
            {item.label}
          </span>
        </button>
      ))}

      <div className="flex-1" />

      <button
        onClick={() => { (window as any).__openSettings?.(); }}
        title="Settings"
        className="flex items-center w-full h-9 rounded-[var(--radius-sm)] transition-colors duration-150 active:scale-95 overflow-hidden"
        style={{
          paddingLeft: expanded ? "14px" : "0px",
          justifyContent: expanded ? "flex-start" : "center",
          color: "var(--color-text-muted)",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-text-secondary)"; e.currentTarget.style.background = "var(--color-surface-hover)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-text-muted)"; e.currentTarget.style.background = "transparent"; }}
      >
        <span className="flex items-center justify-center shrink-0" style={{ marginRight: expanded ? "10px" : "0px" }}>
          <Settings size={16} />
        </span>
        <span
          className="text-[12px] font-medium whitespace-nowrap select-none"
          style={{
            opacity: expanded ? 1 : 0,
            transform: expanded ? "translateX(0)" : "translateX(-4px)",
            transition: "opacity 0.2s var(--ease-out) 0.24s, transform 0.25s var(--ease-out) 0.24s",
            pointerEvents: "none",
          }}
        >
          Settings
        </span>
      </button>
    </nav>
  );
}