// Builds the avatar pictures and frames in assets/app/images/. The two are separate:
// the app stacks a frame (frame-<id>) over a round, frameless avatar (avatar-<id>).
//   node scripts/avatars.mjs gold                frame-gold drawn here: a flat octagonal ring in the Hub's style
//   node scripts/avatars.mjs frames              frame-<id> recolored from frame-gold
//   node scripts/avatars.mjs emoji <assets dir>  avatar-<id> from Microsoft Fluent Emoji 3D (MIT):
//     npm pack @lobehub/fluent-emoji-3d && tar xzf lobehub-fluent-emoji-3d-*.tgz → package/assets
// The ids match AVATARS and FRAMES in packages/shared/src/account.ts.
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

sharp.cache(false);

/** Avatar id → emoji code point (file name in the Fluent Emoji package). */
const EMOJI = {
  cat: '1f431',
  dog: '1f436',
  fox: '1f98a',
  panda: '1f43c',
  frog: '1f438',
  tiger: '1f42f',
  rabbit: '1f430',
  bear: '1f43b',
  koala: '1f428',
  monkey: '1f435',
  pig: '1f437',
  hamster: '1f439',
  lion: '1f981',
  unicorn: '1f984',
  penguin: '1f427',
  owl: '1f989',
  chick: '1f425',
  octopus: '1f419',
  alien: '1f47d',
  ghost: '1f47b',
};

/** Frame id → sharp `modulate` applied to frame-gold. */
const FRAMES = {
  silver: { saturation: 0.05, brightness: 1.15 },
  bronze: { hue: -18, saturation: 0.8, brightness: 0.82 },
  jade: { hue: 105, saturation: 1, brightness: 0.95 },
  sapphire: { hue: 170, saturation: 1.1, brightness: 0.95 },
  ruby: { hue: -45, saturation: 1.2, brightness: 0.9 },
  amethyst: { hue: 225, saturation: 0.9, brightness: 0.95 },
  rose: { hue: -70, saturation: 0.6, brightness: 1.05 },
  coral: { hue: -95, saturation: 1.1, brightness: 1.0 },
  turquoise: { hue: 145, saturation: 1.05, brightness: 0.98 },
  obsidian: { hue: 30, saturation: 0.18, brightness: 0.52 },
};

/** Every picture is SIZE square; an avatar is a disc of radius DISC, the frame's ring covers its edge. */
const SIZE = 256;
const DISC = 100;
const images = resolve(fileURLToPath(import.meta.url), '../../assets/app/images');
const webp = { quality: 88, alphaQuality: 100 };

/** Corner points of an octagon with axis-aligned flats at distance `apothem` from the centre. */
function octagon(apothem) {
  const c = SIZE / 2;
  const k = apothem * Math.tan(Math.PI / 8);
  return [
    [c - k, c - apothem],
    [c + k, c - apothem],
    [c + apothem, c - k],
    [c + apothem, c + k],
    [c + k, c + apothem],
    [c - k, c + apothem],
    [c - apothem, c + k],
    [c - apothem, c - k],
  ];
}
const points = (list) => list.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');

/** The default frame: a flat accent-yellow octagonal ring with a dark outline, a light bevel line
 *  and a dark pointer on each side, its hole just inside the avatar's disc so the edge is covered. */
function goldFrame() {
  const c = SIZE / 2;
  const hole = DISC - 3;
  const ring = (apothem) =>
    `M${octagon(apothem)
      .map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`)
      .join(
        ' L',
      )} Z M${c - hole} ${c} a${hole} ${hole} 0 1 0 ${hole * 2} 0 a${hole} ${hole} 0 1 0 ${-hole * 2} 0 Z`;
  const pointer = (rotate) =>
    `<polygon transform="rotate(${rotate} ${c} ${c})" points="${c - 9},${c - 117} ${c + 9},${c - 117} ${c},${c - 104}" fill="#0b0d10"/>`;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
      <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffd26b"/><stop offset="0.5" stop-color="#ffc234"/>
        <stop offset="1" stop-color="#e8a60f"/></linearGradient></defs>
      <path d="${ring(122)}" fill="#0b0d10" fill-rule="evenodd"/>
      <path d="${ring(118)}" fill="url(#g)" fill-rule="evenodd"/>
      <polygon points="${points(octagon(110))}" fill="none" stroke="#fff3c9" stroke-opacity="0.7" stroke-width="2"/>
      <circle cx="${c}" cy="${c}" r="${hole}" fill="none" stroke="#0b0d10" stroke-width="4"/>
      ${[0, 90, 180, 270].map(pointer).join('')}
    </svg>`,
  );
}

const [mode, source] = process.argv.slice(2);
if (mode === 'gold') {
  await sharp(goldFrame()).webp(webp).toFile(join(images, 'frame-gold.webp'));
  console.log('frame-gold.webp');
} else if (mode === 'frames') {
  for (const [id, modulate] of Object.entries(FRAMES)) {
    await sharp(join(images, 'frame-gold.webp'))
      .modulate(modulate)
      .webp(webp)
      .toFile(join(images, `frame-${id}.webp`));
    console.log(`frame-${id}.webp`);
  }
} else if (mode === 'emoji' && source) {
  const sky = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
      <defs><radialGradient id="g" cx="50%" cy="38%" r="62%">
        <stop offset="0" stop-color="#9fe4ff"/><stop offset="0.6" stop-color="#3fb4f2"/>
        <stop offset="1" stop-color="#1c7fd0"/></radialGradient></defs>
      <circle cx="${SIZE / 2}" cy="${SIZE / 2}" r="${DISC}" fill="url(#g)"/>
    </svg>`,
  );
  const face = 160;
  const at = (SIZE - face) / 2;
  for (const [id, code] of Object.entries(EMOJI)) {
    const emoji = await sharp(join(source, `${code}.webp`))
      .resize(face, face)
      .toBuffer();
    await sharp(sky)
      .composite([{ input: emoji, left: at, top: at + 6 }])
      .webp(webp)
      .toFile(join(images, `avatar-${id}.webp`));
    console.log(`avatar-${id}.webp`);
  }
} else {
  console.error(
    'usage: node scripts/avatars.mjs gold | frames | emoji <fluent-emoji-3d package/assets>',
  );
  process.exit(1);
}
