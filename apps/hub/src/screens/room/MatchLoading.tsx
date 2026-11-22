import type { RoomMember } from '@xomdao/shared/client';
import type { ReactNode } from 'react';
import styles from './MatchLoading.module.css';

export interface LoadingSeat {
  id: string;
  name: string;
  /** 0 to 1. */
  load: number;
  away: boolean;
}

/** Each seated player's load: theirs from the Bridge's progress, the others' from the server. */
export function loadingSeats(
  seats: (RoomMember | null)[],
  meId: string,
  progress: number,
  readyIds: readonly string[],
  disconnectedIds: readonly string[],
): LoadingSeat[] {
  return seats.flatMap((seat) => {
    if (!seat) return [];
    const done = seat.bot === true || readyIds.includes(seat.id);
    const load = done ? 1 : seat.id === meId ? Math.min(progress, 0.99) : 0;
    const away = !done && (!seat.connected || disconnectedIds.includes(seat.id));
    return [{ id: seat.id, name: seat.name, load, away }];
  });
}

function statusOf(seat: LoadingSeat, isMe: boolean) {
  if (seat.load >= 1) return 'Xong';
  if (seat.away) return 'Mất kết nối';
  return isMe ? `${Math.round(seat.load * 100)}%` : 'Đang tải';
}

/** A stand-in for the Game's Emblem until the real ones exist: its initial on the diamond plate. */
function Emblem({ name }: { name: string }) {
  return (
    <div className={styles.emblem} aria-hidden="true">
      <span className={styles.ring} data-loop />
      <span className={styles.plate}>
        <span className={styles.initial}>{name.charAt(0)}</span>
      </span>
    </div>
  );
}

export interface MatchLoadingProps {
  gameName: string;
  seats: LoadingSeat[];
  meId: string;
  /** Fading out: the Match has started. */
  leaving: boolean;
  /** Shown in place of the bar and the players. */
  children?: ReactNode;
}

/** The screen over the Game until the Match starts: the Game's Emblem, a bar and each player's load. */
export function MatchLoading({ gameName, seats, meId, leaving, children }: MatchLoadingProps) {
  const total = seats.length ? seats.reduce((sum, s) => sum + s.load, 0) / seats.length : 0;
  const percent = Math.floor(total * 100);
  return (
    <div className={styles.loading} data-leaving={leaving || undefined} role="status">
      <span className={styles.stripes} data-loop aria-hidden="true" />
      <Emblem name={gameName} />
      <div className={styles.info}>
        <span className={styles.kicker}>Đang tải ván</span>
        <h2 className={styles.title}>{gameName}</h2>
        {children ?? (
          <>
            <progress className={styles.bar} max={100} value={percent} aria-label="Đang tải" />
            <span className={styles.percent}>{percent}%</span>
            <ul className={styles.players}>
              {seats.map((seat) => (
                <li key={seat.id}>
                  <span className={styles.name}>{seat.name}</span>
                  <span
                    className={seat.load >= 1 ? styles.ready : seat.away ? styles.away : styles.dim}
                  >
                    {statusOf(seat, seat.id === meId)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
