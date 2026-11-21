import { type BridgePort, windowPort } from './port.js';
import {
  BRIDGE_RESET,
  BRIDGE_TAG,
  BRIDGE_VERSION,
  type BridgeInit,
  type BridgeSettings,
  type GameToHub,
  HubToGame,
  type Untagged,
} from './protocol.js';

/** A `send` the server refused (`code` is its error), or `BRIDGE_RESET` / `BRIDGE_UNAVAILABLE`. */
export class BridgeError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'BridgeError';
  }
}

export interface GameBridgeHandlers {
  /**
   * The first `init`, and each one after a reconnect or on replay: draw the whole screen from
   * it, whatever was shown before.
   */
  onInit(init: BridgeInit): void;
  onMessage?(event: string, data: unknown): void;
  onSettings?(settings: BridgeSettings): void;
  onVisibility?(hidden: boolean): void;
}

export interface GameBridge {
  /** Loading progress (0–1) for the Hub's loading screen; optional. */
  progress(value: number): void;
  /** The Game is loaded and its handlers are set: the Hub answers with `init`. */
  ready(): void;
  /** Sends a message to the server; resolves on its ack, rejects with a `BridgeError`. */
  send(event: string, data?: unknown): Promise<void>;
  /** The end-of-match animation is over. */
  done(): void;
  close(): void;
}

/** The Game's side of the Bridge. By default it talks to the Hub that embeds it. */
export function createGameBridge(
  handlers: GameBridgeHandlers,
  port: BridgePort = windowPort(window.parent),
): GameBridge {
  const pending = new Map<number, { resolve(): void; reject(error: BridgeError): void }>();
  let nextId = 1;
  const post = (message: Untagged<GameToHub>) => port.post({ bridge: BRIDGE_TAG, ...message });

  const stop = port.listen((raw) => {
    const parsed = HubToGame.safeParse(raw);
    if (!parsed.success) return;
    const message = parsed.data;
    switch (message.type) {
      case 'init':
        for (const request of pending.values()) request.reject(new BridgeError(BRIDGE_RESET));
        pending.clear();
        handlers.onInit(message.init);
        break;
      case 'ack': {
        const request = pending.get(message.id);
        if (!request) return;
        pending.delete(message.id);
        if (message.ok) request.resolve();
        else request.reject(new BridgeError(message.error ?? 'error'));
        break;
      }
      case 'message':
        handlers.onMessage?.(message.event, message.data);
        break;
      case 'settings':
        handlers.onSettings?.(message.settings);
        break;
      case 'visibility':
        handlers.onVisibility?.(message.hidden);
        break;
    }
  });

  return {
    progress: (value) => post({ type: 'progress', value: Math.min(1, Math.max(0, value)) }),
    ready: () => post({ type: 'ready', version: BRIDGE_VERSION }),
    send(event, data) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        post({ type: 'send', id, event, data });
      });
    },
    done: () => post({ type: 'done' }),
    close() {
      stop();
      pending.clear();
    },
  };
}
