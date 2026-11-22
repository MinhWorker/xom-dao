import { describe, expect, it } from 'vitest';
import { tableNotices as notices, type Table } from './notices.js';

const tableNotices = (before: Table, after: Table, me: string) =>
  notices(before, after, me).map(({ player, message }) => `${player}: ${message}`);

const an = { id: 'a', name: 'An', connected: true };
const binh = { id: 'b', name: 'Bình', connected: true };
const bot = { id: 'bot-1', name: 'Máy', bot: true, connected: true };

const table = (over: Partial<Table> = {}): Table => ({
  seats: [an, binh],
  playing: true,
  matchId: 'm1',
  disconnected: [],
  ...over,
});

describe('tableNotices', () => {
  it('says who left the Match, or the Room between Matches', () => {
    expect(tableNotices(table(), table({ seats: [an, null], playing: false }), 'a')).toEqual([
      'b: Bình đã rời ván',
    ]);
    expect(
      tableNotices(table({ playing: false }), table({ seats: [an, null], playing: false }), 'a'),
    ).toEqual(['b: Bình đã rời phòng']);
  });

  it('says who lost their connection and who came back', () => {
    const dropped = table({ disconnected: ['b'] });
    expect(tableNotices(table(), dropped, 'a')).toEqual(['b: Bình mất kết nối']);
    expect(tableNotices(dropped, dropped, 'a')).toEqual([]);
    expect(tableNotices(dropped, table(), 'a')).toEqual(['b: Bình đã kết nối lại']);
  });

  it('says nothing of me, the computer or a new Match starting', () => {
    expect(tableNotices(table({ disconnected: ['a'] }), table(), 'a')).toEqual([]);
    expect(tableNotices(table({ seats: [an, bot] }), table({ seats: [an, null] }), 'a')).toEqual(
      [],
    );
    expect(
      tableNotices(table({ disconnected: ['b'] }), table({ matchId: 'm2', disconnected: [] }), 'a'),
    ).toEqual([]);
  });

  it('says a player gone for good left, not that they came back', () => {
    expect(tableNotices(table({ disconnected: ['b'] }), table({ seats: [an, null] }), 'a')).toEqual(
      ['b: Bình đã rời ván'],
    );
  });
});
