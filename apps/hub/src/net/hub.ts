import { useSyncExternalStore } from 'react';
import { createStore, type HubState, type SocketLike } from './store.js';

/** The Hub's one store, for the page. */
export const hub = createStore({
  serverUrl: __SERVER_URL__,
  openSocket: (url) => new WebSocket(url) as unknown as SocketLike,
  fetch: (...args) => fetch(...args),
  storage: localStorage,
  reconnectMs: 2000,
});

export function useHub<T>(select: (state: HubState) => T): T {
  return useSyncExternalStore(hub.subscribe, () => select(hub.getState()));
}

/** The Game ids the server runs (`/api/games`); `null` until known or when unreachable. */
export async function serverGameIds(): Promise<string[] | null> {
  try {
    const res = await fetch(`${__SERVER_URL__}/api/games`);
    if (!res.ok) return null;
    const data: unknown = await res.json();
    return Array.isArray(data) ? data.map(String) : null;
  } catch {
    return null;
  }
}
