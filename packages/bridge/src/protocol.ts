import { z } from 'zod';

/**
 * The Bridge: what the Hub and a Game embedded in its iframe tell each other over
 * `postMessage`. The Hub keeps the only socket to the server; the Game talks to the Hub only.
 *
 *   Game → Hub  `ready`     loaded, with its BRIDGE_VERSION; the Hub refuses a mismatch
 *               `progress`  optional, while loading (0–1)
 *               `send`      a message for the server (`{ id, event, data }`), answered by `ack`
 *               `done`      the end-of-match animation is over: the Hub shows the results
 *   Hub → Game  `init`      who plays, the Room, locale, settings and the latest Match state.
 *                           Sent again after a reconnect or on replay: a Game rebuilds its
 *                           screen from any `init`
 *               `ack`       the server's answer to a `send`
 *               `message`   what the server pushed (`{ event, data }`)
 *               `settings`  volume, mute, music, effects or graphics changed in the Hub's menu
 *               `visibility` the tab was hidden or shown
 *
 * In-match payloads (`data`, `match`) are opaque: the Hub passes them on as they are.
 * Every message carries `bridge: 'xomdao'` so other `postMessage` traffic is ignored.
 *
 * The same messages also travel over a WebSocket to the Harness (`webSocketPort`, one JSON text
 * frame each), for a Game run without the Hub.
 */

/** Bump when a change here breaks Games or Hubs built against the previous version. */
export const BRIDGE_VERSION = 1;

export const BRIDGE_TAG = 'xomdao';

/** Rejects the `send`s still waiting when a new `init` arrives. */
export const BRIDGE_RESET = 'reset';
/**
 * Answers a `send` the Hub could not pass on (no connection): the Hub shows that error itself,
 * the Game only gives up the move.
 */
export const BRIDGE_UNAVAILABLE = 'unavailable';

const tag = { bridge: z.literal(BRIDGE_TAG) };

export const BridgePlayer = z.object({
  id: z.string(),
  name: z.string(),
  avatar: z.string(),
});
export type BridgePlayer = z.infer<typeof BridgePlayer>;

/** Who sits in one seat of the Room, in seat order. Bots have no avatar. */
export const BridgeSeat = BridgePlayer.extend({ avatar: z.string().optional(), bot: z.boolean() });
export type BridgeSeat = z.infer<typeof BridgeSeat>;

export const BridgeRoom = z.object({
  code: z.string(),
  seats: z.array(BridgeSeat),
});
export type BridgeRoom = z.infer<typeof BridgeRoom>;

/**
 * `volume` and `muted` are the master level. `music` and `effects` (0–1) are the player's split of
 * it for a Game with a channel of each; a Hub or Harness may leave them out, meaning 1.
 * `graphics` is the Hub's Đồ họa level; `low` asks for less motion and a lighter scene, and a
 * missing one means `high`.
 */
export const BridgeSettings = z.object({
  volume: z.number().min(0).max(1),
  muted: z.boolean(),
  music: z.number().min(0).max(1).optional(),
  effects: z.number().min(0).max(1).optional(),
  graphics: z.enum(['high', 'low']).optional(),
});
export type BridgeSettings = z.infer<typeof BridgeSettings>;

/** What `init` tells the Game. */
export const BridgeInit = z.object({
  player: BridgePlayer,
  room: BridgeRoom,
  /** A BCP 47 tag, `vi` for now. */
  locale: z.string(),
  settings: BridgeSettings,
  /** The Match state when joining a Match already under way; `null` at its start. */
  match: z.unknown(),
});
export type BridgeInit = z.infer<typeof BridgeInit>;

export const GameToHub = z.discriminatedUnion('type', [
  z.object({ ...tag, type: z.literal('ready'), version: z.int() }),
  z.object({ ...tag, type: z.literal('progress'), value: z.number().min(0).max(1) }),
  z.object({
    ...tag,
    type: z.literal('send'),
    id: z.int(),
    event: z.string(),
    data: z.unknown().optional(),
  }),
  z.object({ ...tag, type: z.literal('done') }),
]);
export type GameToHub = z.infer<typeof GameToHub>;

export const HubToGame = z.discriminatedUnion('type', [
  z.object({ ...tag, type: z.literal('init'), init: BridgeInit }),
  z.object({
    ...tag,
    type: z.literal('ack'),
    id: z.int(),
    ok: z.boolean(),
    error: z.string().optional(),
  }),
  z.object({ ...tag, type: z.literal('message'), event: z.string(), data: z.unknown().optional() }),
  z.object({ ...tag, type: z.literal('settings'), settings: BridgeSettings }),
  z.object({ ...tag, type: z.literal('visibility'), hidden: z.boolean() }),
]);
export type HubToGame = z.infer<typeof HubToGame>;

/** A message before its `bridge` tag is added. */
export type Untagged<T> = T extends unknown ? Omit<T, 'bridge'> : never;

/** The server's answer to one `send`, as the socket gives it. */
export type BridgeAck = { ok: true } | { ok: false; error: string };
