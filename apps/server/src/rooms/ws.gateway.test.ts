/** The client transport against the real app: plain WebSocket + JSON on /ws. */
import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { defineManifest, type GameManifest } from '@xomdao/sdk';
import { PROTOCOL_MISMATCH, PROTOCOL_VERSION, type RoomState } from '@xomdao/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { AppModule } from '../app.module.js';
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

let app: INestApplication;
let url: string;

beforeAll(async () => {
  delete process.env.DATABASE_URL;
  app = await NestFactory.create(AppModule, { logger: false });
  // No Game is loaded yet: the server runs this one for the test.
  app.get<GameManifest[]>(GAME_MANIFESTS).push(caro);
  await app.listen(0, '127.0.0.1');
  url = (await app.getUrl()).replace('http', 'ws');
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

    const created = await lan.request('room:create', { gameId: 'tic-tac-toe' });
    const code = created.roomCode as string;
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);
    const joined = await minh.request('room:join', { roomCode: ` ${code.toLowerCase()}` });
    expect(joined).toMatchObject({ ok: true, roomCode: code });
    expect(await lan.request('match:start')).toEqual({
      ok: false,
      error: 'Chờ mọi người sẵn sàng đã',
    });
    expect(await minh.request('room:ready', { ready: true })).toEqual({ ok: true });
    const started = await lan.request('match:start');
    expect(started).toEqual({ ok: true, matchId: expect.any(String) });
    await settle();
    const me = (b.user as { id: string }).id;
    expect(minh.states().at(-1)).toMatchObject({
      code,
      status: 'playing',
      matchId: started.matchId,
      seats: [{ name: 'Lan' }, { id: me }],
    });

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
    const room = await lan.request('room:create', { gameId: 'tic-tac-toe' });
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
