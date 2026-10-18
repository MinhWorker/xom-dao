# Cờ tỷ phú Classic

Read `../AGENTS.md` for the shared game/SDK rules. The Vietnamese component map is in `README.md`.

- `src/game/`: authoritative pure rules, board/pricing data (`model.ts`), cards, bot and turn clock.
  Tests stay next to the implementation they exercise.
- `godot/main.gd`: the table in the Bàn layout (board, tile HUD, the green field's notice, dice
  and actions). `_view` is the latest authoritative snapshot; `_presented_view` is committed
  at the end of its queued animations. UI reads the presented snapshot, while commands validate
  against the latest snapshot. Preserve this boundary when adding visual state; `godot/marks.gd`
  draws the owner bands, houses, mortgages
  and station contributions over the board, plus every square's name and each deed's price.
  Owner strips and buildings come from `godot/art/deed-layers.webp` and its JSON atlas/board rects.
  Buildings have four owner-color variants. `tile_ink.gd` draws upright surface-projected
  labels/prices and larger SVG symbols in three rows (two on the side columns, with
  fixed symbol/price slots); `special_ink.gdshader` and `special_details.gd` animate special
  symbols and corners.
  `station_coins.gd` projects four fixed contribution stacks; each coin uses the server
  contribution count, not the increasing deposit amount. `marks.gd` renders this ink in a
  transparent 2× SubViewport;
  the ink uses a private mipmapped font cache and mipmapped SVGs for minification.
  Chance, chest and tax icons are large runtime SVGs too; side chest labels share a row with
  their icon. All surface icons, including corners, are runtime SVGs. Ownership tints deed SVGs;
  atlas symbol masks are legacy;
  `godot/ledger.gd` is the full-scene assets/trade overlay; `estate_page.gd` handles
  multi-square mortgages (`mortgage` with `squares`); `godot/actions.gd` which buttons the phase and a deed offer (pure,
  tested); `godot/texts.gd` the card's words.
- Effects: `godot/dice.gd` (four randomized toss paths), `die_mesh.gd` (named dice input anchors), `board_stage.gd` (Blender GLB models, a transparent
  3D viewport, MSAA and the exact board camera), `piece_projection.gd` (world coordinates and
  server face orientation), `pawn_piece.gd` and `pawn_motion.gd` (small grounded pawns and hops),
  `field_ink.gd` (surface-projected event text), `godot/gate.gd` (jail doors for your own pawn) and
  `godot/victory.gd` (winner camera focus, pawn hops, fireworks and the result-panel handoff). `main.gd` is near the
  1000-line lint limit: put new table code in these or new files.
- `godot/rules.gd` copies what the table needs from the TypeScript rules (squares, rent and
  mortgage sums, turn clock) and aliases the generated board geometry in `godot/board_geometry.gd` (`CELLS`,
  `HOMOGRAPHY`, the turn plaque and field). Keep the rules in sync when `BOARD` changes.
- `godot/deed_sets.gd` groups adjacent deeds by set and owner for static two-deed/full-set frames.
  Set colors stay fixed; ownership changes update the symbol, owner strip and buildings together.
- `godot/player_card.gd` holds the SDK player-slot state used by the banknote and ledger; its
  side cards stay hidden. `card_glint.gdshader` highlights the acting seat on the banknote.
  `card_cash.gd` merges a signed delta into the ink balance before counting; `_money` waits for
  this sequence before the next job. Load actual avatar pictures via `XomDaoLooks.avatar`.
  `godot/tile_hud.gd` extends the board's projected plane into the right sidebar for the local
  pawn's square summary. Numeric rows align labels left and values right; text-only rows center.
  During local movement, keep the HUD visible and animate an ink-colored 2D runner in its panel;
  refresh the square details only after the pawn settles. Dice rest coordinates depend only on the
  board plane. Event ink is the first child of the dice controller, underneath its 3D
  stage, without changing text placement.
  HUD SVGs drawn smaller on this projected plane need `mipmaps/generate=true` in their `.svg.import`
  files. `TEXTURE_FILTER_LINEAR_WITH_MIPMAPS` only samples mip levels; it does not generate them.
  Godot's default SVG import disables mipmaps, which makes minified icons look pixelated. The HUD
  icon filtering test guards this import setting.
- `godot/visual_review.tscn` runs the real table offline with local-player snapshots: empty,
  ownership colors, transfer, mortgages, sets, foreclosure and station coin stacks.
  Its top-right buttons switch snapshots and preview a throw.

`sources/render_board_25d.py` renders `assets/board-25d.webp`, writes `assets/board-geometry.json`
and generates `godot/board_geometry.gd`. Update its square kinds/groups whenever BOARD changes;
format the generated GDScript with gdformat. Do not hand-edit generated coordinates.
`sources/render_deed_layers.py` renders `assets/deed-layers.webp`/`.json` with the same camera/lights;
JSON includes per-square destination rectangles. Re-bake both after changing camera or tile geometry.
Copy the app-ready files the table uses into `godot/art/`. Assets use `../../assets/AGENTS.md`.

`sources/render_board_pieces.py` exports `assets/board-pieces.glb` and its Godot copy, plus the
four plain-color pawn HUD portraits. Blender originals stay in ignored `.blender/board-pieces/`.
`test_board_pieces.gd` compares the live Godot camera against the independent baked homography
and verifies all six numbered faces settle upward. Keep these tests when changing the camera.

`assets/night-waterfront.webp` is the static 16:9 background, also copied into `godot/art/`.
`sources/night-waterfront-video.md` records the idle prompt and the owner-provided MP4.
`prepare_background.py` converts it into the silent looping Theora `night-waterfront.ogv`;
`background.gd` plays it with aspect-preserving cover behind the board.

`board_surface.gd` draws the two card piles and a title-only reveal, plus two fixed surface
action slots. Their named SDK buttons remain real input controls (transparent visuals);
Confirm is reparented out of the hidden modal. `surface_draw.gd` provides private mipmapped
fonts and plane transforms. `field_ink.gd` draws event confirmation without a panel; dice are
hidden during the event phase. Event identity ignores ready echoes but detects chained events.
`banknote_model.gd` owns fixed POV ordering, numeric totals, conditional icon states and
synchronized transfer interpolation. `turn_exchange.gd` draws the banknote header: the viewer's
large card on the left, a central bank seal, and stable opponent cards on the right. The local
card has no name; all cash amounts have a money icon. Seat-coloured portrait frames, clipped
card corners, dark cash strips and separate stat/status bays use the shared palette. Rectangles,
icons, circles and engraved paths use the board homography, never a screen-space skew. Numeric
zeroes remain; inactive statuses (including their counters) disappear without reflow. Transfers
light only the involved seat paths and count both balances together; the bank has no balance.
`_money` waits for this before the external HUD cash effect. The bake supplies a blank continuous
header. `test_banknote.gd` covers POV, status lifetimes, buildings, contributions and transfers.

`aircraft_flight.gd` animates the separate Blender `aircraft.glb` in the shared 3D stage:
approach, pickup, carry, drop and departure. `sources/render_aircraft.py` authors this model.
Only resolving an airport event uses this transport; all non-jail card/dice moves walk
clockwise through every square. Start transfers are consumed at the Start hop, never replayed
at the destination. The running clock is drawn along the acting card's clipped outer border;
`banknote_model.gd` computes its perimeter path, and `player_card.gd` supplies its remaining
fraction. Snapshot age is included when resynchronizing the clock after animations.
Baked button images encode their slot perspective; mirror their UVs when used in the opposite
slot. EndTurn uses the slate secondary skin.

The full-scene `ledger.gd` replaces the separate top-right trade and mortgage entry points.
It composes `estate_page.gd` (grouped deeds and management), `exchange_page.gd` (two offer trays),
`estate_card.gd` (selectable/draggable kit-based objects), `money_pad.gd` (exact cash keypad),
and `trade_draft.gd` (one draft, cleared after every resolved proposal). Main tabs are vertical;
player tabs are horizontal. Browse remains available off-turn; mutations use existing server
permissions. There is no personal asset auction event or seller path: auction state/bid/pass
are exclusively the station contribution mechanic defined in `RULES.md`. Keep on-screen copy minimal.

Ledger assets are purpose-specific SVGs: deed-paper, ledger-paper, bookmarks, offer-mat,
cash-pile and reset. Keep these distinct from action button skins. TradeDraft quotes face-value
sales/purchases or the difference for swaps whenever a deed selection changes; cash remains
editable. The cash pad replaces the suggested amount on its first digit. Tickets stay fixed at 200.
