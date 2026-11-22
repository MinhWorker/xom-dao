import type { MatchResultNotice, RoomState } from '@xomdao/shared/client';
import { useEffect, useRef } from 'react';
import { Button, Chip, CutPanel } from '../../kit/index.js';
import { playSound } from '../../sound/index.js';
import styles from './Results.module.css';

type Places = MatchResultNotice['seats'];

export type Outcome = 'win' | 'lose' | 'draw';

const VERDICT: Record<Outcome, string> = { win: 'Thắng', lose: 'Thua', draw: 'Hoà' };

/** Every seat shares first place. */
const isDraw = (seats: Places) => seats.length > 1 && seats.every((s) => s.place === 1);

/** How the Match went for `me`; `null` when they had no seat in it. */
export function outcomeFor(seats: Places, me: string): Outcome | null {
  const mine = seats.find((s) => s.player === me);
  if (!mine) return null;
  if (isDraw(seats)) return 'draw';
  return mine.place === 1 ? 'win' : 'lose';
}

export interface ResultsProps {
  room: RoomState;
  /** Everyone who sat in the Match, by id: those who left are no longer in `room`. */
  names: ReadonlyMap<string, string>;
  /** Each seat's place; `null` for an aborted Match. */
  result: Places | null;
  me: string;
  busy: boolean;
  /** Enough people are seated to play again. */
  canReplay: boolean;
  onReplay(): void;
  onBack(): void;
}

/** The end of a Match, over the Game: how it went, each seat's place, then play again or go back. */
export function Results({
  room,
  names,
  result,
  me,
  busy,
  canReplay,
  onReplay,
  onBack,
}: ResultsProps) {
  const seated = new Map(room.seats.flatMap((s) => (s ? [[s.id, s.name] as const] : [])));
  const seats = [...(result ?? [])].sort((a, b) => a.place - b.place);
  const host = room.hostId === me;
  const outcome = result ? outcomeFor(seats, me) : null;
  const draw = isDraw(seats);
  const played = useRef(false);

  useEffect(() => {
    if (played.current || !outcome || outcome === 'draw') return;
    played.current = true;
    playSound(outcome);
  }, [outcome]);

  return (
    <div className={styles.overlay} data-hud>
      <CutPanel label={result ? 'Kết quả' : 'Ván đã huỷ'} className={styles.panel}>
        {outcome && (
          <h2 className={styles.verdict} data-outcome={outcome}>
            {VERDICT[outcome]}
          </h2>
        )}
        {result ? (
          <ol className={styles.places}>
            {seats.map((seat) => (
              <li
                key={seat.player}
                className={seat.player === me ? styles.me : undefined}
                data-first={seat.place === 1 || undefined}
              >
                <span className={styles.place}>{seat.place}</span>
                <span className={styles.name}>
                  {seated.get(seat.player) ?? names.get(seat.player) ?? 'Người chơi'}
                </span>
                {!seated.has(seat.player) && <Chip>Đã rời</Chip>}
                {seat.score !== undefined && <Chip>{seat.score} điểm</Chip>}
                {seat.place === 1 && (
                  <Chip tone={draw ? undefined : 'accent'}>{draw ? 'Hoà' : 'Thắng'}</Chip>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className={styles.empty}>Ván không có kết quả.</p>
        )}
        <div className={styles.actions}>
          <Button onClick={onBack}>Về phòng chờ</Button>
          {host ? (
            <Button variant="primary" onClick={onReplay} disabled={busy || !canReplay}>
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
