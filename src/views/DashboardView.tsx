import {
  AlertTriangle,
  Flame,
  GitBranch,
  LayoutDashboard,
  ShieldAlert,
  Target,
  Terminal,
  TrendingUp,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import BentoCard from '../components/ui/BentoCard';
import StatPill from '../components/ui/StatPill';
import * as db from '../lib/db';
import { formatTokens, getBudgetStatus, lastNDaysUsage, loadTokenBudget } from '../lib/tokenBudget';
import { useWorkbenchStore } from '../stores/workbenchStore';

export default function DashboardView() {
  const projects = useWorkbenchStore((s) => s.projects);
  const tasks = useWorkbenchStore((s) => s.tasks);
  const thoughts = useWorkbenchStore((s) => s.thoughts);
  const [tokenUsage] = useState(() => lastNDaysUsage(7));
  const [budget] = useState(() => getBudgetStatus(loadTokenBudget()));
  const [cliStats, setCliStats] = useState(() => db.getCliRunStats());

  useEffect(() => {
    setCliStats(db.getCliRunStats());
  }, []);

  const todayDoD = tasks.filter((t) => t.isToday && t.isDod && t.status !== 'done').slice(0, 5);
  const blocked = tasks
    .filter(
      (t) =>
        t.status === 'in_progress' &&
        (t.title.toLowerCase().includes('block') || t.title.toLowerCase().includes('wait')),
    )
    .slice(0, 5);
  const blockedCount = tasks.filter((t) => t.status === 'in_progress').length;
  const noteCount = thoughts.filter((t) => t.type === 'note').length;
  const docCount = thoughts.filter((t) => t.type === 'doc').length;
  const totalTokens = tokenUsage.reduce((sum, p) => sum + p.tokens, 0);
  const maxTokens = Math.max(1, ...tokenUsage.map((p) => p.tokens));

  return (
    <div className="view-enter mx-auto grid w-full max-w-7xl grid-cols-12 gap-4 overflow-y-auto p-4">
      <div
        className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-4"
        style={{ gridColumn: 'span 12 / span 12' }}
      >
        <StatPill label="Projects" value={String(projects.length)} tone="blue" />
        <StatPill label="7d tokens" value={formatTokens(totalTokens)} tone="green" />
        <StatPill
          label="CLI success"
          value={cliStats.total > 0 ? `${cliStats.successRate}%` : '—'}
          tone="green"
        />
        <StatPill label="Knowledge" value={String(noteCount + docCount)} />
      </div>

      <BentoCard
        title="7 天 Token Sparkline"
        subtitle="近 7 日 Token 消耗"
        icon={TrendingUp}
        colSpan={7}
        tier="rail"
      >
        <div data-token-sparkline className="flex h-20 items-end gap-1.5">
          {tokenUsage.map((point) => {
            const pct = point.tokens > 0 ? (point.tokens / maxTokens) * 100 : 0;
            return (
              <div key={point.day} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <span
                  data-token-sparkline-point
                  data-token-sparkline-day={point.day}
                  data-token-sparkline-value={point.tokens}
                  className={`block w-full rounded-sm ${point.tokens > 0 ? 'accent-bg' : 'bg-white/[0.06]'}`}
                  style={{ height: `${Math.max(3, Math.round(pct * 56))}px` }}
                />
                <span className="font-mono text-[8px] text-slate-600">{point.day.slice(5)}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
          <span>
            本月 {formatTokens(budget.usedTokens)} / {formatTokens(budget.monthlyLimit)}
          </span>
          <span
            className={
              budget.near ? 'text-amber-400' : budget.over ? 'text-rose-400' : 'text-emerald-400'
            }
          >
            {budget.over ? '⚠ 已超限' : budget.near ? '⚠ 接近上限' : '✓ 预算健康'}
          </span>
        </div>
      </BentoCard>

      <BentoCard
        title="CLI 状态摘要"
        subtitle="本地 CLI 兵团健康度"
        icon={Terminal}
        colSpan={5}
        tier="rail"
      >
        <div data-cli-status-summary className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <StatPill label="Runs" value={String(cliStats.total)} />
            <StatPill label="Success" value={String(cliStats.success)} tone="green" />
            <StatPill
              label="Rate"
              value={`${cliStats.successRate}%`}
              tone={cliStats.successRate >= 80 ? 'green' : 'neutral'}
            />
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] text-slate-500">
            <GitBranch size={11} className="text-slate-600" />
            支持 claude / aider / codex / git · 最近运行
            {cliStats.lastRunAt ? new Date(cliStats.lastRunAt).toLocaleTimeString() : '—'}
          </div>
        </div>
      </BentoCard>

      <BentoCard
        title="今日焦点"
        subtitle="Top DoD · Blocked · AI 风险"
        icon={Target}
        colSpan={12}
        tier="stage"
      >
        <div className="grid gap-3 md:grid-cols-3">
          <div
            data-dashboard-today-dod
            className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
          >
            <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-emerald-400/80">
              <Flame size={11} /> Top DoD
            </div>
            {todayDoD.length === 0 && (
              <div className="py-3 text-center text-[11px] text-slate-500">今日无待办 DoD</div>
            )}
            <div className="space-y-1.5">
              {todayDoD.map((t) => (
                <div
                  key={t.id}
                  data-dashboard-dod-item={t.id}
                  className="truncate rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1.5 text-[11px] text-slate-300"
                >
                  {t.title}
                </div>
              ))}
            </div>
          </div>

          <div
            data-dashboard-blocked
            className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3"
          >
            <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-amber-400/80">
              <AlertTriangle size={11} /> Blocked（{blockedCount}）
            </div>
            {blocked.length === 0 && (
              <div className="py-3 text-center text-[11px] text-slate-500">无阻塞任务</div>
            )}
            <div className="space-y-1.5">
              {blocked.map((t) => (
                <div
                  key={t.id}
                  data-dashboard-blocked-item={t.id}
                  className="truncate rounded-lg border border-amber-500/10 bg-amber-500/[0.06] px-2 py-1.5 text-[11px] text-amber-200/80"
                >
                  {t.title}
                </div>
              ))}
            </div>
          </div>

          <div
            data-dashboard-risk
            className="rounded-xl border border-rose-500/20 bg-rose-500/[0.04] p-3"
          >
            <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-rose-400/80">
              <ShieldAlert size={11} /> AI 风险
            </div>
            {budget.over && (
              <div className="mb-1.5 rounded-lg border border-rose-500/20 bg-rose-500/[0.08] px-2 py-1.5 text-[11px] text-rose-300">
                Token 预算已超限，自动降级中
              </div>
            )}
            {docCount === 0 && (
              <div className="mb-1.5 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-2 py-1.5 text-[11px] text-amber-200/80">
                尚无知识文档，建议固化为知识
              </div>
            )}
            {blockedCount >= 3 && (
              <div className="mb-1.5 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-2 py-1.5 text-[11px] text-amber-200/80">
                {blockedCount} 个进行中任务可能阻塞
              </div>
            )}
            {!budget.over && docCount > 0 && blockedCount < 3 && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-2 py-1.5 text-[11px] text-emerald-300">
                ✓ 状态健康，无即时风险
              </div>
            )}
          </div>
        </div>
      </BentoCard>

      <div
        className="flex items-center gap-2 text-[10px] text-slate-600"
        style={{ gridColumn: 'span 12 / span 12' }}
      >
        <LayoutDashboard size={11} /> 控制塔 · 只读视图 · CLI 交付在 Actions
      </div>
    </div>
  );
}
