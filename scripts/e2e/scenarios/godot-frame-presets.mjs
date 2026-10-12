// Check the rendered frame and real mouse input through resizes, including portrait and
// browser-bar sizes. The window may change freely; the game's aspect ratio must stay a preset.
import assert from 'node:assert/strict';
import { launch, onScene, openGodot, tap } from '../godot.mjs';

export { launch };

export default async function run(t) {
  const page = await openGodot(t, await t.page({ width: 640, height: 360 }));
  await onScene(page, 'lobby');
  const cases = [
    [640, 360, 1280],
    [720, 360, 1440],
    [852, 393, 1560],
    [800, 360, 1600],
    [915, 412, 1600],
    [852, 343, 1600], // iPhone in a browser tab, with its bottom bar.
    [1180, 820, 1280],
    [360, 800, 1280], // Rotate to portrait and back without reloading.
    [1366, 768, 1280],
    [800, 360, 1600],
  ];
  for (const [width, height, frameWidth] of cases) {
    await page.setViewportSize({ width, height });
    const scale = Math.min(width / frameWidth, height / 720);
    const expected = {
      x: (width - frameWidth * scale) / 2,
      y: (height - 720 * scale) / 2,
      width: frameWidth * scale,
      height: 720 * scale,
    };
    await page.waitForFunction((expected) => {
      const rect = window.xomdao.rect('Screen');
      return (
        rect && Object.entries(expected).every(([key, value]) => Math.abs(rect[key] - value) <= 1)
      );
    }, expected);
    for (const name of ['Play', 'Settings', 'Profile']) {
      const rect = await page.evaluate((name) => window.xomdao.rect(name), name);
      assert.ok(rect, `${name} exists at ${width}x${height}`);
      assert.ok(rect.x >= expected.x - 1 && rect.y >= expected.y - 1, `${name} inside frame`);
      assert.ok(rect.x + rect.width <= expected.x + expected.width + 1, `${name} fits width`);
      assert.ok(rect.y + rect.height <= expected.y + expected.height + 1, `${name} fits height`);
    }
    await page.screenshot({ path: t.shot(`lobby-${width}x${height}.png`) });
    // Exercise pointer coordinates after each resize, then return to the same lobby.
    await tap(page, 'Profile');
    await onScene(page, 'nha');
    await tap(page, 'Back');
    await onScene(page, 'lobby');
  }
}
