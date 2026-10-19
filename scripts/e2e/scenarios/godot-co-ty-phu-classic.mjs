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

async function tapSquare(page, square) {
  const box = await (
    await page.waitForFunction((name) => {
      const rect = window.xomdao.rect(name);
      return rect && rect.width > 0 ? rect : false;
    }, `Square_${square}`)
  ).jsonValue();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
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
      'state set debt null',
      'state set trade null',
      'state set pending null',
      'state set buildable null',
    ].join('; '),
  );
  await cmd(
    page,
    [
      `state set players.${me}.position 16`,
      `state set properties.16.owner ${me}`,
      'state set properties.16.houses 0',
      'state set properties.16.mortgaged false',
      `state set turn ${me}`,
      'state set phase "roll"',
      'state set doubles 1',
      'state set dice [2,2]',
      'state set buildable 16',
    ].join('; '),
  );
  await page.waitForFunction(
    () =>
      window.xomdao.rect('SkipBuild')?.width > 0 &&
      window.xomdao.text('Build') === 'Xây nhà 135' &&
      window.xomdao.text('SkipBuild') === 'Bỏ qua',
    null,
    { timeout: 60_000 },
  );
  await page.screenshot({ path: t.shot('0-skip-build.png') });
  await tap(page, 'SkipBuild');
  await page.waitForFunction(() => {
    const view = window.xomdao.state().room.view;
    return view.phase === 'roll' && view.buildable === null;
  });
  await cmd(
    page,
    [
      `state set players.${me}.position 1`,
      'state set properties.16.owner null',
      `state set phase "end"`,
      'state set doubles 0',
      'state set dice null',
      'state set buildable null',
    ].join('; '),
  );
  await cmd(
    page,
    [
      `state set players.${me}.position 5`,
      `state set turn ${me}`,
      'state set phase "buy"',
      'state set after "end"',
      'state set pending 5',
      'state set properties.5.owner null',
    ].join('; '),
  );
  await page.waitForFunction(
    () =>
      window.xomdao.rect('Buy')?.width > 0 &&
      window.xomdao.text('Buy') === 'Mua 200' &&
      window.xomdao.rect('Skip')?.width > 0,
    null,
    { timeout: 60_000 },
  );
  await page.screenshot({ path: t.shot('0-station-buy.png') });
  await tap(page, 'Buy');
  await page.waitForFunction(
    (seat) => window.xomdao.state().room.view.properties[5].owner === seat,
    me,
  );
  await cmd(
    page,
    [
      'state set phase "end"',
      'state set pending null',
      'state set properties.5.owner null',
      'state set properties.2.houses 1',
      `state set players.${me}.position 1`,
    ].join('; '),
  );
  await page.waitForFunction(() => window.xomdao.rect('BuildPriceDrawerButton')?.width > 0, null, {
    timeout: 60_000,
  });
  await tapSquare(page, 2);
  await page.waitForFunction(
    () => {
      const view = window.xomdao.state().room.view;
      return (
        view.properties[2].houses === 1 &&
        window.xomdao.text('TileActionButton') === '+38' &&
        window.xomdao.rect('TileActionButton')?.width > 0
      );
    },
    null,
    {
      timeout: 60_000,
    },
  );
  await page.screenshot({ path: t.shot('0-tile-hud-sell-house.png') });
  await tap(page, 'TileActionButton');
  await page.waitForFunction(() => window.xomdao.state().room.view.properties[2].houses === 0);
  await page.waitForFunction(() => window.xomdao.text('TileActionButton') === '+75', null, {
    timeout: 60_000,
  });
  await page.screenshot({ path: t.shot('0-tile-hud-mortgage.png') });
  await tap(page, 'TileActionButton');
  await godotText(page, 'MortgageConfirmTitle', 'Chắc chứ?');
  await page.screenshot({ path: t.shot('0-tile-hud-confirm.png') });
  await tap(page, 'ConfirmMortgage');
  await page.waitForFunction(
    (square) => window.xomdao.state().room.view.properties[square].mortgaged,
    2,
  );
  await page.waitForFunction(() => window.xomdao.text('TileActionButton') === 'Chuộc 83', null, {
    timeout: 60_000,
  });
  await page.screenshot({ path: t.shot('0-tile-hud-redeem.png') });
  await tap(page, 'TileActionButton');
  await page.waitForFunction(
    (square) => !window.xomdao.state().room.view.properties[square].mortgaged,
    2,
  );
  await page.waitForFunction(() => window.xomdao.rect('TileActionButton')?.width > 0);
  await page.waitForTimeout(3500);
  await tapSquare(page, 2);
  await page.waitForFunction(() => window.xomdao.text('TileActionButton') === '+100');
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
      `state set players.${other[2]}.bankrupt false`,
      `state set properties.3.owner ${me}`,
      'state set properties.3.houses 5',
      'state set properties.3.mortgaged false',
      `state set players.${other[2]}.position 1`,
      `state set players.${other[2]}.cash 10`,
      `state set players.${other[2]}.jailed false`,
      `state set players.${me}.position 10`,
      `state set players.${me}.jailed true`,
      `state set players.${me}.jailRolls 2`,
      `state set players.${me}.freeCards ["chance"]`,
      `state set turn ${other[2]}`,
      'state set phase "end"',
      'state set after "end"',
      'state set specialEvent null',
      'state set debt null',
      'state set trade null',
      'state set pending null',
      'state set buildable null',
      'state set dice null',
      'state set winner null',
    ].join('; '),
  );
  await cmd(page, 'bot step');
  await page.waitForFunction((seat) => {
    const view = window.xomdao.state().room.view;
    return view.phase === 'roll' && view.turn === seat && view.players[seat].jailed;
  }, me);
  await page.waitForFunction(
    () =>
      window.xomdao.rect('Die_0') && !window.xomdao.rect('Bail') && !window.xomdao.rect('UseCard'),
  );
  await godotText(page, 'Status', 'Chạm xúc xắc để gieo', 60_000);
  await page.screenshot({ path: t.shot('3-jail-final-attempt.png') });
  await cmd(page, 'dice 2 3');
  await tap(page, 'Die_0');
  await page.waitForFunction((seat) => {
    const view = window.xomdao.state().room.view;
    return (
      view.dice?.[0] === 2 &&
      view.dice?.[1] === 3 &&
      !view.players[seat].jailed &&
      view.players[seat].position === 15 &&
      view.phase === 'buy'
    );
  }, me);
  await godotText(page, 'Buy', 'Mua 200', 30_000);
  await cmd(
    page,
    [
      `state set players.${me}.jailed false`,
      `state set players.${me}.jailRolls 0`,
      `state set players.${me}.freeCards []`,
      `state set turn ${other[2]}`,
      'state set phase "roll"',
      'state set specialEvent null',
      'state set debt null',
      'state set trade null',
      'state set pending null',
      'state set buildable null',
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
