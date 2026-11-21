#!/usr/bin/env node
// Run from a Game's folder after its server build: `node ../../tools/hub-assets/dist/cli.js`.
// Imports `dist/manifest.js`, checks the Game's Hub art, writes `dist/hub/` and exits 1 on problems.
import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildHubAssets } from './art.js';

const gameDir = process.cwd();
const id = basename(gameDir);

function fail(problems: string[]): never {
  console.error(problems.map((p) => `✗ games/${id}: ${p}`).join('\n'));
  process.exit(1);
}

const manifestFile = join(gameDir, 'dist/manifest.js');
if (!existsSync(manifestFile)) {
  fail(['dist/manifest.js is missing: build the server part first']);
}
let manifest: unknown;
try {
  manifest = (await import(pathToFileURL(manifestFile).href)).default;
} catch (error) {
  fail([`manifest.ts does not load: ${error instanceof Error ? error.message : error}`]);
}
const { problems, hub } = await buildHubAssets(gameDir, manifest);
if (problems.length) fail(problems);
console.log(`✓ games/${id}: Hub art${hub?.loop ? ' and loop' : ''} in dist/hub/`);
