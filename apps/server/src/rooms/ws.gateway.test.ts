/** The client transport against the real app: plain WebSocket + JSON on /ws. */
import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PROTOCOL_MISMATCH, PROTOCOL_VERSION, type RoomSnapshot } from '@xomdao/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { AppModule } from '../app.module.js';
import { MailService } from '../mail/mail.service.js';

let app: INestApplication;
let url: string;

beforeAll(async () => {
  delete process.env.DATABASE_URL;
  app = await NestFactory.create(AppModule, { logger: false });
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

/** A Godot-like client: numbered requests, and every pushed event kept by name. */
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
    pushed.filter((m) => m.event === 'room:state').map((m) => m.data as RoomSnapshot);
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
    expect(await request('catalog:get')).toEqual({ ok: false, error: 'unauthorized' });
    expect(await request('auth:token', { protocol: PROTOCOL_VERSION, token: 'nope' })).toEqual({
      ok: false,
      error: 'unauthorized',
    });
    ws.close();
  });

  it('lets two guests make a room, join it by code, play and see the state', async () => {
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
    const joined = await minh.request('room:join', {
      roomCode: ` ${code.toLowerCase()}`,
      role: 'player',
    });
    expect(joined).toMatchObject({ ok: true, roomCode: code });
    expect(await lan.request('game:start')).toEqual({
      ok: false,
      error: 'Chờ mọi người sẵn sàng đã',
    });
    expect(await minh.request('room:ready', { ready: true })).toEqual({ ok: true });
    expect(await lan.request('game:start')).toEqual({ ok: true });

    const place = (x: number, y: number) => ({ move: { event: 'place', payload: { x, y } } });
    const me = (b.user as { id: string }).id;
    expect(await minh.request('game:move', place(4, 4))).toEqual({
      ok: false,
      error: 'Chưa tới lượt bạn',
    });
    expect(await lan.request('game:move', place(4, 4))).toEqual({ ok: true });
    await settle();
    const seen = minh.states().at(-1);
    expect(seen).toMatchObject({ code, status: 'playing', players: [{ name: 'Lan' }, { id: me }] });
    expect(seen?.view).toMatchObject({ turn: me });
    expect(seen?.last).toMatchObject({ seq: 1, move: { event: 'place' } });

    // Logging in again with the token puts the guest back in the room.
    lan.ws.close();
    await settle();
    const back = await connect();
    const token = a.token as string;
    expect(await back.request('auth:token', { protocol: PROTOCOL_VERSION, token })).toMatchObject({
      ok: true,
      user: { name: 'Lan' },
    });
    expect(await back.request('session:resume')).toMatchObject({ room: { roomCode: code } });
    back.ws.close();
    minh.ws.close();
  });

  it('broadcasts owned emotes to the room and refuses unavailable or unknown ones', async () => {
    const lan = await connect();
    const minh = await connect();
    const a = await lan.request('auth:guest', { protocol: PROTOCOL_VERSION, name: 'Lan' });
    await minh.request('auth:guest', { protocol: PROTOCOL_VERSION, name: 'Minh' });
    const playerId = (a.user as { id: string }).id;

    const { roomCode } = await lan.request('room:create', { gameId: 'tic-tac-toe' });
    await minh.request('room:join', { roomCode: roomCode as string, role: 'player' });
    expect(await lan.request('emote:send', { emote: 'happy' })).toEqual({ ok: true });
    await settle();
    const expected = { playerId, emote: 'happy' };
    expect(lan.pushed.filter((message) => message.event === 'room:emote').at(-1)?.data).toEqual(
      expected,
    );
    expect(minh.pushed.filter((message) => message.event === 'room:emote').at(-1)?.data).toEqual(
      expected,
    );
    expect(await lan.request('emote:send', { emote: 'happy' })).toEqual({
      ok: false,
      error: 'Chờ một chút rồi gửi lại biểu cảm',
    });
    expect(await minh.request('emote:send', { emote: 'love' })).toEqual({
      ok: false,
      error: 'Bạn chưa có biểu cảm này',
    });
    expect(await minh.request('emote:send', { emote: 'missing' })).toEqual({
      ok: false,
      error: 'Biểu cảm không hợp lệ',
    });
    lan.ws.close();
    minh.ws.close();
  });

  it('answers unknown events without closing', async () => {
    const { ws, request } = await connect();
    await request('auth:guest', { protocol: PROTOCOL_VERSION, name: 'Hoa' });
    expect(await request('room:fly')).toEqual({ ok: false, error: 'Không có lệnh room:fly' });
    expect(await request('catalog:get')).toMatchObject({ ok: true, genres: expect.any(Array) });
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

describe('Hộp thư over the socket', () => {
  it('pushes a letter to everyone online, reads it and pays its coins once', async () => {
    const lan = await connect();
    await lan.request('auth:guest', { protocol: PROTOCOL_VERSION, name: 'Lan' });
    await app.get(MailService).send({ title: 'Quà cả xóm', body: 'Chúc vui', coins: 30 });
    await settle();
    const pushed = lan.pushed.filter((m) => m.event === 'mail:changed').at(-1);
    const box = pushed?.data as { letters: { id: string; title: string }[] } | undefined;
    const letter = box?.letters[0];
    expect(letter?.title).toBe('Quà cả xóm');
    expect(await lan.request('mail:read', { id: letter?.id })).toMatchObject({
      ok: true,
      waiting: 1,
    });
    const paid = await lan.request('mail:claim', { id: letter?.id });
    expect(paid).toMatchObject({ ok: true, mailbox: { waiting: 0 } });
    expect(await lan.request('mail:claim', { id: letter?.id })).toEqual({
      ok: false,
      error: 'Bạn đã nhận rồi',
    });
    lan.ws.close();
  });
});
