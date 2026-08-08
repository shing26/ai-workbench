import { ArrowLeft, GitBranch, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';
import type { GitContext, Project, ProjectRevenuePoint } from '../lib/db';
import ModelBadge from '../components/ui/ModelBadge';
import StatPill from '../components/ui/StatPill';

type ProjectDetailViewProps = {
  project: Project;
  gitCtx?: GitContext;
  revenueTrend: ProjectRevenuePoint[];
  onBack: () => void;
  children?: ReactNode;
};

export default function ProjectDetailView({
  project,
  gitCtx,
  revenueTrend,
  onBack,
  children,
}: ProjectDetailViewProps) {
  const trendMax = Math.max(1, ...revenueTrend.map((point) => point.revenue));
  return (
    <div data-project-detail className="flex min-w-0 flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          data-project-detail-back
          onClick={onBack}
          className="flex h-7 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 text-[10px] text-slate-400 transition-colors hover:text-slate-200"
        >
          <ArrowLeft size={12} /> Back to projects
        </button>
        <span className="text-[9px] uppercase tracking-normal text-slate-600">Detail</span>
      </div>

      <section data-project-detail-stage className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-100">{project.name}</h2>
            <p className="mt-0.5 truncate text-[11px] text-slate-500">
              {project.path || 'No local path'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatPill label="Revenue" value={`$${project.revenue.toFixed(2)}`} tone="green" />
            <StatPill label="Status" value={project.status} />
          </div>
        </div>
        {revenueTrend.length > 0 && (
          <div
            data-project-detail-revenue-trend
            className="rounded-xl border border-white/10 bg-black/20 p-2.5"
          >
            <div className="mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1 text-[9px] uppercase tracking-normal text-slate-500">
                <TrendingUp size={9} /> Revenue trend
              </span>
              <span className="font-mono text-[8px] text-slate-600">{revenueTrend.length} pts</span>
            </div>
            <div className="flex h-16 items-end gap-1">
              {revenueTrend.map((point) => (
                <div key={point.id} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <span
                    data-project-detail-revenue-point
                    data-project-detail-revenue-value={point.revenue}
                    className="block w-full rounded-sm bg-emerald-500/30"
                    style={{
                      height: `${Math.max(3, Math.round((point.revenue / trendMax) * 40))}px`,
                    }}
                  />
                  <span className="truncate text-[7px] text-slate-600">
                    {new Date(point.recordedAt).toLocaleDateString('en', {
                      month: 'numeric',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section data-project-detail-rail className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
        {gitCtx && (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-2.5">
            <div className="mb-2 flex items-center gap-1 text-[9px] uppercase tracking-normal text-slate-500">
              <GitBranch size={9} /> Git summary
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <ModelBadge label={gitCtx.branch} tone="blue" />
              <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-slate-400">
                {gitCtx.commitCount} commits
              </span>
              <span className="ml-auto truncate font-mono text-[9px] text-slate-500">
                {gitCtx.head}
              </span>
            </div>
            <div className="mt-2 truncate text-[10px] text-slate-400">{gitCtx.latestCommit}</div>
            {gitCtx.changes.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {gitCtx.changes.slice(0, 5).map((file) => (
                  <span
                    key={file}
                    className="max-w-56 truncate rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-slate-500"
                  >
                    {file}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-2.5">
          <div className="mb-2 text-[9px] uppercase tracking-normal text-slate-500">
            Revenue history
          </div>
          {revenueTrend.length === 0 ? (
            <div className="text-[10px] text-slate-600">No revenue history yet</div>
          ) : (
            <div className="flex max-h-44 flex-col gap-1 overflow-auto">
              {[...revenueTrend].reverse().map((point) => (
                <div
                  key={point.id}
                  data-project-detail-revenue-history-row
                  className="flex items-center justify-between gap-2 rounded-md bg-white/[0.02] px-2 py-1"
                >
                  <span className="font-mono text-[10px] text-emerald-300">
                    ${point.revenue.toFixed(2)}
                  </span>
                  <span className="text-[9px] text-slate-500">
                    {new Date(point.recordedAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section data-project-detail-fold className="flex min-w-0 flex-col gap-3">
        <div className="text-[9px] uppercase tracking-normal text-slate-600">
          AI actions &amp; project settings
        </div>
        {children}
      </section>
    </div>
  );
}
