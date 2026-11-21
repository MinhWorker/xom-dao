import { IconDots } from '@tabler/icons-react';
import { type FormEvent, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { GAMES, type HubGame } from '../../games.js';
import { Button, Chip, Dialog, Icon, Menu, TextField } from '../../kit/index.js';
import { hub, useHub } from '../../net/hub.js';
import { navigate } from '../../router.js';
import { SoundToggle } from '../../sound/SoundToggle.js';
import { GameStrip } from './GameStrip.js';
import styles from './Lobby.module.css';
import { durationLabel, focusPosition, playersLabel } from './summary.js';

/** The Game picked last, so coming back from a Room shows it again. */
let lastPicked = '';

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The loop plays only when the player has not asked for less motion or less data. */
function canPlayLoop() {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return !reducedMotion() && !connection?.saveData;
}

/** The selected Game's art fills the screen; its loop, if any, fades in over it once playing. */
function Backdrop({ game }: { game: HubGame }) {
  const [playing, setPlaying] = useState(false);
  const position = focusPosition(game.manifest);
  return (
    <div className={styles.backdrop} aria-hidden="true">
      <img src={game.art.lobby} alt="" style={{ objectPosition: position }} />
      {game.art.loop && canPlayLoop() && (
        <video
          key={game.manifest.id}
          className={playing ? styles.playing : undefined}
          src={game.art.loop}
          style={{ objectPosition: position }}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          onPlaying={() => setPlaying(true)}
        />
      )}
    </div>
  );
}

export function Lobby() {
  const user = useHub((s) => s.user);
  const closed = useHub((s) => s.closed);
  const [running, setRunning] = useState<string[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [pickedId, setPickedId] = useState(lastPicked);

  useEffect(() => {
    void hub.gameIds().then(setRunning);
  }, []);

  const game = GAMES.find((g) => g.manifest.id === pickedId) ?? GAMES[0];
  const closedIds = running
    ? GAMES.filter((g) => !running.includes(g.manifest.id)).map((g) => g.manifest.id)
    : [];

  function pick(id: string) {
    lastPicked = id;
    setError('');
    const apply = () => flushSync(() => setPickedId(id));
    if (document.startViewTransition && !reducedMotion()) {
      document.startViewTransition(apply).ready.catch(() => {});
    } else apply();
  }

  async function create(target: HubGame) {
    setBusy(true);
    setError('');
    try {
      const { roomCode } = await hub.request('room:create', {
        gameId: target.manifest.id,
        version: target.version,
      });
      navigate(`/room/${roomCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Máy chủ gặp lỗi');
    } finally {
      setBusy(false);
    }
  }

  function join(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get('code') ?? '').replace(/\s/g, '');
    if (!code) return;
    setJoinOpen(false);
    navigate(`/room/${code.toUpperCase()}`);
  }

  const message = error || closed;
  const index = game ? GAMES.indexOf(game) + 1 : 0;
  const off = game ? closedIds.includes(game.manifest.id) : false;

  return (
    <main className={styles.lobby}>
      {game && <Backdrop key={game.manifest.id} game={game} />}

      <header className={styles.top}>
        <span className={styles.profile}>
          <span className={styles.initial} aria-hidden="true">
            {user?.name.slice(0, 1).toUpperCase()}
          </span>
          {user?.name}
        </span>
        <span className={styles.tools}>
          <SoundToggle />
          <Menu
            label="Menu"
            trigger={<Icon icon={IconDots} />}
            items={[{ label: 'Đăng xuất', danger: true, onSelect: () => hub.logout() }]}
          />
        </span>
      </header>

      {game ? (
        <section className={styles.hero} aria-labelledby="lobby-title">
          <span className={styles.code}>
            Trò {String(index).padStart(2, '0')} / {String(GAMES.length).padStart(2, '0')}
          </span>
          <h1 id="lobby-title" className={styles.title}>
            {game.manifest.name}
          </h1>
          <p className={styles.tagline}>{game.manifest.tagline}</p>
          <div className={styles.chips}>
            <Chip>{playersLabel(game.manifest)}</Chip>
            <Chip>{durationLabel(game.manifest)}</Chip>
            {game.manifest.bots && <Chip>Có máy</Chip>}
            {game.manifest.status === 'wip' && <Chip tone="accent">Đang làm</Chip>}
            {off && <Chip tone="danger">Tạm đóng</Chip>}
          </div>
          {message && (
            <p className={styles.error} role="alert">
              {message}
            </p>
          )}
        </section>
      ) : (
        <p className={styles.empty}>Chưa có trò nào.</p>
      )}

      {game && (
        <footer className={styles.dock}>
          <GameStrip
            games={GAMES}
            selectedId={game.manifest.id}
            closedIds={closedIds}
            onSelect={pick}
          />
          <div className={styles.actions}>
            <Button onClick={() => setJoinOpen(true)}>Vào phòng</Button>
            <Button variant="primary" disabled={busy || off} onClick={() => void create(game)}>
              Tạo phòng
            </Button>
          </div>
        </footer>
      )}

      <Dialog
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        title="Vào phòng"
        actions={
          <>
            <Button variant="ghost" onClick={() => setJoinOpen(false)}>
              Huỷ
            </Button>
            <Button variant="primary" type="submit" form="join-room">
              Vào
            </Button>
          </>
        }
      >
        <form id="join-room" className={styles.join} onSubmit={join}>
          <TextField
            label="Mã phòng"
            name="code"
            className={styles.codeField}
            maxLength={4}
            autoComplete="off"
            autoCapitalize="characters"
            required
          />
        </form>
      </Dialog>
    </main>
  );
}
