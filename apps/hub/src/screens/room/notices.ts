import type { RoomState } from '@xomdao/shared/client';

/** What the open Match view knows of the others: who is seated and whose connection dropped. */
export interface Table {
  seats: RoomState['seats'];
  /** The Room is playing a Match. */
  playing: boolean;
  matchId: string | null;
  disconnected: readonly string[];
}

/** Something to tell about one of the others. */
export interface Notice {
  player: string;
  message: string;
}

/**
 * What to tell `me` about the others between two moments of the Match view: someone left (the
 * Match or the Room), lost their connection or came back.
 */
export function tableNotices(before: Table, after: Table, me: string): Notice[] {
  const seated = (table: Table) =>
    new Map(table.seats.flatMap((s) => (s && !s.bot && s.id !== me ? [[s.id, s.name]] : [])));
  const was = seated(before);
  const now = seated(after);
  const notices: Notice[] = [];
  for (const [id, name] of was) {
    if (!now.has(id))
      notices.push({ player: id, message: `${name} đã rời ${before.playing ? 'ván' : 'phòng'}` });
  }
  const dropped = new Set(before.matchId === after.matchId ? before.disconnected : []);
  for (const id of after.disconnected) {
    const name = now.get(id);
    if (name && !dropped.has(id)) notices.push({ player: id, message: `${name} mất kết nối` });
  }
  for (const id of dropped) {
    const name = now.get(id);
    if (name && !after.disconnected.includes(id)) {
      notices.push({ player: id, message: `${name} đã kết nối lại` });
    }
  }
  return notices;
}
