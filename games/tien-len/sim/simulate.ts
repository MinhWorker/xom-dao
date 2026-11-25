/**
 * Plays Matches of computers with no server: one seat runs the current computer player
 * (`server/game/bot.ts`), the others the old one (`baseline.ts`). It prints how often the new
 * one goes out first in a round, against the even share, and how long a round lasts in plays.
 *
 *   npm run simulate -w @xomdao/game-tien-len -- [--games 200] [--seats 2,3,4]
 */
import { optionsSchema, testGame } from '@xomdao/sdk';
import manifest from '../manifest.js';
import type { State } from '../server/game/model.js';
import { TienLenGame } from '../server/game/TienLenGame.js';
import { baselinePlay } from './baseline.js';

/** A round still going after this many moves is a bug. */
const MAX_MOVES = 2000;

export interface Summary {
  seats: number;
  games: number;
  /** Share of rounds the new player went out first. */
  firsts: number;
  /** Share of rounds it came last. */
  lasts: number;
  /** Plays and passes per round, on average. */
  moves: number;
}

/** Plays one single-round Match with the new player in `seat`; its place and the moves made. */
export function playRound(seats: number, seat: number, seed: number) {
  const players = Array.from({ length: seats }, (_, i) => `bot${i}`);
  const game = testGame(new TienLenGame(), players, {
    options: optionsSchema(manifest).parse({ rounds: 1 }),
    bots: players,
    seed,
  });
  game.fireTimer();
  let moves = 0;
  while (!game.result) {
    if (++moves > MAX_MOVES) throw new Error(`Round never ends (seed ${seed})`);
    const state = game.state as State;
    const id = players[state.turn] as string;
    if (state.turn === seat) {
      const move = game.bot(id);
      if (!move) throw new Error(`No move (seed ${seed})`);
      game.send(id, move.event, move.payload as object);
    } else {
      const cards = baselinePlay(state, state.turn);
      if (cards) game.send(id, 'play', { cards });
      else game.send(id, 'pass', {});
    }
  }
  const out = (game.state as State).out;
  return { first: out[0] === seat, last: out[out.length - 1] === seat, moves };
}

export function simulate(seats: number, games: number): Summary {
  let firsts = 0;
  let lasts = 0;
  let moves = 0;
  for (let i = 0; i < games; i++) {
    const round = playRound(seats, i % seats, 1 + i);
    firsts += round.first ? 1 : 0;
    lasts += round.last ? 1 : 0;
    moves += round.moves;
  }
  return { seats, games, firsts: firsts / games, lasts: lasts / games, moves: moves / games };
}

const pct = (n: number) => `${(100 * n).toFixed(0)}%`;

/** One table row per seat count. */
export function report(summaries: readonly Summary[]) {
  const head = '| Ghế | Vòng | Về nhất (chia đều) | Về bét | Nước/vòng |';
  const rows = summaries.map(
    (s) =>
      `| ${s.seats} | ${s.games} | ${pct(s.firsts)} (${pct(1 / s.seats)}) | ${pct(s.lasts)} | ${s.moves.toFixed(0)} |`,
  );
  return [head, `|${' --- |'.repeat(5)}`, ...rows].join('\n');
}

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? undefined : process.argv[i + 1];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const games = Number(arg('games') ?? 200);
  const seats = (arg('seats') ?? '2,3,4').split(',').map(Number);
  console.log(report(seats.map((n) => simulate(n, games))));
}
