// Web smoke test of one Realtime Game's client: a real server (no database), the Harness and a
// headless Chromium on a phone-sized screen. The browser plays seat 0 of Đặt Bom against the
// server's computer: it must draw the arena, walk and drop a bomb on the arrow keys and Space,
// and the server must have applied both. Needs a built server, Harness and Game, and Chromium
// (`npx playwright-core install chromium`). Saves a screenshot to smoke-web/<game>.png.
// Usage: node scripts/smoke-web.mjs [gameId]
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const gameId = process.argv[2] ?? 'dat-bom';
const children = [];
const output = [];

const freePort = () =>
  new Promise((done, fail) => {
    const probe = createServer();
    probe.once('error', fail);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => done(port));
    });
  });

function start(args, options) {
  const child = spawn(process.execPath, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', (chunk) => output.push(String(chunk)));
  }
  children.push(child);
  return child;
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/** Polls `read` until it returns something truthy; throws `what` after `seconds`. */
async function until(what, read, seconds = 15) {
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

async function main() {
  const serverPort = await freePort();
  const harnessPort = await freePort();
  const server = `http://127.0.0.1:${serverPort}`;
  const harness = `http://127.0.0.1:${harnessPort}`;

  start(['dist/main.js'], {
    cwd: resolve(root, 'apps/server'),
    env: { ...process.env, PORT: String(serverPort), DATABASE_URL: '' },
  });
  await until('the server', async () =>
    (await (await fetch(`${server}/api/games`)).json()).includes(gameId),
  );
  start(
    [
      resolve(root, 'tools/harness/dist/cli.js'),
      'serve',
      '--game',
      gameId,
      '--server',
      server,
      '--port',
      String(harnessPort),
    ],
    { cwd: root },
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
  await until('the Harness', state);

  const browser = await chromium.launch({
    // Software GL: a CI machine has no GPU.
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
    await page.goto(`${harness}/game/?harness=${bridge}`);
    await page.waitForSelector('#roster li');
    await command('bot');
    await command('start');
    await until('the Match to play', async () => (await state()).match?.status === 'playing');

    // The countdown takes 3 s; then the first move.
    const me = async () => (await state()).players[0]?.view?.players?.[0];
    const start0 = await until('the first snapshot', me);
    await page.waitForFunction(
      () => document.getElementById('clock')?.textContent !== '3:00',
      null,
      {
        timeout: 15000,
      },
    );
    await page.keyboard.down('ArrowRight');
    const moved = await until('the player to walk', async () => {
      const now = await me();
      return now && now.x > start0.x + 1 && now;
    });
    await page.keyboard.up('ArrowRight');
    await page.keyboard.press('Space');
    const bomb = await until('the bomb', async () => {
      const bombs = (await state()).players[0]?.view?.bombs ?? [];
      return bombs.find((b) => b.owner === 0);
    });
    await sleep(400);

    const picture = await page.screenshot();
    mkdirSync(resolve(root, 'smoke-web'), { recursive: true });
    writeFileSync(resolve(root, `smoke-web/${gameId}.png`), picture);
    const { channels } = await sharp(picture).stats();
    const spread = Math.max(...channels.map((c) => c.stdev));
    if (spread < 15) throw new Error(`The screen looks blank (colour spread ${spread.toFixed(1)})`);
    if (problems.length) throw new Error(`The page reported errors:\n${problems.join('\n')}`);

    console.log(
      `OK: ${gameId} drew the arena, walked from x=${start0.x} to ${moved.x.toFixed(2)} and placed a bomb at (${bomb.x}, ${bomb.y})`,
    );
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
  console.error(`--- server and Harness output ---\n${output.join('').slice(-4000)}`);
} finally {
  for (const child of children) child.kill();
}
process.exit(failed ? 1 : 0);
