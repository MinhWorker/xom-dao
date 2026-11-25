import { PROTOCOL_MISMATCH, PROTOCOL_VERSION } from '@xomdao/shared/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore, type SocketLike, type StoreDeps } from './store.js';

const user = {
  id: 'u1',
  username: 'minh',
  name: 'Minh',
  avatar: 'boy',
  frame: 'gold',
};

const lan = {
  id: 'u2',
  username: 'lan',
  name: 'Lan',
  avatar: 'girl',
  frame: 'gold',
  state: 'friend',
  online: true,
  unread: 0,
};

const roomState = {
  code: 'ABCD',
  gameId: 'caro',
  hostId: 'u1',
  seats: [{ id: 'u1', name: 'Minh', connected: true }, null],
  watchers: [],
  options: {},
  status: 'waiting',
  matchId: null,
};

class FakeSocket implements SocketLike {
  sent: { id: number; event: string; data?: unknown }[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  closed = false;
  constructor(readonly url: string) {}
  send(text: string) {
    this.sent.push(JSON.parse(text));
  }
  close() {
    this.closed = true;
  }
  open() {
    this.onopen?.();
  }
  /** Answers the latest request named `event`. */
  reply(event: string, ack: Record<string, unknown>) {
    const request = this.sent.findLast((m) => m.event === event);
    if (!request) throw new Error(`no ${event} request`);
    this.onmessage?.({ data: JSON.stringify({ id: request.id, ack }) });
  }
  push(event: string, data: unknown) {
    this.onmessage?.({ data: JSON.stringify({ event, data }) });
  }
  drop() {
    this.onclose?.();
  }
}

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    get length() {
      return map.size;
    },
  };
}

let sockets: FakeSocket[];
let fetchMock: ReturnType<typeof vi.fn>;
let deps: StoreDeps;
const lastSocket = () => sockets.at(-1) as FakeSocket;
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  sockets = [];
  fetchMock = vi.fn(
    async () => new Response(JSON.stringify({ token: 't1', user }), { status: 200 }),
  );
  deps = {
    serverUrl: 'http://srv',
    openSocket: (url) => {
      const s = new FakeSocket(url);
      sockets.push(s);
      return s;
    },
    fetch: fetchMock as unknown as typeof fetch,
    storage: memoryStorage(),
    reconnectMs: 1000,
  };
});

afterEach(() => {
  vi.useRealTimers();
});

/** Logs in and answers the socket's login and resume. */
async function online(room: unknown = null) {
  const store = createStore(deps);
  const done = store.login('minh', 'secret');
  await flush();
  lastSocket().open();
  lastSocket().reply('auth:token', { ok: true, token: 't1', user });
  await flush();
  lastSocket().reply('session:resume', {
    ok: true,
    user,
    room: room && { roomCode: 'ABCD', playerId: 'u1' },
    balances: {},
  });
  await done;
  return store;
}

describe('store', () => {
  it('logs in over HTTP, then on the socket, and resumes the session', async () => {
    const store = await online();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://srv/api/auth/login',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(lastSocket().url).toBe('ws://srv/ws');
    expect(lastSocket().sent[0]).toMatchObject({
      event: 'auth:token',
      data: { token: 't1', protocol: PROTOCOL_VERSION },
    });
    expect(store.getState()).toMatchObject({ phase: 'online', user: { name: 'Minh' } });
    expect(deps.storage.getItem('xomdao:token')).toBe('t1');
  });

  it('shows a refused login and stays signed out', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Sai mật khẩu' }), { status: 400 }),
    );
    const store = createStore(deps);
    await expect(store.login('minh', 'bad')).rejects.toThrow('Sai mật khẩu');
    expect(store.getState().phase).toBe('signed-out');
    expect(sockets).toHaveLength(0);
  });

  it('reconnects with a saved token on start', async () => {
    deps.storage.setItem('xomdao:token', 't1');
    const store = createStore(deps);
    store.start();
    expect(store.getState().phase).toBe('connecting');
    lastSocket().open();
    expect(lastSocket().sent[0]).toMatchObject({ event: 'auth:token', data: { token: 't1' } });
  });

  it('starts signed out without a token', () => {
    const store = createStore(deps);
    store.start();
    expect(store.getState().phase).toBe('signed-out');
    expect(sockets).toHaveLength(0);
  });

  it('forgets a token the server no longer takes', async () => {
    deps.storage.setItem('xomdao:token', 'old');
    const store = createStore(deps);
    store.start();
    lastSocket().open();
    lastSocket().reply('auth:token', { ok: false, error: 'unauthorized' });
    await flush();
    expect(store.getState().phase).toBe('signed-out');
    expect(deps.storage.getItem('xomdao:token')).toBeNull();
  });

  it('asks for a reload when the server speaks another protocol', async () => {
    deps.storage.setItem('xomdao:token', 't1');
    const store = createStore(deps);
    store.start();
    lastSocket().open();
    lastSocket().reply('auth:token', { ok: false, error: PROTOCOL_MISMATCH });
    await flush();
    expect(store.getState().phase).toBe('outdated');
    expect(deps.storage.getItem('xomdao:token')).toBe('t1');
  });

  it('drops the socket and retries when the session cannot resume', async () => {
    deps.storage.setItem('xomdao:token', 't1');
    const store = createStore(deps);
    store.start();
    const first = lastSocket();
    first.open();
    first.reply('auth:token', { ok: true, token: 't1', user });
    await flush();
    first.reply('session:resume', { ok: false, error: 'Server gặp lỗi, thử lại sau' });
    await flush();
    expect(first.closed).toBe(true);
    expect(store.getState().phase).toBe('offline');
  });

  it('lists the Game ids the server runs, or null when it cannot tell', async () => {
    const store = createStore(deps);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(['caro'])));
    await expect(store.gameIds()).resolves.toEqual(['caro']);
    expect(fetchMock).toHaveBeenLastCalledWith('http://srv/api/games');
    fetchMock.mockRejectedValueOnce(new Error('down'));
    await expect(store.gameIds()).resolves.toBeNull();
  });

  it('keeps the Room the server pushes and ignores malformed pushes', async () => {
    const store = await online();
    lastSocket().push('room:state', roomState);
    expect(store.getState().room).toMatchObject({ code: 'ABCD', status: 'waiting' });
    lastSocket().push('room:state', { code: 1 });
    expect(store.getState().room?.code).toBe('ABCD');
  });

  it('keeps the Match state and its result, and clears them when the Room closes', async () => {
    const store = await online();
    lastSocket().push('room:state', { ...roomState, status: 'playing', matchId: 'm1' });
    lastSocket().push('match:state', {
      roomCode: 'ABCD',
      matchId: 'm1',
      gameId: 'caro',
      status: 'playing',
      disconnectedPlayerIds: [],
      timer: null,
      view: { cells: [] },
    });
    expect(store.getState().match).toMatchObject({ matchId: 'm1', view: { cells: [] } });
    lastSocket().push('match:result', {
      roomCode: 'ABCD',
      matchId: 'm1',
      gameId: 'caro',
      seats: [{ player: 'u1', place: 1 }],
    });
    expect(store.getState().result?.seats[0]?.place).toBe(1);

    lastSocket().push('room:closed', { gameId: 'caro', reason: 'Phòng đã giải tán' });
    expect(store.getState()).toMatchObject({
      room: null,
      match: null,
      result: null,
      closed: 'Phòng đã giải tán',
    });
  });

  it('forgets why the last Room closed once we ask for another', async () => {
    const store = await online();
    lastSocket().push('room:closed', { gameId: 'caro', reason: 'Phòng đã giải tán' });
    void store.request('room:join', { roomCode: 'WXYZ' }).catch(() => {});
    expect(store.getState().closed).toBeNull();
  });

  it('a new Match clears the last result', async () => {
    const store = await online();
    lastSocket().push('match:result', {
      roomCode: 'ABCD',
      matchId: 'm1',
      gameId: 'caro',
      seats: [],
    });
    lastSocket().push('match:state', {
      roomCode: 'ABCD',
      matchId: 'm2',
      gameId: 'caro',
      status: 'loading',
      disconnectedPlayerIds: [],
      timer: null,
    });
    expect(store.getState().result).toBeNull();
  });

  it('resolves a request with its reply and rejects with the server error', async () => {
    const store = await online();
    const created = store.request('room:create', { gameId: 'caro', version: 'v1' });
    lastSocket().reply('room:create', { ok: true, roomCode: 'ABCD', playerId: 'u1' });
    await expect(created).resolves.toEqual({ roomCode: 'ABCD', playerId: 'u1' });

    const joined = store.request('room:join', { roomCode: 'ZZZZ' });
    lastSocket().reply('room:join', { ok: false, error: 'Không tìm thấy phòng' });
    await expect(joined).rejects.toThrow('Không tìm thấy phòng');
  });

  it('forgets the Room once the server lets us leave it', async () => {
    const store = await online();
    lastSocket().push('room:state', roomState);
    const left = store.leaveRoom();
    expect(store.getState().room?.code).toBe('ABCD');
    lastSocket().reply('room:leave', { ok: true });
    await left;
    expect(store.getState()).toMatchObject({ room: null, match: null, result: null });
  });

  it('refuses requests while offline', async () => {
    const store = await online();
    lastSocket().drop();
    await expect(store.request('room:leave', {})).rejects.toThrow('Mất kết nối');
  });

  it('reconnects after a drop and counts the new connection', async () => {
    const store = await online();
    vi.useFakeTimers();
    const first = store.getState().connection;
    const pending = store.request('room:leave', {});
    lastSocket().drop();
    await expect(pending).rejects.toThrow('Mất kết nối');
    expect(store.getState().phase).toBe('offline');

    vi.advanceTimersByTime(1000);
    expect(sockets).toHaveLength(2);
    lastSocket().open();
    lastSocket().reply('auth:token', { ok: true, token: 't1', user });
    await vi.runAllTimersAsync();
    lastSocket().reply('session:resume', { ok: true, user, room: null, balances: {} });
    await vi.runAllTimersAsync();
    expect(store.getState().phase).toBe('online');
    expect(store.getState().connection).toBe(first + 1);
  });

  it('logs out: closes the socket, forgets the token and the Room', async () => {
    const store = await online();
    lastSocket().push('room:state', roomState);
    const socket = lastSocket();
    store.logout();
    expect(socket.closed).toBe(true);
    expect(store.getState()).toMatchObject({ phase: 'signed-out', user: null, room: null });
    expect(deps.storage.getItem('xomdao:token')).toBeNull();
  });

  it("loads Bạn bè after login and follows the server's pushes and replies", async () => {
    const store = await online();
    lastSocket().reply('friends:list', { ok: true, friends: [lan] });
    await flush();
    expect(store.getState().friends).toMatchObject([{ id: 'u2', online: true }]);

    lastSocket().push('friends:changed', {
      friends: [{ ...lan, roomCode: 'ABCD', gameId: 'caro' }],
    });
    expect(store.getState().friends[0]).toMatchObject({ roomCode: 'ABCD' });

    const removed = store.request('friends:remove', { userId: 'u2' });
    lastSocket().reply('friends:remove', { ok: true, friends: [] });
    await removed;
    expect(store.getState().friends).toEqual([]);

    lastSocket().push('friends:changed', { friends: [{ ...lan, state: 'bogus' }] });
    expect(store.getState().friends).toEqual([]);
  });

  it('keeps the latest invite until it is dismissed, and logging out clears it', async () => {
    const store = await online();
    const invite = {
      fromId: 'u2',
      fromName: 'Lan',
      avatar: 'girl',
      frame: 'gold',
      roomCode: 'WXYZ',
      gameId: 'caro',
    };
    lastSocket().push('room:invite', invite);
    expect(store.getState().invite).toMatchObject({ roomCode: 'WXYZ' });
    store.dismissInvite();
    expect(store.getState().invite).toBeNull();

    lastSocket().push('room:invite', invite);
    store.logout();
    expect(store.getState()).toMatchObject({ invite: null, friends: [] });
  });
});
