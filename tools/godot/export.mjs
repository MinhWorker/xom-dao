// Exports a Godot Game to its web bundle: single-threaded ("nothreads") template, no COOP/COEP,
// the Bridge addon's HTML shell, relative paths.
//   node tools/godot/export.mjs <project> [--out dist] [--debug] [--optional]
// From a Game's folder (its `scripts.build`): `node ../../tools/godot/export.mjs godot --out dist`.
// Godot's export filters do not see through symlinks (a Game links the addon from tools/godot), so
// the export runs on a copy of the project in .tools/export/ with symlinks followed; the copy keeps
// Godot's .godot/ import cache between runs. The preset is written there, so a Game commits none.
// `--optional` skips the export, with a warning, when Godot is not installed: a build that only
// needs the Game server (Render) has no use for the client.
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { godot, godotBin, pin, root, templatesDir } from './lib.mjs';

const args = process.argv.slice(2);
const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const debug = args.includes('--debug');
const optional = args.includes('--optional');
const project = args.find((arg, i) => !arg.startsWith('--') && args[i - 1] !== '--out');
if (!project) {
  console.error('Usage: node tools/godot/export.mjs <project> [--out dist] [--debug] [--optional]');
  process.exit(1);
}
const source = resolve(project);
const out = resolve(flag('--out') ?? 'dist');
if (!existsSync(join(source, 'project.godot'))) {
  console.error(`${source} has no project.godot`);
  process.exit(1);
}

if (
  !/^textures\/vram_compression\/import_etc2_astc=true$/m.test(
    readFileSync(join(source, 'project.godot'), 'utf8'),
  )
) {
  // The preset compresses textures for phones; without this Godot refuses to export, in silence.
  console.error(
    'project.godot needs, under [rendering]: textures/vram_compression/import_etc2_astc=true',
  );
  process.exit(1);
}

if (optional && (!godotBin() || !templatesDir())) {
  console.warn(`Godot ${pin.version} is not installed: skipping the client export of ${source}`);
  process.exit(0);
}

const templates = templatesDir();
const quoted = (name) => (templates ? join(templates, name) : '');
const preset = readFileSync(join(import.meta.dirname, 'export_presets.template.cfg'), 'utf8')
  .replace('{{TEMPLATE_DEBUG}}', quoted('web_nothreads_debug.zip'))
  .replace('{{TEMPLATE_RELEASE}}', quoted('web_nothreads_release.zip'));

const staging = join(
  root,
  '.tools',
  'export',
  `${basename(resolve(source, '..'))}-${basename(source)}`,
);
mkdirSync(staging, { recursive: true });
for (const name of readdirSync(staging)) {
  if (name !== '.godot') rmSync(join(staging, name), { recursive: true, force: true });
}
cpSync(source, staging, {
  recursive: true,
  dereference: true,
  filter: (path) => !['.godot', 'dist'].includes(basename(path)) || path === source,
});
writeFileSync(join(staging, 'export_presets.cfg'), preset);

function run(godotArgs) {
  const result = godot(godotArgs, { project: staging });
  if (result.status !== 0) {
    console.error(result.output.trim());
    throw new Error(`godot ${godotArgs.join(' ')} failed`);
  }
}

// Godot names every file after the page (godot.html gives godot.js, godot.wasm and godot.pck),
// so nothing overwrites a dist/index.js the Game's own build wrote. The page becomes index.html,
// which is what the Hub loads.
const built = `${staging}-out`;
rmSync(built, { recursive: true, force: true });
mkdirSync(built, { recursive: true });
run(['--import']);
run([debug ? '--export-debug' : '--export-release', 'Web', join(built, 'godot.html')]);
if (!existsSync(join(built, 'godot.html'))) {
  console.error('Godot did not write godot.html');
  process.exit(1);
}
mkdirSync(out, { recursive: true });
for (const name of readdirSync(out)) {
  if (name === 'index.html' || name.startsWith('godot.')) rmSync(join(out, name), { force: true });
}
for (const name of readdirSync(built)) {
  cpSync(join(built, name), join(out, name === 'godot.html' ? 'index.html' : name));
}
rmSync(built, { recursive: true, force: true });
console.log(`Exported ${basename(source)} to ${out} (${debug ? 'debug' : 'release'}, nothreads)`);
