# Games and the SDK

Where to look:
- **Examples**: `games/caro` (Caro) is the new platform's test Game: `manifest.ts`,
  `server/` (rules with room options and a computer player) and `client/` (TypeScript + canvas,
  no engine).
  `games/dat-bom` (Đặt Bom) is the Realtime example: a `RealtimeGame` with a `bot` hook, its
  arena physics in `server/game/arena.ts`, and a Three.js client in `client/` (low-poly scene
  built in code in `scene.ts`; `sync.ts` interpolates snapshots 150 ms behind the server and
  `predict.ts` replays `walk` on the player's own character so keys answer at once). A Game made
  for the new platform needs only `server/index.ts`; the legacy registry skips it.
  `games/tien-len` (Tiến Lên) is the Turn-based example with hidden hands: rounds, a turn clock,
  `bot` that also plays the seat of anyone who leaves (so it has no `onLeave`), and `finish`
  with places and scores. Its client is a Godot project in `godot/` (the reference Godot Game): the
  cards, plates and boards are drawn in code, `main.gd` presents each `match:state` push paced
  one after another and sounds come from `assets/`. `assets/*.webp` and `sources/` are the legacy
  AI-made art, which the client does not use.
- **Skills** in `.claude/skills/`: `anti-slop-game-ui` (when designing, implementing or reviewing a
  game's board, HUD, menus or overlays).
- **The source of truth for the API** is the header of `packages/sdk/src/game.ts` (the
  Turn-based `Game` class, `ctx.finish(places)`), of `packages/sdk/src/manifest.ts` (the
  Game manifest, `games/<id>/manifest.ts`) and of `packages/sdk/src/realtime.ts` (the Realtime
  `RealtimeGame`: `init`/`input`/`tick`/`view`/`result`/`bot`, a fixed tick and 10-20 Hz
  snapshots).

## Two SDKs, for now

- `@xomdao/sdk` is the SDK of the new platform: `Game`, `turnRules`, `testGame`,
  `defineManifest`, `optionsSchema` and `GameServer` for Turn-based games; `RealtimeGame`,
  `realtimeRules`, `testRealtimeGame` and `RealtimeGameServer` for Realtime ones. New Game servers
  use it.
- `@xomdao/sdk/legacy` is the old one (`definePlugin`, `meta`, `ctx.reward`, dev commands). No
  Game uses it any more; the legacy registry in `@xomdao/shared` still imports it, and the rest of
  this file describes it. Delete both.

## The Bridge

A Game's client talks to the Hub only through `@xomdao/bridge` (`packages/bridge`): it calls
`createGameBridge({ onInit, onMessage, ... })`, then `ready()`, sends moves with `send` and
calls `done()` after its end-of-match animation. Every `init` (reconnect, replay) must redraw
the whole screen from its `match` snapshot. The message list and `BRIDGE_VERSION` are in the
header of `packages/bridge/src/protocol.ts`; the Hub's side is `createGameHost`.

## The Harness: running a Game without the Hub

`tools/harness` (`@xomdao/harness`) plays the Hub for one Game against a real server, so a Game
is developed and tested without the Hub or a database. A Game client reaches it through the same
Bridge messages, one JSON text frame each, over `ws://<harness>/bridge?player=<n>`.
`createGameBridge` uses that WebSocket instead of `postMessage` when the page URL has
`?harness=<that url>`; an engine outside the browser opens the WebSocket itself (Godot: the
addon below).

1. Build the Game: `npx turbo run build --filter=@xomdao/game-<id>`.
2. Start a server with no DB, on its own port: `PORT=8133 DATABASE_URL= npm run dev -w @xomdao/server`.
3. `npm run harness -- serve --game <id> --server http://localhost:8133` (Harness on :8040;
   `--port`, `--host`). It serves the built client at `/game/`; `--client <url>` points the debug
   page at a dev server instead (Caro: `npx vite --port 5173` in the Game's folder).

The debug page at `http://localhost:8040/` has the Room buttons, one landscape phone frame
(844×390, with the Hub's 48×48 corner marked) per player, the Bridge and server log, each
player's `view`, and a slow-network setting (`latency`, `drop`: applied to both ways of every
Game client).

For agents, the same commands run from the CLI (`npm run harness -- help`); each prints JSON and
a refusal exits with 1:

- `create [--headless] [--options <json>]`, `join [--headless]`, `bot`, `options <json>`, `start`
  (also plays again), `reset`. A headless player has no Game client; the others wait for one
  (`?player=<n>`, or the first that connects).
- `move <player> <event> [json]` sends a Game input as that player; `state` shows the Room, the
  Match and each player's `view`; `wait --match playing|over`; `log [--since n --player n
  --source bridge|server|harness]`.
- `init`, `reconnect`, `disconnect`, `leave`, `visibility <player> hidden|visible`, `settings`,
  `net --latency <ms> --drop <0-1>` replay what the Hub does around the Game.

`npm run smoke:web` runs the web smoke test: a real server, the Harness and headless Chromium
(`npx playwright-core install chromium` once), where Đặt Bom's client must draw the arena, walk
and place a bomb on key presses. It saves `smoke-web/dat-bom.png`, and CI runs it and uploads
that screenshot. Look at a client yourself the same way: `playwright-core` on the Harness'
`/game/?harness=ws://<harness>/bridge?player=0`, with `--use-angle=swiftshader` for WebGL.

Caro without a client: `create --headless`, `join --headless`, `start`, then
`move 0 place '{"x":4,"y":4}'` and `move 1 place '{"x":3,"y":4}'` in turn.

## Godot Games

`tools/godot` is the shared Godot 4 support (Godot 4.7, GDScript, Compatibility renderer):

- **The addon** `tools/godot/addons/xomdao_bridge`: the autoload `XomdaoBridge` is the Game's side
  of the Bridge (the API is documented in the header of `bridge.gd`). Inside the Hub's iframe it
  uses `postMessage`; from the editor, headless or a browser tab with `?harness=<ws url>` it uses a
  WebSocket to the Harness (`--harness=<url>` after `--`, or `XOMDAO_HARNESS`; default
  `ws://127.0.0.1:8040/bridge?player=0`). The Game code is the same in both.
- **A sample scene** `tools/godot/sample`: a Godot client of Caro (the `caro` server), the
  reference for how a Godot Game uses the addon.
- **The web export**: `export.mjs`, with the single-threaded ("nothreads") template and no
  COOP/COEP, as the iframe research (#202) decided.
- **The toolchain**: `npm run setup:godot` installs the pinned editor and templates into `.tools/`
  (`version.json`); `$GODOT` or `godot` on the PATH also work, `$GODOT_TEMPLATES` points at the
  templates folder.

Make a Godot Game:

1. `games/<id>/godot/` is the Godot project, beside the usual `manifest.ts`, `server/`, `RULES.md`
   and `hub/key-art.png`. Link the addon, never copy it:
   `ln -s ../../../../tools/godot/addons/xomdao_bridge games/<id>/godot/addons/xomdao_bridge`.
   Copy `tools/godot/sample/project.godot` as a start: it has the `XomdaoBridge` autoload, the
   plugin, the Compatibility renderer, `textures/vram_compression/import_etc2_astc=true` (the
   export refuses without it) and `gdscript/warnings/untyped_declaration=2`. Commit the `.uid`
   files Godot writes next to scripts; `.godot/` is ignored.
2. `scripts.build` starts with `node ../../tools/godot/export.mjs godot --out dist` (before the
   server build and `hub-assets`; nothing there empties `dist/`). It exports to `dist/index.html`
   plus `godot.js`, `godot.wasm`, `godot.pck` and the audio worklets: the Godot files are named
   `godot.*`, so they never overwrite a `dist/index.js` the Game's own build writes. Add
   `--optional` when the Game server must still build where Godot is missing (Render builds every
   Game server and has no Godot): the export is then skipped with a warning and `dist/` has no
   client. Add `"@xomdao/godot": "*"` and a `turbo.json` whose `build` inputs list
   `$TURBO_ROOT$/tools/godot/...` (`games/tien-len/turbo.json`), so a change to the addon
   rebuilds the Game. The preset
   and the page shell (`web_shell.html`, which also reports loading `progress` to the Hub) come
   from `tools/godot`; the export runs on a copy under `.tools/export/` that follows symlinks.
   `--debug` makes a debug build.
3. In the main scene: connect `XomdaoBridge.inited` and `message_received`, then call
   `XomdaoBridge.announce_ready()` (`ready` is a Node signal, so the method has another name).
   Redraw everything from each `inited` (`init.match` is the Game's own `view`, or null); each
   `match:state` push arrives as `message_received("match:state", {matchId, status, view})`.
   `var result: Dictionary = await XomdaoBridge.send("place", {...})` gives `{ok, error}`; call
   `XomdaoBridge.done()` after the end-of-match animation. JSON numbers are floats: `int()` them.
   Leave the top-right 48×48 px to the Hub. Volume and mute from `settings` are already applied
   to the Master bus; `music` and `effects` (0 to 1, may be missing) are not applied, for a Game
   with a channel of each. A `match:state` push whose `status` is `over` carries the `result`
   (`seats[].player`, `place`, `score`) and no `view`: the last move never arrives as a view, so
   show the end from the result (Tiến Lên shows its standings from it). The server applies the
   computer's moves with no pause: queue the pushes and pace them on screen (`main.gd`).
4. Run it against a Game server: start the server and the Harness as above and `create` a Room
   first (the Harness refuses a Game client until a Room exists; the addon retries every second),
   then run the scene from the editor or `godot --path games/<id>/godot -- --harness=ws://127.0.0.1:8040/bridge?player=0`.
   `join --headless`, `bot` and `move` fill the other seats.

`npm run godot:verify` plays the sample against a real server and the Harness in headless Godot:
`ready`, `init` (also replayed mid-Match), moves, `done`, `settings`, `visibility`.
`npm run godot:verify -- --web` also exports the sample, loads it in headless Chromium with
`?harness=` and taps the board (saves `smoke-godot/sample.png`). Needs Godot, a built server,
Harness and `caro` (`npm run build`). Neither runs in CI; `npm run check` only tests that
the addon's Bridge version and message types match `packages/bridge`. CI does install Godot
(`npm run setup:godot`, cached) so that Tiến Lên's build exports its client, and `npm run e2e`
plays it through the Hub: `npm run e2e -- tien-len` taps the Godot canvas (its layout is
mirrored in `scripts/e2e.mjs`, so change `_hand_slot` and `_layout_buttons` in
`games/tien-len/godot/main.gd` together with it).
Tiến Lên also runs headless against the Harness: `create`, `bot`, then
`godot --headless --path games/tien-len/godot -- --harness=ws://localhost:8040/bridge?player=0 --autoplay`
and `start` (`--autoplay`, or `?autoplay` in the web page, leads the lowest card and passes).

## A game's folder

```
games/<id>/          src/index.ts is required, unless server/index.ts exists (new platform)
  RULES.md             Current Vietnamese gameplay rules; the Hub's rules pager (below)
  src/index.ts         export default definePlugin({ meta, game: new MyGame(), room? }); server
  src/game/            Pure rules, no DOM: <Name>Game.ts (+ test), model.ts, options.ts, bot.ts
  manifest.ts          New platform: the Game's static Hub declaration
  server/index.ts      New platform: default export { manifest, game } as a GameServer
  server/game/         New platform: pure server rules and model (+ tests)
  client/              New platform: the client bundle's source (Caro: Vite, index.html at its root)
  godot/               New platform, Godot client instead of client/: the Godot project (above)
  hub/key-art.png      New platform: the Hub's art for the Game (below); optional hub/loop.mp4
  hub/rules/<name>.webp  Optional illustration of one rules page (below)
  assets/              Full-size images/sounds, atlases and normals
  sources/             Optional originals (Git LFS) + prompts.json (see assets/AGENTS.md)
```

Each new platform Game exports `./server` from its package, pointing to `dist/server/`
(`tsconfig.server.build.json` also writes `dist/manifest.js`, which `server/` imports). Its
client bundle is `dist/index.html` with relative paths: the Hub (`apps/hub`) ships every Game
that has `manifest.ts` and that file, at `/games/<id>/`, and forwards each `match:state` push
to it as a Bridge `message`. Its `tsconfig.server.build.json` extends `games/tsconfig.server.build.json`; `scripts.build` builds that
config and ends with `node ../../scripts/game-version.mjs`, which writes `dist/version.json`:
the hash of `manifest.ts`, `server/**` and the shared packages it imports. The Hub sends it with
`room:create` and `match:start`. `scripts/libs.mjs` adds every `server/index.ts` to the generated registry in
`@xomdao/shared`; `GameHostModule` loads that list.

**Hub art.** `scripts.build` ends with `node ../../tools/hub-assets/dist/cli.js` (and the Game lists
`@xomdao/hub-assets` in `devDependencies`; `scripts/libs.mjs` checks both). It reads
`dist/manifest.js` and `hub/key-art.png` and writes `dist/hub/`: `lobby` (2560×1280), `card`
(480×270) and `thumb` (256×256) WebPs, cropped around the manifest's `focus` and named by content
hash, and `hub.json` with their `/games/<id>/hub/…` URLs for the Hub to import. The build fails,
naming the Game, when the manifest breaks the schema or its `id` is not the folder name, when
`RULES.md` or `hub/key-art.png` is missing, when the art is not a 20:9 PNG of at least
2560×1152, or when the optional `hub/loop.mp4` (copied to `dist/hub/`) is over 2 MB or 8 s.
**Rules pager.** The Hub draws `RULES.md` as pages: the text under `#` is the first page and each
`##` another, named by its heading (a file with no `##` is one scrolling page). A page holds
paragraphs, `-` lists and tables, with `**bold**`, `*italic*` and `` `code` ``; at most 8 pages and
400 characters each (marks not counted), so split a long section. A page may carry one image line
`![alt](hub/rules/<name>.webp)`: a 16:9 WebP of at least 1280×720. `hub-assets` fails the build
over the same limits, a missing or misnamed image, and writes the pages into `hub.json` (`rules`).
`tools/hub-assets/src/rules.ts` is the parser.

The art is a render from the Game's scene (code or Blender, no AI-made images) with the subject
in the right 60%: the Hub darkens the left for the Game's name. It checks nothing about looks.

A Realtime client sends each input as `send('input', { seq, input })` (`seq` counts up per
player, also across reconnects: continue from the snapshot's `ack`), reads `tick`, `view` and
`ack` from every `match:state` message and draws other players a snapshot behind. Keys held
before the first tick are ignored by the server, so it sends the held direction again then.

A Vite client (Caro, Đặt Bom): `vite.config.ts` sets `root: 'client'`, `base: './'`, `outDir: '../dist'`
and the `xomdao-source` condition; `vite build` runs first in `scripts.build` because it empties
`dist/`. A `vitest.config.ts` keeps Vitest from inheriting `root: 'client'`. The client may import
the pure rules in `server/game/` to draw the board. After rebuilding a Game, restart the Hub's
dev server: it does not see a recreated `dist/version.json`.

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
  - `three`, for a client that draws in 3D;
  - its own files, one folder deep (`../game/x.js`), plus `../../manifest.js`.

  `vite.config.ts` and `vitest.config.ts` are build tooling and may import anything.
- Every `Game` has tests with `testGame` (`server/game/<Name>Game.test.ts`; legacy:
  `src/game/`).
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
- **Tables**: the game draws only its board, from the room snapshot.
- **`testGame`** takes a plugin or a `Game`. It offers:
  - `send`, `error`, `view` and `assertHidden`;
  - `command(line)` for optional game dev commands, catalog references and semicolon chains;
  - `bot`, `newGame`, `timer`, `fireTimer` and `leave`;
  - the option `bots`.

Before finishing a game change, also play it in the sandbox.
