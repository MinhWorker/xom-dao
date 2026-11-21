// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BridgeError, createGameBridge, type GameBridgeHandlers } from './game.js';
import { createGameHost, type GameHostOptions } from './hub.js';
import { windowPort } from './port.js';
import { BRIDGE_TAG, BRIDGE_VERSION, type BridgeInit } from './protocol.js';

const ORIGIN = 'http://localhost:3000';

/**
 * A Hub page with the Game in an iframe. jsdom's `postMessage` sets neither `source` nor
 * `origin`, so each window's is replaced by one that does, as a browser would.
 */
function embed() {
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const frame = iframe.contentWindow as Window;
  const deliver = (to: Window, from: Window) => (data: unknown) =>
    setTimeout(() =>
      to.dispatchEvent(
        new (to as unknown as typeof globalThis).MessageEvent('message', {
          data: structuredClone(data),
          source: from,
          origin: ORIGIN,
        }),
      ),
    );
  window.postMessage = deliver(window, frame) as Window['postMessage'];
  frame.postMessage = deliver(frame, window) as Window['postMessage'];
  cleanups.push(() => iframe.remove());
  return {
    hubPort: windowPort(frame, { self: window, origin: ORIGIN }),
    gamePort: windowPort(window, { self: frame, origin: ORIGIN }),
  };
}

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

/** Every delivery takes one timer turn; waits out a few hops back and forth. */
async function flush() {
  for (let i = 0; i < 10; i++) await new Promise((resolve) => setTimeout(resolve));
}

function makeInit(match: unknown, overrides: Partial<BridgeInit> = {}): BridgeInit {
  return {
    player: { id: 'u1', name: 'An', avatar: 'cat' },
    room: {
      code: 'ABCD',
      seats: [
        { id: 'u1', name: 'An', avatar: 'cat', bot: false },
        { id: 'bot-1', name: 'Máy', bot: true },
      ],
    },
    locale: 'vi',
    settings: { volume: 0.8, muted: false },
    match,
    ...overrides,
  };
}

function connect(hub: Partial<GameHostOptions> = {}, game: Partial<GameBridgeHandlers> = {}) {
  const { hubPort, gamePort } = embed();
  const hubSide = {
    send: vi.fn<GameHostOptions['send']>(async () => ({ ok: true as const })),
    onReady: vi.fn(),
    onProgress: vi.fn(),
    onDone: vi.fn(),
    onMismatch: vi.fn(),
    ...hub,
  };
  const host = createGameHost({ port: hubPort, ...hubSide });
  const gameSide = {
    onInit: vi.fn(),
    onMessage: vi.fn(),
    onSettings: vi.fn(),
    onVisibility: vi.fn(),
    ...game,
  };
  const bridge = createGameBridge(gameSide, gamePort);
  cleanups.push(
    () => host.close(),
    () => bridge.close(),
  );
  return { host, bridge, hubSide, gameSide, hubPort, gamePort };
}

describe('Bridge round-trip', () => {
  it('hands the Game its init once it is ready, after its loading progress', async () => {
    const { host, bridge, hubSide, gameSide } = connect();
    const init = makeInit(null);
    host.init(init);
    bridge.progress(0.5);
    await flush();
    expect(hubSide.onProgress).toHaveBeenCalledWith(0.5);
    expect(gameSide.onInit).not.toHaveBeenCalled();

    bridge.ready();
    await flush();
    expect(hubSide.onReady).toHaveBeenCalledOnce();
    expect(gameSide.onInit).toHaveBeenCalledWith(init);
  });

  it('sends a move through the Hub and resolves on its ack', async () => {
    const { host, bridge, hubSide } = connect();
    host.init(makeInit(null));
    bridge.ready();
    await flush();

    await bridge.send('play', { cell: 4 });
    expect(hubSide.send).toHaveBeenCalledWith('play', { cell: 4 });
  });

  it('rejects a send with the error the server gave', async () => {
    const { host, bridge } = connect({
      send: async () => ({ ok: false, error: 'not-your-turn' }),
    });
    host.init(makeInit(null));
    bridge.ready();
    await flush();

    const sent = bridge.send('play', { cell: 4 });
    await expect(sent).rejects.toBeInstanceOf(BridgeError);
    await expect(sent).rejects.toMatchObject({ code: 'not-your-turn' });
  });

  it('turns a failed forward into an error ack', async () => {
    const { host, bridge } = connect({
      send: async () => {
        throw new Error('disconnected');
      },
    });
    host.init(makeInit(null));
    bridge.ready();
    await flush();

    await expect(bridge.send('play', {})).rejects.toMatchObject({ code: 'disconnected' });
  });

  it('passes on what the server pushes, the settings and the visibility', async () => {
    const { host, bridge, gameSide } = connect();
    host.init(makeInit(null));
    bridge.ready();
    host.message('state', { board: [1, 0] });
    host.settings({ volume: 0, muted: true });
    host.visibility(true);
    await flush();

    expect(gameSide.onMessage).toHaveBeenCalledWith('state', { board: [1, 0] });
    expect(gameSide.onSettings).toHaveBeenCalledWith({ volume: 0, muted: true });
    expect(gameSide.onVisibility).toHaveBeenCalledWith(true);
  });

  it('keeps what the Hub sent before the Game was ready, in order', async () => {
    const order: string[] = [];
    const { host, bridge } = connect(
      {},
      {
        onInit: () => order.push('init'),
        onMessage: (event) => order.push(event),
      },
    );
    host.init(makeInit(null));
    host.message('first', null);
    host.message('second', null);
    await flush();
    expect(order).toEqual([]);

    bridge.ready();
    await flush();
    expect(order).toEqual(['init', 'first', 'second']);
  });

  it('tells the Hub when the end-of-match animation is over', async () => {
    const { host, bridge, hubSide } = connect();
    host.init(makeInit(null));
    bridge.ready();
    bridge.done();
    await flush();
    expect(hubSide.onDone).toHaveBeenCalledOnce();
  });

  it('refuses a Game built for another Bridge version', async () => {
    const { host, hubSide, gameSide, gamePort } = connect();
    host.init(makeInit(null));
    gamePort.post({ bridge: BRIDGE_TAG, type: 'ready', version: BRIDGE_VERSION + 1 });
    await flush();

    expect(hubSide.onMismatch).toHaveBeenCalledWith(BRIDGE_VERSION + 1);
    expect(hubSide.onReady).not.toHaveBeenCalled();
    expect(gameSide.onInit).not.toHaveBeenCalled();
  });

  it('ignores messages that are not the Bridge', async () => {
    const { host, bridge, hubSide, gameSide, hubPort, gamePort } = connect();
    host.init(makeInit(null));
    bridge.ready();
    await flush();
    gamePort.post({ type: 'ready', version: BRIDGE_VERSION });
    gamePort.post({ bridge: BRIDGE_TAG, type: 'send', id: 'x', event: 'play' });
    hubPort.post('hello');
    hubPort.post({ bridge: BRIDGE_TAG, type: 'message' });
    await flush();

    expect(hubSide.onReady).toHaveBeenCalledOnce();
    expect(hubSide.send).not.toHaveBeenCalled();
    expect(gameSide.onMessage).not.toHaveBeenCalled();
  });

  it('ignores messages from another window', async () => {
    const { host, hubSide } = connect();
    host.init(makeInit(null));
    const stranger = document.createElement('iframe');
    document.body.append(stranger);
    cleanups.push(() => stranger.remove());
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { bridge: BRIDGE_TAG, type: 'ready', version: BRIDGE_VERSION },
        source: stranger.contentWindow,
        origin: ORIGIN,
      }),
    );
    await flush();
    expect(hubSide.onReady).not.toHaveBeenCalled();
  });
});

/** A small Game whose screen is drawn from nothing but the snapshot it was given. */
function boardGame(port: ReturnType<typeof embed>['gamePort']) {
  const screen = { you: '', seats: [] as string[], cells: [] as string[], muted: false };
  const bridge = createGameBridge(
    {
      onInit(init) {
        const match = (init.match ?? { cells: Array(9).fill('') }) as { cells: string[] };
        screen.you = init.player.name;
        screen.seats = init.room.seats.map((seat) => seat.name);
        screen.cells = [...match.cells];
        screen.muted = init.settings.muted;
      },
      onMessage(event, data) {
        if (event === 'state') screen.cells = [...(data as { cells: string[] }).cells];
      },
    },
    port,
  );
  return { screen, bridge };
}

describe('Rebuilding from any snapshot', () => {
  it('draws the Match state an init carries, whatever came before', async () => {
    const { hubPort, gamePort } = embed();
    const host = createGameHost({ port: hubPort, send: async () => ({ ok: true }) });
    const { screen, bridge } = boardGame(gamePort);
    cleanups.push(
      () => host.close(),
      () => bridge.close(),
    );

    host.init(makeInit(null));
    bridge.ready();
    host.message('state', { cells: ['X', '', '', '', '', '', '', '', ''] });
    await flush();
    expect(screen.cells[0]).toBe('X');

    const midMatch = { cells: ['X', 'O', 'X', '', 'O', '', '', '', ''] };
    host.init(makeInit(midMatch, { settings: { volume: 0.5, muted: true } }));
    await flush();
    expect(screen).toEqual({
      you: 'An',
      seats: ['An', 'Máy'],
      cells: midMatch.cells,
      muted: true,
    });

    host.init(makeInit(null));
    await flush();
    expect(screen.cells).toEqual(Array(9).fill(''));
  });

  it('drops the sends still waiting when a new init arrives', async () => {
    const { host, bridge } = connect({ send: () => new Promise(() => {}) });
    host.init(makeInit(null));
    bridge.ready();
    await flush();

    const pending = bridge.send('play', { cell: 1 });
    await flush();
    host.init(makeInit({ cells: [] }));
    await expect(pending).rejects.toMatchObject({ code: 'reset' });
  });
});
