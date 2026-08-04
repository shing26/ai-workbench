type Props = { label: string; tone?: "green" | "blue" | "neutral"; status?: string };

const TONES = {
  green: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  blue: "bg-[#007AFF]/15 text-[#7FB4FF] border-[#007AFF]/30",
  neutral: "bg-white/[0.04] text-slate-400 border-white/10",
};

export default function ModelBadge({ label, tone = "neutral", status }: Props) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${TONES[tone]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
      {status && <span className="opacity-70">{status}</span>}
    </span>
  );
}
