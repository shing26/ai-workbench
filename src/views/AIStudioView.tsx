import { Check, Pencil, Plus, Search, Send, Square, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as db from "../lib/db";
import { useWorkbenchStore } from "../stores/workbenchStore";
import type { InspectorSection } from "../stores/workbenchStore";
import ModelBadge from "../components/ui/ModelBadge";

type Message = { role: "user" | "assistant"; content: string };
type ApiMessage = { role: "user" | "assistant" | "system"; content: string };

export default function AIStudioView() {
  const providers = useWorkbenchStore((s) => s.providers);
  const openInspector = useWorkbenchStore((s) => s.openInspector);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Ready. Ask anything or switch to MOA for multi-model consensus." },
  ]);
  const [input, setInput] = useState("");
  const [providerId, setProviderId] = useState("");
  const [moa, setMoa] = useState(false);
  const [autoRoute, setAutoRoute] = useState(false);
  const [routedProvider, setRoutedProvider] = useState<{ name: string; fallbackFrom: string | null } | null>(null);
  const [useRag, setUseRag] = useState(true);
  const [ragHits, setRagHits] = useState<db.RagSearchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [sessions, setSessions] = useState<db.Session[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionQuery, setSessionQuery] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const runIdRef = useRef(0);
  const sessionIdRef = useRef<string | null>(null);
  const runsRef = useRef(new Map<string, { content: string; index: number }>());
  const activeProvider = providers.find((p) => p.id === providerId) ?? providers.find((p) => p.isActive);
  const activeProviders = providers.filter((p) => p.isActive);
  const moaProviders = activeProviders.slice(0, 3);

  const setMode = (mode: "single" | "moa" | "auto") => {
    setMoa(mode === "moa");
    setAutoRoute(mode === "auto");
  };

  useEffect(() => {
    let disposed = false;
    let unlisten = () => {};
    void db.listenStreamChunks((chunk) => {
      if (disposed) return;
      const run = runsRef.current.get(chunk.id);
      if (!run) return;
      if (chunk.done) {
        setMessages((prev) => {
          const next = [...prev];
          const idx = run.index;
          if (idx < next.length && next[idx].role === "assistant") {
            const partial = next[idx].content.startsWith("__stream__")
              ? next[idx].content.slice("__stream__".length)
              : run.content;
            next[idx] = {
              ...next[idx],
              content: chunk.error
                ? `请求失败: ${chunk.error}`
                : chunk.cancelled && !run.content.endsWith("[stopped]")
                  ? `${partial} [stopped]`
                  : partial,
            };
          }
          return next;
        });
        runsRef.current.delete(chunk.id);
        if (!chunk.error && sessionIdRef.current && run.content) {
          void db.saveChatMessage(sessionIdRef.current, "assistant", run.content);
        }
        setBusy(false);
        return;
      }
      run.content += chunk.delta;
      setMessages((prev) => {
        const next = [...prev];
        const idx = run.index;
        if (idx < next.length && next[idx].role === "assistant") {
          const base = next[idx].content.startsWith("__stream__")
            ? next[idx].content.slice("__stream__".length)
            : run.content;
          next[idx] = { ...next[idx], content: `__stream__${base}${chunk.delta}` };
        }
        return next;
      });
    }).then((fn) => {
      if (disposed) fn();
      else unlisten = fn;
    });
    return () => {
      disposed = true;
      unlisten();
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    void db.listSessions().then(async (list) => {
      if (disposed) return;
      setSessions(list);
      const first = list[0];
      if (first) {
        sessionIdRef.current = first.id;
        setSessionId(first.id);
        const stored = await db.listChatMessages(first.id);
        if (disposed) return;
        if (stored.length > 0) {
          setMessages(stored.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));
        }
      }
    });
    return () => {
      disposed = true;
    };
  }, []);

  const stopStreaming = async () => {
    const runId = `ai-${runIdRef.current}`;
    runIdRef.current += 1;
    const run = runsRef.current.get(runId);
    const finalContent = `${run?.content ?? ""} [stopped]`;
    if (run) runsRef.current.delete(runId);
    setBusy(false);
    setMessages((prev) =>
      prev.map((m) =>
        m.role === "assistant" && m.content.startsWith("__stream__")
          ? { ...m, content: finalContent }
          : m,
      ),
    );
    await db.cancelAiStream(runId);
    if (sessionIdRef.current) {
      await db.saveChatMessage(sessionIdRef.current, "assistant", finalContent);
    }
  };

  const newChat = () => {
    if (busy) return;
    sessionIdRef.current = null;
    setSessionId(null);
    setMessages([{ role: "assistant", content: "Ready. Ask anything or switch to MOA for multi-model consensus." }]);
    runsRef.current.clear();
    setInput("");
    setRagHits([]);
  };

  const selectSession = async (id: string) => {
    if (busy) return;
    sessionIdRef.current = id;
    setSessionId(id);
    const stored = await db.listChatMessages(id);
    const loaded = stored.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
    setMessages(
      loaded.length > 0
        ? loaded
        : [{ role: "assistant", content: "Ready. Ask anything or switch to MOA for multi-model consensus." }],
    );
    setInput("");
    setRagHits([]);
  };

  const startRename = (session: db.Session) => {
    setConfirmDeleteId(null);
    setRenamingId(session.id);
    setRenameDraft(session.title);
  };

  const submitRename = async (id: string) => {
    const title = renameDraft.trim();
    if (title) {
      await db.renameSession(id, title);
      setSessions(await db.listSessions());
    }
    setRenamingId(null);
    setRenameDraft("");
  };

  const confirmDelete = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    await db.deleteSession(id);
    const list = await db.listSessions();
    setSessions(list);
    setConfirmDeleteId(null);
    if (sessionIdRef.current === id) {
      sessionIdRef.current = null;
      setSessionId(null);
      const first = list[0];
      if (first) {
        sessionIdRef.current = first.id;
        setSessionId(first.id);
        const stored = await db.listChatMessages(first.id);
        setMessages(
          stored.length > 0
            ? stored.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
            : [{ role: "assistant", content: "Ready. Ask anything or switch to MOA for multi-model consensus." }],
        );
      } else {
        setMessages([{ role: "assistant", content: "Ready. Ask anything or switch to MOA for multi-model consensus." }]);
      }
    }
  };

  const filteredSessions = sessions.filter((s) => {
    const q = sessionQuery.trim().toLowerCase();
    if (!q) return true;
    return `${s.title} ${s.model}`.toLowerCase().includes(q);
  });

  const ensureSession = async (titleHint: string) => {
    if (sessionIdRef.current) {
      const existing = sessions.find((s) => s.id === sessionIdRef.current);
      if (existing) {
        const stored = await db.listChatMessages(existing.id);
        if (stored.length > 0) return existing;
      }
    }
    const session = await db.createSession(
      titleHint.slice(0, 24) || "New chat",
      activeProvider?.name ?? "default",
    );
    sessionIdRef.current = session.id;
    setSessionId(session.id);
    setSessions(await db.listSessions());
    return session;
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    let hits: db.RagSearchResult[] = [];
    if (useRag) {
      try {
        hits = await db.searchThoughts(text, 5);
      } catch {
        hits = [];
      }
    }
    setRagHits(hits);
    const runId = `ai-${++runIdRef.current}`;
    const next: Message[] = [...messages, { role: "user", content: text }, { role: "assistant", content: "__stream__" }];
    setMessages(next);
    setInput("");
    runsRef.current.set(runId, { content: "", index: next.length - 1 });
    const session = await ensureSession(text);
    await db.saveChatMessage(session.id, "user", text);
    let providerIds: string[] = [];
    let routedName: string | null = null;
    let fallbackFrom: string | null = null;
    if (moa) {
      providerIds = providers.filter((p) => p.isActive).slice(0, 3).map((p) => p.id);
    } else if (autoRoute) {
      const routed = await db.routeProvider(providers.filter((p) => p.isActive).map((p) => p.id));
      if (routed.provider) {
        providerIds = [routed.provider.id];
        routedName = routed.provider.name;
        fallbackFrom = routed.fallbackFrom;
      } else {
        setMessages((prev) =>
          prev.map((m) => (m.content === "__stream__" ? { ...m, content: "请求失败: no healthy provider available" } : m)),
        );
        setBusy(false);
        setRoutedProvider(null);
        return;
      }
    } else {
      providerIds = activeProvider ? [activeProvider.id] : [];
    }
    setRoutedProvider(routedName ? { name: routedName, fallbackFrom } : null);
    const apiMessages: ApiMessage[] = next.filter((m) => m.content !== "__stream__");
    if (hits.length > 0) {
      apiMessages.unshift({
        role: "system",
        content: `Knowledge context:\n${hits.map((h) => `- ${h.content}`).join("\n")}`,
      });
    }
    try {
      await db.sendAiMessageStream({
        providerIds,
        messages: apiMessages,
        moa,
        runId,
      });
    } catch {
      setMessages((prev) => prev.map((m) => (m.content === "__stream__" ? { ...m, content: "请求失败: stream unavailable" } : m)));
      setBusy(false);
    }
    const sections: InspectorSection[] = [];
    if (moa) {
      sections.push(
        { label: "Providers", value: providerIds.length ? providerIds.join(", ") : "none" },
        { label: "Status", value: "streaming consensus" },
      );
    } else if (routedName) {
      sections.push({ label: "Router", value: `auto → ${routedName}` });
      sections.push({ label: "Fallback from", value: fallbackFrom || "none" });
    }
    if (hits.length > 0) {
      sections.push({ label: "RAG context", value: `${hits.length} local thought(s) injected` });
      hits.slice(0, 5).forEach((hit, index) => {
        sections.push({
          label: `Source ${index + 1}`,
          value: hit.content.replace(/\s+/g, " ").slice(0, 90),
        });
      });
    }
    if (sections.length > 0) {
      openInspector(
        moa && hits.length > 0 ? "MOA Trace + RAG" : hits.length > 0 ? "RAG Context" : "MOA Trace",
        sections,
      );
    }
  };

  return (
    <div className="view-enter flex h-full flex-col gap-4 p-4">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {autoRoute && routedProvider ? (
            <ModelBadge label={`auto → ${routedProvider.name}`} tone="green" status={routedProvider.fallbackFrom ? "fallback" : "active"} />
          ) : moa ? (
            <div className="moa-stack">
              {moaProviders.map((p) => (
                <ModelBadge key={p.id} label={p.name} tone="blue" status="active" />
              ))}
            </div>
          ) : (
            <ModelBadge label={activeProvider?.name ?? "No provider"} tone="green" />
          )}
          {moa && <ModelBadge label="MOA" tone="blue" status="3-way" />}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] p-0.5">
            <button
              type="button"
              onClick={() => setMode("single")}
              className={`rounded-[10px] px-3 py-1.5 text-[11px] ${!moa ? "bg-emerald-500/20 text-emerald-400" : "text-slate-500 hover:text-slate-300"}`}
            >
              Single
            </button>
            <button
              type="button"
              onClick={() => setMode("moa")}
              className={`rounded-[10px] px-3 py-1.5 text-[11px] ${moa ? "bg-[#007AFF]/20 text-[#7FB4FF]" : "text-slate-500 hover:text-slate-300"}`}
            >
              MOA
            </button>
            <button
              type="button"
              onClick={() => setMode("auto")}
              className={`rounded-[10px] px-3 py-1.5 text-[11px] ${autoRoute ? "bg-amber-500/20 text-amber-300" : "text-slate-500 hover:text-slate-300"}`}
            >
              Auto
            </button>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={useRag}
            aria-label="Toggle RAG context"
            onClick={() => {
              setUseRag((value) => !value);
              if (useRag) setRagHits([]);
            }}
            className={`flex h-8 shrink-0 items-center gap-1.5 rounded-xl border px-2.5 text-[11px] transition-colors ${
              useRag
                ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                : "border-white/10 bg-white/[0.03] text-slate-500 hover:text-slate-300"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${useRag ? "bg-amber-400" : "bg-slate-600"}`} />
            RAG
          </button>
          <select
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
            className="h-8 rounded-xl border border-white/10 bg-[#18181C] px-2 text-[11px] text-slate-300 outline-none"
          >
            <option value="">Default active provider</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-3">
        <aside className="hidden w-44 shrink-0 flex-col gap-2 rounded-2xl border border-white/10 bg-[#18181C] p-2 md:flex">
          <button
            type="button"
            onClick={newChat}
            className="flex h-9 shrink-0 items-center justify-center gap-1 rounded-xl bg-emerald-500/20 text-[11px] text-emerald-400 hover:bg-emerald-500/30"
          >
            <Plus size={13} /> New chat
          </button>
          <label className="flex h-8 shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-2 focus-within:border-emerald-500/40">
            <Search size={12} className="shrink-0 text-slate-600" />
            <input
              value={sessionQuery}
              onChange={(e) => setSessionQuery(e.target.value)}
              placeholder="Search sessions..."
              className="min-w-0 flex-1 bg-transparent text-[11px] text-slate-300 outline-none placeholder:text-slate-600"
            />
          </label>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {filteredSessions.map((s) =>
              renamingId === s.id ? (
                <div
                  key={s.id}
                  className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-1"
                >
                  <input
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void submitRename(s.id);
                      if (e.key === "Escape") {
                        setRenamingId(null);
                        setRenameDraft("");
                      }
                    }}
                    autoFocus
                    aria-label="Rename session input"
                    className="min-w-0 flex-1 bg-transparent px-1 text-[11px] text-slate-200 outline-none"
                  />
                  <button
                    type="button"
                    aria-label="Save session rename"
                    onClick={() => void submitRename(s.id)}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-500/20 text-emerald-400"
                  >
                    <Check size={11} />
                  </button>
                  <button
                    type="button"
                    aria-label="Cancel session rename"
                    onClick={() => {
                      setRenamingId(null);
                      setRenameDraft("");
                    }}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/5 text-slate-500"
                  >
                    <X size={11} />
                  </button>
                </div>
              ) : (
                <div key={s.id} className="group relative rounded-lg">
                  <button
                    type="button"
                    aria-label="Open session"
                    onClick={() => void selectSession(s.id)}
                    className={`w-full rounded-lg border px-2 py-1.5 pr-12 text-left ${
                      sessionId === s.id
                        ? "border-emerald-500/30 bg-emerald-500/10"
                        : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                    }`}
                  >
                    <span className="block truncate text-[11px] text-slate-300">{s.title}</span>
                    <span className="mt-0.5 block text-[9px] text-slate-600">{s.model}</span>
                  </button>
                  {confirmDeleteId === s.id ? (
                    <button
                      type="button"
                      aria-label="Confirm delete session"
                      onClick={() => void confirmDelete(s.id)}
                      className="absolute right-1.5 top-1/2 flex h-5 -translate-y-1/2 items-center gap-1 rounded-md bg-rose-500/25 px-1.5 text-[9px] text-rose-300"
                    >
                      <Trash2 size={10} /> Sure?
                    </button>
                  ) : (
                    <div className="absolute right-1.5 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 group-hover:flex">
                      <button
                        type="button"
                        aria-label="Rename session"
                        onClick={() => startRename(s)}
                        className="flex h-5 w-5 items-center justify-center rounded-md bg-white/5 text-slate-400 hover:text-emerald-300"
                      >
                        <Pencil size={10} />
                      </button>
                      <button
                        type="button"
                        aria-label="Delete session"
                        onClick={() => void confirmDelete(s.id)}
                        className="flex h-5 w-5 items-center justify-center rounded-md bg-white/5 text-slate-400 hover:text-rose-300"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  )}
                </div>
              ),
            )}
            {filteredSessions.length === 0 && (
              <div className="py-6 text-center text-[10px] text-slate-600">
                {sessionQuery.trim() ? "No matching sessions" : "No sessions"}
              </div>
            )}
          </div>
        </aside>
        <div className="flex min-h-0 flex-1 flex-col gap-3 rounded-2xl border border-white/10 bg-[#18181C] p-4 shadow-xl">
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`message-in max-w-[78%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                m.role === "user"
                  ? "self-end bg-emerald-500/15 text-emerald-100"
                  : "self-start border border-white/10 bg-white/[0.04] text-slate-300"
              }`}
            >
              {m.content === "__stream__" ? "" : m.content}
              {m.content === "__stream__" && busy && (
                <span className="stream-caret" />
              )}
            </div>
          ))}
        </div>
        {busy && (
          <div className="flex items-center gap-1.5 px-1 pb-2">
            <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-emerald-400" style={{ animationDelay: "150ms" }} />
            <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-emerald-400" style={{ animationDelay: "300ms" }} />
          </div>
        )}
        {ragHits.length > 0 && (
          <div className="rag-badge flex shrink-0 flex-wrap items-center gap-1.5 px-1 pb-1 text-[10px]">
            <span className="rounded-md border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 font-medium text-amber-300">
              RAG +{ragHits.length}
            </span>
            {ragHits.slice(0, 3).map((hit) => (
              <span
                key={hit.id}
                className="max-w-[260px] truncate rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-slate-500"
              >
                {hit.content.replace(/\s+/g, " ").slice(0, 44)}
              </span>
            ))}
          </div>
        )}
        <div className="flex shrink-0 items-end gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-2 focus-within:border-emerald-500/40">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={2}
            placeholder="Ask anything..."
            className="min-h-0 flex-1 resize-none bg-transparent px-2 py-1.5 text-xs text-slate-200 outline-none placeholder:text-slate-600"
          />
          {busy ? (
            <button
              type="button"
              onClick={() => void stopStreaming()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400 transition-colors hover:bg-rose-500/30"
              aria-label="Stop streaming"
            >
              <Square size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void send()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 transition-colors hover:bg-emerald-500/30"
              aria-label="Send"
            >
              <Send size={15} />
            </button>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
