// Accounts in the Godot client: nobody plays without one, so a new browser opens on the login
// board, which cannot be closed. A wrong password shows the server's message; Tạo tài khoản makes
// an account and the lobby opens as it; Đăng xuất at Nhà › Tài khoản brings the board back, and
// Đăng nhập lets the account in again. A player the old web app logged in (its token in
// localStorage) opens the client as the same account. Needs the debug web build
// (npm run godot:export -- --debug).

import { DESKTOP, godotText, launch, onScene, openGodot, tap, typeInto } from '../godot.mjs';

export const games = [];
export { launch };

const user = (page) => page.evaluate(() => window.xomdao.state().user);

export default async function run(t) {
  const username = `e2e${Date.now().toString(36)}`;
  const page = await openGodot(t, await t.page(DESKTOP), '', { account: false });
  await godotText(page, 'AccountSubmit', 'Vào chơi');
  if ((await page.evaluate(() => window.xomdao.scene())) !== 'status')
    throw new Error('Someone without an account got past the login board');
  await page.screenshot({ path: t.shot('1-form.png') });
  // The board cannot be closed: a tap beside it leaves it there.
  await page.mouse.click(8, 8);
  await page.waitForTimeout(300);
  if (!(await page.evaluate(() => window.xomdao.rect('AccountSubmit'))))
    throw new Error('The login board closed');
  // A wrong password first: the server's message shows on the board.
  await typeInto(page, 'Username', 'khong-co-ai');
  await typeInto(page, 'Password', 'sai-mat-khau');
  await tap(page, 'AccountSubmit');
  await godotText(page, 'AccountError', /./);
  await page.screenshot({ path: t.shot('1-error.png') });

  // Tạo tài khoản: the second option of the mode switch.
  const mode = await page.evaluate(() => window.xomdao.rect('AccountMode'));
  await page.mouse.click(mode.x + mode.width * 0.75, mode.y + mode.height / 2);
  await godotText(page, 'AccountSubmit', 'Tạo tài khoản');
  await typeInto(page, 'Username', username);
  await typeInto(page, 'Password', 'mat-khau-e2e');
  await typeInto(page, 'DisplayName', 'Lan E2E');
  await page.screenshot({ path: t.shot('2-register.png') });
  await tap(page, 'AccountSubmit');
  await page.waitForFunction((u) => window.xomdao.state().user?.username === u, username, {
    timeout: 30_000,
  });
  await onScene(page, 'lobby');

  // Đăng xuất: back to the login board.
  await tap(page, 'Profile');
  await onScene(page, 'nha');
  await tap(page, 'AccountButton');
  await godotText(page, 'AccountUsername', new RegExp(username));
  await page.screenshot({ path: t.shot('3-signed-in.png') });
  await tap(page, 'SignOut');
  await page.waitForFunction(
    () => window.xomdao.scene() === 'status' && window.xomdao.rect('AccountSubmit'),
    null,
    { timeout: 30_000 },
  );

  // Đăng nhập with the new account.
  await typeInto(page, 'Username', username);
  await typeInto(page, 'Password', 'mat-khau-e2e');
  await tap(page, 'AccountSubmit');
  await page.waitForFunction((u) => window.xomdao.state().user?.username === u, username, {
    timeout: 30_000,
  });
  await onScene(page, 'lobby');

  // The old web app's token (localStorage) logs a fresh browser in as the same account.
  const fresh = await t.page(DESKTOP);
  await fresh.goto(new URL('/api/health', t.url).href);
  const token = await fresh.evaluate(async (name) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: name, password: 'mat-khau-e2e' }),
    });
    return (await res.json()).token;
  }, username);
  await fresh.evaluate((tk) => localStorage.setItem('xomdao:token', tk), token);
  await openGodot(t, fresh, '', { account: false });
  await onScene(fresh, 'lobby');
  if ((await user(fresh)).username !== username) throw new Error('The old token was not used');
  await fresh.screenshot({ path: t.shot('4-legacy.png') });
}
