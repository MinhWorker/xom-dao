// Finds every game in games/* and builds the libraries the server runs:
// @xomdao/sdk, each game's server part (src/index.ts, the legacy plugin; server/index.ts, the
// new platform's Game server), then @xomdao/shared.
//   node scripts/libs.mjs             generate the game list + build
//   node scripts/libs.mjs --watch     same, then rebuild on change (npm run dev)
//   node scripts/libs.mjs --generate  only write the game list (npm install runs this)
// The game list is packages/shared/src/generated/games.ts (gitignored): one static import per
// game, so tsc, vitest and Nest all see it. Each game must also be a devDependency of
// @xomdao/shared (checked below), so Turborepo builds games first and re-tests shared when one
// changes.
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gameVersion } from './game-version.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

const ids = findGames();
const serverIds = findGameServers(ids);
const legacyIds = ids.filter((id) => existsSync(join(root, 'games', id, 'src/index.ts')));
writeGameList(legacyIds, serverIds);
if (args.includes('--generate')) process.exit(0);

const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');
const projects = [
  'packages/sdk/tsconfig.build.json',
  ...legacyIds.map((id) => `games/${id}/tsconfig.build.json`),
  ...serverIds.map((id) => `games/${id}/tsconfig.server.build.json`),
  'packages/shared/tsconfig.build.json',
];
for (const project of projects) forgetIfStale(project);
const watch = args.includes('--watch') ? ['--watch', '--preserveWatchOutput'] : [];
const res = spawnSync(process.execPath, [tsc, '-b', ...projects, ...watch], {
  cwd: root,
  stdio: 'inherit',
});
process.exit(res.status ?? 1);

/**
 * `tsc -b` decides a project is up to date by its root file only (`src/index.ts`), so a change
 * in any other file (a game's rules, say) was never rebuilt and the server ran old code. The
 * build info lists every file the last build used: if one is newer, drop the build info so the
 * project builds again.
 */
function forgetIfStale(project) {
  const info = join(root, project.replace(/\.json$/, '.tsbuildinfo'));
  if (!existsSync(info)) return;
  const builtAt = statSync(info).mtimeMs;
  const { fileNames = [] } = JSON.parse(readFileSync(info, 'utf8'));
  const changed = fileNames
    .filter((name) => !name.includes('node_modules'))
    .map((name) => resolve(dirname(info), name))
    .some((file) => !existsSync(file) || statSync(file).mtimeMs > builtAt);
  if (changed) unlinkSync(info);
}

/** Game ids (= folder names), checked so mistakes fail here with a clear message. */
function findGames() {
  const dir = join(root, 'games');
  const found = [];
  const problems = [];
  const sharedPkg = JSON.parse(readFileSync(join(root, 'packages/shared/package.json'), 'utf8'));
  for (const id of readdirSync(dir).sort()) {
    const folder = join(dir, id);
    const pkgPath = join(folder, 'package.json');
    if (!existsSync(pkgPath)) continue;
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) problems.push(`games/${id}: use a kebab-case name`);
    if (pkg.name !== `@xomdao/game-${id}`)
      problems.push(`games/${id}/package.json: "name" must be "@xomdao/game-${id}"`);
    // A Game made for the new platform has `server/index.ts` and no legacy plugin in `src/`.
    const files = existsSync(join(folder, 'server/index.ts'))
      ? []
      : ['src/index.ts', 'tsconfig.build.json'];
    for (const file of files) {
      if (!existsSync(join(folder, file))) problems.push(`games/${id}: missing ${file}`);
    }
    if (!sharedPkg.devDependencies?.[pkg.name])
      problems.push(`packages/shared/package.json: add "${pkg.name}": "*" to devDependencies`);
    if (!pkg.scripts?.build) problems.push(`games/${id}/package.json: missing a "build" script`);
    if (!existsSync(join(root, 'node_modules/@xomdao', `game-${id}`)))
      problems.push(`games/${id}: not installed yet, run npm install`);
    found.push(id);
  }
  if (problems.length) {
    console.error(problems.map((p) => `✗ ${p}`).join('\n'));
    process.exit(1);
  }
  return found;
}

/** Games that expose the new server entry are loaded by GameHostModule. */
function findGameServers(ids) {
  const found = [];
  const problems = [];
  for (const id of ids) {
    const folder = join(root, 'games', id);
    if (!existsSync(join(folder, 'server/index.ts'))) continue;
    const pkg = JSON.parse(readFileSync(join(folder, 'package.json'), 'utf8'));
    if (!pkg.exports?.['./server']) {
      problems.push(`games/${id}/package.json: export "./server" for GameHostModule`);
    }
    if (!pkg.scripts?.build?.includes('game-version.mjs')) {
      problems.push(
        `games/${id}/package.json: end "build" with node ../../scripts/game-version.mjs`,
      );
    }
    if (!pkg.scripts?.build?.includes('tools/hub-assets/dist/cli.js')) {
      problems.push(
        `games/${id}/package.json: end "build" with node ../../tools/hub-assets/dist/cli.js, which fails without hub/key-art.png`,
      );
    }
    if (!pkg.devDependencies?.['@xomdao/hub-assets']) {
      problems.push(`games/${id}/package.json: add "@xomdao/hub-assets": "*" to devDependencies`);
    }
    if (!existsSync(join(folder, 'tsconfig.server.build.json'))) {
      problems.push(
        `games/${id}/tsconfig.server.build.json: compile server/index.ts to dist/server/`,
      );
    }
    found.push(id);
  }
  if (problems.length) {
    console.error(problems.map((p) => `✗ ${p}`).join('\n'));
    process.exit(1);
  }
  return found;
}

function writeGameList(ids, serverIds) {
  const name = (id) => id.replace(/-(\w)/g, (_, c) => c.toUpperCase());
  const source = [
    '// Generated by scripts/libs.mjs from games/*. Do not edit; it is rewritten on every build.',
    "import type { AnyGamePlugin } from '@xomdao/sdk/legacy';",
    "import type { AnyGameServer } from '@xomdao/sdk';",
    ...ids.map((id) => `import ${name(id)} from '@xomdao/game-${id}';`),
    ...serverIds.map((id) => `import ${name(id)}Server from '@xomdao/game-${id}/server';`),
    '',
    `export const plugins: AnyGamePlugin[] = [${ids.map(name).join(', ')}];`,
    `export const serverGames: (AnyGameServer & { version: string })[] = [${serverIds
      .map((id) => `{ ...${name(id)}Server, version: '${gameVersion(id)}' }`)
      .join(', ')}];`,
    '',
  ].join('\n');
  const file = join(root, 'packages/shared/src/generated/games.ts');
  if (existsSync(file) && readFileSync(file, 'utf8') === source) return;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, source);
}
