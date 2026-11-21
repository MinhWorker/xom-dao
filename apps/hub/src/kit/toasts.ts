export interface ToastData {
  id: number;
  message: string;
  tone: 'info' | 'danger';
}

export interface ToastStore {
  snapshot(): readonly ToastData[];
  subscribe(listener: () => void): () => void;
  push(message: string, tone?: ToastData['tone']): number;
  dismiss(id: number): void;
}

/** Most toasts on screen at once; a new one pushes the oldest out. */
export const MAX_TOASTS = 3;

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
      set([...items, { id, message, tone }].slice(-MAX_TOASTS));
      return id;
    },
    dismiss(id) {
      if (items.some((t) => t.id === id)) set(items.filter((t) => t.id !== id));
    },
  };
}

export const toasts = createToastStore();

/** Shows a short message at the bottom of the screen; `<ToastRegion />` must be mounted. */
export const toast = (message: string, tone?: ToastData['tone']) => toasts.push(message, tone);
