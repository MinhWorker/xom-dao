// Draws the Hub's hand cursor and writes assets/app/images/cursor-hand.png (32 px) and
// cursor-hand@2x.png (64 px). The hotspot is the index fingertip: (11, 1) in 1x pixels.
//   node scripts/cursor.mjs
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const OUT = resolve(fileURLToPath(import.meta.url), '../../assets/app/images');

const HAND = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <g stroke="#0b0d10" stroke-linejoin="round" stroke-linecap="round">
    <path fill="#e8ecf1" stroke-width="1.6" d="M9 4.5a2.5 2.5 0 0 1 5 0V12a2.25 2.25 0 0 1 4.5 0v1.5a2.25 2.25 0 0 1 4.5 0v2a1.9 1.9 0 0 1 3.8 0V22c0 4-2.5 7-6.5 7h-5.8c-2.5 0-4-1.2-5.3-3l-5-6.7c-.9-1.2-.6-2.8.7-3.5 1.1-.6 2.4-.3 3.2.7L9 18z"/>
    <path fill="none" stroke-width="1" d="M14.5 12.6v4M18.5 14v3.5M22.5 15.8v3"/>
    <path fill="none" stroke="#ffc234" stroke-width="1" d="M10.4 4.2a1.1 1.1 0 0 1 2.2 0"/>
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
