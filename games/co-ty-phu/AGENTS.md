# Cờ Tỷ Phú

Rules: `server/game/model.ts` first, words in `GLOSSARY.md`, numbers in `server/game/tuning.ts`
(run `npm run simulate` after changing one, see `games/AGENTS.md`).

## Client

`client/` is a Vite + Three.js client (`games/AGENTS.md`). `main.ts` queues each `match:state`
push and plays it on the board one after another (the computer's moves arrive at once; `pace`
plays them 2× under "Tốc độ" Nhanh, which the `View` carries as `speed`, and faster while more
wait), then shows the newest view's decision. Two pure modules carry the logic, with
tests built on real Matches (`server/game/test-match.ts`):

- `decisions.ts`: `decide(view, seat, names)` is the panel a seat sees: title, text, buttons
  and the Tiles a tap may pick (Sân bay, a Card's Lot). Prices come from `economy.ts`, so they
  match the server.
- `present.ts`: `changes(before, after)` lists what to play between two views: dice, getting out
  of jail, walks and jumps (into jail, a flight, a Card's move), the Card drawn, Lots and marks,
  the Quiz result, money and Bankruptcy.

`scene.ts` is the board (`show` places everything; `tileAt` picks) and plays the moves: `roll`
throws the dice with bounces, `walk` hops Tile by Tile with the camera following, `jump` flies
from Sân bay with a trail or drops the bars round a jailed token, `release` lifts them, `build`
raises houses and Hotels and sinks those sold, `drawCard`/`putCard` turn the Card over in front
of the camera. `setGraphics` follows the Hub's Đồ họa (its doc lists what `low` drops). `hud.ts`
is the HTML over it (player cards, panel, Card, a Tile's details, the end). `npm run smoke:web`
plays its first decisions in CI.

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
  `client/ambience.ts` repaints a canvas laid over each such Tile at 30 fps. Two lights run from the
  Xuất phát arrow's tip round to its tail; the plane bobs with a trail from each wingtip; the "?"
  sways and hops; the chest's lid lifts and lets out sparkles; Thuế is a chart that draws itself
  climbing; a glint runs across Nhà tù's bars; the Vào tù cuffs swing.
- Seat colours match Đặt Bom (red, blue, yellow, green); nothing else on the board uses them:
  bến xe buses are grey, Xuất phát royal purple, Khí vận teal, Cơ hội orange, and the Tp. HCM
  set bronze. Card backs are the deck colour with its icon repeated small (`cardBack`). Vào tù is
  handcuffs. Colour set colours are in `SET_COLORS` (`client/print.ts`), approved.
