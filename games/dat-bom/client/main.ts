/** Đặt Bom's client: draws the server's snapshots in Three.js and sends the player's inputs. */
import { type BridgeSeat, createGameBridge } from '@xomdao/bridge';
import {
  BOMB_DAMAGE,
  COUNTDOWN_TICKS,
  type Dir,
  MATCH_TICKS,
  MAX_HP,
  type State,
  TICK_RATE,
} from '../server/game/model.js';
import { attachControls } from './controls.js';
import { Predictor } from './predict.js';
import { ArenaView, SEAT_COLORS } from './scene.js';
import { type Frame, type Picture, picture, Timeline } from './sync.js';

/** How long the final banner shows before the Hub is told the Match has played out. */
const OUTRO_MS = 1800;
/** How long "Bắt đầu!" shows after the countdown. */
const GO_MS = 700;

/** The part of a `match:state` push the client reads. */
interface MatchPush {
  matchId: string;
  status: 'loading' | 'playing' | 'over';
  view?: State;
  tick?: number;
  ack?: number;
  result?: { seats: { player: string; place: number }[] };
}

const canvas = document.getElementById('view') as HTMLCanvasElement;
const rosterEl = document.getElementById('roster') as HTMLElement;
const clockEl = document.getElementById('clock') as HTMLElement;
const bannerEl = document.getElementById('banner') as HTMLElement;
SEAT_COLORS.forEach((color, seat) => {
  document.documentElement.style.setProperty(`--seat-${seat}`, color);
});

const view = new ArenaView(canvas);
const timeline = new Timeline();
const predictor = new Predictor(-1);

let myId = '';
let me = -1;
let seats: BridgeSeat[] = [];
let matchId: string | null = null;
let status: MatchPush['status'] = 'loading';
/** The state `init` carried, drawn until the first snapshot arrives. */
let still: State | null = null;
let fightSent = false;
let goUntil = 0;
let doneFor: string | null = null;
let doneTimer = 0;
let outro = '';

const bridge = createGameBridge({
  onInit(init) {
    myId = init.player.id;
    seats = init.room.seats;
    me = seats.findIndex((s) => s.id === myId);
    predictor.seat = me;
    predictor.reset();
    timeline.clear();
    matchId = null;
    status = 'loading';
    fightSent = false;
    outro = '';
    clearTimeout(doneTimer);
    doneFor = null;
    still = (init.match as State | null) ?? null;
    controls.release();
    buildRoster();
  },
  onMessage(event, data) {
    if (event === 'match:state') receive(data as MatchPush);
  },
  onVisibility(hidden) {
    if (hidden) controls.release();
  },
});

/** Takes one `match:state` push. */
function receive(push: MatchPush) {
  const now = performance.now();
  if (push.matchId !== matchId) {
    matchId = push.matchId;
    timeline.clear();
    predictor.reset();
    fightSent = false;
    outro = '';
    still = null;
    clearTimeout(doneTimer);
    doneFor = null;
  }
  status = push.status;
  if (push.view && push.tick !== undefined && push.tick > (timeline.latest?.tick ?? -1)) {
    timeline.push(push.tick, push.view, now);
    predictor.receive(push.view, push.tick, push.ack, now);
    if (push.tick >= COUNTDOWN_TICKS && !fightSent) {
      // Keys held through the countdown count for nothing on the server: say what is held now.
      fightSent = true;
      goUntil = now + GO_MS;
      if (controls.held() !== 'none') sendInput(controls.held(), false);
    }
  }
  if (push.status === 'over') finish(push);
}

/** Shows the player's place, then tells the Hub the end of the Match has played out. */
function finish(push: MatchPush) {
  if (doneFor === push.matchId) return;
  doneFor = push.matchId;
  const places = push.result?.seats ?? [];
  const place = places.find((s) => s.player === myId)?.place;
  const winners = places.filter((s) => s.place === 1).length;
  if (place === undefined) outro = 'Hết trận';
  else if (winners === places.length && places.length > 1) outro = 'Hoà';
  else outro = place === 1 ? 'Thắng!' : `Hạng ${place}`;
  clearTimeout(doneTimer);
  doneTimer = window.setTimeout(() => bridge.done(), OUTRO_MS);
}

/** Sends the direction held (and a bomb, if asked) as one numbered input. */
function sendInput(move: Dir, bomb: boolean) {
  const mine = timeline.latest?.state.players[me];
  if (status !== 'playing' || !mine || mine.out !== null) return;
  const now = performance.now();
  const { seq, input } = predictor.press(move, bomb, now);
  bridge
    .send('input', { seq, input })
    .then(() => predictor.noteRoundTrip(performance.now() - now))
    .catch(() => {});
}

const controls = attachControls(
  { onChange: sendInput },
  document.getElementById('pad') as HTMLElement,
  document.getElementById('bomb') as HTMLElement,
);
addEventListener('blur', () => controls.release());

// The roster above the arena: who is who, and how many hits each can still take.
let rosterKey = '';
let hudKey = '';
function buildRoster() {
  rosterEl.replaceChildren(
    ...seats.map((seat, i) => {
      const item = document.createElement('li');
      item.className = `seat${i === me ? ' me' : ''}`;
      item.style.setProperty('--c', `var(--seat-${i % SEAT_COLORS.length})`);
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = seat.name;
      const hearts = document.createElement('span');
      hearts.className = 'hearts';
      hearts.append(
        ...Array.from({ length: Math.ceil(MAX_HP / BOMB_DAMAGE) }, () =>
          document.createElement('i'),
        ),
      );
      item.append(name, hearts);
      return item;
    }),
  );
  rosterKey = '';
}

const clockText = (ticks: number) => {
  const seconds = Math.max(0, Math.ceil(ticks / TICK_RATE));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

/** Refreshes the roster, clock and banner from the picture on screen; only touches what changed. */
function updateHud(pic: Picture | null, now: number) {
  let banner = '';
  let quiet = false;
  let clock = clockText(MATCH_TICKS);
  let low = false;
  const players = pic?.players ?? [];
  if (outro) banner = outro;
  else if (!pic || status === 'loading') {
    banner = 'Đang chờ mọi người';
    quiet = true;
  } else if (pic.tick < COUNTDOWN_TICKS) {
    banner = String(Math.max(1, Math.ceil((COUNTDOWN_TICKS - pic.tick) / TICK_RATE)));
  } else {
    const left = MATCH_TICKS - (pic.tick - COUNTDOWN_TICKS);
    clock = clockText(left);
    low = left <= 20 * TICK_RATE;
    if (now < goUntil) banner = 'Bắt đầu!';
  }

  const key = `${players.map((p) => `${p.hp}${p.out === null ? '' : 'x'}`).join()}|${clock}|${banner}|${low}|${quiet}`;
  if (key === hudKey) return;
  hudKey = key;
  clockEl.textContent = clock;
  clockEl.classList.toggle('low', low);
  if (bannerEl.textContent !== banner) {
    bannerEl.textContent = banner;
    bannerEl.classList.remove('shown');
    if (banner) {
      void bannerEl.offsetWidth;
      bannerEl.classList.add('shown');
    }
  }
  bannerEl.classList.toggle('quiet', quiet);
  const rosterNow = players.map((p) => p.hp).join();
  if (rosterNow === rosterKey) return;
  rosterKey = rosterNow;
  [...rosterEl.children].forEach((item, i) => {
    const player = players[i];
    if (!player) return;
    item.classList.toggle('out', player.out !== null);
    const filled = Math.ceil(Math.max(0, player.hp) / BOMB_DAMAGE);
    [...(item.querySelector('.hearts')?.children ?? [])].forEach((heart, h) => {
      heart.classList.toggle('lost', h >= filled);
    });
  });
}

const still0 = (state: State): Frame => {
  const snap = { tick: 0, state };
  return { tick: 0, from: snap, to: snap, alpha: 0 };
};

let before = performance.now();
function loop(now: number) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, Math.max(0, (now - before) / 1000));
  before = now;
  const frame = timeline.frame(now) ?? (still ? still0(still) : null);
  if (!frame) {
    view.idle();
    updateHud(null, now);
    return;
  }
  const pic = picture(frame);
  const playing = status === 'playing' && timeline.latest !== null && me >= 0;
  const mine = playing ? predictor.position(now, dt) : null;
  const ghosts = playing ? predictor.ghosts(now, pic.bombs) : [];
  view.draw({ picture: pic, me, mine, held: controls.held(), ghosts, now, dt });
  updateHud(pic, now);
}

function layout() {
  view.resize(canvas.clientWidth, canvas.clientHeight);
}
new ResizeObserver(layout).observe(canvas);
layout();
requestAnimationFrame(loop);
bridge.ready();
