/** Helpers the tests share: a Match with scripted dice and Cards, and changes to its first state. */
import { optionsSchema, testGame } from '@xomdao/sdk';
import manifest from '../../manifest.js';
import { CoTyPhuGame } from './CoTyPhuGame.js';
import type { CardId } from './cards.js';
import type { Player, State, View } from './model.js';
import { TUNING, type Tuning } from './tuning.js';

export const PLAYERS = ['a', 'b', 'c', 'd'];

/** The prices the rule tests are worked out with, so a balance pass does not change them. */
export const RULES_TUNING: Tuning = { ...TUNING, levelRent: [0.4, 1.1, 3, 4, 5] };

/**
 * A Match whose dice come from `rolls` in order and whose piles are `chance` and `chest` (empty
 * by default, so Cơ hội and Khí vận do nothing), after `arrange` changed its first state.
 */
export function open({
  rolls = [] as [number, number][],
  arrange = (s: State) => s,
  players = PLAYERS.slice(0, 2),
  speed = 'normal' as 'normal' | 'fast',
  chance = [] as CardId[],
  chest = [] as CardId[],
  bots = [] as string[],
  seed = 1,
  tuning = RULES_TUNING,
} = {}) {
  const game = new CoTyPhuGame({
    tuning,
    dice: (_, roll) => {
      const next = rolls[roll];
      if (!next) throw new Error('the test ran out of dice');
      return next;
    },
    arrange: (s) => arrange({ ...s, decks: { chance, chest } }),
  });
  return testGame(game, players, {
    options: optionsSchema(manifest).parse({ speed }),
    bots,
    seed,
  });
}

/** Changes one player's first state. */
export const player =
  (seat: number, patch: Partial<Player>) =>
  (s: State): State => ({
    ...s,
    players: s.players.map((p, i) => (i === seat ? { ...p, ...patch } : p)),
  });

/** `owner` owns `tiles` at `level`, with `built` paid for each. */
export const own =
  (owner: number, tiles: number[], level = 1, built = 0) =>
  (s: State): State => ({
    ...s,
    lots: s.lots.map((l, i) => (tiles.includes(i) ? { owner, level, built } : l)),
  });

export const all =
  (...steps: ((s: State) => State)[]) =>
  (s: State) =>
    steps.reduce((acc, step) => step(acc), s);

export const cash = (game: { state: State }) => game.state.players.map((p) => p.cash);

/** What `who` sees of a Match. */
export const viewOf = (game: { view(who: string | null): unknown }, who: string) =>
  game.view(who) as View;
