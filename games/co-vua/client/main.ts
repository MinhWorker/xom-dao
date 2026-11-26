/** Cờ Vua's client: draws the Match from the Hub's pushes and sends the player's moves. */
import {
  BRIDGE_RESET,
  BRIDGE_UNAVAILABLE,
  BridgeError,
  type BridgeSeat,
  type BridgeSettings,
  createGameBridge,
} from '@xomdao/bridge';
import { findMove, fromOf, Position, sq64, toOf } from '../server/game/chess.js';
import type { Ending, State } from '../server/game/model.js';
import { BoardView, END_MS, type Scene, SLIDE_MS } from './render.js';
import { Sounds } from './sound.js';

const ABORT_MS = 600;
const TOAST_MS = 2200;
const CONFIRM_MS = 3000;
const DRAG_PX = 6;
const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

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
const drawBtn = document.getElementById('draw') as HTMLButtonElement;
const declineBtn = document.getElementById('decline') as HTMLButtonElement;
const resignBtn = document.getElementById('resign') as HTMLButtonElement;
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
/** The state the server last sent, under any move shown before the server answers. */
let confirmed: State | null = null;
const scene: Scene = {
  state: null,
  flipped: false,
  picked: null,
  targets: new Set(),
  hints: true,
  drag: null,
  promo: null,
  slide: null,
  overAt: null,
};

const applySettings = (settings: BridgeSettings) => {
  sounds.apply(settings);
  scene.hints = settings.preferences?.hints !== false;
  frame();
};

const bridge = createGameBridge({
  onInit(init) {
    applySettings(init.settings);
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
    if (push.view) {
      confirmed = push.view;
      show(push.view, !fresh);
    }
    if (status === 'over') finish(push);
  },
  onSettings: applySettings,
  onVisibility(paused) {
    hidden = paused;
    sounds.setHidden(paused);
    document.documentElement.classList.toggle('paused', paused);
    if (!paused) frame();
  },
});

function reset() {
  scene.slide = null;
  scene.overAt = null;
  scene.promo = null;
  scene.drag = null;
  unpick();
  bannerEl.classList.remove('shown');
}

const white = (state: State) => state.turn === state.players[0];
const positionOf = (state: State) =>
  Position.from(
    state.board,
    white(state) ? 'w' : 'b',
    state.castling,
    state.ep,
    state.half,
    state.full,
  );
const colourOf = (state: State, id: string) =>
  state.players[0] === id ? 'white' : state.players[1] === id ? 'black' : null;
const isMine = (state: State, piece: string) =>
  piece !== '.' && (piece === piece.toUpperCase()) === (colourOf(state, me) === 'white');

/** Shows a state; `animate` slides the move made since the last one and plays its sound. */
function show(state: State | null, animate: boolean) {
  const before = scene.state;
  if (state && before && animate && state.sans.length === before.sans.length + 1 && state.last) {
    played(before, state, true);
  } else if (state && before && state.sans.length !== before.sans.length) scene.slide = null;
  if (state && state.phase === 'over' && before?.phase !== 'over') end(state, animate && !!before);
  if (
    state &&
    before &&
    animate &&
    state.offer &&
    state.offer !== before.offer &&
    state.offer !== me
  ) {
    sounds.play('offer');
    say('Đối thủ cầu hoà');
  }
  if (
    state &&
    before?.offer === me &&
    !state.offer &&
    state.phase === 'play' &&
    state.sans.length === before.sans.length
  )
    say('Đối thủ không đồng ý hoà');
  scene.state = state;
  scene.flipped = !!state && colourOf(state, me) === 'black';
  if (
    scene.picked !== null &&
    !(state && myTurn() && isMine(state, state.board[scene.picked] ?? '.'))
  )
    unpick();
  updateHud();
  frame();
}

/** Slides the move from `before` to `after` and plays its sound. */
function played(before: State, after: State, sound: boolean) {
  const last = after.last;
  if (!last) return;
  const piece = before.board[last.from] as string;
  let taken: { at: number; piece: string } | undefined;
  if (before.board[last.to] !== '.')
    taken = { at: last.to, piece: before.board[last.to] as string };
  else if (last.capture) {
    const at = (last.from & ~7) | (last.to & 7);
    taken = { at, piece: before.board[at] as string };
  }
  const rook = last.rook && { ...last.rook, piece: before.board[last.rook.from] as string };
  scene.slide = { piece, from: last.from, to: last.to, rook, taken, at: performance.now() };
  if (!sound) return;
  const kind = last.san.includes('=')
    ? 'promote'
    : last.rook
      ? 'castle'
      : last.capture
        ? 'capture'
        : before.turn === me
          ? 'move'
          : 'other';
  sounds.play(kind);
  if (last.check && after.ending !== 'checkmate') sounds.play('check', SLIDE_MS * 0.6);
}

const ENDINGS: Record<Ending, string> = {
  checkmate: 'Chiếu hết',
  stalemate: 'Hoà vì hết nước đi',
  repetition: 'Hoà vì lặp lại thế cờ',
  fifty: 'Hoà theo luật 50 nước',
  material: 'Hoà vì không đủ quân chiếu hết',
  agreement: 'Hai bên đồng ý hoà',
  resign: '',
  leave: 'Đối thủ đã rời bàn',
};

/** The end of the Match: the result shows once the last move settles. */
function end(state: State, animate: boolean) {
  scene.overAt = animate ? performance.now() : performance.now() - END_MS;
  const mine = colourOf(state, me);
  const winner = state.winner;
  const by = winner ? colourOf(state, winner) : null;
  const name = (c: string | null) => (c === 'white' ? 'Trắng' : 'Đen');
  let detail = state.ending ? ENDINGS[state.ending] : '';
  if (state.ending === 'resign') detail = `${name(by === 'white' ? 'black' : 'white')} xin thua`;
  const title = !winner ? 'Hoà' : mine ? (winner === me ? 'Thắng!' : 'Thua') : `${name(by)} thắng`;
  const show = () => banner(title, detail, END_MS + 1200);
  if (animate) {
    window.setTimeout(show, SLIDE_MS + 250);
    sounds.play(!winner ? 'draw' : !mine || winner === me ? 'win' : 'lose', SLIDE_MS + 250);
  } else show();
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
  const left = scene.overAt === null ? ABORT_MS : scene.overAt + END_MS + 600 - performance.now();
  clearTimeout(doneTimer);
  doneTimer = window.setTimeout(() => bridge.done(), Math.max(0, left));
}

function myTurn() {
  const state = scene.state;
  return status === 'playing' && !!state && state.phase === 'play' && state.turn === me && !sending;
}

/** Material ahead for each side, from what is left on the board. */
function material(board: string) {
  let w = 0;
  let b = 0;
  for (const ch of board) {
    if (ch === '.') continue;
    const v = VALUE[ch.toLowerCase()] ?? 0;
    if (ch === ch.toUpperCase()) w += v;
    else b += v;
  }
  return { white: w - b, black: b - w };
}

/** Fills both cards and the buttons. */
function updateHud() {
  const state = scene.state;
  const seated = !!state && !!colourOf(state, me);
  const meId = seated ? me : state?.players[0];
  const themId = state
    ? state.players[0] === meId
      ? state.players[1]
      : state.players[0]
    : undefined;
  const ahead = state ? material(state.board) : null;
  for (const [card, id] of [
    [seatMe, meId],
    [seatThem, themId],
  ] as const) {
    card.hidden = !id || !state;
    if (!id || !state) continue;
    const colour = colourOf(state, id) as 'white' | 'black';
    card.dataset.stone = colour;
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
    const lead = ahead?.[colour] ?? 0;
    (card.querySelector('.tally') as HTMLElement).textContent = lead > 0 ? `+${lead}` : '';
    const won = state.phase === 'over' && state.winner === id;
    const offered = state.phase === 'play' && state.offer === id;
    card.classList.toggle('active', won || (state.phase === 'play' && state.turn === id));
    card.classList.toggle('won', won);
    (card.querySelector('.turn') as HTMLElement).textContent = won ? 'Thắng' : 'Đến lượt';
    (card.querySelector('.offer') as HTMLElement).hidden = !offered;
  }
  const live = seated && status === 'playing' && state?.phase === 'play';
  const theirOffer = live && !!state?.offer && state.offer !== me;
  const myOffer = live && state?.offer === me;
  drawBtn.hidden = resignBtn.hidden = !live;
  declineBtn.hidden = !theirOffer;
  drawBtn.textContent = theirOffer ? 'Đồng ý hoà' : myOffer ? 'Đã cầu hoà' : 'Cầu hoà';
  drawBtn.classList.toggle('primary', theirOffer);
  drawBtn.classList.toggle('done', myOffer);
  drawBtn.disabled = myOffer || sending || (state?.sans.length ?? 0) < 2;
  declineBtn.disabled = resignBtn.disabled = sending;
  if (!resignArmed) resignBtn.textContent = 'Xin thua';
  statusEl.textContent =
    state?.phase === 'play' && state.last?.check && state.turn === me ? 'Chiếu!' : '';
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
    if (view.animating(scene, now) || scene.drag) frame();
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

/** Sends an event; a refusal shows, unless the Hub explains it itself. */
function send(event: string, payload: object) {
  sending = true;
  updateHud();
  return bridge
    .send(event, payload)
    .catch((error: unknown) => {
      if (confirmed && scene.state !== confirmed) {
        scene.slide = null;
        show(confirmed, false);
      }
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

function pick(square: number) {
  const state = scene.state as State;
  const pos = positionOf(state);
  scene.picked = square;
  scene.targets = new Set(
    pos
      .legal()
      .filter((m) => sq64(fromOf(m)) === square)
      .map((m) => sq64(toOf(m))),
  );
}

function unpick() {
  scene.picked = null;
  scene.targets = new Set();
}

/** Plays a move at once on the board, then sends it; a pawn on the last row asks for its piece. */
function move(from: number, to: number, slide: boolean, promo?: string) {
  const state = scene.state as State;
  const piece = state.board[from] ?? '.';
  if (!promo && piece.toLowerCase() === 'p' && (to < 8 || to >= 56)) {
    scene.promo = { from, to };
    unpick();
    frame();
    return;
  }
  const pos = positionOf(state);
  const m = findMove(pos, from, to, promo);
  unpick();
  scene.promo = null;
  if (m === null) return;
  const san = pos.san(m);
  const capture = state.board[to] !== '.' || san.includes('x');
  pos.make(m);
  const check = pos.inCheck();
  const after: State = {
    ...state,
    board: pos.boardString(),
    turn: state.players[0] === state.turn ? state.players[1] : state.players[0],
    sans: [...state.sans, san],
    last: { from, to, san, capture, check },
    offer: null,
  };
  if (san.startsWith('O-O')) {
    const row = from - (from % 8);
    (after.last as NonNullable<State['last']>).rook = san.startsWith('O-O-O')
      ? { from: row, to: row + 3 }
      : { from: row + 7, to: row + 5 };
  }
  played(state, after, true);
  if (!slide) scene.slide = null;
  scene.state = after;
  updateHud();
  frame();
  void send('move', { from, to, ...(promo && { promo }) });
}

const local = (event: PointerEvent) => {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
};
let press: { x: number; y: number; square: number; was: number | null } | null = null;

canvas.addEventListener('pointerdown', (event) => {
  const state = scene.state;
  if (!state || status !== 'playing' || !colourOf(state, me)) return;
  const p = local(event);
  const square = view.squareAt(p.x, p.y, scene.flipped);
  if (scene.promo) {
    const chosen = view.promoSquares(scene).find((s) => s.square === square);
    const { from, to } = scene.promo;
    scene.promo = null;
    if (chosen) move(from, to, true, chosen.kind);
    frame();
    return;
  }
  if (square === null || !myTurn()) return;
  if (scene.picked !== null && scene.targets.has(square)) {
    move(scene.picked, square, true);
    return;
  }
  if (isMine(state, state.board[square] ?? '.')) {
    const was = scene.picked;
    pick(square);
    sounds.play('pick');
    press = { ...p, square, was };
    canvas.setPointerCapture(event.pointerId);
  } else unpick();
  frame();
});

canvas.addEventListener('pointermove', (event) => {
  if (!press) return;
  const p = local(event);
  if (!scene.drag && Math.hypot(p.x - press.x, p.y - press.y) < DRAG_PX) return;
  scene.drag = { from: press.square, x: p.x, y: p.y };
  frame();
});

const release = (event: PointerEvent) => {
  if (!press) return;
  const start = press;
  press = null;
  if (scene.drag) {
    scene.drag = null;
    const p = local(event);
    const square = view.squareAt(p.x, p.y, scene.flipped);
    if (square !== null && scene.targets.has(square) && myTurn()) move(start.square, square, false);
  } else if (start.was === start.square) unpick();
  frame();
};
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', () => {
  press = null;
  scene.drag = null;
  frame();
});

drawBtn.addEventListener('click', () => void send('draw', {}));
declineBtn.addEventListener('click', () => void send('decline', {}));
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

/** Gives the board the space the side panels leave. */
function layout() {
  const style = getComputedStyle(table);
  const width = table.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const height =
    table.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
  const portrait = matchMedia('(orientation: portrait)').matches;
  const [w, h] = portrait
    ? [width, height - sideMe.offsetHeight - sideThem.offsetHeight - 16]
    : [width - 2 * (Math.max(sideMe.offsetWidth, sideThem.offsetWidth, 150) + 12), height];
  const side = Math.max(120, Math.floor(Math.min(w, h)));
  if (side === sized) return;
  sized = side;
  view.resize(side, side);
  frame();
}
let sized = 0;

/** `?splash`: a staged Match, large and tilted, for the Hub's art. */
function stage() {
  scene.state = {
    board: 'r.bq.rk.ppp.bppp...p.n.....Pp.......P.....NB.Q.PPPP..PP.R.B.K..R',
    players: ['a', 'b'],
    turn: 'a',
    castling: 'KQ',
    ep: -1,
    half: 0,
    full: 9,
    keys: [],
    sans: [],
    last: { from: 4, to: 6, san: 'O-O', capture: false, check: false, rook: { from: 7, to: 5 } },
    offer: null,
    phase: 'play',
    winner: null,
    ending: null,
    wins: {},
  };
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
