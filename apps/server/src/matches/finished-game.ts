import type { GameResult, PlayerId } from '@xomdao/shared';

/** A game that ended with a result, as matches, ledger and stats record it. */
export interface FinishedGame {
  gameId: string;
  /** Unique to this game. */
  matchId: string;
  startedAt: number;
  endedAt: number;
  /** Everyone seated when the game began, in seat order. */
  seats: {
    id: PlayerId;
    name: string;
    avatar?: string;
    frame?: string;
    bot: boolean;
    left: boolean;
  }[];
  result: GameResult;
}
