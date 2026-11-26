/** The game's data: what a Match remembers (State), what each seat sees (View) and the options. */
import type { ManifestOptions, PlayerId } from '@xomdao/sdk';
import type manifest from '../../manifest.js';

/** Cells per side of each sea. */
export const SIZE = 10;

/** The fleet every player places, largest first: its index is the ship's id in a Match. */
export const FLEET = [
  { name: 'Tàu sân bay', size: 5 },
  { name: 'Thiết giáp hạm', size: 4 },
  { name: 'Tuần dương hạm', size: 3 },
  { name: 'Tàu ngầm', size: 3 },
  { name: 'Khu trục hạm', size: 2 },
] as const;

/** Radar scans each player has in a Match when the Room allows them. */
export const RADAR_SCANS = 1;
/** A scan covers this many cells per side, centred on the chosen cell. */
export const RADAR_SPAN = 3;

/** A cell by its coordinates: x to the right (A–J), y down (1–10). */
export interface Point {
  x: number;
  y: number;
}

/** Where one ship lies: its bow cell and whether it runs down (`v`) or to the right. */
export interface Placement {
  x: number;
  y: number;
  v: boolean;
}

/** What a sea's owner's opponent knows about one cell (`Clear`: known empty without a shot,
 * around a sunk ship or in a radar scan that found nothing). */
export const Unknown = 0;
export const Miss = 1;
export const Hit = 2;
export const Clear = 3;
export type Mark = typeof Unknown | typeof Miss | typeof Hit | typeof Clear;

/** One radar scan: the centre cell and how many ship cells the 3×3 area holds. */
export interface Scan extends Point {
  count: number;
}

/** One player's own sea: their fleet and what the other player has learnt of it. */
export interface Sea {
  /** In `FLEET` order; empty until the player has placed their fleet. */
  ships: Placement[];
  ready: boolean;
  /** SIZE × SIZE marks, row by row: the other player's shots and what they cleared. */
  marks: Mark[];
  /** Radar scans the other player made over this sea. */
  scans: Scan[];
  /** Radar scans this sea's owner has left. */
  radar: number;
}

/** What happened last, for the clients to animate. */
export type Last =
  | {
      kind: 'shot';
      by: PlayerId;
      x: number;
      y: number;
      result: 'miss' | 'hit' | 'sunk';
      ship?: number;
    }
  | { kind: 'scan'; by: PlayerId; x: number; y: number; count: number };

export type Phase = 'setup' | 'battle' | 'over';

/** One Match of Hải Chiến. */
export interface State {
  phase: Phase;
  /** Seat order. */
  players: [PlayerId, PlayerId];
  /** Each player's own sea. */
  seas: Record<PlayerId, Sea>;
  /** Who fires next (also during setup: who will fire first). */
  turn: PlayerId;
  /** Shots fired in the battle so far, by both. */
  shots: number;
  last: Last | null;
  winner: PlayerId | null;
  /** Matches each player won in this Room since the seats last changed, this one included. */
  wins: Record<PlayerId, number>;
}

/** A sea as one viewer sees it: ships they may not see are `null`. */
export interface SeaView extends Omit<Sea, 'ships'> {
  ships: (Placement | null)[];
  /** Which ships of `FLEET` are sunk. */
  sunk: boolean[];
}

export interface View extends Omit<State, 'seas'> {
  seas: Record<PlayerId, SeaView>;
}

export type Options = ManifestOptions<typeof manifest>;
export type BotLevel = Options['level'];
