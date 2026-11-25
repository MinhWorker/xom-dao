import { IconArrowLeft, IconCopy, IconPencil } from '@tabler/icons-react';
import type { MatchRecord, PlayerStats } from '@xomdao/shared/client';
import { useEffect, useState } from 'react';
import { gameById } from '../../games.js';
import { Button, Chip, CutPanel, toast } from '../../kit/index.js';
import { hub, useHub } from '../../net/hub.js';
import { navigate } from '../../router.js';
import { playSound } from '../../sound/index.js';
import { avatarSrc, frameSrc } from '../harbour/portrait.js';
import screen from '../Screen.module.css';
import { AvatarPicker } from './AvatarPicker.js';
import { ago, boardLabel, boardUnit, levelProgress, OUTCOME_LABEL, winPercent } from './format.js';
import styles from './Profile.module.css';

const gameName = (id: string) => gameById(id)?.manifest.name ?? id;

function Tile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className={styles.tile}>
      <span className={styles.value}>{value}</span>
      <span className={styles.caption}>{label}</span>
    </div>
  );
}

function Level({ stats }: { stats: PlayerStats }) {
  return (
    <CutPanel label="Cấp độ" className={styles.level}>
      <div className={styles.levelTop}>
        <span className={styles.levelNumber}>{stats.level}</span>
        <span className={styles.xp}>
          <span className={styles.value}>{stats.xp}</span>
          <span className={styles.caption}>Kinh nghiệm</span>
        </span>
        <span className={styles.xp}>
          <span className={styles.value}>{stats.nextXp}</span>
          <span className={styles.caption}>Cấp kế tiếp</span>
        </span>
      </div>
      <progress
        className={styles.bar}
        max={1}
        value={levelProgress(stats)}
        aria-label="Kinh nghiệm trong cấp"
      />
    </CutPanel>
  );
}

function Ranks({ stats }: { stats: PlayerStats }) {
  if (stats.ranks.length === 0) return null;
  return (
    <CutPanel label="Xếp hạng">
      <ul className={styles.ranks}>
        {stats.ranks.map((rank) => (
          <li key={rank.board}>
            <span className={styles.board}>{boardLabel(rank.board, gameName(rank.board))}</span>
            <span className={styles.rankValue}>{rank.value}</span>
            <span className={styles.caption}>{boardUnit(rank.board)}</span>
            <span className={styles.rank}>#{rank.rank}</span>
          </li>
        ))}
      </ul>
    </CutPanel>
  );
}

function History({ matches }: { matches: MatchRecord[] }) {
  if (matches.length === 0) return <p className={styles.empty}>Chưa có ván nào.</p>;
  const now = Date.now();
  return (
    <ul className={styles.matches}>
      {matches.map((match) => (
        <li key={match.id} className={`${styles.match} ${styles[match.outcome]}`}>
          <span className={styles.matchGame}>{gameName(match.gameId)}</span>
          <Chip tone={match.outcome === 'win' ? 'accent' : undefined}>
            {OUTCOME_LABEL[match.outcome]}
          </Chip>
          <span className={styles.caption}>{ago(match.endedAt, now)}</span>
          <ol className={styles.seats} aria-label="Hạng từng người">
            {match.players.map((p, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: seats are positions
              <li key={i} className={p.me ? styles.me : undefined}>
                <span className={styles.place}>{p.place ?? '-'}</span>
                {p.bot ? 'Máy' : p.name}
              </li>
            ))}
          </ol>
        </li>
      ))}
    </ul>
  );
}

/** Your profile (`/profile`) with your recent games, or a friend's (`/profile/<id>`) with their level and ranks. */
export function Profile({ userId }: { userId?: string }) {
  const me = useHub((s) => s.user);
  const friends = useHub((s) => s.friends);
  const own = !userId || userId === me?.id;
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [matches, setMatches] = useState<MatchRecord[] | null>(null);
  const [error, setError] = useState('');
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    let live = true;
    const fail = (err: unknown) =>
      live && setError(err instanceof Error ? err.message : 'Máy chủ gặp lỗi');
    setError('');
    hub
      .request('stats:get', own ? {} : { userId })
      .then((reply) => live && setStats(reply))
      .catch(fail);
    if (own) {
      hub
        .request('history:recent', {})
        .then((reply) => live && setMatches(reply.matches))
        .catch(fail);
    }
    return () => {
      live = false;
    };
  }, [own, userId]);

  const other = own ? undefined : friends.find((f) => f.id === userId);
  const name = own ? (me?.name ?? '') : (other?.name ?? 'Người chơi');
  const handle = own ? me?.username : other?.username;
  const avatar = own ? me?.avatar : other?.avatar;
  const frame = own ? me?.frame : other?.frame;

  const copyHandle = async () => {
    if (!handle) return;
    try {
      await navigator.clipboard.writeText(handle);
      toast('Đã chép tên đăng nhập', 'success');
    } catch {
      toast(`@${handle}`);
    }
  };

  return (
    <main className={styles.profile}>
      <header className={styles.top}>
        <Button variant="ghost" sound="close" className={styles.back} onClick={() => navigate('/')}>
          <IconArrowLeft stroke={2} aria-hidden />
          Về Bến
        </Button>
        <h1 className={styles.heading}>Hồ sơ</h1>
      </header>

      <div className={`${styles.columns} ${own ? '' : styles.single}`}>
        <section className={styles.side} aria-label="Thống kê">
          <div className={styles.identity}>
            {own ? (
              <button
                type="button"
                className={`${styles.portrait} ${styles.editable}`}
                aria-label="Đổi ảnh đại diện"
                title="Đổi ảnh đại diện"
                onClick={() => {
                  playSound('click');
                  setPicking(true);
                }}
              >
                <img src={avatarSrc(avatar ?? '')} alt="" draggable={false} />
                <img src={frameSrc(frame ?? '')} alt="" draggable={false} />
                <span className={styles.edit} aria-hidden="true">
                  <IconPencil stroke={2} />
                </span>
              </button>
            ) : (
              <span className={styles.portrait} aria-hidden="true">
                <img src={avatarSrc(avatar ?? '')} alt="" draggable={false} />
                <img src={frameSrc(frame ?? '')} alt="" draggable={false} />
              </span>
            )}
            <span className={styles.who}>
              <span className={styles.name}>{name}</span>
              {handle && (
                <span className={styles.handleRow}>
                  <span className={styles.handle}>@{handle}</span>
                  <Button
                    variant="ghost"
                    className={styles.copy}
                    aria-label="Chép tên đăng nhập"
                    title="Chép tên đăng nhập"
                    onClick={() => void copyHandle()}
                  >
                    <IconCopy stroke={2} aria-hidden />
                  </Button>
                </span>
              )}
            </span>
          </div>
          {error && (
            <p className={screen.error} role="alert">
              {error}
            </p>
          )}
          {stats ? (
            <>
              <Level stats={stats} />
              <div className={styles.tiles}>
                <Tile label="Số ván" value={stats.played} />
                <Tile label="Thắng" value={stats.won} />
                <Tile label="% thắng" value={`${winPercent(stats)}%`} />
              </div>
              <Ranks stats={stats} />
            </>
          ) : (
            !error && <p className={screen.dim}>Đang tải…</p>
          )}
        </section>

        {own && (
          <section className={styles.history} aria-label="Ván gần đây">
            <h2 className={styles.sectionTitle}>Ván gần đây</h2>
            {matches ? (
              <History matches={matches} />
            ) : (
              !error && <p className={screen.dim}>Đang tải…</p>
            )}
          </section>
        )}
      </div>
      {own && <AvatarPicker open={picking} onClose={() => setPicking(false)} />}
    </main>
  );
}
