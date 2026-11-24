/**
 * Plays Matches of computer against computer, with no server, and measures what the balance
 * pass aims at. A turn is one player's turn (a roll again after doubles is the same turn), and
 * a turn is counted as `SECONDS_PER_TURN` of play.
 *
 *   npm run simulate -w @xomdao/game-co-ty-phu -- [--games 500] [--seats 2,3,4] [--tuning <json>]
 *
 * `--tuning` overrides fields of `TUNING` (tuning.ts), e.g. `'{"startingCash":1500}'`.
 */
import { optionsSchema, testGame } from '@xomdao/sdk';
import manifest from '../manifest.js';
import { CoTyPhuGame } from '../server/game/CoTyPhuGame.js';
import { landPrice } from '../server/game/economy.js';
import { HOTEL, type State } from '../server/game/model.js';
import { TUNING, type Tuning } from '../server/game/tuning.js';

export const SECONDS_PER_TURN = 8;
/** A Match still going after this many turns is stopped and counted as unfinished. */
export const MAX_TURNS = 1500;
/** The round whose leader's chance of winning is measured. */
export const LEADER_ROUND = 10;

export interface MatchStats {
  /** Turns played; `finished` is false when it stopped at `MAX_TURNS`. */
  turns: number;
  finished: boolean;
  /** The turn the first player went bankrupt in, or `null`. */
  firstBankrupt: number | null;
  /** Whether the richest player at round `LEADER_ROUND` won, `null` when it ended before. */
  leaderWon: boolean | null;
  takeovers: number;
  hotels: number;
  quizzes: number;
}

/** What a player is worth: cash, and what their Lots and Levels cost. */
function worth(t: Tuning, state: State, seat: number) {
  const lots = state.lots.reduce(
    (sum, lot, tile) => (lot?.owner === seat ? sum + landPrice(t, tile) + lot.built : sum),
    0,
  );
  return (state.players[seat]?.cash ?? 0) + lots;
}

const hotelsOf = (state: State) => state.lots.filter((l) => l && l.level >= HOTEL).length;

/** Plays one Match of `seats` computers from `seed`. */
export function playMatch(t: Tuning, seats: number, seed: number): MatchStats {
  const players = Array.from({ length: seats }, (_, i) => `bot${i}`);
  const game = testGame(new CoTyPhuGame({ tuning: t }), players, {
    options: optionsSchema(manifest).parse({}),
    bots: players,
    seed,
  });
  const stats: MatchStats = {
    turns: 0,
    finished: false,
    firstBankrupt: null,
    leaderWon: null,
    takeovers: 0,
    hotels: 0,
    quizzes: 0,
  };
  let leader: number | null = null;
  while (!game.result && stats.turns < MAX_TURNS) {
    const before = game.state;
    const seat = players.findIndex((p) => game.bot(p));
    const id = players[seat];
    const move = id && game.bot(id);
    if (!id || !move) throw new Error(`No computer moves in phase ${before.phase} (seed ${seed})`);
    if (move.event === 'roll' && before.doubles === 0) stats.turns++;
    if (move.event === 'takeover') stats.takeovers++;
    if (move.event === 'answer') stats.quizzes++;
    game.send(id, move.event, move.payload as object | undefined);
    const after = game.state;
    stats.hotels += Math.max(0, hotelsOf(after) - hotelsOf(before));
    if (stats.firstBankrupt === null && after.bankrupt.length > 0)
      stats.firstBankrupt = stats.turns;
    if (leader === null && stats.turns >= LEADER_ROUND * seats && !game.result) {
      const alive = after.players.flatMap((p, s) => (p.bankrupt ? [] : [s]));
      leader = alive.reduce((a, b) => (worth(t, after, b) > worth(t, after, a) ? b : a));
    }
  }
  const result = game.result;
  if (result) {
    stats.finished = true;
    if (leader !== null) stats.leaderWon = result.seats[leader]?.place === 1;
  }
  return stats;
}

export interface Summary {
  seats: number;
  games: number;
  unfinished: number;
  /** Minutes of a finished Match: median, 10th and 90th percentile. */
  minutes: { median: number; p10: number; p90: number };
  turns: number;
  /** Minute of the first Bankruptcy: median and 10th percentile. */
  firstBankrupt: { median: number; p10: number };
  /** Share of Matches the leader at round `LEADER_ROUND` won. */
  leaderWins: number;
  /** Per Match. */
  takeovers: number;
  hotels: number;
  quizzes: number;
}

const minutes = (turns: number) => (turns * SECONDS_PER_TURN) / 60;

function quantile(values: readonly number[], q: number) {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] as number;
}

const mean = (values: readonly number[]) =>
  values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);

/** Plays `games` Matches of `seats` computers and sums them up. */
export function simulate(t: Tuning, seats: number, games: number): Summary {
  const all = Array.from({ length: games }, (_, i) => playMatch(t, seats, 1 + i));
  const done = all.filter((m) => m.finished);
  const turns = done.map((m) => m.turns);
  const firsts = all.flatMap((m) => (m.firstBankrupt === null ? [] : [minutes(m.firstBankrupt)]));
  const led = all.flatMap((m) => (m.leaderWon === null ? [] : [m.leaderWon ? 1 : 0]));
  return {
    seats,
    games,
    unfinished: all.length - done.length,
    minutes: {
      median: minutes(quantile(turns, 0.5)),
      p10: minutes(quantile(turns, 0.1)),
      p90: minutes(quantile(turns, 0.9)),
    },
    turns: quantile(turns, 0.5),
    firstBankrupt: { median: quantile(firsts, 0.5), p10: quantile(firsts, 0.1) },
    leaderWins: mean(led),
    takeovers: mean(all.map((m) => m.takeovers)),
    hotels: mean(all.map((m) => m.hotels)),
    quizzes: mean(all.map((m) => m.quizzes)),
  };
}

const f = (n: number, digits = 1) => (Number.isNaN(n) ? '–' : n.toFixed(digits));

/** One table row per seat count. */
export function report(summaries: readonly Summary[]) {
  const head =
    '| Ghế | Ván | Chưa xong | Lượt (trung vị) | Phút: trung vị (p10–p90) | Phá sản đầu: phút trung vị (p10) | Dẫn đầu vòng 10 thắng | Mua lại/ván | Khách sạn/ván | Đố/ván |';
  const rows = summaries.map(
    (s) =>
      `| ${s.seats} | ${s.games} | ${s.unfinished} | ${s.turns} | ${f(s.minutes.median)} (${f(s.minutes.p10)}–${f(s.minutes.p90)}) | ${f(s.firstBankrupt.median)} (${f(s.firstBankrupt.p10)}) | ${f(100 * s.leaderWins, 0)}% | ${f(s.takeovers)} | ${f(s.hotels)} | ${f(s.quizzes)} |`,
  );
  return [head, `|${' --- |'.repeat(10)}`, ...rows].join('\n');
}

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? undefined : process.argv[i + 1];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const games = Number(arg('games') ?? 500);
  const seats = (arg('seats') ?? '2,3,4').split(',').map(Number);
  const tuning: Tuning = { ...TUNING, ...JSON.parse(arg('tuning') ?? '{}') };
  console.log(report(seats.map((n) => simulate(tuning, n, games))));
}
