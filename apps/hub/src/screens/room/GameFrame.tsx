import {
  BRIDGE_UNAVAILABLE,
  type BridgeInit,
  createGameHost,
  type GameHost,
  windowPort,
} from '@xomdao/bridge';
import { useEffect, useRef, useState } from 'react';
import { hub, useHub } from '../../net/hub.js';
import { OFFLINE } from '../../net/store.js';
import styles from './Room.module.css';

const SETTINGS = { volume: 1, muted: false };

/** What `init` tells the Game, from the store as it is now. */
function currentInit(): BridgeInit | null {
  const { user, room, match } = hub.getState();
  if (!user || !room) return null;
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
    settings: SETTINGS,
    match: match?.view ?? null,
  };
}

/** Forwards a Game's `send` as `match:move`; the server's refusal goes back to the Game. */
async function forward(event: string, data: unknown) {
  const match = hub.getState().match;
  if (!match) return { ok: false as const, error: 'Ván không còn nữa' };
  try {
    await hub.request('match:move', { matchId: match.matchId, event, payload: data });
    return { ok: true as const };
  } catch (err) {
    const message = err instanceof Error ? err.message : BRIDGE_UNAVAILABLE;
    if (message === OFFLINE) throw err;
    return { ok: false as const, error: message };
  }
}

/** Tells the server the Game is loaded for the current Match, once per Match. */
function reportReady(reported: { current: string | null }) {
  const current = hub.getState().match;
  if (!current || current.status === 'over' || reported.current === current.matchId) return;
  reported.current = current.matchId;
  hub.request('match:ready', { matchId: current.matchId }).catch(() => {
    reported.current = null;
  });
}

export interface GameFrameProps {
  gameId: string;
  gameName: string;
  /** The Game's end-of-match animation is over for this Match. */
  onDone(matchId: string): void;
}

/**
 * The Game's iframe and the Hub's side of its Bridge. It answers each `ready` with `init`,
 * reports `match:ready` once per Match, passes every `match:state` on as a `message`, and sends
 * a fresh `init` after a reconnect or when the next Match starts in the same iframe.
 */
export function GameFrame({ gameId, gameName, onDone }: GameFrameProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const host = useRef<GameHost | null>(null);
  const reported = useRef<string | null>(null);
  /** The Match and connection the Game last got an `init` for. */
  const initedFor = useRef('');
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [refused, setRefused] = useState(false);
  const match = useHub((s) => s.match);
  const connection = useHub((s) => s.connection);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const initKey = () => {
    const { match: m, connection: c } = hub.getState();
    return `${m?.matchId ?? ''}:${c}`;
  };
  const sendInit = (game: GameHost) => {
    const init = currentInit();
    if (!init) return;
    initedFor.current = initKey();
    game.init(init);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: the Bridge lives as long as the iframe
  useEffect(() => {
    const target = frame.current?.contentWindow;
    if (!target) return;
    const game = createGameHost({
      port: windowPort(target),
      send: forward,
      onReady() {
        setReady(true);
        sendInit(game);
        reportReady(reported);
      },
      onProgress: setProgress,
      onDone() {
        const current = hub.getState().match;
        if (current) onDoneRef.current(current.matchId);
      },
      onMismatch: () => setRefused(true),
    });
    host.current = game;
    const onVisibility = () => game.visibility(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      game.close();
      host.current = null;
    };
  }, []);

  const matchId = match?.matchId;
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new Match or connection needs a new init
  useEffect(() => {
    if (!ready || !host.current || initedFor.current === initKey()) return;
    sendInit(host.current);
    reportReady(reported);
  }, [ready, matchId, connection]);

  useEffect(() => {
    if (ready && match) host.current?.message('match:state', match);
  }, [ready, match]);

  return (
    <div className={styles.stage}>
      <iframe
        ref={frame}
        className={styles.frame}
        src={`/games/${gameId}/`}
        title={gameName}
        allow="autoplay; fullscreen"
      />
      {!ready && (
        <div className={styles.loading}>
          <h2>{gameName}</h2>
          {refused ? (
            <p>Trò này cần bản Hub mới, hãy tải lại trang</p>
          ) : (
            <progress max={1} value={progress || undefined} aria-label="Đang tải" />
          )}
        </div>
      )}
    </div>
  );
}
