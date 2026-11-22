export type ToastTone = 'info' | 'success' | 'warning' | 'danger';

export interface ToastData {
  id: number;
  message: string;
  tone: ToastTone;
  /** Set once it is on its way out: it plays its exit, then `remove` drops it. */
  leaving?: true;
}

export interface ToastStore {
  /** Every toast on screen, oldest first, the ones leaving included. */
  snapshot(): readonly ToastData[];
  subscribe(listener: () => void): () => void;
  push(message: string, tone?: ToastTone): number;
  /** Sends a toast on its way out. */
  dismiss(id: number): void;
  /** Drops a toast once its exit has played. */
  remove(id: number): void;
}

/** Most toasts on screen at once; a new one sends the oldest out. */
export const MAX_TOASTS = 4;

export function createToastStore(): ToastStore {
  const listeners = new Set<() => void>();
  let items: readonly ToastData[] = [];
  let nextId = 1;

  const set = (next: readonly ToastData[]) => {
    items = next;
    for (const listener of listeners) listener();
  };

  return {
    snapshot: () => items,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    push(message, tone = 'info') {
      const id = nextId++;
      const live = items.filter((t) => !t.leaving);
      const old = new Set(
        live.slice(0, Math.max(0, live.length - MAX_TOASTS + 1)).map((t) => t.id),
      );
      set([
        ...items.map((t): ToastData => (old.has(t.id) ? { ...t, leaving: true } : t)),
        { id, message, tone },
      ]);
      return id;
    },
    dismiss(id) {
      if (items.some((t) => t.id === id && !t.leaving))
        set(items.map((t): ToastData => (t.id === id ? { ...t, leaving: true } : t)));
    },
    remove(id) {
      if (items.some((t) => t.id === id)) set(items.filter((t) => t.id !== id));
    },
  };
}

export const toasts = createToastStore();

/** Shows a short message under the HUD at the top right; `<ToastRegion />` must be mounted. */
export const toast = (message: string, tone?: ToastTone) => toasts.push(message, tone);
