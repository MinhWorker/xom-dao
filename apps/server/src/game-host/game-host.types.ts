import type { MatchResult, RoomSeat } from '@xomdao/sdk';
import type { MatchTimer, RoomOptions } from '@xomdao/shared';

export interface MatchStart {
  matchId: string;
  roomCode: string;
  gameId: string;
  lastResult: MatchResult | null;
  players: RoomSeat[];
  options: RoomOptions;
}

export type MatchStatus = 'loading' | 'playing' | 'over';
export type MatchOutcome = 'settled' | 'aborted';

export interface MatchState {
  matchId: string;
  roomCode: string;
  gameId: string;
  status: MatchStatus;
  outcome?: MatchOutcome;
  disconnectedPlayerIds: string[];
  timer: MatchTimer | null;
  result?: MatchResult;
}
