import {
  IconArrowsExchange,
  IconRobot,
  IconUserCheck,
  IconUserPlus,
  IconX,
} from '@tabler/icons-react';
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
  /** The viewer may move into this empty seat. */
  canSit?: boolean;
  /** Where the viewer stands with this person: `add` offers Kết bạn, `sent` shows it was asked. */
  befriend?: Befriend;
  onInvite(): void;
  onAddBot(): void;
  onRemove(): void;
  onSit?(): void;
  onBefriend?(): void;
}

export type Befriend = 'add' | 'sent' | null;

/** The Kết bạn button beside someone in the Room, or what became of the request. */
export function BefriendButton({
  befriend,
  name,
  busy,
  onBefriend,
}: {
  befriend: Befriend | undefined;
  name: string;
  busy: boolean;
  onBefriend?(): void;
}) {
  if (befriend === 'sent')
    return (
      <span className={styles.sent} title="Đã gửi lời mời kết bạn">
        <IconUserCheck stroke={2} aria-hidden />
        Đã gửi
      </span>
    );
  if (befriend !== 'add') return null;
  return (
    <Button
      variant="ghost"
      className={styles.befriend}
      aria-label={`Kết bạn với ${name}`}
      disabled={busy}
      onClick={onBefriend}
    >
      <IconUserPlus stroke={2} aria-hidden />
      Kết bạn
    </Button>
  );
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
  canSit = false,
  befriend,
  onInvite,
  onAddBot,
  onRemove,
  onSit,
  onBefriend,
}: PlayerSlotProps) {
  if (!member) {
    return (
      <li className={`${styles.slot} ${styles.empty}`}>
        {canSit && (
          <button
            type="button"
            className={`${styles.invite} ${styles.sit}`}
            aria-label="Ngồi đây"
            title="Ngồi đây"
            disabled={busy}
            onClick={onSit}
          >
            <IconArrowsExchange stroke={2} aria-hidden />
          </button>
        )}
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
      {!member.bot && !isMe && (
        <BefriendButton
          befriend={befriend}
          name={member.name}
          busy={busy}
          onBefriend={onBefriend}
        />
      )}
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
