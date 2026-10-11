// Native touchscreen gestures through Chromium on the game select's rail of posters, the genre
// row, a tap into a room and the paged rules there.
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

const left = (page, name) => page.evaluate((n) => window.xomdao.rect(n)?.x ?? null, name);

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
    genre: window.xomdao.rect('Tab_co'),
    stage: window.xomdao.rect('Cards'),
  }));
  if (bounds.back.x < 59 || bounds.settings.x + bounds.settings.width > PHONE.width - 59)
    throw new Error('Top controls overlap the phone notch');
  if (bounds.genre.x < 59 || bounds.genre.y + bounds.genre.height > PHONE.height - 21)
    throw new Error('The genre row overlaps the notch or the home bar');
  if (bounds.genre.y < bounds.stage.y + bounds.stage.height - 1)
    throw new Error('The genre row covers the posters');
  const stage = bounds.stage;
  await page.screenshot({ path: t.shot('1-phone-select.png') });

  // A swipe slides the rail and enters no room; a short touch that moves a little neither.
  const start = await left(page, 'Card_battleship');
  await swipe(page, cdp, stage, -stage.width * 0.4);
  const slid = await left(page, 'Card_battleship');
  if (!(slid < start - stage.width * 0.2)) throw new Error('A swipe did not slide the posters');
  if ((await page.evaluate(() => window.xomdao.scene())) !== 'select')
    throw new Error('A swipe picked a game');
  await page.screenshot({ path: t.shot('2-phone-swiped.png') });
  await swipe(page, cdp, stage, stage.width * 2);
  if ((await left(page, 'Card_battleship')) !== start)
    throw new Error('The rail slid past its first poster');

  // The genres change the posters.
  await tap(page, 'Tab_hanh-dong');
  await page.waitForFunction(() => window.xomdao.rect('Card_bom-nguyen-to'));
  if (await left(page, 'Card_battleship')) throw new Error("Cờ's posters stayed under Hành động");
  await page.screenshot({ path: t.shot('3-phone-genre.png') });
  await tap(page, 'Tab_co');
  await page.waitForFunction(() => window.xomdao.rect('Card_battleship'));

  // A tap on a poster is the whole choice: its room, where the scroll opens the paged rules.
  await tap(page, 'Card_battleship');
  await onScene(page, 'room');
  await godotText(page, 'RoomGame', 'Bắn Tàu');
  await page.screenshot({ path: t.shot('4-phone-room.png') });
  await tap(page, 'RoomRules');
  await godotText(page, 'RulesPage', /^1 \/ \d+$/);
  await page.screenshot({ path: t.shot('5-phone-rules.png') });
  const rules = await page.evaluate(() => window.xomdao.rect('RulesPanel'));
  const count = Number((await godotText(page, 'RulesPage')).split('/')[1]);
  await swipe(page, cdp, rules, -rules.width * 0.25);
  await godotText(page, 'RulesPage', `${Math.min(2, count)} / ${count}`);
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
  if ((await page.evaluate(() => window.xomdao.scene())) !== 'room')
    throw new Error('Closing the rules left the room');
}
