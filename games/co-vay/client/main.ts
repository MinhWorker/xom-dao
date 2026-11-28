/** Cờ Vây's client: draws the Match from the Hub's pushes and sends the player's moves. */
import {
  BRIDGE_RESET,
  BRIDGE_UNAVAILABLE,
  BridgeError,
  type BridgeSeat,
  createGameBridge,
} from '@xomdao/bridge';
import { count } from '../server/game/board.js';
import {
  BLACK,
  type Cell,
  EMPTY,
  type Point,
  type State,
  type Stone,
  WHITE,
} from '../server/game/model.js';
import { BoardView, DROP_MS, END_MS, type Scene } from './render.js';
import { Sounds } from './sound.js';

const ABORT_MS = 600;
const TOAST_MS = 2200;
const CONFIRM_MS = 3000;

interface MatchPush {
  matchId: string;
  status: 'loading' | 'playing' | 'over';
  view?: State;
  result?: { seats: { player: string; place: number }[] };
}

const canvas = document.getElementById('board') as HTMLCanvasElement;
const table = document.querySelector('.table') as HTMLElement;
const seatMe = document.getElementById('seat-me') as HTMLElement;
const seatThem = document.getElementById('seat-them') as HTMLElement;
const sideMe = document.getElementById('side-me') as HTMLElement;
const sideThem = document.getElementById('side-them') as HTMLElement;
const statusEl = document.getElementById('status') as HTMLElement;
const bannerEl = document.getElementById('banner') as HTMLElement;
const toastEl = document.getElementById('toast') as HTMLElement;
const passBtn = document.getElementById('pass') as HTMLButtonElement;
const resignBtn = document.getElementById('resign') as HTMLButtonElement;
const resumeBtn = document.getElementById('resume') as HTMLButtonElement;
const acceptBtn = document.getElementById('accept') as HTMLButtonElement;
const view = new BoardView(canvas);
const sounds = new Sounds();

let me = '';
let seats: BridgeSeat[] = [];
let matchId: string | null = null;
let status: MatchPush['status'] = 'loading';
let doneFor: string | null = null;
let doneTimer = 0;
let hidden = false;
let sending = false;
let resignArmed = 0;
const scene: Scene = {
  state: null,
  ghost: null,
  hover: null,
  mine: null,
  placedAt: new Map(),
  taken: [],
  overAt: null,
};

const bridge = createGameBridge({
  onInit(init) {
    sounds.apply(init.settings);
    me = init.player.id;
    seats = init.room.seats;
    matchId = null;
    status = 'loading';
    clearTimeout(doneTimer);
    reset();
    show((init.match as State | null) ?? null, false);
  },
  onMessage(event, data) {
    if (event !== 'match:state') return;
    const push = data as MatchPush;
    const fresh = push.matchId !== matchId;
    if (fresh) reset();
    matchId = push.matchId;
    status = push.status;
    if (push.view) show(push.view, !fresh);
    if (fresh && status === 'playing' && scene.state?.turn === me && !scene.state.moves)
      sounds.play('turn');
    if (status === 'over') finish(push);
  },
  onSettings: (settings) => sounds.apply(settings),
  onVisibility(paused) {
    hidden = paused;
    sounds.setHidden(paused);
    document.documentElement.classList.toggle('paused', paused);
    if (!paused) frame();
  },
});

function reset() {
  scene.placedAt.clear();
  scene.taken = [];
  scene.overAt = null;
  scene.ghost = null;
  bannerEl.classList.remove('shown');
}

const stoneOf = (state: State, id: string): Stone | null =>
  state.players[0] === id ? BLACK : state.players[1] === id ? WHITE : null;
const colourName = (stone: Stone) => (stone === BLACK ? 'Đen' : 'Trắng');

/** Shows a state; `animate` plays what changed since the last one. */
function show(state: State | null, animate: boolean) {
  const now = performance.now();
  const before = scene.state;
  if (state && before && animate && before.size === state.size) {
    let placed = false;
    const taken: Scene['taken'] = [];
    for (let i = 0; i < state.board.length; i++) {
      const was = before.board[i];
      const is = state.board[i];
      if (is !== EMPTY && was === EMPTY) {
        scene.placedAt.set(i, now);
        placed = true;
      } else if (is === EMPTY && was !== EMPTY)
        taken.push({ i, stone: was as Stone, at: now + DROP_MS });
    }
    scene.taken = taken;
    const last = state.last;
    if (placed && last && 'x' in last) {
      sounds.play(last.stone === stoneOf(state, me) ? 'place' : 'other');
      if (taken.length) sounds.play(taken.length > 3 ? 'captureMany' : 'capture', DROP_MS);
    }
    if (last && 'pass' in last && state.moves > before.moves) {
      sounds.play('pass');
      if (state.phase === 'play') say(`${colourName(last.pass)} bỏ lượt`);
    }
    if (before.phase === 'play' && state.phase === 'score') {
      sounds.play('count');
      banner('Đếm đất');
    }
    if (before.phase === 'score' && state.phase === 'play') say('Đánh tiếp');
    if (state.phase === 'play' && state.turn === me && before.turn !== me)
      sounds.play('turn', DROP_MS + 120);
    if (before.phase !== 'over' && state.phase === 'over') end(state, true);
  } else if (state?.phase === 'over') end(state, false);
  scene.state = state;
  scene.mine = state ? stoneOf(state, me) : null;
  if (scene.ghost && (state?.phase !== 'play' || state.turn !== me)) scene.ghost = null;
  updateHud();
  frame();
}

/** The end of the Match: the count fills in and the result shows. */
function end(state: State, animate: boolean) {
  scene.overAt = animate ? performance.now() : performance.now() - END_MS;
  const mine = stoneOf(state, me);
  const winner = state.winner;
  const won = winner === me;
  const by = winner ? stoneOf(state, winner) : null;
  let detail = '';
  if (state.ending === 'count' && state.count) {
    detail = `Đen ${state.count.black} · Trắng ${state.count.white}`;
  } else if (state.ending === 'resign' && winner) {
    detail = `${colourName((3 - (by ?? BLACK)) as Stone)} xin thua`;
  } else if (state.ending === 'leave') detail = 'Đối thủ đã rời bàn';
  const title = mine ? (won ? 'Thắng!' : 'Thua') : by ? `${colourName(by)} thắng` : 'Hết ván';
  banner(title, detail, END_MS + 1000);
  if (animate) sounds.play(!mine || won ? 'win' : 'lose', 300);
}

/** Tells the Hub once the end has shown, once per Match. */
function finish(push: MatchPush) {
  const id = push.matchId;
  if (doneFor === id) return;
  doneFor = id;
  if (scene.overAt === null) {
    const mine = push.result?.seats.find((s) => s.player === me);
    if (mine) banner(mine.place === 1 ? 'Thắng!' : 'Thua', '', END_MS);
  }
  const left = scene.overAt === null ? ABORT_MS : scene.overAt + END_MS - performance.now();
  clearTimeout(doneTimer);
  doneTimer = window.setTimeout(() => bridge.done(), Math.max(0, left));
}

const myTurn = () =>
  status === 'playing' &&
  !!scene.state &&
  scene.state.phase === 'play' &&
  scene.state.turn === me &&
  !sending;

/** Fills both cards and the buttons. */
function updateHud() {
  const state = scene.state;
  const seated = !!state && !!scene.mine;
  const meId = seated ? me : state?.players[0];
  const themId = state
    ? state.players[0] === meId
      ? state.players[1]
      : state.players[0]
    : undefined;
  const scoring = state?.phase === 'score';
  const tally =
    scoring && state ? count(state.board, state.size, new Set(state.dead)) : state?.count;
  for (const [card, id] of [
    [seatMe, meId],
    [seatThem, themId],
  ] as const) {
    card.hidden = !id || !state;
    if (!id || !state) continue;
    const stone = stoneOf(state, id) as Stone;
    card.dataset.stone = stone === BLACK ? 'black' : 'white';
    const seat = seats.find((s) => s.id === id);
    (card.querySelector('.name') as HTMLElement).textContent = seat?.name ?? '';
    (card.querySelector('.who') as HTMLElement).textContent =
      id === me ? 'Bạn' : seat?.bot ? 'Máy' : '';
    showAvatar(card, seat);
    const wins = card.querySelector('.wins') as HTMLElement;
    const score = String(state.wins[id] ?? 0);
    if (wins.dataset.player === id && wins.textContent !== score) {
      wins.classList.remove('bump');
      void wins.offsetWidth;
      wins.classList.add('bump');
    }
    wins.dataset.player = id;
    wins.textContent = score;
    const area = tally ? (stone === BLACK ? tally.black : tally.white) : null;
    (card.querySelector('.tally') as HTMLElement).textContent =
      area !== null ? `${area} điểm` : `Bắt ${state.captures[id] ?? 0}`;
    const won = state.phase === 'over' && state.winner === id;
    const agreed = scoring && state.agreed.includes(id);
    card.classList.toggle(
      'active',
      won || (state.phase === 'play' && state.turn === id) || (scoring && !agreed),
    );
    card.classList.toggle('won', won);
    (card.querySelector('.turn') as HTMLElement).textContent = won
      ? 'Thắng'
      : scoring
        ? agreed
          ? 'Đã đồng ý'
          : 'Đang xem'
        : 'Đến lượt';
  }
  const playing = status === 'playing' && state?.phase === 'play' && seated;
  passBtn.hidden = !playing;
  resignBtn.hidden = !seated || !state || state.phase === 'over' || status !== 'playing';
  passBtn.disabled = !myTurn();
  resumeBtn.hidden = acceptBtn.hidden = !(seated && scoring && status === 'playing');
  const agreed = !!state && state.agreed.includes(me);
  acceptBtn.textContent = agreed ? 'Đã đồng ý' : 'Đồng ý';
  acceptBtn.classList.toggle('done', agreed);
  acceptBtn.disabled = agreed || sending;
  resumeBtn.disabled = sending;
  resignBtn.disabled = sending;
  if (!resignArmed) resignBtn.textContent = 'Xin thua';
  statusEl.textContent = scoring ? 'Đếm đất' : '';
  layout();
}

function showAvatar(card: HTMLElement, seat: BridgeSeat | undefined) {
  (card.querySelector('.initial') as HTMLElement).textContent = (
    seat?.name[0] ?? '?'
  ).toUpperCase();
  const img = card.querySelector('.avatar img') as HTMLImageElement;
  const picture = seat?.bot ? 'bot' : seat?.avatar;
  const src = picture ? `/avatars/${encodeURIComponent(picture)}.webp` : '';
  if (img.dataset.src === src) return;
  img.dataset.src = src;
  img.hidden = true;
  img.classList.toggle('bot', picture === 'bot');
  if (src) img.src = src;
  else img.removeAttribute('src');
}

for (const img of document.querySelectorAll<HTMLImageElement>('.avatar img')) {
  img.addEventListener('load', () => {
    img.hidden = false;
  });
  img.addEventListener('error', () => {
    img.hidden = true;
  });
}

let raf = 0;
function frame() {
  if (raf || hidden) return;
  raf = requestAnimationFrame((now) => {
    raf = 0;
    view.draw(scene, now);
    if (view.animating(scene, now)) frame();
  });
}

let toastTimer = 0;
function say(message: string) {
  toastEl.textContent = message;
  toastEl.classList.add('shown');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('shown'), TOAST_MS);
}

let bannerTimer = 0;
function banner(title: string, detail = '', ms = 1400) {
  bannerEl.replaceChildren(title);
  if (detail) {
    const small = document.createElement('small');
    small.textContent = detail;
    bannerEl.append(small);
  }
  bannerEl.classList.add('shown');
  clearTimeout(bannerTimer);
  bannerTimer = window.setTimeout(() => bannerEl.classList.remove('shown'), ms);
}

/** Sends a move; a refusal shows, unless the Hub explains it itself. */
function send(event: string, payload: object) {
  sending = true;
  updateHud();
  return bridge
    .send(event, payload)
    .catch((error: unknown) => {
      const code = error instanceof BridgeError ? error.code : '';
      if (code && code !== BRIDGE_RESET && code !== BRIDGE_UNAVAILABLE) {
        sounds.play('refused');
        say(code);
      }
    })
    .finally(() => {
      sending = false;
      updateHud();
      frame();
    });
}

function pointUnder(event: PointerEvent): Point | null {
  if (!scene.state) return null;
  const rect = canvas.getBoundingClientRect();
  return view.pointAt(scene.state.size, event.clientX - rect.left, event.clientY - rect.top);
}

canvas.addEventListener('pointermove', (event) => {
  if (event.pointerType !== 'mouse') return;
  const p = myTurn() ? pointUnder(event) : null;
  if (p?.x === scene.hover?.x && p?.y === scene.hover?.y) return;
  scene.hover = p;
  frame();
});

canvas.addEventListener('pointerleave', () => {
  scene.hover = null;
  frame();
});

canvas.addEventListener('pointerdown', (event) => {
  const state = scene.state;
  if (!state || status !== 'playing') return;
  const p = pointUnder(event);
  if (!p) return;
  const i = p.y * state.size + p.x;
  if (state.phase === 'score' && scene.mine) {
    if (state.board[i] === EMPTY || sending) return;
    sounds.play('mark');
    void send('dead', p);
    return;
  }
  if (!myTurn() || state.board[i] !== EMPTY) return;
  const confirm = event.pointerType !== 'mouse';
  if (confirm && (scene.ghost?.x !== p.x || scene.ghost?.y !== p.y)) {
    scene.ghost = p;
    sounds.play('mark');
    frame();
    return;
  }
  scene.ghost = null;
  scene.hover = null;
  void send('place', p);
});

passBtn.addEventListener('click', () => {
  if (myTurn()) void send('pass', {});
});

resignBtn.addEventListener('click', () => {
  if (!resignArmed) {
    resignBtn.textContent = 'Chắc chắn?';
    resignBtn.classList.add('confirm');
    resignArmed = window.setTimeout(() => {
      resignArmed = 0;
      resignBtn.classList.remove('confirm');
      resignBtn.textContent = 'Xin thua';
    }, CONFIRM_MS);
    return;
  }
  clearTimeout(resignArmed);
  resignArmed = 0;
  resignBtn.classList.remove('confirm');
  void send('resign', {});
});

acceptBtn.addEventListener('click', () => void send('accept', {}));
resumeBtn.addEventListener('click', () => void send('resume', {}));

type Arrangement = 'split' | 'column' | 'stack';

/**
 * The board's side in `arrangement`: `split` puts a panel on each side of it, `column` both in
 * one column on its right, `stack` one above and one below.
 */
function boardSide(arrangement: Arrangement, width: number, height: number) {
  table.dataset.layout = arrangement;
  const style = getComputedStyle(table);
  const gap = parseFloat(style.columnGap) || 0;
  const panel = parseFloat(style.getPropertyValue('--side'));
  const panels = sideMe.offsetHeight + sideThem.offsetHeight;
  if (arrangement === 'stack') return Math.min(width, height - panels - 2 * gap);
  if (arrangement === 'column')
    return height < panels + gap ? 0 : Math.min(width - panel - gap, height);
  return Math.min(width - 2 * (panel + gap), height);
}

/** Picks the arrangement that leaves the board the most room and sizes the board to it. */
function layout() {
  const style = getComputedStyle(table);
  const width = table.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const height =
    table.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
  let best: Arrangement = 'split';
  let side = 0;
  for (const arrangement of ['split', 'column', 'stack'] as const) {
    const fits = boardSide(arrangement, width, height);
    if (fits > side) [best, side] = [arrangement, fits];
  }
  table.dataset.layout = best;
  side = Math.max(120, Math.floor(side));
  if (side === sized) return;
  sized = side;
  document.documentElement.style.setProperty('--board', `${side}px`);
  view.resize(side, side);
  frame();
}
let sized = 0;

/** `?splash`: a staged Match, large and tilted, for the Hub's art. */
function stage() {
  const board = [
    '...................',
    '...................',
    '...................',
    '............o.x.o..',
    '........oo...x..x..',
    '....ox.o.ox..o.....',
    '....oxx..x..xo.....',
    '....ox.x.oox.......',
    '.x..x..xoox.o.x....',
    '.....xx..o.oox.....',
    '......x...ooxx...o.',
    '....xx.o.o...x.....',
    '.....x...o.x..o....',
    '.....xoo.....x.....',
    '.....xo.......x....',
    '..x.............o..',
    '..o............x...',
    '...................',
    '...................',
  ]
    .join('')
    .split('')
    .map((c) => '.xo'.indexOf(c)) as Cell[];
  scene.state = {
    size: 19,
    board,
    players: ['a', 'b'],
    turn: 'a',
    phase: 'play',
    last: { x: 4, y: 5, stone: WHITE, captured: 0 },
    passes: 0,
    captures: {},
    moves: 60,
    seen: [],
    dead: [],
    agreed: [],
    count: null,
    winner: null,
    ending: null,
    wins: {},
  };
  scene.mine = BLACK;
  view.resize(860, 860);
  view.draw(scene, performance.now());
}

if (new URLSearchParams(location.search).has('splash')) {
  document.body.classList.add('splash');
  stage();
  void document.fonts.ready.then(() => {
    view.draw(scene, performance.now());
    document.body.setAttribute('data-ready', '');
  });
} else {
  new ResizeObserver(() => {
    sized = 0;
    layout();
  }).observe(table);
  layout();
  bridge.ready();
}
