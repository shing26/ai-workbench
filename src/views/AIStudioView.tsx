import { Send } from "lucide-react";
import { useState } from "react";
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
  const activeProvider = providers.find((p) => p.id === providerId) ?? providers.find((p) => p.isActive);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    const providerIds = moa
      ? providers.filter((p) => p.isActive).slice(0, 3).map((p) => p.id)
      : activeProvider
        ? [activeProvider.id]
        : [];
    const reply = await db.sendAiMessage({ providerIds, messages: next, moa });
    setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    if (moa) {
      openInspector("MOA Trace", [
        { label: "Providers", value: providerIds.length ? providerIds.join(", ") : "none" },
        { label: "Consensus", value: reply },
      ]);
    }
    setBusy(false);
  };

  return (
    <div className="view-enter flex h-full flex-col gap-4 p-4">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ModelBadge label={activeProvider?.name ?? "No provider"} tone="green" />
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
              className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                m.role === "user"
                  ? "self-end bg-emerald-500/15 text-emerald-100"
                  : "self-start border border-white/10 bg-white/[0.04] text-slate-300"
              }`}
            >
              {m.content}
            </div>
          ))}
        </div>
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
