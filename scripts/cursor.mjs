// Draws the Hub's hand cursor and writes assets/app/images/cursor-hand.png (32 px) and
// cursor-hand@2x.png (64 px). The hotspot is the index fingertip: (7, 2) in 1x pixels.
//   node scripts/cursor.mjs
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const OUT = resolve(fileURLToPath(import.meta.url), '../../assets/app/images');

/** The hand, upright with the fingertip at (0, 0), in flat facets; the group tilts it 20° to lean like an arrow. */
const SHAPES = {
  index: '-2.5,1.5 -1,0 1,0 2.5,1.5 2.5,12 -2.5,12',
  middle: '2.5,9 3.5,8 6,8 7,9 7,14 2.5,14',
  ring: '7,10.5 8,9.5 10.3,9.5 11.3,10.5 11.3,15 7,15',
  pinky: '11.3,12.5 12.2,11.6 14,11.6 14.8,12.5 14.8,16 11.3,16',
  palm: '-2.5,10 14.8,12 14.8,19.5 11.5,25 1.5,25 -2.5,20.5',
  thumb: '-2.5,13.5 -6.5,11 -8.5,12.2 -8,14 -2.5,19',
};
const outline = Object.values(SHAPES)
  .map((pts) => `<polygon points="${pts}"/>`)
  .join('');
const fills = Object.values(SHAPES)
  .map((pts) => `<polygon points="${pts}" fill="#e8ecf1"/>`)
  .join('');

const HAND = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <g transform="translate(7.1 2) scale(1.1) rotate(-20)" stroke-linejoin="round">
    <g fill="#0b0d10" stroke="#0b0d10" stroke-width="2.4">${outline}</g>
    ${fills}
    <g fill="#f8fafc">
      <polygon points="-2.5,1.5 0,1.5 0,12 -2.5,12"/>
      <polygon points="-2.5,10 6,12 1.5,25 -2.5,20.5"/>
      <polygon points="-6.5,11 -2.5,13.5 -8,14 -8.5,12.2"/>
    </g>
    <g fill="#c3ccd7">
      <polygon points="5,9 6,8 7,9 7,14 5,14"/>
      <polygon points="9.5,9.5 10.3,9.5 11.3,10.5 11.3,15 9.5,15"/>
      <polygon points="13.2,11.6 14,11.6 14.8,12.5 14.8,16 13.2,16"/>
      <polygon points="14.8,16 14.8,19.5 11.5,25 8,25"/>
      <polygon points="-8,14 -2.5,13.5 -2.5,19"/>
    </g>
    <polygon points="-2.5,1.5 -1,0 1,0 2.5,1.5" fill="#ffc234"/>
    <g fill="none" stroke="#0b0d10" stroke-width="0.9" stroke-linecap="round">
      <path d="M2.5 9.5V13M7 11V14M11.3 13V15.3"/>
    </g>
  </g>
</svg>`;

for (const [size, name] of [
  [32, 'cursor-hand.png'],
  [64, 'cursor-hand@2x.png'],
]) {
  await sharp(Buffer.from(HAND), { density: (72 * size) / 32 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(resolve(OUT, name));
  console.log(`${name}: ${size}×${size}`);
}
