/**
 * How one side of the Bridge reaches the other. `windowPort` is `postMessage`; the Harness
 * plugs in its own (a WebSocket) for Games run without the Hub.
 */
export interface BridgePort {
  post(message: unknown): void;
  /** Returns a function that stops listening. */
  listen(handler: (message: unknown) => void): () => void;
  /** Ends the transport, when it owns one (a WebSocket). */
  close?(): void;
}

/**
 * `postMessage` to `target` (the Game's iframe window, or the Hub's window from inside it),
 * hearing only messages `target` sent to `self`. Hub and Game share an origin.
 */
export function windowPort(
  target: Window,
  { self = window, origin = self.location.origin }: { self?: Window; origin?: string } = {},
): BridgePort {
  return {
    post: (message) => target.postMessage(message, origin),
    listen(handler) {
      const onMessage = (event: MessageEvent) => {
        if (event.source === target && event.origin === origin) handler(event.data);
      };
      self.addEventListener('message', onMessage);
      return () => self.removeEventListener('message', onMessage);
    },
  };
}

/**
 * The query parameter that makes a Game talk to a Harness instead of the Hub: its value is the
 * WebSocket URL to connect to.
 */
export const HARNESS_PARAM = 'harness';

/**
 * A WebSocket to the Harness, one JSON text frame per Bridge message. What is posted before the
 * socket opens is sent when it does.
 */
export function webSocketPort(url: string): BridgePort {
  const socket = new WebSocket(url);
  const handlers = new Set<(message: unknown) => void>();
  const waiting: string[] = [];
  socket.addEventListener('open', () => {
    for (const text of waiting.splice(0)) socket.send(text);
  });
  socket.addEventListener('message', (event) => {
    let message: unknown;
    try {
      message = JSON.parse(String(event.data));
    } catch {
      return;
    }
    for (const handler of handlers) handler(message);
  });
  return {
    post(message) {
      const text = JSON.stringify(message);
      if (socket.readyState === WebSocket.OPEN) socket.send(text);
      else if (socket.readyState === WebSocket.CONNECTING) waiting.push(text);
    },
    listen(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    close: () => socket.close(),
  };
}

/**
 * Where a Game's Bridge goes by default: the Harness named by the page's `harness` parameter,
 * otherwise the Hub that embeds it.
 */
export function defaultGamePort(): BridgePort {
  const harness = new URLSearchParams(location.search).get(HARNESS_PARAM);
  return harness ? webSocketPort(harness) : windowPort(window.parent);
}
