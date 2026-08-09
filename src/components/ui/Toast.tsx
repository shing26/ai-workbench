import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  dismissToast,
  getToasts,
  subscribeToasts,
  type ToastItem,
  type ToastKind,
} from '../../lib/toast';

const KIND_ICON: Record<ToastKind, typeof Info> = {
  success: CircleCheck,
  error: CircleAlert,
  info: Info,
  warning: TriangleAlert,
};

const KIND_STYLE: Record<ToastKind, string> = {
  success: 'text-emerald-400',
  error: 'text-rose-400',
  info: 'text-sky-400',
  warning: 'text-amber-400',
};

function ToastCard({ item }: { item: ToastItem }) {
  const [entered, setEntered] = useState(false);
  const Icon = KIND_ICON[item.kind];

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      data-toast
      data-toast-kind={item.kind}
      data-toast-message={item.message}
      role="status"
      className="pointer-events-auto flex max-w-sm items-start gap-2 rounded-xl border border-white/10 bg-[#18181C]/95 px-3 py-2.5 shadow-xl shadow-black/40 backdrop-blur-xl"
      style={{
        transform: entered ? 'translateY(0)' : 'translateY(8px)',
        opacity: entered ? 1 : 0,
        transition: 'opacity 120ms ease, transform 120ms ease',
      }}
    >
      <Icon size={14} className={`mt-0.5 shrink-0 ${KIND_STYLE[item.kind]}`} />
      <span className="min-w-0 text-xs leading-5 text-slate-200">{item.message}</span>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => dismissToast(item.id)}
        className="ml-1 shrink-0 text-slate-500 hover:text-slate-200"
      >
        <X size={12} />
      </button>
    </div>
  );
}

export default function ToastHost() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts);

  return (
    <div
      data-toast-host
      className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-2"
    >
      {toasts.map((item) => (
        <ToastCard key={item.id} item={item} />
      ))}
    </div>
  );
}
