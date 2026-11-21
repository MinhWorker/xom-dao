import { optionsSchema, testGame } from '@xomdao/sdk';
import { describe, expect, it } from 'vitest';
import manifest from '../../manifest.js';
import { botPlay, combosOf } from './bot.js';
import { comboOf } from './cards.js';
import type { State } from './model.js';
import { TienLenGame } from './TienLenGame.js';

describe('computer player', () => {
  it('only lists real combinations', () => {
    const hand = [0, 1, 4, 5, 8, 9, 12, 20, 44, 45, 46, 47, 51];
    const combos = combosOf(hand);
    for (const cards of combos) expect(comboOf(cards)).not.toBeNull();
    expect(combos.some((c) => comboOf(c)?.kind === 'pairs')).toBe(true);
    expect(combos.some((c) => comboOf(c)?.kind === 'quad')).toBe(true);
  });

  it('finishes Matches without a rejected move', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const players = ['a', 'b', 'c', 'd'];
      const game = testGame(new TienLenGame(), players, {
        seed,
        options: optionsSchema(manifest).parse({ rounds: 1 }),
        bots: players,
      });
      game.fireTimer();
      for (let i = 0; i < 800 && !game.result; i++) {
        const id = players[game.state.turn] as string;
        const move = game.bot(id);
        expect(move).not.toBeNull();
        game.send(id, move?.event as string, move?.payload as object);
      }
      expect(game.result?.seats.filter((s) => s.place === 1)).toHaveLength(1);
    }
  });

  it('leads with its lowest card in the longest set, and follows with the weakest play', () => {
    const base = {
      mustPlay: null,
      hands: [
        [0, 1, 2, 3, 20],
        [4, 9, 50],
      ],
    } as unknown as State;
    // Leading: the 3s are a quad (♠♣♦♥), the longest set holding the lowest card.
    expect(botPlay({ ...base, table: null }, 0)).toEqual([0, 1, 2, 3]);
    const on = (card: number): State =>
      ({ ...base, table: { seat: 0, cards: [card], kind: 'single', trick: 0 } }) as State;
    expect(botPlay(on(8), 1)).toEqual([9]);
    expect(botPlay(on(51), 1)).toBeNull();
  });
});
