import type { BridgePort } from './port.js';
import {
  BRIDGE_TAG,
  BRIDGE_VERSION,
  type BridgeAck,
  type BridgeInit,
  type BridgeSettings,
  GameToHub,
  type HubToGame,
  type Untagged,
} from './protocol.js';

export interface GameHostOptions {
  /** Usually `windowPort(iframe.contentWindow)`. */
  port: BridgePort;
  /** Forwards one of the Game's messages to the server over the Hub's socket. */
  send(event: string, data: unknown): Promise<BridgeAck>;
  /** The Game loaded: hide the loading screen and tell the server. */
  onReady?(): void;
  onProgress?(value: number): void;
  /** The end-of-match animation is over: show the results. */
  onDone?(): void;
  /** The Game speaks another Bridge version and is refused. */
  onMismatch?(version: number): void;
}

export interface GameHost {
  /** Sends `init`. Call it first, and again after a reconnect or on replay. */
  init(init: BridgeInit): void;
  /** Passes on what the server pushed. */
  message(event: string, data: unknown): void;
  settings(settings: BridgeSettings): void;
  visibility(hidden: boolean): void;
  close(): void;
}

/**
 * The Hub's side of the Bridge, for one Game iframe. What the Hub tells the Game before its
 * `ready` is kept and delivered, in order, once it is.
 */
export function createGameHost(options: GameHostOptions): GameHost {
  const { port } = options;
  let ready = false;
  let closed = false;
  const queue: HubToGame[] = [];

  const post = (message: Untagged<HubToGame>) => {
    const tagged = { bridge: BRIDGE_TAG, ...message } as HubToGame;
    if (ready) port.post(tagged);
    else queue.push(tagged);
  };

  async function forward(id: number, event: string, data: unknown) {
    let ack: BridgeAck;
    try {
      ack = await options.send(event, data);
    } catch (error) {
      ack = { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
    if (!closed) post({ type: 'ack', id, ...ack });
  }

  const stop = port.listen((raw) => {
    const parsed = GameToHub.safeParse(raw);
    if (!parsed.success) return;
    const message = parsed.data;
    switch (message.type) {
      case 'ready':
        if (message.version !== BRIDGE_VERSION) {
          options.onMismatch?.(message.version);
          return;
        }
        if (ready) return;
        ready = true;
        for (const queued of queue.splice(0)) port.post(queued);
        options.onReady?.();
        break;
      case 'progress':
        options.onProgress?.(message.value);
        break;
      case 'send':
        void forward(message.id, message.event, message.data);
        break;
      case 'done':
        options.onDone?.();
        break;
    }
  });

  return {
    init: (init) => post({ type: 'init', init }),
    message: (event, data) => post({ type: 'message', event, data }),
    settings: (settings) => post({ type: 'settings', settings }),
    visibility: (hidden) => post({ type: 'visibility', hidden }),
    close() {
      closed = true;
      stop();
    },
  };
}
