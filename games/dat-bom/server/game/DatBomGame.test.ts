import { optionsSchema, type RealtimeContext, realtimeRules, testRealtimeGame } from '@xomdao/sdk';
import { describe, expect, it } from 'vitest';
import manifest from '../../manifest.js';
import { DatBomGame } from './DatBomGame.js';
import {
  BLAST_TICKS,
  BOMB_DAMAGE,
  COUNTDOWN_TICKS,
  FUSE_TICKS,
  MATCH_TICKS,
  MAX_HP,
  type Options,
  type State,
} from './model.js';

const options = optionsSchema(manifest).parse({});
const match = (players = ['a', 'b'], seed = 1) =>
  testRealtimeGame(new DatBomGame(), players, { options, seed });
const started = (players?: string[], seed?: number) => match(players, seed).tick(COUNTDOWN_TICKS);

const hold = (move: 'up' | 'down' | 'left' | 'right' | 'none', bomb = false) => ({ move, bomb });

describe('Đặt Bom', () => {
  it('declares a Realtime game the host can run', () => {
    const rules = realtimeRules(new DatBomGame());
    expect(rules).toMatchObject({ tickRate: 20, snapshotRate: 10, snapshotEvery: 2 });
    expect(manifest).toMatchObject({ bots: true, minPlayers: 2, maxPlayers: 4 });
  });

  it('lets nobody move or bomb during the countdown', () => {
    const game = match();
    game.input('a', 0, hold('right', true)).tick(COUNTDOWN_TICKS - 1);
    expect(game.state.players[0]).toMatchObject({ x: 0.5, y: 0.5, move: 'none' });
    expect(game.state.bombs).toHaveLength(0);
    game.tick();
    expect(game.state.players[0]).toMatchObject({ x: 0.5, move: 'none' });
  });

  it('walks a player in the direction held until they change it', () => {
    const game = started();
    game.input('a', 0, hold('right')).tick(10);
    expect(game.state.players[0]?.x).toBeCloseTo(0.5 + 1.6);
    game.input('a', 1, hold('none')).tick(10);
    expect(game.state.players[0]?.x).toBeCloseTo(0.5 + 1.6);
    expect(game.state.players[1]).toMatchObject({ x: 10.5, y: 8.5 });
  });

  it('places a bomb where the player stands, up to two at a time', () => {
    const game = started();
    game.input('a', 0, hold('none', true)).tick();
    expect(game.state.bombs).toMatchObject([{ owner: 0, x: 0, y: 0, free: [0] }]);
    game.input('a', 1, hold('right', true)).tick(8);
    game.input('a', 2, hold('right', true)).tick(8);
    expect(game.state.bombs).toHaveLength(2);
    expect(game.state.bombs[1]).toMatchObject({ owner: 0, y: 0 });
  });

  it('explodes the bomb after its fuse, hurting who is still there once', () => {
    const game = started();
    game.input('a', 0, hold('none', true)).tick(FUSE_TICKS - 1);
    expect(game.state.bombs).toHaveLength(1);
    expect(game.state.players[0]?.hp).toBe(MAX_HP);
    game.tick();
    expect(game.state.bombs).toHaveLength(0);
    expect(game.state.blasts).toHaveLength(1);
    expect(game.state.players[0]?.hp).toBe(MAX_HP - BOMB_DAMAGE);
    game.tick(BLAST_TICKS);
    expect(game.state.blasts).toHaveLength(0);
    expect(game.state.players[0]?.hp).toBe(MAX_HP - BOMB_DAMAGE);
  });

  it('knocks a player out after three hits and ends the Match for the last one standing', () => {
    const game = started();
    for (let hit = 0; hit < 3; hit++) {
      game.input('a', hit, hold('none', true)).tick(FUSE_TICKS + BLAST_TICKS);
    }
    expect(game.state.players[0]).toMatchObject({ hp: 0, out: expect.any(Number) });
    expect(game.result?.seats).toEqual([
      { player: 'a', place: 2, score: 0 },
      { player: 'b', place: 1, score: MAX_HP },
    ]);
    const ticks = game.ticks;
    game.tick(10);
    expect(game.ticks).toBe(ticks);
  });

  it('ignores a knocked out player’s input', () => {
    const game = started();
    for (let hit = 0; hit < 3; hit++) {
      game.input('a', hit, hold('none', true)).tick(FUSE_TICKS + BLAST_TICKS);
    }
    const before = game.state;
    game.input('a', 9, hold('right', true));
    expect(game.state).toEqual(before);
  });

  it('ranks by health when the time is up', () => {
    const game = started();
    game.input('a', 0, hold('none', true)).tick(FUSE_TICKS);
    expect(game.result).toBeNull();
    game.tick(MATCH_TICKS - FUSE_TICKS - 1);
    expect(game.result).toBeNull();
    game.tick();
    expect(game.result?.seats).toEqual([
      { player: 'a', place: 2, score: MAX_HP - BOMB_DAMAGE },
      { player: 'b', place: 1, score: MAX_HP },
    ]);
  });

  it('is a draw when nobody has been hurt at the end', () => {
    const game = started().tick(MATCH_TICKS);
    expect(game.result?.seats.map((s) => s.place)).toEqual([1, 1]);
  });

  it('is a draw when everyone goes out at once', () => {
    const state = started().state as State;
    for (const p of state.players) Object.assign(p, { hp: 0, out: 500 });
    const ctx = { state, tick: 500 } as RealtimeContext<State, Options>;
    expect(new DatBomGame().result(ctx)?.places).toEqual([1, 1]);
  });

  it('seats up to four players in the corners and builds the same arena for a seed', () => {
    const game = match(['a', 'b', 'c', 'd'], 5);
    expect(game.state.players.map((p) => [p.x, p.y])).toEqual([
      [0.5, 0.5],
      [10.5, 8.5],
      [10.5, 0.5],
      [0.5, 8.5],
    ]);
    expect(match(['a', 'b', 'c', 'd'], 5).state.rows).toEqual(game.state.rows);
    expect(match(['a', 'b'], 6).state.rows).not.toEqual(game.state.rows);
  });

  it('shows everyone the whole arena', () => {
    const game = started();
    expect(game.view('a')).toEqual(game.state);
    expect(game.view(null)).toEqual(game.state);
  });

  it('never changes a state it was given', () => {
    const game = started();
    const before = game.state;
    const copy = structuredClone(before);
    game.input('a', 0, hold('right', true)).tick(5);
    expect(game.state).not.toEqual(before);
    expect(before).toEqual(copy);
  });
});
