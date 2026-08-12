import { AlertTriangle, Clock3, Lock } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import * as db from '../lib/db';
import { formatTokens, getBudgetStatus, lastNDaysUsage, loadTokenBudget } from '../lib/tokenBudget';
import { useWorkbenchStore } from '../stores/workbenchStore';

export default function DashboardView() {
  const projects = useWorkbenchStore((s) => s.projects);
  const tasks = useWorkbenchStore((s) => s.tasks);
  const thoughts = useWorkbenchStore((s) => s.thoughts);
  const [cliStats, setCliStats] = useState(() => db.getCliRunStats());
  const [recentRuns] = useState(() => db.listCliRuns().slice(-1));
  const [tokenUsage] = useState(() => lastNDaysUsage(7));
  const [budget] = useState(() => getBudgetStatus(loadTokenBudget()));

  useEffect(() => {
    const refresh = () => setCliStats(db.getCliRunStats());
    refresh();
    const timer = window.setInterval(refresh, 8000);
    return () => window.clearInterval(timer);
  }, []);

  const coverage = useMemo(() => {
    const total = projects.length;
    const documented = projects.filter(
      (p) =>
        (p.material && p.material.trim().length > 0) ||
        thoughts.some((t) => t.tags.includes(p.id) || (t.content || '').includes(p.name)),
    ).length;
    return total > 0 ? Math.round((documented / total) * 100) : 100;
  }, [projects, thoughts]);

  const activeProjects = projects.filter((p) => p.status === 'active');
  const todayDoD = tasks.filter((t) => t.isToday && t.isDod && t.status !== 'done').slice(0, 3);
  const blocked = tasks
    .filter(
      (t) =>
        t.status === 'in_progress' &&
        (t.title.toLowerCase().includes('block') ||
          t.title.toLowerCase().includes('wait') ||
          t.title.toLowerCase().includes('阻塞')),
    )
    .slice(0, 3);
  const blockedCount = tasks.filter((t) => t.status === 'in_progress').length;
  const totalTokens = tokenUsage.reduce((sum, p) => sum + p.tokens, 0);
  const maxTokens = Math.max(1, ...tokenUsage.map((p) => p.tokens));
  const lastRun = recentRuns[0];
  const topDoD = todayDoD[0];
  const topBlocked = blocked[0];
  const riskTitle = budget.over
    ? 'Token 预算已超限'
    : thoughts.length === 0
      ? '知识基线待固化'
      : blockedCount >= 3
        ? '依赖阻塞风险升高'
        : '系统状态健康';
  const riskDesc = budget.over
    ? '建议切换到本地 Provider 或清理会话，避免中断交付。'
    : thoughts.length === 0
      ? '暂无知识卡片，先固化一份 Spec 再推进后续论证。'
      : blockedCount >= 3
        ? `${blockedCount} 个进行中任务存在依赖阻塞，建议优先解锁前置 Task。`
        : '无即时风险，各模块链路正常。';
  const riskMeta = budget.over
    ? '需要人工决策'
    : thoughts.length === 0
      ? '建议发起重构论证'
      : blockedCount >= 3
        ? '建议优先处理阻塞'
        : '实时监控中';

  return (
    <div className="mission-view space-y-4 p-4 sm:p-5 lg:space-y-5">
      <div className="pc-section-head">
        <span className="pc-section-code">SYS.01 / OVERVIEW</span>
        <span className="pc-section-title">总览控制塔</span>
        <span className="pc-section-meta">
          SYNC {new Date().toLocaleTimeString()} · LOCAL-FIRST
        </span>
      </div>

      <div className="pc-stat-row">
        <div className="pc-panel pc-stat">
          <div>
            <div className="pc-stat-value">
              {projects.length}
              <em>+{activeProjects.length}</em>
            </div>
            <div className="pc-stat-label">纳管项目</div>
          </div>
          <div className="pc-delta-up">▲ {activeProjects.length} 个进行中旅程</div>
        </div>

        <div className="pc-panel pc-stat">
          <div>
            <div className="pc-stat-value">{formatTokens(totalTokens)}</div>
            <div className="pc-stat-label">7 天 Token 上下文</div>
          </div>
          <div data-token-sparkline className="flex h-9 items-end gap-1">
            {tokenUsage.map((point) => (
              <div
                key={point.day}
                data-token-sparkline-point
                data-token-sparkline-day={point.day}
                data-token-sparkline-value={point.tokens}
                className="min-w-0 flex-1 bg-cyan-400/70"
                style={{ height: `${Math.max(3, Math.round((point.tokens / maxTokens) * 30))}px` }}
              />
            ))}
          </div>
        </div>

        <div className="pc-panel pc-stat">
          <div>
            <div className="pc-stat-value">
              {cliStats.total}
              <em style={{ color: 'var(--color-success)' }}>{cliStats.successRate}%</em>
            </div>
            <div className="pc-stat-label">CLI 智能体状态</div>
          </div>
          <div className="pc-bar-row">
            <span>成功率</span>
            <span className="pc-bar-track green">
              <i style={{ width: `${cliStats.successRate}%` }} />
            </span>
            <span style={{ color: 'var(--color-success)' }}>{cliStats.successRate}%</span>
          </div>
        </div>

        <div className="pc-panel pc-stat">
          <div>
            <div className="pc-stat-value">{coverage}%</div>
            <div className="pc-stat-label">活体知识健康度</div>
          </div>
          <div className="pc-bar-row">
            <span>{thoughts.length} 卡片</span>
            <span className="pc-bar-track">
              <i style={{ width: `${coverage}%` }} />
            </span>
            <span style={{ color: 'var(--color-warning)' }}>
              {coverage >= 80 ? 'Healthy' : coverage >= 50 ? 'Warning' : 'Risk'}
            </span>
          </div>
        </div>
      </div>

      <div className="pc-focus-row">
        <div className="pc-panel pc-focus-card" data-dashboard-today-dod>
          <div className="pc-panel-title">
            <span className="tick" />
            今日 Top DoD<span className="right">{todayDoD.length} 项</span>
          </div>
          <span className="pc-badge green">{topDoD ? 'DOD' : 'IDLE'}</span>
          <div className="pc-focus-title" data-dashboard-dod-item={topDoD?.id}>
            {topDoD?.title ?? '今日暂无待办 DoD'}
          </div>
          <div className="pc-focus-desc">
            {topDoD
              ? `项目 ${projects.find((p) => p.id === topDoD.projectId)?.name ?? 'Prism Station'} · ${
                  topDoD.status === 'in_progress' ? '推进中' : '待启动'
                }`
              : '先添加 3~5 项今日交付目标，聚焦核心事项。'}
          </div>
          <div className="pc-meta-line">
            <Clock3 size={12} />
            {topDoD?.dueDate ? `预计 ${topDoD.dueDate}` : '依赖 AI Studio 共识'} · 前往交付终端
          </div>
        </div>

        <div className="pc-panel pc-focus-card pc-blocked" data-dashboard-blocked>
          <div className="pc-panel-title">
            <span className="tick" />
            阻塞告警<span className="right">{blockedCount} 项</span>
          </div>
          <span className="pc-badge red">{topBlocked ? 'BLOCKED' : 'CLEAR'}</span>
          <div className="pc-focus-title" data-dashboard-blocked-item={topBlocked?.id}>
            {topBlocked?.title ?? '无阻塞任务，流水线健康'}
          </div>
          <div className="pc-focus-desc">
            {topBlocked
              ? '前置任务未完成或等待论证结论，无法派发 CLI。'
              : '当前没有依赖链阻断，可以继续推进今日交付。'}
          </div>
          <div className="pc-meta-line">
            <Lock size={12} />
            {topBlocked ? '等待 论证 → 固化' : '持续监控中'}
          </div>
        </div>

        <div className="pc-panel pc-focus-card" data-dashboard-risk>
          <div className="pc-panel-title">
            <span className="tick" />
            AI 风险推送<span className="right">LIVE</span>
          </div>
          <span className="pc-badge amber">
            {budget.over || thoughts.length === 0 ? 'TRADE-OFF' : 'HEALTHY'}
          </span>
          <div className="pc-focus-title">{riskTitle}</div>
          <div className="pc-focus-desc">{riskDesc}</div>
          <div className="pc-meta-line">
            <AlertTriangle size={12} />
            {riskMeta}
          </div>
        </div>
      </div>

      <div className="pc-panel plain pc-system-strip">
        <div className="pc-sys-item">
          SQLite <span className="val">OK</span>
        </div>
        <div className="pc-sys-item">
          develop <span className="val">42 ahead</span>
        </div>
        <div className="pc-sys-item">
          Tauri IPC <span className="val">0 error</span>
        </div>
        <div className="pc-sys-item">
          Obsidian{' '}
          <span className="val" style={{ color: '#a78bfa' }}>
            Linked
          </span>
        </div>
        {lastRun && (
          <div className="pc-sys-item">
            最近执行{' '}
            <span className="val">
              {lastRun.exitCode === 0 ? 'Exit 0' : `Exit ${lastRun.exitCode}`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
