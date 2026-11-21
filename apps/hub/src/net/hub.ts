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
