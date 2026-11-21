// Verifies the Bridge addon with the sample scene (a Godot client of Caro) against a real server
// (no database) and the Harness, which plays the Hub:
//   native: headless Godot, started before the Room exists, finds the Harness over a WebSocket,
//           answers `init`, marks a cell, takes `init` again, `settings`, `visibility`, and reports
//           `done` when the Match is over.
//   --web:  exports the sample (nothreads), opens it in headless Chromium with `?harness=` and taps
//           the board: the tap must reach the server as a mark. Saves smoke-godot/sample.png.
// Needs Godot (npm run setup:godot) and a built server, Harness and Caro (npm run build). `--web` also
// needs Chromium (`npx playwright-core install chromium`).
//   node tools/godot/verify.mjs [--web]
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createServer as createSocketServer } from 'node:net';
import { extname, join, resolve } from 'node:path';
import { godotBin, root } from './lib.mjs';

const GAME = 'tic-tac-toe';
const sample = join(import.meta.dirname, 'sample');
const withWeb = process.argv.includes('--web');
const children = [];
const output = [];

const freePort = () =>
  new Promise((done, fail) => {
    const probe = createSocketServer();
    probe.once('error', fail);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => done(port));
    });
  });

function start(command, args, options, label) {
  const child = spawn(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', (chunk) => output.push(`[${label}] ${chunk}`));
  }
  children.push(child);
  return child;
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/** Polls `read` until it returns something truthy; throws `what` after `seconds`. */
async function until(what, read, seconds = 30) {
  const deadline = Date.now() + seconds * 1000;
  for (;;) {
    try {
      const value = await read();
      if (value) return value;
    } catch {}
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}`);
    await sleep(100);
  }
}

const count = (text, needle) => text.split(needle).length - 1;
const marks = (view) => (view?.board?.cells ?? []).filter(Boolean).length;

async function main() {
  const bin = godotBin();
  if (!bin) throw new Error('Godot is not installed: run npm run setup:godot');
  const serverPort = await freePort();
  const harnessPort = await freePort();
  const server = `http://127.0.0.1:${serverPort}`;
  const harness = `http://127.0.0.1:${harnessPort}`;

  start(
    process.execPath,
    ['dist/main.js'],
    {
      cwd: resolve(root, 'apps/server'),
      env: { ...process.env, PORT: String(serverPort), DATABASE_URL: '' },
    },
    'server',
  );
  await until('the server', async () =>
    (await (await fetch(`${server}/api/games`)).json()).includes(GAME),
  );
  start(
    process.execPath,
    [
      resolve(root, 'tools/harness/dist/cli.js'),
      'serve',
      '--game',
      GAME,
      '--server',
      server,
      '--port',
      String(harnessPort),
    ],
    { cwd: root },
    'harness',
  );
  const state = async () => (await fetch(`${harness}/api/state`)).json();
  const command = async (name, body = {}) => {
    const res = await fetch(`${harness}/api/${name}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${name}: ${(await res.json()).error}`);
    return res.json();
  };
  const logged = async (type) =>
    (await (await fetch(`${harness}/api/log?source=bridge&player=0&limit=1000`)).json()).filter(
      (entry) => entry.type === type,
    );
  await until('the Harness', state);

  await verifyNative({ bin, harnessPort, state, command, logged });
  if (withWeb) await verifyWeb({ harnessPort, state, command });
}

/** Headless Godot, started before the Room exists. */
async function verifyNative({ bin, harnessPort, state, command, logged }) {
  let godotOutput = '';
  const godot = start(
    bin,
    [
      '--headless',
      '--path',
      sample,
      '--',
      `--harness=ws://127.0.0.1:${harnessPort}/bridge?player=0`,
      '--autoplay',
    ],
    { cwd: root },
    'godot',
  );
  godot.stdout.on('data', (chunk) => {
    godotOutput += chunk;
  });

  await sleep(1500);
  await command('create');
  await until('Godot to load', async () => (await state()).players[0]?.loaded);
  const [ready] = await logged('ready');
  if (ready?.data?.version !== 1) throw new Error(`Godot's ready was ${JSON.stringify(ready)}`);
  await until('the first init', async () => count(godotOutput, 'SAMPLE init') >= 1);

  await command('join', { headless: true });
  await command('start');
  // `--autoplay` marks the middle row from its center; the headless player marks row 1 in gaps.
  const turn = async () => {
    const { players } = await state();
    return players[0].view?.turn === players[1].id;
  };
  for (const x of [1, 3, 5, 7]) {
    await until("the headless player's turn", turn);
    await command('move', { player: 1, event: 'place', payload: { x, y: 1 } });
    if (x === 3) {
      // A replay in the middle of the Match: Godot rebuilds its screen from the snapshot.
      const before = count(godotOutput, 'SAMPLE init match=true');
      await command('init', { player: 0 });
      await until(
        'the init with the Match',
        async () => count(godotOutput, 'SAMPLE init match=true') > before,
      );
    }
  }
  await until('the Match to end', async () => (await state()).match?.status === 'over');
  const { match, result, players } = await state();
  const placed = count(godotOutput, 'SAMPLE autoplay place');
  if (placed !== 5 || result?.seats?.find((seat) => seat.player === players[0].id)?.place !== 1) {
    throw new Error(
      `Expected 5 marks and a win for Godot, got ${placed} marks and ${JSON.stringify(result)}`,
    );
  }
  console.log('native: Godot played five marks, the server applied them and Godot won');
  await until('done', async () => (await state()).players[0]?.doneFor === match.matchId, 15);
  console.log('native: Godot reported done after the end-of-match animation');

  await command('settings', { player: 0, muted: true });
  await until('settings', async () => godotOutput.includes('SAMPLE settings muted=true'));
  await command('visibility', { player: 0, hidden: true });
  await until('visibility', async () => godotOutput.includes('SAMPLE visibility hidden=true'));
  console.log('native: a replayed init mid-Match, settings and visibility reached Godot');

  godot.kill();
  await command('reset');
}

/** The web export in headless Chromium, tapped like a phone. */
async function verifyWeb({ harnessPort, state, command }) {
  const { chromium } = await import('playwright-core');
  const { default: sharp } = await import('sharp');
  const dist = join(sample, 'dist');
  const exported = await new Promise((done) => {
    const child = start(
      process.execPath,
      [join(import.meta.dirname, 'export.mjs'), sample, '--out', dist],
      { cwd: root },
      'export',
    );
    child.on('exit', done);
  });
  if (exported !== 0) throw new Error('The web export failed');

  const types = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.wasm': 'application/wasm',
    '.png': 'image/png',
  };
  const { readFile } = await import('node:fs/promises');
  const files = createServer(async (req, res) => {
    const path = new URL(req.url ?? '/', 'http://x').pathname;
    try {
      const body = await readFile(join(dist, path === '/' ? 'index.html' : path));
      res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((done) => files.listen(0, '127.0.0.1', done));
  children.push({ kill: () => files.close() });
  const page_url = `http://127.0.0.1:${files.address().port}/index.html`;

  const browser = await chromium.launch({
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
    ],
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 844, height: 390 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    const problems = [];
    page.on('pageerror', (error) => problems.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(message.text());
    });

    await command('create');
    const bridge = encodeURIComponent(`ws://127.0.0.1:${harnessPort}/bridge?player=0`);
    await page.goto(`${page_url}?harness=${bridge}`);
    await until('the web Game to load', async () => (await state()).players[0]?.loaded, 60);
    await command('bot');
    await command('start');
    await until('the Match to play', async () => (await state()).match?.status === 'playing');
    await sleep(500);
    await page.touchscreen.tap(422, 195);
    await until(
      'the tap to reach the server',
      async () => marks((await state()).players[0]?.view) >= 1,
    );
    await sleep(500);

    const picture = await page.screenshot();
    mkdirSync(resolve(root, 'smoke-godot'), { recursive: true });
    writeFileSync(resolve(root, 'smoke-godot/sample.png'), picture);
    const { channels } = await sharp(picture).stats();
    if (Math.max(...channels.map((c) => c.stdev)) < 5) throw new Error('The screen looks blank');
    if (problems.length) throw new Error(`The page reported errors:\n${problems.join('\n')}`);
    console.log('web: the exported scene loaded, answered init and a tap became a mark');
  } finally {
    await browser.close();
  }
}

let failed = false;
try {
  await main();
} catch (error) {
  failed = true;
  console.error(error instanceof Error ? error.message : error);
  console.error(`--- output ---\n${output.join('').slice(-5000)}`);
} finally {
  for (const child of children) child.kill();
}
process.exit(failed ? 1 : 0);
