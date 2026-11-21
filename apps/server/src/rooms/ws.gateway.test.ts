/** The client transport against the real app: plain WebSocket + JSON on /ws. */
import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  defineManifest,
  type EventContext,
  Game,
  type GameManifest,
  type MatchResult,
  type StartContext,
} from '@xomdao/sdk';
import { GAME_UPDATING, PROTOCOL_MISMATCH, PROTOCOL_VERSION, type RoomState } from '@xomdao/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { z } from 'zod';
import { AppModule } from '../app.module.js';
import { DisabledGamesService } from '../game-host/disabled-games.service.js';
import type { HostedGame } from '../game-host/game-host.types.js';
import { GAME_SERVERS } from '../game-host/games.js';
import { GAME_MANIFESTS } from './manifests.js';

const caro = defineManifest({
  id: 'tic-tac-toe',
  name: 'Caro',
  tagline: 'Năm quân liền hàng.',
  minPlayers: 2,
  maxPlayers: 2,
  duration: { min: 5, max: 15 },
  status: 'wip',
  bots: true,
  focus: { x: 50, y: 50 },
});

class CaroServer extends Game<{ turn: number }> {
  readonly events = { finish: z.object({}) };
  readonly previousResults: (MatchResult | null)[] = [];

  onStart(ctx: StartContext) {
    this.previousResults.push(ctx.lastResult);
    return { turn: 0 };
  }

  onFinish(ctx: EventContext<{ turn: number }>) {
    ctx.finish([1, 2]);
    return ctx.state;
  }
}

const CARO_VERSION = 'caro-1';

let app: INestApplication;
let url: string;
let httpUrl: string;
let caroServer: CaroServer;

beforeAll(async () => {
  delete process.env.DATABASE_URL;
  app = await NestFactory.create(AppModule, { logger: false });
  // Run only one fake Game server for the test, in place of the real ones.
  app.get<GameManifest[]>(GAME_MANIFESTS).splice(0, Infinity, caro);
  caroServer = new CaroServer();
  app
    .get<HostedGame[]>(GAME_SERVERS)
    .splice(0, Infinity, { manifest: caro, game: caroServer, version: CARO_VERSION });
  await app.listen(0, '127.0.0.1');
  httpUrl = await app.getUrl();
  url = httpUrl.replace('http', 'ws');
});

afterAll(async () => {
  await app.close();
});

interface Ack {
  ok: boolean;
  [key: string]: unknown;
}

/** A client: numbered requests, and every pushed event kept by name. */
async function connect() {
  const ws = new WebSocket(`${url}/ws`);
  await new Promise((resolve, reject) => ws.once('open', resolve).once('error', reject));
  let next = 0;
  const waiting = new Map<number, (ack: Ack) => void>();
  const pushed: { event: string; data: unknown }[] = [];
  ws.on('message', (raw) => {
    const message = JSON.parse(raw.toString());
    if ('id' in message) waiting.get(message.id)?.(message.ack);
    else pushed.push(message);
  });
  const request = (event: string, data: object = {}) =>
    new Promise<Ack>((resolve) => {
      const id = ++next;
      waiting.set(id, resolve);
      ws.send(JSON.stringify({ id, event, data }));
    });
  const states = () =>
    pushed.filter((m) => m.event === 'room:state').map((m) => m.data as RoomState);
  return { ws, request, pushed, states };
}

const settle = () => new Promise((r) => setTimeout(r, 100));

describe('WebSocket transport', () => {
  it('reports the loaded Game server ids over HTTP', async () => {
    const response = await fetch(`${httpUrl}/api/games`);

    expect(response.ok).toBe(true);
    expect(await response.json()).toEqual(['tic-tac-toe']);
  });

  it('refuses another protocol and requests before logging in', async () => {
    const { ws, request } = await connect();
    expect(await request('auth:guest', { protocol: PROTOCOL_VERSION - 1, name: 'Lan' })).toEqual({
      ok: false,
      error: PROTOCOL_MISMATCH,
      protocol: PROTOCOL_VERSION,
    });
    expect(await request('history:recent')).toEqual({ ok: false, error: 'unauthorized' });
    expect(await request('auth:token', { protocol: PROTOCOL_VERSION, token: 'nope' })).toEqual({
      ok: false,
      error: 'unauthorized',
    });
    ws.close();
  });

  it('lets two guests make a Room, join it by code, start a Match and see the state', async () => {
    const lan = await connect();
    const minh = await connect();
    const a = await lan.request('auth:guest', { protocol: PROTOCOL_VERSION, name: 'Lan' });
    const b = await minh.request('auth:guest', { protocol: PROTOCOL_VERSION, name: 'Minh' });
    expect(a).toMatchObject({ ok: true, user: { name: 'Lan' }, token: expect.any(String) });
    expect(await lan.request('session:resume')).toMatchObject({
      ok: true,
      room: null,
      balances: {},
    });

    const created = await lan.request('room:create', {
      gameId: 'tic-tac-toe',
      version: CARO_VERSION,
    });
    const code = created.roomCode as string;
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);
    const joined = await minh.request('room:join', { roomCode: ` ${code.toLowerCase()}` });
    expect(joined).toMatchObject({ ok: true, roomCode: code });
    expect(await lan.request('match:start', { version: CARO_VERSION })).toEqual({
      ok: false,
      error: 'Chờ mọi người sẵn sàng đã',
    });
    expect(await minh.request('room:ready', { ready: true })).toEqual({ ok: true });
    const started = await lan.request('match:start', { version: CARO_VERSION });
    expect(started).toEqual({ ok: true, matchId: expect.any(String) });
    expect(await lan.request('match:ready', { matchId: started.matchId })).toEqual({ ok: true });
    expect(await minh.request('match:ready', { matchId: started.matchId })).toEqual({ ok: true });
    await settle();
    const lanId = (a.user as { id: string }).id;
    const me = (b.user as { id: string }).id;
    expect(minh.states().at(-1)).toMatchObject({
      code,
      status: 'playing',
      matchId: started.matchId,
      seats: [{ name: 'Lan' }, { id: me }],
    });
    expect(
      minh.pushed
        .filter((message) => message.event === 'match:state')
        .map((message) => (message.data as { status: string }).status),
    ).toEqual(['loading', 'playing']);
    expect(
      (
        minh.pushed.filter((message) => message.event === 'match:state').at(-1)?.data as {
          view: unknown;
        }
      )?.view,
    ).toEqual({ turn: 0 });
    expect(await lan.request('match:move', { matchId: started.matchId, event: 'finish' })).toEqual({
      ok: true,
    });
    await settle();
    expect(
      minh.pushed
        .filter((message) => message.event === 'match:state')
        .map((message) => (message.data as { status: string }).status),
    ).toEqual(['loading', 'playing', 'over']);
    expect(
      (
        minh.pushed.filter((message) => message.event === 'match:state').at(-1)?.data as {
          outcome: string;
        }
      )?.outcome,
    ).toBe('settled');
    expect(
      (
        minh.pushed.filter((message) => message.event === 'match:state').at(-1)?.data as {
          result: { seats: { player: string; place: number }[] };
        }
      )?.result.seats,
    ).toEqual([
      { player: lanId, place: 1 },
      { player: me, place: 2 },
    ]);
    expect(minh.pushed.filter((message) => message.event === 'match:result')).toEqual([
      {
        event: 'match:result',
        data: {
          roomCode: code,
          matchId: started.matchId,
          gameId: caro.id,
          seats: [
            { player: lanId, place: 1 },
            { player: me, place: 2 },
          ],
        },
      },
    ]);
    expect((await minh.request('history:recent')).matches).toMatchObject([
      { id: started.matchId, outcome: 'loss' },
    ]);
    expect(caroServer.previousResults).toHaveLength(1);
    expect(caroServer.previousResults[0]).toBeNull();

    const rematch = await lan.request('match:start', { version: CARO_VERSION });
    const rematchId = rematch.matchId as string;
    await lan.request('match:ready', { matchId: rematchId });
    await minh.request('match:ready', { matchId: rematchId });
    await settle();
    expect(caroServer.previousResults.at(-1)).toMatchObject({
      seats: [
        { player: lanId, place: 1 },
        { player: me, place: 2 },
      ],
    });
    await lan.request('match:move', { matchId: rematchId, event: 'finish' });
    await settle();

    // Logging in again with the token puts the guest back in the Room.
    lan.ws.close();
    await settle();
    expect(minh.states().at(-1)?.seats[0]).toMatchObject({ name: 'Lan', connected: false });
    const back = await connect();
    const token = a.token as string;
    expect(await back.request('auth:token', { protocol: PROTOCOL_VERSION, token })).toMatchObject({
      ok: true,
      user: { name: 'Lan' },
    });
    expect(await back.request('session:resume')).toMatchObject({ room: { roomCode: code } });
    expect(await back.request('room:leave')).toEqual({ ok: true });
    await settle();
    expect(minh.states().at(-1)).toMatchObject({ hostId: me, seats: [null, { id: me }] });
    back.ws.close();
    minh.ws.close();
  });

  it('aborts a running Match when a player leaves a Game without a leave hook', async () => {
    const lan = await connect();
    const minh = await connect();
    await lan.request('auth:guest', { protocol: PROTOCOL_VERSION, name: 'Lan' });
    await minh.request('auth:guest', { protocol: PROTOCOL_VERSION, name: 'Minh' });

    const created = await lan.request('room:create', {
      gameId: 'tic-tac-toe',
      version: CARO_VERSION,
    });
    const code = created.roomCode as string;
    await minh.request('room:join', { roomCode: code });
    await minh.request('room:ready', { ready: true });
    const started = await lan.request('match:start', { version: CARO_VERSION });
    const matchId = started.matchId as string;
    await lan.request('match:ready', { matchId });
    await minh.request('match:ready', { matchId });
    await settle();

    expect(await lan.request('room:leave')).toEqual({ ok: true });
    await settle();

    const states = minh.pushed
      .filter((message) => message.event === 'match:state')
      .map((message) => message.data as { status: string; outcome?: string });
    expect(states.map(({ status }) => status)).toEqual(['loading', 'playing', 'over']);
    expect(states.at(-1)).toMatchObject({ status: 'over', outcome: 'aborted' });
    expect(minh.states().at(-1)).toMatchObject({ code, status: 'waiting', matchId: null });

    lan.ws.close();
    minh.ws.close();
  });

  it('replays the viewer Game snapshot when a player resumes during a Match', async () => {
    const lan = await connect();
    const minh = await connect();
    const account = await lan.request('auth:guest', {
      protocol: PROTOCOL_VERSION,
      name: 'Lan',
    });
    await minh.request('auth:guest', { protocol: PROTOCOL_VERSION, name: 'Minh' });

    const created = await lan.request('room:create', {
      gameId: 'tic-tac-toe',
      version: CARO_VERSION,
    });
    await minh.request('room:join', { roomCode: created.roomCode as string });
    await minh.request('room:ready', { ready: true });
    const started = await lan.request('match:start', { version: CARO_VERSION });
    const matchId = started.matchId as string;
    await lan.request('match:ready', { matchId });
    await minh.request('match:ready', { matchId });
    await settle();

    lan.ws.close();
    await settle();
    const back = await connect();
    await back.request('auth:token', {
      protocol: PROTOCOL_VERSION,
      token: account.token as string,
    });
    expect(await back.request('session:resume')).toMatchObject({
      room: { roomCode: created.roomCode },
    });
    await settle();

    const matchState = back.pushed
      .filter((message) => message.event === 'match:state')
      .at(-1)?.data;
    await minh.request('match:move', { matchId, event: 'finish' });
    await settle();
    back.ws.close();
    minh.ws.close();

    expect(matchState).toMatchObject({
      matchId,
      status: 'playing',
      view: { turn: 0 },
    });
  });

  it('refuses a Hub built against another version of the Game server', async () => {
    const lan = await connect();
    const minh = await connect();
    await lan.request('auth:guest', { protocol: PROTOCOL_VERSION, name: 'Lan' });
    await minh.request('auth:guest', { protocol: PROTOCOL_VERSION, name: 'Minh' });

    expect(await lan.request('room:create', { gameId: 'tic-tac-toe', version: 'old' })).toEqual({
      ok: false,
      error: GAME_UPDATING,
    });
    const created = await lan.request('room:create', {
      gameId: 'tic-tac-toe',
      version: CARO_VERSION,
    });
    await minh.request('room:join', { roomCode: created.roomCode as string });
    await minh.request('room:ready', { ready: true });

    expect(await lan.request('match:start', { version: 'old' })).toEqual({
      ok: false,
      error: GAME_UPDATING,
    });
    lan.ws.close();
    minh.ws.close();
  });

  it('takes a disabled Game out of the lobby and opens no Room for it', async () => {
    const games = app.get(DisabledGamesService);
    const lan = await connect();
    await lan.request('auth:guest', { protocol: PROTOCOL_VERSION, name: 'Lan' });

    await games.disable('tic-tac-toe');
    const listed = await (await fetch(`${httpUrl}/api/games`)).json();
    const refused = await lan.request('room:create', {
      gameId: 'tic-tac-toe',
      version: CARO_VERSION,
    });
    await games.enable('tic-tac-toe');
    lan.ws.close();

    expect(listed).toEqual([]);
    expect(refused).toEqual({ ok: false, error: 'Game đang tạm đóng' });
  });

  it('holds the seat of a player who drops mid-Match', async () => {
    const lan = await connect();
    const minh = await connect();
    const account = await lan.request('auth:guest', { protocol: PROTOCOL_VERSION, name: 'Lan' });
    await minh.request('auth:guest', { protocol: PROTOCOL_VERSION, name: 'Minh' });
    const lanId = (account.user as { id: string }).id;
    const created = await lan.request('room:create', {
      gameId: 'tic-tac-toe',
      version: CARO_VERSION,
    });
    await minh.request('room:join', { roomCode: created.roomCode as string });
    await minh.request('room:ready', { ready: true });
    const { matchId } = await lan.request('match:start', { version: CARO_VERSION });
    await lan.request('match:ready', { matchId });
    await minh.request('match:ready', { matchId });
    await settle();

    lan.ws.close();
    await settle();
    const matchStates = () =>
      minh.pushed
        .filter((message) => message.event === 'match:state')
        .map((message) => message.data as { status: string; disconnectedPlayerIds: string[] });
    expect(matchStates().at(-1)).toMatchObject({
      status: 'playing',
      disconnectedPlayerIds: [lanId],
    });
    const back = await connect();
    await back.request('auth:token', {
      protocol: PROTOCOL_VERSION,
      token: account.token as string,
    });
    await back.request('session:resume');
    await settle();
    expect(matchStates().at(-1)).toMatchObject({ status: 'playing', disconnectedPlayerIds: [] });

    await minh.request('match:move', { matchId, event: 'finish' });
    back.ws.close();
    minh.ws.close();
  });

  it('answers unknown events without closing', async () => {
    const { ws, request } = await connect();
    await request('auth:guest', { protocol: PROTOCOL_VERSION, name: 'Hoa' });
    expect(await request('room:fly')).toEqual({ ok: false, error: 'Không có lệnh room:fly' });
    expect(await request('history:recent')).toEqual({ ok: true, matches: [] });
    ws.close();
  });
});

describe('Bạn bè over the socket', () => {
  it('asks, accepts, chats and invites, pushing each change to the other side', async () => {
    const lan = await connect();
    const minh = await connect();
    const a = await lan.request('auth:guest', { protocol: PROTOCOL_VERSION, name: 'Lan' });
    const b = await minh.request('auth:guest', { protocol: PROTOCOL_VERSION, name: 'Minh' });
    const lanUser = a.user as { id: string; username: string };
    const minhUser = b.user as { id: string; username: string };
    expect(await lan.request('friends:add', { username: minhUser.username })).toMatchObject({
      ok: true,
      friends: [{ id: minhUser.id, state: 'outgoing' }],
    });
    await settle();
    const asked = minh.pushed.filter((m) => m.event === 'friends:changed').at(-1);
    expect(asked?.data).toMatchObject({ friends: [{ id: lanUser.id, state: 'incoming' }] });
    expect(
      await minh.request('friends:answer', { userId: lanUser.id, accept: true }),
    ).toMatchObject({ friends: [{ id: lanUser.id, state: 'friend', online: true }] });

    const sent = await lan.request('chat:send', { userId: minhUser.id, text: 'Chơi không?' });
    expect(sent).toMatchObject({ ok: true, message: { text: 'Chơi không?' } });
    await settle();
    expect(minh.pushed.some((m) => m.event === 'chat:message')).toBe(true);
    expect(await minh.request('chat:history', { userId: lanUser.id })).toMatchObject({
      messages: [{ from: lanUser.id, text: 'Chơi không?' }],
    });

    expect(await lan.request('friends:invite', { userId: minhUser.id })).toMatchObject({
      ok: false,
      error: 'Bạn chưa ở trong phòng nào',
    });
    const room = await lan.request('room:create', { gameId: 'tic-tac-toe', version: CARO_VERSION });
    expect(await lan.request('friends:invite', { userId: minhUser.id })).toEqual({ ok: true });
    await settle();
    const invite = minh.pushed.find((m) => m.event === 'room:invite');
    expect(invite?.data).toMatchObject({ fromId: lanUser.id, roomCode: room.roomCode });
    // Lan going into a room reaches Minh's list a moment later.
    await new Promise((r) => setTimeout(r, 400));
    const moved = minh.pushed.filter((m) => m.event === 'friends:changed').at(-1);
    expect(moved?.data).toMatchObject({
      friends: [{ id: lanUser.id, gameId: 'tic-tac-toe', roomCode: room.roomCode }],
    });
    lan.ws.close();
    minh.ws.close();
  });
});
