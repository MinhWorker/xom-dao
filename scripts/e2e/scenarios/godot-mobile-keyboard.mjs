// Mobile touch input and viewport stability: tapping account fields opens Godot's virtual
// keyboard input without zooming, mobile keyboard `input` events log in / register an account,
// and shrinking the viewport for virtual keyboard or mobile status/control bars leaves the game
// screen stable in size and place while real device rotation still adapts.
import assert from 'node:assert/strict';
import { godotText, launch, onScene, openGodot } from '../godot.mjs';

export const games = [];
export { launch };

export default async function run(t) {
  const page = await t.page(
    { width: 800, height: 360 },
    { deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  );
  // Real mobile browsers expose `'ontouchstart' in window`, which GodotDisplayVK checks.
  await page.addInitScript(() => {
    if (!('ontouchstart' in window)) {
      window.ontouchstart = null;
    }
  });

  await openGodot(t, page, '', { account: false });
  await godotText(page, 'AccountSubmit', 'Vào chơi');

  const mode = await page.evaluate(() => window.xomdao.rect('AccountMode'));
  await page.touchscreen.tap(mode.x + mode.width * 0.75, mode.y + mode.height / 2);
  await godotText(page, 'AccountSubmit', 'Tạo tài khoản');
  await page.waitForTimeout(400);

  const before = await page.evaluate(() => {
    const canvas = document.getElementById('canvas');
    const box = canvas.getBoundingClientRect();
    return {
      canvas: { w: canvas.width, h: canvas.height, rw: box.width, rh: box.height },
      screen: window.xomdao.rect('Screen'),
      submit: window.xomdao.rect('AccountSubmit'),
    };
  });

  const tapField = async (name, expectedType) => {
    const rect = await page.evaluate((n) => window.xomdao.rect(n), name);
    await page.touchscreen.tap(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await page.waitForFunction(
      (type) => {
        const el = document.activeElement;
        return (
          el &&
          el.tagName === 'INPUT' &&
          el.type === type &&
          getComputedStyle(el).display === 'block'
        );
      },
      expectedType,
      { timeout: 10_000 },
    );
  };

  const typeMobile = async (name, value, expectedType) => {
    await tapField(name, expectedType);
    await page.evaluate((val) => {
      const el = document.activeElement;
      el.value = val;
      el.selectionStart = val.length;
      el.selectionEnd = val.length;
      el.dispatchEvent(
        new InputEvent('input', { bubbles: true, data: val, inputType: 'insertText' }),
      );
    }, value);
    await godotText(page, name, value);
  };

  // Opening the virtual keyboard focuses a non-zooming top-anchored input and keeps layout stable
  // even if the mobile browser shrinks the viewport for keyboard + status/navigation bars.
  await tapField('Username', 'text');
  const vkStyle = await page.evaluate(() => {
    const el = document.activeElement;
    return {
      fontSize: getComputedStyle(el).fontSize,
      height: el.getBoundingClientRect().height,
    };
  });
  assert.equal(vkStyle.fontSize, '16px');
  assert.ok(vkStyle.height <= 44, `VK input height ${vkStyle.height} should stay <= 44`);

  await page.setViewportSize({ width: 752, height: 150 });
  await page.waitForTimeout(300);
  const duringKeyboard = await page.evaluate(() => {
    const canvas = document.getElementById('canvas');
    const box = canvas.getBoundingClientRect();
    return {
      canvas: { w: canvas.width, h: canvas.height, rw: box.width, rh: box.height },
      screen: window.xomdao.rect('Screen'),
      submit: window.xomdao.rect('AccountSubmit'),
    };
  });
  assert.deepEqual(duringKeyboard, before);
  await page.screenshot({ path: t.shot('1-keyboard-overlay.png') });

  await page.setViewportSize({ width: 800, height: 360 });
  await page.waitForTimeout(200);

  const username = t.username('mob').slice(0, 20);
  await typeMobile('Username', username, 'text');
  await typeMobile('Password', 'mat-khau-mob', 'password');
  await typeMobile('DisplayName', 'Mobile User', 'text');

  const submit = await page.evaluate(() => window.xomdao.rect('AccountSubmit'));
  await page.touchscreen.tap(submit.x + submit.width / 2, submit.y + submit.height / 2);
  await page.waitForFunction((u) => window.xomdao.state().user?.username === u, username, {
    timeout: 30_000,
  });
  await onScene(page, 'lobby');
  await page.screenshot({ path: t.shot('2-lobby.png') });

  // Transient mobile status bar / control bar resize must not shrink or move the UI.
  const playBefore = await page.evaluate(() => window.xomdao.rect('Play'));
  await page.setViewportSize({ width: 752, height: 312 });
  await page.waitForTimeout(300);
  const playDuring = await page.evaluate(() => window.xomdao.rect('Play'));
  assert.deepEqual(playDuring, playBefore);

  // Real orientation change (landscape -> portrait) still updates the frame.
  await page.setViewportSize({ width: 360, height: 800 });
  await page.waitForFunction(
    () => {
      const rect = window.xomdao.rect('Screen');
      return rect && Math.abs(rect.width - 360) <= 1;
    },
    null,
    { timeout: 10_000 },
  );
  await page.screenshot({ path: t.shot('3-portrait.png') });
}
