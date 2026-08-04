import { Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as db from "../lib/db";
import { useWorkbenchStore } from "../stores/workbenchStore";
import ModelBadge from "../components/ui/ModelBadge";

type Message = { role: "user" | "assistant"; content: string };

export default function AIStudioView() {
  const providers = useWorkbenchStore((s) => s.providers);
  const openInspector = useWorkbenchStore((s) => s.openInspector);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Ready. Ask anything or switch to MOA for multi-model consensus." },
  ]);
  const [input, setInput] = useState("");
  const [providerId, setProviderId] = useState("");
  const [moa, setMoa] = useState(false);
  const [busy, setBusy] = useState(false);
  const runIdRef = useRef(0);
  const activeProvider = providers.find((p) => p.id === providerId) ?? providers.find((p) => p.isActive);
  const activeProviders = providers.filter((p) => p.isActive);
  const moaProviders = activeProviders.slice(0, 3);

  useEffect(() => {
    let disposed = false;
    let unlisten = () => {};
    void db.listenStreamChunks((chunk) => {
      if (disposed) return;
      const runId = `ai-${runIdRef.current}`;
      if (chunk.id !== runId) return;
      setMessages((prev) => {
        if (chunk.done) {
          if (chunk.error) {
            const next = [...prev];
            const idx = next.findIndex((m) => m.role === "assistant" && m.content.startsWith("__stream__"));
            if (idx >= 0) {
              next[idx] = { ...next[idx], content: `请求失败: ${chunk.error}` };
            }
            return next;
          }
          return prev;
        }
        const next = [...prev];
        const idx = next.findIndex((m) => m.role === "assistant" && m.content.startsWith("__stream__"));
        if (idx >= 0) {
          next[idx] = { ...next[idx], content: `${next[idx].content}${chunk.delta}` };
        } else {
          next.push({ role: "assistant", content: chunk.delta });
        }
        return next;
      });
      if (chunk.done) setBusy(false);
    }).then((fn) => {
      if (disposed) fn();
      else unlisten = fn;
    });
    return () => {
      disposed = true;
      unlisten();
    };
  }, []);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    const runId = `ai-${++runIdRef.current}`;
    const next: Message[] = [...messages, { role: "user", content: text }, { role: "assistant", content: "__stream__" }];
    setMessages(next);
    setInput("");
    const providerIds = moa
      ? providers.filter((p) => p.isActive).slice(0, 3).map((p) => p.id)
      : activeProvider
        ? [activeProvider.id]
        : [];
    try {
      await db.sendAiMessageStream({
        providerIds,
        messages: next.filter((m) => m.content !== "__stream__"),
        moa,
        runId,
      });
    } catch {
      setMessages((prev) => prev.map((m) => (m.content === "__stream__" ? { ...m, content: "请求失败: stream unavailable" } : m)));
      setBusy(false);
    }
    if (moa) {
      openInspector("MOA Trace", [
        { label: "Providers", value: providerIds.length ? providerIds.join(", ") : "none" },
        { label: "Status", value: "streaming consensus" },
      ]);
    }
  };

  return (
    <div className="view-enter flex h-full flex-col gap-4 p-4">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {moa ? (
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
              onClick={() => setMoa(false)}
              className={`rounded-[10px] px-3 py-1.5 text-[11px] ${!moa ? "bg-emerald-500/20 text-emerald-400" : "text-slate-500 hover:text-slate-300"}`}
            >
              Single
            </button>
            <button
              type="button"
              onClick={() => setMoa(true)}
              className={`rounded-[10px] px-3 py-1.5 text-[11px] ${moa ? "bg-[#007AFF]/20 text-[#7FB4FF]" : "text-slate-500 hover:text-slate-300"}`}
            >
              MOA
            </button>
          </div>
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
          <button
            type="button"
            onClick={() => void send()}
            disabled={busy}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 transition-colors hover:bg-emerald-500/30 disabled:opacity-40"
            aria-label="Send"
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
