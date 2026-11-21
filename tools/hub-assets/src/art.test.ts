import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildHubAssets, cropRegion } from './art.js';

const manifest = {
  id: 'demo',
  name: 'Demo',
  tagline: 'Một trò thử.',
  minPlayers: 2,
  maxPlayers: 2,
  duration: { min: 1, max: 2 },
  status: 'wip',
  bots: false,
  focus: { x: 80, y: 50 },
};

/** A PNG whose left half is black and right half white, so a crop shows where it was taken. */
async function halves(width: number, height: number) {
  const right = await sharp({
    create: { width: width / 2, height, channels: 3, background: '#fff' },
  })
    .png()
    .toBuffer();
  return sharp({ create: { width, height, channels: 3, background: '#000' } })
    .composite([{ input: right, left: width / 2, top: 0 }])
    .png()
    .toBuffer();
}

function box(type: string, ...body: Buffer[]) {
  const content = Buffer.concat(body);
  const head = Buffer.alloc(8);
  head.writeUInt32BE(content.length + 8);
  head.write(type, 4, 'latin1');
  return Buffer.concat([head, content]);
}

/** A minimal MP4 that only says how long it is. */
function mp4(seconds: number, extra = 0) {
  const mvhd = Buffer.alloc(100);
  mvhd.writeUInt32BE(1000, 12);
  mvhd.writeUInt32BE(seconds * 1000, 16);
  return Buffer.concat([
    box('ftyp', Buffer.from('isom')),
    box('moov', box('mvhd', mvhd)),
    Buffer.alloc(extra),
  ]);
}

let dir: string;
let game: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hub-assets-'));
  game = join(dir, 'demo');
  mkdirSync(join(game, 'hub'), { recursive: true });
  writeFileSync(join(game, 'RULES.md'), '# Demo\n');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const art = async (width = 2560, height = 1152) =>
  writeFileSync(join(game, 'hub/key-art.png'), await halves(width, height));

describe('buildHubAssets', () => {
  it('writes every size, cropped on the focus, and hub.json', async () => {
    await art();
    const { problems, hub } = await buildHubAssets(game, manifest);
    expect(problems).toEqual([]);
    expect(Object.keys(hub?.art ?? {})).toEqual(['lobby', 'card', 'thumb']);

    const size = async (url: string | undefined) => {
      const file = join(game, 'dist/hub', url?.split('/').pop() ?? '');
      const { width, height } = await sharp(file).metadata();
      const { channels } = await sharp(file).stats();
      return { width, height, brightness: channels[0]?.mean };
    };
    expect(await size(hub?.art.lobby)).toMatchObject({ width: 2560, height: 1280 });
    expect(await size(hub?.art.card)).toMatchObject({ width: 480, height: 270 });
    const thumb = await size(hub?.art.thumb);
    expect(thumb).toMatchObject({ width: 256, height: 256 });
    expect(thumb.brightness).toBeGreaterThan(250);

    const written = JSON.parse(readFileSync(join(game, 'dist/hub/hub.json'), 'utf8'));
    expect(written).toEqual(hub);
    expect(hub?.art.card).toMatch(/^\/games\/demo\/hub\/card\.[0-9a-f]{8}\.webp$/);
    expect(readdirSync(join(game, 'dist/hub'))).toHaveLength(4);
  });

  it('fails when the art is missing', async () => {
    const { problems, hub } = await buildHubAssets(game, manifest);
    expect(problems).toEqual([expect.stringContaining('hub/key-art.png is missing')]);
    expect(hub).toBeUndefined();
  });

  it('fails on a wrong ratio and a small image', async () => {
    await art(2560, 1280);
    expect((await buildHubAssets(game, manifest)).problems).toEqual([
      expect.stringContaining('ratio must be 20:9'),
    ]);
    await art(1280, 576);
    expect((await buildHubAssets(game, manifest)).problems).toEqual([
      expect.stringContaining('at least 2560×1152'),
    ]);
  });

  it('fails on art that is not a PNG', async () => {
    writeFileSync(join(game, 'hub/key-art.png'), 'not an image');
    expect((await buildHubAssets(game, manifest)).problems).toEqual([
      'hub/key-art.png is not an image',
    ]);
    writeFileSync(
      join(game, 'hub/key-art.png'),
      await sharp({ create: { width: 2560, height: 1152, channels: 3, background: '#000' } })
        .jpeg()
        .toBuffer(),
    );
    expect((await buildHubAssets(game, manifest)).problems).toEqual([
      expect.stringContaining('must be a PNG'),
    ]);
  });

  it('fails when the manifest is wrong or its id is not the folder name', async () => {
    await art();
    expect(
      (await buildHubAssets(game, { ...manifest, focus: { x: 120, y: 50 } })).problems,
    ).toEqual([expect.stringContaining('manifest focus.x')]);
    expect((await buildHubAssets(game, { ...manifest, id: 'other' })).problems).toEqual([
      expect.stringContaining('must equal the folder name "demo"'),
    ]);
  });

  it('fails without RULES.md', async () => {
    await art();
    rmSync(join(game, 'RULES.md'));
    expect((await buildHubAssets(game, manifest)).problems).toEqual(['RULES.md is missing']);
  });

  it('copies a loop video and checks its size and length', async () => {
    await art();
    writeFileSync(join(game, 'hub/loop.mp4'), mp4(6));
    const ok = await buildHubAssets(game, manifest);
    expect(ok.problems).toEqual([]);
    expect(ok.hub?.loop).toMatch(/^\/games\/demo\/hub\/loop\.[0-9a-f]{8}\.mp4$/);

    writeFileSync(join(game, 'hub/loop.mp4'), mp4(9));
    expect((await buildHubAssets(game, manifest)).problems).toEqual([
      expect.stringContaining('lasts 9.0 s'),
    ]);
    writeFileSync(join(game, 'hub/loop.mp4'), mp4(6, 3 * 1024 * 1024));
    expect((await buildHubAssets(game, manifest)).problems).toEqual([
      expect.stringContaining('MB: at most 2 MB'),
    ]);
    writeFileSync(join(game, 'hub/loop.mp4'), 'nope');
    expect((await buildHubAssets(game, manifest)).problems).toEqual([
      'hub/loop.mp4 is not a readable MP4',
    ]);
  });

  it('writes nothing when there are problems', async () => {
    await buildHubAssets(game, manifest);
    expect(readdirSync(game)).not.toContain('dist');
  });
});

describe('cropRegion', () => {
  const source = { width: 2560, height: 1152 };

  it('keeps the full height of a wider-than-target crop and follows the focus', () => {
    const square = { width: 256, height: 256 };
    expect(cropRegion(source, square, { x: 50, y: 50 })).toEqual({
      left: 704,
      top: 0,
      width: 1152,
      height: 1152,
    });
    expect(cropRegion(source, square, { x: 100, y: 50 }).left).toBe(1408);
    expect(cropRegion(source, square, { x: 0, y: 50 }).left).toBe(0);
  });

  it('keeps the full width when the target is wider than the original', () => {
    expect(
      cropRegion({ width: 1000, height: 1000 }, { width: 200, height: 100 }, { x: 50, y: 90 }),
    ).toEqual({
      left: 0,
      top: 500,
      width: 1000,
      height: 500,
    });
  });
});
