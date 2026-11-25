# Cờ Tỷ Phú

Rules: `server/game/model.ts` first, words in `GLOSSARY.md`, numbers in `server/game/tuning.ts`
(run `npm run simulate` after changing one, see `games/AGENTS.md`).

## Client

`client/` is a Vite + Three.js client (`games/AGENTS.md`). `main.ts` queues each `match:state`
push and plays it on the board one after another (the computer's moves arrive at once; `pace`
plays them 2× under "Tốc độ" Nhanh, which the `View` carries as `speed`, and faster while more
wait), then shows the newest view's decision: its title and text printed on the board, the
deciding player's buttons at the bottom (with "Bán" and what it fetches while the deed of one of their Lots is open in their turn: `freeSale`), and for a roll the dice to tap (a transparent `#roll`
button kept over them, wider than they are drawn). Two pure modules carry the logic, with
tests built on real Matches (`server/game/test-match.ts`):

- `decisions.ts`: `decide(view, seat, names, sale)` is the panel a seat sees: title, text, buttons
  and the Tiles a tap may pick (Sân bay, a Card's Lot, a Debt's Lots), and the Card it is about. Prices come
  from `economy.ts`, so they match the server.
- `present.ts`: `changes(before, after)` lists what to play between two views: dice, getting out
  of jail, walks and jumps (into jail, a flight, a Card's move), the Card drawn (after the token reaches the Tile it is drawn on, `Drawn.tile`, as a flight lands before its Tile acts), Lots and marks,
  a Full set made, all four bến xe or both Điện lực and Cấp nước owned (`monopoly`, hailed "Ông hoàng vận tải!" or "Con cưng Nhà nước!" after a 2D overlay in `monopoly.ts` (a convoy of buses and trucks on a road under gold rays; a storm over a faceless engineer in a yellow hard hat; `convoy`, or `rain` with a `thunder` per strike, play under it), then the same lighting over the whole board and confetti; their Tiles keep a Full set's gold rim), the Quiz result, a Thuế landed on (`tax`: the cash it was worked out on, the rate and minimum, billed to Ngân hàng with its sum printed under the title), money paid from one player to another (`pay`, worked out from
  the cash, with `why`: rent, a Takeover, a Card or a Debt), each player's cash, and Bankruptcy
  with the Lots it takes down. `grandeur(amount)` is how grand a payment looks (0–3).

`scene.ts` is the board (`show` places everything; `tileAt` picks) and plays the moves: `roll`
throws the dice with bounces, or under Kẹt xe both, a taxi (`car()` in `pieces.ts`) popping up to knock the second off the screen and staying parked until that player's turn is over, `walk` hops Tile by Tile with the camera following (it comes in only while a token moves and for a Takeover or a new Hotel, and goes back over the whole board once that is done: a plain buy or Level does not move it), `jump` drops
the bars round a jailed token (after `verdict.ts`: a faceless lawyer pointing, "Có tội!!!" in a jagged shout, with the `guilty` stinger) or sends the plane (`plane()` in `pieces.ts`, the legacy Blender
model rebuilt from its ellipsoids) to pick the token up at Sân bay, turn over the board and drop
it with an impact, `release` lifts the bars, `build` raises houses and Hotels and sinks those
sold. The tier-1 moments (#355) are there too: `build` snatches a Lot Taken over (houses yanked up,
spun, slammed down in the taker's colour) and puts a new Hotel in a beam of light, `fullSet` lights
the set's Tiles one after another, `fall` topples a bankrupt token and crumbles its Lots, `aim` lights the Tile a mouse is over while picking a flight's Tile, with a gold arc from Sân bay to it (`pointermove` in `main.ts`, mouse only). `knock` (Phí bảo trì: a hammer knocks on each Lot, with dust), `vault` (Lãi tiết kiệm: a hoard of gold pops up for `moments.shower` to fly the money out of to the player's card), `seatGods`/`luck` (Thần tài: `godOfWealth` in the holder's colour sits in a corner of the board while the Effect lasts, and the extra rent it brings bursts off it while the bill shows the rent without it), `exempt` (Miễn thuê, for its holder only: the price of every Lot of others crossed out for a green 0, through `reprint` and `ambience`). `cardmoments.ts` has a crow fly off with a wallet over a clear screen while the cash counts down (Mất ví), viruses and "Mất lượt" (Ốm), and a signed jail-free pass (Vé ra tù); Khởi nghiệp's holder's card burns (`.aflame`). `levy` has a Card that counts Lots, houses or Hotels (Được mùa, Du lịch, Sửa nhà, Thuế Khách sạn) touch each Lot it counts at once (sparks, and that Lot's share floating up; `levied` in `main.ts` picks them after the Card closes). `payday` has Xuất phát pay where it stands, whether a token lands or passes (its Tile flashes, sparks, "+200" floats up and its arrow's outline blinks neon through `ambience`), `victory`
throws sparks round the winner, and `shake` shakes the camera. Bulbs run round the base's rim (`lights.ts`, one instanced mesh), every other one lit, swapping about twice a second; `fullSet` hands them a `LightShow`: a Full set lights the bulbs by each Tile in its colour as the Tile lights, then the whole rim blinks it; the four bến xe light the rim side by side, then an "O o ." run goes round once clockwise; Điện lực and Cấp nước crackle orange along the bottom and left sides and ripple blue out of the top right corner. `cheer` celebrates a Quiz answered right: fireworks twinkling green and gold, a rainbow spinning clockwise, three green flashes. `jump` turns the rim white into jail, and puts it out for a flight until the token lands, when a wave runs out from that Tile. `selling` shows a Debt's sale being picked (an arrow bobbing over each of the debtor's Lots, a gold tag over each picked; a tap cycles its part with `nextSale`). `say` prints every event's text in
the middle of the board, which is otherwise left blank in a Match, and `status` the decision
waiting there between them (the roll blinking, its dice hopping: `inviteRoll`); `diceRect` is
where the dice are on screen. `setGraphics` follows the Hub's
Đồ họa (its doc lists what `low` drops) and `setFollowing`
the player's "Máy quay bám theo" preference (`manifest.ts`). `cardshow.ts` is the Card drawn, in
2D over the board: the deck and its top card pulled off, then the Card turning over; tapped to
close, or its choices dealt beside it as cards to tap; a Quiz is printed on its Card with the
four answers dealt round it, two each side, where the answer is revealed. `moments.ts` is the HTML
side of a payment: its bill (warmer paper as `grandeur` grows; from 2 the screen shakes and its
edge glows red), which its payer taps "Thanh toán" on or which pays itself after 5 s, stamped
"Đã thanh toán", then coins and notes flying from the payer's card to the payee's while both
cards' cash counts; and confetti. `hud.ts` is the rest of the HTML over the board (player cards,
their counting cash and "Phá sản" stamp, the decision's buttons, a Tile's details as a land deed in two halves either side of the board, leaning in: what it is and whose on the left, its rents on the right with the row in force lit, the end with
its fanfare). `sound.ts` plays the effects in `assets/` (ElevenLabs, see `assets/AGENTS.md`)
at the Hub's effects level and loops one background track at its music level: any
`assets/music-*.mp3` the owner adds (one picked per page load; `music-co-ty-phu-a.mp3` is
"Waiting for the Next Turn", its fading tail cut at 175.5 s so the loop restarts at once). `main.ts` times each effect to its animation's
beats in `scene.ts`, `cardshow.ts` and `moments.ts` (the dice's three bounces, a clink per coin
landing, a chime per Tile of a Full set), so change those numbers together.
Three medallions sit at the top middle, clear of the Hub's corner buttons: fewer effects (low
graphics whatever the Hub's Đồ họa, and no bulbs), ×2 (every move plays twice as fast), both kept
in `localStorage`; and between them, for the only person at a table of computers, pause: `pause` stops the server's clock and the computer (`State.paused`), the client
finishes the move playing and holds the rest until `resume`.
`?showcase` on the client's URL (through the Harness; `showcase.ts`) plays the Card moments (Mất ví, Phí bảo trì, Lãi tiết kiệm, Thần tài, Miễn thuê, Khởi nghiệp, Ốm, Vé ra tù), a Kẹt xe roll, Du lịch and Sửa nhà, a Full set, a Quiz answered right, both monopoly moments, the jail verdict, Xuất phát's pay, a flight's aim, a jailing and a flight for seat 0 on the first view of a Match, then plays on.
`npm run smoke:web` rolls on the dice and plays the next decision in CI.

## Look

The board look prototype (#351) is `prototype/`: a still Three.js scene with made-up state in an
844×390 phone frame. Run `npm run prototype -w @xomdao/game-co-ty-phu` and open
http://localhost:8041/ (`?pitch=<degrees>` tries another camera angle). `?splash` draws the
Hub's splash art from the same scene; `npm run splash -- co-ty-phu` renders it to
`hub/key-art.png`. The prototype is not built or shipped; it draws with the client's `print.ts`, `special.ts`, `pieces.ts` and `ambience.ts`.

Direction, reviewed by the owner on #351:

- Three.js, everything drawn in code: a model board floating in dark space with stars, Tiles
  printed flat on one Canvas 2D texture (name, price, icon, Colour set band on the inner edge).
  The Xuất phát arrow points the way play runs (left along the bottom).
- The camera looks straight at the board from 56° above it, with Xuất phát at the bottom right.
  The board fills the screen height, pieces included, and leaves the sides for the player cards;
  the Hub's 48×48 top-right corner stays empty. All Tile text reads upright.
- Ownership in the owner's seat colour: a tint over the Tile (not its band) and a strip on its outer edge. Levels
  1–4 are that many houses on the band; a Hotel is one larger building with white trim and a gold
  cap. A Full set has a gold rim round its three Tiles. Unowned Tiles show only the print.
- Tokens are glossy pawns in the seat colour, smaller than a Tile is wide; the dice
  and the Cơ hội and Khí vận decks sit in the middle of the board. Dice are red with rounded,
  gold-rimmed edges and the number in a pea-green disc on each face, not pips.
- The Tiles that cannot be owned (corners, Cơ hội, Khí vận, Thuế) are filled with their own
  colour with name and icon in cream, and their icon itself moves, flat on the Tile: nothing
  rises off the board. `special.ts` draws each icon at a time (at rest without one) and
  `client/ambience.ts` repaints a canvas laid over each such Tile, and over Điện lực and Cấp nước
  (whose icons `print.ts` moves: the bolt flashes with sparks, a drip falls into ripples), at 30 fps. Two lights run from the
  Xuất phát arrow's tip round to its tail; the plane bobs with a trail from each wingtip; the "?"
  sways and hops; the chest's lid lifts and lets out sparkles; Thuế is a chart that draws itself
  climbing; a glint runs across Nhà tù's bars; the Vào tù cuffs swing.
- Seat colours match Đặt Bom (red, blue, yellow, green); nothing else on the board uses them:
  bến xe buses are grey, Xuất phát royal purple, Khí vận teal, Cơ hội orange, and the Tp. HCM
  set bronze. Card backs are the deck colour with its icon repeated small (`cardBack`). Vào tù is
  handcuffs. Colour set colours are in `SET_COLORS` (`client/print.ts`), approved.
