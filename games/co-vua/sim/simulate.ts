/**
 * Plays computer Matches with no server, one level against another, and prints how often each
 * wins, the longest a move took to think and the average Match length.
 *
 *   npm run simulate -w @xomdao/game-co-vua -- [--games 10] [--levels hard,normal]
 */
import { optionsSchema, testGame } from '@xomdao/sdk';
import manifest from '../manifest.js';
import { CoVuaGame } from '../server/game/CoVuaGame.js';
import type { BotLevel, State } from '../server/game/model.js';

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
};

const games = Number(arg('games', '10'));
const [a, b] = arg('levels', 'hard,normal').split(',') as [BotLevel, BotLevel];
const tally = { a: 0, b: 0, draw: 0 };
let slowest = 0;
let plies = 0;
for (let g = 0; g < games; g++) {
  const levels: Record<string, BotLevel> = g % 2 ? { p0: b, p1: a } : { p0: a, p1: b };
  const make = (level: BotLevel) =>
    testGame(new CoVuaGame(), ['p0', 'p1'], {
      options: optionsSchema(manifest).parse({ level }),
      bots: ['p0', 'p1'],
      seed: g + 1,
    });
  const sides = { p0: make(levels.p0 as BotLevel), p1: make(levels.p1 as BotLevel) };
  const game = sides.p0;
  while (!game.result) {
    const state = game.state as State;
    const t = performance.now();
    const move = sides[state.turn as 'p0' | 'p1'].bot(state.turn);
    slowest = Math.max(slowest, performance.now() - t);
    if (!move) break;
    for (const side of Object.values(sides))
      side.send(state.turn, move.event, move.payload as object);
  }
  const state = game.state as State;
  plies += state.sans.length;
  const winner = state.winner ? levels[state.winner] : null;
  if (!winner) tally.draw++;
  else if (winner === a && levels.p0 !== levels.p1) tally.a++;
  else tally.b++;
  console.log(`game ${g + 1}: ${winner ?? 'draw'} (${state.ending}) in ${state.sans.length} plies`);
}
console.log(
  `${a} ${tally.a} – ${b} ${tally.b}, ${tally.draw} drawn; slowest move ${Math.round(slowest)} ms; ${Math.round(plies / games)} plies a Match`,
);
