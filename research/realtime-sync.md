# Realtime sync for Realtime games

Research for #201 (map #200). Question: how should a **Realtime game** (browser, friends, a few
players per **Room**) sync **Match state**? Options: Colyseus, a tick loop in the current NestJS
server, or a separate service. Also: WebSocket vs WebRTC/WebTransport, prediction and
interpolation, Render hosting cost, and clients in any engine (Godot 4 web, Phaser, Unity web).

Checked 2026-11-20. Sources are linked inline.

## 1. Transport: WebSocket is the only practical choice on Render

- **Browsers give no raw UDP/TCP.** Unity: "web browsers do not allow direct access to TCP or UDP
  sockets", and `System.Net.Sockets` / `System.Net.WebSockets` are unavailable in Web builds
  ([Unity Web networking](https://docs.unity.com/en-us/engine/current/manual/platform-specific/webgl/develop/networking)).
  The choices are WebSocket (TCP), WebRTC DataChannel or WebTransport (both can be unreliable /
  unordered).
- **WebTransport** is "Baseline 2026, newly available" (since March 2026): Chrome 97, Firefox 114,
  Safari / iOS Safari 26.4 ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebTransport),
  [browser-compat-data](https://github.com/mdn/browser-compat-data/blob/main/api/WebTransport.json)).
  It needs an HTTP/3 (QUIC, i.e. UDP) server. Phones on iOS < 26.4 cannot use it.
- **WebRTC DataChannel** works everywhere that matters (Chrome 24, Firefox 22, Safari/iOS 11;
  `ordered` / `maxRetransmits` for unreliable mode,
  [browser-compat-data](https://github.com/mdn/browser-compat-data/blob/main/api/RTCDataChannel.json)).
  Godot's web export has WebRTC built in, but it needs a signaling server
  ([Godot docs](https://docs.godotengine.org/en/stable/tutorials/networking/webrtc.html)), plus
  STUN/TURN and a UDP-reachable peer for a server-authoritative setup.
- **Render routes public traffic to one HTTP port per web service**
  ([web services](https://render.com/docs/web-services)); its docs cover HTTP and WebSocket only
  and never mention UDP ([WebSockets on Render](https://render.com/docs/websocket)). So a
  server-side WebTransport or WebRTC endpoint is not something Render documents; it would need
  another host.
- **WebSocket costs**: TCP head-of-line blocking (one lost packet delays the following ones). For
  a few friends on decent connections, with an interpolation buffer (below), this is acceptable;
  it is what Colyseus uses by default too (WebSocket is its default transport,
  [Colyseus room docs](https://docs.colyseus.io/room)).
- **Any engine can speak WebSocket + JSON**: browser JS (Phaser), Godot's `WebSocketPeer`, Unity
  through a JS plugin / its Netcode (Unity's own doc only names Netcode for GameObjects as the
  supported route). This keeps the "Game in any engine" goal of #200 simple.

## 2. Prediction and interpolation (what the client must do)

From Gabriel Gambetta's series (the standard reference):

- **Authoritative server**: "the one and only authority regarding everything that happens in the
  world is the server"; clients send inputs, not results
  ([part I](https://www.gabrielgambetta.com/client-server-game-architecture.html)).
- **Client-side prediction + server reconciliation**: the client applies its own inputs at once,
  tags each with a sequence number, the server echoes the last processed one, and the client
  re-applies inputs the server has not acknowledged yet. It needs game logic that is
  "deterministic enough" and runs on the client too
  ([part II](https://www.gabrielgambetta.com/client-side-prediction-server-reconciliation.html)).
- **Entity interpolation**: draw *other* players "in the past", between two received snapshots,
  about 100 ms behind ([part III](https://www.gabrielgambetta.com/entity-interpolation.html)).
  This alone hides jitter and TCP hiccups and needs no shared logic.
- Valve's Source docs (same model, 100 ms interpolation default) were not reachable (HTTP 403) and
  are not cited.

Consequence for "any engine": interpolation is cheap and engine-local. Prediction requires the
Game's movement rules on the client. A Phaser/JS client can import the same TypeScript; a Godot or
Unity client must re-implement it. So the platform should require **inputs + seq + snapshots +
interpolation**, and leave prediction as an opt-in per Game.

## 3. The three server options

### A. Colyseus

- MIT licensed ([LICENSE](https://github.com/colyseus/colyseus/blob/master/LICENSE)).
- Gives rooms, matchmaking, reconnection, a binary delta-encoded `Schema` state ("only the latest
  mutation of each property is queued and sent", [state docs](https://docs.colyseus.io/state)).
  Defaults: `patchRate` 50 ms (20 Hz) and a 16.6 ms (60 Hz) simulation loop
  ([room docs](https://docs.colyseus.io/room)). Schema has limits, e.g. 63 fields per class.
- Client SDKs for TypeScript, Unity, Godot, Defold, Construct, GameMaker, Cocos, Haxe and more.
  **Godot SDK is a GDExtension "in beta, and may not be stable"**, needs "Extensions Support" in
  the web export, and does not support Godot Mono
  ([Godot SDK](https://docs.colyseus.io/getting-started/godot)).
- It is its own server (`defineServer()` + `listen()`, [server docs](https://docs.colyseus.io/server));
  the docs mention an Express-compatible hook but nothing about NestJS. In practice it means a
  second process / Render service, with its own auth bridge to our accounts. Scaling beyond one
  process needs a shared presence and driver ([deployment](https://docs.colyseus.io/deployment)).
- Cost of adoption: every Realtime Game is tied to the Colyseus protocol and SDK, and the backend
  now has two room systems (NestJS for Turn-based, Colyseus for Realtime).

### B. Tick loop inside the current NestJS server

What exists today (`apps/server/src/rooms/`):

- `ws.gateway.ts` already runs a raw `ws` `WebSocketServer` on `/ws` (not `@nestjs/websockets`),
  JSON messages `{ id, event, data }` with acks, 64 KB max payload, 25 s ping. Binary frames are
  currently ignored.
- `rooms.service.ts` keeps rooms in memory and already schedules one game timer per room
  (`syncTimer` / `fireTimer`), and `rooms.gateway.ts` broadcasts the full state on each change.
- NestJS gateways themselves say nothing about tick loops or binary payloads
  ([NestJS gateways](https://docs.nestjs.com/websockets/gateways)); a loop is plain Node
  (`setInterval` per Room) either way.

A Realtime Room would add: an input event (`{seq, input}`) queued per player; a per-Room fixed
step (e.g. 20–30 Hz) that calls the Game's `tick(state, inputs, dt)`; a snapshot broadcast at
10–20 Hz with `lastSeq` per player; and the result reported to the existing match/ledger code.
Pros: one service, one cold start, auth, accounts and rewards reused, no new client SDK. Cons: we
write rooms-for-realtime ourselves (no free delta encoding or reconnection logic), and Game ticks
share the event loop with HTTP and DB work.

### C. A separate realtime service written by us

Same code as B but in its own process. Gains isolation (a heavy tick cannot slow the API) and
independent deploys. Costs a second Render service, a token handoff from the backend, and a
second cold start. Only worth it when load or isolation demands it; B can be shaped so the move is
mechanical (see recommendation).

## 4. Render: what it means for hosting

- **Free plan**: 0.1 CPU, 512 MB ([compute plans](https://render.com/docs/compute-plans)). Spins
  down after 15 minutes with no inbound traffic; WebSocket messages count as traffic, so a match
  in progress keeps it awake. Cold start "about one minute". 750 free instance hours per
  workspace per month, shared by all free services. Render "might restart a Free web service at
  any time". Single instance only ([free plan](https://render.com/docs/free)).
- **All plans**: no max WebSocket duration, but connections drop on every deploy (30 s SIGTERM
  grace, up to 300 s) and on restarts ([WebSockets](https://render.com/docs/websocket)). In-memory
  Match state is lost then; reconnection must be designed in. Multiple instances would put a
  reconnecting client on a random instance, so stay on one instance or add sticky routing.
- **Bandwidth**: Hobby workspaces include 5 GB outbound per month, then $0.15/GB
  ([outbound bandwidth](https://render.com/docs/outbound-bandwidth)). Rough estimate: 4 players,
  20 snapshots/s, ~300 B JSON each = ~24 KB/s ≈ 86 MB per Room-hour, so ~58 Room-hours a month
  fit in 5 GB. Halving the rate or sending compact/binary deltas multiplies that. Fine for a
  friends group, but worth measuring.
- A second service (options A or C) doubles cold starts and splits the 750 free hours.
- Higher plans (starter 0.5 CPU, standard 1 CPU / 2 GB) remove spin-down; prices are on Render's
  pricing page (not captured here).

## Recommendation

**Option B: run Realtime Rooms as a fixed-step tick loop inside the existing NestJS server, over
the existing `/ws` WebSocket.**

- Protocol (engine-agnostic): client sends `input` with a sequence number; server sends snapshots
  of Match state at 10–20 Hz with each player's last processed `seq` and a server tick/time.
  Start with JSON; switch to binary or delta encoding only if the bandwidth number above bites.
- Client contract every Game must meet: interpolate remote entities ~100 ms behind. Prediction and
  reconciliation are optional per Game, practical when the client can reuse the TypeScript rules
  (Phaser/JS) and a port otherwise.
- Shape the Game's realtime server as a pure module in `games/<id>/` (`init`, `tick`, `result`)
  behind an SDK interface, so it can later run in a `worker_thread` or in option C's separate
  service without changing clients.
- Design for reconnects (Render deploys and free-plan restarts drop sockets); a short snapshot
  replay on rejoin is enough for friends' games.
- Do not use WebRTC/WebTransport now: Render does not document UDP, iOS needs 26.4+ for
  WebTransport, and WebRTC adds signaling and TURN.

**Trade-offs accepted**

- We write what Colyseus gives for free (delta encoding, reconnection, matchmaking). For a few
  players per Room and a handful of Rooms, the simple version is small.
- Ticks share one Node event loop and 0.1 CPU on the free plan. Watch tick drift; move to a paid
  plan or a worker/separate service when it shows.
- TCP-only transport: a lost packet stalls a few frames. The interpolation buffer hides most of it;
  fast twitch games (shooters) would feel it most.

**When to revisit**: choose Colyseus if we want many Realtime Games quickly and accept its SDKs
(and the beta Godot GDExtension) as the Game-facing contract; choose option C when Realtime load
starts hurting the API, or when we leave Render's single-instance limits.
