import { useState, useRef, useEffect } from 'react';
import {
  Plus,
  MessageSquare,
  Bookmark,
  Star,
  Paperclip,
  ChevronRight,
  Trash2,
  Terminal,
  Sparkles,
} from 'lucide-react';
import gsap from 'gsap';
import { useChatStore, type ModelRoute } from '../stores/chatStore';
import { writeNoteToVault } from '../lib/backend';
import {
  useKnowledgeStore,
  inferTitle,
  inferTags,
  inferProjectFromContent,
  slugify,
} from '../stores/knowledgeStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useConnectionStore } from '../stores/connectionStore';

interface ModelCardInfo {
  value: ModelRoute;
  label: string;
  desc: string;
  status: 'online' | 'offline' | 'experimental';
}

const modelCards: ModelCardInfo[] = [
  { value: 'cloud', label: 'Cloud API', desc: 'GPT-4o / Claude via API', status: 'online' },
  { value: 'codex', label: 'Codex', desc: 'Local Codex CLI bridge', status: 'online' },
  { value: 'ollama', label: 'Ollama', desc: 'Local 3-4B models', status: 'offline' },
  { value: 'auto', label: 'Auto', desc: 'Smart routing', status: 'experimental' },
];

export default function ChatView() {
  const {
    threads,
    activeThreadId,
    selectedModel,
    budgetUsed,
    budgetLimit,
    removeThread,
    createThread,
    setActiveThread,
    sendMessage,
    setModel,
    isResponding,
  } = useChatStore();
  const addNote = useKnowledgeStore((s) => s.addNote);
  const vaultPath = useSettingsStore((s) => s.vaultPath);
  const [toast, setToast] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(true);

  const [input, setInput] = useState('');
  const [charCount, setCharCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const modelCardsRef = useRef<HTMLDivElement>(null);
  const threadListRef = useRef<HTMLDivElement>(null);
  const onboardingRef = useRef<HTMLDivElement>(null);

  const activeThread = threads.find((t) => t.id === activeThreadId) ?? null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThread?.messages]);

  useEffect(() => {
    if (showOnboarding && !activeThread && onboardingRef.current) {
      gsap.fromTo(
        onboardingRef.current,
        { opacity: 0, y: 20, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'power3.out', delay: 0.1 },
      );
    }
    if (activeThread) setShowOnboarding(false);
  }, [showOnboarding, activeThread]);

  useEffect(() => {
    if (modelCardsRef.current) {
      gsap.fromTo(
        modelCardsRef.current.querySelectorAll('.model-card'),
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.35, stagger: 0.06, ease: 'power3.out', delay: 0.05 },
      );
    }
  }, []);

  useEffect(() => {
    if (threadListRef.current && threads.length > 0) {
      gsap.fromTo(
        threadListRef.current.querySelectorAll('.thread-item'),
        { opacity: 0, x: -8 },
        { opacity: 1, x: 0, duration: 0.25, stagger: 0.04, ease: 'power3.out' },
      );
    }
  }, [threads.length]);

  const handleSend = () => {
    if (!input.trim()) return;
    if (!activeThreadId) {
      createThread();
      useChatStore.getState().sendMessage(input.trim());
      setInput('');
      setCharCount(0);
      setShowOnboarding(false);
      return;
    }
    sendMessage(input.trim());
    setInput('');
    setCharCount(0);
    inputRef.current?.focus();
  };

  const handleSaveToKnowledge = (content: string) => {
    if (!vaultPath) return;
    const title = inferTitle(content);
    const project = inferProjectFromContent(content);
    const tags = inferTags(content);
    const fileName = slugify(title) + '-' + Date.now() + '.md';
    const yamlFront =
      '---\ntitle: ' +
      title +
      '\nproject: ' +
      project +
      '\ntags: ' +
      tags.join(', ') +
      '\ndate: ' +
      new Date().toISOString().split('T')[0] +
      '\n---\n\n' +
      content;
    addNote({ title, content, project, tags });
    writeNoteToVault(vaultPath, fileName, yamlFront)
      .then(() => {
        setToast('Saved to Obsidian');
        setTimeout(() => setToast(''), 2000);
        useConnectionStore.getState().addEvent({
          source: 'chat',
          title: 'Saved to Knowledge',
          body: '"' + title + '" saved to Obsidian vault',
          targetView: 'knowledge',
        });
      })
      .catch((e) => {
        setToast('Save failed: ' + e);
        setTimeout(() => setToast(''), 3000);
      });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    setCharCount(e.target.value.length);
  };

  const budgetPct = Math.min((budgetUsed / budgetLimit) * 100, 100);
  const budgetNearLimit = budgetPct >= 75;

  return (
    <div className="flex h-full w-full">
      {toast && (
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 z-50 px-3 py-1.5 rounded-full text-xs border shadow-lg pointer-events-none"
          style={{
            background: 'var(--color-accent-muted)',
            color: 'var(--color-accent)',
            borderColor: 'rgba(16,185,129,0.3)',
          }}
        >
          {toast}
        </div>
      )}

      {/* === MID PANEL === */}
      <aside
        className="scrollbar-mid shrink-0 flex flex-col overflow-hidden"
        style={{
          width: 'var(--chat-mid-panel-min)',
          minWidth: 'var(--chat-mid-panel-min)',
          maxWidth: 'var(--chat-mid-panel-max)',
          background: 'var(--color-surface)',
          borderRight: '1px solid var(--color-border)',
        }}
      >
        {/* Model cards */}
        <div className="px-3 pt-3 pb-1">
          <span
            className="text-[10px] font-medium uppercase tracking-wider mb-2 block"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Models
          </span>
          <div ref={modelCardsRef} className="space-y-1">
            {modelCards.map((m) => (
              <button
                key={m.value}
                onClick={() => setModel(m.value)}
                className={`model-card w-full text-left px-2.5 py-2 rounded-[var(--radius-sm)] transition-all duration-150 active:scale-[0.98] group ${(activeThread?.model ?? selectedModel) === m.value ? '' : ''}`}
                style={{
                  background:
                    (activeThread?.model ?? selectedModel) === m.value
                      ? 'var(--color-surface-hover)'
                      : 'transparent',
                  borderLeft:
                    (activeThread?.model ?? selectedModel) === m.value
                      ? '2px solid var(--color-accent)'
                      : '2px solid transparent',
                }}
                onMouseEnter={(e) => {
                  if ((activeThread?.model ?? selectedModel) !== m.value)
                    e.currentTarget.style.background = 'var(--color-surface-hover)';
                }}
                onMouseLeave={(e) => {
                  if ((activeThread?.model ?? selectedModel) !== m.value)
                    e.currentTarget.style.background = 'transparent';
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="shrink-0 w-1.5 h-1.5 rounded-full"
                    style={{
                      background:
                        m.status === 'online'
                          ? 'var(--color-success)'
                          : m.status === 'experimental'
                            ? 'var(--color-warning)'
                            : 'var(--color-text-muted)',
                      animation:
                        m.status === 'online' ? 'pulse-dot 2s ease-in-out infinite' : 'none',
                    }}
                  />
                  <span
                    className="text-xs font-medium truncate"
                    style={{
                      color:
                        (activeThread?.model ?? selectedModel) === m.value
                          ? 'var(--color-accent)'
                          : 'var(--color-text-primary)',
                    }}
                  >
                    {m.label}
                  </span>
                </div>
                <div
                  className="text-[10px] mt-0.5 ml-[14px] truncate"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {m.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="mx-3 my-2 border-t" style={{ borderColor: 'var(--color-border-subtle)' }} />

        {/* Thread list */}
        <div className="flex items-center justify-between px-3 py-1">
          <span
            className="text-[10px] font-medium uppercase tracking-wider"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Threads
          </span>
          <button
            onClick={() => {
              createThread();
              setShowOnboarding(false);
            }}
            className="p-1 rounded transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--color-surface-hover)';
              e.currentTarget.style.color = 'var(--color-text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--color-text-muted)';
            }}
          >
            <Plus size={13} />
          </button>
        </div>

        <div ref={threadListRef} className="flex-1 overflow-y-auto scrollbar-mid pb-1">
          {threads.length === 0 ? (
            <div
              className="px-3 py-8 text-center text-[11px]"
              style={{ color: 'var(--color-text-muted)' }}
            >
              No threads yet
            </div>
          ) : (
            threads.map((t) => {
              const model = modelCards.find((m) => m.value === t.model) ?? modelCards[0];
              const msgCount = t.messages.length;
              const lastTime =
                t.messages.length > 0 ? t.messages[t.messages.length - 1].timestamp : t.createdAt;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setActiveThread(t.id);
                    setShowOnboarding(false);
                  }}
                  className="thread-item w-full text-left px-3 py-2 transition-colors group"
                  style={{
                    borderLeft:
                      t.id === activeThreadId
                        ? '2px solid var(--color-accent)'
                        : '2px solid transparent',
                    background:
                      t.id === activeThreadId ? 'var(--color-surface-hover)' : 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (t.id !== activeThreadId)
                      e.currentTarget.style.background = 'var(--color-surface-hover)';
                  }}
                  onMouseLeave={(e) => {
                    if (t.id !== activeThreadId) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div
                    className="text-[12px] font-medium truncate"
                    style={{
                      color:
                        t.id === activeThreadId
                          ? 'var(--color-accent)'
                          : 'var(--color-text-primary)',
                    }}
                  >
                    {t.title}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className="w-1 h-1 rounded-full shrink-0"
                      style={{
                        background:
                          model.status === 'online'
                            ? 'var(--color-success)'
                            : 'var(--color-text-muted)',
                      }}
                    />
                    <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                      {model.label}
                    </span>
                    {msgCount > 0 && (
                      <>
                        <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                          ·
                        </span>
                        <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                          {msgCount} msg{msgCount !== 1 ? 's' : ''}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    {new Date(lastTime).toLocaleTimeString('zh-CN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Budget bar */}
        <div className="px-3 py-2.5 border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <div
            className="flex items-center justify-between text-[10px] mb-1.5"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <span>Budget</span>
            <span className="tabular-nums">
              ${budgetUsed.toFixed(2)} / ${budgetLimit}
            </span>
          </div>
          <div
            className="relative h-1.5 rounded-full overflow-hidden cursor-default"
            style={{ background: 'var(--color-bg-primary)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${budgetPct}%`,
                background: budgetNearLimit
                  ? 'linear-gradient(90deg, var(--color-accent), var(--color-warning))'
                  : 'var(--color-accent)',
              }}
            />
            {budgetPct > 0 && (
              <div
                className="absolute top-0 bottom-0 w-px"
                style={{ left: '75%', background: 'var(--color-text-muted)' }}
              />
            )}
          </div>
        </div>
      </aside>

      {/* === RIGHT PANEL === */}
      <div
        className="flex-1 flex flex-col min-w-0"
        style={{ background: 'var(--color-bg-primary)' }}
      >
        {/* Local top bar */}
        <div
          className="flex items-center h-[40px] px-4 shrink-0 border-b"
          style={{ background: 'var(--color-bg-primary)', borderColor: 'var(--color-border)' }}
        >
          <div
            className="flex items-center gap-1.5 text-[11px]"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <span>AI Workbench</span>
            <ChevronRight size={10} />
            <span className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Chat
            </span>
          </div>
          {activeThread && (
            <>
              <div
                className="mx-3 w-px h-3.5"
                style={{ background: 'var(--color-border-subtle)' }}
              />
              <span
                className="text-[12px] font-medium truncate max-w-[200px]"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {activeThread.title}
              </span>
            </>
          )}
          <div className="flex-1" />
          {activeThread && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => {}}
                title="Bookmark thread"
                className="p-1.5 rounded transition-colors"
                style={{ color: 'var(--color-text-muted)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-accent)';
                  e.currentTarget.style.background = 'var(--color-surface-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-muted)';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <Bookmark size={13} />
              </button>
              <button
                onClick={() => {
                  if (activeThread && window.confirm('Delete this thread?'))
                    removeThread(activeThread.id);
                }}
                title="Delete thread"
                className="p-1.5 rounded transition-colors"
                style={{ color: 'var(--color-text-muted)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-error)';
                  e.currentTarget.style.background = 'var(--color-surface-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-muted)';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto scrollbar-content px-4 py-4">
          {!activeThread ? (
            <div className="flex items-center justify-center h-full">
              <div ref={onboardingRef} className="w-full max-w-lg">
                <div
                  className="rounded-[var(--radius-lg)] p-6"
                  style={{
                    background: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div className="text-center mb-5">
                    <div
                      className="inline-flex items-center justify-center w-10 h-10 rounded-full mb-3"
                      style={{ background: 'var(--color-accent-muted)' }}
                    >
                      <Sparkles size={18} style={{ color: 'var(--color-accent)' }} />
                    </div>
                    <h2
                      className="text-[15px] font-semibold mb-1"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Get Started with AI Station
                    </h2>
                    <p className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
                      Follow the steps below to begin your workflow
                    </p>
                  </div>

                  {[
                    { num: 1, title: 'Choose a Model' },
                    { num: 2, title: 'Start a Thread' },
                    { num: 3, title: 'Or pick up where you left off' },
                  ].map((step) => (
                    <div key={step.num} className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold"
                          style={{
                            background:
                              step.num <= 2
                                ? 'var(--color-accent-muted)'
                                : 'var(--color-surface-hover)',
                            color:
                              step.num <= 2 ? 'var(--color-accent)' : 'var(--color-text-muted)',
                          }}
                        >
                          {step.num}
                        </span>
                        <span
                          className="text-[12px] font-medium"
                          style={{
                            color:
                              step.num <= 2
                                ? 'var(--color-text-secondary)'
                                : 'var(--color-text-muted)',
                          }}
                        >
                          {step.title}
                        </span>
                      </div>
                      {step.num === 1 && (
                        <div className="grid grid-cols-2 gap-1.5 ml-7">
                          {modelCards.map((m) => (
                            <button
                              key={m.value}
                              onClick={() => setModel(m.value)}
                              className="text-left px-2.5 py-2 rounded-[var(--radius-sm)] transition-all duration-150 hover:scale-[1.01]"
                              style={{
                                background:
                                  selectedModel === m.value
                                    ? 'var(--color-accent-muted)'
                                    : 'var(--color-surface-hover)',
                                border:
                                  selectedModel === m.value
                                    ? '1px solid rgba(16,185,129,0.3)'
                                    : '1px solid transparent',
                              }}
                            >
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="w-1.5 h-1.5 rounded-full shrink-0"
                                  style={{
                                    background:
                                      m.status === 'online'
                                        ? 'var(--color-success)'
                                        : m.status === 'experimental'
                                          ? 'var(--color-warning)'
                                          : 'var(--color-text-muted)',
                                    animation:
                                      m.status === 'online'
                                        ? 'pulse-dot 2s ease-in-out infinite'
                                        : 'none',
                                  }}
                                />
                                <span
                                  className="text-[11px] font-medium"
                                  style={{ color: 'var(--color-text-primary)' }}
                                >
                                  {m.label}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {step.num === 2 && (
                        <div className="ml-7">
                          <button
                            onClick={() => {
                              createThread();
                              setShowOnboarding(false);
                            }}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius-md)] text-[13px] font-medium transition-all duration-150 active:scale-[0.98] hover:brightness-110"
                            style={{ background: 'var(--color-accent)', color: '#121214' }}
                          >
                            <Plus size={15} /> Start New Thread
                          </button>
                        </div>
                      )}
                      {step.num === 3 && (
                        <p
                          className="text-[11px] ml-7"
                          style={{ color: 'var(--color-text-muted)' }}
                        >
                          Browse your threads in the panel on the left
                        </p>
                      )}
                    </div>
                  ))}
                  <div
                    className="mt-5 pt-4 border-t"
                    style={{ borderColor: 'var(--color-border-subtle)' }}
                  >
                    <div
                      className="flex items-center gap-1.5 text-[10px]"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      <span
                        className="font-mono text-[9px] px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--color-surface-hover)' }}
                      >
                        Ctrl+K
                      </span>
                      <span>opens Command Palette for quick navigation</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : activeThread.messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <MessageSquare
                  size={28}
                  className="mx-auto mb-3"
                  style={{ color: 'var(--color-text-muted)' }}
                />
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  Send a message to start
                </p>
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-4">
              {activeThread.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start gap-2.5'} relative group`}
                >
                  {msg.role === 'assistant' && (
                    <div
                      className="w-7 h-7 rounded-[var(--radius-sm)] shrink-0 mt-0.5 flex items-center justify-center text-[10px] font-bold"
                      style={{
                        background: 'var(--color-accent-muted)',
                        color: 'var(--color-accent)',
                      }}
                    >
                      AI
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] text-sm leading-relaxed ${msg.role === 'user' ? 'px-4 py-2.5 rounded-[var(--radius-xl)] rounded-tr-[var(--radius-sm)]' : 'px-4 py-2.5 rounded-[var(--radius-xl)] rounded-tl-[var(--radius-sm)]'}`}
                    style={
                      msg.role === 'user'
                        ? {
                            background: 'rgba(16,185,129,0.45)',
                            color: 'var(--color-text-primary)',
                          }
                        : {
                            background: 'var(--color-bg-secondary)',
                            color: 'var(--color-text-primary)',
                            border: '1px solid var(--color-border)',
                          }
                    }
                  >
                    {(() => {
                      const parts = msg.content.split(/(```[\s\S]*?```)/g);
                      return parts.map((part, i) => {
                        if (part.startsWith('```') && part.endsWith('```')) {
                          const lines = part.split('\n');
                          const lang = lines[0].replace('```', '').trim();
                          const code = lines.slice(1, -1).join('\n');
                          return (
                            <div
                              key={i}
                              className="my-2 rounded-[var(--radius-sm)] overflow-hidden border"
                              style={{
                                background: 'var(--color-bg-secondary)',
                                borderColor: 'var(--color-border)',
                              }}
                            >
                              <div
                                className="flex items-center justify-between px-3 py-1.5 text-[10px] border-b"
                                style={{
                                  color: 'var(--color-text-muted)',
                                  borderColor: 'var(--color-border-subtle)',
                                  background: 'var(--color-bg-primary)',
                                }}
                              >
                                <div className="flex items-center gap-1.5">
                                  <Terminal size={10} />
                                  <span>{lang || 'code'}</span>
                                </div>
                                <button
                                  onClick={() => navigator.clipboard.writeText(code)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  style={{ color: 'var(--color-text-secondary)' }}
                                >
                                  <span className="text-[9px]">Copy</span>
                                </button>
                              </div>
                              <pre
                                className="code-block px-3 py-2 overflow-x-auto whitespace-pre-wrap"
                                style={{
                                  color: 'var(--color-text-primary)',
                                  borderLeft: '2px solid var(--color-accent)',
                                }}
                              >
                                {code}
                              </pre>
                            </div>
                          );
                        }
                        return (
                          <span key={i} className="whitespace-pre-wrap">
                            {part}
                          </span>
                        );
                      });
                    })()}
                    {msg.content.length > 200 &&
                      (msg.content.includes('`') ||
                        msg.content.includes('- ') ||
                        msg.role === 'assistant') && (
                        <span title="Recommended to save">
                          <Star
                            size={10}
                            className="absolute -top-1.5 -left-1.5 opacity-50"
                            style={{ color: 'var(--color-accent)' }}
                          />
                        </span>
                      )}
                    <button
                      onClick={() => handleSaveToKnowledge(msg.content)}
                      title={vaultPath ? 'Save to Knowledge' : 'Configure Obsidian Vault first'}
                      className="absolute -top-1.5 -right-1.5 p-0.5 rounded border opacity-0 group-hover:opacity-100 transition-all duration-150"
                      style={{
                        background: 'var(--color-bg-secondary)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-muted)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'var(--color-accent)';
                        e.currentTarget.style.borderColor = 'var(--color-accent)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--color-text-muted)';
                        e.currentTarget.style.borderColor = 'var(--color-border)';
                      }}
                    >
                      <Bookmark size={10} />
                    </button>
                    <div
                      className="text-[10px] mt-1 select-none"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {new Date(msg.timestamp).toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              ))}

              {isResponding && (
                <div className="flex items-center gap-1 py-2 ml-9">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-2 h-2 rounded-full inline-block"
                      style={{
                        background: 'var(--color-accent)',
                        animation: `bounce-dot 0.6s ease-in-out ${i * 0.12}s infinite`,
                      }}
                    />
                  ))}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area — big card style */}
        <div className="shrink-0 px-4 pb-3 pt-1" style={{ background: 'var(--color-bg-primary)' }}>
          <div className="max-w-2xl mx-auto">
            {/* Input toolbar */}
            {activeThreadId && (
              <div className="flex items-center gap-1 mb-2 px-1">
                <div className="flex items-center gap-0.5">
                  {modelCards.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => setModel(m.value)}
                      title={m.label}
                      className="px-2 py-0.5 rounded text-[10px] font-medium transition-all duration-150 active:scale-95"
                      style={{
                        background:
                          (activeThread?.model ?? selectedModel) === m.value
                            ? 'var(--color-accent-muted)'
                            : 'transparent',
                        color:
                          (activeThread?.model ?? selectedModel) === m.value
                            ? 'var(--color-accent)'
                            : 'var(--color-text-muted)',
                      }}
                      onMouseEnter={(e) => {
                        if ((activeThread?.model ?? selectedModel) !== m.value) {
                          e.currentTarget.style.background = 'var(--color-surface-hover)';
                          e.currentTarget.style.color = 'var(--color-text-secondary)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if ((activeThread?.model ?? selectedModel) !== m.value) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = 'var(--color-text-muted)';
                        }
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <div className="flex-1" />
                <button
                  className="p-1 rounded transition-colors"
                  style={{ color: 'var(--color-text-muted)' }}
                  title="Attach file"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--color-text-secondary)';
                    e.currentTarget.style.background = 'var(--color-surface-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--color-text-muted)';
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <Paperclip size={13} />
                </button>
              </div>
            )}

            {/* Big card input */}
            <div
              className="rounded-[var(--radius-xl)] p-2.5 transition-colors shadow-lg"
              style={{
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(16,185,129,0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border)';
              }}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={
                  isResponding
                    ? 'AI is thinking...'
                    : activeThreadId
                      ? 'Type a message... (Shift+Enter for newline)'
                      : 'Create or select a thread first...'
                }
                disabled={!activeThreadId || isResponding}
                rows={2}
                className="w-full bg-transparent resize-none outline-none text-sm px-2 disabled:opacity-40"
                style={{ color: 'var(--color-text-primary)' }}
              />
              <div
                className="flex justify-between items-center pt-2 border-t px-1"
                style={{ borderColor: 'var(--color-border-subtle)' }}
              >
                <div
                  className="flex space-x-3 text-xs"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  <span
                    className="cursor-pointer transition-colors"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--color-text-secondary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--color-text-muted)';
                    }}
                  >
                    📎 Attach
                  </span>
                  <span
                    className="cursor-pointer transition-colors"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--color-text-secondary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--color-text-muted)';
                    }}
                  >
                    🌐 Web
                  </span>
                  {charCount > 0 && <span className="tabular-nums">{charCount}</span>}
                </div>
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || !activeThreadId || isResponding}
                  className="text-xs px-3 py-1.5 rounded-[var(--radius-md)] font-medium transition-all duration-150 active:scale-95 disabled:opacity-30 disabled:cursor-default"
                  style={{ background: 'var(--color-accent)', color: '#121214' }}
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
