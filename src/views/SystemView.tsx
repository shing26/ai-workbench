import { Activity, Clipboard, Plus, Radio, Terminal } from "lucide-react";
import { useEffect, useState } from "react";
import * as db from "../lib/db";
import { useWorkbenchStore } from "../stores/workbenchStore";
import BentoCard from "../components/ui/BentoCard";
import ModelBadge from "../components/ui/ModelBadge";

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function SystemView() {
  const providers = useWorkbenchStore((s) => s.providers);
  const addProvider = useWorkbenchStore((s) => s.addProvider);
  const toggleProvider = useWorkbenchStore((s) => s.toggleProvider);
  const clipboard = useWorkbenchStore((s) => s.clipboard);
  const logs = useWorkbenchStore((s) => s.logs);
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [health, setHealth] = useState<Record<string, db.ProviderHealth>>({});

  const check = async (id: string) => {
    const result = await db.checkProviderHealth(id);
    setHealth((prev) => ({ ...prev, [id]: result }));
  };

  const checkAll = async () => {
    const entries = await Promise.all(
      providers.map(async (p) => [p.id, await db.checkProviderHealth(p.id)] as const),
    );
    setHealth(Object.fromEntries(entries));
  };

  useEffect(() => {
    void checkAll();
  }, [providers.length]);

  const create = async () => {
    if (!name.trim() || !baseUrl.trim()) return;
    await addProvider(name.trim(), baseUrl.trim(), apiKey.trim());
    setName("");
    setBaseUrl("");
    setApiKey("");
  };

  return (
    <div className="view-enter flex h-full flex-col gap-4 overflow-y-auto p-4">
      <BentoCard title="Providers" subtitle="AI 节点配置与健康度" icon={Activity} colSpan={12}>
        <div className="mb-3 grid gap-3 md:grid-cols-3">
          {providers.map((p) => (
            <div
              key={p.id}
              className={`provider-card rounded-2xl border bg-white/[0.03] p-3 ${
                p.isActive ? "active-provider border-emerald-500/20" : "border-white/10"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <ModelBadge
                  label={p.name}
                  tone={p.isActive ? "green" : "neutral"}
                  status={p.isActive ? "active" : "idle"}
                  pulse={p.isActive}
                />
                <button type="button" onClick={() => void toggleProvider(p.id, !p.isActive)} className="text-[10px] text-slate-500 hover:text-slate-300">
                  {p.isActive ? "Disable" : "Enable"}
                </button>
              </div>
              <p className="mt-2 truncate text-[11px] text-slate-500">{p.baseUrl}</p>
              <div className="mt-1 flex items-center gap-1.5 text-[10px]">
                <span className={`h-1.5 w-1.5 rounded-full ${health[p.id]?.ok ? "bg-emerald-400" : "bg-red-400"}`} />
                <span className={health[p.id]?.ok ? "text-emerald-400" : "text-red-300"}>
                  {health[p.id]?.ok ? "ok" : "unreachable"}
                </span>
                <span className="text-slate-500">{health[p.id] ? `${health[p.id].latencyMs}ms` : "- ms"}</span>
                <button
                  type="button"
                  onClick={() => void check(p.id)}
                  className="ml-auto text-[10px] text-slate-500 hover:text-slate-300"
                >
                  Check
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="h-9 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
          />
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="Base URL"
            className="h-9 flex-[2] rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
          />
          <input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="API key ref"
            className="h-9 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
          />
          <button
            type="button"
            onClick={() => void checkAll()}
            className="flex h-9 items-center gap-1 rounded-xl bg-blue-500/20 px-3 text-xs text-[#7FB4FF] hover:bg-blue-500/30"
          >
            Check all
          </button>
          <button
            type="button"
            onClick={() => void create()}
            className="flex h-9 items-center gap-1 rounded-xl bg-emerald-500/20 px-3 text-xs text-emerald-400 hover:bg-emerald-500/30"
          >
            <Plus size={14} /> Add
          </button>
        </div>
      </BentoCard>

      <div className="grid gap-4 md:grid-cols-2">
        <BentoCard title="Clipboard history" subtitle="本地实时监听" icon={Clipboard} colSpan={6}>
          <div className="mb-2 flex items-center gap-2 text-[10px] text-slate-500">
            <Radio size={11} className="text-emerald-400" />
            <span>listening</span>
            <span className="ml-auto">{clipboard.length} items</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {clipboard.slice(0, 10).map((c) => (
              <div
                key={c.id}
                className="message-in flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] text-slate-300">{c.content}</div>
                  <div className="mt-0.5 text-[10px] text-slate-600">
                    {c.source} · {formatTime(c.timestamp)}
                  </div>
                </div>
              </div>
            ))}
            {clipboard.length === 0 && <div className="py-8 text-center text-xs text-slate-600">Empty</div>}
          </div>
        </BentoCard>
        <BentoCard title="Error logs" subtitle="前端与 Rust 实时诊断" icon={Terminal} colSpan={6}>
          <div className="mb-2 flex items-center gap-2 text-[10px] text-slate-500">
            <span className={`health-dot h-1.5 w-1.5 rounded-full ${logs.some((l) => l.severity === "error") ? "bg-red-400" : "bg-emerald-400"}`} />
            <span>{logs.some((l) => l.severity === "error") ? "has errors" : "healthy"}</span>
            <span className="ml-auto">{logs.length} entries</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {logs.slice(0, 10).map((l) => (
              <div
                key={l.id}
                className="message-in rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2"
              >
                <div className="flex items-center gap-2 text-[11px] text-red-300">
                  <span className="font-medium">{l.source}</span>
                  <span className="text-[9px] uppercase text-red-400/70">{l.severity}</span>
                  <span className="ml-auto text-[10px] text-red-400/60">{formatTime(l.timestamp)}</span>
                </div>
                <p className="mt-1 break-words text-[11px] leading-relaxed text-red-200/80">{l.message}</p>
                {l.stack && <pre className="mt-1 max-h-20 overflow-auto whitespace-pre-wrap text-[10px] leading-relaxed text-red-300/60">{l.stack}</pre>}
              </div>
            ))}
            {logs.length === 0 && <div className="py-8 text-center text-xs text-slate-600">No logs</div>}
          </div>
        </BentoCard>
      </div>
    </div>
  );
}
