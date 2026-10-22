# Godot client (apps/client)

The Xóm Đảo client, the only one: one Godot 4 project in typed GDScript, exported to the web
(`docs/adr/0001-godot-client.md`) and served as the site at `/`. Game rules stay in TypeScript on
the server; this project only shows state and sends moves. Folder guide (Vietnamese):
`apps/client/README.md`.

## Toolchain

- The Godot version, the editor and template hashes, GUT and gdtoolkit are pinned in
  `tools/godot/version.json`. `npm run setup:godot` installs them into `.tools/` (editor in
  self-contained mode, so its settings stay there too) and GUT into `addons/gut/` (ignored).
  Changing the version means new hashes: the editor zips' from the release's `SHA512-SUMS.txt`,
  the two `web_nothreads_*.zip` from inside the verified `.tpz`.
- `npm run godot -- <args>` runs the pinned Godot on this project (`-- --editor` opens it).
- Never run a Godot from elsewhere on this project: another version rewrites `project.godot`,
  scenes and `.uid` files.

## Layout

```
project.godot       1280 × 720 base; fixed 16:9, 18:9, 19.5:9, 20:9 presets (canvas_items + keep, black bars), landscape, Compatibility renderer
core/               Autoloads: FramePresets (best-fitting fixed frame on startup and resize), Net (the app's XomDaoClient, server_url()), Session (saved token, /api/auth register/login/logout),
                    Wallet, ContentLoader (game packs), TestBridge (window.xomdao on debug web; xd on debug desktop)
  xd_server.gd      xd's control channel (tools/xd): line JSON on 127.0.0.1, debug desktop builds with --xd-port
hub/                main.gd routes the screens: lobby (island ring + HUD), select (game select),
                    ben (Bến), room (waiting room), the game with ☰, the result over it
  lobby/            HubLobby, HubIslandRing (ring layout, swipe/tap), HubIsland (drawn islands)
  select/           Game select: a rail of posters (splash art/ + flat logo/), genre objects
  touch_cancel.gd   DOM touchcancel capture for web gestures (before Godot releases the touch)
  xd_nav.gd         xd's `go`: opens hub places and sandboxes through main.gd's own methods
  ben/ room/        Bến; waiting room (seat cards, option rows), result, paged Luật board
  home/ shop/       Nhà (HubHome: tabs stacked down the left beside one page, someone else's
                    read-only; avatar and frame equipment lives in Túi đồ) and Chợ (HubShop:
                    avatars, frames, card backs, emotes)
  gallery/          Every UI kit component on 4 pages: ?gallery=<page> or `-- --gallery=<page>`
dev/                Isolated visual workbench host; excluded from web exports
addons/xomdao_sdk/  The only API a game's Godot code uses: XomDaoFrame, XomDaoClient (client.gd)
  ui/               The shared UI kit (theme, widgets, fonts, Phosphor icons, UI sounds)
  generated/        XomDao<Type> classes + XomDaoProtocol from npm run gen:protocol (never edit)
content/<id>        Symlinks to games/<id>/godot, made by npm run godot:link (ignored)
test/               GUT tests of the core (test_*.gd)
export_presets.cfg  The Web preset: single-threaded, PWA
```

## Rules

- Static types everywhere: `debug/gdscript/warnings/untyped_declaration` is an error.
- A game's Godot files (`games/<id>/godot/`) reach only their own folder (`res://content/<id>/`)
  and `res://addons/xomdao_sdk/`: no `uid://` in scripts, no autoloads, no class_name of the core
  or of another game. `godot:check` enforces it.
- A game's tests are `test_*.gd` anywhere in its folder; its `test/` folder is left out of its pack.
- The main scene prints `xomdao:ready`; `godot:smoke` waits for it.
- Web safe areas come from CSS env(safe-area-inset-*) through XomDaoFrame.safe_inset,
  converted from CSS pixels to frame units, less what the black bars already cover. The exporter adds viewport-fit=cover to the shell.
- A game's Godot entry is `res://content/<id>/main.tscn`. Its root gets `bind(client:
  XomDaoClient)` once in the tree, draws `client.snapshot` and follows `state_changed`. It may
  define `sandbox_options() -> Dictionary`, the room options for `?play=<id>` (debug builds: a
  real room with the computer in the seats, started at once), and `room_setup() -> Array`, the
  rows of options on the waiting room's plate
  (`{key, label, options: [[label, value], …], default?}`: the first
  option is picked, or the one at index `default`), and `result_detail() -> Dictionary`, what
  the result board adds under its title: `{reason: String, rows: [[label, value], …], layout?: "right"}` after the
  hub's own Thời gian row. `layout: "right"` docks the panel on the right for a game's end-of-game presentation.
  `layout: "right"` docks the shared result HUD on the right and leaves uncovered table controls
  interactive. Optional `result_area() -> Rect2` docks it in a game-provided area without a screen
  shade and also leaves uncovered table controls interactive. Pair it with
  `set_result_visible(shown: bool) -> void` to follow Xem bàn / Kết quả. Optional
  `result_reopen_theme() -> Dictionary` styles the shared Kết quả button with `StyleBox` values for
  its `normal`, `hover`, `pressed`, `hover_pressed` and `disabled` states, plus an optional
  `font_color: Color`; the button sits at the bottom right while the result board is hidden.
  Games without this hook keep the centred result overlay.
  Games with voluntary elimination may also define `can_declare_bankruptcy() -> bool` and
  `declare_bankruptcy() -> bool`; the hub uses these hooks to confirm and apply bankruptcy before
  leaving a live room.
  A game's `music/` folder (`res://content/<id>/music/`) is its background music: the hub's
  `HubMusic` plays a random track while the game is on, at the settings' music volume.
  The hub draws the ☰ menu, the room, the result (Xem bàn puts it away to look at the final board, Kết quả brings it back) and Luật (the game's RULES.md, which
  `godot:export` puts in its pack); the game draws only its table.
- A catalog card is playable here only when the client has its pack (`ContentLoader.available()`);
  the others show "Sắp có". The game on CHƠI is kept per account in `user://hub.cfg`.
- `ContentLoader.load_game(id)` gives that scene: from the `content/<id>` link in the editor and
  headless, otherwise it downloads `content/<id>.<hash>.pck` (listed in `content/manifest.json`
  next to the page) into `user://content/` once and loads it.
- The server URL: `window.XOMDAO_SERVER` when the export baked it in (`XOMDAO_SERVER_URL`, or
  the older `VITE_SERVER_URL`), else the page's own origin (`npm run dev` proxies `/ws`); off the web
  `XOMDAO_SERVER` or ws://localhost:8033/ws.
- Name every node a test taps or reads (`Cell_<x>_<y>`, `Play`, `RoomCode`, `Island_<genre>`…). The debug
  bridge `window.xomdao` (`core/test_bridge.gd`): `scene()`, `tree(depth)`, `text(name)`,
  `rect(name)` (CSS px), `click(name)`, `state()`. The hub sets `TestBridge.scene`.
  `scripts/e2e/godot.mjs` wraps it for scenarios (`tap` clicks with the real mouse).
- Debug desktop builds: `-- --xd-port=<port> --xd-key=<key>` opens xd's channel
  (`core/xd_server.gd`, one `_cmd_<name>` method per command; `tools/xd/xd.mjs` is the CLI).
  `--xd-profile=<name>` keeps that run's login token in `user://xd/<name>.cfg`, `--xd-token`
  seeds it, `--xd-sound` keeps sound on. `--play=<id>` and `--room=<code>` do what `?play=` and
  `?room=` do on the web. New command: add `_cmd_<name>` there, a verb in `tools/xd/xd.mjs`, and a
  line in `tools/xd/README.md`.
- The server connection is `XomDaoClient` (WebSocket + JSON on `/ws`): `connect_to_server`,
  `login_guest` / `login` / `login_token`, `create_room`, `quick_match(game_id)`, `join_room(code)`, `leave_room`,
  `start_game`, `send(event, payload)`, `owned_emotes()`, `send_emote(look)`, `request(event, data)`; signals
  `state_changed`, `room_changed`, `rewarded`, `emote_received`, `event_received`, `error`,
  `connected`, `disconnected`. It
  reconnects and resumes by itself. Its header is the API reference.
- Protocol classes come from zod (`packages/shared/src/protocol.ts`): change the schema, then run
  `npm run gen:protocol`. JSON keys stay camelCase; fields are snake_case.
- Screens and games build their UI from the kit in `addons/xomdao_sdk/ui/`
  (docs/art-direction.md made into code), never their own buttons, fonts or HUD colours:
  - `XomDaoUi`: palette, fonts, icons (`XomDaoUi.icon("gear")`, Phosphor Fill), `theme()`,
    `money()` / `delta()`, `play()` for the shared sounds, `bounce()`;
  - widgets: `XomDaoButton` (colour by `XomDaoUi.Kind`), `XomDaoIconButton`, `XomDaoPuff` (the raised
    body of a text button: `XomDaoPuff.behind(button)` or `XomDaoPuff.paint(...)`; an icon
    button gets the lip without the gloss), `XomDaoBoard`,
    `XomDaoMoney`, `XomDaoDelta`, `XomDaoChip`, `XomDaoAvatar`, `XomDaoPlayerSlot`,
    `XomDaoGameTile`, `XomDaoChoice`, `XomDaoSlider`, `XomDaoToast`, `XomDaoDot`, `XomDaoDivider`, `XomDaoMenu`;
  - card games: `XomDaoCard` (a playing card, face or back) and `XomDaoMat` (the straw mat);
  - `XomDaoSettings`: music and sound effects (a switch and a volume each), HUD scale, margin,
    picture quality (user://settings.cfg). The quality is saved but does not change the
    rendering yet. Music plays on the `Music` bus and every sound effect on the `Sfx` bus
    (`default_bus_layout.tres`): a game sets `bus = XomDaoSettings.SFX_BUS` on its players.
  Each script's header shows its use. Add a new component to the gallery
  (`hub/gallery/gallery.gd`) and check it there.
  - `client.owned_emotes()` lists the emote look ids you own. `XomDaoLooks.emote(look)` loads a
    shared sticker; games receive `XomDaoRoomEmote` on `client.emote_received` and choose how to
    draw it, while `client.send_emote(look)` sends one.
- Look at a gallery page without a browser:
  `xvfb-run -a npm run godot -- --rendering-driver opengl3 --resolution 1280x720 -- --gallery=2 --save=/tmp/g2.png`.
  For real phone sizes, serve `dist/` after `godot:export` and run
  `npm run shots -- <url> --path '/?gallery=2' --wait 12000`.
- `node scripts/ui-sounds.mjs` synthesizes the UI sounds (tap, panel, coin) again.
- Commit the `.uid` files Godot writes next to scripts.

## Commands

| Command | What it does |
| --- | --- |
| `npm run godot:check` | gdformat --check, gdlint, the boundary rule, headless import, compile every script and scene, GUT. `npm run check` runs it when Godot is installed |
| `npm run -s xd -- <command>` | Drive desktop debug clients: shots, node tree, taps, navigation, accounts, PvP rooms, dev console (`tools/xd/README.md`). Fastest way to look at a screen |
| `npm run godot:capture` | Ask the already-running desktop debug game to save its current root viewport to `.shots/godot-live.png`; pass `-- --output .shots/name.png` to choose another file, or `-- --timeout 30` to wait longer |
| `npm run godot:link` | (Re)make the `content/<id>` symlinks; check and export do it too |
| `npm run godot:export` | Web build into `dist/` (`-- --debug` for a debug build) plus `dist/content/<id>.<hash>.pck` and `manifest.json`. Full exports reuse unchanged packs from `.tools/export/packs`; `-- --debug --game <id>` refreshes one pack in a matching existing debug build. Runs on a copy in `.tools/export/` because Godot's export filters do not follow symlinks |
| `npm run godot:net` | Builds and starts a dev server (no database) on a free port, then runs the GUT tests that need it (`test_net.gd`, skipped by `godot:check`) |
| `npm run godot:smoke` | Serves `dist/`, opens it in headless Chromium at 800 × 360, waits for `xomdao:ready`, saves `.shots/godot-800x360.png` |
| `npm run godot:measure` | Download size and time to playable, first and repeat visit, on a throttled phone profile (`-- --server <url>` of a running server; `--cpu`, `--net`). Release build for sizes, debug build for every timing. Numbers go in `docs/adr/0001-godot-client.md` |
| `npm run godot:preview -- open <index> <scene>` | Open an isolated desktop preview in a numbered slot; see `apps/client/README.md` for refresh, animation and capture commands |

In the browser: `npm run dev` serves `dist/` at http://localhost:5033/ (`scripts/web.mjs`; export
again to see changes) and forwards `/api` and `/ws`. `npm run e2e -- --only godot-co-ty-phu-classic`
and `npm run shots -- --path '/?play=tic-tac-toe'` need a debug export there. CI's `godot` job runs
smoke and every shared flow, event, and Monopoly scenario against it. Vercel builds the client
(`tools/godot/vercel.mjs`:
release on production, debug on previews) and serves it at `/`; old `/godot/…` links redirect
there.

Format a script with `.tools/gdtoolkit/bin/gdformat <file>`.
