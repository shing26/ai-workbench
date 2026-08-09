import { useState } from 'react';
import { Activity, HeartPulse, Wallet } from 'lucide-react';
import BentoCard from '../ui/BentoCard';
import * as db from '../../lib/db';
import {
  formatTokens,
  getBudgetStatus,
  resetTokenBudget,
  setTokenBudget,
  type TokenBudgetConfig,
  type TokenBudgetStatus,
} from '../../lib/tokenBudget';
import { useWorkbenchStore } from '../../stores/workbenchStore';

type Props = {
  health: Record<string, db.ProviderHealth>;
  heartbeat: db.ProviderHeartbeatSnapshot | null;
};

export default function SystemRail({ health, heartbeat }: Props) {
  const providers = useWorkbenchStore((s) => s.providers);
  const [budgetLimitDraft, setBudgetLimitDraft] = useState(() =>
    String(getBudgetStatus().monthlyLimit),
  );
  const [budgetConfig, setBudgetConfig] = useState<TokenBudgetConfig>(() => getBudgetStatus());
  const [budgetStatus, setBudgetStatus] = useState<TokenBudgetStatus>(() => getBudgetStatus());

  const saveBudgetLimit = () => {
    const limit = Math.max(1, Math.floor(Number(budgetLimitDraft) || 0));
    const next = setTokenBudget({ monthlyLimit: limit });
    const status = getBudgetStatus(next);
    setBudgetConfig(next);
    setBudgetStatus(status);
    setBudgetLimitDraft(String(limit));
  };

  const toggleBudgetDegrade = () => {
    const next = setTokenBudget({ autoDegrade: !budgetConfig.autoDegrade });
    const status = getBudgetStatus(next);
    setBudgetConfig(next);
    setBudgetStatus(status);
  };

  const resetBudgetMonth = () => {
    const next = resetTokenBudget();
    const status = getBudgetStatus(next);
    setBudgetConfig(next);
    setBudgetStatus(status);
  };

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
  const tpmPressure = budgetStatus.pct >= 100 ? 'over' : budgetStatus.pct >= 75 ? 'near' : 'normal';

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <BentoCard title="Token budget" subtitle="跨流估算与月度上限" icon={Wallet} tier="rail">
        <div className="space-y-3" data-token-budget-card>
          <div className="flex items-center gap-2">
            <input
              data-token-budget-limit
              type="number"
              min="1"
              value={budgetLimitDraft}
              onChange={(e) => setBudgetLimitDraft(e.target.value)}
              onBlur={saveBudgetLimit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveBudgetLimit();
              }}
              className="h-8 w-28 rounded-xl border border-white/10 bg-[#18181C] px-2 text-[11px] text-slate-300 outline-none focus:border-emerald-500/40"
            />
            <button
              type="button"
              onClick={saveBudgetLimit}
              className="h-8 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 text-[10px] text-slate-400 hover:text-emerald-300"
            >
              Set limit
            </button>
            <button
              type="button"
              data-token-budget-reset
              onClick={resetBudgetMonth}
              className="h-8 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 text-[10px] text-slate-400 hover:text-rose-300"
            >
              Reset month
            </button>
            <label className="ml-auto flex items-center gap-1.5 text-[10px] text-slate-400">
              <input
                data-token-budget-auto-degrade
                type="checkbox"
                checked={budgetConfig.autoDegrade}
                onChange={toggleBudgetDegrade}
                className="accent-emerald-500"
              />
              Auto degrade
            </label>
          </div>
          <div>
            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <span data-token-budget-used>
                {formatTokens(budgetStatus.usedTokens)} / {formatTokens(budgetStatus.monthlyLimit)}{' '}
                tokens
              </span>
              <span>{Math.round(budgetStatus.pct)}%</span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-white/5">
              <div
                data-token-budget-bar
                className={`h-full rounded-full ${
                  budgetStatus.over
                    ? 'bg-rose-500'
                    : budgetStatus.near
                      ? 'bg-amber-400'
                      : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.max(budgetStatus.pct, 2)}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-[9px] uppercase tracking-wide text-slate-600">
                TPM pressure
              </span>
              <span
                data-token-tpm-pressure
                className={`rounded-md px-1.5 py-0.5 text-[9px] ${
                  tpmPressure === 'over'
                    ? 'bg-rose-500/10 text-rose-300'
                    : tpmPressure === 'near'
                      ? 'bg-amber-500/10 text-amber-300'
                      : 'bg-emerald-500/10 text-emerald-300'
                }`}
              >
                {tpmPressure}
              </span>
            </div>
            {budgetStatus.over && (
              <p className="mt-1.5 text-[10px] text-rose-300">
                Over monthly token budget — AI Studio will degrade to local providers.
              </p>
            )}
          </div>
        </div>
      </BentoCard>

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
