import { type Connect, ServerError, type ServerLink } from './link.js';

interface Member {
  id: string;
  name: string;
  ready: boolean;
  bot?: boolean;
}

/**
 * A stand-in for the real server in tests: Rooms, Matches and `match:state` pushes with just
 * enough behaviour for the Harness. A Match's `view` is the list of moves made so far.
 */
export function fakeServer() {
  const links = new Map<string, FakeLink>();
  const seats: Member[] = [];
  const room = {
    code: 'ABCD',
    hostId: '',
    status: 'waiting' as 'waiting' | 'playing',
    matchId: null as string | null,
  };
  const readied: string[] = [];
  const moves: unknown[] = [];
  let status: 'loading' | 'playing' | 'over' = 'loading';
  let users = 0;

  const roomState = () => ({
    code: room.code,
    gameId: 'fake',
    hostId: room.hostId,
    seats: seats.map((s) => ({
      id: s.id,
      name: s.name,
      ready: s.ready,
      connected: true,
      bot: s.bot,
    })),
    options: {},
    status: room.status,
    matchId: room.matchId,
  });
  const matchState = () => ({
    roomCode: room.code,
    matchId: room.matchId as string,
    gameId: 'fake',
    status,
    disconnectedPlayerIds: [],
    timer: null,
    view: moves.slice(),
  });
  const pushRoom = () => {
    for (const link of links.values()) link.push('room:state', roomState());
  };
  const pushMatch = () => {
    for (const link of links.values()) link.push('match:state', matchState());
  };

  class FakeLink implements ServerLink {
    readonly user;
    online = true;
    constructor(
      name: string,
      private readonly onPush: (event: string, data: unknown) => void,
    ) {
      this.user = {
        id: `user-${++users}`,
        username: name,
        name,
        avatar: 'cat',
        frame: 'gold',
      } as ServerLink['user'];
    }

    push(event: string, data: unknown) {
      if (this.online) queueMicrotask(() => this.onPush(event, data));
    }

    async request(event: string, data: unknown = {}): Promise<Record<string, unknown>> {
      if (!this.online) throw new ServerError('The server connection is closed');
      const me = seats.find((s) => s.id === this.user.id);
      switch (event) {
        case 'room:create':
          room.hostId = this.user.id;
          seats.push({ id: this.user.id, name: this.user.name, ready: false });
          links.set(this.user.id, this);
          pushRoom();
          return { roomCode: room.code };
        case 'room:join':
          seats.push({ id: this.user.id, name: this.user.name, ready: false });
          links.set(this.user.id, this);
          pushRoom();
          return { roomCode: room.code };
        case 'room:ready':
          if (me) me.ready = true;
          pushRoom();
          return {};
        case 'room:add-bot':
          seats.push({ id: `bot-${seats.length}`, name: 'Máy', ready: true, bot: true });
          pushRoom();
          return {};
        case 'match:start':
          if (seats.some((s) => !s.ready && s.id !== room.hostId)) {
            throw new ServerError('Chưa đủ người sẵn sàng');
          }
          room.status = 'playing';
          room.matchId = `match-${readied.length}-${moves.length}`;
          status = 'loading';
          moves.length = 0;
          pushRoom();
          pushMatch();
          return { matchId: room.matchId };
        case 'match:ready':
          readied.push(this.user.id);
          if (readied.length >= seats.filter((s) => !s.bot).length) {
            status = 'playing';
            pushMatch();
          }
          return {};
        case 'match:move':
          if ((data as { event: string }).event !== 'place')
            throw new ServerError('Không có nước đó');
          moves.push((data as { payload: unknown }).payload);
          pushMatch();
          return {};
        case 'room:leave':
          seats.splice(
            seats.findIndex((s) => s.id === this.user.id),
            1,
          );
          links.delete(this.user.id);
          return {};
        default:
          throw new ServerError(`Unknown request ${event}`);
      }
    }

    async reconnect() {
      this.online = true;
      if (links.has(this.user.id)) {
        this.push('room:state', roomState());
        if (room.matchId) this.push('match:state', matchState());
      }
    }

    drop() {
      this.online = false;
    }

    close() {
      this.online = false;
    }
  }

  const connect: Connect = async (name, onPush) => new FakeLink(name, onPush);
  return { connect, readied };
}
