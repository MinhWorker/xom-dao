# Hub (@xomdao/hub)

The web app players open: a React + Vite SPA with no SSR. It logs in, opens and joins Rooms,
embeds the running Game in an iframe at `/games/<id>/` (same origin) and shows the results.
Vocabulary is in `GLOSSARY.md`.

## Layout

```
src/router.ts      History routing (`/`, `/sea`, `/room/<code>`, `/profile`, `/dev/kit` in dev), View Transitions,
                   `block()` holds the screen while a Match runs
src/net/store.ts   The one socket (`/ws`) and the Session state; every push and reply is parsed with
                   `@xomdao/shared/client` first. `net/hub.ts` makes the page's store + `useHub`
src/games.ts       Games the Hub ships: `games/*/manifest.ts` + `dist/version.json` + the art and
                   rules pages in `dist/hub/hub.json`, globbed at build time; `wip` ones are hidden on Vercel production;
                   `soon` ones are only in `SOON_GAMES` (manifest + Emblem), for the Sea chart's locked cards
src/islands.ts     The Islands' names, order, Emblems and splash art, and `HUB_EMBLEM` (ids are `ISLANDS` in `@xomdao/sdk`)
src/island-art/    Each Island's splash art (`<island>.png`, 20:9), drawn by `scripts/splash.mjs`
src/harbour-art/   The Bến's characters (transparent) and backdrops, listed in `arts.ts`: to add art, drop the image here and add a line to `CHARACTERS` or `BACKGROUNDS`; see "Harbour art" in `assets/AGENTS.md`
src/emblems/       The Hub's (`hub.svg`) and each Island's (`<island>.svg`) Emblem, same contract as a Game's;
                   `tools/hub-assets` tests them
src/kit/           Button, CutPanel, Chip, TextField, Select (popover dropdown, placed by hand: `select.ts`), Dialog, Emblem (inlines an Emblem's SVG), Sheet, Tabs, Choice, Toggle, Slider, Menu, Toast, Icon,
                   Loops (looping HUD icons): no server knowledge. `toast()` needs `<ToastRegion />` (mounted in
                   main.tsx). `modal.ts`: `useModal` / `closeAnimated` open a `<dialog>` and play its exit.
                   `wait(promise, { block })` shows `<WaitBadge />` (main.tsx) once a request passes 300 ms;
                   `net/hub.ts` wraps every request in it, and Room create/join and Match start block
src/screens/       offline/ (OfflineOverlay, after 1 s without the server), login/, harbour/ (the Bến at `/`: Nhà opens the profile, "Ra khơi" the Sea chart, "Vào phòng" joins by code, Hàng xóm the FriendsSheet, Cài đặt the SettingsOverlay; Đình, Chợ, Kho and Bảng vàng are locked shells; `HarbourLook` picks the character and backdrop; `portrait.ts` has the avatar and frame pictures), sea/ (the Sea chart at `/sea`: Islands in a column, the Island's Games on a track that snaps one card at a time; "Ra khơi" makes the Room, Escape goes back; `chart.ts` builds the cards, `summary.ts` the Game's labels), room/ (waiting room = `PlayerSlot` x seats + `RoomOptions` drawn from the manifest, GameFrame = iframe + Bridge, MatchLoading over it until the Match starts, Results), rules/ (RulesPager), homeward/ (the Hub's loading screen on the way back to the Bến), friends/ (FriendsSheet, titled Hàng xóm, InviteSheet, InviteNotice), profile/ (`/profile`, `/profile/<id>`), settings/ (SettingsOverlay: Đồ họa, Âm thanh, Giới thiệu), kit/
src/display/       Phone screen: fullscreen + landscape lock (`fullscreen.ts`, `FullscreenToggle`), `RotateNotice`
src/sound/         Interface sounds on Web Audio (`sounds.ts`, faked in tests; `index.ts` wires the files from
                   `assets/app/audio/`), `SoundToggle` = the mute button
src/settings/      Each Game's preferences (`preferences`, `usePreferences`), graphics choices (`graphics`, `useGraphics`, `transitionsAllowed`, level, HUD scale, margin, frame: `frame.ts` has the screen shapes and `fitFrame`) and the Bến's character and backdrop (`harbour`, `useHarbourLook`), kept in localStorage
src/styles/        tokens.css (colours, type, spacing, `.cut-br`, `.glass`, `data-loop`), base.css (hand cursor), fonts.ts (@fontsource)
public/            `manifest.webmanifest` and `icons/` (PWA), copied to the build root
vite.config.ts     Dev proxy, /games/<id>/ in dev, copies each Game's dist/ (minus server/) into the build; /avatars/<id>.webp (the account pictures, from assets/app/images/avatar-<id>.webp) for Games to show a seat's `avatar`
```

## Working on it

- `npm run dev` at the root runs the Hub on :8030 next to the server. Your own copy:
  `XOMDAO_DEV_SERVER=http://localhost:8133 HUB_PORT=8130 npm run dev -w @xomdao/hub` against a
  server started with `PORT=8133`. `/games/<id>/` is served from `games/<id>/dist/`, so build the
  Game first.
- Tests (Vitest) cover the router and the store through their public functions; the store takes
  a fake socket, `fetch` and storage (`StoreDeps`). Add to them when you change either.
- `npm run smoke:hub` (root) drives two headless pages through friends and invites against a real
  server and the dev Hub; it saves screenshots to `smoke-hub/`. Run it when you change `screens/friends/`.
- `npm run e2e` (root) plays a whole Caro Match between two pages, from sign-up through the Bến and the Sea chart to Results, against a
  real server and the dev Hub; it saves screenshots to `e2e/`. Run it when you change the login,
  Bến, Sea chart, Room, GameFrame or Results.
- Check screens at 640×360, 667×375, 844×390, 932×430, 1024×768 and 1280×720 (landscape, 4:3 to about 21:9; under 360 px high is not supported). `/dev/kit` shows the kit at the phone sizes, at both
  graphics levels and with less motion; `/dev/kit#motion` is the approved motion prototype (#295), still the
  reference for the loading screens. `/dev/kit#emblems` shows every Emblem: the Hub's, the Islands' (#302) and the Games' (#303). The Sea chart is the real screen at `/sea` (approved in #306), with glass three-layer cards
  (`GameTiles`) and a rules button that opens `RulesPager`.
- Before writing client HTML/CSS/JS, look it up with the `modern-web-guidance` skill.

## Conventions

- Plain CSS: tokens in `styles/tokens.css`, one CSS Module per component. Native `<dialog>` and
  `popover` instead of component libraries; no animation library.
- Server state lives in the store and reaches components through `useHub(select)`
  (`useSyncExternalStore`). One-off HTTP (login, `/api/games`) goes through `fetch` in the store.
- Icons: `@tabler/icons-react`, one import per icon, `stroke={2}`. Fonts: Barlow Condensed
  (display), Be Vietnam Pro (body), Roboto Mono (labels), only the weights `styles/fonts.ts` loads.
- Import the protocol from `@xomdao/shared/client`. The package root also loads every Game's
  rules, which the browser never needs.
- HUD scale and margin (settings, Đồ họa): `watchGraphics` (`main.tsx`) sets `--hud-scale` and
  `--margin` on `<html>`; `body` has `zoom: var(--hud-scale)`, and `--safe-*` add the margin. `zoom`
  also scales viewport units, so in CSS never write `vw`, `dvh` or `vmin`: use `calc(N * var(--vw))`,
  `var(--view-h)` (the screen's height inside the safe area and margin), `calc(N * var(--dvh))` or
  `calc(N * var(--vmin))`. The Game's iframe is not scaled inside; only its box is.
- Frame (settings, Khung hình): `applyGraphics` fits a box of the chosen shape (`FRAMES` in `settings/frame.ts`)
  inside the screen and sets `data-frame` and `--frame-*` on `<html>`. `tokens.css` then makes `--vw`, `--dvh`
  and `--vmin` one percent of the frame, so every layout built on them fits it. `base.css` makes `body` the
  frame (`contain: paint`: `position: fixed` elements fill it and are clipped to it) with dark space around, and
  places a modal `<dialog>` on it. Build a screen from those units and `--view-h`, anchor it to the edges of its
  area, and size parts by ratios of their container (`cqw`) rather than in px: it then fits any frame. Portrait and `auto` have no frame.
- Touch targets ≥ 48 px (`--tap`) and main buttons ≥ 56 px (`--tap-main`), text ≥ 16 px (labels ≥ 14 px),
  `safe-area-inset` respected.
- Motion and glass: the graphics level (`Cao`/`Thấp`) is `data-graphics` on `<html>`. Put the global `glass`
  class on a panel instead of a background (solid on `low` or without `backdrop-filter`). Mark anything that
  animates forever with `data-loop` (on the element or the one whose `::before`/`::after` animates): it stops on
  `low`, under `prefers-reduced-motion` and in a `[data-reduce]` frame. A modal `<dialog>` closes through
  `useModal`/`closeAnimated`: its exit CSS keys on `[data-closing]` and its backdrop dims only while
  `[open]:not([data-closing])`; never transition `display` or `overlay`. The hand cursor is only under
  `(hover: hover) and (pointer: fine)`.
- Browsers: Safari iOS 18+ and Chrome Android of the last two years. Baseline "Newly available"
  features are fine behind a feature check that leaves older browsers working; no heavy
  polyfills. Desktop only has to work.

## The Bridge, Hub side

`screens/room/GameFrame.tsx` mounts the iframe when a Match starts and keeps it until the player
goes back to the waiting room, so playing again reuses it.

- `ready` → `init` (player, Room seats, `vi`, settings, `match` = the latest `view` or `null`),
  then `match:ready` once per Match.
- `MatchLoading` covers the iframe until the Game is `ready` and the Match leaves `loading`: the Game's
  Emblem (`HubGame.emblem`, on the diamond plate), a bar and each seat's load (yours from
  the Bridge's `progress`, the others' from `match:state`'s `readyPlayerIds`).
- A new Match or a reconnect → a fresh `init`.
- Every `match:state` push → `message('match:state', data)`: the whole push, `view` included.
- `send` → `match:move { matchId, event, payload }`; the server's refusal goes back in `ack`.
- Results show on `done`, or 4 s after the Match is over if the Game never says it. Places come
  from the `match:state` that ends it (`match:result` is not resent after a reconnect).
- While Results show, the eye button (`screens/room/Peek`) in the corner hides every element marked
  `data-hud` (Results and the corner's other buttons) while a mouse hovers it or a finger holds it,
  so the Game's last state shows. The Game does nothing for it.
- Leaving a running Match (the corner menu's "Rời ván", or the back button, which `router.block`
  turns into the same) asks first. Saying yes covers the screen with the Hub's loading screen
  (`screens/homeward/`, with the Hub's Emblem) until the Bến is up. While the Match
  view is open, the others hear who left, lost their connection or came back as toasts (`screens/room/notices.ts`). Results keep the
  names of those who left, marked "Đã rời", and "Chơi lại" waits for enough players.
- A reload or a dropped connection mid-Match comes back through `session:resume`; the Game
  gets a fresh `init` with the latest `view` and redraws from it.
- Rules: `screens/rules/RulesPager` is a modal `<dialog>` over everything, opened from the
  waiting room's "Luật chơi" button and from the corner menu during a Match (the Match keeps
  running under it). It is a scroll-snap track, one slide per page of `HubGame.rules`; mount it to
  open it. It never opens by itself.
- `settings` carries the Hub's volume, mute, `music` and `effects` levels, its `graphics` level
  (`high`/`low`) and the player's `preferences` for the Game, and is resent when any changes.
- A Game's `preferences` (manifest) are the player's own: `settings/preferences.ts` keeps them per
  Game in localStorage. The waiting room shows them under "Tuỳ chọn của bạn" (`MyPreferences`, beside
  `RoomOptions`; both draw each option with `OptionField`), and during a Match the corner menu's
  "Cài đặt" opens the SettingsOverlay with a first tab named after the Game.
- Not built yet: emotes in the corner.

## Phone screen

- Landscape only. `RotateNotice` (`main.tsx`) covers everything in portrait on a coarse pointer up
  to 600 px wide; iPhone has no fullscreen or lock, so this is its only help.
- Android Chrome: `enterFullscreen()` (needs a tap) takes the screen and locks landscape. It runs
  on the Room's "Bắt đầu" and "Sẵn sàng" taps; `FullscreenToggle` in the Match corner covers guests
  and a swipe out. The Room leaves fullscreen when the Match view closes. Nothing is offered
  once the app is installed, or where `document.fullscreenEnabled` is false.
- PWA: `public/manifest.webmanifest` (`standalone`, landscape) plus the Apple meta tags in
  `index.html` let a player add the Hub to the home screen, the only way to drop the browser bars on
  iPhone. There is no service worker: the Hub needs the server to do anything.

## Sound

- Nothing audible and no `AudioContext` exists until the player's first tap: `sounds.listen(document)`
  (`main.tsx`) unlocks on `pointerup`/`touchend`/`click`/`keydown` (iOS ignores `pointerdown` and
  `touchstart`), plays a silent buffer, and sets `navigator.audioSession.type = 'playback'` so the
  iPhone silent switch does not mute it. A tap after the browser interrupts audio resumes it.
- Play with `playSound(name)` (`hoverSound(event)` for a real mouse only). The kit's Button, Toggle,
  Choice, Tabs and Menu already click; the Bến's panels and Results add theirs. A sound still not
  ready 300 ms after its tap is dropped.
- Mute (`xomdao.muted`) and the levels `xomdao.volume` (master), `xomdao.music` and `xomdao.effects` (0 to 1) are in localStorage and go to the Game as `settings`; the settings overlay sets them. The Hub's own sounds are effects: the master gain is volume × effects. The Hub plays no music; `music` is for Games.
  The Game unlocks its own audio on its first tap (issue #202); the Hub's unlock does not cover it.

## Deploy

One Vercel project (`vercel.json` at the root): the Hub at `/`, each Game at `/games/<id>/`.
`turbo run build --filter=@xomdao/hub` builds every Game first, through `@xomdao/shared`'s
devDependencies.
The build bakes in `XOMDAO_SERVER_URL` (the Render server); the Hub calls it directly for
`/api` and `/ws`. Every other path serves `index.html`.
