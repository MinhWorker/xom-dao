import { IconDots, IconSettings, IconUsers } from '@tabler/icons-react';
import { type FormEvent, useState } from 'react';
import { GAMES, gameById, type HubGame } from '../../games.js';
import { Button, Dialog, Icon, Loop, Menu, TextField } from '../../kit/index.js';
import { hub, useHub } from '../../net/hub.js';
import { navigate } from '../../router.js';
import { prefersReducedMotion, useGraphics } from '../../settings/graphics.js';
import { SoundToggle } from '../../sound/SoundToggle.js';
import { FriendsSheet } from '../friends/FriendsSheet.js';
import { lastCardId } from '../sea/SeaChart.js';
import { SettingsOverlay } from '../settings/SettingsOverlay.js';
import styles from './Lobby.module.css';
import { focusPosition } from './summary.js';

/** The loop plays only when the player allows it and has not asked for less motion or less data. */
function canPlayLoop(allowed: boolean) {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return allowed && !prefersReducedMotion() && !connection?.saveData;
}

/** The selected Game's art fills the screen; its loop, if any, fades in over it once playing. */
function Backdrop({ game }: { game: HubGame }) {
  const [playing, setPlaying] = useState(false);
  const position = focusPosition(game.manifest);
  const { loopVideo } = useGraphics();
  return (
    <div className={styles.backdrop} aria-hidden="true">
      <img src={game.art.lobby} alt="" style={{ objectPosition: position }} />
      {game.art.loop && canPlayLoop(loopVideo) && (
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
  const requests = useHub((s) => s.friends.filter((f) => f.state === 'incoming').length);
  const [joinOpen, setJoinOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const game = gameById(lastCardId()) ?? GAMES[0];

  function join(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get('code') ?? '').replace(/\s/g, '');
    if (!code) return;
    setJoinOpen(false);
    navigate(`/room/${code.toUpperCase()}`);
  }

  return (
    <main className={styles.lobby}>
      {game && <Backdrop key={game.manifest.id} game={game} />}

      <header className={styles.top}>
        <button
          type="button"
          className={styles.profile}
          aria-label={`Hồ sơ ${user?.name ?? ''}`}
          onClick={() => navigate('/profile')}
        >
          <span className={styles.initial} aria-hidden="true">
            {user?.name.slice(0, 1).toUpperCase()}
          </span>
          {user?.name}
        </button>
        <span className={styles.tools}>
          <button
            type="button"
            className={`${styles.tool} ${styles.friends} glass`}
            aria-label={requests > 0 ? `Bạn bè, ${requests} lời mời` : 'Bạn bè'}
            onClick={() => setFriendsOpen(true)}
          >
            <Loop kind="bob" active={requests > 0}>
              <Icon icon={IconUsers} />
            </Loop>
            {requests > 0 && <span className={styles.badge}>{requests}</span>}
          </button>
          <SoundToggle />
          <button
            type="button"
            className={`${styles.tool} glass`}
            aria-label="Cài đặt"
            onClick={() => setSettingsOpen(true)}
          >
            <Icon icon={IconSettings} />
          </button>
          <Menu
            label="Menu"
            trigger={<Icon icon={IconDots} />}
            items={[{ label: 'Đăng xuất', danger: true, onSelect: () => hub.logout() }]}
          />
        </span>
      </header>

      <section className={styles.hero}>
        {closed && (
          <p className={styles.error} role="alert">
            {closed}
          </p>
        )}
      </section>

      <footer className={styles.dock}>
        <div className={styles.actions}>
          <Button onClick={() => setJoinOpen(true)}>Vào phòng</Button>
          <Button variant="primary" forward onClick={() => navigate('/sea')}>
            Ra khơi
          </Button>
        </div>
      </footer>

      <FriendsSheet open={friendsOpen} onClose={() => setFriendsOpen(false)} />
      <SettingsOverlay open={settingsOpen} onClose={() => setSettingsOpen(false)} />

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
