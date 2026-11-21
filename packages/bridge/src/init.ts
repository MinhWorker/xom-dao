import type { BridgeInit, BridgeSettings } from './protocol.js';

/** What `bridgeInit` reads: the Hub's (or Harness') view of the player, the Room and the Match. */
export interface InitSource {
  user: { id: string; name: string; avatar: string };
  room: {
    code: string;
    seats: ({ id: string; name: string; avatar?: string; bot?: boolean } | null)[];
  };
  /** The latest `match:state` push, if a Match exists. */
  match: { view?: unknown } | null;
  settings: BridgeSettings;
}

/** The `init` for a Game: the seated players in seat order, and the Match's latest `view`. */
export function bridgeInit({ user, room, match, settings }: InitSource): BridgeInit {
  return {
    player: { id: user.id, name: user.name, avatar: user.avatar },
    room: {
      code: room.code,
      seats: room.seats.flatMap((seat) =>
        seat
          ? [
              {
                id: seat.id,
                name: seat.name,
                bot: seat.bot ?? false,
                ...(seat.avatar && { avatar: seat.avatar }),
              },
            ]
          : [],
      ),
    },
    locale: 'vi',
    settings,
    match: match?.view ?? null,
  };
}
