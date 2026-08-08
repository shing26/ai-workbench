import type { PointerEventHandler, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export type BentoCardTier = 'stage' | 'rail' | 'fold' | 'grid';

type Props = {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  colSpan?: number;
  material?: 'cyan' | 'original' | 'rain' | 'chrome';
  tier?: BentoCardTier;
  className?: string;
  children?: ReactNode;
  onPointerMove?: PointerEventHandler<HTMLElement>;
  onPointerLeave?: PointerEventHandler<HTMLElement>;
};

const TIER_STYLES: Record<
  BentoCardTier,
  { padding: string; title: string; card: string; header: string }
> = {
  stage: {
    padding: 'p-5',
    title: 'text-[15px]',
    card: 'shadow-2xl ring-1 ring-white/5',
    header: 'mb-4',
  },
  rail: {
    padding: 'p-4',
    title: 'text-sm',
    card: '',
    header: 'mb-3',
  },
  fold: {
    padding: 'p-3',
    title: 'text-[13px]',
    card: 'bg-[#18181C]/85 backdrop-blur-sm',
    header: 'mb-2',
  },
  grid: {
    padding: 'p-4',
    title: 'text-sm',
    card: 'transition-[transform,border-color,box-shadow] duration-[120ms] ease-out hover:-translate-y-0.5 hover:border-emerald-500/30 hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0',
    header: 'mb-3',
  },
};

export default function BentoCard({
  title,
  subtitle,
  icon: Icon,
  colSpan = 12,
  material,
  tier,
  className = '',
  children,
  onPointerMove,
  onPointerLeave,
}: Props) {
  const MATERIAL_BY_TITLE: Record<string, NonNullable<Props['material']>> = {
    'Today Focus': 'rain',
    Habits: 'original',
    'Fast list': 'chrome',
    'Schedule Timeline': 'cyan',
    Providers: 'chrome',
    'Sync snapshot': 'cyan',
    'Clipboard history': 'original',
    'Error logs': 'rain',
    'Agent directory': 'original',
    'Thought Inbox': 'original',
    'Vault Index': 'rain',
  };
  const resolvedMaterial = material ?? MATERIAL_BY_TITLE[title] ?? null;
  const tierStyle = tier ? TIER_STYLES[tier] : null;
  const padding = tierStyle?.padding ?? 'p-4';
  const titleClass = tierStyle?.title ?? 'text-sm';
  const cardExtra = tierStyle?.card ?? '';
  const headerClass = tierStyle?.header ?? 'mb-3';
  const background = tier === 'fold' ? 'bg-[#18181C]/85' : 'bg-[#18181C]';

  return (
    <section
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      data-material={resolvedMaterial}
      className={`bento-card material-card ${resolvedMaterial ? `material-${resolvedMaterial}` : ''} flex min-w-0 flex-col rounded-2xl border border-white/10 ${background} shadow-xl ${padding} ${cardExtra} ${className}`}
      style={{ gridColumn: `span ${colSpan} / span ${colSpan}` }}
    >
      <header className={`flex items-start justify-between gap-2 ${headerClass}`}>
        <div>
          <h2 className={`font-semibold text-slate-200 ${titleClass}`}>{title}</h2>
          {subtitle && (
            <p
              className={`mt-0.5 text-[11px] text-slate-500 ${tier === 'fold' ? 'text-[10px]' : ''}`}
            >
              {subtitle}
            </p>
          )}
        </div>
        {Icon && <Icon size={16} className="text-slate-500" />}
      </header>
      {children}
    </section>
  );
}
