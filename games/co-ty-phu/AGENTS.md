# Cờ Tỷ Phú

Rules: `server/game/model.ts` first, words in `GLOSSARY.md`, numbers in `server/game/tuning.ts`
(run `npm run simulate` after changing one, see `games/AGENTS.md`). The client is not built yet.

## Look

The board look prototype (#351) is `prototype/`: a still Three.js scene with made-up state in an
844×390 phone frame. Run `npm run prototype -w @xomdao/game-co-ty-phu` and open
http://localhost:8041/ (`?pitch=<degrees>` tries another camera angle). It is not built or
shipped; the client will reuse `prototype/print.ts` and `prototype/pieces.ts`.

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
  and the Cơ hội and Khí vận decks sit in the middle of the board.
- Seat colours match Đặt Bom (red, blue, yellow, green); nothing else on the board uses them:
  bến xe buses are grey, the Sân bay plane slate, Khí vận teal, Cơ hội orange, and the Tp. HCM
  set bronze. Card backs are the deck colour with its icon repeated small (`cardBack`). Vào tù is
  handcuffs. Colour set colours are in `SET_COLORS` (`prototype/print.ts`), approved.
