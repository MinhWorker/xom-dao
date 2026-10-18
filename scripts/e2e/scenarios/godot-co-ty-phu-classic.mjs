// The real ledger flow: browse assets, compose/reset/send a trade, mortgage two deeds, then win.
import { DESKTOP, godotText, launch, onScene, openGodot, room, tap } from '../godot.mjs';

export const games = ['co-ty-phu-classic'];
export { launch };

/** Runs a Dev Console line in the room. */
async function cmd(page, line) {
  await page.evaluate((line) => window.xomdao.request('dev:command', { line }), line);
  const reply = await (await page.waitForFunction(() => window.xomdao.reply())).jsonValue();
  if (!reply.ok) throw new Error(`Dev Console ${line}: ${reply.error}`);
}

export default async function run(t) {
  const page = await openGodot(t, await t.page(DESKTOP), '?play=co-ty-phu-classic');
  await onScene(page, 'co-ty-phu-classic', 60_000);
  const me = await page.evaluate(() => {
    const { room, playerId } = window.xomdao.state();
    return room.seats.findIndex((s) => s.id === playerId);
  });
  await cmd(page, 'bot pause; timer pause');
  await cmd(
    page,
    [
      ...[1, 2, 3].flatMap((i) => [
        `state set properties.${i}.owner ${me}`,
        `state set properties.${i}.houses 0`,
        `state set properties.${i}.mortgaged false`,
      ]),
      `state set properties.6.owner ${(me + 1) % 4}`,
      `state set players.${me}.position 1`,
      `state set turn ${me}`,
      'state set phase "end"',
      'state set specialEvent null',
      'state set auction null',
      'state set debt null',
      'state set trade null',
      'state set pending null',
      'state set buildable null',
    ].join('; '),
  );
  await page.waitForFunction(() => window.xomdao.rect('BuildPriceDrawerButton')?.width > 0, null, {
    timeout: 60_000,
  });
  await tap(page, 'BuildPriceDrawerButton');
  await page.waitForTimeout(450);
  await page.screenshot({ path: t.shot('0-build-price-drawer.png') });
  await tap(page, 'BuildPriceDrawerButton');
  await page.waitForTimeout(350);
  await page.waitForFunction(() => window.xomdao.rect('LedgerOpen'), null, { timeout: 60000 });
  await tap(page, 'LedgerOpen');
  await tap(page, 'Estate_1');
  await page.screenshot({ path: t.shot('1-assets.png') });
  await tap(page, 'LedgerTrade');
  await tap(page, 'TradeGive_1');
  await tap(page, 'TradeTake_6');
  await page.screenshot({ path: t.shot('1-trade.png') });
  await tap(page, 'ResetTrade');
  await tap(page, 'TradeCash_0');
  await tap(page, 'MoneyKey_5');
  await tap(page, 'MoneyKey_0');
  await tap(page, 'MoneyKey_✓');
  await tap(page, 'SendTrade');
  await page.waitForFunction(() => window.xomdao.state().room.view.phase === 'trade');
  await cmd(page, 'bot step');
  await page.waitForFunction(() => window.xomdao.state().room.view.trade === null);
  await page.waitForFunction(() => window.xomdao.rect('ResetTrade'), null, { timeout: 60000 });
  await page.waitForTimeout(3500);
  await tap(page, 'LedgerAssets');
  await tap(page, 'Estate_1');
  await tap(page, 'EstateMortgage');
  await tap(page, 'Estate_3');
  await page.screenshot({ path: t.shot('2-mortgage.png') });
  await tap(page, 'EstateCommit');
  await page.waitForFunction(() => {
    const p = window.xomdao.state().room.view.properties;
    return p[1].mortgaged && p[3].mortgaged;
  });
  await page.waitForTimeout(3500);
  await tap(page, 'CloseLedger');
  const other = [1, 2, 3].map((k) => (me + k) % 4);
  await cmd(
    page,
    [
      `state set players.${other[0]}.bankrupt true`,
      `state set players.${other[1]}.bankrupt true`,
      `state set properties.3.owner ${me}`,
      'state set properties.3.houses 5',
      'state set properties.3.mortgaged false',
      `state set players.${other[2]}.position 1`,
      `state set players.${other[2]}.cash 10`,
      `state set players.${other[2]}.jailed false`,
      // An owner in jail collects no rent: you may have been jailed in the turns above.
      `state set players.${me}.jailed false`,
      `state set players.${me}.jailRolls 0`,
      `state set turn ${other[2]}`,
      'state set phase "roll"',
      'state set specialEvent null',
      'state set auction null',
      'state set debt null',
      'state set trade null',
      'state set pending null',
      'dice 1 1',
    ].join('; '),
  );
  for (let i = 0; i < 20 && (await room(page)).view.winner === null; i++) {
    await cmd(page, 'bot step');
    await page.waitForTimeout(500);
  }
  await page.waitForFunction(() => window.xomdao.state().room.view.winner !== null, null, {
    timeout: 15_000,
  });
  await godotText(page, 'ResultTitle', /thắng/, 30_000);
  await page.screenshot({ path: t.shot('4-result.png') });
}
