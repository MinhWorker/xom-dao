// npm run godot:export [-- --debug] [--game <id>]: export the web client and game packs, or only
// refresh one game pack against an existing web build. Full exports reuse unchanged packs from
// .tools/export/packs; the client copy keeps Godot's .godot/ import cache between runs.
// Godot's export filters do not see through symlinks, so exports run on a copy of the client in
// .tools/export/client with the games copied in and their presets added to export_presets.cfg.
// XOMDAO_SERVER_URL (or the older VITE_SERVER_URL) bakes the server URL into the page; without it
// the client talks to the page's own origin (core/net.gd).
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, relative, sep } from 'node:path';
import { client, godot, requireGodot, root, templatesDir, tools, walk } from './lib.mjs';
import { link } from './link.mjs';

const BUILD_STATE_VERSION = 1;
const PACK_CACHE_VERSION = 1; // Bump when pack inputs or packPreset/export behavior changes.

function usage() {
  console.log('Usage: npm run godot:export [-- --debug] [--game <id>]');
  console.log('  Without --game, export the web client and all game packs.');
  console.log('  With --game, update one pack in a matching existing web build.');
}

function parseArgs(args) {
  const options = { debug: false, game: null };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') return { help: true };
    if (arg === '--debug') {
      if (options.debug) throw new Error('Use --debug only once.');
      options.debug = true;
    } else if (arg === '--game') {
      if (options.game !== null) throw new Error('Use --game only once.');
      const game = args[i + 1];
      if (!game || game.startsWith('--')) throw new Error('--game needs a game id.');
      options.game = game;
      i += 1;
    } else if (arg.startsWith('--game=')) {
      if (options.game !== null) throw new Error('Use --game only once.');
      options.game = arg.slice('--game='.length);
      if (!options.game) throw new Error('--game needs a game id.');
    } else {
      throw new Error(`Unknown export option: ${arg}`);
    }
  }
  return options;
}

function fingerprint(files, inputs) {
  const hash = createHash('sha256').update(JSON.stringify(inputs));
  for (const file of [...files].sort()) {
    hash
      .update('\0')
      .update(relative(root, file))
      .update('\0')
      .update(readFileSync(file))
      .update('\0');
  }
  return hash.digest('hex');
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function writeJson(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(temporary, file);
}

function parseJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
    return;
  }

  const { debug, game: targetGame } = options;
  const modeName = debug ? 'debug' : 'release';
  const mode = debug ? '--export-debug' : '--export-release';
  requireGodot();

  const templates = {
    debug: join(templatesDir, 'web_nothreads_debug.zip'),
    release: join(templatesDir, 'web_nothreads_release.zip'),
  };
  if (!existsSync(templates.debug) || !existsSync(templates.release)) {
    throw new Error('Web export templates are missing. Run: npm run setup:godot');
  }

  const games = link();
  if (targetGame && !games.includes(targetGame)) {
    throw new Error(
      `No Godot game "${targetGame}". Available games: ${games.join(', ') || '(none)'}`,
    );
  }

  const dist = join(client, 'dist');
  const exportDir = join(tools, 'export');
  const project = join(exportDir, 'client');
  const buildStateFile = join(exportDir, 'web-build.json');
  const packCache = join(exportDir, 'packs', modeName);
  const server = process.env.XOMDAO_SERVER_URL || process.env.VITE_SERVER_URL || '';
  const head = server ? `<script>window.XOMDAO_SERVER=${JSON.stringify(server)}</script>` : '';
  const sourcePresets = readFileSync(join(client, 'export_presets.cfg'), 'utf8');
  const web = sourcePresets
    .replace(/^custom_template\/debug=.*$/m, `custom_template/debug="${templates.debug}"`)
    .replace(/^custom_template\/release=.*$/m, `custom_template/release="${templates.release}"`)
    .replace(/^html\/head_include=.*$/m, `html/head_include=${JSON.stringify(head)}`);
  const packPresetBase = web.replace(/^html\/head_include=.*$/m, 'html/head_include=""');
  const engineVersion = readFileSync(join(import.meta.dirname, 'version.json'), 'utf8');
  const webFiles = walk(client, new Set([join(client, 'content'), dist]));
  const webFingerprint = fingerprint(webFiles, {
    version: BUILD_STATE_VERSION,
    mode: modeName,
    server,
    engineVersion,
    webPreset: web,
  });

  function packPreset(index, id) {
    const outside = readdirSync(project)
      .filter((name) => !name.startsWith('.') && name !== 'content')
      .map((name) => (statSync(join(project, name)).isDirectory() ? `${name}/*` : name))
      .concat(games.filter((other) => other !== id).map((other) => `content/${other}/*`))
      .concat(`content/${id}/test/*`);
    return web
      .replace(/^\[preset\.0\]/m, `[preset.${index}]`)
      .replace(/^\[preset\.0\.options\]/m, `[preset.${index}.options]`)
      .replace(/^name=.*$/m, `name="content:${id}"`)
      .replace(/^runnable=.*$/m, 'runnable=false')
      .replace(/^custom_features=.*$/m, 'custom_features="game_pack"')
      .replace(/^include_filter=.*$/m, `include_filter="content/${id}/RULES.md"`)
      .replace(/^exclude_filter=.*$/m, `exclude_filter="${outside.join(', ')}"`);
  }

  function prepareProject() {
    mkdirSync(project, { recursive: true });
    for (const name of readdirSync(project))
      if (name !== '.godot') rmSync(join(project, name), { recursive: true, force: true });
    cpSync(client, project, {
      recursive: true,
      dereference: true,
      filter: (path) => !['.godot', 'dist'].includes(relative(client, path)),
    });

    // Each game's RULES.md goes into its pack, where the hub's Luật board reads it.
    for (const id of games) {
      const rules = join(root, 'games', id, 'RULES.md');
      if (existsSync(rules)) cpSync(rules, join(project, 'content', id, 'RULES.md'));
    }

    writeFileSync(
      join(project, 'export_presets.cfg'),
      [web, ...games.map((id, i) => packPreset(i + 1, id))].join('\n'),
    );
  }

  function run(args, output) {
    const result = godot(args, { project });
    if (result.status !== 0 || !existsSync(output)) {
      console.error(result.output.trim());
      throw new Error(`godot ${args.join(' ')} failed`);
    }
  }

  function gameFingerprint(id) {
    const gameFolder = join(root, 'games', id, 'godot');
    const files = walk(gameFolder).filter(
      (file) => !relative(gameFolder, file).startsWith(`test${sep}`),
    );
    const rules = join(root, 'games', id, 'RULES.md');
    if (existsSync(rules)) files.push(rules);
    return fingerprint(files, {
      version: PACK_CACHE_VERSION,
      id,
      mode: modeName,
      engineVersion,
      webPreset: packPresetBase,
    });
  }

  function cachedGamePack(id, inputFingerprint) {
    const directory = join(packCache, id);
    const file = join(directory, 'pack.pck');
    const state = parseJson(join(directory, 'state.json'));
    if (
      !state ||
      state.version !== PACK_CACHE_VERSION ||
      state.fingerprint !== inputFingerprint ||
      !existsSync(file)
    )
      return null;
    const hash = sha256(file);
    return hash === state.sha256 ? { file, sha256: hash } : null;
  }

  let imported = false;
  function importProject() {
    if (imported) return;
    run(['--import'], join(project, '.godot'));
    imported = true;
  }

  function exportGamePack(id) {
    const inputFingerprint = gameFingerprint(id);
    const cacheDirectory = join(packCache, id);
    const cacheFile = join(cacheDirectory, 'pack.pck');
    const stateFile = join(cacheDirectory, 'state.json');
    const temporary = join(dist, 'content', `${id}.pck`);
    rmSync(temporary, { force: true });

    let result = cachedGamePack(id, inputFingerprint);
    const cacheHit = result !== null;
    if (result) {
      copyFileSync(result.file, temporary);
    } else {
      importProject();
      run(['--export-pack', `content:${id}`, temporary], temporary);
      result = { file: temporary, sha256: sha256(temporary) };

      mkdirSync(cacheDirectory, { recursive: true });
      const stagedPack = `${cacheFile}.${process.pid}.tmp`;
      copyFileSync(temporary, stagedPack);
      renameSync(stagedPack, cacheFile);
      writeJson(stateFile, {
        version: PACK_CACHE_VERSION,
        fingerprint: inputFingerprint,
        sha256: result.sha256,
      });
    }

    const filename = `${id}.${result.sha256.slice(0, 12)}.pck`;
    copyFileSync(temporary, join(dist, 'content', filename));
    rmSync(temporary, { force: true });
    console.log(`✓ ${filename}${cacheHit ? ' (cache)' : ''}`);
    return filename;
  }

  function readCompatibleManifest() {
    const state = parseJson(buildStateFile);
    if (
      !state ||
      state.version !== BUILD_STATE_VERSION ||
      state.mode !== modeName ||
      state.fingerprint !== webFingerprint
    ) {
      const fullExport = debug ? 'npm run godot:export -- --debug' : 'npm run godot:export';
      throw new Error(
        `No matching ${modeName} web build. Run "${fullExport}" first, ` +
          'and use a full export after changing apps/client or the server URL.',
      );
    }

    const manifestFile = join(dist, 'content/manifest.json');
    if (!existsSync(join(dist, 'index.html')) || !existsSync(manifestFile)) {
      throw new Error(`No complete web build in ${dist}. Run a full godot:export first.`);
    }
    const manifest = parseJson(manifestFile);
    const ids = Object.keys(manifest ?? {}).sort();
    if (JSON.stringify(ids) !== JSON.stringify([...games].sort())) {
      throw new Error('The game list changed since the web build. Run a full godot:export first.');
    }
    for (const id of games) {
      const filename = manifest[id];
      if (
        typeof filename !== 'string' ||
        basename(filename) !== filename ||
        !filename.endsWith('.pck') ||
        !existsSync(join(dist, 'content', filename))
      ) {
        throw new Error(
          `Pack for ${id} is missing from the web build. Run a full godot:export first.`,
        );
      }
    }
    return manifest;
  }

  let manifest = null;
  if (targetGame) {
    manifest = readCompatibleManifest();
  } else {
    rmSync(dist, { recursive: true, force: true });
    mkdirSync(join(dist, 'content'), { recursive: true });
    rmSync(buildStateFile, { force: true });
  }

  prepareProject();

  if (targetGame) {
    manifest[targetGame] = exportGamePack(targetGame);
    writeJson(join(dist, 'content/manifest.json'), manifest);
    console.log(`✓ updated ${targetGame} in the ${modeName} web build`);
    return;
  }

  importProject();
  const index = join(dist, 'index.html');
  run([mode, 'Web', index], index);
  // Fullscreen phones expose their notch/home-bar env() values with viewport-fit=cover.
  writeFileSync(
    index,
    readFileSync(index, 'utf8').replace(
      /(<meta name="viewport" content=")([^"]*)"/,
      '$1$2, viewport-fit=cover"',
    ),
  );
  console.log(`✓ web ${modeName} build`);

  manifest = {};
  for (const id of games) manifest[id] = exportGamePack(id);
  writeJson(join(dist, 'content/manifest.json'), manifest);
  writeJson(buildStateFile, {
    version: BUILD_STATE_VERSION,
    mode: modeName,
    fingerprint: webFingerprint,
  });
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
