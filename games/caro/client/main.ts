/** Caro's client: draws the Match from the Hub's pushes and sends the player's marks. */
import {
  BRIDGE_RESET,
  BRIDGE_UNAVAILABLE,
  BridgeError,
  type BridgeSeat,
  createGameBridge,
} from '@xomdao/bridge';
import { at, isDraw, keyOf, markOf, points } from '../server/game/board.js';
import type { Point, State } from '../server/game/model.js';
import { BoardView, END_MS, type Ending, LINE_AT, MARK_MS, type Scene } from './render.js';
import { Sounds } from './sound.js';

/** How soon a Match that ended without a winner or a draw (aborted) hands over to the Hub. */
const ABORT_MS = 400;
/** How long a refusal stays on screen. */
const TOAST_MS = 2200;
/** The turn cue waits for the other side's mark to land first. */
const TURN_CUE_MS = MARK_MS + 160;

/** The part of a `match:state` push the client reads. */
interface MatchPush {
  matchId: string;
  status: 'loading' | 'playing' | 'over';
  view?: State;
  result?: { seats: { player: string; place: number }[] };
}

const canvas = document.getElementById('board') as HTMLCanvasElement;
const table = document.querySelector('.table') as HTMLElement;
const seatLeft = document.getElementById('seat-left') as HTMLElement;
const seatRight = document.getElementById('seat-right') as HTMLElement;
const toast = document.getElementById('toast') as HTMLElement;
const view = new BoardView(canvas);
const sounds = new Sounds();

let me = '';
let seats: BridgeSeat[] = [];
let matchId: string | null = null;
let status: MatchPush['status'] = 'loading';
let doneSentFor: string | null = null;
let donePendingFor: string | null = null;
let doneTimer = 0;
let hidden = false;
const scene: Scene = {
  state: null,
  pending: null,
  hover: null,
  mine: null,
  placedAt: new Map(),
  overAt: null,
  ending: null,
};

const bridge = createGameBridge({
  onInit(init) {
    sounds.apply(init.settings);
    me = init.player.id;
    seats = init.room.seats;
    matchId = null;
    status = 'loading';
    clearTimeout(doneTimer);
    donePendingFor = null;
    scene.placedAt.clear();
    scene.overAt = null;
    scene.ending = null;
    show((init.match as State | null) ?? null, false);
  },
  onMessage(event, data) {
    if (event !== 'match:state') return;
    const push = data as MatchPush;
    const fresh = push.matchId !== matchId;
    if (fresh) {
      scene.placedAt.clear();
      scene.overAt = null;
      scene.ending = null;
    }
    matchId = push.matchId;
    status = push.status;
    if (push.view || status !== 'over') show(push.view ?? null, !fresh);
    if (fresh && status === 'playing' && scene.state && !scene.state.last && myTurn()) {
      sounds.play('turn');
    }
    if (status === 'over') finish(push);
  },
  onSettings: (settings) => sounds.apply(settings),
  onVisibility: pause,
});

/** Mutes and stops every animation while the Hub's tab is hidden; redraws when it shows again. */
function pause(paused: boolean) {
  hidden = paused;
  sounds.setHidden(paused);
  document.documentElement.classList.toggle('paused', paused);
  if (!paused) frame();
  else if (raf) {
    cancelAnimationFrame(raf);
    raf = 0;
  }
}

/** Shows a state; `animate` draws what changed since the last one. */
function show(state: State | null, animate: boolean) {
  const now = performance.now();
  const before = scene.state;
  if (state && animate && before) {
    let theirs = false;
    for (const p of points(state.board)) {
      const mark = at(state.board, p);
      if (!mark || at(before.board, p)) continue;
      scene.placedAt.set(keyOf(p), now);
      if (mark !== markOf(state, me)) theirs = true;
      else if (!placedByHand(p)) sounds.play('place');
    }
    if (theirs) {
      sounds.play('other');
      if (status === 'playing' && state.turn === me && !endingOf(state)) {
        sounds.play('turn', TURN_CUE_MS);
      }
    }
  }
  scene.state = state;
  scene.pending = null;
  scene.mine = state && markOf(state, me);
  const ending = state && endingOf(state);
  if (ending) end(ending, animate);
  if (state) view.track(state.board, now, animate);
  updateSeats();
  frame();
}

/** How the Match on the board ended for this player, `null` while it goes on. */
function endingOf(state: State): Ending | null {
  if (state.line) {
    const winner = at(state.board, state.line[0] as Point);
    return !scene.mine ? 'watch' : winner === scene.mine ? 'win' : 'lose';
  }
  return isDraw(state.board) ? 'draw' : null;
}

/** Starts the end of the Match: the winning line and its sound, or the draw; at once on a redraw. */
function end(ending: Ending, animate: boolean) {
  if (scene.overAt !== null) return;
  const now = performance.now();
  scene.overAt = animate ? now : now - END_MS;
  scene.ending = ending;
  if (animate) sounds.play(ending === 'watch' ? 'win' : ending, LINE_AT);
}

/**
 * The Match is over: once its end has played out, tells the Hub, once per Match. The end starts
 * here when the last view did not show it (an older server), from the result.
 */
function finish(push: MatchPush) {
  const id = push.matchId;
  if (doneSentFor === id || donePendingFor === id) return;
  if (scene.overAt === null && push.result) {
    const places = push.result.seats;
    const mine = places.find((seat) => seat.player === me);
    const draw = places.every((seat) => seat.place === places[0]?.place);
    end(draw ? 'draw' : !mine ? 'watch' : mine.place === 1 ? 'win' : 'lose', true);
    updateSeats();
    frame();
  }
  const left = scene.overAt === null ? ABORT_MS : scene.overAt + END_MS - performance.now();
  donePendingFor = id;
  clearTimeout(doneTimer);
  doneTimer = window.setTimeout(
    () => {
      donePendingFor = null;
      doneSentFor = id;
      bridge.done();
    },
    Math.max(0, left),
  );
}

/** Whether the player's own tap already played the sound of the mark on `p`. */
function placedByHand(p: Point) {
  return scene.pending?.x === p.x && scene.pending?.y === p.y;
}

const myTurn = () =>
  status === 'playing' &&
  !!scene.state &&
  !scene.pending &&
  scene.ending === null &&
  scene.state.turn === me;

/** Fills the seat cards: the player's own on the left (X for a spectator), with the series score. */
function updateSeats() {
  const state = scene.state;
  const order = scene.mine === 'O' ? [1, 0] : [0, 1];
  for (const [el, index] of [
    [seatLeft, order[0]],
    [seatRight, order[1]],
  ] as const) {
    const id = state?.players[index as 0 | 1];
    el.hidden = !id;
    if (!id) {
      el.classList.remove('active', 'won');
      continue;
    }
    const mark = index ? 'O' : 'X';
    el.dataset.mark = mark;
    (el.querySelector('.name') as HTMLElement).textContent =
      seats.find((s) => s.id === id)?.name ?? '';
    const wins = el.querySelector('.wins') as HTMLElement;
    const score = String(state.wins?.[id] ?? 0);
    if (wins.dataset.player === id && wins.textContent !== score) {
      wins.classList.remove('bump');
      void wins.offsetWidth;
      wins.classList.add('bump');
    }
    wins.dataset.player = id;
    wins.textContent = score;
    const won = !!state.line && at(state.board, state.line[0] as Point) === mark;
    el.classList.toggle(
      'active',
      won || (status === 'playing' && scene.ending === null && state.turn === id),
    );
    el.classList.toggle('won', won);
    (el.querySelector('.turn') as HTMLElement).textContent = won ? 'Thắng' : 'Đến lượt';
    el.classList.toggle('me', id === me);
    (el.querySelector('.who') as HTMLElement).textContent = id === me ? 'Bạn' : '';
  }
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

function cellUnder(event: PointerEvent): Point | null {
  if (!scene.state) return null;
  const rect = canvas.getBoundingClientRect();
  return view.cellAt(
    scene.state.board,
    event.clientX - rect.left,
    event.clientY - rect.top,
    performance.now(),
  );
}

canvas.addEventListener('pointermove', (event) => {
  if (event.pointerType !== 'mouse') return;
  const cell = myTurn() ? cellUnder(event) : null;
  if (cell?.x === scene.hover?.x && cell?.y === scene.hover?.y) return;
  scene.hover = cell;
  frame();
});

canvas.addEventListener('pointerleave', () => {
  scene.hover = null;
  frame();
});

canvas.addEventListener('pointerdown', (event) => {
  if (!myTurn() || !scene.state) return;
  const cell = cellUnder(event);
  if (!cell || at(scene.state.board, cell) !== null) return;
  scene.pending = cell;
  scene.hover = null;
  sounds.play('place');
  frame();
  bridge.send('place', cell).catch((error: unknown) => {
    if (scene.pending?.x === cell.x && scene.pending?.y === cell.y) scene.pending = null;
    frame();
    const refusal = error instanceof BridgeError ? error.code : '';
    if (refusal && refusal !== BRIDGE_RESET && refusal !== BRIDGE_UNAVAILABLE) {
      sounds.play('refused');
      say(refusal);
    }
  });
});

let toastTimer = 0;
/** Shows the server's refusal of a move. */
function say(message: string) {
  toast.textContent = message;
  toast.classList.add('shown');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('shown'), TOAST_MS);
}

/** Gives the board the space the seat cards leave. */
function layout() {
  const style = getComputedStyle(table);
  const width = table.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const height =
    table.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
  const portrait = matchMedia('(orientation: portrait)').matches;
  const [w, h] = portrait
    ? [width, height - 2 * (seatLeft.offsetHeight + 12)]
    : [width - 2 * (Math.max(seatLeft.offsetWidth, 120) + 12), height];
  view.resize(Math.max(120, Math.floor(w)), Math.max(120, Math.floor(h)));
  frame();
}

new ResizeObserver(layout).observe(table);
layout();
bridge.ready();
