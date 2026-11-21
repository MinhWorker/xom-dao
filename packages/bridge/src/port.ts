/**
 * How one side of the Bridge reaches the other. `windowPort` is `postMessage`; the Harness
 * plugs in its own (a WebSocket) for Games run without the Hub.
 */
export interface BridgePort {
  post(message: unknown): void;
  /** Returns a function that stops listening. */
  listen(handler: (message: unknown) => void): () => void;
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
