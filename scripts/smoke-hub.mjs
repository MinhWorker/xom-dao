// Web smoke test of the Hub's social side: a real server (no database), the Hub in dev mode and two
// headless Chromium pages on a phone-sized screen. Alice asks Bob to be friends, Bob accepts,
// Alice opens a Room and invites Bob from its empty seat, and Bob takes the invite into the Room;
// he leaves, comes back through the door beside Alice in Hàng xóm, gets up to watch and sits again.
// Needs a built server and at least one built Game, and Chromium (`npx playwright-core install
// chromium`). Saves screenshots to smoke-hub/.
// Usage: node scripts/smoke-hub.mjs
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shots = resolve(root, 'smoke-hub');
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
  await until('the server', async () => (await (await fetch(`${server}/api/games`)).json()).length);
  start([resolve(root, 'node_modules/vite/bin/vite.js')], {
    cwd: resolve(root, 'apps/hub'),
    env: { ...process.env, HUB_PORT: String(hubPort), XOMDAO_DEV_SERVER: server },
  });
  await until('the Hub', async () => (await fetch(hub)).ok);

  const tag = Date.now().toString(36);
  /** Registers a throwaway account and returns its login token. */
  async function signUp(name) {
    const res = await fetch(`${server}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: `${name.toLowerCase()}${tag}`,
        password: 'smoke123',
        name,
        avatar: 'boy',
        frame: 'gold',
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    return { token: data.token, username: data.user.username };
  }
  const alice = await signUp('Alice');
  const bob = await signUp('Bob');

  const browser = await chromium.launch();
  try {
    const problems = [];
    /** A signed-in page, as a phone held sideways. */
    async function open(who) {
      const context = await browser.newContext({
        viewport: { width: 844, height: 390 },
        hasTouch: true,
        isMobile: true,
      });
      await context.addInitScript(
        (token) => localStorage.setItem('xomdao:token', token),
        who.token,
      );
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      page.on('pageerror', (error) => problems.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') problems.push(message.text());
      });
      await page.goto(hub);
      await page.getByRole('button', { name: /^Nhà/ }).waitFor();
      return page;
    }
    const a = await open(alice);
    const b = await open(bob);

    // Alice asks Bob by username.
    await a.getByRole('button', { name: /^Hàng xóm/ }).click();
    const aliceSheet = a.getByRole('dialog', { name: 'Hàng xóm' });
    await aliceSheet.getByRole('tab', { name: 'Thêm bạn' }).click();
    await aliceSheet.getByLabel('Tên đăng nhập').fill(bob.username);
    await aliceSheet.locator('form').getByRole('button', { name: 'Kết bạn' }).click();

    // Bob sees the request on the Hàng xóm panel and accepts it.
    await b.getByRole('button', { name: 'Hàng xóm, 1 lời mời' }).click();
    const bobSheet = b.getByRole('dialog', { name: 'Hàng xóm' });
    await bobSheet.getByRole('button', { name: 'Nhận' }).click();
    await bobSheet.getByText('Alice', { exact: true }).waitFor();
    await bobSheet.getByText('Trực tuyến').waitFor();
    await b.screenshot({ path: resolve(shots, 'friends.png') });
    await b.keyboard.press('Escape');

    // Alice sees Bob as a friend, makes a Room and asks him from the empty seat.
    await aliceSheet.getByRole('tab', { name: 'Danh sách' }).click();
    await aliceSheet.getByText('Bob', { exact: true }).waitFor();
    await a.keyboard.press('Escape');
    await a.getByRole('button', { name: 'Ra khơi' }).click();
    await a.waitForURL(/\/sea$/);
    await a.getByRole('heading', { name: 'Caro' }).waitFor();
    await a.getByRole('button', { name: 'Ra khơi' }).click();
    await a.waitForURL(/\/room\/[A-Z0-9]{4}$/);
    const code = new URL(a.url()).pathname.split('/').pop();
    await a.getByRole('button', { name: '+ Mời' }).first().click();
    const invite = a.getByRole('dialog', { name: 'Mời bạn' });
    await invite.getByRole('button', { name: 'Mời Bob' }).click();
    await invite.getByText('Đã mời').waitFor();
    await a.screenshot({ path: resolve(shots, 'invite-sheet.png') });
    await a.keyboard.press('Escape');

    // Bob gets the invite over whatever he is looking at and goes into the Room.
    const notice = b.getByRole('dialog', { name: 'Alice mời bạn' });
    await notice.getByText(code).waitFor();
    await b.screenshot({ path: resolve(shots, 'invite-notice.png') });
    await notice.getByRole('button', { name: 'Vào phòng' }).click();
    await b.waitForURL(new RegExp(`/room/${code}$`));
    await a.getByRole('list', { name: 'Người chơi' }).getByText('Bob', { exact: true }).waitFor();
    await a.screenshot({ path: resolve(shots, 'room-with-friend.png') });

    // Bob leaves, then walks back in through the door beside Alice in Hàng xóm; he gets up to
    // watch and sits down again.
    await b.getByRole('button', { name: 'Rời phòng' }).click();
    await b.getByRole('button', { name: /^Hàng xóm/ }).click();
    const bobList = b.getByRole('dialog', { name: 'Hàng xóm' });
    await bobList.getByText('Đang mở phòng Caro').waitFor();
    await sleep(600); // the sheet sliding in
    await b.screenshot({ path: resolve(shots, 'friend-room.png') });
    await bobList.getByRole('button', { name: 'Vào phòng của Alice' }).click();
    await b.waitForURL(new RegExp(`/room/${code}$`));
    await b.getByRole('button', { name: 'Đứng xem' }).click();
    await a.getByText('Khách xem · 1').waitFor();
    await b.getByRole('button', { name: 'Ngồi đây' }).click();
    await a.getByText('Khách xem · 0').waitFor();

    // Bob's profile is reachable from the Bến.
    await b.getByRole('button', { name: 'Rời phòng' }).click();
    await b.getByRole('button', { name: /^Nhà/ }).click();
    await b.getByText('Cấp độ').waitFor();
    await b.getByText('Chưa có ván nào.').waitFor();
    await sleep(600); // the View Transition into the screen
    await b.screenshot({ path: resolve(shots, 'profile.png') });

    if (problems.length) throw new Error(`The pages reported errors:\n${problems.join('\n')}`);
    console.log(
      `OK: Alice and Bob became friends, Alice invited Bob to Room ${code}, he joined, came back through Hàng xóm and changed seats`,
    );
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
