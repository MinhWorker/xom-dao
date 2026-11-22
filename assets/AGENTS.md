# Art and audio (the app's and the games')

- Make art and sound by hand, in Blender, drawn or synthesized in code, or from free resources on
  the web.
- **Splash art is drawn in code**: the 20:9 Sea chart backgrounds (each Game's `hub/key-art.png`
  and each Island's `apps/hub/src/island-art/<island>.png`, 2560×1152) come from
  `npm run splash -- [caro|tien-len|islands]`. A Game's splash uses its client's own colours
  and shapes, so it matches the game (Caro: ink marks on squared paper; Tiến Lên: ivory cards on
  felt). An Island's splash is a wallpaper of objects of its genre (`MOTIFS` in the script: marks, stones and
  discs for Cờ; cards for Bài; dice and pawns for Xúc Xắc; bombs, stars and crates for Náo Nhiệt) on
  a tinted backdrop, fading out to the left. A Game whose look is not settled gets the same kind of
  placeholder. Đặt Bom's `key-art.png` is an older render that already matches
  its scene. Keep the subject in the right 60% and the left 40% dark and empty. Do not use AI image
  generation for splash art. `tools/hub-assets` checks the Games' art in its build and the
  Islands' in its tests (`checkIslandArt`).
  - A scene seen at an angle uses a real perspective camera, not a rotate-and-squash (that is a
    parallel projection: the far edge is as long as the near one and the picture looks flat).
    `caro()` in `scripts/splash.mjs` projects every point through `project`; tune the view with
    `away` (camera distance: smaller is stronger perspective), `pitch` (look-down angle) and `yaw`,
    then run `npm run splash -- caro` and check the sheet stays inside the frame, right of 40%.
- **Harbour art** (`apps/hub/src/harbour-art/`: `harbour-master.webp`, the Bến's standing character,
  and `harbour-night.webp`, its night backdrop) is the one place AI image generation is allowed. The
  character is the owner's friend Long drawn as an Arknights-style operator.
  - Describe the person in words and never send their photo to the generator. Run `agy --print`
    with the prompt (it saves the PNG to the path the prompt names); for a later change, give it the
    previous generated image as the reference so the face and costume stay the same.
  - The character is generated on flat `#00FF00` with no green on him. His ID badge is generated
    with a flat `#FF00FF` square where the photo goes and a blank white strip below it. Measure the
    square's corners, warp Long's real photo (`assets/shared/images/Long-look-at-u.jpg`) into it,
    write his name in the strip, then key the green out into transparency and trim.
  - Originals are in `assets/shared/images/`: `harbour-master-raw.png` (generated),
    `harbour-master.png` (cut-out with the photo), `harbour-night-raw.png` (the backdrop).
- Pick what looks and sounds best for a card/board game in the app's style.
- Keep a third-party license file next to assets whose license requires one.
- Use only free, clearly allowed assets, and never sell anything.

## Where files live

- **A game**:
  - `games/<id>/assets/` holds the app-ready files (full size, plus atlases and normals).
  - The optional `games/<id>/sources/` holds originals; `npm run assets -- <id>` makes
    `assets/<name>.webp` from them.
  - The game's picture on its hub card is `island`.
- **The app**:
  - Originals are in `assets/` (`shared/`, older game audio in `games/<id>/audio/`, and unsorted
    experiments in `audio/`).
  - App-ready files are in `assets/app/` (`images/`, `audio/`, unsorted sounds in
    `audio/unsorted/`).
- **Storage**: originals are Git LFS, and a new binary type needs a pattern in `.gitattributes`.
  App-ready files (`assets/app/`, `games/<id>/assets/`) are plain git.
- **Avatars and frames are separate images** of the same 256×256 canvas: `avatar-<id>.webp` is a
  round, frameless picture (a disc of radius 100), `frame-<id>.webp` the ring drawn over it. The ids
  are `AVATARS` and `FRAMES` in `packages/shared/src/account.ts`; `avatar-bot` keeps its own frame.
  - `avatar-boy`, `avatar-girl` and `avatar-long` had the gold frame cut off (`frame-gold` is the
    generated ring). `avatar-harbour`, the default avatar, is the Bến character's face looking straight
    at the viewer (generated with `agy` like the Harbour art above, keyed from green, on the same blue disc
    as `avatar-boy`; original in `assets/shared/images/avatar-harbour-raw.png`). `avatar-long` is a real photo (`assets/shared/images/Long-look-at-u.jpg`), not
    generated art.
  - `node scripts/avatars.mjs frames` recolors `frame-gold` into the other frames;
    `node scripts/avatars.mjs emoji <dir>` makes the animal avatars from Microsoft's Fluent Emoji 3D
    (MIT, notice in `assets/app/images/LICENSE-FluentEmoji.txt`). Add avatar ids to `AVATARS` and the generation script;
    add frame ids to `FRAMES` in `account.ts` and the script's `FRAMES` map.

- **The hand cursor** (`cursor-hand.png`, `cursor-hand@2x.png`) is drawn as faceted SVG polygons in
  `scripts/cursor.mjs`; `node scripts/cursor.mjs` writes both. Its hotspot is (7, 2).

## Sounds

- **The app-ready files are the real ones**, with no build step:
  - `assets/app/audio/`;
  - `games/<id>/assets/`;
  - unsorted ones in `assets/app/audio/unsorted/`.
- Originals (Veo clips in `assets/**/sfx-selected/`, `xomdao-*` files, downloads in
  `assets/**/sfx/`) are kept as an archive.
- **To change a sound**, edit the app-ready file in place with ffmpeg, then measure it with
  ffprobe. A sound may also be made once from an original.
  - Cut: `-ss`/`-t` plus a short `afade`.
  - Faster at the same pitch: `atempo`.
  - Louder: `volume`.
- **Formats**:
  - Short effects are mono 16-bit WAV, because MP3 starts with about 25 ms of padding.
  - Music is 128 kbps MP3.
- **Music**: the app's own tracks (`music-hub-*`, `music-sky-*`) are in `assets/app/audio/`.
