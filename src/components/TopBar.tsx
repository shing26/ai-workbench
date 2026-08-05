import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Bell, MessageSquare, Code2, BookOpen, Zap, Link2 } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { useChatStore } from '../stores/chatStore';
import { useConnectionStore, type ConnectionEvent } from '../stores/connectionStore';

const sourceIcons: Record<string, React.ReactNode> = {
  chat: <MessageSquare size={12} />,
  automation: <Zap size={12} />,
  knowledge: <BookOpen size={12} />,
  vibe: <Code2 size={12} />,
  system: <Link2 size={12} />,
};

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return Math.floor(diff / 60_000) + 'm';
  if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + 'h';
  return Math.floor(diff / 86_400_000) + 'd';
}

export default function TopBar() {
  const budgetUsed = useChatStore((s) => s.budgetUsed);
  const budgetLimit = useChatStore((s) => s.budgetLimit);
  const badgeCount = useConnectionStore((s) => s.badgeCount);
  const events = useConnectionStore((s) => s.events);
  const clearBadge = useConnectionStore((s) => s.clearBadge);
  const budgetPct = Math.min((budgetUsed / budgetLimit) * 100, 100);
  const setActiveView = useAppStore((s) => s.setActiveView);

  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  const urgentEvents = events.filter((e) => e.level === 'urgent').slice(0, 5);

  const handleOpen = () => {
    setBellOpen(true);
    clearBadge();
  };

  const handleNavigate = (evt: ConnectionEvent) => {
    if (evt.targetView) setActiveView(evt.targetView as any);
    setBellOpen(false);
  };

  useEffect(() => {
    if (!bellOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBellOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [bellOpen]);

  return (
    <header
      className="flex items-center h-[var(--topbar-height)] px-4 shrink-0 gap-3"
      style={{
        background: 'var(--color-bg-primary)',
        boxShadow: 'inset 0 -1px 0 rgba(255,255,255,0.025)',
      }}
    >
      <h1
        className="text-[12px] font-semibold tracking-tight select-none"
        style={{ color: 'var(--color-text-primary)' }}
      >
        Workbench
      </h1>

      <div className="flex-1" />

      {/* Budget pill in top bar — compact */}
      <div
        className="flex items-center gap-2 text-[10px]"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <div
          className="w-14 h-1 rounded-full overflow-hidden"
          style={{ background: 'var(--color-surface-hover)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${budgetPct}%`,
              background:
                budgetPct >= 75
                  ? 'linear-gradient(90deg, var(--color-accent), var(--color-warning))'
                  : 'var(--color-accent)',
            }}
          />
        </div>
        <span className="tabular-nums">
          ${budgetUsed.toFixed(0)}/{budgetLimit}
        </span>
      </div>

      {/* Bell + dropdown */}
      <div ref={bellRef} className="relative">
        <button
          onClick={handleOpen}
          className="relative flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-150 active:scale-95"
          style={{ color: 'var(--color-text-muted)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--color-text-secondary)';
            e.currentTarget.style.background = 'var(--color-surface-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--color-text-muted)';
            e.currentTarget.style.background = 'transparent';
          }}
          title="Notifications"
        >
          <Bell size={15} />
          {badgeCount > 0 && (
            <span
              className="absolute top-0.5 right-0.5 w-[7px] h-[7px] rounded-full"
              style={{
                background: 'radial-gradient(circle, var(--color-error), #f87171)',
                animation: 'pulse-bell 2s ease-in-out infinite',
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
              className="absolute right-0 top-full mt-1.5 w-80 max-h-[360px] overflow-hidden rounded-[var(--radius-lg)] z-50"
              style={{
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
              }}
            >
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-border)]">
                <span className="text-[11px] font-medium text-[var(--color-text-primary)]">
                  Notifications
                </span>
              </div>
              <div className="overflow-y-auto max-h-[280px] py-1">
                {urgentEvents.length === 0 ? (
                  <div className="px-4 py-8 text-center text-[11px] text-[var(--color-text-muted)]">
                    No urgent notifications
                  </div>
                ) : (
                  urgentEvents.map((evt) => (
                    <button
                      key={evt.id}
                      onClick={() => handleNavigate(evt)}
                      className="flex items-start gap-2.5 w-full px-4 py-2.5 text-left hover:bg-[var(--color-surface-hover)] transition-colors active:scale-[0.99]"
                    >
                      <span className="mt-0.5 text-[var(--color-error)] shrink-0">
                        {sourceIcons[evt.source] ?? <Bell size={12} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-medium text-[var(--color-text-primary)] truncate">
                          {evt.title}
                        </div>
                        <div className="text-[10px] text-[var(--color-text-muted)] truncate mt-0.5">
                          {evt.body}
                        </div>
                      </div>
                      <span className="text-[9px] text-[var(--color-text-muted)] shrink-0 mt-0.5 tabular-nums">
                        {relativeTime(evt.timestamp)}
                      </span>
                    </button>
                  ))
                )}
              </div>
              <div className="border-t border-[var(--color-border)] px-4 py-2">
                <button
                  onClick={() => {
                    setActiveView('connections');
                    setBellOpen(false);
                  }}
                  className="w-full text-center text-[10px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  View all events
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Cmd+K hint */}
      <button
        className="flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius-sm)] text-[10px] transition-colors active:scale-95"
        style={{
          color: 'var(--color-text-muted)',
          background: 'var(--color-bg-tertiary)',
          border: '1px solid var(--color-border)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-accent)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-border)';
        }}
        title="Command Palette (Ctrl+K)"
      >
        <Search size={11} />
        <span className="font-mono text-[9px]">Ctrl+K</span>
      </button>
    </header>
  );
}
