# Hub (@xomdao/hub)

The web app players open: a React + Vite SPA with no SSR. It logs in, opens and joins Rooms,
embeds the running Game in an iframe at `/games/<id>/` (same origin) and shows the results.
Vocabulary is in `GLOSSARY.md`.

## Layout

```
src/router.ts      History routing (`/`, `/room/<code>`, `/dev/kit` in dev), View Transitions,
                   `block()` holds the screen while a Match runs
src/net/store.ts   The one socket (`/ws`) and the Session state; every push and reply is parsed with
                   `@xomdao/shared/client` first. `net/hub.ts` makes the page's store + `useHub`
src/games.ts       Games the Hub ships: `games/*/manifest.ts` + `dist/version.json` + the art and
                   rules pages in `dist/hub/hub.json`, globbed at build time; `wip` ones are hidden on Vercel production
src/kit/           Button, CutPanel, Chip, TextField, Dialog, Sheet, Tabs, Choice, Toggle, Menu, Toast, Icon:
                   no server knowledge. `toast()` needs `<ToastRegion />` (mounted in main.tsx)
src/screens/       login/, lobby/ (the picked Game's art fills the screen, `GameStrip` picks), room/ (waiting room = `PlayerSlot` x seats + `RoomOptions` drawn from the manifest, GameFrame = iframe + Bridge, Results), rules/ (RulesPager), friends/ (FriendsSheet, InviteSheet, InviteNotice), profile/ (`/profile`, `/profile/<id>`), kit/
src/display/       Phone screen: fullscreen + landscape lock (`fullscreen.ts`, `FullscreenToggle`), `RotateNotice`
src/sound/         Interface sounds on Web Audio (`sounds.ts`, faked in tests; `index.ts` wires the files from
                   `assets/app/audio/`), `SoundToggle` = the mute button
src/styles/        tokens.css (colours, type, spacing, `.cut-br`), base.css, fonts.ts (@fontsource)
public/            `manifest.webmanifest` and `icons/` (PWA), copied to the build root
vite.config.ts     Dev proxy, /games/<id>/ in dev, copies each Game's dist/ (minus server/) into the build
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
- Check screens at 844×390, 667×375 and 1280×720. `/dev/kit` shows the kit at the phone sizes.
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
- Touch targets ≥ 44 px and main buttons ≥ 56 px on `pointer: coarse`, text ≥ 14 px, inputs
  ≥ 16 px (iOS zooms on smaller), `safe-area-inset` respected.
- Browsers: Safari iOS 18+ and Chrome Android of the last two years. Baseline "Newly available"
  features are fine behind a feature check that leaves older browsers working; no heavy
  polyfills. Desktop only has to work.

## The Bridge, Hub side

`screens/room/GameFrame.tsx` mounts the iframe when a Match starts and keeps it until the player
goes back to the waiting room, so playing again reuses it.

- `ready` → `init` (player, Room seats, `vi`, settings, `match` = the latest `view` or `null`),
  then `match:ready` once per Match.
- A new Match or a reconnect → a fresh `init`.
- Every `match:state` push → `message('match:state', data)`: the whole push, `view` included.
- `send` → `match:move { matchId, event, payload }`; the server's refusal goes back in `ack`.
- Results show on `done`, or 4 s after the Match is over if the Game never says it. Places come
  from the `match:state` that ends it (`match:result` is not resent after a reconnect).
- Rules: `screens/rules/RulesPager` is a modal `<dialog>` over everything, opened from the
  waiting room's "Luật chơi" button and from the corner menu during a Match (the Match keeps
  running under it). It is a scroll-snap track, one slide per page of `HubGame.rules`; mount it to
  open it. It never opens by itself.
- `settings` follows the Hub's mute (`volume` is always 1) and is resent when it changes.
- Not built yet: a volume control and emotes in the corner.

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
  Choice, Tabs and Menu already click; the lobby strip and Results add theirs. A sound still not
  ready 300 ms after its tap is dropped.
- Mute is `xomdao.muted` in localStorage, on one master gain, and goes to the Game as `settings`.
  The Game unlocks its own audio on its first tap (issue #202); the Hub's unlock does not cover it.

## Deploy

One Vercel project (`vercel.json` at the root): the Hub at `/`, each Game at `/games/<id>/`.
`turbo run build --filter=@xomdao/hub` builds every Game first, through `@xomdao/shared`'s
devDependencies.
The build bakes in `XOMDAO_SERVER_URL` (the Render server); the Hub calls it directly for
`/api` and `/ws`. Every other path serves `index.html`.
