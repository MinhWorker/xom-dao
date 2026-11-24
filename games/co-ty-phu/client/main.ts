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
import { cardOf } from '../server/game/cards.js';
import { HOTEL, type View } from '../server/game/model.js';
import { TUNING } from '../server/game/tuning.js';
import { CardShow } from './cardshow.js';
import { type Button, decide, decider, levelName, money, type Panel } from './decisions.js';
import { Hud } from './hud.js';
import { Moments } from './moments.js';
import { type Change, changes, grandeur, pace } from './present.js';
import { BoardView, SEAT_COLORS } from './scene.js';
import { Sounds, ticks } from './sound.js';

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
const sounds = new Sounds();

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
/** The ms left on the clock when it was last drawn, for its ticks. */
let clockLeft = Infinity;
let panel: Panel | null = null;
let sending = false;
let endedAt: number | null = null;
let doneFor: string | null = null;
let doneTimer = 0;
let hidden = false;
/** The player may tap the dice to roll. */
let rolling = false;
const rollButton = document.getElementById('roll') as HTMLButtonElement;
let low = false;

const isOver = (view: View) => view.bankrupt.length >= view.players.length - 1;

/** The Hub's graphics level and the player's preferences (`manifest.ts`). */
const applySettings = (settings: BridgeSettings) => {
  sounds.apply(settings);
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
    sounds.setHidden(paused);
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
  sounds.stop();
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
  if (!view || isOver(view)) idle();
  if (!view) {
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

/** Clears the decision on screen while moves play: its buttons, the roll and its line on the board. */
function idle() {
  hud.show([]);
  board.status(null);
  rolling = false;
  board.inviteRoll(false);
}

/**
 * Shows the decision of `view`. What it is about is printed on the board (who is deciding, for the
 * others); the player deciding gets its buttons, or the dice to tap and a blinking line for a roll.
 */
function ask(view: View) {
  panel = decide(view, me, names);
  sending = false;
  const mine = panel.buttons.some((b) => !b.disabled) || !!panel.pick;
  idle();
  if (view.phase === 'quiz' && view.quiz) {
    showQuiz(
      view,
      panel,
      mine
        ? (b) => {
            cards.busy(true);
            send(b.event, b.payload);
          }
        : null,
    );
  } else if (panel.card && mine && panel.buttons.length > 0) {
    cards.choose(panel.card, names[view.card?.seat ?? view.turn] ?? '', panel.buttons, (b) => {
      cards.busy(true);
      send(b.event, b.payload);
    });
  } else {
    cards.hide();
    const roll = mine ? panel.buttons.find((b) => b.event === 'roll' && !b.disabled) : undefined;
    rolling = !!roll;
    board.inviteRoll(rolling);
    board.status(
      roll
        ? { title: roll.label, sub: panel.title, tone: 'gold', blink: true }
        : { title: panel.title, ...(panel.text && { sub: panel.text }) },
    );
    hud.show(mine ? panel.buttons.filter((b) => b.event !== 'roll') : []);
  }
  board.highlight(panel.pick?.tiles ?? []);
}

/** The winner's token in a beam of light, and confetti over everything. */
function celebrate(view: View) {
  const winner = view.players.findIndex((p) => !p.bankrupt);
  if (winner < 0 || hidden) return;
  board.victory(winner);
  sounds.play('victory');
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
    idle();
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
  /** Per seat, the cash a payment already counted on its card. */
  const counted: number[] = [];
  for (const step of steps) {
    if (!live()) return;
    switch (step.kind) {
      case 'dice':
        rollBeats(step.dice.length, ms);
        await board.roll(step.dice, ms(900));
        break;
      case 'walk':
        for (let k = 1; k <= step.steps; k++) sounds.play('step', { at: k * ms(170) });
        await board.walk(step.seat, step.from, step.steps, ms(170));
        break;
      case 'release':
        board.say(`${names[step.seat] ?? ''} ra tù`);
        sounds.play('release');
        await board.release(step.seat, ms(650));
        break;
      case 'jump':
        if (step.how === 'jail') board.say(`${names[step.seat] ?? ''} vào tù`, { tone: 'bad' });
        if (step.how === 'flight') {
          sounds.play('plane', { rate: 1 / pace });
          sounds.play('slam', { at: ms(1400), gain: 0.7 });
        } else if (step.how === 'jail') sounds.play('jail', { at: ms(560 + 504 * BOUNCE_LAND) });
        else sounds.play('step', { at: ms(560) });
        await board.jump(step.seat, step.to, ms(step.how === 'flight' ? 1400 : 560), step.how);
        break;
      case 'card': {
        board.follow(null);
        const speed = hidden ? 0 : pace;
        if (!low) sounds.play('card-slide', { at: 260 * speed });
        sounds.play('card', { at: low ? 0 : 1230 * speed });
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
          for (const s of steps) if (s.kind === 'lot') lotSounds(s, ms);
        }
        if (step.kind === 'lot') announceLot(step);
        if (step.kind === 'festival' && step.tile !== null)
          board.say('Lễ hội', { sub: BOARD[step.tile]?.name, tone: 'gold' });
        if (step.kind === 'blackout' && step.tile !== null)
          board.say('Mất điện', { sub: BOARD[step.tile]?.name, tone: 'bad' });
        await wait(ms(420));
        break;
      case 'fullset':
        await building;
        if (!live()) return;
        fullSetBeats(step.tiles.length, ms);
        board.say('Đủ bộ màu!', {
          sub: `${names[step.seat] ?? ''} · thuê ×${TUNING.fullSet}`,
          tone: 'gold',
          big: true,
          ms: 2200,
        });
        await board.fullSet(step.tiles, step.seat, ms(1400));
        break;
      case 'quiz':
        if (after.quiz) await revealQuiz(after, step.right, ms, show, live);
        break;
      case 'pay': {
        const grand = grandeur(step.amount);
        await building;
        if (!live()) return;
        board.follow(null);
        if (grand >= 2) board.shake(grand >= 3 ? 0.18 : 0.08, grand >= 3 ? 900 : 500);
        const bill = {
          title: billTitle(step, after),
          from: names[step.from] ?? '',
          to: names[step.to] ?? '',
          amount: step.amount,
        };
        const { from, to, amount } = step;
        await moments.pay(hud.card(from), hud.card(to), bill, grand, show, {
          low,
          payer: from === me,
          onPaid: () => sounds.play('stamp'),
          onCoin: () => sounds.play('coin', { gain: 0.55, rate: 0.9 + Math.random() * 0.35 }),
          onFly: (flight) => {
            hud.delta(from, -amount, flight);
            hud.delta(to, amount, flight);
            counted[from] = (counted[from] ?? 0) - amount;
            counted[to] = (counted[to] ?? 0) + amount;
          },
        });
        break;
      }
      case 'cash': {
        const rest = step.delta - (counted[step.seat] ?? 0);
        if (rest !== 0) {
          sounds.play('coins');
          hud.delta(step.seat, rest, ms(600));
        }
        break;
      }
      case 'bankrupt':
        await building;
        if (!live()) return;
        board.showLots(after);
        hud.broke(step.seat);
        sounds.play('bankrupt');
        sounds.play('slam', { at: ms(257), gain: 0.8 });
        for (let k = 0; k < step.lots.length; k++)
          sounds.play('crumble', { at: ms(700 + k * 300), gain: 0.8 });
        board.say('Phá sản!', { sub: names[step.seat], tone: 'bad', big: true, ms: 2400 });
        await board.fall(step.seat, step.lots, ms(2000));
        await wait(ms(400));
        break;
    }
  }
  await building;
  board.follow(null);
  if (steps.some((s) => s.kind === 'cash')) await wait(ms(500));
}

/** Where in a bounce-out (`scene.ts`) a falling thing first lands. */
const BOUNCE_LAND = 1 / 2.75;

/** The dice's clacks, on `roll`'s landing and its two smaller bounces; the second die just after. */
function rollBeats(dice: number, ms: (n: number) => number) {
  const beats = [
    { at: 405, gain: 1 },
    { at: 648, gain: 0.5 },
    { at: 792, gain: 0.25 },
  ];
  for (const { at, gain } of beats)
    for (let d = 0; d < dice; d++)
      sounds.play('dice-hit', {
        at: ms(at) + d * 28,
        gain: gain * (d ? 0.8 : 1),
        rate: 1 + d * 0.12,
      });
}

/** A Lot's sounds as `board.build` plays it: bought, Taken over (yanked up, slammed down), a new Hotel, or each house rising. */
function lotSounds(step: Extract<Change, { kind: 'lot' }>, ms: (n: number) => number) {
  const { before: was, after: now } = step;
  if (!now) return;
  if (!was) sounds.play('buy');
  else if (was.owner !== now.owner) {
    sounds.play('takeover');
    sounds.play('slam', { at: ms(752) });
  } else if (now.level >= HOTEL && was.level < HOTEL) sounds.play('hotel');
  else for (let k = 0; k < now.level - was.level; k++) sounds.play('build', { at: ms(144 * k) });
}

/** A rising chime as each of a Full set's `tiles` Tiles lights, then its gold sparkle. */
function fullSetBeats(tiles: number, ms: (n: number) => number) {
  const steps = [1, 1.26, 1.5, 2];
  for (let k = 0; k < tiles; k++)
    sounds.play('chime', { at: ms(252 * k), rate: steps[k % steps.length] });
  sounds.play('fullset', { at: ms(252 * (tiles - 1) + 630) });
}

/** Prints what happened to a Lot in the middle of the board; a Takeover or a new Hotel big. */
function announceLot(step: Extract<Change, { kind: 'lot' }>) {
  const name = BOARD[step.tile]?.name ?? '';
  const who = (seat: number) => names[seat] ?? '';
  const { before: was, after: now } = step;
  if (!now) board.say(`${name} về ngân hàng`);
  else if (!was) board.say(`${who(now.owner)} mua ${name}`);
  else if (was.owner !== now.owner)
    board.say('Mua lại!', {
      sub: `${who(now.owner)} lấy ${name} của ${who(was.owner)}`,
      tone: 'bad',
      big: true,
      ms: 2400,
    });
  else if (now.level >= HOTEL && was.level < HOTEL)
    board.say('Khách sạn!', {
      sub: `${who(now.owner)} · ${name}`,
      tone: 'gold',
      big: true,
      ms: 2400,
    });
  else if (now.level > was.level) board.say(`${name} lên ${levelName(now.level)}`);
  else board.say(`${who(now.owner)} bán bớt nhà ở ${name}`);
}

/** What a bill is for: the rent or Takeover of a Lot, the Card drawn, or a Debt. */
function billTitle(step: Extract<Change, { kind: 'pay' }>, after: View) {
  const lot = step.tile === null ? '' : (BOARD[step.tile]?.name ?? '');
  if (step.why === 'rent') return `Tiền thuê · ${lot}`;
  if (step.why === 'takeover') return `Mua lại · ${lot}`;
  if (step.why === 'card' && after.card) return cardOf(TUNING, after.card.id).name;
  return 'Trả nợ';
}

/**
 * The Quiz's answer: the Quiz's Card shows with the pick pulsing, then the right answer lights up
 * (the pick shakes when wrong); the Card goes and the result is printed on the board.
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
  showQuiz(after, asked, null);
  cards.quizWait(quiz.picked);
  await wait(ms(quiz.picked === null ? 500 : 1100));
  if (!live()) return;
  cards.quizResult(quiz.answer ?? 0, quiz.picked);
  sounds.play(right ? 'right' : 'wrong');
  await wait(ms(1100));
  if (!live()) return;
  cards.hide();
  const won = TUNING.quiz.safe * TUNING.quiz.times;
  const answer = asked.buttons[quiz.answer ?? 0]?.label ?? '';
  if (right) {
    board.say('Đúng rồi!', { sub: `+${money(won)}`, tone: 'good', big: true, ms: 2000 });
    moments.confetti(['#58b368', '#f6d77a', '#fff2c2'], pace, low, 45);
  } else
    board.say(quiz.picked === null ? 'Hết giờ!' : 'Sai mất rồi', {
      sub: `Đáp án: ${answer}`,
      tone: 'bad',
      big: true,
      ms: 2000,
    });
  await wait(ms(1800));
}

/** The Quiz of `view` on its Card, `panel`'s answers round it; `onPick` for the player answering. */
function showQuiz(view: View, panel: Panel, onPick: ((b: Button) => void) | null) {
  const quiz = view.quiz;
  if (!quiz) return;
  const deck = view.card ? cardOf(TUNING, view.card.id).deck : 'chance';
  cards.quiz(deck, names[quiz.seat] ?? '', quiz.text, panel.buttons, onPick);
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
  rolling = false;
  board.inviteRoll(false);
  board.highlight([]);
  bridge.send(event, payload ?? {}).catch((error: unknown) => {
    sending = false;
    if (shown && queue.length === 0 && !playing) ask(shown);
    const refusal = error instanceof BridgeError ? error.code : '';
    if (refusal && refusal !== BRIDGE_RESET && refusal !== BRIDGE_UNAVAILABLE) hud.refuse(refusal);
  });
}

hud.onButton = (button: Button) => send(button.event, button.payload);
rollButton.addEventListener('click', () => {
  if (rolling && !playing) send('roll');
});

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
  rollButton.hidden = !rolling || playing || sending;
  if (!rollButton.hidden) {
    const r = board.diceRect();
    Object.assign(rollButton.style, {
      left: `${r.left}px`,
      top: `${r.top}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
    });
  }
  if (!timer || !shown || isOver(shown) || playing) {
    clockLeft = Infinity;
    hud.timer(null, -1);
    cards.timer(null);
    return;
  }
  const ms = Math.max(0, timer.ms - (Date.now() - timer.at));
  const left = ms / timer.ms;
  if (decider(shown) === me && ticks(clockLeft, ms)) sounds.play('tick');
  clockLeft = ms;
  hud.timer(left, decider(shown));
  cards.timer(shown.phase === 'quiz' ? left : null);
}
clock();

new ResizeObserver(() => board.resize(window.innerWidth, window.innerHeight)).observe(
  document.body,
);
board.resize(window.innerWidth, window.innerHeight);
bridge.ready();
