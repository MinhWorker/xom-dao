/**
 * One line of the Harness log. `bridge` entries are Bridge messages (`dir` says which way),
 * `server` entries what went to and came from the server, `harness` entries the Harness' own
 * notes (an action, a refusal, a Game that finished its animation).
 */
export interface LogEntry {
  n: number;
  at: number;
  /** Which player, or `null` for the Harness itself. */
  player: number | null;
  source: 'bridge' | 'server' | 'harness';
  dir?: 'game→hub' | 'hub→game' | 'out' | 'in';
  type: string;
  data?: unknown;
  /** The network simulation lost this message. */
  dropped?: boolean;
}

export interface LogFilter {
  /** Only entries after this `n`. */
  since?: number;
  player?: number;
  source?: LogEntry['source'];
  /** At most this many, the newest. */
  limit?: number;
}

/** The newest `capacity` entries, numbered from 1. */
export class Log {
  private entries: LogEntry[] = [];
  private count = 0;

  constructor(private readonly capacity = 1000) {}

  /** The number of the latest entry, 0 when empty. */
  get last() {
    return this.count;
  }

  add(entry: Omit<LogEntry, 'n' | 'at'>): LogEntry {
    const added: LogEntry = { n: ++this.count, at: Date.now(), ...entry };
    this.entries.push(added);
    if (this.entries.length > this.capacity) this.entries.shift();
    return added;
  }

  list({ since = 0, player, source, limit }: LogFilter = {}): LogEntry[] {
    const found = this.entries.filter(
      (entry) =>
        entry.n > since &&
        (player === undefined || entry.player === player) &&
        (source === undefined || entry.source === source),
    );
    return limit === undefined ? found : found.slice(-limit);
  }
}
