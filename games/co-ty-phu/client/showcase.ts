/**
 * `?showcase` on the client's URL: the moments a Match seldom reaches play one after another on
 * the first view of a Match, for seat 0, then the board is put back and the Match plays on. A
 * development aid; nothing in a Match calls it.
 */
import { JAIL_TILE, setTiles, tilesOf } from '../server/game/board.js';
import type { View } from '../server/game/model.js';
import { TUNING } from '../server/game/tuning.js';
import type { CardMoments } from './cardmoments.js';
import { money } from './decisions.js';
import type { Hud } from './hud.js';
import type { Moments } from './moments.js';
import type { Change } from './present.js';
import type { BoardView } from './scene.js';
import type { Sounds } from './sound.js';
import type { Verdict } from './verdict.js';

/** What the showcase plays with: the client's pieces and a few of its helpers. */
export interface Stage {
  board: BoardView;
  sounds: Sounds;
  hud: Hud;
  moments: Moments;
  cardMoments: CardMoments;
  verdict: Verdict;
  names: readonly string[];
  low: boolean;
  wait: (ms: number) => Promise<unknown>;
  animate: (after: View, steps: Change[], pace: number, live: () => boolean) => Promise<void>;
  rollBeats: (dice: number, ms: (n: number) => number) => void;
  present: (view: View) => void;
}

/** Plays every moment for seat 0 on `view`'s board while `live`, then puts the board back. */
export async function showcase(view: View, live: () => boolean, stage: Stage) {
  const {
    board,
    sounds,
    hud,
    moments,
    cardMoments,
    verdict,
    names,
    low,
    wait,
    animate,
    rollBeats,
    present,
  } = stage;
  await wait(1200);
  if (!live()) return;
  const steps: [string, () => Promise<unknown> | unknown, number][] = [
    [
      'Mất ví',
      () => {
        sounds.play('crow');
        cardMoments.crow(1);
      },
      2600,
    ],
    [
      'Phí bảo trì',
      () => {
        sounds.play('hammer', { at: 160 });
        return board.knock([1, 3, 6, 8].map((tile) => ({ tile, text: '−25' })));
      },
      600,
    ],
    [
      'Lãi tiết kiệm',
      async () => {
        sounds.play('coins', { at: 300 });
        const from = board.vault();
        await wait(450);
        await moments.shower(from, hud.card(0), 1, 1, low, () =>
          sounds.play('coin', { gain: 0.5 }),
        );
      },
      600,
    ],
    [
      'Thần tài',
      async () => {
        const lucky = { id: 'lucky' as const, turns: 2, fresh: false };
        board.show({
          ...view,
          players: view.players.map((p, s) => (s === 0 ? { ...p, effects: [lucky] } : p)),
        });
        await wait(900);
        sounds.play('coins');
        board.luck(0, 120);
        await wait(1500);
        board.show(view);
      },
      600,
    ],
    [
      'Miễn thuê',
      async () => {
        board.rentFree([1, 3, 5, 6, 8, 11, 12, 13, 15]);
        await wait(2600);
        board.rentFree([]);
      },
      300,
    ],
    [
      'Khởi nghiệp',
      async () => {
        const startup = { id: 'startup' as const, turns: 3, fresh: false };
        hud.players({
          ...view,
          players: view.players.map((p, s) => (s === 0 ? { ...p, effects: [startup] } : p)),
        });
        await wait(2400);
        hud.players(view);
      },
      300,
    ],
    [
      'Ốm',
      () => {
        sounds.play('wrong', { gain: 0.7 });
        return cardMoments.sick(1);
      },
      300,
    ],
    [
      'Vé ra tù',
      () => {
        sounds.play('stamp', { at: 900 });
        return cardMoments.ticket(names[0] ?? '', 1);
      },
      600,
    ],
  ];
  for (const [title, play, after] of steps) {
    if (!live()) return;
    board.say(title, { ms: 1400 });
    await play();
    await wait(after);
  }
  rollBeats(2, (n) => n);
  sounds.play('horn', { at: 90 });
  sounds.play('slam', { at: 495, gain: 0.8 });
  board.say('Kẹt xe!', { tone: 'bad', big: true, ms: 1800 });
  await board.roll([4], 900);
  await wait(1800);
  if (!live()) return;
  const built = [
    [1, 2],
    [3, 5],
    [6, 1],
    [8, 3],
  ] as const;
  const housed = {
    ...view,
    lots: view.lots.map((lot, i) => {
      const level = built.find(([tile]) => tile === i)?.[1];
      return level ? { owner: 0, level, built: 0 } : lot;
    }),
  };
  board.showLots(housed);
  for (const [good, rate] of [
    [true, TUNING.cards.tourism],
    [false, TUNING.cards.repairs],
  ] as const) {
    await wait(900);
    if (!live()) return;
    sounds.play(good ? 'coins' : 'crumble', { gain: 0.8 });
    board.levy(
      built.map(([tile, level]) => ({ tile, text: `${good ? '+' : '−'}${money(rate * level)}` })),
      good,
    );
    await wait(1600);
  }
  board.showLots(view);
  const set = setTiles('magenta');
  const owned = {
    ...view,
    lots: view.lots.map((lot, i) => (set.includes(i) ? { owner: 0, level: 1, built: 0 } : lot)),
  };
  await wait(1200);
  if (!live()) return;
  board.showLots(owned);
  await animate(owned, [{ kind: 'fullset', seat: 0, tiles: set }], 1, live);
  await wait(1500);
  if (!live()) return;
  board.say('Đúng rồi!', { tone: 'good', big: true, ms: 2000 });
  board.cheer();
  await wait(2900);
  for (const of of ['station', 'utility'] as const) {
    const tiles = tilesOf(of);
    const lots = view.lots.map((lot, i) =>
      tiles.includes(i) ? { owner: 0, level: 0, built: 0 } : lot,
    );
    const crowned = { ...view, lots };
    await wait(1200);
    if (!live()) return;
    board.showLots(crowned);
    await animate(crowned, [{ kind: 'monopoly', seat: 0, tiles, of }], 1, live);
    await wait(2500);
  }
  if (!live()) return;
  sounds.play('guilty');
  await verdict.play(names[0] ?? '', 1, low);
  if (!live()) return;
  await board.jump(0, JAIL_TILE, 560, 'jail');
  await wait(900);
  if (!live()) return;
  sounds.play('coins');
  board.payday(TUNING.startBonus);
  await wait(1900);
  for (const tile of [5, 12, 26, 33, 39]) {
    if (!live()) return;
    board.aim(tile);
    await wait(1100);
  }
  board.aim(null);
  if (!live()) return;
  await board.jump(0, 39, 1400, 'flight');
  await wait(1600);
  if (live()) present(view);
}
