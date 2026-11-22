import {
  type BridgeInit,
  bridgeInit,
  createGameHost,
  type GameHost,
  windowPort,
} from '@xomdao/bridge';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../kit/index.js';
import { hub, useHub } from '../../net/hub.js';
import { HubError } from '../../net/store.js';
import { sounds, useSoundState } from '../../sound/index.js';
import { loadingSeats, MatchLoading } from './MatchLoading.js';
import styles from './Room.module.css';

const LOADING_EXIT_MS = 260;

/** The Game follows the Hub's volume, mute, music and effects levels. */
const settings = () => {
  const { volume, muted, music, effects } = sounds.getState();
  return { volume, muted, music, effects };
};

/** The last `view` of each Match the Game was shown, as the Match ended without one. */
const lastViews = new Map<string, unknown>();

/**
 * What `init` tells the Game, from the store as it is now. A Match that is over keeps its last
 * view, so the Game redraws how it ended.
 */
function currentInit(): BridgeInit | null {
  const { user, room, match } = hub.getState();
  if (!user || !room) return null;
  const view = match && (match.view ?? lastViews.get(match.matchId));
  return bridgeInit({
    user,
    room,
    match: match && (view === undefined ? match : { ...match, view }),
    settings: settings(),
  });
}

/** Forwards a Game's `send` as `match:move`; the server's refusal goes back to the Game. */
async function forward(event: string, data: unknown) {
  const match = hub.getState().match;
  if (!match) return { ok: false as const, error: 'Ván không còn nữa' };
  try {
    await hub.request('match:move', { matchId: match.matchId, event, payload: data });
    return { ok: true as const };
  } catch (err) {
    if (!(err instanceof HubError) || err.offline) throw err;
    return { ok: false as const, error: err.message };
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
  const initedFor = useRef('');
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [refused, setRefused] = useState(false);
  const match = useHub((s) => s.match);
  const connection = useHub((s) => s.connection);
  const room = useHub((s) => s.room);
  const meId = useHub((s) => s.user?.id ?? '');
  const soundState = useSoundState();
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: `soundState` only says when to resend
  useEffect(() => {
    if (ready) host.current?.settings(settings());
  }, [ready, soundState]);

  useEffect(() => {
    if (match?.view !== undefined) {
      lastViews.clear();
      lastViews.set(match.matchId, match.view);
    }
    if (ready && match) host.current?.message('match:state', match);
  }, [ready, match]);

  const loading = refused || !ready || match?.status === 'loading';
  const [loadingShown, setLoadingShown] = useState(loading);
  useEffect(() => {
    if (loading) {
      setLoadingShown(true);
      return;
    }
    const timer = setTimeout(() => setLoadingShown(false), LOADING_EXIT_MS);
    return () => clearTimeout(timer);
  }, [loading]);

  const seats = loadingSeats(
    room?.seats ?? [],
    meId,
    ready ? 1 : progress,
    match?.readyPlayerIds ?? [],
    match?.disconnectedPlayerIds ?? [],
  );

  return (
    <div className={styles.stage}>
      <iframe
        ref={frame}
        className={styles.frame}
        src={`/games/${gameId}/`}
        title={gameName}
        allow="autoplay; fullscreen"
      />
      {loadingShown && (
        <MatchLoading gameName={gameName} seats={seats} meId={meId} leaving={!loading}>
          {refused ? (
            <>
              <p>Cần bản Hub mới</p>
              <Button variant="primary" onClick={() => location.reload()}>
                Tải lại
              </Button>
            </>
          ) : null}
        </MatchLoading>
      )}
    </div>
  );
}
