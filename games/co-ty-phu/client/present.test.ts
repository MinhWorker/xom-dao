import { describe, expect, it } from 'vitest';
import type { CardId } from '../server/game/cards.js';
import type { State } from '../server/game/model.js';
import { all, open, own, player, viewOf } from '../server/game/test-match.js';
import { changes } from './present.js';

/** What changes when `a` rolls `dice` from the first state after `arrange`. */
function roll(dice: [number, number], arrange = (s: State) => s, chance: CardId[] = []) {
  const game = open({ rolls: [dice], arrange, chance });
  const before = viewOf(game, 'a');
  game.send('a', 'roll');
  return changes(before, viewOf(game, 'a'));
}

describe('what a new view shows', () => {
  it('rolls the dice, then walks the token Tile by Tile', () => {
    expect(roll([1, 2])).toEqual([
      { kind: 'dice', dice: [1, 2] },
      { kind: 'walk', seat: 0, from: 0, steps: 3 },
    ]);
  });

  it('shows money moving after the token lands', () => {
    const steps = roll([1, 2], own(1, [3], 1));
    expect(steps.slice(2)).toEqual([
      { kind: 'cash', seat: 0, delta: -72 },
      { kind: 'cash', seat: 1, delta: 72 },
    ]);
  });

  it('jumps to jail from Vào tù', () => {
    expect(roll([1, 2], player(0, { tile: 27 }))).toEqual([
      { kind: 'dice', dice: [1, 2] },
      { kind: 'walk', seat: 0, from: 27, steps: 3 },
      { kind: 'jump', seat: 0, to: 10 },
    ]);
  });

  it('shows the Card drawn before what it does', () => {
    expect(roll([3, 4], (s) => s, ['chance-back'])).toEqual([
      { kind: 'dice', dice: [3, 4] },
      { kind: 'walk', seat: 0, from: 0, steps: 7 },
      { kind: 'card', seat: 0, id: 'chance-back' },
      { kind: 'jump', seat: 0, to: 4 },
      { kind: 'cash', seat: 0, delta: -100 },
    ]);
  });

  it('walks on to where a Card sends the token ahead', () => {
    expect(roll([3, 4], (s) => s, ['chance-station']).slice(2)).toEqual([
      { kind: 'card', seat: 0, id: 'chance-station' },
      { kind: 'walk', seat: 0, from: 7, steps: 8 },
    ]);
  });

  it('shows a Lot changing hands or Levels', () => {
    const game = open({ rolls: [[1, 2]], arrange: all(own(0, [3], 1)) }).send('a', 'roll');
    const before = viewOf(game, 'a');
    game.send('a', 'upgrade');
    expect(changes(before, viewOf(game, 'a'))).toEqual([
      {
        kind: 'lot',
        tile: 3,
        before: { owner: 0, level: 1, built: 0 },
        after: { owner: 0, level: 2, built: 90 },
      },
      { kind: 'cash', seat: 0, delta: -90 },
    ]);
  });
});
