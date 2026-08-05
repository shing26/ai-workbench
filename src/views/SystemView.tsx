import { Activity, AlertTriangle, Check, Clipboard, CloudUpload, Download, HeartPulse, History, Pencil, Plus, Radio, RefreshCw, Terminal, Upload, Users, X } from "lucide-react";
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
  const refreshSystem = useWorkbenchStore((s) => s.refreshSystem);
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [health, setHealth] = useState<Record<string, db.ProviderHealth>>({});
  const [heartbeat, setHeartbeat] = useState<db.ProviderHeartbeatSnapshot | null>(null);
  const [streamSmoke, setStreamSmoke] = useState<Record<string, db.StreamSmokeResult>>({});
  const [deviceId, setDeviceId] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [lastRemoteDevice, setLastRemoteDevice] = useState("");
  const [syncMessage, setSyncMessage] = useState("");
  const [syncError, setSyncError] = useState(false);
  const [remoteUrl, setRemoteUrl] = useState("");
  const [remoteToken, setRemoteToken] = useState("");
  const [departments, setDepartments] = useState<db.Department[]>([]);
  const [agents, setAgents] = useState<db.Agent[]>([]);
  const [agentDeptId, setAgentDeptId] = useState("");
  const [agentName, setAgentName] = useState("");
  const [agentRole, setAgentRole] = useState("");
  const [promptEditAgentId, setPromptEditAgentId] = useState<string | null>(null);
  const [promptDraft, setPromptDraft] = useState("");
  const [versionOpenAgentId, setVersionOpenAgentId] = useState<string | null>(null);
  const [promptVersions, setPromptVersions] = useState<db.AgentPromptVersion[]>([]);

  useEffect(() => {
    void db.getSyncStatus().then((status) => {
      setDeviceId(status.deviceId);
      setLastSyncedAt(status.lastSyncedAt);
    });
  }, []);

  useEffect(() => {
    let disposed = false;
    void Promise.all([db.listDepartments(), db.listAgents()]).then(([departmentList, agentList]) => {
      if (disposed) return;
      setDepartments(departmentList);
      setAgents(agentList);
      setAgentDeptId((current) => current || departmentList[0]?.id || "");
    });
    return () => {
      disposed = true;
    };
  }, []);

  const createAgentItem = async () => {
    if (!agentDeptId || !agentName.trim()) return;
    await db.createAgent(agentDeptId, agentName.trim(), agentRole.trim(), "openai", null, "");
    setAgents(await db.listAgents());
    setDepartments(await db.listDepartments());
    setAgentName("");
    setAgentRole("");
  };

  const saveAgentPrompt = async (id: string) => {
    await db.updateAgentSystemPrompt(id, promptDraft.trim());
    setAgents(await db.listAgents());
    setPromptEditAgentId(null);
    setPromptDraft("");
  };

  const togglePromptVersions = async (agentId: string) => {
    if (versionOpenAgentId === agentId) {
      setVersionOpenAgentId(null);
      setPromptVersions([]);
      return;
    }
    setVersionOpenAgentId(agentId);
    setPromptVersions(await db.listAgentPromptVersions(agentId));
  };

  const restorePromptVersion = async (agentId: string, versionId: string) => {
    await db.restoreAgentPrompt(agentId, versionId);
    setAgents(await db.listAgents());
    setPromptVersions(await db.listAgentPromptVersions(agentId));
  };

  const exportSync = async () => {
    const snapshot = await db.exportSyncSnapshot();
    setSyncError(false);
    setSyncMessage(`Exported ${snapshot.clipboard.length} clips / ${snapshot.logs.length} logs`);
  };

  const importSync = async () => {
    const result = await db.importSyncSnapshot();
    await refreshSystem();
    setSyncError(false);
    setLastSyncedAt(result.syncedAt);
    setLastRemoteDevice(result.deviceId);
    setSyncMessage(`Merged +${result.clipboardAdded} clips +${result.logsAdded} logs`);
  };

  const pushSync = async () => {
    if (!remoteUrl.trim()) {
      setSyncError(true);
      setSyncMessage("Remote URL required");
      return;
    }
    try {
      const result = await db.pushSyncSnapshot(remoteUrl.trim(), remoteToken);
      setSyncError(false);
      setLastSyncedAt(result.syncedAt);
      setSyncMessage(result.message);
    } catch (err) {
      setSyncError(true);
      setSyncMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const pullSync = async () => {
    if (!remoteUrl.trim()) {
      setSyncError(true);
      setSyncMessage("Remote URL required");
      return;
    }
    try {
      const result = await db.pullSyncSnapshot(remoteUrl.trim(), remoteToken);
      await refreshSystem();
      setSyncError(false);
      setLastSyncedAt(result.syncedAt);
      setLastRemoteDevice(result.deviceId);
      setSyncMessage(`Merged +${result.clipboardAdded} clips +${result.logsAdded} logs`);
    } catch (err) {
      setSyncError(true);
      setSyncMessage(err instanceof Error ? err.message : String(err));
    }
  };

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

  const runStreamSmoke = async (id: string) => {
    const result = await db.runProviderStreamSmokeTest(id);
    setStreamSmoke((prev) => ({ ...prev, [id]: result }));
  };

  useEffect(() => {
    void checkAll();
  }, [providers.length]);

  useEffect(() => {
    let disposed = false;
    let unlisten = () => {};
    void db.runProviderHeartbeat().then((snapshot) => {
      if (!disposed) setHeartbeat(snapshot);
    });
    void db
      .listenProviderHeartbeat((snapshot) => {
        if (!disposed) setHeartbeat(snapshot);
      })
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      });
    return () => {
      disposed = true;
      unlisten();
    };
  }, []);

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
        {heartbeat && heartbeat.alerts.length > 0 && (
          <div className="heartbeat-alert mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-[10px] text-red-300">
            <AlertTriangle size={12} className="shrink-0" />
            <span className="font-medium">Provider alerts</span>
            {heartbeat.alerts.map((alert) => (
              <span key={alert.id} className="rounded-md bg-red-500/15 px-1.5 py-0.5">
                {alert.name}: {alert.message}
              </span>
            ))}
            <span className="ml-auto text-red-400/70">
              {heartbeat.checkedAt ? new Date(heartbeat.checkedAt).toLocaleTimeString("zh-CN") : ""}
            </span>
          </div>
        )}
        <div className="mb-3 grid gap-3 md:grid-cols-3">
          {providers.map((p) => {
            const entry = heartbeat?.providers.find((h) => h.id === p.id) ?? null;
            const state = entry ?? health[p.id];
            const statusLabel = !state
              ? "pending"
              : state.ok
                ? "ok"
                : entry?.checked === false
                  ? "pending"
                  : "degraded";
            return (
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
                  <span className={`h-1.5 w-1.5 rounded-full ${state?.ok ? "bg-emerald-400" : "bg-red-400"}`} />
                  <span className={state?.ok ? "text-emerald-400" : "text-red-300"}>{statusLabel}</span>
                  <span className="text-slate-500">{state ? `${state.latencyMs}ms` : "- ms"}</span>
                  {entry?.alert && (
                    <span className="rounded-md bg-red-500/15 px-1.5 py-0.5 text-red-300">alert</span>
                  )}
                  <button
                    type="button"
                    onClick={() => void check(p.id)}
                    className="ml-auto text-[10px] text-slate-500 hover:text-slate-300"
                  >
                    Check
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    data-stream-test
                    onClick={() => void runStreamSmoke(p.id)}
                    className="flex h-6 items-center gap-1 rounded-md accent-bg-15 px-1.5 text-[9px] accent-text-strong accent-hover-bg-25"
                  >
                    <Radio size={9} /> Stream test
                  </button>
                  {streamSmoke[p.id] && (
                    <span
                      data-stream-smoke-result
                      className={`rounded-md px-1.5 py-0.5 text-[9px] ${
                        streamSmoke[p.id].ok
                          ? "bg-emerald-500/10 text-emerald-300"
                          : "bg-rose-500/10 text-rose-300"
                      }`}
                    >
                      {streamSmoke[p.id].message}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
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
            onClick={async () => setHeartbeat(await db.runProviderHeartbeat())}
            className="flex h-9 items-center gap-1 rounded-xl bg-emerald-500/15 px-3 text-xs text-emerald-300 hover:bg-emerald-500/25"
          >
            <HeartPulse size={14} /> Heartbeat
          </button>
          <button
            type="button"
            onClick={() => void checkAll()}
            className="flex h-9 items-center gap-1 rounded-xl accent-bg-20 px-3 text-xs accent-text-strong accent-hover-bg-30"
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

      <BentoCard title="Sync snapshot" subtitle="剪贴板与日志跨设备同步" icon={CloudUpload} colSpan={12}>
        <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
          <span className="rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5">
            device {deviceId.slice(0, 8)}
          </span>
          <span>
            {lastSyncedAt
              ? `last sync ${new Date(lastSyncedAt).toLocaleTimeString("zh-CN")}`
              : "not synced yet"}
          </span>
          {lastRemoteDevice && <span className="text-slate-400">from {lastRemoteDevice.slice(0, 8)}</span>}
          {syncMessage && (
            <span data-sync-message className={syncError ? "text-rose-400" : "text-emerald-400"}>
              {syncMessage}
            </span>
          )}
          <span className="ml-auto flex gap-1.5">
            <button
              type="button"
              aria-label="Export sync snapshot"
              onClick={() => void exportSync()}
              className="flex h-8 items-center gap-1 rounded-lg accent-bg-15 px-2.5 text-[11px] accent-text-strong accent-hover-bg-25"
            >
              <CloudUpload size={12} /> Export
            </button>
            <button
              type="button"
              aria-label="Import sync snapshot"
              onClick={() => void importSync()}
              className="flex h-8 items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 text-[11px] text-emerald-400 hover:bg-emerald-500/25"
            >
              <RefreshCw size={12} /> Import
            </button>
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={remoteUrl}
            onChange={(e) => setRemoteUrl(e.target.value)}
            placeholder="Remote URL"
            className="h-9 min-w-56 flex-[2] rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
          />
          <input
            value={remoteToken}
            onChange={(e) => setRemoteToken(e.target.value)}
            type="password"
            placeholder="Bearer token (optional)"
            className="h-9 min-w-40 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
          />
          <button
            type="button"
            aria-label="Push sync snapshot"
            onClick={() => void pushSync()}
            className="flex h-9 items-center gap-1 rounded-lg accent-bg-15 px-2.5 text-[11px] accent-text-strong accent-hover-bg-25"
          >
            <Upload size={12} /> Push
          </button>
          <button
            type="button"
            aria-label="Pull sync snapshot"
            onClick={() => void pullSync()}
            className="flex h-9 items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 text-[11px] text-emerald-400 hover:bg-emerald-500/25"
          >
            <Download size={12} /> Pull
          </button>
        </div>
      </BentoCard>

      <BentoCard title="Agent directory" subtitle="部门与 Agent 数据模型" icon={Users} colSpan={12}>
        <div className="grid gap-3 md:grid-cols-5">
          {departments.map((d) => (
            <div key={d.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[11px] font-medium text-slate-300">{d.name}</span>
                <span className="shrink-0 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[9px] text-emerald-400">
                  {d.agentCount}
                </span>
              </div>
              <p className="mt-1 text-[10px] text-slate-500">{d.description}</p>
              <div className="mt-2 space-y-1">
                {agents
                  .filter((a) => a.departmentId === d.id)
                  .map((a) => (
                    <div key={a.id}>
                      <div className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2 py-1.5 text-[10px]">
                        <span className="min-w-0 flex-1 truncate text-slate-300">{a.name}</span>
                        <button
                          type="button"
                          aria-label={`Edit agent prompt: ${a.name}`}
                          onClick={() => {
                            setPromptEditAgentId(a.id);
                            setPromptDraft(a.systemPrompt);
                          }}
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white/5 text-slate-500 hover:text-violet-300"
                        >
                          <Pencil size={10} />
                        </button>
                        <span className="shrink-0 text-slate-600">{a.role}</span>
                      </div>
                      {a.systemPrompt && (
                        <p className="mt-0.5 truncate px-2 text-[9px] text-violet-400/70">{a.systemPrompt}</p>
                      )}
                      {promptEditAgentId === a.id && (
                        <div className="agent-prompt-editor mt-1 rounded-lg border border-violet-500/25 bg-violet-500/5 p-2">
                          <textarea
                            value={promptDraft}
                            onChange={(e) => setPromptDraft(e.target.value)}
                            rows={2}
                            aria-label="Agent system prompt"
                            className="w-full resize-none rounded-md border border-white/10 bg-black/20 px-2 py-1.5 text-[10px] text-slate-200 outline-none focus:border-violet-500/40"
                          />
                          <div className="mt-1.5 flex justify-end gap-1">
                            <button
                              type="button"
                              aria-label="Show prompt versions"
                              onClick={() => void togglePromptVersions(a.id)}
                              className="flex h-6 items-center gap-1 rounded-md bg-white/5 px-1.5 text-[9px] text-slate-400 accent-hover-text"
                            >
                              <History size={10} /> Versions
                            </button>
                            <button
                              type="button"
                              aria-label="Cancel agent prompt"
                              onClick={() => {
                                setPromptEditAgentId(null);
                                setPromptDraft("");
                              }}
                              className="flex h-6 items-center gap-1 rounded-md bg-white/5 px-1.5 text-[9px] text-slate-500 hover:text-slate-300"
                            >
                              <X size={10} /> Cancel
                            </button>
                            <button
                              type="button"
                              aria-label="Save agent prompt"
                              onClick={() => void saveAgentPrompt(a.id)}
                              className="flex h-6 items-center gap-1 rounded-md bg-violet-500/20 px-1.5 text-[9px] text-violet-300 hover:bg-violet-500/30"
                            >
                              <Check size={10} /> Save
                            </button>
                          </div>
                          {versionOpenAgentId === a.id && (
                            <div className="prompt-version-list mt-1.5 space-y-1">
                              {promptVersions.length === 0 && (
                                <div className="px-1 text-[9px] text-slate-600">No versions yet</div>
                              )}
                              {promptVersions.map((v, index) => (
                                <div
                                  key={v.id}
                                  className="flex items-start gap-1.5 rounded-md bg-black/20 px-1.5 py-1"
                                >
                                  <span className="shrink-0 text-[9px] text-slate-500">v{index + 1}</span>
                                  <span className="min-w-0 flex-1 truncate text-[9px] text-slate-400">
                                    {v.content || "(empty)"}
                                  </span>
                                  <button
                                    type="button"
                                    aria-label={`Restore prompt version ${index + 1}`}
                                    onClick={() => void restorePromptVersion(a.id, v.id)}
                                    className="shrink-0 text-[9px] accent-text-strong accent-hover-base"
                                  >
                                    Restore
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={agentDeptId}
            onChange={(e) => setAgentDeptId(e.target.value)}
            aria-label="Agent department"
            className="h-9 rounded-xl border border-white/10 bg-white/[0.03] px-2 text-xs text-slate-300 outline-none"
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <input
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void createAgentItem();
            }}
            placeholder="Agent name"
            className="h-9 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs text-slate-200 outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
          />
          <input
            value={agentRole}
            onChange={(e) => setAgentRole(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void createAgentItem();
            }}
            placeholder="Role"
            className="h-9 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs text-slate-200 outline-none focus:border-emerald-500/40 placeholder:text-slate-600"
          />
          <button
            type="button"
            onClick={() => void createAgentItem()}
            aria-label="Add agent"
            className="flex h-9 items-center gap-1.5 rounded-xl bg-emerald-500/20 px-3 text-xs font-medium text-emerald-400 hover:bg-emerald-500/30"
          >
            <Plus size={14} /> Add agent
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
