import { IconX } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import { gameById } from '../../games.js';
import { Button, Chip, CutPanel, Dialog } from '../../kit/index.js';
import { hub, useHub } from '../../net/hub.js';
import { navigate, router } from '../../router.js';
import screen from '../Screen.module.css';
import { GameFrame } from './GameFrame.js';
import { Results } from './Results.js';
import styles from './Room.module.css';

/** How long the Hub waits for the Game's `done` before showing the results anyway. */
const DONE_FALLBACK_MS = 4000;

export function Room({ code }: { code: string }) {
  const phase = useHub((s) => s.phase);
  const user = useHub((s) => s.user);
  const room = useHub((s) => s.room);
  const match = useHub((s) => s.match);
  const notice = useHub((s) => s.result);
  const closed = useHub((s) => s.closed);
  const [joinError, setJoinError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [frameOpen, setFrameOpen] = useState(false);
  const [doneFor, setDoneFor] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const here = room?.code === code ? room : null;
  const game = here ? gameById(here.gameId) : undefined;
  const playing = here?.status === 'playing';

  const triedJoin = useRef(false);
  useEffect(() => {
    if (here) triedJoin.current = true;
    if (phase !== 'online' || here || triedJoin.current) return;
    triedJoin.current = true;
    hub.request('room:join', { roomCode: code }).catch((err: Error) => setJoinError(err.message));
  }, [phase, here, code]);

  useEffect(() => {
    if (closed) navigate('/', { replace: true, force: true });
  }, [closed]);

  useEffect(() => {
    if (playing) setFrameOpen(true);
  }, [playing]);

  useEffect(() => {
    if (!playing) return;
    const unblock = router?.block();
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    addEventListener('beforeunload', onUnload);
    return () => {
      unblock?.();
      removeEventListener('beforeunload', onUnload);
    };
  }, [playing]);

  const over = match?.status === 'over' ? match : null;
  const [fallback, setFallback] = useState<string | null>(null);
  useEffect(() => {
    if (!over) return;
    const timer = setTimeout(() => setFallback(over.matchId), DONE_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [over]);
  const showResults =
    frameOpen && over !== null && (doneFor === over.matchId || fallback === over.matchId);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Máy chủ gặp lỗi');
    } finally {
      setBusy(false);
    }
  }

  const leave = () =>
    run(async () => {
      await hub.leaveRoom();
      navigate('/', { force: true });
    });

  const start = () => run(() => hub.request('match:start', { version: game?.version ?? '' }));

  if (joinError) {
    return (
      <main className={screen.center}>
        <p className={screen.error}>{joinError}</p>
        <Button onClick={() => navigate('/', { replace: true })}>Về sảnh</Button>
      </main>
    );
  }
  if (!here || !user) {
    return (
      <main className={screen.center}>
        <p className={screen.dim}>Đang vào phòng {code}…</p>
      </main>
    );
  }

  const name = game?.manifest.name ?? here.gameId;
  const isHost = here.hostId === user.id;
  const me = here.seats.find((s) => s?.id === user.id);
  const seated = here.seats.filter(Boolean).length;
  const canBot = isHost && game?.manifest.bots && seated < here.seats.length;

  return (
    <main className={screen.screen}>
      <header className={screen.bar}>
        <div>
          <span className={screen.dim}>{name}</span>
          <h1 className={styles.code}>
            <span className={screen.dim}>Phòng </span>
            {here.code}
          </h1>
        </div>
        <Button variant="ghost" onClick={() => void leave()} disabled={busy}>
          Rời phòng
        </Button>
      </header>

      {error && (
        <p className={screen.error} role="alert">
          {error}
        </p>
      )}

      <CutPanel label="Người chơi">
        <ol className={styles.seats}>
          {here.seats.map((seat, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: seats are positions
            <li key={i} className={styles.seat}>
              {seat ? (
                <>
                  <span>{seat.name}</span>
                  {seat.id === here.hostId && <Chip tone="accent">Chủ phòng</Chip>}
                  {seat.bot && <Chip>Máy</Chip>}
                  {seat.ready && <Chip tone="ready">Sẵn sàng</Chip>}
                  {!seat.connected && <Chip tone="danger">Mất kết nối</Chip>}
                  {seat.bot && isHost && (
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => void run(() => hub.request('room:remove-bot', { seat: i }))}
                    >
                      Bỏ
                    </Button>
                  )}
                </>
              ) : (
                <span className={screen.dim}>Ghế trống</span>
              )}
            </li>
          ))}
        </ol>
      </CutPanel>

      <div className={styles.actions}>
        {canBot && (
          <Button disabled={busy} onClick={() => void run(() => hub.request('room:add-bot', {}))}>
            Thêm máy
          </Button>
        )}
        {isHost ? (
          <Button
            variant="primary"
            disabled={busy || !game || seated < (game?.manifest.minPlayers ?? 1)}
            onClick={() => void start()}
          >
            Bắt đầu
          </Button>
        ) : (
          <Button
            variant="primary"
            disabled={busy}
            onClick={() => void run(() => hub.request('room:ready', { ready: !me?.ready }))}
          >
            {me?.ready ? 'Huỷ sẵn sàng' : 'Sẵn sàng'}
          </Button>
        )}
      </div>

      {frameOpen && game && (
        <div className={styles.play}>
          <GameFrame gameId={game.manifest.id} gameName={name} onDone={setDoneFor} />
          <button
            type="button"
            className={styles.corner}
            aria-label="Rời ván"
            onClick={() => (playing ? setLeaving(true) : setFrameOpen(false))}
          >
            <IconX stroke={2} aria-hidden />
          </button>
          {showResults && (
            <Results
              room={here}
              result={
                over?.outcome === 'settled'
                  ? (over.result?.seats ?? (notice?.matchId === over.matchId ? notice.seats : null))
                  : null
              }
              me={user.id}
              busy={busy}
              onReplay={() => void start()}
              onBack={() => setFrameOpen(false)}
            />
          )}
        </div>
      )}

      <Dialog
        open={leaving}
        onClose={() => setLeaving(false)}
        title="Rời ván?"
        actions={
          <>
            <Button onClick={() => setLeaving(false)}>Ở lại</Button>
            <Button
              variant="primary"
              onClick={() => {
                setLeaving(false);
                void leave();
              }}
            >
              Rời
            </Button>
          </>
        }
      >
        <p>Bạn sẽ bị tính hạng chót.</p>
      </Dialog>
    </main>
  );
}
