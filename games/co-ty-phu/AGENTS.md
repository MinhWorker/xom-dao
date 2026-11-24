# Cờ Tỷ Phú

Rules: `server/game/model.ts` first, words in `GLOSSARY.md`, numbers in `server/game/tuning.ts`
(run `npm run simulate` after changing one, see `games/AGENTS.md`). The client is not built yet.

## Look

The board look prototype (#351) is `prototype/`: a still Three.js scene with made-up state in an
844×390 phone frame. Run `npm run prototype -w @xomdao/game-co-ty-phu` and open
http://localhost:8041/ (`?view=square` for the straight camera, `?pitch=<degrees>` to try another
camera angle). It is not built or shipped; the client will reuse `prototype/print.ts` and
`prototype/pieces.ts`.

Direction, pending the owner's review on #351:

- Three.js, everything drawn in code: a model board on a wooden table, Tiles printed flat on one
  Canvas 2D texture (name, price, icon, Colour set band on the inner edge).
- The camera looks at the board turned 45° (a diamond) from about 40° above the table. On a
  landscape phone this makes Tiles larger than a straight view and leaves the four screen corners
  for the player cards; the Hub's 48×48 top-right corner stays empty. Tile text is turned to read
  closest to upright, so it runs along each side at ±45°.
- Ownership in the owner's seat colour: a tint over the Tile and a strip on its outer edge. Levels
  1–4 are that many houses on the band; a Hotel is one larger building with white trim and a gold
  cap. A Full set has a gold rim round its three Tiles. Unowned Tiles show only the print.
- Tokens are glossy pawns in the seat colour, larger than life so they read on a phone; the dice
  and the Cơ hội and Khí vận decks sit in the middle of the board.
- Seat colours match Đặt Bom. Colour set colours are in `SET_COLORS` (`prototype/print.ts`).
