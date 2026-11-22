import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const EMBLEM_MAX_BYTES = 16 * 1024;

const PAINT = ['fill', 'stroke', 'color', 'stop-color', 'flood-color', 'lighting-color'];
const ONE_COLOUR = new Set(['currentcolor', 'none', 'inherit', 'transparent']);
const FORBIDDEN = ['script', 'style', 'image', 'foreignObject'];

/**
 * Why `svg` can't be a Game's Emblem: a hand-written SVG in one colour, `currentColor`, that the
 * Hub inlines and tints. Empty when it can.
 */
export function emblemProblems(svg: string): string[] {
  const problems: string[] = [];
  const bytes = Buffer.byteLength(svg);
  if (bytes > EMBLEM_MAX_BYTES) {
    problems.push(`is ${(bytes / 1024).toFixed(1)} KB: at most ${EMBLEM_MAX_BYTES / 1024} KB`);
  }
  const root = /^\s*(?:<\?xml[^>]*\?>\s*)?<svg\b([^>]*)>/.exec(svg);
  if (!root) return [...problems, 'must start with <svg>'];
  if (!/\bviewBox\s*=/.test(root[1] ?? '')) problems.push('needs a viewBox on <svg>');
  for (const tag of FORBIDDEN) {
    if (new RegExp(`<${tag}\\b`, 'i').test(svg)) problems.push(`must not have <${tag}>`);
  }
  const colours = new Set<string>();
  const attribute = new RegExp(`\\s(${PAINT.join('|')})\\s*=\\s*["']([^"']*)["']`, 'g');
  for (const [, , value = ''] of svg.matchAll(attribute)) colours.add(value.trim());
  for (const [, style = ''] of svg.matchAll(/\sstyle\s*=\s*["']([^"']*)["']/g)) {
    for (const declaration of style.split(';')) {
      const [name = '', value = ''] = declaration.split(':').map((part) => part.trim());
      if (PAINT.includes(name.toLowerCase())) colours.add(value);
    }
  }
  const others = [...colours].filter((c) => !ONE_COLOUR.has(c.toLowerCase()));
  if (others.length) problems.push(`paints only with currentColor, not ${others.join(', ')}`);
  if (!/currentColor/i.test(svg)) problems.push('must paint with currentColor');
  return problems;
}

/** The problems of `games/<id>/hub/emblem.svg`, each naming the file. */
export function checkEmblem(gameDir: string): string[] {
  const path = join(gameDir, 'hub/emblem.svg');
  if (!existsSync(path)) {
    return ['hub/emblem.svg is missing: a one-colour SVG painted with currentColor'];
  }
  return emblemProblems(readFileSync(path, 'utf8')).map((p) => `hub/emblem.svg ${p}`);
}
