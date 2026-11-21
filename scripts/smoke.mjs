// End-to-end check against a RUNNING server: two fake accounts register; Alice creates a Room,
// Bob joins it by code, says Sẵn sàng and Alice starts a Match. Bob then closes his "browser" and
// logs in on another "device": he must be put back in his seat. Matches themselves are not played
// yet (GameHostModule); with no Game loaded, the server refuses the Room and only login is checked.
// It speaks the clients' transport: plain WebSocket + JSON on /ws (packages/shared/src/protocol.ts).
// Usage: node scripts/smoke.mjs [serverUrl] [gameId]
import WebSocket from 'ws';

const url = process.argv[2] ?? 'http://localhost:8033';
const gameId = process.argv[3] ?? 'tic-tac-toe';

const tag = Date.now().toString(36);
// Bots speak whatever protocol the server speaks (see PROTOCOL_VERSION).
const { protocol } = await (await fetch(`${url}/api/health`)).json();

async function auth(path, body) {
  const res = await fetch(`${url}/api/auth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message);
  return data.token;
}

/** Registers a throwaway account (username = name + run tag) and returns its login token. */
const signUp = (name) =>
  auth('register', { username: `${name}${tag}`, password: 'smoke123', name, avatar: 'boy' });

/** A logged-in connection: `send` resolves with the reply, or rejects with its error. */
async function client(token) {
  const socket = new WebSocket(`${url.replace(/^http/, 'ws')}/ws`);
  const waiting = new Map();
  let next = 0;
  let last = null;
  socket.on('message', (raw) => {
    const message = JSON.parse(String(raw));
    if ('id' in message) {
      const { resolve, reject } = waiting.get(message.id);
      waiting.delete(message.id);
      if (message.ack.ok) resolve(message.ack);
      else reject(new Error(message.ack.error));
    } else if (message.event === 'room:state') last = message.data;
  });
  await new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
  const send = (event, data) =>
    new Promise((resolve, reject) => {
      next += 1;
      waiting.set(next, { resolve, reject });
      socket.send(JSON.stringify({ id: next, event, data }));
    });
  await send('auth:token', { token, protocol });
  return { socket, send, state: () => last };
}

const alice = await client(await signUp('Alice'));
let bob = await client(await signUp('Bob'));
const wait = () => new Promise((r) => setTimeout(r, 200));
try {
  const resumed = await alice.send('session:resume', {});
  if (resumed.room !== null) throw new Error('A new account should not be in a Room');
  const room = await alice.send('room:create', { gameId }).catch((e) => e);
  if (room instanceof Error) {
    if (!room.message.startsWith('Không có game')) throw room;
    console.log(`OK: login and resume; the server runs no Game "${gameId}", Rooms skipped`);
  } else {
    await bob.send('room:join', { roomCode: room.roomCode.toLowerCase() });
    await bob.send('room:ready', { ready: true });
    const { matchId } = await alice.send('match:start', {});
    await wait();
    if (alice.state()?.status !== 'playing' || alice.state()?.matchId !== matchId)
      throw new Error(`Match did not start: ${JSON.stringify(alice.state())}`);

    // Bob closes the browser without leaving, then logs in elsewhere: same seat.
    bob.socket.close();
    await wait();
    if (alice.state()?.seats[1]?.connected !== false) throw new Error('Bob should be offline');
    bob = await client(await auth('login', { username: `BOB${tag}`, password: 'smoke123' }));
    const back = await bob.send('session:resume', {});
    if (back.room?.roomCode !== room.roomCode) throw new Error('Bob was not put back in his Room');
    await wait();
    if (alice.state()?.seats[1]?.connected !== true) throw new Error('Bob should be back online');

    await bob.send('room:leave', {});
    await wait();
    if (alice.state()?.seats[1] !== null) throw new Error('Bob should have left his seat');
    console.log(`OK: Room ${room.roomCode}, Match ${matchId}, Bob came back from another device`);
  }
} catch (err) {
  console.error('SMOKE FAILED:', err.message);
  process.exitCode = 1;
} finally {
  alice.socket.close();
  bob.socket.close();
}
