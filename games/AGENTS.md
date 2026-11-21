# Games and the SDK

Where to look:
- **Examples**: `games/tic-tac-toe` (Caro) adds room options and a computer player;
  `games/tien-len` is the fullest game.
- **Skills** in `.claude/skills/`: `anti-slop-game-ui` (when designing, implementing or reviewing a
  game's board, HUD, menus or overlays).
- **The source of truth for the API** is the header of `packages/sdk/src/game.ts` (the
  Turn-based `Game` class, `ctx.finish(places)`) and of `packages/sdk/src/manifest.ts` (the
  Game manifest, `games/<id>/manifest.ts`).

## Two SDKs, for now

- `@xomdao/sdk` is the SDK of the new platform: `Game`, `turnRules`, `testGame`,
  `defineManifest`, `optionsSchema`. New Game servers use it.
- `@xomdao/sdk/legacy` is the old one (`definePlugin`, `meta`, `ctx.reward`, dev commands). The
  current server, `@xomdao/shared` and the two kept games still import it; the rest of this file
  describes it. Delete it once the rewritten rooms, GameHostModule and games no longer need it.

## The Bridge

A Game's client talks to the Hub only through `@xomdao/bridge` (`packages/bridge`): it calls
`createGameBridge({ onInit, onMessage, ... })`, then `ready()`, sends moves with `send` and
calls `done()` after its end-of-match animation. Every `init` (reconnect, replay) must redraw
the whole screen from its `match` snapshot. The message list and `BRIDGE_VERSION` are in the
header of `packages/bridge/src/protocol.ts`; the Hub's side is `createGameHost`.

## A game's folder

```
games/<id>/          src/index.ts is required
  RULES.md             Current Vietnamese gameplay rules (non-starter games); the client's Luật board
  src/index.ts         export default definePlugin({ meta, game: new MyGame(), room? }); server
  src/game/            Pure rules, no DOM: <Name>Game.ts (+ test), model.ts, options.ts, bot.ts
  assets/              Full-size images/sounds, atlases and normals
  sources/             Optional originals (Git LFS) + prompts.json (see assets/AGENTS.md)
```

## The build contract

Whatever engine a game uses, its folder is an npm workspace that Turborepo drives:

- `package.json` is named `@xomdao/game-<id>`, `<id>` being the folder name (kebab-case).
- `scripts.build` is required and writes everything the game ships to `dist/` (Turborepo
  caches that folder). `scripts.test` and `scripts.typecheck` are optional; use them when the
  game has tests or types.
- Tasks run from the game's folder and depend on the builds of the workspaces it lists in
  `dependencies` (`^build`), so declare `@xomdao/sdk` and the like there.
- Run one game: `npx turbo run build test --filter=@xomdao/game-<id>`. CI runs `--affected`, so
  a change to one game builds and tests only that game, what depends on it and `shared`.
- Add `"@xomdao/game-<id>": "*"` to `devDependencies` in `packages/shared/package.json`: `shared`
  imports every game, so this makes Turborepo build games first and re-test `shared` and the
  server when a game changes.
- `scripts/libs.mjs` checks the name, the `build` script and that dependency on `npm install`.

## Rules

- **The server is authoritative.** A game's table calls `client.send(event, payload)`,
  which goes out as `game:move`. The server then:
  1. checks the payload against `events`;
  2. runs `on<Event>`;
  3. sends each member a `room:state` built by `view(ctx, viewer)`.
- **Never send raw state.** Hide other players' cards and the deck in `view`. Spectators get
  `viewer = null`, and events listed in `secretEvents` stay hidden from others.
- Hooks are pure and return a new state. Randomness goes only through `ctx.rng`.
- Optional `override readonly commands` declares `z.object` schemas; each needs a `cmd<Name>`
  hook (`move-token` → `cmdMoveToken`). `CommandContext<State, Options, Args>` adds validated
  `args` and `reject` to the normal game context. Positional arguments follow object key order.
- Optional `override readonly catalogs` lists `{ id, value, label }` entries. IDs are unique
  kebab-case; labels are Vietnamese. `catalog(name)` defaults to numeric values; pass a zod
  schema as the second argument for other types. Console `@catalog:id` resolves to `value`.
- `gameRules` and registry tests reject reserved command names, missing command hooks,
  invalid/duplicate catalog IDs and references to unknown catalogs. Existing games need no
  commands or catalogs.
- Synchronous `console.log/info/warn/error` in hooks reaches the room log with `XOMDAO_DEV=1`
  and still prints in the terminal. SDK declares these methods for pure game builds.
- A game's TypeScript imports only these; Biome enforces it, and core never imports a game:
  - `@xomdao/sdk` and `zod` (and `vitest` in tests);
  - `@xomdao/bridge`, from its client only (Biome allows it anywhere in the game);
  - its own files.
- Every `Game` has tests with `testGame` (`src/game/<Name>Game.test.ts`).
- When a mechanic or piece of data would help other games too, add it to the SDK instead of the
  game. Examples: a system event, a `ctx` property, a view helper, a test helper.
- Changing an SDK API means, in the same change:
  - updating every game that uses it;
  - documenting it in the header of `game.ts` or `manifest.ts`.
- `meta` is also the game's hub card: `genre` (an id from `genres` in
  `packages/shared/src/catalog.ts`; none = not in the hub yet), `tagline`, `duration` in minutes,
  optional `kind` (`table`/`event` + `event`), `card` art and `rewardCap`. The registry test
  checks it with `metaProblems`.
- `meta.status: 'wip'` marks an unfinished game; `'ready'` releases it.
- The server runs the games' compiled `dist/`, while typechecks and tests use their TypeScript
  source (export condition `xomdao-source`). `turbo run` builds them first.

## Mechanics worth knowing

- **Seats never change during a game.** A leaver stays in `ctx.players` with `left: true`. Without
  `onLeave`, one player leaving stops the game for everyone.
- **Rewards**: `ctx.reward(playerId, 'core:coin', amount)` when the game ends (Caro, Tiến Lên
  pay `WIN_COINS` from `model.ts`). Declare the most one player can win in `meta.rewardCap`; the
  server refuses more, pays once per game and skips bots. `testGame` shows them in
  `result.rewards`.
- **Events** (`kind: 'event'`, genre `su-kien`, `meta.event`): points go through
  `ctx.reward(player, EVENT_POINTS, n)` within `meta.rewardCap`. The server neither keeps nor pays
  them for now.
- **Stats**: `ctx.stat(playerId, 'chop', n = 1)` counts something a player did (lowercase-dash
  names; `played` and `won` are counted by the server). `testGame` shows counts in
  `result.stats`. The server ignores `meta.achievements` for now.
- **Timers**: `ctx.setTimer(ms, 'name')` calls `onName(ctx)`. There is one timer per game, and
  the gateway runs it. Use it for a turn clock or a pause between rounds. The table shows
  countdowns from the snapshot's `timer`.
- **Room options and bots**:
  - `room.options` is a zod schema, and `optionsSchema.parse({})` must work.
  - The `Game` reads them as `ctx.options`; the table gets them in the snapshot's `options`.
  - `room.bots` seats computer players, whose moves come from `bot(ctx)`.
  - `room.withBots(options, count)` gives the options with the computer in `count` empty seats:
    quick match (CHƠI) fills a room with it when nobody else comes (`QUICK_WAIT_MS`).
  - The host may replace them between games with `room:options` (the hub has no board for it
    yet).
- **Snapshots** carry `round` and `last` (the last event). `ctx.lastResult` is how the room's
  previous game ended.
- **Tables**: the game draws only its board, from the room snapshot; the Hub is not built yet.
- **`testGame`** takes a plugin or a `Game`. It offers:
  - `send`, `error`, `view` and `assertHidden`;
  - `command(line)` for optional game dev commands, catalog references and semicolon chains;
  - `bot`, `newGame`, `timer`, `fireTimer` and `leave`;
  - the option `bots`.

Before finishing a game change, also play it in the sandbox.
