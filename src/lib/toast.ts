export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export type ToastItem = {
  id: string;
  kind: ToastKind;
  message: string;
};

const DEFAULT_DURATION = 3000;

let toasts: ToastItem[] = [];
const subscribers = new Set<() => void>();

function emit() {
  for (const subscriber of subscribers) subscriber();
}

function push(kind: ToastKind, message: string, duration = DEFAULT_DURATION) {
  const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  toasts = [...toasts, { id, kind, message }];
  emit();
  window.setTimeout(() => dismissToast(id), duration);
}

export function dismissToast(id: string) {
  if (!toasts.some((item) => item.id === id)) return;
  toasts = toasts.filter((item) => item.id !== id);
  emit();
}

export const toast = {
  success: (message: string) => push('success', message),
  error: (message: string) => push('error', message),
  info: (message: string) => push('info', message),
  warning: (message: string) => push('warning', message),
};

export function subscribeToasts(subscriber: () => void): () => void {
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}

export function getToasts(): ToastItem[] {
  return toasts;
}
