import type { MatchResultNotice, RoomState } from '@xomdao/shared/client';
import { Button, Chip, CutPanel } from '../../kit/index.js';
import styles from './Room.module.css';

type Places = MatchResultNotice['seats'];

export interface ResultsProps {
  room: RoomState;
  /** Each seat's place; `null` for an aborted Match. */
  result: Places | null;
  me: string;
  busy: boolean;
  onReplay(): void;
  onBack(): void;
}

/** The end of a Match, over the Game: each seat's place, then play again or go back. */
export function Results({ room, result, me, busy, onReplay, onBack }: ResultsProps) {
  const names = new Map(room.seats.flatMap((s) => (s ? [[s.id, s.name] as const] : [])));
  const seats = [...(result ?? [])].sort((a, b) => a.place - b.place);
  const host = room.hostId === me;

  return (
    <div className={styles.overlay}>
      <CutPanel label={result ? 'Kết quả' : 'Ván đã huỷ'} className={styles.results}>
        {result ? (
          <ol className={styles.places}>
            {seats.map((seat) => (
              <li key={seat.player} className={seat.player === me ? styles.me : undefined}>
                <span className={styles.place}>{seat.place}</span>
                <span>{names.get(seat.player) ?? 'Người chơi đã rời'}</span>
                {seat.score !== undefined && <Chip>{seat.score} điểm</Chip>}
                {seat.place === 1 && <Chip tone="accent">Thắng</Chip>}
              </li>
            ))}
          </ol>
        ) : (
          <p>Ván không có kết quả.</p>
        )}
        <div className={styles.actions}>
          <Button onClick={onBack}>Về phòng chờ</Button>
          {host ? (
            <Button variant="primary" onClick={onReplay} disabled={busy}>
              Chơi lại
            </Button>
          ) : (
            <span className={styles.wait}>Chờ chủ phòng</span>
          )}
        </div>
      </CutPanel>
    </div>
  );
}
