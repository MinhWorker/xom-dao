import { optionsSchema, testGame } from '@xomdao/sdk';
import { describe, expect, it } from 'vitest';
import manifest from '../../manifest.js';
import { botPlay, candidates, combosOf, plan } from './bot.js';
import { comboOf } from './cards.js';
import type { State } from './model.js';
import { bestMove } from './search.js';
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
      const game = testGame(new TienLenGame({ playouts: 0 }), players, {
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

  // A card is rank * 4 + suit: 3♠ = 0, 6♣ = 13, 2♠ = 48.
  const table = (hands: number[][], cards: number[] | null, played: number[] = []): State =>
    ({
      mustPlay: null,
      hands,
      table: cards && { seat: 1, cards, kind: 'single', trick: 0 },
      played: played.length ? [{ seat: 1, cards: played, kind: 'single', trick: 0 }] : [],
      passed: hands.map(() => false),
      out: [],
      trick: 0,
      turn: 0,
    }) as unknown as State;

  it('plans a hand into straights, sets and control', () => {
    const sets = plan([0, 4, 8, 12, 25, 26, 40, 48]);
    expect(sets).toContainEqual([0, 4, 8, 12]);
    expect(sets).toContainEqual([25, 26]);
    expect(sets).toContainEqual([48]);
  });

  it('keeps its 2 on a low single, but not when someone is about to go out', () => {
    const hand = [0, 1, 4, 5, 12, 48];
    expect(botPlay(table([hand, [16, 20, 24, 28, 32, 36, 44]], [13]), 0)).toBeNull();
    expect(botPlay(table([hand, [50, 51]], [13]), 0)).toEqual([48]);
  });

  it('does not break a straight to follow a single', () => {
    const hand = [0, 4, 8, 12, 40];
    expect(botPlay(table([hand, [1, 2, 3, 5, 6, 7, 9]], [9]), 0)).toEqual([40]);
  });

  it('chops a 2 with a quad', () => {
    const hand = [20, 21, 22, 23, 30];
    expect(botPlay(table([hand, [1, 2, 3, 5, 6, 7, 9]], [51]), 0)).toEqual([20, 21, 22, 23]);
  });

  it('leads a pair, not a low single, when someone holds one card', () => {
    const hand = [0, 9, 10, 30];
    expect(botPlay(table([hand, [44]], null), 0)).toEqual([9, 10]);
  });

  it('looks ahead only at legal moves, its quick choice first', () => {
    const state = table(
      [
        [0, 1, 4, 5, 12, 48],
        [16, 20, 24, 28, 32, 36, 44],
      ],
      [13],
      [13],
    );
    const moves = candidates(state, 0);
    expect(moves[0]).toEqual(botPlay(state, 0));
    expect(moves).toContainEqual(null);
    const move = bestMove(state, 0);
    expect(move === null || moves.some((m) => m?.join() === move.join())).toBe(true);
  });
});
