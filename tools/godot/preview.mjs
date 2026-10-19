// Persistent, isolated Godot windows for visual and animation iteration.
import { spawn, spawnSync } from 'node:child_process';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import sharp from 'sharp';
import { client, requireGodot, root } from './lib.mjs';
import { link } from './link.mjs';

const command = process.argv[2];
const previewRoot = join(client, '.godot', 'visual-preview');
const defaultSize = '960x540';
const timeoutMs = 20_000;

function usage() {
  console.log(
    [
      'Godot visual workbench',
      '',
      'Usage:',
      '  npm run godot:preview -- open <index> <scene> [--size 960x540] [--import]',
      '  npm run godot:preview -- list',
      '  npm run godot:preview -- inspect <index>',
      '  npm run godot:preview -- refresh <index> [--import]',
      '  npm run godot:preview -- play <index> [animation]',
      '  npm run godot:preview -- pause <index>',
      '  npm run godot:preview -- resume <index>',
      '  npm run godot:preview -- seek <index> <seconds>',
      '  npm run godot:preview -- capture <index> [--output .shots/preview.png] [--no-refresh] [--import]',
      '  npm run godot:preview -- capture-sequence <index> [--animation name] [--duration 1.5] [--frames 6] [--output .shots/preview-sequence.png]',
      '  npm run godot:preview -- close <index>',
      '',
      'An index is a non-negative integer. Preview scenes use res:// paths or paths inside apps/client.',
    ].join('\n'),
  );
}

function parseOptions(args) {
  const positional = [];
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument.startsWith('--')) {
      positional.push(argument);
      continue;
    }
    const equals = argument.indexOf('=');
    if (equals >= 0) {
      options[argument.slice(2, equals)] = argument.slice(equals + 1);
      continue;
    }
    const name = argument.slice(2);
    if (['no-refresh', 'import'].includes(name)) {
      options[name] = true;
      continue;
    }
    const value = args[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${argument}`);
    options[name] = value;
    index += 1;
  }
  return { positional, options };
}

function parseIndex(value) {
  if (!/^\d+$/.test(String(value)))
    throw new Error(`Preview index must be a non-negative integer: ${value}`);
  return Number(value);
}

function slotDir(index) {
  return join(previewRoot, String(index));
}

function slotFile(index, name) {
  return join(slotDir(index), name);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function readText(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

function normalizeScene(value) {
  if (value.startsWith('res://')) return value;
  const absolute = resolve(root, value);
  const pathFromClient = relative(client, absolute);
  if (pathFromClient.startsWith('..') || isAbsolute(pathFromClient)) {
    throw new Error(`Scene must be under apps/client or use a res:// path: ${value}`);
  }
  return `res://${pathFromClient.split(sep).join('/')}`;
}

function validateSize(value) {
  const match = /^(\d+)x(\d+)$/.exec(value);
  if (!match || Number(match[1]) < 160 || Number(match[2]) < 90) {
    throw new Error(`Size must look like 960x540 (at least 160x90): ${value}`);
  }
  return { width: Number(match[1]), height: Number(match[2]) };
}

function runImport() {
  console.log('Importing changed Godot resources…');
  const result = spawnSync(requireGodot(), ['--headless', '--path', client, '--import'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = (result.stdout ?? '') + (result.stderr ?? '');
  if (result.error || result.status !== 0) {
    throw new Error(`Godot resource import failed.\n${output || result.error?.message || ''}`);
  }
}

function writeRequest(index, request) {
  const directory = slotDir(index);
  mkdirSync(directory, { recursive: true });
  const requestPath = slotFile(index, 'request.json');
  const temporaryPath = `${requestPath}.tmp`;
  const id = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  rmSync(slotFile(index, 'result.json'), { force: true });
  writeFileSync(temporaryPath, JSON.stringify({ ...request, id }));
  renameSync(temporaryPath, requestPath);
  return id;
}

async function waitForResult(index, id, timeout = timeoutMs) {
  const resultPath = slotFile(index, 'result.json');
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = readJson(resultPath);
    if (result?.id === id) {
      rmSync(resultPath, { force: true });
      if (!result.ok) throw new Error(result.error || 'Preview action failed.');
      return result;
    }
    await delay(100);
  }
  const log = readText(slotFile(index, 'godot.log')).slice(-4000);
  throw new Error(
    'Preview #' +
      index +
      ' did not respond in ' +
      Math.round(timeout / 1000) +
      's.' +
      (log ? `\nGodot log:\n${log}` : ''),
  );
}

async function request(index, payload, timeout) {
  const id = writeRequest(index, payload);
  return waitForResult(index, id, timeout);
}

function positionFor(index, size) {
  return { x: (index % 2) * size.width, y: Math.floor(index / 2) * size.height };
}

async function waitForReady(index) {
  const readyPath = slotFile(index, 'ready.json');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ready = readJson(readyPath);
    const pid = Number(readText(slotFile(index, 'pid')));
    if (ready && ready.pid === pid) {
      if (!ready.ok) throw new Error(`Could not open preview scene: ${ready.error}`);
      return ready;
    }
    if (!processIsAlive(pid)) break;
    await delay(100);
  }
  const log = readText(slotFile(index, 'godot.log')).slice(-4000);
  throw new Error(`Godot preview #${index} did not start.${log ? `\nGodot log:\n${log}` : ''}`);
}

function launch(index, scene, size) {
  const directory = slotDir(index);
  mkdirSync(directory, { recursive: true });
  rmSync(slotFile(index, 'ready.json'), { force: true });
  const windowPosition = positionFor(index, size);
  const position = `${windowPosition.x},${windowPosition.y}`;
  const logFd = openSync(slotFile(index, 'godot.log'), 'w');
  const child = spawn(
    requireGodot(),
    [
      '--path',
      client,
      '--scene',
      'res://dev/visual_workbench.tscn',
      '--windowed',
      '--resolution',
      `${size.width}x${size.height}`,
      '--position',
      position,
      '--',
      `--preview-index=${index}`,
      `--preview-scene=${scene}`,
      `--preview-size=${size.width}x${size.height}`,
      `--preview-position=${position}`,
    ],
    { cwd: root, detached: true, stdio: ['ignore', logFd, logFd] },
  );
  closeSync(logFd);
  if (!child.pid) throw new Error('Could not start the Godot preview process.');
  child.unref();
  writeFileSync(slotFile(index, 'pid'), String(child.pid));
  return child.pid;
}

async function ensureOpen(index, scene, size) {
  mkdirSync(slotDir(index), { recursive: true });
  const oldPid = Number(readText(slotFile(index, 'pid')));
  if (!processIsAlive(oldPid)) {
    rmSync(slotFile(index, 'pid'), { force: true });
    launch(index, scene, size);
    await waitForReady(index);
    return;
  }
  const ready = readJson(slotFile(index, 'ready.json'));
  if (!ready || ready.pid !== oldPid) await waitForReady(index);
  const current = readJson(slotFile(index, 'ready.json'));
  if (current?.scene !== scene) {
    await request(index, { action: 'open', scene });
    writeFileSync(slotFile(index, 'ready.json'), JSON.stringify({ ...current, scene }));
  }
  const position = positionFor(index, size);
  await request(index, {
    action: 'resize',
    size,
    position,
  });
}

function requireOpen(index) {
  const pid = Number(readText(slotFile(index, 'pid')));
  if (!processIsAlive(pid)) {
    throw new Error(
      'Preview #' +
        index +
        ' is not running. Open it with: npm run godot:preview -- open ' +
        index +
        ' res://path/to/preview.tscn',
    );
  }
}

function outputPath(value, fallback) {
  const path = value || fallback;
  return isAbsolute(path) ? path : resolve(root, path);
}

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

async function makeContactSheet(paths, animation, duration, output) {
  const tileWidth = 480;
  const imageHeight = 270;
  const labelHeight = 38;
  const cellHeight = imageHeight + labelHeight;
  const columns = Math.min(3, paths.length);
  const rows = Math.ceil(paths.length / columns);
  const composites = [];
  for (const [frameIndex, path] of paths.entries()) {
    const column = frameIndex % columns;
    const row = Math.floor(frameIndex / columns);
    const left = column * tileWidth;
    const top = row * cellHeight;
    const image = await sharp(path)
      .resize(tileWidth, imageHeight, { fit: 'contain', background: '#172b3d' })
      .png()
      .toBuffer();
    const seconds = (duration * frameIndex) / Math.max(paths.length - 1, 1);
    const label = Buffer.from(
      '<svg width="' +
        tileWidth +
        '" height="' +
        labelHeight +
        '">' +
        '<rect width="100%" height="100%" fill="#263c4e"/>' +
        '<text x="16" y="26" fill="white" font-family="sans-serif" font-size="18">' +
        escapeXml(animation) +
        ' · ' +
        seconds.toFixed(2) +
        's</text></svg>',
    );
    composites.push({ input: image, left, top });
    composites.push({ input: label, left, top: top + imageHeight });
  }
  await sharp({
    create: {
      width: columns * tileWidth,
      height: rows * cellHeight,
      channels: 3,
      background: '#172b3d',
    },
  })
    .composite(composites)
    .png()
    .toFile(output);
}

async function execute() {
  if (!command || command === '--help' || command === '-h') {
    usage();
    return;
  }
  if (command === 'list') {
    if (!existsSync(previewRoot)) {
      console.log('No previews are open.');
      return;
    }
    const entries = readdirSync(previewRoot, { withFileTypes: true });
    const slots = entries
      .filter((entry) => entry.isDirectory())
      .sort((a, b) => Number(a.name) - Number(b.name));
    const active = slots.flatMap((entry) => {
      const index = Number(entry.name);
      const pid = Number(readText(slotFile(index, 'pid')));
      if (!processIsAlive(pid)) return [];
      const state = readJson(slotFile(index, 'ready.json')) ?? {};
      return [{ index, pid, scene: state.scene ?? 'starting' }];
    });
    console.log(active.length ? JSON.stringify(active, null, 2) : 'No previews are open.');
    return;
  }

  const parsed = parseOptions(process.argv.slice(3));
  const positional = parsed.positional;
  const options = parsed.options;
  const index = parseIndex(positional[0]);

  if (command === 'open') {
    if (!positional[1]) throw new Error('Open requires a scene path.');
    link();
    const scene = normalizeScene(positional[1]);
    if (options.import) runImport();
    const size = validateSize(String(options.size ?? defaultSize));
    await ensureOpen(index, scene, size);
    console.log(`Preview #${index} is open: ${scene}`);
    return;
  }

  if (options.import) runImport();
  requireOpen(index);
  if (command === 'inspect') {
    console.log(JSON.stringify(await request(index, { action: 'inspect' }), null, 2));
  } else if (command === 'refresh') {
    const result = await request(index, { action: 'refresh' });
    console.log(`Preview #${index} refreshed: ${result.scene}`);
  } else if (command === 'play') {
    const result = await request(index, { action: 'play', animation: positional[1] ?? '' });
    console.log(`Preview #${index} playing ${result.animation}.`);
  } else if (command === 'pause' || command === 'resume') {
    await request(index, { action: command });
    console.log(`Preview #${index} ${command === 'pause' ? 'paused.' : 'resumed.'}`);
  } else if (command === 'seek') {
    const seconds = Number(positional[1]);
    if (!Number.isFinite(seconds) || seconds < 0)
      throw new Error('Seek time must be a non-negative number of seconds.');
    const result = await request(index, { action: 'seek', seconds });
    console.log(
      'Preview #' +
        index +
        ' at ' +
        Number(result.position).toFixed(2) +
        's in ' +
        result.animation +
        '.',
    );
  } else if (command === 'capture') {
    if (!options['no-refresh']) await request(index, { action: 'refresh' });
    const output = outputPath(options.output, `.shots/preview-${index}.png`);
    mkdirSync(resolve(output, '..'), { recursive: true });
    const result = await request(index, { action: 'capture', output });
    console.log(`Captured ${result.width}x${result.height}: ${output}`);
  } else if (command === 'capture-sequence') {
    const animation = String(options.animation ?? '');
    const duration = Number(options.duration ?? 1.5);
    const frames = Number(options.frames ?? 6);
    if (!Number.isFinite(duration) || duration <= 0)
      throw new Error('--duration must be greater than zero.');
    if (!Number.isInteger(frames) || frames < 2 || frames > 24)
      throw new Error('--frames must be an integer from 2 to 24.');
    if (!options['no-refresh']) await request(index, { action: 'refresh' });
    const output = outputPath(options.output, `.shots/preview-${index}-sequence.png`);
    mkdirSync(resolve(output, '..'), { recursive: true });
    const sequenceDir = join(slotDir(index), `sequence-${Date.now()}`);
    const result = await request(
      index,
      {
        action: 'capture_sequence',
        animation,
        duration,
        frames,
        output_dir: sequenceDir,
      },
      Math.max(timeoutMs, frames * 5000),
    );
    const usedAnimation = result.animation || animation || 'animation';
    await makeContactSheet(result.frames, usedAnimation, duration, output);
    console.log(`Captured ${result.frames.length} frames of ${usedAnimation}: ${output}`);
  } else if (command === 'close') {
    await request(index, { action: 'close' });
    rmSync(slotFile(index, 'pid'), { force: true });
    console.log(`Closed preview #${index}.`);
  } else {
    throw new Error(`Unknown command: ${command}`);
  }
}

execute().catch((error) => {
  console.error(error.message);
  if (error.message.includes('Preview index must') || error.message.startsWith('Unknown command'))
    usage();
  process.exitCode = 1;
});
