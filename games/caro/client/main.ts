/** Caro's client: draws the Match from the Hub's pushes and sends the player's marks. */
import {
  BRIDGE_RESET,
  BRIDGE_UNAVAILABLE,
  BridgeError,
  type BridgeSeat,
  createGameBridge,
} from '@xomdao/bridge';
import { at, keyOf, markOf, points } from '../server/game/board.js';
import type { Point, State } from '../server/game/model.js';
import { BoardView, LINE_MS, MARK_MS, type Scene } from './render.js';
import { Sounds } from './sound.js';

/** How long the finished board stays after the winning line is drawn. */
const LINGER_MS = 900;
/** How long a refusal stays on screen. */
const TOAST_MS = 2200;
/** The turn cue waits for the other side's mark to land first. */
const TURN_CUE_MS = MARK_MS + 160;

/** The part of a `match:state` push the client reads. */
interface MatchPush {
  matchId: string;
  status: 'loading' | 'playing' | 'over';
  view?: State;
}

const canvas = document.getElementById('board') as HTMLCanvasElement;
const table = document.querySelector('.table') as HTMLElement;
const seatX = document.getElementById('seat-x') as HTMLElement;
const seatO = document.getElementById('seat-o') as HTMLElement;
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
const scene: Scene = {
  state: null,
  pending: null,
  hover: null,
  mine: null,
  placedAt: new Map(),
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
    donePendingFor = null;
    scene.placedAt.clear();
    scene.overAt = null;
    show((init.match as State | null) ?? null, false);
  },
  onMessage(event, data) {
    if (event !== 'match:state') return;
    const push = data as MatchPush;
    const fresh = push.matchId !== matchId;
    if (fresh) {
      scene.placedAt.clear();
      scene.overAt = null;
    }
    matchId = push.matchId;
    status = push.status;
    show(push.view ?? null, !fresh);
    if (fresh && status === 'playing' && scene.state && !scene.state.last && myTurn()) {
      sounds.play('turn');
    }
    if (status === 'over') finish(push.matchId);
  },
  onSettings: (settings) => sounds.apply(settings),
  onVisibility: (hidden) => sounds.setHidden(hidden),
});

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
      if (status === 'playing' && state.turn === me) sounds.play('turn', TURN_CUE_MS);
    }
  }
  if (state && (state.line || status === 'over') && scene.overAt === null) {
    scene.overAt = animate ? now : now - LINE_MS;
  }
  scene.state = state;
  scene.pending = null;
  scene.mine = state && markOf(state, me);
  if (state) view.track(state.board, now, animate);
  updateSeats();
  frame();
}

/** Tells the Hub the end of the Match has played out, once per Match. */
function finish(id: string) {
  if (doneSentFor === id || donePendingFor === id) return;
  donePendingFor = id;
  clearTimeout(doneTimer);
  doneTimer = window.setTimeout(() => {
    donePendingFor = null;
    doneSentFor = id;
    bridge.done();
  }, LINE_MS + LINGER_MS);
}

/** Whether the player's own tap already played the sound of the mark on `p`. */
function placedByHand(p: Point) {
  return scene.pending?.x === p.x && scene.pending?.y === p.y;
}

const myTurn = () =>
  status === 'playing' && !!scene.state && !scene.pending && scene.state.turn === me;

function updateSeats() {
  const state = scene.state;
  for (const [el, index] of [
    [seatX, 0],
    [seatO, 1],
  ] as const) {
    const id = state?.players[index];
    el.hidden = !id;
    if (!id) continue;
    (el.querySelector('.name') as HTMLElement).textContent =
      seats.find((s) => s.id === id)?.name ?? '';
    el.classList.toggle('active', status === 'playing' && state.turn === id);
    el.classList.toggle('me', id === me);
    (el.querySelector('.who') as HTMLElement).textContent = id === me ? 'Bạn' : '';
  }
}

let raf = 0;
function frame() {
  if (raf) return;
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
    ? [width, height - 2 * (seatX.offsetHeight + 12)]
    : [width - 2 * (Math.max(seatX.offsetWidth, 120) + 12), height];
  view.resize(Math.max(120, Math.floor(w)), Math.max(120, Math.floor(h)));
  frame();
}

new ResizeObserver(layout).observe(table);
layout();
bridge.ready();
