type Props = { label: string; value: string | number; tone?: 'green' | 'blue' | 'neutral' };

export default function StatPill({ label, value, tone = 'neutral' }: Props) {
  const color =
    tone === 'green'
      ? 'text-emerald-400'
      : tone === 'blue'
        ? 'accent-text-strong'
        : 'text-slate-300';
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
      <span className="truncate text-[11px] text-slate-500">{label}</span>
      <span className={`font-mono text-sm font-semibold ${color}`}>{value}</span>
    </div>
  );
}
