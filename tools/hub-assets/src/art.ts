import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { GameManifestSchema, ISLANDS } from '@xomdao/sdk';
import sharp, { type Metadata } from 'sharp';
import { checkEmblem } from './emblem.js';
import { mp4Duration } from './mp4.js';
import { parseRules, RULES_IMAGE, type RulesDraft, type RulesPage } from './rules.js';

/** The original art: 20:9, at least this big. */
export const KEY_ART = { width: 2560, height: 1152 } as const;

/** The sizes the Hub shows, each cropped around the manifest's `focus`. */
export const SIZES = {
  lobby: { width: 2560, height: 1280 },
  card: { width: 480, height: 270 },
  thumb: { width: 256, height: 256 },
} as const;

export const LOOP_MAX_BYTES = 2 * 1024 * 1024;
export const LOOP_MAX_SECONDS = 8;

export type ArtName = keyof typeof SIZES;

/** What `dist/hub/hub.json` lists: URLs the Hub imports at build time. */
export interface HubJson {
  id: string;
  art: Record<ArtName, string>;
  loop?: string;
  /** The Game's `RULES.md` as pages for the Hub's pager; page images are under `/games/<id>/hub/`. */
  rules: RulesPage[];
}

export interface HubAssetsResult {
  /** Why the Game can't be shown; empty when `hub` was written. */
  problems: string[];
  hub?: HubJson;
}

/**
 * Checks a Game's Hub submission and writes `dist/hub/` (WebP sizes named by content hash, the
 * loop video, the rules page images, `hub.json`). `manifest` is what `games/<id>/manifest.ts` exports; `gameDir` is
 * `games/<id>/`, whose folder name must equal the manifest's `id`. Nothing is written when
 * there are problems.
 */
export async function buildHubAssets(gameDir: string, manifest: unknown): Promise<HubAssetsResult> {
  const folder = basename(gameDir);
  const problems: string[] = [];
  const parsed = GameManifestSchema.safeParse(manifest);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      problems.push(`manifest ${issue.path.join('.') || '(root)'}: ${issue.message}`);
    }
    return { problems };
  }
  const { id, focus } = parsed.data;
  if (id !== folder) problems.push(`manifest id "${id}" must equal the folder name "${folder}"`);
  const rulesPath = join(gameDir, 'RULES.md');
  const rules = existsSync(rulesPath) ? parseRules(readFileSync(rulesPath, 'utf8')) : undefined;
  if (rules) problems.push(...rules.problems);
  else problems.push('RULES.md is missing');
  const pictures = rules ? await readRulesImages(gameDir, rules.pages, problems) : new Map();
  problems.push(...checkEmblem(gameDir));

  const artPath = join(gameDir, 'hub/key-art.png');
  const art = existsSync(artPath) ? await readKeyArt(artPath, problems) : missingArt(problems);
  const loopPath = join(gameDir, 'hub/loop.mp4');
  const loop = existsSync(loopPath) ? readLoop(loopPath, problems) : undefined;
  if (problems.length || !art) return { problems };

  const out = join(gameDir, 'dist/hub');
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const url = (file: string) => `/games/${id}/hub/${file}`;
  const files = {} as Record<ArtName, string>;
  for (const name of Object.keys(SIZES) as ArtName[]) {
    const bytes = await crop(art, SIZES[name], focus);
    files[name] = `${name}.${hash(bytes)}.webp`;
    writeFileSync(join(out, files[name]), bytes);
  }
  const hub: HubJson = {
    id,
    art: { lobby: url(files.lobby), card: url(files.card), thumb: url(files.thumb) },
    rules: (rules?.pages ?? []).map(({ title, image, blocks }) => {
      const picture = image && pictures.get(image.path);
      if (!image || !picture) return { title, blocks };
      const file = `rules-${picture.name}.${hash(picture.bytes)}.webp`;
      writeFileSync(join(out, file), picture.bytes);
      return { title, image: { url: url(file), alt: image.alt }, blocks };
    }),
  };
  if (loop) {
    const file = `loop.${hash(loop)}.mp4`;
    writeFileSync(join(out, file), loop);
    hub.loop = url(file);
  }
  writeFileSync(join(out, 'hub.json'), `${JSON.stringify(hub, null, 2)}\n`);
  return { problems, hub };
}

/** The page images the rules ask for, by their path in `RULES.md`; bad ones go to `problems`. */
async function readRulesImages(gameDir: string, pages: RulesDraft[], problems: string[]) {
  const found = new Map<string, { name: string; bytes: Buffer }>();
  for (const page of pages) {
    const path = page.image?.path;
    if (path === undefined || found.has(path)) continue;
    const name = /^hub\/rules\/([a-z0-9][a-z0-9-]*)\.webp$/.exec(path)?.[1];
    if (!name) {
      problems.push(
        `RULES.md "${page.title}": the image must be hub/rules/<name>.webp, not "${path}"`,
      );
      continue;
    }
    const file = join(gameDir, path);
    if (!existsSync(file)) {
      problems.push(`RULES.md "${page.title}": ${path} is missing`);
      continue;
    }
    const bytes = readFileSync(file);
    const before = problems.length;
    let meta: Metadata | undefined;
    try {
      meta = await sharp(bytes).metadata();
    } catch {
      problems.push(`${path} is not an image`);
    }
    if (!meta) continue;
    const { width = 0, height = 0 } = meta;
    if (meta.format !== 'webp') problems.push(`${path} must be a WebP, not ${meta.format}`);
    if (Math.abs(width * 9 - height * 16) > height * 16 * 0.005) {
      problems.push(`${path} is ${width}×${height}: the ratio must be 16:9`);
    } else if (width < RULES_IMAGE.width || height < RULES_IMAGE.height) {
      problems.push(
        `${path} is ${width}×${height}: at least ${RULES_IMAGE.width}×${RULES_IMAGE.height} is needed`,
      );
    }
    if (problems.length === before) found.set(path, { name, bytes });
  }
  return found;
}

function missingArt(problems: string[]): undefined {
  problems.push(
    `hub/key-art.png is missing: a ${KEY_ART.width}×${KEY_ART.height} (20:9) PNG with the subject in the right 60%`,
  );
  return undefined;
}

/** The original's size, or undefined (with `problems` filled) when it can't be used. */
async function readKeyArt(path: string, problems: string[], name = 'hub/key-art.png') {
  let meta: Metadata;
  try {
    meta = await sharp(path).metadata();
  } catch {
    problems.push(`${name} is not an image`);
    return undefined;
  }
  const { width = 0, height = 0 } = meta;
  const before = problems.length;
  if (meta.format !== 'png') problems.push(`${name} must be a PNG, not ${meta.format}`);
  if (Math.abs(width * 9 - height * 20) > height * 20 * 0.005) {
    problems.push(`${name} is ${width}×${height}: the ratio must be 20:9`);
  } else if (width < KEY_ART.width || height < KEY_ART.height) {
    problems.push(
      `${name} is ${width}×${height}: at least ${KEY_ART.width}×${KEY_ART.height} is needed`,
    );
  }
  return problems.length === before ? { path, width, height } : undefined;
}

function readLoop(path: string, problems: string[]) {
  const bytes = readFileSync(path);
  if (bytes.length > LOOP_MAX_BYTES) {
    problems.push(`hub/loop.mp4 is ${(bytes.length / 1048576).toFixed(1)} MB: at most 2 MB`);
  }
  const seconds = mp4Duration(bytes);
  if (seconds === undefined) problems.push('hub/loop.mp4 is not a readable MP4');
  else if (seconds > LOOP_MAX_SECONDS) {
    problems.push(`hub/loop.mp4 lasts ${seconds.toFixed(1)} s: at most ${LOOP_MAX_SECONDS} s`);
  }
  return bytes;
}

/** What is wrong with the Islands' splash art in `dir`: `<island>.png` missing, or not a 20:9 PNG of key-art size. */
export async function checkIslandArt(dir: string): Promise<string[]> {
  const problems: string[] = [];
  for (const island of ISLANDS) {
    const name = `${island}.png`;
    const path = join(dir, name);
    if (existsSync(path)) await readKeyArt(path, problems, name);
    else problems.push(`${name} is missing`);
  }
  return problems;
}

/** The largest region of the original with the target's ratio, centred on `focus` (in %). */
export function cropRegion(
  source: { width: number; height: number },
  target: { width: number; height: number },
  focus: { x: number; y: number },
) {
  const wide = source.width * target.height > source.height * target.width;
  const width = wide ? Math.round((source.height * target.width) / target.height) : source.width;
  const height = wide ? source.height : Math.round((source.width * target.height) / target.width);
  const place = (size: number, whole: number, percent: number) =>
    Math.min(whole - size, Math.max(0, Math.round((whole * percent) / 100 - size / 2)));
  return {
    left: place(width, source.width, focus.x),
    top: place(height, source.height, focus.y),
    width,
    height,
  };
}

function crop(
  art: { path: string; width: number; height: number },
  size: { width: number; height: number },
  focus: { x: number; y: number },
) {
  return sharp(art.path)
    .extract(cropRegion(art, size, focus))
    .resize(size.width, size.height)
    .webp({ quality: 82 })
    .toBuffer();
}

const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex').slice(0, 8);
