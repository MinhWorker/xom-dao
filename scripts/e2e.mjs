// End-to-end test of the Hub: a real server (no database), the Hub in dev mode and two headless
// Chromium pages on a phone-sized screen. Alice signs up, Bob logs in, Alice opens a Room for a
// Game, Bob joins by its code and gets ready, Alice starts and sees the loading screen wait for
// Bob's Game (held back for the screenshot), and they play the Game inside its
// iframe until the Match ends. Both pages must receive `match:result` and show the Results, and
// holding the eye button must hide the HUD.
// Caro then goes on in the same Room: Alice plays again, Bob reloads mid-Match and carries on from
// where it was, Alice's back button asks before leaving, and Bob leaves mid-Match, so Alice is
// told and wins.
//   caro       Caro (TypeScript canvas): they click marks until Alice's five in a row wins.
//   tien-len   Tiến Lên (Godot, a one-round Match): the player who leads taps the lowest card and
//              Đánh each trick and the other taps Bỏ lượt, so the leader empties their hand first.
//              The taps land on the Godot canvas by the layout in games/tien-len/godot/main.gd
//              (`_hand_slot`, `_layout_buttons`), which `tienLenGeometry` mirrors.
// Needs a built server and the Games (`npx turbo run build --filter=@xomdao/server
// --filter=@xomdao/game-caro --filter=@xomdao/game-tien-len`; Tiến Lên needs `npm run
// setup:godot` first) and Chromium (`npx playwright-core install chromium`). Saves screenshots
// to e2e/.
// Usage: node scripts/e2e.mjs [caro|tien-len]   (no argument: both, one after the other)
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

/** Alice (host, signs up through the form) and Bob (logs in), both in a Room for the Game. */
async function seat(browser, { server, hub }, game) {
  const tag = Date.now().toString(36);
  const password = 'e2e12345';
  const alice = { name: 'Alice', username: `alice${tag}`, results: [], view: null, problems: [] };
  const bob = { name: 'Bob', username: `bob${tag}`, results: [], view: null, problems: [] };
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

  /** A fresh page on the Hub, as a phone held sideways, that records what the server pushes. */
  async function open(who) {
    const context = await browser.newContext({
      viewport: { width: 844, height: 390 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror', (error) => who.problems.push(`${who.name}: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') who.problems.push(`${who.name}: ${message.text()}`);
    });
    page.on('websocket', (socket) =>
      socket.on('framereceived', ({ payload }) => {
        const text = String(payload);
        if (text.includes('match:result')) who.results.push(text);
        if (!text.includes('"match:state"')) return;
        try {
          const push = JSON.parse(text);
          if (push.event === 'match:state' && push.data?.view) who.view = push.data.view;
        } catch {}
      }),
    );
    await page.goto(hub);
    return page;
  }
  const a = await open(alice);
  const b = await open(bob);

  await a.getByRole('tab', { name: 'Tạo tài khoản' }).click();
  await a.getByLabel('Tên đăng nhập').fill(alice.username);
  await a.getByLabel('Mật khẩu').fill(password);
  await a.getByLabel('Tên hiển thị').fill(alice.name);
  await a.screenshot({ path: resolve(shots, `${game.id}-1-sign-up.png`) });
  await a.getByRole('button', { name: 'Tạo', exact: true }).click();
  await b.getByLabel('Tên đăng nhập').fill(bob.username);
  await b.getByLabel('Mật khẩu').fill(password);
  await b.getByRole('button', { name: 'Vào', exact: true }).click();
  await a.getByRole('button', { name: /^Hồ sơ/ }).waitFor();
  await b.getByRole('button', { name: /^Hồ sơ/ }).waitFor();

  await a.getByRole('radio', { name: game.pick }).click();
  await a.getByRole('heading', { name: game.name }).waitFor();
  await a.getByRole('button', { name: 'Tạo phòng' }).click();
  await a.waitForURL(/\/room\/[A-Z0-9]{4}$/);
  const code = new URL(a.url()).pathname.split('/').pop();
  if (game.rounds) await a.getByRole('radio', { name: game.rounds }).click();

  await b.getByRole('button', { name: 'Vào phòng' }).click();
  await b.getByLabel('Mã phòng').fill(code);
  await b.getByRole('button', { name: 'Vào', exact: true }).click();
  await b.waitForURL(new RegExp(`/room/${code}$`));
  await b.getByRole('button', { name: 'Sẵn sàng' }).click();
  const aliceSlots = a.getByRole('list', { name: 'Người chơi' });
  await aliceSlots.getByText('Bob', { exact: true }).waitFor();
  await aliceSlots.getByText('Sẵn sàng').waitFor();
  await a.screenshot({ path: resolve(shots, `${game.id}-2-room.png`) });

  let held = false;
  let release;
  const holding = new Promise((done) => {
    release = done;
  });
  await b.route(`**/games/${game.id}/**`, async (route) => {
    if (!held) {
      held = true;
      await holding;
    }
    await route.continue();
  });
  await a.getByRole('button', { name: /^Bắt đầu/ }).click();
  const loading = a.getByRole('status').filter({ hasText: 'Đang tải ván' });
  await loading.getByText('Xong').waitFor();
  await loading.getByText('Đang tải', { exact: true }).waitFor();
  await a.screenshot({ path: resolve(shots, `${game.id}-2-loading.png`) });
  release();
  await loading.waitFor({ state: 'detached' });
  return { alice, bob, a, b, code };
}

/**
 * Clicks the middle of Caro's board cell (x, y) on the 9×9 board once it is the page's turn;
 * unless `last`, waits for the turn to pass.
 */
async function markCaro(page, { x, y }, last = false) {
  const game = page.frameLocator('iframe');
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

/** Clicks marks in the Game's iframe; each player waits for their own turn. */
async function playCaro({ alice, a, b }) {
  for (const [turn, cell] of X_CELLS.entries()) {
    await markCaro(a, cell, turn === X_CELLS.length - 1);
    if (turn === 2) await b.screenshot({ path: resolve(shots, 'caro-3-playing.png') });
    if (turn < O_CELLS.length) await markCaro(b, O_CELLS[turn]);
  }
  return alice;
}

/**
 * After the first Match: play again in the same Room, come back mid-Match after a reload, ask
 * before leaving on the back button, and leave mid-Match.
 */
async function caroAfterMatch({ a, b, code }) {
  const results = (page) => page.getByText('Kết quả', { exact: true });

  // Playing again keeps the Room: both leave Results for a new Match with Alice as X again.
  await a.getByRole('button', { name: 'Chơi lại' }).click();
  await results(a).waitFor({ state: 'hidden' });
  await results(b).waitFor({ state: 'hidden' });
  for (const page of [a, b]) {
    if (new URL(page.url()).pathname !== `/room/${code}`)
      throw new Error('Playing again left the Room');
  }
  await markCaro(a, { x: 4, y: 4 });

  // Bob reloads mid-Match: he is back in his seat, his Game redraws the board and his turn.
  b.once('dialog', (dialog) => void dialog.accept());
  await b.reload();
  await b.frameLocator('iframe').locator('.seat.me.active').waitFor({ timeout: 30000 });
  await a.getByText('Bob đã kết nối lại').waitFor();
  await b.screenshot({ path: resolve(shots, 'caro-7-rejoined.png') });
  await markCaro(b, { x: 4, y: 3 });

  // The back button asks before leaving; staying keeps the Match.
  // (A test page's first entries can be skipped by back, so it goes back over one of its own.)
  await a.evaluate(() => {
    history.pushState(null, '', location.pathname);
    history.back();
  });
  const ask = a.getByRole('dialog', { name: 'Rời ván?' });
  await ask.waitFor();
  await ask.getByRole('button', { name: 'Ở lại' }).click();
  await ask.waitFor({ state: 'hidden' });
  await markCaro(a, { x: 5, y: 4 });

  // Bob leaves from the menu, after saying yes: Alice is told, the Match stops and she wins.
  await b.getByRole('button', { name: 'Menu ván' }).click();
  await b.getByRole('menuitem', { name: 'Rời ván' }).click();
  const leave = b.getByRole('dialog', { name: 'Rời ván?' });
  await leave.getByRole('button', { name: 'Rời', exact: true }).click();
  await b.waitForURL((url) => url.pathname === '/');
  await a.getByText('Bob đã rời ván').waitFor();
  await results(a).waitFor({ timeout: 15000 });
  await a.getByRole('heading', { name: 'Thắng' }).waitFor();
  await a.getByRole('listitem').filter({ hasText: 'Bob' }).getByText('Đã rời').waitFor();
  if (!(await a.getByRole('button', { name: 'Chơi lại' }).isDisabled())) {
    throw new Error('Alice can play again alone');
  }
  await a.screenshot({ path: resolve(shots, 'caro-8-left.png') });
}

/** Where a tap lands on the Godot canvas of Tiến Lên: its virtual 844×390 screen, stretched. */
function tienLenGeometry(box, handSize) {
  const scale = Math.min(box.width / 844, box.height / 390);
  const width = box.width / scale;
  const height = box.height / scale;
  const hand = Math.min(Math.max((height * 0.185) / 72, 0.7), 1.1);
  const cardWidth = 72 * hand;
  const cardHeight = 101 * hand;
  const span = width - 16 - 132 - 28 - 16;
  const step = Math.min(cardWidth * 0.7, (span - cardWidth) / Math.max(handSize - 1, 1));
  const total = cardWidth + step * (handSize - 1);
  const first = 16 + (span - total) / 2 + cardWidth / 2;
  const at = (x, y) => ({ x: box.x + x * scale, y: box.y + y * scale });
  return {
    /** Empty table: a tap there puts the selection down. */
    blank: at(width / 2, height * 0.3),
    /** The left edge of the lowest card, which no other card covers. */
    lowest: at(first - cardWidth / 2 + 8, height - 14 - cardHeight / 2 + 7),
    play: at(width - 16 - 66, height - 16 - 23),
    pass: at(width - 16 - 66, height - 16 - 46 - 46 * 0.85 - 10 + (46 * 0.85) / 2),
  };
}

/** Plays a one-round Match of two people: the leader leads singles, the other passes. */
async function playTienLen({ alice, bob, a, b }) {
  const pages = new Map([
    [alice, { page: a, seat: 0 }],
    [bob, { page: b, seat: 1 }],
  ]);
  await until(
    'both Godot Games to deal',
    () => alice.view?.hand?.length && bob.view?.hand?.length,
    90,
  );
  const leader = alice.view.lead === 0 ? alice : bob;
  await b.screenshot({ path: resolve(shots, 'tien-len-3-dealt.png') });

  /** One attempt at the move the player owes: clear the selection, then tap the buttons. */
  async function move(who) {
    const { page } = pages.get(who);
    const box = await page.locator('iframe').boundingBox();
    if (!box) throw new Error('The Game is not on screen');
    const tap = tienLenGeometry(box, who.view.hand.length);
    if (who.view.table) {
      await page.touchscreen.tap(tap.pass.x, tap.pass.y);
      return;
    }
    await page.touchscreen.tap(tap.blank.x, tap.blank.y);
    await page.touchscreen.tap(tap.lowest.x, tap.lowest.y);
    await sleep(200);
    await page.touchscreen.tap(tap.play.x, tap.play.y);
  }

  const tried = new Map();
  const deadline = Date.now() + 240_000;
  let shot = false;
  while (!(alice.results.length && bob.results.length)) {
    if (Date.now() > deadline) throw new Error('The Tiến Lên Match did not finish');
    for (const who of [alice, bob]) {
      const view = who.view;
      if (!view || view.phase !== 'play' || view.turn !== pages.get(who).seat) continue;
      const key = `${view.played.length}:${view.turn}:${view.passed.join()}`;
      const before = tried.get(who);
      if (before?.key === key && Date.now() - before.at < 2500) continue;
      tried.set(who, { key, at: Date.now() });
      if (!shot && view.played.length > 4) {
        shot = true;
        await pages.get(who).page.screenshot({ path: resolve(shots, 'tien-len-4-playing.png') });
      }
      await move(who);
    }
    await sleep(250);
  }
  return leader;
}

const GAMES = {
  caro: {
    id: 'caro',
    name: 'Caro',
    pick: /Caro/,
    play: playCaro,
    after: caroAfterMatch,
    summary: 'Alice beat Bob at Caro, played again, came back after a reload and saw Bob leave',
  },
  'tien-len': {
    id: 'tien-len',
    name: 'Tiến Lên',
    pick: /Tiến Lên/,
    rounds: '1 vòng',
    play: playTienLen,
    summary: 'The leader won a one-round Tiến Lên Match',
  },
};

async function main(game, stack, browser) {
  const room = await seat(browser, stack, game);
  const { alice, bob, a, b, code } = room;
  const winnerOf = await game.play(room);

  // Both get the result and the Results panel, which puts the winner first.
  for (const [who, page] of [
    [alice, a],
    [bob, b],
  ]) {
    await page.getByText('Kết quả', { exact: true }).waitFor({ timeout: 30000 });
    await until(`${who.name}'s match:result`, () => who.results.length > 0, 5);
  }
  const winner = a.getByRole('listitem').filter({ hasText: 'Thắng' });
  await winner.getByText(winnerOf.name).waitFor();
  await winner.getByText('Thắng').waitFor();
  await a.screenshot({ path: resolve(shots, `${game.id}-5-results.png`) });
  await b.screenshot({ path: resolve(shots, `${game.id}-5-results-bob.png`) });

  // Holding the eye hides the whole HUD, Results included, so the Game's last state shows.
  const eye = a.getByRole('button', { name: 'Xem ván' });
  const panel = a.getByText('Kết quả', { exact: true });
  const opacity = () => panel.evaluate((el) => getComputedStyle(el.closest('[data-hud]')).opacity);
  await eye.dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 7, isPrimary: true });
  await until('the HUD to hide', async () => (await opacity()) === '0', 5);
  await a.screenshot({ path: resolve(shots, `${game.id}-6-peek.png`) });
  await eye.dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 7, isPrimary: true });
  await until('the HUD to come back', async () => (await opacity()) === '1', 5);

  await game.after?.(room);

  const problems = [...alice.problems, ...bob.problems];
  if (problems.length) throw new Error(`The pages reported errors:\n${problems.join('\n')}`);
  console.log(`OK: ${game.summary} in Room ${code}, and both got match:result`);
}

async function run(names) {
  const serverPort = await freePort();
  const hubPort = await freePort();
  const server = `http://127.0.0.1:${serverPort}`;
  const hub = `http://127.0.0.1:${hubPort}`;

  start(['dist/main.js'], {
    cwd: resolve(root, 'apps/server'),
    env: { ...process.env, PORT: String(serverPort), DATABASE_URL: '' },
  });
  await until('the server', async () => {
    const ids = await (await fetch(`${server}/api/games`)).json();
    return names.every((name) => ids.includes(GAMES[name].id));
  });
  start([resolve(root, 'node_modules/vite/bin/vite.js')], {
    cwd: resolve(root, 'apps/hub'),
    env: { ...process.env, HUB_PORT: String(hubPort), XOMDAO_DEV_SERVER: server },
  });
  await until('the Hub', async () => (await fetch(hub)).ok);

  const browser = await chromium.launch();
  try {
    for (const name of names) await main(GAMES[name], { server, hub }, browser);
  } finally {
    await browser.close();
  }
}

const requested = process.argv[2];
if (requested && !GAMES[requested]) {
  console.error(`Usage: node scripts/e2e.mjs [${Object.keys(GAMES).join('|')}]`);
  process.exit(1);
}
mkdirSync(shots, { recursive: true });
let failed = false;
try {
  await run(requested ? [requested] : Object.keys(GAMES));
} catch (error) {
  failed = true;
  console.error(error instanceof Error ? error.message : error);
  console.error(`--- server and Hub output ---\n${output.join('').slice(-4000)}`);
} finally {
  for (const child of children) child.kill();
}
process.exit(failed ? 1 : 0);
