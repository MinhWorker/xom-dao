# Cờ tỷ phú Classic

Read `../AGENTS.md` for the shared game/SDK rules. The Vietnamese component map is in `README.md`.

- `src/game/`: authoritative pure rules, board/pricing data (`model.ts`), cards, bot and turn clock.
  Tests stay next to the implementation they exercise.
- `godot/main.gd`: the table in the Bàn layout (board, players' column, the green field's notice,
  dice and actions, the square card); `godot/marks.gd` draws the owner bands, houses, mortgages
  and station contributions over the board, plus every square's name and each deed's price.
  Owner strips and buildings come from `godot/art/deed-layers.webp` and its JSON atlas/board rects.
  Buildings have four owner-color variants. `tile_ink.gd` draws upright surface-projected
  labels/prices and larger SVG symbols in three rows; `tile_symbol.gdshader` animates only
  the water and electricity symbols. `marks.gd` renders this ink in a transparent 2× SubViewport;
  the ink uses a private mipmapped font cache and mipmapped SVGs for minification.
  Ownership tints the SVGs; atlas symbol masks are legacy;
  `godot/trade.gd` is the trade offer; `godot/mortgage.gd` the multi-square mortgage board
  (`mortgage` with `squares`); `godot/actions.gd` which buttons the phase and a deed offer (pure,
  tested); `godot/texts.gd` the card's words.
- Effects ported from the retired Phaser board: `godot/dice.gd` (the dice paths of
  `diceMotion.ts`, flattened to 2D), `godot/gate.gd` (the jail doors, only for your own pawn) and
  `godot/victory.gd` (the win, which fades so Xem bàn shows the board). `main.gd` is near the
  1000-line lint limit: put new table code in these or new files.
- `godot/rules.gd` copies what the table needs from the TypeScript rules (squares, rent and
  mortgage sums, turn clock) and aliases the generated board geometry in `godot/board_geometry.gd` (`CELLS`,
  `HOMOGRAPHY`, the turn plaque and field). Keep the rules in sync when `BOARD` changes.
- `godot/deed_sets.gd` groups adjacent deeds by set and owner for static two-deed/full-set frames.
  Set colors stay fixed; ownership changes update the symbol, owner strip and buildings together.
- `godot/visual_review.tscn` runs the real table offline with spectator snapshots: empty,
  ownership colors, transfer, mortgages, sets and foreclosure. Its top-right button switches snapshots.

`sources/render_board_25d.py` renders `assets/board-25d.webp`, writes `assets/board-geometry.json`
and generates `godot/board_geometry.gd`. Update its square kinds/groups whenever BOARD changes;
format the generated GDScript with gdformat. Do not hand-edit generated coordinates.
`sources/render_deed_layers.py` renders `assets/deed-layers.webp`/`.json` with the same camera/lights;
JSON includes per-square destination rectangles. Re-bake both after changing camera or tile geometry.
Copy the app-ready files the table uses into `godot/art/`. Assets use `../../assets/AGENTS.md`.
