import {
  AuthReply,
  events,
  type Friend,
  type MatchResultNotice,
  PROTOCOL_MISMATCH,
  PROTOCOL_VERSION,
  type RegisterRequest,
  type RoomInvite,
  type RoomState,
  requests,
  SessionInfo,
  type User,
} from '@xomdao/shared/client';
import type { z } from 'zod';

/** The part of `WebSocket` the store uses, so tests can hand it a fake. */
export interface SocketLike {
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  send(text: string): void;
  close(): void;
}

export interface StoreDeps {
  /** Where the server is (`https://…`); `''` is this page's origin. */
  serverUrl: string;
  openSocket(url: string): SocketLike;
  fetch: typeof fetch;
  storage: Storage;
  reconnectMs: number;
}

export type MatchStateEvent = z.output<(typeof events)['match:state']>;

export type Phase = 'signed-out' | 'connecting' | 'online' | 'offline' | 'outdated';

export interface HubState {
  phase: Phase;
  user: User | null;
  room: RoomState | null;
  match: MatchStateEvent | null;
  result: MatchResultNotice | null;
  /** Why the Room was closed on us, until the next Room. */
  closed: string | null;
  /** Bạn bè: friends and requests, as the server last told. */
  friends: Friend[];
  /** The latest invite to a friend's Room, until it is answered. */
  invite: RoomInvite | null;
  /** Counts logins on the socket: a new one means the Game needs a fresh `init`. */
  connection: number;
}

type Requests = typeof requests;
export type RequestName = keyof Requests;
type Req<E extends RequestName> = z.input<Requests[E]['req']>;
type Res<E extends RequestName> = z.output<Requests[E]['res']>;

/** A refused request or login; `message` is Vietnamese, ready to show. */
export class HubError extends Error {
  /** `offline`: it never reached the server. */
  constructor(
    message: string,
    readonly offline = false,
  ) {
    super(message);
  }
}

export const OFFLINE = 'Mất kết nối, đang kết nối lại';
const TOKEN_KEY = 'xomdao:token';

const signedOut: HubState = {
  phase: 'signed-out',
  user: null,
  room: null,
  match: null,
  result: null,
  closed: null,
  friends: [],
  invite: null,
  connection: 0,
};

export type Store = ReturnType<typeof createStore>;

/**
 * Holds the Hub's only socket (`/ws`) and the Session state it receives. Every push and reply
 * goes through the zod schemas of `@xomdao/shared` first; anything else is dropped.
 */
export function createStore(deps: StoreDeps) {
  let state: HubState = signedOut;
  const listeners = new Set<() => void>();
  const pending = new Map<
    number,
    { resolve(ack: Record<string, unknown>): void; reject(e: Error): void }
  >();
  let socket: SocketLike | null = null;
  let nextId = 0;
  let retry: ReturnType<typeof setTimeout> | undefined;

  const set = (patch: Partial<HubState>) => {
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  };

  const token = () => {
    try {
      return deps.storage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  };
  const saveToken = (value: string | null) => {
    try {
      if (value) deps.storage.setItem(TOKEN_KEY, value);
      else deps.storage.removeItem(TOKEN_KEY);
    } catch {}
  };

  const failPending = () => {
    for (const request of pending.values()) request.reject(new HubError(OFFLINE, true));
    pending.clear();
  };

  function raw(event: string, data: unknown): Promise<Record<string, unknown>> {
    const ws = socket;
    if (
      !ws ||
      (state.phase !== 'online' && !event.startsWith('auth:') && event !== 'session:resume')
    )
      return Promise.reject(new HubError(OFFLINE, true));
    return new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, event, data }));
    });
  }

  function onPush(event: string, data: unknown) {
    if (!(event in events)) return;
    const parsed = events[event as keyof typeof events].safeParse(data);
    if (!parsed.success) {
      console.warn(`Dropped a malformed ${event}`, parsed.error.issues);
      return;
    }
    (pushes[event as keyof typeof events] as ((data: unknown) => void) | undefined)?.(parsed.data);
  }

  const pushes: { [E in keyof typeof events]?: (data: z.output<(typeof events)[E]>) => void } = {
    'room:state': (room) => set({ room, closed: null }),
    'match:state': (match) => {
      const fresh = match.matchId !== state.match?.matchId;
      set({ match, ...(fresh && { result: null }) });
    },
    'match:result': (result) => set({ result }),
    'room:closed': ({ reason }) => set({ room: null, match: null, result: null, closed: reason }),
    'friends:changed': ({ friends }) => set({ friends }),
    'room:invite': (invite) => set({ invite }),
  };

  function connect() {
    const saved = token();
    if (!saved) {
      set(signedOut);
      return;
    }
    clearTimeout(retry);
    const base = deps.serverUrl || location.origin;
    const ws = deps.openSocket(`${base.replace(/^http/, 'ws')}/ws`);
    socket = ws;
    set({ phase: state.phase === 'offline' ? 'offline' : 'connecting' });

    ws.onmessage = ({ data }) => {
      let message: { id?: number; ack?: Record<string, unknown>; event?: string; data?: unknown };
      try {
        message = JSON.parse(String(data));
      } catch {
        return;
      }
      if (typeof message.id === 'number' && message.ack) {
        const request = pending.get(message.id);
        pending.delete(message.id);
        request?.resolve(message.ack);
      } else if (typeof message.event === 'string') onPush(message.event, message.data);
    };
    ws.onclose = () => dropped(ws);
    ws.onopen = () => void login(ws, saved);
  }

  /** The socket is gone: fail what waits on it and try again later. */
  function dropped(ws: SocketLike) {
    if (socket !== ws) return;
    socket = null;
    failPending();
    if (state.phase === 'signed-out' || state.phase === 'outdated') return;
    set({ phase: 'offline' });
    retry = setTimeout(connect, deps.reconnectMs);
  }

  async function login(ws: SocketLike, saved: string) {
    try {
      const ack = await raw('auth:token', { token: saved, protocol: PROTOCOL_VERSION });
      if (!ack.ok) {
        if (ack.error === PROTOCOL_MISMATCH) {
          set({ phase: 'outdated' });
        } else {
          saveToken(null);
          set(signedOut);
        }
        socket = null;
        ws.close();
        return;
      }
      AuthReply.parse(ack);
      const resumed = await raw('session:resume', {});
      if (!resumed.ok) throw new HubError(String(resumed.error));
      const info = SessionInfo.parse(resumed);
      set({
        phase: 'online',
        user: info.user,
        connection: state.connection + 1,
        ...(!info.room && { room: null, match: null }),
      });
      void request('friends:list', {}).catch(() => {});
    } catch {
      dropped(ws);
      ws.close();
    }
  }

  async function auth(path: 'login' | 'register', body: object) {
    let res: Response;
    try {
      res = await deps.fetch(`${deps.serverUrl}/api/auth/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      throw new HubError('Không kết nối được máy chủ');
    }
    const data = (await res.json().catch(() => ({}))) as { message?: unknown };
    if (!res.ok) {
      throw new HubError(typeof data.message === 'string' ? data.message : 'Máy chủ gặp lỗi');
    }
    const reply = AuthReply.parse(data);
    saveToken(reply.token);
    set({ user: reply.user });
    connect();
  }

  async function request<E extends RequestName>(event: E, data: Req<E>): Promise<Res<E>> {
    if (event === 'room:join' || event === 'room:create') set({ closed: null });
    const ack = await raw(String(event), data);
    if (!ack.ok) throw new HubError(String(ack.error ?? 'Máy chủ gặp lỗi'));
    const { ok: _ok, ...rest } = ack;
    const reply = requests[event].res.parse(rest) as Res<E>;
    if (event.startsWith('friends:') && 'friends' in reply) set({ friends: reply.friends });
    if (event === 'profile:update' && 'user' in reply) set({ user: reply.user });
    return reply;
  }

  return {
    getState: () => state,
    /** Asks the server; resolves with the reply's data, rejects with its error (`HubError`). */
    request,
    /** The Game ids the server runs (`/api/games`); `null` when it cannot tell. */
    async gameIds(): Promise<string[] | null> {
      try {
        const res = await deps.fetch(`${deps.serverUrl}/api/games`);
        const data: unknown = res.ok ? await res.json() : null;
        return Array.isArray(data) ? data.map(String) : null;
      } catch {
        return null;
      }
    },
    /** The server sends no `room:state` to whoever leaves, so the store forgets the Room. */
    async leaveRoom() {
      await request('room:leave', {});
      set({ room: null, match: null, result: null });
    },
    /** Forgets the invite: it was answered or turned down. */
    dismissInvite: () => set({ invite: null }),
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** Connects with the saved token, if any. */
    start: connect,
    login: (username: string, password: string) => auth('login', { username, password }),
    register: (body: RegisterRequest) => auth('register', body),
    logout() {
      const t = token();
      saveToken(null);
      clearTimeout(retry);
      const ws = socket;
      socket = null;
      failPending();
      ws?.close();
      set(signedOut);
      if (t) {
        void deps
          .fetch(`${deps.serverUrl}/api/auth/logout`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${t}` },
          })
          .catch(() => {});
      }
    },
  };
}
