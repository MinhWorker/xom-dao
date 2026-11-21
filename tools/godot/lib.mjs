// Paths and helpers shared by the Godot scripts. What `npm run setup:godot` installs lives in
// .tools/ (git-ignored); GODOT and GODOT_TEMPLATES point elsewhere.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export const root = join(import.meta.dirname, '../..');
export const pin = JSON.parse(readFileSync(join(import.meta.dirname, 'version.json'), 'utf8'));
export const tools = join(root, '.tools');
export const godotDir = join(tools, 'godot', pin.version);

const TEMPLATE_FILES = ['web_nothreads_debug.zip', 'web_nothreads_release.zip'];

/** The pinned editor build for this machine, or null when Godot publishes none. */
export function editorBuild() {
  const key = process.platform === 'darwin' ? 'darwin' : `${process.platform}-${process.arch}`;
  return pin.editor[key] ?? null;
}

/** `.tools/godot/<version>` of this checkout, then of the main checkout when this is a worktree. */
function installDirs() {
  const dirs = [godotDir];
  const common = spawnSync('git', ['rev-parse', '--git-common-dir'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (common.status === 0) {
    const main = dirname(resolve(root, common.stdout.trim()));
    dirs.push(join(main, '.tools', 'godot', pin.version));
  }
  return dirs;
}

/** The Godot executable: $GODOT, the pinned install, or `godot` on the PATH. Null if none. */
export function godotBin() {
  if (process.env.GODOT) return process.env.GODOT;
  const build = editorBuild();
  const pinned =
    build &&
    installDirs()
      .map((dir) => join(dir, build.bin))
      .find(existsSync);
  if (pinned) return pinned;
  const onPath = spawnSync('godot', ['--version'], { stdio: 'ignore' });
  return onPath.status === 0 ? 'godot' : null;
}

export function requireGodot() {
  const bin = godotBin();
  if (bin) return bin;
  console.error(`Godot ${pin.version} is not installed. Run: npm run setup:godot`);
  process.exit(1);
}

/** The folder with the single-threaded web export templates, or null (Godot's own are used). */
export function templatesDir() {
  const dirs = process.env.GODOT_TEMPLATES
    ? [process.env.GODOT_TEMPLATES]
    : installDirs().map((dir) => join(dir, 'templates'));
  return dirs.find((dir) => TEMPLATE_FILES.every((file) => existsSync(join(dir, file)))) ?? null;
}

/** Runs Godot headless on a project; output is captured and returned. Killed after `timeout`. */
export function godot(args, { project, timeout = 10 * 60_000 }) {
  const result = spawnSync(requireGodot(), ['--headless', '--path', project, ...args], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout,
  });
  if (result.error) throw new Error(`godot ${args.join(' ')}: ${result.error.message}`);
  return { status: result.status ?? 1, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}
