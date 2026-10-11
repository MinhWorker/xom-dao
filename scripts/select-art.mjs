// Copy catalog islands and split the original splash sheets into small hub-ready images.
// npm run gen:asset -- select-sheet-co select-sheet-board select-sheet-party select-trung-thu
// node scripts/select-art.mjs
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const root = join(import.meta.dirname, '..');
const ready = join(root, 'assets/app/images');
const target = join(root, 'apps/client/hub/select/art');
const sheets = [
  ['select-sheet-co', ['xiangqi', 'chess', 'go', 'checkers']],
  ['select-sheet-board', ['battleship', 'tic-tac-toe', 'co-ca-ngua', 'co-ty-phu-classic']],
  ['select-sheet-party', ['tien-len', 'mau-binh', 'bai-cao', 'bom-nguyen-to']],
  ['select-trung-thu', ['trung-thu']],
];
for (const [name, ids] of sheets) {
  const input = join(ready, `${name}.webp`);
  if (!existsSync(input)) throw new Error(`Missing ${input}; generate it first`);
  const { width, height } = await sharp(input).metadata();
  for (let index = 0; index < ids.length; index++) {
    const id = ids[index];
    const destination = join(target, id);
    mkdirSync(destination, { recursive: true });
    const tileWidth = ids.length === 1 ? width : Math.floor(width / 2);
    const tileHeight = ids.length === 1 ? height : Math.floor(height / 2);
    await sharp(input)
      .extract({
        left: (index % 2) * tileWidth,
        top: Math.floor(index / 2) * tileHeight,
        width: tileWidth,
        height: tileHeight,
      })
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 88 })
      .toFile(join(destination, 'splash.webp'));
    cpSync(join(root, 'games', id, 'assets/island.webp'), join(destination, 'island.webp'));
  }
}
cpSync(join(ready, 'island-label.webp'), join(target, 'island-label.webp'));
