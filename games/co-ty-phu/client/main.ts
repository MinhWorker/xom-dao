/**
 * Cờ Tỷ Phú's client: plays each `match:state` push on the board one after another (the
 * computer's moves arrive at once; 2× under "Tốc độ" Nhanh), then shows the decision of the
 * newest view. Every `init` redraws everything from its view, and a Match already over is drawn
 * ended at once (one that ends while playing gets its fanfare). The Hub's Đồ họa level picks the
 * board's graphics.
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
import { HOTEL, type View } from '../server/game/model.js';
import { TUNING } from '../server/game/tuning.js';
import { CardShow } from './cardshow.js';
import { type Button, decide, decider, levelName, money, type Panel } from './decisions.js';
import { Hud } from './hud.js';
import { Moments } from './moments.js';
import { type Change, changes, grandeur, pace } from './present.js';
import { BoardView, SEAT_COLORS } from './scene.js';

/** How long the end of the Match shows before the Hub is told. */
const END_MS = 5000;
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
const cards = new CardShow();
const moments = new Moments();

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
let low = false;

const isOver = (view: View) => view.bankrupt.length >= view.players.length - 1;

/** The Hub's graphics level and the player's preferences (`manifest.ts`). */
const applySettings = (settings: BridgeSettings) => {
  low = settings.graphics === 'low';
  board.setGraphics(low ? 'low' : 'high');
  board.setFollowing(settings.preferences?.follow !== false);
};

const bridge = createGameBridge({
  onInit(init) {
    applySettings(init.settings);
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
  onSettings: applySettings,
  onVisibility(paused) {
    hidden = paused;
    board.pause(paused);
    if (paused) moments.land();
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
  cards.hide();
  moments.clear();
}

/** Redraws everything from `view` at once; `fanfare` when the Match just ended on screen. */
function present(view: View | null, fanfare = false) {
  shown = view;
  if (!view || isOver(view)) {
    panel = null;
    cards.hide();
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
    hud.over(view, names, me, fanfare);
    if (fanfare) celebrate(view);
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
  if (panel.card && mine && panel.buttons.length > 0) {
    hud.show(null, false);
    cards.choose(panel.card, names[view.card?.seat ?? view.turn] ?? '', panel.buttons, (b) => {
      cards.busy(true);
      send(b.event, b.payload);
    });
  } else {
    cards.hide();
    hud.show(panel, mine);
  }
  board.highlight(panel.pick?.tiles ?? []);
}

/** The winner's token in a beam of light, and confetti over everything. */
function celebrate(view: View) {
  const winner = view.players.findIndex((p) => !p.bankrupt);
  if (winner < 0 || hidden) return;
  board.victory(winner);
  moments.confetti([SEAT_COLORS[winner] ?? '#e8c04a', '#f6d77a', '#fff2c2', '#e6b422'], 1, low);
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
    const ended = isOver(next) && endedAt === null;
    if (ended) endedAt = performance.now();
    present(next, ended);
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
  /** The pace of the HTML moments: 0 while the tab is hidden skips them. */
  const show = hidden ? 0 : pace;
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
      case 'card': {
        board.follow(null);
        const speed = hidden ? 0 : pace;
        await cards.draw(step.id, names[step.seat] ?? '', speed, low);
        const choosing =
          after.phase === 'card' &&
          after.card?.seat === me &&
          decide(after, me, names).buttons.length > 0;
        if (!choosing && live()) await cards.hold(Math.round(1800 * speed));
        break;
      }
      case 'lot':
      case 'festival':
      case 'blackout':
        if (!building) {
          board.showLots(after);
          building = Promise.all(
            steps.map((s) => s.kind === 'lot' && board.build(s.tile, s.before, s.after, ms(800))),
          );
        }
        if (step.kind === 'lot') announceLot(step, show);
        if (step.kind === 'festival' && step.tile !== null)
          hud.say(`Lễ hội ở ${BOARD[step.tile]?.name}`);
        if (step.kind === 'blackout' && step.tile !== null)
          hud.say(`Mất điện ở ${BOARD[step.tile]?.name}`);
        await wait(ms(420));
        break;
      case 'fullset':
        await building;
        if (!live()) return;
        moments.announce(
          'Đủ bộ màu!',
          `${names[step.seat] ?? ''} · thuê ×${TUNING.fullSet}`,
          'gold',
          2000,
          show,
          { color: SEAT_COLORS[step.seat] },
        );
        await board.fullSet(step.tiles, step.seat, ms(1400));
        break;
      case 'quiz':
        if (after.quiz) await revealQuiz(after, step.right, ms, show, live);
        break;
      case 'pay': {
        const grand = grandeur(step.amount);
        const caption = `${names[step.from] ?? ''} → ${names[step.to] ?? ''}`;
        await building;
        if (!live()) return;
        board.follow(null);
        if (grand >= 3) board.shake(0.16, 900);
        const [from, to] = [hud.card(step.from), hud.card(step.to)];
        await moments.pay(from, to, step.amount, grand, show, low, caption);
        if (grand >= 3 && live()) board.shake(0.1, 400);
        break;
      }
      case 'cash':
        hud.delta(step.seat, step.delta);
        break;
      case 'bankrupt':
        await building;
        if (!live()) return;
        board.showLots(after);
        hud.broke(step.seat);
        moments.announce('Phá sản!', names[step.seat] ?? '', 'bad', 2200, show);
        await board.fall(step.seat, step.lots, ms(2000));
        await wait(ms(400));
        break;
    }
  }
  await building;
  board.follow(null);
  if (steps.some((s) => s.kind === 'cash')) await wait(ms(500));
}

/** Names what happened to a Lot: a Takeover or a new Hotel across the middle, the rest in the banner. */
function announceLot(step: Extract<Change, { kind: 'lot' }>, pace: number) {
  const name = BOARD[step.tile]?.name ?? '';
  const who = (seat: number) => names[seat] ?? '';
  const { before: was, after: now } = step;
  if (!now) hud.say(`${name} về ngân hàng`);
  else if (!was) hud.say(`${who(now.owner)} mua ${name}`);
  else if (was.owner !== now.owner)
    moments.announce(
      'Mua lại!',
      `${who(now.owner)} lấy ${name} của ${who(was.owner)}`,
      'bad',
      2200,
      pace,
    );
  else if (now.level >= HOTEL && was.level < HOTEL)
    moments.announce('Khách sạn!', `${who(now.owner)} · ${name}`, 'gold', 2200, pace, {
      color: SEAT_COLORS[now.owner],
    });
  else if (now.level > was.level) hud.say(`${name} lên ${levelName(now.level)}`);
  else hud.say(`${who(now.owner)} bán bớt nhà ở ${name}`);
}

/**
 * The Quiz's answer: the panel shows the Quiz again with the pick pulsing, then the right answer
 * lights up (the pick shakes when wrong) and the result goes across the middle.
 */
async function revealQuiz(
  after: View,
  right: boolean,
  ms: (n: number) => number,
  pace: number,
  live: () => boolean,
) {
  const quiz = after.quiz;
  if (!quiz) return;
  const asked = decide({ ...after, phase: 'quiz', turn: quiz.seat }, me, names);
  hud.show(asked, false);
  hud.quizWait(quiz.picked);
  await wait(ms(quiz.picked === null ? 500 : 1100));
  if (!live()) return;
  hud.quizResult(quiz.answer ?? 0, quiz.picked);
  const won = TUNING.quiz.safe * TUNING.quiz.times;
  const answer = asked.buttons[quiz.answer ?? 0]?.label ?? '';
  if (right) {
    moments.announce('Đúng rồi!', `+${money(won)}`, 'good', 1800, pace, { bottom: true });
    moments.confetti(['#58b368', '#f6d77a', '#fff2c2'], pace, low, 45);
  } else
    moments.announce(
      quiz.picked === null ? 'Hết giờ!' : 'Sai mất rồi',
      `Đáp án: ${answer}`,
      'bad',
      1800,
      pace,
      { bottom: true },
    );
  await wait(ms(1700));
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
