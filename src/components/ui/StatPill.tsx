type Props = { label: string; value: string | number; tone?: 'green' | 'blue' | 'neutral' };

export default function StatPill({ label, value, tone = 'neutral' }: Props) {
  const color =
    tone === 'green' ? 'text-cyan-300' : tone === 'blue' ? 'accent-text-strong' : 'text-slate-200';
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 backdrop-blur-md">
      <span className="truncate text-[11px] text-slate-400">{label}</span>
      <span className={`font-mono text-sm font-semibold ${color}`}>{value}</span>
    </div>
  );
}
