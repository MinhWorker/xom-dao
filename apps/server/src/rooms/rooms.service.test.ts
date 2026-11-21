import { defineManifest } from '@xomdao/sdk';
import { describe, expect, it } from 'vitest';
import { RoomsService } from './rooms.service.js';

const caro = defineManifest({
  id: 'caro',
  name: 'Caro',
  tagline: 'Năm quân liền hàng.',
  minPlayers: 2,
  maxPlayers: 2,
  duration: { min: 5, max: 15 },
  status: 'wip',
  bots: true,
  focus: { x: 50, y: 50 },
  options: {
    level: {
      type: 'choice',
      label: 'Độ khó',
      default: 'easy',
      choices: [
        { value: 'easy', label: 'Dễ' },
        { value: 'hard', label: 'Khó' },
      ],
    },
    swap: { type: 'toggle', label: 'Đổi lượt', default: false },
  },
});

const party = defineManifest({
  id: 'party',
  name: 'Tiệc',
  tagline: 'Chơi đông vui.',
  minPlayers: 1,
  maxPlayers: 4,
  duration: { min: 1, max: 2 },
  status: 'wip',
  bots: true,
  focus: { x: 50, y: 50 },
});

const quiz = defineManifest({ ...party, id: 'quiz', bots: false });

/** A logged-in account (id = lowercase name, for readable tests). */
const acc = (name: string) => ({ id: name.toLowerCase(), name });

const setup = () => new RoomsService([caro, party, quiz]);

describe('creating a room', () => {
  it('seats the creator as host in the first of the Game’s seats, with default options', () => {
    const rooms = setup();
    const room = rooms.create('caro', acc('Lan'));
    expect(room.code).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);
    const state = rooms.stateOf(room.code);
    expect(state).toMatchObject({
      code: room.code,
      gameId: 'caro',
      hostId: 'lan',
      status: 'waiting',
      matchId: null,
      options: { level: 'easy', swap: false },
    });
    expect(state.seats).toEqual([{ id: 'lan', name: 'Lan', connected: true }, null]);
  });

  it('checks the options against the manifest', () => {
    const rooms = setup();
    const room = rooms.create('caro', acc('Lan'), { swap: true });
    expect(rooms.stateOf(room.code).options).toEqual({ level: 'easy', swap: true });
    expect(() => rooms.create('caro', acc('Minh'), { level: 'impossible' })).toThrow(
      'Tuỳ chọn phòng không hợp lệ',
    );
    expect(() => rooms.create('caro', acc('Minh'), { speed: 2 })).toThrow(
      'Tuỳ chọn phòng không hợp lệ',
    );
  });

  it('refuses a Game the server does not run', () => {
    expect(() => setup().create('chess', acc('Lan'))).toThrow('Không có game: chess');
  });
});

describe('joining', () => {
  it('takes the first empty seat, by code in any case', () => {
    const rooms = setup();
    const room = rooms.create('party', acc('Lan'));
    rooms.join(` ${room.code.toLowerCase()}`, acc('Minh'));
    rooms.join(room.code, acc('Hoa'));
    expect(rooms.stateOf(room.code).seats.map((s) => s?.id ?? null)).toEqual([
      'lan',
      'minh',
      'hoa',
      null,
    ]);
    expect(rooms.roomOf('hoa')?.code).toBe(room.code);
  });

  it('puts someone already seated back in their seat, connected', () => {
    const rooms = setup();
    const room = rooms.create('caro', acc('Lan'));
    rooms.setConnected(room.code, 'lan', false);
    expect(rooms.stateOf(room.code).seats[0]?.connected).toBe(false);
    rooms.join(room.code, acc('Lan'));
    expect(rooms.stateOf(room.code).seats).toEqual([
      { id: 'lan', name: 'Lan', connected: true },
      null,
    ]);
  });

  it('refuses a full Room, a running Match and an unknown code', () => {
    const rooms = setup();
    const room = rooms.create('caro', acc('Lan'));
    rooms.join(room.code, acc('Minh'));
    expect(() => rooms.join(room.code, acc('Hoa'))).toThrow('Phòng đã đủ người');
    const party = rooms.create('party', acc('Tú'));
    rooms.start(party.code, 'tú');
    expect(() => rooms.join(party.code, acc('Hoa'))).toThrow('Ván đang chơi');
    expect(() => rooms.join('ZZZZ', acc('Hoa'))).toThrow('Phòng không còn nữa');
  });
});

describe('leaving', () => {
  it('frees the seat and passes host to the next person seated, not a bot', () => {
    const rooms = setup();
    const room = rooms.create('party', acc('Lan'));
    rooms.addBot(room.code, 'lan');
    rooms.join(room.code, acc('Minh'));
    expect(rooms.leave(room.code, 'lan').closed).toBe(false);
    const state = rooms.stateOf(room.code);
    expect(state.hostId).toBe('minh');
    expect(state.seats.map((s) => s?.id ?? null)).toEqual([null, 'bot:2', 'minh', null]);
    expect(rooms.roomOf('lan')).toBeUndefined();
  });

  it('disbands the Room when only bots are left', () => {
    const rooms = setup();
    const room = rooms.create('caro', acc('Lan'));
    rooms.addBot(room.code, 'lan');
    expect(rooms.leave(room.code, 'lan').closed).toBe(true);
    expect(() => rooms.stateOf(room.code)).toThrow('Phòng không còn nữa');
  });

  it('frees a seat mid-Match too, keeping the Match running', () => {
    const rooms = setup();
    const room = rooms.create('party', acc('Lan'));
    rooms.join(room.code, acc('Minh'));
    rooms.setReady(room.code, 'minh', true);
    const { matchId } = rooms.start(room.code, 'lan');
    rooms.leave(room.code, 'minh');
    expect(rooms.stateOf(room.code)).toMatchObject({ status: 'playing', matchId });
  });
});

describe('bots and options', () => {
  it('lets the host seat and remove the computer when the Game has bots', () => {
    const rooms = setup();
    const room = rooms.create('caro', acc('Lan'));
    rooms.join(room.code, acc('Minh'));
    expect(() => rooms.addBot(room.code, 'minh')).toThrow('Chỉ chủ phòng mới làm được');
    expect(() => rooms.addBot(room.code, 'lan')).toThrow('Phòng đã đủ người');
    rooms.leave(room.code, 'minh');
    rooms.addBot(room.code, 'lan');
    expect(rooms.stateOf(room.code).seats[1]).toEqual({
      id: 'bot:2',
      name: 'Máy',
      bot: true,
      connected: true,
    });
    expect(() => rooms.removeBot(room.code, 'lan', 0)).toThrow('Ghế này không có máy');
    rooms.removeBot(room.code, 'lan', 1);
    expect(rooms.stateOf(room.code).seats[1]).toBeNull();
    const solo = rooms.create('quiz', acc('Tú'));
    expect(() => rooms.addBot(solo.code, 'tú')).toThrow('Game này không chơi với máy');
  });

  it('lets the host replace the options between Matches', () => {
    const rooms = setup();
    const room = rooms.create('caro', acc('Lan'));
    rooms.addBot(room.code, 'lan');
    rooms.setOptions(room.code, 'lan', { level: 'hard' });
    expect(rooms.stateOf(room.code).options).toEqual({ level: 'hard', swap: false });
    expect(() => rooms.setOptions(room.code, 'lan', { swap: 'yes' })).toThrow(
      'Tuỳ chọn phòng không hợp lệ',
    );
    rooms.start(room.code, 'lan');
    expect(() => rooms.setOptions(room.code, 'lan', {})).toThrow('Đợi hết ván đã');
  });
});

describe('starting a Match', () => {
  it('needs the host, enough players and everyone ready before the first Match', () => {
    const rooms = setup();
    const room = rooms.create('caro', acc('Lan'));
    expect(() => rooms.start(room.code, 'lan')).toThrow('Cần ít nhất 2 người chơi');
    rooms.join(room.code, acc('Minh'));
    expect(() => rooms.start(room.code, 'minh')).toThrow('Chỉ chủ phòng mới làm được');
    expect(() => rooms.start(room.code, 'lan')).toThrow('Chờ mọi người sẵn sàng đã');
    rooms.setReady(room.code, 'minh', true);
    expect(rooms.stateOf(room.code).seats[1]?.ready).toBe(true);
    const start = rooms.start(room.code, 'lan');
    expect(start).toEqual({
      matchId: expect.any(String),
      gameId: 'caro',
      players: [
        { id: 'lan', name: 'Lan', bot: false },
        { id: 'minh', name: 'Minh', bot: false },
      ],
      options: { level: 'easy', swap: false },
    });
    expect(rooms.stateOf(room.code)).toMatchObject({ status: 'playing', matchId: start.matchId });
    expect(rooms.stateOf(room.code).seats[1]?.ready).toBeUndefined();
    expect(() => rooms.start(room.code, 'lan')).toThrow('Đợi hết ván đã');
  });

  it('hands over the seats in order with bots marked, skipping empty ones', () => {
    const rooms = setup();
    const room = rooms.create('party', acc('Lan'));
    rooms.join(room.code, { ...acc('Minh'), avatar: 'boy' });
    rooms.addBot(room.code, 'lan');
    rooms.leave(room.code, 'minh');
    expect(rooms.start(room.code, 'lan').players).toEqual([
      { id: 'lan', name: 'Lan', bot: false },
      { id: 'bot:3', name: 'Máy', bot: true },
    ]);
  });

  it('waits to play again once the Match is over, with no second Sẵn sàng', () => {
    const rooms = setup();
    const room = rooms.create('caro', acc('Lan'));
    rooms.join(room.code, acc('Minh'));
    rooms.setReady(room.code, 'minh', true);
    const first = rooms.start(room.code, 'lan');
    expect(rooms.endMatch(room.code, 'another-match')).toBeUndefined();
    expect(rooms.endMatch(room.code, first.matchId)).toBe(room);
    expect(rooms.stateOf(room.code)).toMatchObject({ status: 'waiting', matchId: null });
    const second = rooms.start(room.code, 'lan');
    expect(second.matchId).not.toBe(first.matchId);
  });
});

describe('profiles and empty Rooms', () => {
  it('follows a renamed account into its seat', () => {
    const rooms = setup();
    const room = rooms.create('caro', acc('Lan'));
    expect(rooms.rename('lan', { name: 'Lan Anh', avatar: 'girl' })).toBe(room);
    expect(rooms.stateOf(room.code).seats[0]).toEqual({
      id: 'lan',
      name: 'Lan Anh',
      avatar: 'girl',
      connected: true,
    });
  });

  it('prunes Rooms where nobody is connected', () => {
    const rooms = setup();
    const kept = rooms.create('caro', acc('Lan'));
    const gone = rooms.create('party', acc('Minh'));
    rooms.setConnected(gone.code, 'minh', false);
    rooms.pruneEmptyRooms();
    expect(rooms.roomOf('lan')).toBe(kept);
    expect(rooms.roomOf('minh')).toBeUndefined();
  });
});
