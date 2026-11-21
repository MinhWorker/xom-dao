# Server (@xomdao/server) and the socket protocol (@xomdao/shared)

The server is only the API: rooms over the `/ws` WebSocket and `/api` over HTTP. It serves no web
files.

```
src/game-host/  GameHostModule = generated Game servers, Match lifecycle, MATCH_LIMITS and
                /api/games IDs; disabled-games.* = the `disabled_games` switch
src/cli/        games.ts = `npm run games -w @xomdao/server -- list | disable <id> | enable <id>`
src/rooms/      rooms.service.ts = Rooms, seats and options (unit tested); manifests.ts = the
                host's GAME_MANIFESTS; rooms.gateway.ts = the `@On(event)` handlers and broadcasts;
                ws.gateway.ts = the transport: plain WebSocket + JSON on /ws, login + protocol
                check, then RoomsGateway's handlers
src/dev/        dev-mode.ts: DEV_MODE (XOMDAO_DEV=1)
src/accounts/   Username/password (scrypt) and login tokens
src/ledger/     Ledger: the only module that changes balances (`ledger_entries`, `balances`)
src/stats/      Stats and rankings (`player_stats`, `stat_matches`)
src/matches/    Match history: finished games (`FinishedGame`), `history:recent`
src/friends/    Bạn bè: requests, friendships and chat (`friendships`, `friend_messages`)
src/db/         Drizzle schema; migrations in drizzle/
src/version.ts  For /api/health
packages/shared/src/protocol.ts   The protocol as zod schemas (types, requests, events) + PROTOCOL_VERSION
packages/shared/src/client.ts     `@xomdao/shared/client`: account + protocol for browsers, no Game registry
packages/shared/src/catalog.ts    Genre list (core data), metaProblems (registry test)
packages/shared/src/stats.ts      XP_PER_GAME, levels, ranking boards
packages/shared/src/registry.ts   games/getGame, from the generated (gitignored) src/generated/games.ts
```

## Rooms

- `RoomsService` holds Session state only: Rooms, seats, options and the running Match's id. It
  runs no Game rules; `GameHostService` runs the Match that `start` hands over
  (`MatchStart`) and calls `endMatch` when it is over.
- Rooms open only for a Game in `GAME_MANIFESTS` (`rooms/manifests.ts`), which comes from the
  generated server list. `/api/games` returns the IDs loaded by GameHostModule.
- A Room has the Game's `maxPlayers` seats; `room:state` sends them in order, `null` for an empty
  one. `room:join` takes the first empty seat between Matches. There are no spectators.
- Options are picks for the manifest's `options`, checked and filled with `optionsSchema`. The
  host may replace them between Matches (`room:options`).
- The host seats the computer (`room:add-bot`, Games with `bots`) and removes it
  (`room:remove-bot`). Bots never host or keep a Room alive.
- Before the Room's first Match the other people seated say `room:ready`; `match:start` waits for
  them. Playing again needs no second yes.
- Leaving frees the seat, also mid-Match. The next person seated becomes host; a Room with
  nobody left is disbanded.

## Matches

- `GameHostService` alone moves a Match through `loading → playing → over` (`settled` or
  `aborted`). `MATCH_LIMITS` holds the platform's limits; a Game declares none. A hook over
  250 ms (logged over 50 ms), a `view` over 64 KB, 2 hours of play or 5 minutes without a
  person's message abort the Match, logged with the reason and the Game's id. A seat's 11th
  move within a second is refused.
- A Realtime Game (`RealtimeGame`) runs in the same `GameHostService`: once playing, a fixed
  tick every 1 / `tickRate` s (drift-corrected; after a delay it runs at most `catchUpTicks`
  ticks and drops the rest). A person's `match:move` with event `input` and data
  `{ seq, input }` is checked, rate-limited (`inputsPerSecond`, `inputBytes`; the other limits
  apply as above) and queued; the next tick applies the queue, then the Game's `tick`. Every
  `tickRate / snapshotRate` ticks each member gets `match:state` with their `view`, its `tick`
  and their `ack` (the last `seq` applied), and the Game's `result` settles the Match. A
  reconnecting player gets the last snapshot. A Realtime Game with a `bot` hook may say
  `bots: true` (the host refuses one that says it without the hook): each tick, after the queued
  inputs and before `tick`, the host asks `bot` for every computer seat and for each person who
  left, so the computer takes their seat instead of `onLeave`.
- A player who drops mid-Match keeps the seat for 60 s (`disconnect` / `reconnect`, from the
  gateway). After that, or on `room:leave`, they have left: placed last, the computer plays
  their seat if the Game has `bot`, otherwise the Game's leave hook runs, otherwise the Match is
  aborted. With no person left it is aborted.
- A settled Match goes to `ResultsService.settle` (`GameHostService` is its only caller). It
  writes `matches` and `stats` in one transaction that starts by inserting the `matches` row
  keyed by `matchId`: a second settle of the same Match writes nothing. Once it is recorded the
  Room gets `match:result` (places, scores); a failed settle is logged and sends none. The
  ledger is not paid yet.
- `disabled_games` (`DisabledGamesService`, cached `DISABLED_GAMES_CACHE_MS`) hides a Game from
  `/api/games` and refuses `room:create`; Matches already playing finish. Switch it with the
  CLI against the DB in `DATABASE_URL` (never with a Render env var: that restarts the server).
- Each Game server carries `version` (`scripts/game-version.mjs`, through the generated list).
  `room:create` and `match:start` send the bundle's; another one is refused with
  `GAME_UPDATING`.

## Accounts and connection

- Everyone plays logged in, with a username and password and no email.
- The client speaks plain WebSocket + JSON on `/ws` (same port as `/api`): `{ id, event, data }`
  requests, `{ id, ack }` replies, `{ event, data }` pushes. It logs in first with `auth:token`,
  `auth:login` or `auth:guest` (a new account with only a name), each carrying `protocol`.
  Only `npm run smoke` and tests still use `auth:guest`.
  `WsGateway` then runs the matching `RoomsGateway` handler (`handlerFor`);
  `RoomsGateway.clients()` lists every connected client for broadcasts.
- Room codes are 4 characters without 0/O/1/I; `room:join` takes them in any case.
- Being in a room belongs to the account. After every connect, the client sends `session:resume`
  to get back to its seat from any tab or device.
- Accounts, tokens and match history live in Postgres (Neon, `DATABASE_URL`). Without it they
  live in memory, which is fine for local work.

## Ledger

- Tables `ledger_entries` (one row per change, unique `key`) and `balances` (per account and
  namespaced resource, `core:coin`). Memory store without `DATABASE_URL`.
- `LedgerService.apply({ userId, resource, amount, reason, key })` is how other modules pay or
  charge: a used key changes nothing (`duplicate`), a balance never goes below 0
  (`insufficient`). No other module touches these tables.
- `LedgerService.rewardMatch` pays accounts (never bots) once per game (key
  `match:<matchId>:<user>:<resource>`) within the game's `meta.rewardCap`. Nothing calls it
  until `ResultsService.settle` pays rewards. `session:resume` returns `balances`.
- `dev:coins { amount }` (dev mode only) adds coins, for tests and the sandbox.
- Event points (`EVENT_POINTS`) are skipped: no module keeps them for now.

## Stats

- `StatsService.recordMatch` (from `ResultsService.settle`) counts once per match and person
  (`stat_matches`): `played`, `won` (first place, not a draw), the game's `result.stats` (`ctx.stat`) into `player_stats`
  by game, and `XP_PER_GAME` into game `core`, stat `xp`.
- `stats:get { userId? }` returns `PlayerStats` (level from `levelOf(xp)`, totals, ranks).
  `ranking:get { board }` returns the top `RANKING_LIMIT`: `core` by `xp`, a game's id by `won`;
  ties share a rank; `me` is your row when you are on it.

## Match history

- `MatchesService.record` (from `ResultsService.settle`) keeps a `FinishedGame` under its
  `matchId` (the `matches` id), with each seat's `place` and `score`.
- A game is kept only when an account sat at it. Players are stored as they were when it began
  (name, avatar, frame); bots have no `user_id`.
- `history:recent` returns the caller's last `HISTORY_LIMIT` (20) games, newest first, each with
  the caller's own `outcome`.

## Bạn bè

- `FriendsService` owns `friendships` (one row per pair: requester, addressee, `acceptedAt` once
  accepted) and `friend_messages`. Memory stores without `DATABASE_URL`.
- `friends:add { username }` asks someone (or accepts their request to you); `friends:answer`,
  `friends:remove`; each replies with your list and pushes `friends:changed` to the other side.
- `friends:suggest` lists people to add: accounts you sat with in your last `HISTORY_LIMIT` games
  (`MatchesService.partners`, newest first), then others connected; never you or your friends, at
  most `SUGGEST_MAX`. `friends:find { username }` returns the one account with exactly that
  username (any case), or nobody; display names are never searched.
  Who is online and in which room (`Presence`) comes from the gateway's sockets and
  `RoomsService.roomOf`, and only friends see it. An account's friends get a fresh list
  `FRIEND_PUSH_MS` after it comes online, goes or changes rooms (one push per burst).
- `chat:send` (friends only, 1–`CHAT_MAX` characters, a short per-account cooldown) pushes
  `chat:message` to the friend and to your other sockets; `chat:history` returns the newest
  `CHAT_HISTORY` and marks theirs read (`unread` in the list counts the rest).
- `friends:invite { userId }` pushes `room:invite` with your room's code to an online friend.

## Changing things

- New platform features are separate Nest modules. A module owns its tables and never reads another module's tables:
  it calls that module's service.

- Nest DI needs the runtime value, so `import` classes that Nest injects as values.
- The server typechecks against built packages. `typecheck` and `test` run through Turborepo,
  which builds the packages they import first (`turbo.json`).
- **New socket events** go in `protocol.ts` first, as zod schemas in `requests` / `events`
  (and `types` for a new named shape).
- Client and server deploy separately and compare `PROTOCOL_VERSION` on
  login (`ws.gateway.ts` refuses another version with `protocol-mismatch`); the client then shows
  "Đã có bản mới" with Tải lại. Bump it when old clients or servers would break.
- Stores take an optional `DbTx` so `ResultsService` can run several modules' writes in one
  transaction.
- Tests that need Postgres use `freshDb()` (`src/testing/pg.ts`) and skip without
  `TEST_DATABASE_URL`, a server they may create databases on (CI runs one). Locally:
  `podman run -d --rm -e POSTGRES_PASSWORD=test -p 55432:5432 postgres:17-alpine`, then
  `TEST_DATABASE_URL=postgres://postgres:test@localhost:55432/postgres npm run test`.
- **DB**: edit `src/db/schema.ts`, then run `npm run db:generate -w @xomdao/server`. Migrations apply
  on server start.
- A migration must work with the previous server build: add first, remove later.

## Dev mode

- `DEV_MODE` reads `XOMDAO_DEV === '1'` once at startup. `scripts/dev-server.mjs` enables it for
  `npm run dev`; never set it on Render. Only `dev:coins` needs it.
- Use `npm run dev` with memory accounts (`DATABASE_URL=''`) for local runs.

## Deploy

Every merge to `main` deploys; a release is only a named point.

- **Server → Render** `xomdao-server` (free, Singapore, `render.yaml`), URL
  https://play-some-cards-server.onrender.com, service id `srv-daq1sc0473hc73e7bsl0` (`render logs
  -r <id>`). Deploys when `apps/server/**`, `packages/shared/**` or `package-lock.json` change.
  Sleeps after ~15 min; sleep or deploy drops every room. Keep exactly one instance: rooms live in
  process memory, which is also why the server stays off Vercel Functions.
- **DB → Neon Postgres** project `royal-block-89471600` (Singapore), database `psc`. Branch `main`
  = production (Render's pooled `DATABASE_URL`), branch `dev` = local (`apps/server/.env`). Get a
  URL with `neonctl connection-string <main|dev> --project-id royal-block-89471600 --database-name
  psc --pooled`, then change `sslmode=require` to `verify-full`. Without `DATABASE_URL` the server
  keeps accounts in memory (`/api/health` reports `db: "off"`).
- Migrations run on server start while the previous server may still be up: keep them compatible
  with it (add a column first, drop the old one in a later PR).

## Dropped modules

Shop, inventory, items, events, quests, mail, achievements, the console and the catalog were
removed (#221). Their tables (`items`, `inventory_items`, `event_points`, `event_claims`,
`achievements`, `quest_progress`, `letters`, `letter_receipts`) and migrations stay, with their
data; no code reads or writes them. Never drop them in a migration without a decision to.
