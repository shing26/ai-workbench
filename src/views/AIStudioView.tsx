import { Check, ChevronDown, History, Plus, Save, Search, Send, Square } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as db from '../lib/db';
import { buildJourneyDoc, buildJourneyDocIndex, journeyDocFileName } from '../lib/journeyDoc';
import { RoundtableOrchestrator, type RoundtableMessage } from '../lib/roundtable';
import { toast } from '../lib/toast';
import { useWorkbenchStore } from '../stores/workbenchStore';
import { useViewState } from '../stores/viewState';

type Message = RoundtableMessage;

const SEAT_TONE: Record<string, string> = {
  cto: 'bg-cyan-950/40 border-cyan-500/30 text-cyan-300',
  cdo: 'bg-purple-950/40 border-purple-500/30 text-purple-300',
  ciso: 'bg-rose-950/40 border-rose-500/30 text-rose-300',
};

const SEAT_AVATAR: Record<string, string> = {
  cto: '🦀',
  cdo: '🎨',
  ciso: '🛡️',
};

function toStudioSeat(agent: db.AgencyAgent): db.AgentSpec {
  return {
    id: agent.slug,
    name: agent.name,
    role: agent.division,
    kpi: agent.tools.join(', ') || agent.division,
    prompt: agent.developerInstructions,
    active: true,
    emoji: agent.emoji,
    color: agent.color,
  };
}

function seatStyle(seat: db.AgentSpec | null): React.CSSProperties | undefined {
  if (!seat?.color) return undefined;
  return {
    color: seat.color,
    borderColor: `${seat.color}55`,
    background: `${seat.color}1A`,
  };
}

function seatTone(seat: db.AgentSpec | null): string {
  if (!seat) return 'border-white/10 bg-white/[0.04]';
  if (seat.color) return '';
  return SEAT_TONE[seat.id] ?? 'border-white/10 bg-white/[0.04]';
}

export default function AIStudioView() {
  const providers = useWorkbenchStore((s) => s.providers);
  const addThought = useWorkbenchStore((s) => s.addThought);
  const vibeContext = useWorkbenchStore((s) => s.vibeContext);
  const noteContext = useWorkbenchStore((s) => s.noteContext);
  const actionContext = useWorkbenchStore((s) => s.actionContext);
  const updateProjectJourney = useWorkbenchStore((s) => s.updateProjectJourney);
  const setProjects = useWorkbenchStore((s) => s.setProjects);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        'Ready. 勾选至少 2 位 Agent 的圆桌席位后输入问题，⌘Enter 秒级派发给所有 Agent 独立论证。',
    },
  ]);
  const [input, setInput] = useViewState('ai-studio', 'input', '');
  const [providerId, setProviderId] = useState('');
  const [prismSeats, setPrismSeats] = useState<db.AgentSpec[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<Set<string>>(new Set());
  const [catalog, setCatalog] = useState<db.AgencyAgent[]>([]);
  const [teamPresets, setTeamPresets] = useState<db.TeamPreset[]>([]);
  const [divisionFilter, setDivisionFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roundtableOutputs, setRoundtableOutputs] = useState<
    { seat: db.AgentSpec; opinion: string }[]
  >([]);
  const [lastConsensus, setLastConsensus] = useState<db.MoaConsensus | null>(null);
  const [sessions, setSessions] = useState<db.Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useViewState<string | null>(
    'ai-studio',
    'sessionId',
    null,
  );
  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [streamStatus, setStreamStatus] = useState<'idle' | 'connecting' | 'streaming' | 'error'>(
    'idle',
  );
  const [streamError, setStreamError] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const autoGrowComposer = () => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };
  const orchestratorRef = useRef<RoundtableOrchestrator | null>(null);
  if (!orchestratorRef.current) {
    orchestratorRef.current = new RoundtableOrchestrator({
      sendStream: async (args) => {
        await db.sendAiMessageStream({
          providerIds: args.providerIds,
          messages: args.messages,
          moa: args.moa ?? false,
          runId: args.runId,
        });
      },
      listenChunks: db.listenStreamChunks,
      buildConsensus: (contents) => db.buildMoaConsensus(contents).catch(() => null),
      saveMessage: (sessionId, role, content, id) =>
        db.saveChatMessage(sessionId, role, content, id),
    });
    orchestratorRef.current.replaceMessages(messages);
  }
  const orchestrator = orchestratorRef.current;
  const catalogRef = useRef<db.AgencyAgent[]>([]);
  const sessionIdRef = useRef<string | null>(null);

  const activeProvider =
    providers.find((p) => p.id === providerId) ?? providers.find((p) => p.isActive);
  const activeProviders = [...providers.filter((p) => p.isActive)].sort(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
  );

  const selectedSeatList = useMemo(
    () => prismSeats.filter((s) => selectedSeats.has(s.id) && s.active),
    [prismSeats, selectedSeats],
  );

  const divisions = useMemo(
    () => [...new Set(catalog.map((agent) => agent.division))].sort(),
    [catalog],
  );

  const filteredCatalog = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return catalog.filter(
      (agent) =>
        (!divisionFilter || agent.division === divisionFilter) &&
        (!query ||
          `${agent.name} ${agent.slug} ${agent.description}`.toLowerCase().includes(query)),
    );
  }, [catalog, divisionFilter, searchQuery]);

  useEffect(() => {
    let disposed = false;
    void orchestrator.mount().catch(() => {});
    const unsubscribe = orchestrator.subscribe((snapshot) => {
      if (disposed) return;
      setMessages(snapshot.messages);
      setStreamStatus(snapshot.status);
      setStreamError(snapshot.error);
      setBusy(snapshot.busy);
      setRoundtableOutputs(snapshot.outputs);
      setLastConsensus(snapshot.consensus);
    });
    return () => {
      disposed = true;
      unsubscribe();
      orchestrator.dispose();
    };
  }, [orchestrator]);

  useEffect(() => {
    let disposed = false;
    if (catalogRef.current.length > 0) return;
    void db
      .listAgentCatalog()
      .then(async (agents) => {
        if (disposed) return;
        if (agents.length > 0) {
          catalogRef.current = agents;
          setCatalog(agents);
          setTeamPresets(await db.listTeamPresets());
          const seats = agents.map(toStudioSeat);
          setPrismSeats(seats);
          setSelectedSeats(new Set(seats.slice(0, 3).map((s) => s.id)));
          return;
        }
        const seats = await db.listAgentSpecs(vibeContext?.path ?? '');
        if (disposed) return;
        setPrismSeats(seats);
        setSelectedSeats(new Set(seats.filter((s) => s.active).map((s) => s.id)));
      })
      .catch(() => {});
    return () => {
      disposed = true;
    };
  }, [vibeContext?.path]);

  useEffect(() => {
    let disposed = false;
    void db.listSessions().then((list) => {
      if (disposed) return;
      setSessions(list);
      const first = list.find((s) => !s.archived) ?? list[0];
      if (first) {
        sessionIdRef.current = first.id;
        setActiveSessionId(first.id);
        void db.listChatMessages(first.id).then((stored) => {
          if (disposed) return;
          if (stored.length > 0) {
            const storedMessages = stored.map((m) => ({
              id: m.id,
              role: m.role as 'user' | 'assistant',
              content: m.content,
            }));
            setMessages(storedMessages);
            orchestrator.replaceMessages(storedMessages);
          }
        });
      }
    });
    return () => {
      disposed = true;
    };
  }, [orchestrator, setActiveSessionId]);

  const ensureSession = async (titleHint: string) => {
    if (sessionIdRef.current) {
      const existing = sessions.find((s) => s.id === sessionIdRef.current);
      if (existing) {
        const stored = await db.listChatMessages(existing.id);
        if (stored.length > 0) return existing;
      }
    }
    const session = await db.createSession(
      titleHint.slice(0, 24) || 'New chat',
      activeProvider?.name ?? 'default',
    );
    sessionIdRef.current = session.id;
    setActiveSessionId(session.id);
    setSessions(await db.listSessions());
    return session;
  };

  const loadSession = useCallback(
    async (session: db.Session) => {
      sessionIdRef.current = session.id;
      setActiveSessionId(session.id);
      setRoundtableOutputs([]);
      setLastConsensus(null);
      const stored = await db.listChatMessages(session.id);
      const storedMessages: Message[] =
        stored.length > 0
          ? stored.map((m) => ({
              id: m.id,
              role: m.role as 'user' | 'assistant',
              content: m.content,
            }))
          : [{ role: 'assistant' as const, content: '空的对话，输入问题开始论证。' }];
      setMessages(storedMessages);
      orchestrator.replaceMessages(storedMessages);
    },
    [orchestrator, setActiveSessionId],
  );

  const newChat = async () => {
    const session = await db.createSession('New chat', activeProvider?.name ?? 'default');
    sessionIdRef.current = session.id;
    setActiveSessionId(session.id);
    setSessions(await db.listSessions());
    const initialMessages: Message[] = [
      { role: 'assistant' as const, content: 'Ready. 勾选圆桌席位后开始新论证。' },
    ];
    setMessages(initialMessages);
    orchestrator.replaceMessages(initialMessages);
    setRoundtableOutputs([]);
    setLastConsensus(null);
  };

  const sendRoundtable = async (text: string, hits: db.RagSearchResult[]) => {
    const seats = selectedSeatList.slice(0, 5);
    if (seats.length < 2) {
      setBusy(false);
      setStreamError('请至少勾选 2 位 Agent 席位');
      return;
    }
    const providerBase = activeProvider?.id ?? '';
    const providerIds = providerBase ? [providerBase] : activeProviders.map((p) => p.id);
    const session = await ensureSession(text);
    let relatedJourneys: db.RagSearchResult[] = [];
    if (vibeContext) {
      relatedJourneys = await db
        .searchThoughts(`${vibeContext.projectName} 旅程 归档`, 4)
        .catch(() => []);
    }
    const result = await orchestrator.start({
      text,
      seats,
      providerIds,
      sessionId: session.id,
      vibe: vibeContext,
      note: noteContext,
      action: actionContext,
      relatedJourneys,
      hits,
      onStageDiscussing: vibeContext
        ? () => updateProjectJourney(vibeContext.projectId, 'discussing').catch(() => {})
        : undefined,
    });
    if (result.ok) {
      setInput('');
    }
  };

  const sendText = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    const hits = await db.searchThoughts(text, 5).catch(() => [] as db.RagSearchResult[]);
    await sendRoundtable(text, hits);
  };

  const consolidateKnowledge = async () => {
    if (roundtableOutputs.length === 0) return;
    const topic = roundtableOutputs[0]?.opinion.slice(0, 40) || 'Prism Roundtable';
    const opinionsMarkdown = roundtableOutputs
      .map((o) => `### ${o.seat.name}（${o.seat.role}）\n${o.opinion.trim().slice(0, 500)}`)
      .join('\n\n');
    const frontmatter = [
      '---',
      `id: prism-${Date.now().toString(36)}`,
      `tags: [prism, roundtable, consensus]`,
      `status: consolidated`,
      `created_at: ${new Date().toISOString()}`,
      '---',
    ].join('\n');
    const knowledgeMarkdown = `${frontmatter}\n\n# ${topic}\n\n${opinionsMarkdown}`;
    try {
      if (!vibeContext) {
        await addThought(knowledgeMarkdown, '#prism,#consensus', 'note');
        setRoundtableOutputs([]);
        setLastConsensus(null);
        toast.success('已固化为知识卡片（Knowledge）');
        return;
      }
      const fileName =
        vibeContext.journeyDocPath ||
        journeyDocFileName({
          id: vibeContext.projectId,
          name: vibeContext.projectName,
        });
      const journeyMarkdown = buildJourneyDoc({
        projectId: vibeContext.projectId,
        topic,
        opinions: roundtableOutputs,
        consensus: lastConsensus ?? undefined,
      });
      await db.writeJourneyDoc(
        vibeContext.path,
        fileName,
        journeyMarkdown,
        vibeContext.projectId,
        'ready',
        'replace',
      );
      await setProjects(await db.listProjects());
      await addThought(
        buildJourneyDocIndex({
          projectId: vibeContext.projectId,
          topic,
          fileName,
          opinions: roundtableOutputs,
          consensus: lastConsensus ?? undefined,
        }),
        '#prism,#journey',
        'note',
      );
      setRoundtableOutputs([]);
      setLastConsensus(null);
      toast.success(`已固化为旅程文档（${fileName}）`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const toggleSeat = (id: string) => {
    setSelectedSeats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applyPreset = (preset: db.TeamPreset) => {
    const selected = new Set(
      preset.agentSlugs.filter((slug) => catalog.some((agent) => agent.slug === slug)),
    );
    if (selected.size === 0) {
      toast.error('预设中的 Agent 尚未导入');
      return;
    }
    setSelectedSeats(selected);
    setAgentDropdownOpen(false);
  };

  const saveCustomPreset = async () => {
    const slugs = selectedSeatList.map((seat) => seat.id);
    if (slugs.length === 0) {
      toast.error('请先勾选至少 1 位 Agent');
      return;
    }
    const name =
      typeof window !== 'undefined' && typeof window.prompt === 'function'
        ? window.prompt('保存团队预设名称', `自定义团队 ${teamPresets.length + 1}`)
        : null;
    const presetName = name?.trim() || `自定义团队 ${teamPresets.length + 1}`;
    await db.createTeamPreset(presetName, slugs);
    setTeamPresets(await db.listTeamPresets());
    toast.success(`已保存团队预设：${presetName}`);
  };

  return (
    <div className="mission-view flex h-full w-full flex-col gap-4 p-4 sm:p-5">
      <div className="pc-section-head">
        <span className="pc-section-code">SYS.03 / ROUNDTABLE</span>
        <span className="pc-section-title">需求论证 Canvas</span>
        <span className="pc-section-meta">{selectedSeatList.length} 席在席 · 共识阈值 3/4</span>
      </div>

      <div className="pc-studio-grid">
        <div className="pc-panel pc-canvas-panel">
          <div className="pc-canvas-toolbar">
            <div className="relative">
              <button
                type="button"
                data-agent-dropdown-toggle
                onClick={() => setAgentDropdownOpen((v) => !v)}
                className="pc-agent-toggle"
              >
                🧑‍⚖️ 在席团队 ({selectedSeatList.length})
                <ChevronDown size={12} />
              </button>
              {agentDropdownOpen && (
                <div
                  data-agent-dropdown
                  className="absolute left-0 top-10 z-30 w-[26rem] max-w-[calc(100vw-2rem)] rounded border border-cyan-500/30 bg-[#0d1420] p-3 font-mono text-[11px] shadow-2xl"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
                    <span className="text-[10px] font-bold text-slate-400">
                      Agency 团队目录 ({catalog.length})
                    </span>
                    <button
                      type="button"
                      data-save-team-preset
                      onClick={() => void saveCustomPreset()}
                      className="flex h-6 items-center gap-1 rounded border border-emerald-500/25 bg-emerald-500/10 px-2 text-[9px] text-emerald-300 hover:bg-emerald-500/20"
                    >
                      <Save size={10} />
                      保存当前团队
                    </button>
                  </div>
                  {teamPresets.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 border-b border-white/10 py-2">
                      {teamPresets.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          data-team-preset={preset.name}
                          onClick={() => applyPreset(preset)}
                          className="rounded border border-cyan-500/25 bg-cyan-500/10 px-2 py-1 text-[9px] text-cyan-300 hover:bg-cyan-500/20"
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="relative mt-2">
                    <Search
                      size={10}
                      className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500"
                    />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="搜索 Agent 名称 / slug / 描述..."
                      className="w-full rounded border border-white/10 bg-black/30 py-1.5 pl-7 pr-2 text-[10px] text-slate-200 outline-none placeholder:text-slate-600"
                    />
                  </div>
                  <div className="mt-2 flex max-h-16 flex-wrap gap-1 overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => setDivisionFilter(null)}
                      className={`rounded border px-2 py-0.5 text-[9px] transition-colors ${
                        divisionFilter === null
                          ? 'border-cyan-500/40 bg-cyan-500/20 text-cyan-200'
                          : 'border-white/10 text-slate-500 hover:bg-white/10'
                      }`}
                    >
                      全部
                    </button>
                    {divisions.map((division) => (
                      <button
                        key={division}
                        type="button"
                        onClick={() =>
                          setDivisionFilter(division === divisionFilter ? null : division)
                        }
                        className={`rounded border px-2 py-0.5 text-[9px] transition-colors ${
                          divisionFilter === division
                            ? 'border-cyan-500/40 bg-cyan-500/20 text-cyan-200'
                            : 'border-white/10 text-slate-500 hover:bg-white/10'
                        }`}
                      >
                        {division}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 max-h-64 space-y-1 overflow-y-auto pr-1">
                    {filteredCatalog.map((agent) => (
                      <label
                        key={agent.slug}
                        data-agent-seat={agent.slug}
                        className="flex cursor-pointer items-center gap-2 rounded p-1.5 transition-colors hover:bg-cyan-500/10"
                      >
                        <input
                          type="checkbox"
                          checked={selectedSeats.has(agent.slug)}
                          onChange={() => toggleSeat(agent.slug)}
                          className="h-3 w-3 accent-cyan-500"
                        />
                        <span className="truncate">
                          {agent.emoji} {agent.name}
                          <span className="ml-1 text-slate-500">@{agent.slug}</span>
                        </span>
                      </label>
                    ))}
                    {catalog.length === 0 &&
                      prismSeats.map((seat) => (
                        <label
                          key={seat.id}
                          data-agent-seat={seat.id}
                          className="flex cursor-pointer items-center gap-2 rounded p-1.5 transition-colors hover:bg-cyan-500/10"
                        >
                          <input
                            type="checkbox"
                            checked={selectedSeats.has(seat.id)}
                            onChange={() => toggleSeat(seat.id)}
                            className="h-3 w-3 accent-cyan-500"
                          />
                          <span>
                            {seat.emoji ?? SEAT_AVATAR[seat.id] ?? '👤'} @{seat.id}
                            <span className="ml-1 text-slate-500">({seat.role})</span>
                          </span>
                        </label>
                      ))}
                    {filteredCatalog.length === 0 && catalog.length > 0 && (
                      <div className="py-2 text-[10px] text-slate-500">没有匹配的 Agent</div>
                    )}
                    {catalog.length === 0 && prismSeats.length === 0 && (
                      <div className="py-2 text-[10px] text-slate-500">未发现 Agent 规约文件</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {selectedSeatList.slice(0, 5).map((seat) => (
                <span key={seat.id} className="pc-seat on" style={seatStyle(seat)}>
                  <span className="dot" />
                  {seat.emoji ?? SEAT_AVATAR[seat.id] ?? '👤'} {seat.name}
                </span>
              ))}
            </div>

            <select
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
              aria-label="Provider"
              className="ml-auto h-8 rounded border border-white/10 bg-white/[0.04] px-2 font-mono text-[10px] text-slate-300 outline-none"
            >
              <option value="">默认活跃 Provider</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <button type="button" onClick={() => void newChat()} className="pc-mini-btn">
              <Plus size={12} />
              新对话
            </button>
          </div>

          <div className="pc-messages" data-chat-messages>
            {messages.map((message, idx) => {
              if (message.content === '__stream__') {
                const seat = orchestrator.seatForMessageIndex(idx);
                return (
                  <div key={`stream-${idx}`} className="flex items-start gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-xs">
                      {seat ? (seat.emoji ?? SEAT_AVATAR[seat.id] ?? '👤') : '…'}
                    </div>
                    <div className={`pc-msg ${seatTone(seat)}`} style={seatStyle(seat)}>
                      <div className="pc-who">
                        <i />
                        {seat ? `@${seat.id} 独立论证中` : '论证中'}
                      </div>
                    </div>
                  </div>
                );
              }
              const isUser = message.role === 'user';
              return (
                <div
                  key={message.id ?? `m-${idx}`}
                  data-ai-message-role={message.role}
                  className={`flex items-start gap-2.5 ${isUser ? 'justify-end' : ''}`}
                >
                  {!isUser && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/15 text-xs font-bold text-cyan-300">
                      AI
                    </div>
                  )}
                  <div className={`pc-msg ${isUser ? 'user' : ''}`}>
                    {isUser && (
                      <div className="pc-who">
                        <i style={{ color: 'var(--prism-accent)' }} />
                        CPO · 你
                      </div>
                    )}
                    {message.content}
                  </div>
                  {isUser && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-300/20 bg-white/10 text-[10px] font-bold text-slate-300">
                      ME
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {streamStatus !== 'idle' && (
            <div
              className="mx-3 mb-2 flex items-center gap-2 rounded border border-cyan-500/25 bg-cyan-500/[0.08] px-3 py-1.5 font-mono text-[10px] text-cyan-200"
              data-studio-stream-status
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" />
              {streamStatus === 'connecting' && '正在连接 Provider…'}
              {streamStatus === 'streaming' && '多 Agent 并行论证中，请稍候…'}
              {streamStatus === 'error' && '流式连接中断，请重试'}
            </div>
          )}

          <div className="pc-composer">
            <div className="pc-composer-field">
              <textarea
                ref={composerRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onInput={autoGrowComposer}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    void sendText();
                  }
                }}
                rows={3}
                data-studio-chat-input
                placeholder="深入论证观点，键入 # 挂载长期记忆，键入 @ 唤起指定专家…"
              />
              <span className="pc-composer-hint">⌘Enter 发送 · Shift+Enter 换行</span>
            </div>
            <button
              type="button"
              data-studio-send
              onClick={() => void sendText()}
              disabled={busy || !input.trim()}
              className="pc-send-btn disabled:opacity-40"
              aria-label="Send message"
            >
              <Send size={15} />
            </button>
            {busy && (
              <button
                type="button"
                aria-label="Stop"
                className="flex w-10 shrink-0 items-center justify-center rounded border border-white/10 text-slate-400 hover:text-rose-300"
              >
                <Square size={12} />
              </button>
            )}
          </div>
          {streamError && (
            <div className="mx-3 mb-2 break-words rounded border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[10px] text-rose-300">
              {streamError}
            </div>
          )}
        </div>

        <div className="pc-drawer">
          <div className="pc-panel">
            <div className="pc-panel-title">
              <span className="tick" />
              Trade-off 评估<span className="right">LIVE</span>
            </div>
            {roundtableOutputs.length > 0 ? (
              <div className="space-y-2">
                {roundtableOutputs.map(({ seat, opinion }) => (
                  <div
                    key={seat.id}
                    data-roundtable-output={seat.id}
                    className="rounded border p-2.5"
                    style={seatStyle(seat)}
                  >
                    <span className="pc-who">
                      <i />
                      {seat.emoji ?? SEAT_AVATAR[seat.id] ?? '👤'} {seat.name} · {seat.role}
                    </span>
                    <p className="mt-1 line-clamp-4 text-[11px] leading-relaxed text-slate-300">
                      {opinion || '（无输出）'}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="pc-trade-row">
                <div className="pc-trade-col pro">
                  <h4>PROS</h4>
                  <ul>
                    <li>并行独立发言，覆盖全部门视角</li>
                    <li>共识草案由 LLM 汇总，CPO 终裁</li>
                    <li>可固化为旅程文档</li>
                  </ul>
                </div>
                <div className="pc-trade-col con">
                  <h4>CONS</h4>
                  <ul>
                    <li>多 Agent 并行消耗 Token</li>
                    <li>需人工确认定稿</li>
                    <li>依赖 Provider 可用性</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          <div className="pc-panel flex-1 min-h-0">
            <div className="pc-panel-title">
              <span className="tick" />
              历史回溯<span className="right">ARCHIVE</span>
            </div>
            <ul className="pc-adr-list max-h-64 overflow-y-auto">
              {sessions.slice(0, 30).map((session) => (
                <li
                  key={session.id}
                  data-session-history={session.id}
                  onClick={() => void loadSession(session)}
                  style={
                    activeSessionId === session.id
                      ? { borderColor: 'rgba(34,211,238,0.45)', color: 'var(--color-text-primary)' }
                      : undefined
                  }
                >
                  <History size={13} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px]">
                      {session.title || '未命名对话'}
                    </span>
                    <span className="block truncate font-mono text-[9px] opacity-60">
                      {new Date(session.createdAt).toLocaleString()} · {session.model}
                    </span>
                  </span>
                  {activeSessionId === session.id && (
                    <Check size={12} className="shrink-0 text-cyan-300" />
                  )}
                </li>
              ))}
              {sessions.length === 0 && (
                <li className="py-6 text-center text-[11px] text-slate-600">
                  暂无历史对话，派发一次圆桌论证后自动记录
                </li>
              )}
            </ul>
          </div>

          <button
            type="button"
            data-consolidate-knowledge
            data-freeze-knowledge
            onClick={() => {
              if (roundtableOutputs.length > 0) void consolidateKnowledge();
            }}
            disabled={roundtableOutputs.length === 0}
            className="pc-solid-btn w-full disabled:cursor-not-allowed disabled:opacity-40"
            title="固化为旅程文档，写入项目 docs/journey/"
          >
            🧠 固化为知识
          </button>
        </div>
      </div>
    </div>
  );
}
