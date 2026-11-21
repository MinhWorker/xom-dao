// The version of a Game server: a hash of games/<id>/server/** and the source of every shared
// package it imports (and of what those import), tests left out. The Game's bundle carries it in
// dist/version.json and the server gets it through the generated game list (scripts/libs.mjs),
// so a Hub built against other Game server code is refused mid-deploy (GAME_UPDATING).
//   node ../../scripts/game-version.mjs   from games/<id>: writes dist/version.json
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = /\.(ts|tsx|js|mjs|json)$/;
const IMPORT = /(?:from|import)\s*\(?\s*['"](@xomdao\/[a-z0-9-]+)/g;

/** The hash of the code the Game `id`'s server runs, 12 hex characters. */
export function gameVersion(id) {
  const packages = workspacePackages();
  const dirs = [join(root, 'games', id, 'server')];
  const hash = createHash('sha256');
  for (let i = 0; i < dirs.length; i++) {
    for (const file of sourceFiles(dirs[i])) {
      const text = readFileSync(file, 'utf8');
      hash.update(`${relative(root, file)}\0${text}\0`);
      for (const [, name] of text.matchAll(IMPORT)) {
        const dir = packages.get(name);
        if (dir && !dirs.includes(dir)) dirs.push(dir);
      }
    }
  }
  return hash.digest('hex').slice(0, 12);
}

/** `@xomdao/<name>` → its `src/` folder, for packages/*. */
function workspacePackages() {
  const found = new Map();
  for (const name of readdirSync(join(root, 'packages'))) {
    const pkg = join(root, 'packages', name, 'package.json');
    if (existsSync(pkg))
      found.set(JSON.parse(readFileSync(pkg, 'utf8')).name, join(dirname(pkg), 'src'));
  }
  return found;
}

function sourceFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : sourceFiles(path);
      return SOURCE.test(name) && !/\.test\.\w+$/.test(name) ? [path] : [];
    });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const game = process.cwd();
  if (dirname(game) !== join(root, 'games')) {
    console.error('Run game-version.mjs from a games/<id> folder');
    process.exit(1);
  }
  mkdirSync(join(game, 'dist'), { recursive: true });
  const version = gameVersion(basename(game));
  writeFileSync(join(game, 'dist/version.json'), `${JSON.stringify({ version })}\n`);
}
