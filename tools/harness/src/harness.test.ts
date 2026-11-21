import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BridgeError, type BridgeInit, createGameBridge, webSocketPort } from '@xomdao/bridge';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runCommand } from './commands.js';
import { fakeServer } from './fake-server.js';
import { Harness } from './harness.js';
import { NetSim } from './net.js';
import { serve } from './server.js';

const cleanups: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

const wait = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));

async function until(check: () => boolean, what: string) {
  for (let i = 0; i < 300; i++) {
    if (check()) return;
    await wait(10);
  }
  throw new Error(`Timed out waiting for ${what}`);
}

async function setup() {
  const server = fakeServer();
  const harness = new Harness({ gameId: 'fake', version: 'v1', connect: server.connect });
  const listening = await serve(harness, {
    port: 0,
    gameDir: mkdtempSync(join(tmpdir(), 'harness-')),
  });
  cleanups.push(
    () => harness.reset(),
    () => listening.close(),
  );
  const bridgeUrl = (player?: number) =>
    `ws://127.0.0.1:${listening.port}/bridge${player === undefined ? '' : `?player=${player}`}`;
  return { server, harness, listening, bridgeUrl };
}

/** A Game client on the Harness' WebSocket Bridge, recording what it is told. */
function gameClient(url: string) {
  const inits: BridgeInit[] = [];
  const messages: { event: string; data: unknown }[] = [];
  const port = webSocketPort(url);
  const bridge = createGameBridge(
    {
      onInit: (init) => inits.push(init),
      onMessage: (event, data) => messages.push({ event, data }),
    },
    port,
  );
  cleanups.push(() => bridge.close());
  return { bridge, inits, messages };
}

describe('headless players', () => {
  it('seat, ready up and play from commands alone', async () => {
    const { harness, server } = await setup();
    expect(await harness.create({ headless: true })).toEqual({ player: 0, roomCode: 'ABCD' });
    await harness.join({ headless: true });
    const { matchId } = await harness.start();
    await until(() => harness.state().match?.status === 'playing', 'the Match to play');
    expect(matchId).toMatch(/^match-/);
    expect(server.readied).toHaveLength(2);

    await harness.move(0, 'place', { x: 1, y: 2 });
    await until(() => harness.state().players[1]?.view !== null, 'the view');
    expect(harness.state().players[1]?.view).toEqual([{ x: 1, y: 2 }]);
    await expect(harness.move(1, 'nope', {})).rejects.toThrow('Không có nước đó');
    expect(
      harness.entries({ source: 'server' }).some((e) => e.dir === 'in' && e.type === 'match:move'),
    ).toBe(true);
  });

  it('seat the server computer and take it out of the way on reset', async () => {
    const { harness } = await setup();
    await harness.create({ headless: true });
    await harness.bot();
    await until(() => harness.state().room?.seats.length === 2, 'the bot seat');
    await harness.reset();
    expect(harness.state().players).toEqual([]);
    expect(harness.state().room).toBeNull();
  });

  it('refuse a second create and a join without a Room', async () => {
    const { harness } = await setup();
    await expect(harness.join()).rejects.toThrow('create first');
    await harness.create({ headless: true });
    await expect(harness.create()).rejects.toThrow('reset first');
  });
});

describe('a Game client over the Bridge WebSocket', () => {
  it('gets init on ready, the Match as it starts, and its moves answered', async () => {
    const { harness, bridgeUrl } = await setup();
    await harness.create();
    await harness.join({ headless: true });
    const client = gameClient(bridgeUrl());
    client.bridge.ready();
    await until(() => client.inits.length === 1, 'the first init');
    expect(client.inits[0]?.player.name).toBe('Harness 1');
    expect(client.inits[0]?.room.seats.map((s) => s.name)).toEqual(['Harness 1', 'Harness 2']);
    expect(client.inits[0]?.match).toBeNull();

    await harness.start();
    await until(() => client.inits.length === 2, 'the init of the Match');
    await until(() => harness.state().match?.status === 'playing', 'the Match to play');
    await until(() => client.messages.some((m) => m.event === 'match:state'), 'a match:state');

    await client.bridge.send('place', { x: 3, y: 3 });
    await expect(client.bridge.send('nope')).rejects.toBeInstanceOf(BridgeError);
    await until(
      () => JSON.stringify(client.messages.at(-1)?.data).includes('"x":3'),
      'the move to come back',
    );

    const bridge = harness.entries({ source: 'bridge' }).map((e) => `${e.dir} ${e.type}`);
    expect(bridge.slice(0, 2)).toEqual(['game→hub ready', 'hub→game init']);
    expect(bridge).toContain('game→hub send');
    expect(bridge).toContain('hub→game ack');
  });

  it('is sent a fresh init after a reconnect or on request', async () => {
    const { harness, bridgeUrl } = await setup();
    await harness.create();
    const client = gameClient(bridgeUrl(0));
    client.bridge.ready();
    await until(() => client.inits.length === 1, 'the first init');

    await harness.reconnect(0);
    await until(() => client.inits.length === 2, 'the init after the reconnect');
    harness.init(0);
    await until(() => client.inits.length === 3, 'the replayed init');
    expect(harness.state().players[0]?.inits).toBe(3);
  });

  it('takes the first player that waits for a client, and refuses when none does', async () => {
    const { harness, bridgeUrl, listening } = await setup();
    await harness.create({ headless: true });
    const closed = new Promise<number>((resolve) => {
      const socket = new WebSocket(bridgeUrl());
      socket.addEventListener('close', (event) => resolve(event.code));
    });
    expect(await closed).toBe(1008);

    await harness.join();
    const client = gameClient(bridgeUrl());
    client.bridge.ready();
    await until(() => client.inits.length === 1, 'init');
    expect(harness.state().players.map((p) => p.client)).toEqual([false, true]);
    expect(listening.port).toBeGreaterThan(0);
  });

  it('loses every message when the simulated network drops them all', async () => {
    const { harness, bridgeUrl } = await setup();
    await harness.create();
    const client = gameClient(bridgeUrl(0));
    harness.setNet({ drop: 1 });
    client.bridge.ready();
    await wait(100);
    expect(client.inits).toHaveLength(0);
    expect(harness.entries({ source: 'bridge' }).every((e) => e.dropped)).toBe(true);

    harness.setNet({ drop: 0, latency: 60 });
    const sentAt = Date.now();
    client.bridge.ready();
    await until(() => client.inits.length === 1, 'the init after the latency');
    expect(Date.now() - sentAt).toBeGreaterThanOrEqual(100);
  });
});

describe('commands', () => {
  it('reject unknown commands and bad arguments', async () => {
    const { harness } = await setup();
    await expect(runCommand(harness, 'dance', {})).rejects.toThrow('Unknown command');
    await expect(runCommand(harness, 'move', { player: 'a' })).rejects.toThrow('Bad arguments');
    await expect(runCommand(harness, 'toString', {})).rejects.toThrow('Unknown command');
    expect(await runCommand(harness, 'net', { latency: 5 })).toEqual({ latency: 5, drop: 0 });
  });

  it('are served over HTTP', async () => {
    const { listening } = await setup();
    const base = `http://127.0.0.1:${listening.port}`;
    const post = (path: string, body: unknown) =>
      fetch(`${base}${path}`, { method: 'POST', body: JSON.stringify(body) });
    expect((await post('/api/create', { headless: true })).status).toBe(200);
    const bad = await post('/api/move', { player: 5, event: 'place' });
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { error: string }).error).toBe('No player 5');
    const state = (await (await fetch(`${base}/api/state`)).json()) as {
      room: { code: string };
      bridge: string;
    };
    expect(state.room.code).toBe('ABCD');
    expect(state.bridge).toBe(`ws://127.0.0.1:${listening.port}/bridge`);
    expect((await fetch(`${base}/game/../../etc/passwd`)).status).toBe(404);
  });
});

describe('NetSim', () => {
  it('keeps order and loses messages by chance', async () => {
    vi.useFakeTimers();
    try {
      const net = new NetSim(() => 0.5);
      const lane = net.lane();
      const order: number[] = [];
      net.settings.latency = 30;
      lane(() => order.push(1));
      net.settings.latency = 0;
      lane(() => order.push(2));
      expect(order).toEqual([]);
      await vi.advanceTimersByTimeAsync(60);
      expect(order).toEqual([1, 2]);

      net.settings.drop = 0.6;
      expect(lane(() => order.push(3))).toBe(false);
      net.settings.drop = 0.4;
      expect(lane(() => order.push(4))).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
