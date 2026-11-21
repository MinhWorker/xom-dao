// Builds the Harness (Turborepo caches it), then runs its CLI with the same arguments, so
// `npm run harness -- <command>` always runs the current code. Turbo writes to stderr, which
// keeps stdout as the CLI's JSON.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const turbo = createRequire(import.meta.url).resolve('turbo/bin/turbo');

const build = spawnSync(
  process.execPath,
  [turbo, 'run', 'build', '--filter=@xomdao/harness', '--output-logs=errors-only'],
  { cwd: root, stdio: ['ignore', 2, 2] },
);
if (build.status !== 0) process.exit(build.status ?? 1);

const cli = spawnSync(
  process.execPath,
  [resolve(root, 'tools/harness/dist/cli.js'), ...process.argv.slice(2)],
  { stdio: 'inherit' },
);
process.exit(cli.status ?? 1);
