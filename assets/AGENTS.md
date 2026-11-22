# Art and audio (the app's and the games')

- Make art and sound by hand, in Blender, drawn or synthesized in code, or from free resources on
  the web.
- **AI image generation is for splash art only**: the 20:9 Sea chart backgrounds (each Game's
  `hub/key-art.png` and the Islands' art). The owner makes them on an external AI image platform by
  pasting the frame from `assets/sources/splash-prompts.md`, changing only the subject and `focus`.
  Agents do not generate splash art. Emblems stay hand-written SVG; in-Game art stays code or
  Blender. Older AI-made files are legacy.
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
    generated ring). `avatar-long` is a real photo (`assets/shared/images/Long-look-at-u.jpg`), not
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
