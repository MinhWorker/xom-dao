import { useSyncExternalStore } from 'react';
import { wait } from '../kit/wait.js';
import { createStore, type HubState, type RequestName, type SocketLike } from './store.js';

const store = createStore({
  serverUrl: __SERVER_URL__,
  openSocket: (url) => new WebSocket(url) as unknown as SocketLike,
  fetch: (...args) => fetch(...args),
  storage: localStorage,
  reconnectMs: 2000,
});

/** Requests the player has to wait for: a slow one dims and blocks the screen. */
const BLOCKING = new Set<RequestName>(['room:create', 'room:join', 'match:start']);
/** A Match's own traffic: the Game shows its state, so no badge. */
const SILENT = new Set<RequestName>(['match:move', 'match:ready']);

const request: typeof store.request = (event, data) => {
  const reply = store.request(event, data);
  return SILENT.has(event) ? reply : wait(reply, { block: BLOCKING.has(event) });
};

/** The Hub's one store, for the page; a slow request shows the wait badge. */
export const hub: typeof store = {
  ...store,
  request,
  gameIds: () => wait(store.gameIds()),
  leaveRoom: () => wait(store.leaveRoom()),
};

export function useHub<T>(select: (state: HubState) => T): T {
  return useSyncExternalStore(hub.subscribe, () => select(hub.getState()));
}
