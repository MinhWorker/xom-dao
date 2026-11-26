/**
 * Plays computer Matches with no server, one level against another, and prints how often each
 * wins, the longest a move took to think and the average Match length.
 *
 *   npm run simulate -w @xomdao/game-co-vay -- [--games 10] [--size 9] [--levels hard,easy]
 */
import { optionsSchema, testGame } from '@xomdao/sdk';
import manifest from '../manifest.js';
import { CoVayGame, stoneOf } from '../server/game/CoVayGame.js';
import type { BotLevel, Options } from '../server/game/model.js';

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
};

const games = Number(arg('games', '10'));
const size = Number(arg('size', '9')) as Options['size'];
const [a, b] = arg('levels', 'hard,easy').split(',') as [BotLevel, BotLevel];
let aWins = 0;
let slowest = 0;
let moves = 0;
for (let g = 0; g < games; g++) {
  const players = ['p0', 'p1'];
  const levels: Record<string, BotLevel> = g % 2 ? { p0: b, p1: a } : { p0: a, p1: b };
  const games_ = Object.fromEntries(
    players.map((p) => [
      p,
      testGame(new CoVayGame(), players, {
        options: optionsSchema(manifest).parse({ size, level: levels[p] }),
        bots: players,
        seed: g + 1,
      }),
    ]),
  );
  const game = games_.p0 as ReturnType<typeof testGame>;
  const shadow = games_.p1 as ReturnType<typeof testGame>;
  let guard = 0;
  while (!game.result && guard++ < size * size * 4) {
    const state = game.state as ReturnType<CoVayGame['onStart']>;
    const who = state.phase === 'score' ? (state.agreed.includes('p0') ? 'p1' : 'p0') : state.turn;
    const t = performance.now();
    const move = (who === 'p0' ? game : shadow).bot(who);
    slowest = Math.max(slowest, performance.now() - t);
    if (!move) break;
    game.send(who, move.event, move.payload as object);
    shadow.send(who, move.event, move.payload as object);
  }
  const state = game.state as ReturnType<CoVayGame['onStart']>;
  moves += state.moves;
  const winnerLevel = state.winner ? levels[state.winner] : '?';
  if (state.winner && levels[state.winner] === a && levels.p0 !== levels.p1) aWins++;
  else if (state.winner && a === b && stoneOf(state, state.winner) === 1) aWins++;
  console.log(
    `game ${g + 1}: ${winnerLevel} wins (${state.ending}) in ${state.moves} moves`,
    state.count ? `B ${state.count.black} – W ${state.count.white}` : '',
  );
}
console.log(
  `${a} won ${aWins}/${games} against ${b}; slowest move ${Math.round(slowest)} ms; ${Math.round(moves / games)} moves a Match`,
);
