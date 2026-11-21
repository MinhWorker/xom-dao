import { PROTOCOL_VERSION, type User } from '@xomdao/shared/client';

/** The server's answer to a request that failed: its own message, shown as it is. */
export class ServerError extends Error {}

export type Push = (event: string, data: unknown) => void;

/** One account's connection to the server, as the Harness plays a Hub with it. */
export interface ServerLink {
  readonly user: User;
  readonly online: boolean;
  /** Resolves with the reply's data; rejects with a `ServerError` when the server refuses. */
  request(event: string, data?: unknown): Promise<Record<string, unknown>>;
  /** Logs in again with the same account and asks for its Room back (`session:resume`). */
  reconnect(): Promise<void>;
  /** Closes the socket without leaving the Room, as a lost connection does. */
  drop(): void;
  close(): void;
}

/** Opens a new guest account, logged in. Every push of the server goes to `onPush`. */
export type Connect = (name: string, onPush: Push) => Promise<ServerLink>;

interface Waiting {
  resolve(ack: Record<string, unknown>): void;
  reject(error: Error): void;
}

class SocketLink implements ServerLink {
  user!: User;
  online = false;
  private token = '';
  private socket: WebSocket | null = null;
  private nextId = 0;
  private readonly waiting = new Map<number, Waiting>();

  constructor(
    private readonly url: string,
    private readonly onPush: Push,
  ) {}

  async guest(name: string) {
    await this.open();
    const ack = await this.raw('auth:guest', { protocol: PROTOCOL_VERSION, name });
    this.token = String(ack.token);
    this.user = ack.user as User;
  }

  async reconnect() {
    this.drop();
    await this.open();
    await this.raw('auth:token', { protocol: PROTOCOL_VERSION, token: this.token });
    await this.raw('session:resume', {});
  }

  request(event: string, data: unknown = {}) {
    if (!this.online) return Promise.reject(new ServerError('The server connection is closed'));
    return this.raw(event, data);
  }

  drop() {
    this.socket?.close();
    this.closed(this.socket);
  }

  close() {
    this.drop();
  }

  private open(): Promise<void> {
    const socket = new WebSocket(this.url);
    this.socket = socket;
    socket.addEventListener('message', (event) => this.onMessage(String(event.data)));
    socket.addEventListener('close', () => this.closed(socket));
    return new Promise((resolve, reject) => {
      socket.addEventListener('open', () => {
        this.online = true;
        resolve();
      });
      socket.addEventListener('error', () =>
        reject(new ServerError(`Cannot reach the server at ${this.url}`)),
      );
    });
  }

  private closed(socket: WebSocket | null) {
    if (socket !== this.socket) return;
    this.online = false;
    for (const request of this.waiting.values()) {
      request.reject(new ServerError('The server connection closed'));
    }
    this.waiting.clear();
  }

  private raw(event: string, data: unknown): Promise<Record<string, unknown>> {
    const socket = this.socket;
    if (!socket) return Promise.reject(new ServerError('Not connected'));
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      this.waiting.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, event, data }));
    });
  }

  private onMessage(text: string) {
    let message: { id?: number; ack?: Record<string, unknown>; event?: string; data?: unknown };
    try {
      message = JSON.parse(text);
    } catch {
      return;
    }
    if (typeof message.id === 'number' && message.ack) {
      const request = this.waiting.get(message.id);
      this.waiting.delete(message.id);
      if (!request) return;
      if (message.ack.ok) request.resolve(message.ack);
      else request.reject(new ServerError(String(message.ack.error)));
    } else if (typeof message.event === 'string') {
      this.onPush(message.event, message.data);
    }
  }
}

/** Connects to the server at `base` (`http://localhost:8033`), over its `/ws`. */
export function connectToServer(base: string): Connect {
  const url = `${base.replace(/\/+$/, '').replace(/^http/, 'ws')}/ws`;
  return async (name, onPush) => {
    const link = new SocketLink(url, onPush);
    await link.guest(name);
    return link;
  };
}
