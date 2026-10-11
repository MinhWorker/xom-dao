// Native touchscreen gestures through Chromium, paged modal isolation, and creating a room.
import { godotText, launch, onScene, openGodot, PHONE, tap } from '../godot.mjs';

export const always = true;
export { launch };

async function swipe(page, cdp, box, dx, cancel = false, anchor = 0.5) {
  const start = { x: box.x + box.width * anchor, y: box.y + box.height * 0.4 };
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ ...start, id: 1 }],
  });
  for (let i = 1; i <= 6; i++) {
    await page.waitForTimeout(35);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: start.x + (dx * i) / 6, y: start.y, id: 1 }],
    });
  }
  await cdp.send('Input.dispatchTouchEvent', {
    type: cancel ? 'touchCancel' : 'touchEnd',
    touchPoints: [],
  });
  await page.waitForTimeout(450);
}

export default async function run(t) {
  const page = await t.page(PHONE);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', {
    insets: { left: 59, right: 59, bottom: 21 },
  });
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await openGodot(t, page);
  await onScene(page, 'lobby');
  await tap(page, 'SelectedGame');
  await onScene(page, 'select');
  const bounds = await page.evaluate(() => ({
    back: window.xomdao.rect('Back'),
    settings: window.xomdao.rect('Settings'),
    create: window.xomdao.rect('SelectCreate'),
  }));
  if (bounds.back.x < 59 || bounds.settings.x + bounds.settings.width > PHONE.width - 59)
    throw new Error('Top controls overlap the phone notch');
  if (bounds.create.y + bounds.create.height > PHONE.height - 21)
    throw new Error('Create room overlaps the home bar');
  const stage = await page.evaluate(() => window.xomdao.rect('Cards'));
  const first = await godotText(page, 'FocusName');
  await page.screenshot({ path: t.shot('1-phone-select.png') });
  await swipe(page, cdp, stage, -stage.width * 0.29);
  const second = await godotText(page, 'FocusName');
  if (second === first) throw new Error('Native touch swipe did not change focus');
  await swipe(page, cdp, stage, -4);
  if ((await godotText(page, 'FocusName')) !== second) throw new Error('Short touch changed focus');
  await swipe(page, cdp, stage, -stage.width * 0.29, true);
  if ((await godotText(page, 'FocusName')) !== second)
    throw new Error('Canceled touch changed focus');
  await page.screenshot({ path: t.shot('2-phone-swiped.png') });

  await tap(page, 'GameRules');
  await godotText(page, 'RulesPage', /^1 \/ \d+$/);
  await page.screenshot({ path: t.shot('3-phone-rules.png') });
  // A pending second action also cannot stack a room setup behind the rules.
  await page.evaluate(() => window.xomdao.click('SelectCreate'));
  await page.waitForTimeout(100);
  if (await page.evaluate(() => window.xomdao.rect('ConfirmCreate')))
    throw new Error('Room setup stacked with rules');
  // Underlying stage receives no gesture while the rules modal is open.
  const rules = await page.evaluate(() => window.xomdao.rect('RulesPanel'));
  const count = Number((await godotText(page, 'RulesPage')).split('/')[1]);
  await swipe(page, cdp, rules, -rules.width * 0.25);
  await godotText(page, 'RulesPage', `${Math.min(2, count)} / ${count}`);
  if ((await godotText(page, 'FocusName')) !== second)
    throw new Error('Modal leaked a drag to carousel');
  for (let i = 0; i < count + 2; i++) {
    const enabled = await page.evaluate(() => window.xomdao.click('RulesNext'));
    await page.waitForTimeout(80);
    if (!enabled) break;
  }
  await godotText(page, 'RulesPage', `${count} / ${count}`);
  if (await page.evaluate(() => window.xomdao.click('RulesNext')))
    throw new Error('Last page did not disable Next');
  await tap(page, 'CloseRules');
  await page.waitForFunction(() => !window.xomdao.rect('RulesPanel'));
  await swipe(page, cdp, stage, stage.width * 0.29);
  await godotText(page, 'FocusName', first);

  // The largest HUD must still let a phone drag the top tabs to both ends.
  await tap(page, 'Settings');
  const large = await page.evaluate(() => {
    const find = (node) =>
      (node.type === 'Button' && node.text === 'To' ? node.name : null) ??
      (node.children ?? []).map(find).find(Boolean);
    return find(window.xomdao.tree(12));
  });
  if (!large) throw new Error('Largest HUD option was not visible');
  await tap(page, large);
  await page.mouse.click(5, 180);
  await page.waitForTimeout(350);
  const tabs = await page.evaluate(() => window.xomdao.rect('GenreTabs'));
  await swipe(page, cdp, tabs, -tabs.width * 0.65, false, 0.8);
  await godotText(page, 'FocusName', first);
  await tap(page, 'Tab_hanh-dong');
  await godotText(page, 'FocusName', 'Bom Nguyên Tố');
  await swipe(page, cdp, tabs, tabs.width * 0.65, false, 0.2);
  await tap(page, 'Tab_co');
  await godotText(page, 'FocusName', first);
  await page.waitForTimeout(450);
  await page.screenshot({ path: t.shot('4-phone-large-hud.png') });
  await tap(page, 'SelectCreate');
  await godotText(page, 'ConfirmCreate', 'Tạo');
  await tap(page, 'ConfirmCreate');
  await onScene(page, 'room');
  await page.screenshot({ path: t.shot('5-phone-room.png') });
}
