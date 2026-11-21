import { type FormEvent, useEffect, useState } from 'react';
import { GAMES, type HubGame } from '../../games.js';
import { Button, Chip, CutPanel, TextField } from '../../kit/index.js';
import { hub, useHub } from '../../net/hub.js';
import { navigate } from '../../router.js';
import screen from '../Screen.module.css';
import styles from './Lobby.module.css';

export function Lobby() {
  const user = useHub((s) => s.user);
  const closed = useHub((s) => s.closed);
  const [running, setRunning] = useState<string[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void hub.gameIds().then(setRunning);
  }, []);

  async function create(game: HubGame) {
    setBusy(true);
    setError('');
    try {
      const { roomCode } = await hub.request('room:create', {
        gameId: game.manifest.id,
        version: game.version,
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
    if (code) navigate(`/room/${code.toUpperCase()}`);
  }

  return (
    <main className={screen.screen}>
      <header className={screen.bar}>
        <h1 className={screen.brand}>Xóm Đảo</h1>
        <div className={screen.bar}>
          <span className={screen.dim}>{user?.name}</span>
          <Button variant="ghost" onClick={() => hub.logout()}>
            Đăng xuất
          </Button>
        </div>
      </header>

      {(error || closed) && (
        <p className={screen.error} role="alert">
          {error || closed}
        </p>
      )}

      <CutPanel>
        <form className={styles.join} onSubmit={join}>
          <TextField
            label="Mã phòng"
            name="code"
            className={styles.code}
            maxLength={4}
            autoComplete="off"
            autoCapitalize="characters"
            required
          />
          <Button type="submit">Vào</Button>
        </form>
      </CutPanel>

      <section>
        <h2>Tạo phòng</h2>
        {GAMES.length === 0 && <p className={screen.dim}>Chưa có trò nào.</p>}
        <ul className={styles.games}>
          {GAMES.map((game) => {
            const { manifest } = game;
            const off = running !== null && !running.includes(manifest.id);
            const players =
              manifest.minPlayers === manifest.maxPlayers
                ? `${manifest.minPlayers} người`
                : `${manifest.minPlayers}–${manifest.maxPlayers} người`;
            return (
              <li key={manifest.id}>
                <button
                  type="button"
                  className={`${styles.card} cut-br`}
                  disabled={busy || off}
                  onClick={() => void create(game)}
                >
                  <span className={styles.name}>{manifest.name}</span>
                  <span className={screen.dim}>{manifest.tagline}</span>
                  <span className={styles.meta}>
                    <Chip>{players}</Chip>
                    <Chip>
                      {manifest.duration.min}–{manifest.duration.max} phút
                    </Chip>
                    {manifest.status === 'wip' && <Chip tone="accent">Đang làm</Chip>}
                    {off && <Chip tone="danger">Tạm đóng</Chip>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
