import { testGame } from '@xomdao/sdk';
import { describe, expect, it } from 'vitest';
import { CoTyPhuGame } from './CoTyPhuGame.js';

describe('CoTyPhuGame', () => {
  it('starts a Match with the first turn', () => {
    const game = testGame(new CoTyPhuGame(), ['a', 'b']);
    expect(game.state).toEqual({ turn: 0 });
  });
});
