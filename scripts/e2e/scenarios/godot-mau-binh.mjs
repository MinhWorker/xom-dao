// Mậu Binh in the Godot client (#121): the sandbox (?play=mau-binh) plays a 3-round game against
// three computer players. The first round you swap two cards by tapping, undo, drag one card onto
// another and undo, and open Luật tính điểm; the second, Kết quả các vòng. Each round Tự xếp
// arranges and you press Xong; the reveal shows chi by chi at every seat, the round's standings
// follow, and the hub's result comes at the end. Needs the debug web build
// (npm run godot:export -- --debug).

import { DESKTOP, godotText, launch, onScene, openGodot, room, tap } from '../godot.mjs';

/** The middle of a named node, in page pixels, once it is on screen. */
async function middle(page, name) {
  const r = await (
    await page.waitForFunction((n) => {
      const box = window.xomdao.rect(n);
      return box && box.width > 0 ? box : false;
    }, name)
  ).jsonValue();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2, box: r };
}

/** Opens a board with its button, takes its picture, and closes it by tapping beside it. */
async function openBoard(t, page, button, board, shot) {
  await tap(page, button);
  const { box } = await middle(page, board);
  await page.waitForTimeout(400);
  await page.screenshot({ path: t.shot(shot) });
  await page.mouse.click(Math.max(4, box.x / 2), box.y + box.height / 2);
  await page.waitForFunction((n) => !window.xomdao.rect(n), board, { timeout: 5_000 });
}

export const games = ['mau-binh'];
export { launch };

export default async function run(t) {
  const page = await openGodot(t, await t.page(DESKTOP), '?play=mau-binh');
  await onScene(page, 'mau-binh', 60_000);
  const done = new Set();
  for (let i = 0; i < 800; i++) {
    const r = await room(page);
    if (r.status === 'finished') break;
    const v = r.view;
    const key = `${v.round}:${v.phase}`;
    if (v.phase === 'arrange' && v.mine === null && !done.has(key)) {
      done.add(key);
      await page.waitForTimeout(600);
      if (!done.has('swap')) {
        done.add('swap');
        await tap(page, 'Mine_0');
        await tap(page, 'Mine_12');
        await page.screenshot({ path: t.shot('1-arrange.png') });
        await tap(page, 'Undo');
        // Drag the strongest card onto chi 3's last card: it swaps (Hoàn tác has something to
        // undo), then undo it.
        const from = await middle(page, 'Mine_0');
        const to = await middle(page, 'Mine_12');
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 6 });
        await page.mouse.move(to.x, to.y, { steps: 6 });
        await page.screenshot({ path: t.shot('1-drag.png') });
        await page.mouse.up();
        await page.waitForTimeout(300);
        if (!(await page.evaluate(() => window.xomdao.click('Undo')))) {
          throw new Error('dragging Mine_0 onto Mine_12 did not swap them');
        }
        await openBoard(t, page, 'RulesButton', 'Scoring', '1-rules.png');
      } else if (!done.has('results')) {
        done.add('results');
        await openBoard(t, page, 'ResultsButton', 'Results', '2-results.png');
      }
      await tap(page, 'Auto');
      await godotText(page, 'Status', 'Đang xếp');
      await tap(page, 'Done');
      await page.waitForFunction(
        () => {
          const v = window.xomdao.state().room?.view;
          return v && (v.mine !== null || v.phase !== 'arrange');
        },
        null,
        { timeout: 10_000 },
      );
    } else if (v.phase === 'show' && !done.has('reveal-shot')) {
      done.add('reveal-shot');
      // The reveal runs on the server's clock: on a busy machine this loop may see the show phase
      // late, so any chi (or the totals) will do for the picture.
      await godotText(page, 'Info', /Chi [123]|Vòng sau|Tổng kết/, 15_000);
      await page.screenshot({ path: t.shot('2-chi.png') });
      // A slow client can still be on a chi when the server moves on, which cuts its reveal short.
      const totals = await page.waitForFunction(
        (round) => {
          if (/Vòng sau|Tổng kết/.test(window.xomdao.text('Info') ?? '')) return 'totals';
          const r = window.xomdao.state().room;
          return r?.status === 'finished' || r?.view?.round !== round || r?.view?.phase !== 'show';
        },
        v.round,
        { timeout: 20_000 },
      );
      if ((await totals.jsonValue()) === 'totals') {
        await page.screenshot({ path: t.shot('3-totals.png') });
        // Between rounds: the round's standings, best first (unless the next deal came first).
        const board = await page.waitForFunction(
          (round) => {
            if (window.xomdao.rect('Standing_0')) return 'up';
            return window.xomdao.state().room?.view?.round !== round ? 'gone' : false;
          },
          v.round,
          { timeout: 10_000 },
        );
        if ((await board.jsonValue()) === 'up') {
          await page.screenshot({ path: t.shot('3-standings.png') });
        }
      }
    }
    await page.waitForTimeout(250);
  }
  await godotText(page, 'ResultTitle', /thắng|Hoà/, 30_000);
  await page.screenshot({ path: t.shot('4-result.png') });
}
