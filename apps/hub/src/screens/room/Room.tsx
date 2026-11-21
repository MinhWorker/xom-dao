import { IconArrowLeft, IconBook2, IconMenu2 } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import { gameById } from '../../games.js';
import { Button, Dialog, Menu, toast } from '../../kit/index.js';
import { hub, useHub } from '../../net/hub.js';
import { navigate, router } from '../../router.js';
import { SoundToggle } from '../../sound/SoundToggle.js';
import { focusPosition } from '../lobby/summary.js';
import { RulesPager } from '../rules/RulesPager.js';
import screen from '../Screen.module.css';
import { GameFrame } from './GameFrame.js';
import { PlayerSlot } from './PlayerSlot.js';
import { Results } from './Results.js';
import styles from './Room.module.css';
import { RoomOptions } from './RoomOptions.js';

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
  const [rulesOpen, setRulesOpen] = useState(false);

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
  const seated = here.seats.filter(Boolean).length;
  const me = here.seats.find((s) => s?.id === user.id);
  const canBot = isHost && game?.manifest.bots === true;
  const minPlayers = game?.manifest.minPlayers ?? 1;

  const invite = async () => {
    try {
      await navigator.clipboard.writeText(`${location.origin}/room/${here.code}`);
      toast('Đã chép liên kết phòng');
    } catch {
      toast(`Mã phòng ${here.code}`);
    }
  };

  return (
    <main className={styles.room}>
      {game && (
        <div className={styles.backdrop} aria-hidden="true">
          <img
            src={game.art.lobby}
            alt=""
            style={{ objectPosition: focusPosition(game.manifest) }}
          />
        </div>
      )}

      <header className={styles.top}>
        <Button
          variant="ghost"
          className={styles.back}
          onClick={() => void leave()}
          disabled={busy}
        >
          <IconArrowLeft stroke={2} aria-hidden />
          Rời phòng
        </Button>
        <h1 className={styles.code}>
          <span className={styles.codeLabel}>Phòng /</span> {here.code}
        </h1>
        <span className={styles.game}>{name}</span>
        {game && game.rules.length > 0 && (
          <Button variant="ghost" className={styles.rules} onClick={() => setRulesOpen(true)}>
            <IconBook2 stroke={2} aria-hidden />
            Luật chơi
          </Button>
        )}
        <SoundToggle />
      </header>

      <ol className={styles.slots} aria-label="Người chơi">
        {here.seats.map((seat, i) => (
          <PlayerSlot
            // biome-ignore lint/suspicious/noArrayIndexKey: seats are positions
            key={i}
            member={seat}
            isHost={seat?.id === here.hostId}
            isMe={seat?.id === user.id}
            canRemove={isHost}
            canAddBot={canBot}
            busy={busy}
            onInvite={() => void invite()}
            onAddBot={() => void run(() => hub.request('room:add-bot', {}))}
            onRemove={() => void run(() => hub.request('room:remove-bot', { seat: i }))}
          />
        ))}
      </ol>

      <aside className={styles.side}>
        {error && (
          <p className={screen.error} role="alert">
            {error}
          </p>
        )}
        {game && (
          <RoomOptions
            manifest={game.manifest}
            picks={here.options}
            editable={isHost && !busy}
            onChange={(options) => void run(() => hub.request('room:options', { options }))}
          />
        )}
        {isHost ? (
          <Button
            variant="primary"
            className={styles.start}
            disabled={busy || !game || seated < minPlayers}
            onClick={() => void start()}
          >
            Bắt đầu
            <span className={styles.count}>
              {seated}/{here.seats.length}
            </span>
          </Button>
        ) : (
          <Button
            variant="primary"
            className={styles.start}
            disabled={busy}
            onClick={() => void run(() => hub.request('room:ready', { ready: !me?.ready }))}
          >
            {me?.ready ? 'Huỷ sẵn sàng' : 'Sẵn sàng'}
          </Button>
        )}
      </aside>

      {frameOpen && game && (
        <div className={styles.play}>
          <GameFrame gameId={game.manifest.id} gameName={name} onDone={setDoneFor} />
          <div className={styles.corner}>
            <SoundToggle />
            <Menu
              label="Menu ván"
              trigger={<IconMenu2 stroke={2} aria-hidden />}
              items={[
                ...(game.rules.length > 0
                  ? [{ label: 'Luật chơi', onSelect: () => setRulesOpen(true) }]
                  : []),
                {
                  label: playing ? 'Rời ván' : 'Về phòng chờ',
                  danger: playing,
                  onSelect: () => (playing ? setLeaving(true) : setFrameOpen(false)),
                },
              ]}
            />
          </div>
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

      {rulesOpen && game && <RulesPager game={game} onClose={() => setRulesOpen(false)} />}

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
