/**
 * Cờ Tỷ Phú's client: plays each `match:state` push on the board one after another (the
 * computer's moves arrive at once; 2× under "Tốc độ" Nhanh), then shows the decision of the
 * newest view. Every `init` redraws everything from its view, and a Match already over is drawn
 * ended at once. The Hub's Đồ họa level picks the board's graphics.
 */
import {
  BRIDGE_RESET,
  BRIDGE_UNAVAILABLE,
  BridgeError,
  type BridgeSeat,
  type BridgeSettings,
  createGameBridge,
} from '@xomdao/bridge';
import { BOARD } from '../server/game/board.js';
import type { View } from '../server/game/model.js';
import { type Button, decide, decider, levelName, type Panel } from './decisions.js';
import { Hud } from './hud.js';
import { type Change, changes, pace } from './present.js';
import { BoardView } from './scene.js';

/** How long the end of the Match shows before the Hub is told. */
const END_MS = 3500;
/** How soon a Match stopped without an end hands over to the Hub. */
const ABORT_MS = 400;

interface MatchPush {
  matchId: string;
  status: 'loading' | 'playing' | 'over';
  view?: View;
  timer?: { ms: number } | null;
}

const canvas = document.getElementById('view') as HTMLCanvasElement;
const board = new BoardView(canvas);
const hud = new Hud();

let myId = '';
let me = -1;
let names: string[] = [];
let matchId: string | null = null;
/** The view on screen. */
let shown: View | null = null;
/** Views still to play, oldest first. */
const queue: View[] = [];
let playing = false;
/** Bumped by every `init`: a play under way for an older one stops. */
let epoch = 0;
/** The decision clock of the last push, counted from when it arrived. */
let timer: { ms: number; at: number } | null = null;
let panel: Panel | null = null;
let sending = false;
let endedAt: number | null = null;
let doneFor: string | null = null;
let doneTimer = 0;
let hidden = false;

const isOver = (view: View) => view.bankrupt.length >= view.players.length - 1;

const applyGraphics = (settings: BridgeSettings) => board.setGraphics(settings.graphics ?? 'high');

const bridge = createGameBridge({
  onInit(init) {
    applyGraphics(init.settings);
    restart();
    myId = init.player.id;
    const seats: BridgeSeat[] = init.room.seats;
    names = seats.map((s) => s.name);
    me = seats.findIndex((s) => s.id === myId);
    matchId = null;
    timer = null;
    clearTimeout(doneTimer);
    doneFor = null;
    endedAt = null;
    hud.tile(null, null, names);
    const view = (init.match as View | null) ?? null;
    hud.seats(view ? names.slice(0, view.players.length) : names);
    present(view);
  },
  onMessage(event, data) {
    if (event !== 'match:state') return;
    const push = data as MatchPush;
    const fresh = push.matchId !== matchId;
    if (fresh) {
      matchId = push.matchId;
      clearTimeout(doneTimer);
      doneFor = null;
      if (push.status !== 'over') endedAt = null;
      restart();
    }
    timer = push.timer ? { ms: push.timer.ms, at: Date.now() } : null;
    if (push.view) {
      if (fresh || !shown || shown.players.length !== push.view.players.length) {
        hud.seats(names.slice(0, push.view.players.length));
        present(push.view);
      } else queue.push(push.view);
      play();
    }
    if (push.status === 'over') finish(push.matchId);
  },
  onSettings: applyGraphics,
  onVisibility(paused) {
    hidden = paused;
    board.pause(paused);
    document.documentElement.classList.toggle('paused', paused);
  },
});

/** Stops what is playing and drops the queued views: an `init` or a new Match redraws. */
function restart() {
  epoch++;
  queue.length = 0;
  playing = false;
  sending = false;
  board.stop();
  hud.hideCard();
}

/** Redraws everything from `view` at once. */
function present(view: View | null) {
  shown = view;
  hud.hideCard();
  if (!view || isOver(view)) {
    panel = null;
    board.highlight([]);
  }
  if (!view) {
    hud.show(null, false);
    hud.over(null, names, me);
    return;
  }
  board.show(view);
  hud.players(view);
  if (isOver(view)) {
    endedAt ??= performance.now() - END_MS;
    hud.over(view, names, me);
    return;
  }
  hud.over(null, names, me);
  ask(view);
}

/** Shows the decision of `view`: buttons for the player who decides, who is deciding to the rest. */
function ask(view: View) {
  panel = decide(view, me, names);
  sending = false;
  const mine = panel.buttons.some((b) => !b.disabled) || !!panel.pick;
  hud.show(panel, mine);
  board.highlight(panel.pick?.tiles ?? []);
}

/** Plays the queued views one after another, faster while more are waiting. */
async function play() {
  if (playing) return;
  playing = true;
  const mine = epoch;
  while (queue.length > 0 && mine === epoch) {
    const next = queue.shift() as View;
    const before = shown;
    if (!before) {
      present(next);
      continue;
    }
    hud.show(null, false);
    board.highlight([]);
    await animate(next, changes(before, next), pace(next, queue.length), () => mine === epoch);
    if (mine !== epoch) break;
    if (isOver(next) && endedAt === null) endedAt = performance.now();
    present(next);
  }
  if (mine === epoch) playing = false;
}

const wait = (ms: number) => new Promise((done) => setTimeout(done, hidden ? 0 : ms));

/**
 * Plays `steps`, what changed on the way to `after`; `pace` below 1 hurries it. Stops once
 * `live` says a redraw took over.
 */
async function animate(after: View, steps: Change[], pace: number, live: () => boolean) {
  const ms = (n: number) => Math.round(n * pace);
  board.setPace(pace);
  /** Every Lot that changed builds at once, from the first Lot step on. */
  let building: Promise<unknown> | null = null;
  for (const step of steps) {
    if (!live()) return;
    switch (step.kind) {
      case 'dice':
        await board.roll(step.dice, ms(900));
        break;
      case 'walk':
        await board.walk(step.seat, step.from, step.steps, ms(170));
        break;
      case 'release':
        hud.say(`${names[step.seat] ?? ''} ra tù`);
        await board.release(step.seat, ms(650));
        break;
      case 'jump':
        if (step.how === 'jail') hud.say(`${names[step.seat] ?? ''} vào tù`);
        await board.jump(step.seat, step.to, ms(step.how === 'flight' ? 1400 : 560), step.how);
        break;
      case 'card':
        board.follow(null);
        await board.drawCard(step.id, ms(750));
        hud.drawn(step.id, names[step.seat] ?? '');
        await wait(ms(1500));
        hud.hideCard();
        await board.putCard(ms(320));
        break;
      case 'lot':
      case 'festival':
      case 'blackout':
        if (!building) {
          board.showLots(after);
          building = Promise.all(
            steps.map((s) => s.kind === 'lot' && board.build(s.tile, s.before, s.after, ms(800))),
          );
        }
        if (step.kind === 'lot') announceLot(step);
        if (step.kind === 'festival' && step.tile !== null)
          hud.say(`Lễ hội ở ${BOARD[step.tile]?.name}`);
        if (step.kind === 'blackout' && step.tile !== null)
          hud.say(`Mất điện ở ${BOARD[step.tile]?.name}`);
        await wait(ms(420));
        break;
      case 'quiz':
        if (after.quiz) {
          hud.show(decide({ ...after, phase: 'quiz', turn: after.quiz.seat }, me, names), false);
          hud.quizResult(after.quiz.answer ?? 0, after.quiz.picked);
          hud.say(step.right ? 'Đúng rồi!' : 'Sai mất rồi');
          await wait(ms(1600));
        }
        break;
      case 'cash':
        hud.delta(step.seat, step.delta);
        break;
      case 'bankrupt':
        hud.say(`${names[step.seat] ?? ''} phá sản`, 2200);
        await wait(ms(1400));
        break;
    }
  }
  await building;
  board.follow(null);
  if (steps.some((s) => s.kind === 'cash')) await wait(ms(500));
}

/** Names what happened to a Lot in the banner. */
function announceLot(step: Extract<Change, { kind: 'lot' }>) {
  const name = BOARD[step.tile]?.name ?? '';
  const who = (seat: number) => names[seat] ?? '';
  const { before: was, after: now } = step;
  if (!now) hud.say(`${name} về ngân hàng`);
  else if (!was) hud.say(`${who(now.owner)} mua ${name}`);
  else if (was.owner !== now.owner) hud.say(`${who(now.owner)} mua lại ${name}`);
  else if (now.level > was.level) hud.say(`${name} lên ${levelName(now.level)}`);
  else hud.say(`${who(now.owner)} bán bớt nhà ở ${name}`);
}

/** The Match is over: once its end has shown, tells the Hub, once per Match. */
function finish(id: string) {
  if (doneFor === id) return;
  doneFor = id;
  const check = () => {
    if (doneFor !== id) return;
    if (playing || queue.length > 0) {
      doneTimer = window.setTimeout(check, 200);
      return;
    }
    const left = endedAt === null ? ABORT_MS : endedAt + END_MS - performance.now();
    doneTimer = window.setTimeout(() => bridge.done(), Math.max(0, left));
  };
  check();
}

/** Sends a move; the panel waits for the next view, or shows the refusal. */
function send(event: string, payload?: Record<string, unknown>) {
  if (sending) return;
  sending = true;
  hud.busy(true);
  board.highlight([]);
  bridge.send(event, payload ?? {}).catch((error: unknown) => {
    sending = false;
    if (shown && queue.length === 0 && !playing) ask(shown);
    const refusal = error instanceof BridgeError ? error.code : '';
    if (refusal && refusal !== BRIDGE_RESET && refusal !== BRIDGE_UNAVAILABLE) hud.refuse(refusal);
  });
}

hud.onButton = (button: Button) => send(button.event, button.payload);

canvas.addEventListener('pointerdown', (event) => {
  const rect = canvas.getBoundingClientRect();
  const tile = board.tileAt(event.clientX - rect.left, event.clientY - rect.top);
  const pick = panel?.pick;
  if (tile !== null && pick && !sending && !playing && pick.tiles.includes(tile)) {
    hud.tile(null, null, names);
    send(pick.event, pick.payload(tile));
    return;
  }
  hud.tile(shown, tile, names);
});

/** The turn clock, from the last push's timer. */
function clock() {
  requestAnimationFrame(clock);
  if (!timer || !shown || isOver(shown) || playing) {
    hud.timer(null, -1);
    return;
  }
  const left = Math.max(0, timer.ms - (Date.now() - timer.at)) / timer.ms;
  hud.timer(left, decider(shown));
}
clock();

new ResizeObserver(() => board.resize(window.innerWidth, window.innerHeight)).observe(
  document.body,
);
board.resize(window.innerWidth, window.innerHeight);
bridge.ready();
