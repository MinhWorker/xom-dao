/** The slow-network simulation: delay and loss applied to every Bridge message over a WebSocket. */
export interface NetSettings {
  /** Milliseconds each message waits before it is delivered. */
  latency: number;
  /** Chance (0–1) that a message is lost. */
  drop: number;
}

export class NetSim {
  settings: NetSettings = { latency: 0, drop: 0 };

  constructor(private readonly random: () => number = Math.random) {}

  /**
   * One direction of a connection. Messages come out in the order they went in, each after the
   * latency; the function returns `false` for a message that was dropped.
   */
  lane(): (deliver: () => void) => boolean {
    let due = 0;
    return (deliver) => {
      const { latency, drop } = this.settings;
      if (drop > 0 && this.random() < drop) return false;
      const at = Math.max(Date.now() + latency, due);
      due = at;
      const wait = at - Date.now();
      if (wait <= 0) deliver();
      else setTimeout(deliver, wait);
      return true;
    };
  }
}
