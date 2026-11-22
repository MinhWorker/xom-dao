import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { type AnyManifest, ISLANDS, parseManifest } from '@xomdao/sdk';
import { describe, expect, it } from 'vitest';
import { checkEmblem, EMBLEM_MAX_BYTES, emblemProblems } from './emblem.js';

const svg = (body: string, root = 'viewBox="0 0 64 64"') =>
  `<svg xmlns="http://www.w3.org/2000/svg" ${root}>${body}</svg>`;

describe('emblemProblems', () => {
  it('takes one colour, currentColor, in attributes and styles', () => {
    expect(
      emblemProblems(svg('<path d="M0 0h64v64z" fill="currentColor" stroke="none"/>')),
    ).toEqual([]);
    const styled = svg('<g style="fill: currentColor"><rect width="8" height="8"/></g>');
    expect(emblemProblems(`<?xml version="1.0"?>\n${styled}`)).toEqual([]);
  });

  it('refuses other colours, wherever they are', () => {
    const painted = svg(
      '<path fill="currentColor" stroke="#fff"/><g style="fill:red;opacity:.5"/>',
    );
    expect(emblemProblems(painted)).toEqual(['paints only with currentColor, not #fff, red']);
    expect(emblemProblems(svg('<path d="M0 0h8v8z"/>'))).toEqual(['must paint with currentColor']);
  });

  it('refuses what is not a plain, small SVG', () => {
    expect(emblemProblems('<png/>')).toEqual(['must start with <svg>']);
    expect(emblemProblems(svg('<path fill="currentColor"/>', 'width="64"'))).toEqual([
      'needs a viewBox on <svg>',
    ]);
    const extras = svg(
      '<style>path{fill:blue}</style><image href="a.png"/><path fill="currentColor"/>',
    );
    expect(emblemProblems(extras)).toEqual(['must not have <style>', 'must not have <image>']);
    const big = svg(`<path fill="currentColor" d="${'M0 0'.repeat(EMBLEM_MAX_BYTES / 4)}"/>`);
    expect(emblemProblems(big)[0]).toMatch(/^is 16\.\d KB: at most 16 KB$/);
  });
});

describe("the Games' manifests and Emblems", () => {
  const games = join(import.meta.dirname, '../../../games');
  const ids = readdirSync(games).filter((id) => existsSync(join(games, id, 'manifest.ts')));
  const load = async (id: string) =>
    (await import(join(games, id, 'manifest.ts'))).default as AnyManifest;

  it('fill every Island, with the soon Games', async () => {
    const manifests = await Promise.all(ids.map(load));
    expect(manifests.filter((m) => m.status === 'soon')).toHaveLength(11);
    expect(new Set(manifests.map((m) => m.island))).toEqual(new Set(ISLANDS));
  });

  it.each(ids)('%s has a valid manifest named after its folder and an Emblem', async (id) => {
    const manifest = await load(id);
    expect(parseManifest(manifest).success).toBe(true);
    expect(manifest.id).toBe(id);
    expect(checkEmblem(join(games, id))).toEqual([]);
  });

  it.each(ids)('%s, when soon, has only its manifest and Emblem', async (id) => {
    if ((await load(id)).status !== 'soon') return;
    const folder = join(games, id);
    const files = readdirSync(folder, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => join(entry.parentPath, entry.name).slice(folder.length + 1))
      .filter((file) => !/^(node_modules|dist)\b/.test(file) && !file.endsWith('.tsbuildinfo'));
    expect(files.sort()).toEqual(['hub/emblem.svg', 'manifest.ts']);
  });
});
