// The Vercel build (vercel.json): installs the editor and web templates, then exports the client
// into apps/client/dist, which Vercel serves at /. The production site gets the release build;
// PR previews get the debug build, which has the test bridge (window.xomdao) and the sandbox
// (?play=<id>). XOMDAO_SERVER_URL (or the older VITE_SERVER_URL) tells it where the server is.
// The console (apps/console) is built after it and copied to apps/client/dist/console.
import { spawnSync } from 'node:child_process';
import { cpSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const run = (script, args) => {
  const result = spawnSync(process.execPath, [join(import.meta.dirname, script), ...args], {
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

run('setup.mjs', ['--export-only']);
run('export.mjs', process.env.VERCEL_ENV === 'production' ? [] : ['--debug']);

const npm = spawnSync('npm', ['run', 'build', '-w', '@xomdao/console'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (npm.status !== 0) process.exit(npm.status ?? 1);
const root = join(import.meta.dirname, '../..');
const target = join(root, 'apps/client/dist/console');
rmSync(target, { recursive: true, force: true });
cpSync(join(root, 'apps/console/dist'), target, { recursive: true });
