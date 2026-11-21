// End-to-end test of the Hub: a real server (no database), the Hub in dev mode and two headless
// Chromium pages on a phone-sized screen. Alice signs up, Bob logs in, Alice opens a Caro Room,
// Bob joins by its code and gets ready, Alice starts, and they click marks on the board inside the
// Game's iframe until Alice's five in a row ends the Match. Both pages must receive `match:result`
// and show the Results. Needs a built server and Caro (`npx turbo run build
// --filter=@xomdao/server --filter=@xomdao/game-tic-tac-toe`) and Chromium (`npx playwright-core
// install chromium`). Saves screenshots to e2e/.
// Usage: node scripts/e2e.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shots = resolve(root, 'e2e');
const children = [];
const output = [];

/** X (Alice) takes five in a row on y = 4 while O (Bob) answers on y = 3; no cell is on an edge. */
const X_CELLS = [2, 3, 4, 5, 6].map((x) => ({ x, y: 4 }));
const O_CELLS = [2, 3, 4, 5].map((x) => ({ x, y: 3 }));
/** The board starts 9×9 and the canvas leaves 8 px around it (`BoardView.layout`). */
const SIDE = 9;
const PAD = 8;

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

async function main() {
  const serverPort = await freePort();
  const hubPort = await freePort();
  const server = `http://127.0.0.1:${serverPort}`;
  const hub = `http://127.0.0.1:${hubPort}`;

  start(['dist/main.js'], {
    cwd: resolve(root, 'apps/server'),
    env: { ...process.env, PORT: String(serverPort), DATABASE_URL: '' },
  });
  await until('the server', async () =>
    (await (await fetch(`${server}/api/games`)).json()).includes('tic-tac-toe'),
  );
  start([resolve(root, 'node_modules/vite/bin/vite.js')], {
    cwd: resolve(root, 'apps/hub'),
    env: { ...process.env, HUB_PORT: String(hubPort), XOMDAO_DEV_SERVER: server },
  });
  await until('the Hub', async () => (await fetch(hub)).ok);

  const tag = Date.now().toString(36);
  const password = 'e2e12345';
  const alice = { name: 'Alice', username: `alice${tag}`, results: [] };
  const bob = { name: 'Bob', username: `bob${tag}`, results: [] };
  const registered = await fetch(`${server}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: bob.username,
      password,
      name: bob.name,
      avatar: 'boy',
      frame: 'gold',
    }),
  });
  if (!registered.ok) throw new Error((await registered.json()).message);

  const browser = await chromium.launch();
  try {
    const problems = [];
    /** A fresh page on the Hub, as a phone held sideways, that records `match:result` pushes. */
    async function open(who) {
      const context = await browser.newContext({
        viewport: { width: 844, height: 390 },
        hasTouch: true,
        isMobile: true,
      });
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      page.on('pageerror', (error) => problems.push(`${who.name}: ${error.message}`));
      page.on('console', (message) => {
        if (message.type() === 'error') problems.push(`${who.name}: ${message.text()}`);
      });
      page.on('websocket', (socket) =>
        socket.on('framereceived', ({ payload }) => {
          if (String(payload).includes('match:result')) who.results.push(String(payload));
        }),
      );
      await page.goto(hub);
      return page;
    }
    const a = await open(alice);
    const b = await open(bob);

    // Alice signs up through the form, Bob logs into the account he already has.
    await a.getByRole('tab', { name: 'Tạo tài khoản' }).click();
    await a.getByLabel('Tên đăng nhập').fill(alice.username);
    await a.getByLabel('Mật khẩu').fill(password);
    await a.getByLabel('Tên hiển thị').fill(alice.name);
    await a.screenshot({ path: resolve(shots, '1-sign-up.png') });
    await a.getByRole('button', { name: 'Tạo', exact: true }).click();
    await b.getByLabel('Tên đăng nhập').fill(bob.username);
    await b.getByLabel('Mật khẩu').fill(password);
    await b.getByRole('button', { name: 'Vào', exact: true }).click();
    await a.getByRole('button', { name: /^Hồ sơ/ }).waitFor();
    await b.getByRole('button', { name: /^Hồ sơ/ }).waitFor();

    // Alice picks Caro and opens a Room.
    await a.getByRole('radio', { name: /Caro/ }).click();
    await a.getByRole('heading', { name: 'Caro' }).waitFor();
    await a.getByRole('button', { name: 'Tạo phòng' }).click();
    await a.waitForURL(/\/room\/[A-Z0-9]{4}$/);
    const code = new URL(a.url()).pathname.split('/').pop();

    // Bob joins by the code and is ready; Alice starts the Match.
    await b.getByRole('button', { name: 'Vào phòng' }).click();
    await b.getByLabel('Mã phòng').fill(code);
    await b.getByRole('button', { name: 'Vào', exact: true }).click();
    await b.waitForURL(new RegExp(`/room/${code}$`));
    await b.getByRole('button', { name: 'Sẵn sàng' }).click();
    const aliceSlots = a.getByRole('list', { name: 'Người chơi' });
    await aliceSlots.getByText('Bob', { exact: true }).waitFor();
    await aliceSlots.getByText('Sẵn sàng').waitFor();
    await a.screenshot({ path: resolve(shots, '2-room.png') });
    await a.getByRole('button', { name: /^Bắt đầu/ }).click();

    // The board is in an iframe; each player waits for their own turn, then clicks a cell.
    const games = new Map([
      [alice, a.frameLocator('iframe')],
      [bob, b.frameLocator('iframe')],
    ]);
    /** Clicks the middle of board cell (x, y) on the 9×9 board; unless `last`, waits for the turn to pass. */
    async function mark(who, { x, y }, last = false) {
      const game = games.get(who);
      await game.locator('.seat.me.active').waitFor();
      const canvas = game.locator('#board');
      const box = await canvas.boundingBox();
      if (!box) throw new Error('The board is not on screen');
      const cell = Math.min(box.width - PAD * 2, box.height - PAD * 2) / SIDE;
      await canvas.click({
        position: {
          x: (box.width - SIDE * cell) / 2 + (x + 0.5) * cell,
          y: (box.height - SIDE * cell) / 2 + (y + 0.5) * cell,
        },
      });
      if (!last) await game.locator('.seat.me:not(.active)').waitFor();
    }
    for (const [turn, cell] of X_CELLS.entries()) {
      await mark(alice, cell, turn === X_CELLS.length - 1);
      if (turn === 2) await b.screenshot({ path: resolve(shots, '3-playing.png') });
      if (turn < O_CELLS.length) await mark(bob, O_CELLS[turn]);
    }

    // Both get the result and the Results panel, which puts Alice first.
    for (const [who, page] of [
      [alice, a],
      [bob, b],
    ]) {
      await page.getByText('Kết quả', { exact: true }).waitFor({ timeout: 20000 });
      await until(`${who.name}'s match:result`, () => who.results.length > 0, 5);
    }
    const winner = a.getByRole('listitem').filter({ hasText: 'Thắng' });
    await winner.getByText('Alice').waitFor();
    await winner.getByText('Thắng').waitFor();
    await a.screenshot({ path: resolve(shots, '4-results.png') });
    await b.screenshot({ path: resolve(shots, '4-results-bob.png') });

    if (problems.length) throw new Error(`The pages reported errors:\n${problems.join('\n')}`);
    console.log(`OK: Alice beat Bob at Caro in Room ${code}, and both got match:result`);
  } finally {
    await browser.close();
  }
}

mkdirSync(shots, { recursive: true });
let failed = false;
try {
  await main();
} catch (error) {
  failed = true;
  console.error(error instanceof Error ? error.message : error);
  console.error(`--- server and Hub output ---\n${output.join('').slice(-4000)}`);
} finally {
  for (const child of children) child.kill();
}
process.exit(failed ? 1 : 0);
