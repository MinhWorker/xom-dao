// Web smoke test of Game clients: a real server (no database), the Harness and a headless
// Chromium on a phone-sized screen; the browser plays seat 0 against the server's computer.
// Đặt Bom must draw the arena, walk and drop a bomb on the arrow keys and Space. Cờ Tỷ Phú must
// draw the board, roll on its dice and answer the next decision, and show a Tile's details on
// a tap. The server must have applied every move. Needs a built server, Harness and Games, and
// Chromium (`npx playwright-core install chromium`). Saves a screenshot to smoke-web/<game>.png.
// Usage: node scripts/smoke-web.mjs [gameId...] (default: every Game below)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const games = process.argv.length > 2 ? process.argv.slice(2) : ['dat-bom', 'co-ty-phu'];
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
  const server = `http://127.0.0.1:${serverPort}`;
  start(['dist/main.js'], {
    cwd: resolve(root, 'apps/server'),
    env: { ...process.env, PORT: String(serverPort), DATABASE_URL: '' },
  });
  await until('the server', async () => {
    const listed = await (await fetch(`${server}/api/games`)).json();
    return games.every((id) => listed.includes(id));
  });
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
    for (const gameId of games) {
      const scenario = SCENARIOS[gameId];
      if (!scenario) throw new Error(`No smoke scenario for ${gameId}`);
      await run(gameId, scenario, server, browser);
    }
  } finally {
    await browser.close();
  }
}

/** Starts a Harness for `gameId`, opens seat 0's client and plays `scenario` in it. */
async function run(gameId, scenario, server, browser) {
  const harnessPort = await freePort();
  const harness = `http://127.0.0.1:${harnessPort}`;
  const child = start(
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
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
  });
  try {
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

    const said = await scenario({ page, state, command });

    const picture = await page.screenshot();
    mkdirSync(resolve(root, 'smoke-web'), { recursive: true });
    writeFileSync(resolve(root, `smoke-web/${gameId}.png`), picture);
    const { channels } = await sharp(picture).stats();
    const spread = Math.max(...channels.map((c) => c.stdev));
    if (spread < 15) throw new Error(`The screen looks blank (colour spread ${spread.toFixed(1)})`);
    if (problems.length) throw new Error(`The page reported errors:\n${problems.join('\n')}`);
    console.log(`OK: ${gameId} ${said}`);
  } finally {
    await context.close();
    child.kill();
  }
}

const SCENARIOS = {
  'dat-bom': async ({ page, state }) => {
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
    return `drew the arena, walked from x=${start0.x} to ${moved.x.toFixed(2)} and placed a bomb at (${bomb.x}, ${bomb.y})`;
  },
  'co-ty-phu': async ({ page, state }) => {
    const view = async () => (await state()).players[0]?.view;
    await page.locator('#roll:not([hidden])').click({ timeout: 15000 });
    const rolled = await until('the roll', async () => {
      const v = await view();
      return v?.rolls > 0 && v;
    });
    const next =
      '#panel-buttons button:not([disabled]), #roll:not([hidden]), .cardshow:not([hidden]) button.choice:not([disabled])';
    await page.waitForSelector(next, { timeout: 30000 });
    const before = JSON.stringify(await view());
    const answer = page.locator(next).first();
    const label = (await answer.textContent()) || (await answer.getAttribute('aria-label'));
    await answer.click();
    await until('the answer', async () => JSON.stringify(await view()) !== before, 30);
    await page.mouse.click(265, 45);
    await page.waitForSelector('#info:not([hidden])', { timeout: 5000 });
    await sleep(400);
    return `drew the board, rolled ${rolled.dice.join('+')}, then "${label}", and showed Sân bay`;
  },
};

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
