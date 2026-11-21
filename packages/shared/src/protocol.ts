import { z } from 'zod';
import { avatarSchema, frameSchema, profileSchema } from './account.js';

/**
 * The contract between clients and the server, written once as zod schemas. The server
 * speaks it over plain WebSocket + JSON on `/ws`, see `WsClientMessage`.
 *
 * To add or change a message: edit the schema here. TypeScript then points at every place to
 * update.
 */

/**
 * Bump this whenever a change here breaks older clients or servers (renamed/removed events,
 * changed payloads). Clients and server deploy separately, so they compare it on connect: the
 * client sends it with its `auth:*` request, and the server refuses a mismatch with
 * `PROTOCOL_MISMATCH` (the reply's `protocol` is the server's version). CI fails when this file changes without a bump, unless the PR has the
 * `protocol:compatible` label.
 */
export const PROTOCOL_VERSION = 16;

/** Error when the client's PROTOCOL_VERSION differs from the server's. */
export const PROTOCOL_MISMATCH = 'protocol-mismatch';

/**
 * Error when the Hub's `version` (the Game bundle's `dist/version.json`) differs from the Game
 * server's: the two were built from different code, mid-deploy. The Hub shows it as it is.
 */
export const GAME_UPDATING = 'Game đang cập nhật, thử lại sau ít phút';

/** The main currency. */
export const COIN = 'core:coin';

// ── Data ────────────────────────────────────────────────────────────────────────────────────

/** The logged-in player, as the server sends it to themselves. */
export const User = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string(),
  avatar: avatarSchema,
  frame: frameSchema,
  /** The back of their cards in card games (`CardBack`); older servers send none. */
  cardBack: z.string().optional(),
});
export type User = z.infer<typeof User>;

/** Someone in a Room's seat: a person, or the computer (`bot`). */
export const RoomMember = z.object({
  id: z.string(),
  name: z.string(),
  /** The account's picture (`Avatar`) and the ring around it (`Frame`); bots have none. */
  avatar: z.string().optional(),
  frame: z.string().optional(),
  /** A seat the computer plays: never host, always connected. */
  bot: z.boolean().optional(),
  /** Said Sẵn sàng before the Room's first Match (`room:ready`). */
  ready: z.boolean().optional(),
  connected: z.boolean(),
});
export type RoomMember = z.infer<typeof RoomMember>;

/** `waiting` between Matches, `playing` while one runs. */
export const RoomStatus = z.enum(['waiting', 'playing']);
export type RoomStatus = z.infer<typeof RoomStatus>;

/** A Room's picks for the options its Game manifest declares (`choice` and `toggle`). */
export const RoomOptions = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]));
export type RoomOptions = z.infer<typeof RoomOptions>;

/** What everyone in a Room sees of it (`room:state`). */
export const RoomState = z.object({
  /** The Room's short code: share it to let friends in (`room:join`). */
  code: z.string(),
  gameId: z.string(),
  hostId: z.string(),
  /** One entry per seat of the Game (`maxPlayers`), in seat order; `null` is an empty seat. */
  seats: z.array(RoomMember.nullable()),
  options: RoomOptions,
  status: RoomStatus,
  /** The running Match, `null` while waiting. */
  matchId: z.string().nullable(),
});
export type RoomState = z.infer<typeof RoomState>;

export const JoinedRoom = z.object({
  roomCode: z.string(),
  /** Your member id in the room: your account's user id. */
  playerId: z.string(),
});
export type JoinedRoom = z.infer<typeof JoinedRoom>;

/** An account's amount of each resource it has (`core:coin`); resources never held are missing. */
export const Balances = z.record(z.string(), z.int());
export type Balances = z.infer<typeof Balances>;

/** What a player received when a game ended (`reward`). */
export const RewardNotice = z.object({
  userId: z.string(),
  gameId: z.string(),
  rewards: z.array(z.object({ resource: z.string(), amount: z.int() })),
  /** Balances after the reward. */
  balances: Balances,
});
export type RewardNotice = z.infer<typeof RewardNotice>;

/** Someone who sat at the table, as they were when the game began. */
export const MatchPlayer = z.object({
  name: z.string(),
  avatar: z.string().optional(),
  frame: z.string().optional(),
  bot: z.boolean(),
  won: z.boolean(),
  /** Left during the game (games that go on without them). */
  left: z.boolean(),
  /** 1 is best; missing on games recorded before places. */
  place: z.int().optional(),
  score: z.number().optional(),
  /** The player asking for their history. */
  me: z.boolean(),
});
export type MatchPlayer = z.infer<typeof MatchPlayer>;

/** One finished game, seen by one of its players. */
export const MatchRecord = z.object({
  id: z.string(),
  gameId: z.string(),
  /** How it ended for the player asking. */
  outcome: z.enum(['win', 'loss', 'draw']),
  /** Epoch milliseconds. */
  startedAt: z.number(),
  endedAt: z.number(),
  /** In seat order. */
  players: z.array(MatchPlayer),
});
export type MatchRecord = z.infer<typeof MatchRecord>;

/** A pending Game timer that a client can use to draw its countdown. */
export const MatchTimer = z.object({
  id: z.int().min(1),
  event: z.string().min(1),
  ms: z.number(),
  deadline: z.number(),
});
export type MatchTimer = z.infer<typeof MatchTimer>;

/** The server-authoritative places and stats returned when a Game finishes a Match. */
export const MatchResult = z.object({
  seats: z.array(
    z.object({
      player: z.string(),
      place: z.int(),
      score: z.number().optional(),
    }),
  ),
  stats: z
    .array(z.object({ player: z.string(), name: z.string(), amount: z.int().positive() }))
    .optional(),
});
export type MatchResult = z.infer<typeof MatchResult>;

/** A settled Match's result, sent to its Room once it is recorded (`match:result`). */
export const MatchResultNotice = z.object({
  roomCode: z.string(),
  matchId: z.string(),
  gameId: z.string(),
  seats: MatchResult.shape.seats,
});
export type MatchResultNotice = z.infer<typeof MatchResultNotice>;

/**
 * Where a player stands on one board: `core` (everyone, by experience) or a game's id (by wins
 * in it). `rank` is 1 for the first; ties share a rank.
 */
export const RankInfo = z.object({ board: z.string(), value: z.int(), rank: z.int() });
export type RankInfo = z.infer<typeof RankInfo>;

/** Someone's statistics (`stats:get`): level, totals and ranks. */
export const PlayerStats = z.object({
  userId: z.string(),
  level: z.int(),
  /** Experience so far; the level started at `levelXp` and the next one is at `nextXp`. */
  xp: z.int(),
  levelXp: z.int(),
  nextXp: z.int(),
  /** Games finished and won, over every game. */
  played: z.int(),
  won: z.int(),
  /** The boards they are on (`core` first, then games by wins); none before their first game. */
  ranks: z.array(RankInfo),
});
export type PlayerStats = z.infer<typeof PlayerStats>;

/** One row of a ranking. */
export const RankingEntry = z.object({
  rank: z.int(),
  id: z.string(),
  name: z.string(),
  avatar: z.string(),
  frame: z.string(),
  /** Experience on `core`, wins on a game's board. */
  value: z.int(),
});
export type RankingEntry = z.infer<typeof RankingEntry>;

/** A board's top players (`ranking:get`), and your own row when you are on it. */
export const Ranking = z.object({
  board: z.string(),
  entries: z.array(RankingEntry),
  me: RankingEntry.nullable(),
});
export type Ranking = z.infer<typeof Ranking>;

// ── Bạn bè (friends) ───────────────────────────────────────────────────────────────────────

/** The longest chat message, in characters. */
export const CHAT_MAX = 300;
/** How many messages `chat:history` returns (the newest). */
export const CHAT_HISTORY = 50;
/** How many friends (and requests) an account may have. */
export const FRIENDS_MAX = 100;

/** Where someone stands with you: a friend, or a request one way or the other. */
export const FriendState = z.enum(['friend', 'incoming', 'outgoing']);
export type FriendState = z.infer<typeof FriendState>;

/** Someone in your Bạn bè list. Online and room are only told between friends. */
export const Friend = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string(),
  avatar: z.string(),
  frame: z.string(),
  state: FriendState,
  online: z.boolean(),
  /** The game whose room they are in, and its code (friends only). */
  gameId: z.string().optional(),
  roomCode: z.string().optional(),
  /** Their messages you haven't read. */
  unread: z.int(),
});
export type Friend = z.infer<typeof Friend>;

export const FriendList = z.object({ friends: z.array(Friend) });
export type FriendList = z.infer<typeof FriendList>;

/** How many people `friends:suggest` returns at most. */
export const SUGGEST_MAX = 20;

/**
 * Someone to add as a friend: a suggestion (`friends:suggest`) or the account a username search
 * found (`friends:find`). Where they stand with you comes from your Bạn bè list.
 */
export const Person = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string(),
  avatar: z.string(),
  frame: z.string(),
  online: z.boolean(),
  /** You played a game together lately. */
  recent: z.boolean(),
});
export type Person = z.infer<typeof Person>;

export const PeopleList = z.object({ people: z.array(Person) });
export type PeopleList = z.infer<typeof PeopleList>;

/** One chat message between two friends; `at` in ms since the epoch. */
export const ChatMessage = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  text: z.string(),
  at: z.number(),
});
export type ChatMessage = z.infer<typeof ChatMessage>;

export const ChatHistory = z.object({ userId: z.string(), messages: z.array(ChatMessage) });
export type ChatHistory = z.infer<typeof ChatHistory>;

/** A friend asks you to their room. */
export const RoomInvite = z.object({
  fromId: z.string(),
  fromName: z.string(),
  avatar: z.string(),
  frame: z.string(),
  roomCode: z.string(),
  gameId: z.string(),
});
export type RoomInvite = z.infer<typeof RoomInvite>;

// ── Requests and events ─────────────────────────────────────────────────────────────────────

const Empty = z.object({});
const Auth = { protocol: z.int() };

/** Reply of every `auth:*` request: keep `token` to log in again (`auth:token`) later. */
export const AuthReply = z.object({ token: z.string(), user: User });
/** Reply of `session:resume`. */
export const SessionInfo = z.object({
  user: User,
  room: JoinedRoom.nullable(),
  balances: Balances,
});
/** The Room was disbanded, or you left it from another device. */
export const RoomClosed = z.object({ gameId: z.string(), reason: z.string() });

/**
 * Before any other request, one of these logs the connection in. Each carries the client's
 * `protocol` (PROTOCOL_VERSION); a mismatch is refused with `PROTOCOL_MISMATCH`.
 */
export const authRequests = {
  /** A token from an earlier login (kept by the client). */
  'auth:token': { req: z.object({ ...Auth, token: z.string() }), res: AuthReply },
  'auth:login': {
    req: z.object({ ...Auth, username: z.string(), password: z.string() }),
    res: AuthReply,
  },
  /** A new guest account with only a display name (no password; the token is the key). */
  'auth:guest': { req: z.object({ ...Auth, name: z.string() }), res: AuthReply },
};

/** What a logged-in client may ask, with each reply's data (`{ ok: true, ...data }`). */
export const requests = {
  /**
   * Sent after every (re)connect: who you are, the room your account is in (if any) and your
   * balances. Being in a room follows the account, not the browser: closing the tab and logging
   * in anywhere puts you back in your seat. An account is in at most one room.
   */
  'session:resume': { req: Empty, res: SessionInfo },
  /** Change display name, avatar and frame (also updates your name in your current room). */
  'profile:update': { req: profileSchema, res: z.object({ user: User }) },
  /** Someone's level and ranks (yours without `userId`). */
  'stats:get': { req: z.object({ userId: z.string().optional() }), res: PlayerStats },
  /** The top `RANKING_LIMIT` of a board: `core` (by experience) or a game's id (by wins). */
  'ranking:get': { req: z.object({ board: z.string() }), res: Ranking },
  /** Your most recent finished games (`HISTORY_LIMIT`), newest first. */
  'history:recent': { req: Empty, res: z.object({ matches: z.array(MatchRecord) }) },
  /**
   * Creating or joining a Room first leaves the Room you were in (if it is another one).
   * `options` are picks for the Game manifest's options; missing ones take their default.
   * `version` is the Game bundle's (`dist/version.json`); another one is refused (`GAME_UPDATING`).
   */
  'room:create': {
    req: z.object({ gameId: z.string(), version: z.string(), options: RoomOptions.optional() }),
    res: JoinedRoom,
  },
  /** Takes the first empty seat of the Room with this code (any case), between Matches. */
  'room:join': { req: z.object({ roomCode: z.string() }), res: JoinedRoom },
  /**
   * Frees your seat. The next person seated becomes host; with nobody left the Room is
   * disbanded ('room:closed').
   */
  'room:leave': { req: Empty, res: Empty },
  /** Host only, between Matches: replace the Room's options (checked like `room:create`'s). */
  'room:options': { req: z.object({ options: RoomOptions }), res: Empty },
  /**
   * Someone seated other than the host says they are ready (or takes it back). Before the
   * Room's first Match the host can only start once every other person seated is ready.
   */
  'room:ready': { req: z.object({ ready: z.boolean() }), res: Empty },
  /** Host only, between Matches, for a Game with bots: the computer takes the first empty seat. */
  'room:add-bot': { req: Empty, res: Empty },
  /** Host only, between Matches: the computer leaves seat `seat`. */
  'room:remove-bot': { req: z.object({ seat: z.int() }), res: Empty },
  /**
   * Host only: starts a Match with everyone seated (at least the Game's `minPlayers`).
   * `version` is checked like `room:create`'s.
   */
  'match:start': { req: z.object({ version: z.string() }), res: z.object({ matchId: z.string() }) },
  /** A player tells the server that their Game iframe loaded this Match. */
  'match:ready': { req: z.object({ matchId: z.string() }), res: Empty },
  /** The Hub forwards one player's Game event to the server-authoritative rules. */
  'match:move': {
    req: z.object({ matchId: z.string(), event: z.string(), payload: z.unknown().optional() }),
    res: Empty,
  },
  /**
   * Bạn bè: your friends and requests, friends online first. `friends:add` asks someone by their
   * username (or accepts their request to you); `friends:answer` accepts or turns down a request
   * to you; `friends:remove` ends a friendship or takes back a request. Each replies with your
   * new list; the other side gets `friends:changed`.
   */
  'friends:list': { req: Empty, res: FriendList },
  'friends:add': { req: z.object({ username: z.string() }), res: FriendList },
  'friends:answer': { req: z.object({ userId: z.string(), accept: z.boolean() }), res: FriendList },
  'friends:remove': { req: z.object({ userId: z.string() }), res: FriendList },
  /**
   * People you might add: those you played with lately (newest first), then others online, never
   * yourself or your friends; at most `SUGGEST_MAX`.
   */
  'friends:suggest': { req: Empty, res: PeopleList },
  /** The account with exactly this username (any case), or nobody. */
  'friends:find': { req: z.object({ username: z.string() }), res: PeopleList },
  /** The newest `CHAT_HISTORY` messages with a friend, oldest first; marks theirs read. */
  'chat:history': { req: z.object({ userId: z.string() }), res: ChatHistory },
  /** Sends a friend a message (1–`CHAT_MAX` characters); they get `chat:message`. */
  'chat:send': {
    req: z.object({ userId: z.string(), text: z.string() }),
    res: z.object({ message: ChatMessage }),
  },
  /** Asks a friend to the room you are in; they get `room:invite`. */
  'friends:invite': { req: z.object({ userId: z.string() }), res: Empty },
};

/** What the server pushes. */
export const events = {
  /** The Room you are in changed. */
  'room:state': RoomState,
  /** A Match moved through loading, playing and over. */
  'match:state': z.object({
    roomCode: z.string(),
    matchId: z.string(),
    gameId: z.string(),
    status: z.enum(['loading', 'playing', 'over']),
    outcome: z.enum(['settled', 'aborted']).optional(),
    disconnectedPlayerIds: z.array(z.string()),
    timer: MatchTimer.nullable(),
    result: MatchResult.optional(),
    view: z.unknown().optional(),
  }),
  /** A settled Match's places and scores, once recorded; a failed settle sends none. */
  'match:result': MatchResultNotice,
  /** The Room was disbanded, or you left it from another device. */
  'room:closed': RoomClosed,
  /** Your Bạn bè list changed: a request, an answer, a friend coming online or into a room. */
  'friends:changed': FriendList,
  /** A friend sent you a message (also sent to your own other tabs when you send one). */
  'chat:message': ChatMessage,
  /** A friend asks you to their room. */
  'room:invite': RoomInvite,
};

/** Every request gets either `{ ok: true, ...data }` or `{ ok: false, error }`. */
export type Ack<T = object> = (res: ({ ok: true } & T) | { ok: false; error: string }) => void;

type Events = typeof events;

/** The events the server pushes, from `events`. */
export type ServerToClientEvents = {
  [E in keyof Events]: (payload: z.output<Events[E]>) => void;
};

/**
 * WebSocket transport (`/ws`), one JSON object per text frame:
 *   client → server  `{ id, event, data }`: a request (`authRequests`, then `requests`);
 *   server → client  `{ id, ack }`: its reply (`{ ok: true, ...data }` or `{ ok: false, error }`);
 *   server → client  `{ event, data }`: a pushed event (`events`).
 * Ids are the client's own, echoed back. Requests other than `auth:*` before logging in get
 * `{ ok: false, error: 'unauthorized' }`.
 */
export interface WsClientMessage {
  id: number;
  event: string;
  data?: unknown;
}
export type WsServerMessage =
  | { id: number; ack: { ok: boolean; [key: string]: unknown } }
  | { event: string; data: unknown };
