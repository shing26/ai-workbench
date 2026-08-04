import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type Props = {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  colSpan?: number;
  className?: string;
  children?: ReactNode;
};

export default function BentoCard({ title, subtitle, icon: Icon, colSpan = 12, className = "", children }: Props) {
  return (
    <section
      className={`flex min-w-0 flex-col rounded-2xl border border-white/10 bg-[#18181C] p-4 shadow-xl ${className}`}
      style={{ gridColumn: `span ${colSpan} / span ${colSpan}` }}
    >
      <header className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p>}
        </div>
        {Icon && <Icon size={16} className="text-slate-500" />}
      </header>
      {children}
    </section>
  );
}
