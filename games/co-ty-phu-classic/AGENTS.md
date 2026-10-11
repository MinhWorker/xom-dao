# Cờ tỷ phú Classic

Read `../AGENTS.md` for the shared game/SDK rules. The Vietnamese component map is in `README.md`.

- `src/game/`: authoritative pure rules, board/pricing data (`model.ts`), cards, bot and turn clock.
  Tests stay next to the implementation they exercise.
- `godot/main.gd`: the table in the Bàn layout (board, players' column, the green field's notice,
  dice and actions, the square card); `godot/marks.gd` draws the owner bands, houses, mortgages
  and station contributions over the board, plus every square's name and each deed's price;
  `godot/trade.gd` is the trade offer; `godot/mortgage.gd` the multi-square mortgage board
  (`mortgage` with `squares`); `godot/actions.gd` which buttons the phase and a deed offer (pure,
  tested); `godot/texts.gd` the card's words.
- Effects ported from the retired Phaser board: `godot/dice.gd` (the dice paths of
  `diceMotion.ts`, flattened to 2D), `godot/gate.gd` (the jail doors, only for your own pawn) and
  `godot/victory.gd` (the win, which fades so Xem bàn shows the board). `main.gd` is near the
  1000-line lint limit: put new table code in these or new files.
- `godot/rules.gd` copies what the table needs from the TypeScript rules (squares, rent and
  mortgage sums, turn clock) and the board geometry: `CELLS` (each square's corners on
  `board-25d.webp`), `HOMOGRAPHY` and the printed players' panel. Keep it in sync when `BOARD` or
  the board picture changes.

`sources/render_board_25d.py` renders `assets/board-25d.webp` together with its square geometry.
Update its square kinds/groups whenever BOARD changes, then copy the new corners into
`godot/rules.gd`; do not hand-edit generated numbers. `sources/render_deed_layers.py` renders
`assets/deed-layers.webp`/`.json` with the same camera/lights. Copy the app-ready files the table
uses into `godot/art/`. Assets use the shared `../../assets/AGENTS.md` rules.
