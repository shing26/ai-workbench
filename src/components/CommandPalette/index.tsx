import { Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { loadCommandUsage, recordCommandUsage, type CommandUsageMap } from '../../lib/commandUsage';
import { TOPICS, useEvent } from '../../stores/events';
import {
  sortCommands,
  useCommandRegistry,
  type CommandEntry,
  type CommandPrompt,
} from './registry';

function useEntered(active: boolean) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (!active) {
      setEntered(false);
      return;
    }
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return entered;
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [prompt, setPrompt] = useState<CommandPrompt | null>(null);
  const [promptValue, setPromptValue] = useState('');
  const [usage, setUsage] = useState<CommandUsageMap>(() => loadCommandUsage());
  const commands = useCommandRegistry();
  const inputRef = useRef<HTMLInputElement>(null);
  const promptRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const entered = useEntered(open);

  const results = useMemo(() => sortCommands(commands, query, usage), [commands, query, usage]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setSelectedIdx(0);
    setPrompt(null);
    setPromptValue('');
  }, []);

  const toggle = useCallback(() => setOpen((prev) => !prev), []);
  useEvent(TOPICS.COMMAND_PALETTE_TOGGLE, toggle);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  const execute = useCallback(
    async (entry: CommandEntry) => {
      setUsage(recordCommandUsage(entry.id));
      if (entry.prompt) {
        setPrompt(entry.prompt);
        setPromptValue('');
        setQuery('');
        return;
      }
      try {
        await entry.action?.();
      } catch {
        // Action errors are surfaced by the action itself (e.g. toast).
      }
      close();
    },
    [close],
  );

  const submitPrompt = useCallback(async () => {
    if (!prompt || !promptValue.trim()) return;
    const current = prompt;
    try {
      await current.onSubmit(promptValue.trim());
    } finally {
      close();
    }
  }, [prompt, promptValue, close]);

  useEffect(() => {
    if (!open) return;
    if (prompt) {
      promptRef.current?.focus();
    } else {
      inputRef.current?.focus();
      setSelectedIdx(0);
    }
  }, [open, prompt]);

  useEffect(() => {
    if (!open || prompt) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIdx((index) => Math.min(index + 1, results.length - 1));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIdx((index) => Math.max(index - 1, 0));
      } else if (event.key === 'Enter') {
        const entry = results[selectedIdx];
        if (entry) {
          event.preventDefault();
          void execute(entry);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, prompt, results, selectedIdx, close, execute]);

  useEffect(() => {
    itemRefs.current[selectedIdx]?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx, open, prompt]);

  if (!open) return null;

  return createPortal(
    <div
      data-command-palette
      className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh]"
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={close}
        style={{ opacity: entered ? 1 : 0, transition: 'opacity 120ms ease' }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative w-[560px] max-w-[92vw] overflow-hidden rounded-2xl border border-white/10 bg-[#18181C] shadow-2xl shadow-black/40"
        style={{
          transform: entered ? 'translateY(0) scale(1)' : 'translateY(-6px) scale(0.98)',
          opacity: entered ? 1 : 0,
          transition: 'opacity 120ms ease, transform 120ms ease',
        }}
      >
        {prompt ? (
          <>
            <div className="flex items-center gap-2 border-b border-white/10 px-3">
              <Search size={14} className="shrink-0 text-slate-500" />
              <input
                ref={promptRef}
                data-command-input
                value={promptValue}
                onChange={(event) => setPromptValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void submitPrompt();
                  } else if (event.key === 'Escape') {
                    event.preventDefault();
                    close();
                  }
                }}
                placeholder={prompt.placeholder}
                className="h-12 w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600"
              />
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-xs text-slate-400">{prompt.title}</span>
              <span className="flex items-center gap-3 text-[10px] text-slate-500">
                <span>
                  <kbd className="rounded-md border border-white/10 bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-400">
                    ↵
                  </kbd>{' '}
                  保存
                </span>
                <span>
                  <kbd className="rounded-md border border-white/10 bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-400">
                    esc
                  </kbd>{' '}
                  取消
                </span>
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-white/10 px-3">
              <Search size={14} className="shrink-0 text-slate-500" />
              <input
                ref={inputRef}
                data-command-input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelectedIdx(0);
                }}
                placeholder="搜索视图、会话、闪念、任务、项目…"
                className="h-12 w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600"
              />
              <kbd className="shrink-0 rounded-md border border-white/10 bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-400">
                esc
              </kbd>
            </div>
            <div className="max-h-[340px] overflow-y-auto p-1.5">
              {results.length === 0 ? (
                <div className="px-3 py-8 text-center text-xs text-slate-600">No results</div>
              ) : (
                results.map((entry, index) => (
                  <button
                    key={entry.id}
                    ref={(el) => {
                      itemRefs.current[index] = el;
                    }}
                    type="button"
                    data-command-item
                    data-command-id={entry.id}
                    onMouseEnter={() => setSelectedIdx(index)}
                    onClick={() => void execute(entry)}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left ${
                      index === selectedIdx
                        ? 'bg-emerald-500/15 text-emerald-200'
                        : 'text-slate-300 hover:bg-white/[0.06]'
                    }`}
                  >
                    <span
                      className={`shrink-0 ${
                        index === selectedIdx ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    >
                      {entry.icon && <entry.icon size={15} />}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-xs">{entry.label}</span>
                      {entry.subtitle && (
                        <span className="truncate text-[10px] text-slate-500">
                          {entry.subtitle}
                        </span>
                      )}
                    </span>
                  </button>
                ))
              )}
            </div>
            <div className="flex items-center gap-3 border-t border-white/10 px-4 py-2 text-[10px] text-slate-500">
              <span>
                <kbd className="rounded-md border border-white/10 bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-400">
                  ↑↓
                </kbd>{' '}
                导航
              </span>
              <span>
                <kbd className="rounded-md border border-white/10 bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-400">
                  ↵
                </kbd>{' '}
                打开
              </span>
              <span>
                <kbd className="rounded-md border border-white/10 bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-400">
                  esc
                </kbd>{' '}
                关闭
              </span>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
