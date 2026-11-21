import type { MatchResult, RoomSeat } from '@xomdao/sdk';
import type { RoomOptions } from '@xomdao/shared';

export interface MatchStart {
  matchId: string;
  roomCode: string;
  gameId: string;
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
  result?: MatchResult;
}
