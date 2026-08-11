import { Activity, HeartPulse } from 'lucide-react';
import BentoCard from '../ui/BentoCard';
import * as db from '../../lib/db';
import { useWorkbenchStore } from '../../stores/workbenchStore';

type Props = {
  health: Record<string, db.ProviderHealth>;
  heartbeat: db.ProviderHeartbeatSnapshot | null;
};

export default function SystemRail({ health, heartbeat }: Props) {
  const providers = useWorkbenchStore((s) => s.providers);

  const activeCount = providers.filter((p) => p.isActive).length;
  const entryFor = (id: string) => heartbeat?.providers.find((entry) => entry.id === id) ?? null;
  const okCount = providers.filter((p) => {
    const entry = entryFor(p.id);
    const state = entry ?? health[p.id];
    return state ? state.ok : false;
  }).length;
  const degradedCount = providers.filter((p) => {
    const entry = entryFor(p.id);
    const state = entry ?? health[p.id];
    return state ? !state.ok : false;
  }).length;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <BentoCard title="Provider health" subtitle="AI 节点健康摘要" icon={Activity} tier="rail">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
            <span className="rounded-md bg-white/[0.03] px-1.5 py-0.5 text-slate-400">
              {activeCount} active
            </span>
            <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-emerald-300">
              {okCount} ok
            </span>
            <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-amber-300">
              {degradedCount} degraded
            </span>
            <span className="ml-auto inline-flex items-center gap-1 text-[9px] text-slate-500">
              <HeartPulse size={11} className={heartbeat ? 'text-emerald-400' : 'text-slate-600'} />
              {heartbeat
                ? new Date(heartbeat.checkedAt).toLocaleTimeString('zh-CN')
                : 'no heartbeat'}
            </span>
          </div>
          <div className="space-y-1">
            {providers.length === 0 && (
              <div className="rounded-lg border border-white/5 px-2 py-1.5 text-[10px] text-slate-600">
                No providers configured
              </div>
            )}
            {providers.map((p) => {
              const entry = entryFor(p.id);
              const state = entry ?? health[p.id];
              const ok = state ? state.ok : null;
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-2 rounded-lg bg-white/[0.02] px-2 py-1"
                >
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      ok === false ? 'bg-red-400' : ok === true ? 'bg-emerald-400' : 'bg-slate-600'
                    }`}
                  />
                  <span className="min-w-0 flex-1 truncate text-[10px] text-slate-300">
                    {p.name}
                  </span>
                  <span
                    className={`shrink-0 text-[9px] ${
                      ok === false
                        ? 'text-red-300'
                        : ok === true
                          ? 'text-emerald-400'
                          : 'text-slate-500'
                    }`}
                  >
                    {ok === null ? 'pending' : ok ? 'ok' : 'degraded'}
                  </span>
                  <span className="w-14 shrink-0 text-right text-[9px] tabular-nums text-slate-500">
                    {state ? `${state.latencyMs}ms` : '- ms'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </BentoCard>
    </div>
  );
}
