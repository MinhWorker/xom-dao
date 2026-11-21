import type { MatchResult } from '@xomdao/sdk';
import type { PlayerId } from '@xomdao/shared';

/** A settled Match, as matches and stats record it. */
export interface FinishedGame {
  gameId: string;
  /** The Match's id (a UUID), unique to it. */
  matchId: string;
  startedAt: number;
  endedAt: number;
  /** Everyone seated when the Match began, in seat order. */
  seats: {
    id: PlayerId;
    name: string;
    avatar?: string;
    frame?: string;
    bot: boolean;
    left: boolean;
  }[];
  result: MatchResult;
}

/** The seat's place and score in the result. */
export function placeOf({ result }: FinishedGame, player: PlayerId) {
  return result.seats.find((seat) => seat.player === player);
}

/** First place won, unless every seat shares it (a draw). */
export function won(game: FinishedGame, player: PlayerId) {
  return placeOf(game, player)?.place === 1 && game.result.seats.some((seat) => seat.place > 1);
}
