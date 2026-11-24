import { describe, expect, it } from 'vitest';
import type { CardId } from '../server/game/cards.js';
import type { State } from '../server/game/model.js';
import { all, open, own, player, viewOf } from '../server/game/test-match.js';
import { changes, pace } from './present.js';

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
      { kind: 'jump', seat: 0, to: 10, how: 'jail' },
    ]);
  });

  it('jumps to jail on a third double without walking', () => {
    const game = open({
      rolls: [
        [1, 1],
        [2, 2],
        [3, 3],
      ],
    });
    game.send('a', 'roll').send('a', 'pass').send('a', 'roll').send('a', 'pass');
    const before = viewOf(game, 'a');
    game.send('a', 'roll');
    expect(changes(before, viewOf(game, 'a'))).toEqual([
      { kind: 'dice', dice: [3, 3] },
      { kind: 'jump', seat: 0, to: 10, how: 'jail' },
    ]);
  });

  it('shows the Card drawn before what it does', () => {
    expect(roll([3, 4], (s) => s, ['chance-back'])).toEqual([
      { kind: 'dice', dice: [3, 4] },
      { kind: 'walk', seat: 0, from: 0, steps: 7 },
      { kind: 'card', seat: 0, id: 'chance-back' },
      { kind: 'jump', seat: 0, to: 4, how: 'move' },
      { kind: 'cash', seat: 0, delta: -100 },
    ]);
  });

  it('flies from Sân bay to the Tile picked', () => {
    const game = open({ rolls: [[1, 2]], arrange: player(0, { tile: 17 }) }).send('a', 'roll');
    const before = viewOf(game, 'a');
    game.send('a', 'fly', { to: 39 });
    expect(changes(before, viewOf(game, 'a')).slice(0, 1)).toEqual([
      { kind: 'jump', seat: 0, to: 39, how: 'flight' },
    ]);
  });

  it('opens the jail before the token walks out on a double', () => {
    const jailed = player(0, { tile: 10, jailed: true });
    expect(roll([3, 3], jailed).slice(0, 3)).toEqual([
      { kind: 'dice', dice: [3, 3] },
      { kind: 'release', seat: 0 },
      { kind: 'walk', seat: 0, from: 10, steps: 6 },
    ]);
  });

  it('opens the jail when the fine is paid', () => {
    const game = open({ arrange: player(0, { tile: 10, jailed: true }) });
    const before = viewOf(game, 'a');
    game.send('a', 'pay-bail');
    expect(changes(before, viewOf(game, 'a'))).toEqual([
      { kind: 'release', seat: 0 },
      { kind: 'cash', seat: 0, delta: -50 },
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

describe('how fast the moves play', () => {
  it('plays at 2× when "Tốc độ" is Nhanh', () => {
    expect(pace(viewOf(open(), 'a'), 0)).toBe(1);
    expect(pace(viewOf(open({ speed: 'fast' }), 'a'), 0)).toBe(0.5);
  });

  it('hurries while more than two views wait', () => {
    expect(pace(viewOf(open(), 'a'), 2)).toBe(1);
    expect(pace(viewOf(open(), 'a'), 3)).toBe(0.4);
    expect(pace(viewOf(open({ speed: 'fast' }), 'a'), 3)).toBe(0.2);
  });
});
