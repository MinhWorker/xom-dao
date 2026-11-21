import { IconRobot, IconX } from '@tabler/icons-react';
import type { RoomMember } from '@xomdao/shared/client';
import { Button } from '../../kit/index.js';
import styles from './PlayerSlot.module.css';

export interface PlayerSlotProps {
  /** `null` is an empty seat. */
  member: RoomMember | null;
  isHost: boolean;
  isMe: boolean;
  /** The viewer is the host: can remove a computer seat. */
  canRemove: boolean;
  /** The viewer may fill an empty seat with the computer. */
  canAddBot: boolean;
  busy: boolean;
  onInvite(): void;
  onAddBot(): void;
  onRemove(): void;
}

function statusOf(member: RoomMember, isHost: boolean): string {
  if (!member.connected) return 'Mất kết nối';
  if (member.bot) return 'Máy';
  if (member.ready) return 'Sẵn sàng';
  return isHost ? 'Chủ phòng' : 'Đang chờ';
}

/** One of the Room's seats: the player's picture, name and status, or "+ Mời" when empty. */
export function PlayerSlot({
  member,
  isHost,
  isMe,
  canRemove,
  canAddBot,
  busy,
  onInvite,
  onAddBot,
  onRemove,
}: PlayerSlotProps) {
  if (!member) {
    return (
      <li className={`${styles.slot} ${styles.empty}`}>
        <button type="button" className={styles.invite} onClick={onInvite}>
          + Mời
        </button>
        {canAddBot && (
          <button type="button" className={styles.invite} disabled={busy} onClick={onAddBot}>
            + Máy
          </button>
        )}
      </li>
    );
  }

  const lit = member.ready === true && member.connected;
  const classes = [
    styles.slot,
    'cut-br',
    lit && styles.ready,
    !member.connected && styles.away,
    isMe && styles.me,
  ];
  return (
    <li className={classes.filter(Boolean).join(' ')}>
      <span className={styles.face} aria-hidden="true">
        {member.bot ? <IconRobot stroke={2} /> : member.name.slice(0, 1).toUpperCase()}
      </span>
      <span className={styles.text}>
        <span className={styles.name}>{member.name}</span>
        <span className={`${styles.status} ${lit ? styles.statusReady : ''}`}>
          {statusOf(member, isHost)}
        </span>
      </span>
      {member.bot && canRemove && (
        <Button
          variant="ghost"
          className={styles.remove}
          aria-label={`Bỏ ${member.name}`}
          disabled={busy}
          onClick={onRemove}
        >
          <IconX stroke={2} aria-hidden />
        </Button>
      )}
    </li>
  );
}
