import { Activity, Clipboard, Plus, Terminal } from "lucide-react";
import { useState } from "react";
import { useWorkbenchStore } from "../stores/workbenchStore";
import BentoCard from "../components/ui/BentoCard";
import ModelBadge from "../components/ui/ModelBadge";

export default function SystemView() {
  const providers = useWorkbenchStore((s) => s.providers);
  const addProvider = useWorkbenchStore((s) => s.addProvider);
  const toggleProvider = useWorkbenchStore((s) => s.toggleProvider);
  const clipboard = useWorkbenchStore((s) => s.clipboard);
  const logs = useWorkbenchStore((s) => s.logs);
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");

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
              <p className="mt-1 text-[10px] text-slate-600">Latency — ms</p>
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
            onClick={() => void create()}
            className="flex h-9 items-center gap-1 rounded-xl bg-emerald-500/20 px-3 text-xs text-emerald-400 hover:bg-emerald-500/30"
          >
            <Plus size={14} /> Add
          </button>
        </div>
      </BentoCard>

      <div className="grid gap-4 md:grid-cols-2">
        <BentoCard title="Clipboard history" subtitle="最近复制内容" icon={Clipboard} colSpan={6}>
          <div className="flex flex-col gap-1.5">
            {clipboard.slice(0, 8).map((c) => (
              <div key={c.id} className="truncate rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-slate-400">
                {c.content}
              </div>
            ))}
            {clipboard.length === 0 && <div className="py-8 text-center text-xs text-slate-600">Empty</div>}
          </div>
        </BentoCard>
        <BentoCard title="Error logs" subtitle="StackTrace 诊断" icon={Terminal} colSpan={6}>
          <div className="flex flex-col gap-1.5">
            {logs.slice(0, 8).map((l) => (
              <div
                key={l.id}
                className="message-in rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-300"
              >
                <span className="mr-1 font-medium">{l.source}</span>
                {l.message}
              </div>
            ))}
            {logs.length === 0 && <div className="py-8 text-center text-xs text-slate-600">No logs</div>}
          </div>
        </BentoCard>
      </div>
    </div>
  );
}
