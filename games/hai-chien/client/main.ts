/**
 * Hải Chiến's client: the player places their fleet, then fires at the other sea. Each push is
 * played one after another: the camera glides to the sea under fire, the shell flies, the water
 * spouts or the ship burns, and only then does the next push show.
 */
import {
  BRIDGE_RESET,
  BRIDGE_UNAVAILABLE,
  BridgeError,
  type BridgeSeat,
  createGameBridge,
} from '@xomdao/bridge';
import { cellsOf, index, randomFleet, shipAt } from '../server/game/fleet.js';
import { FLEET, Hit, type Placement, type Point, type View, Unknown } from '../server/game/model.js';
import { demoView } from './demo.js';
import { type Beat, beats } from './present.js';
import { BattleView, type SeaPicture, type Side, wait } from './scene.js';
import { cellIndexes, dragTo, fits, turn, withShip } from './setup.js';
import { Sounds } from './sound.js';

const TOAST_MS = 2200;
const BANNER_MS = 1400;
/** How long the end of the Match shows before the Hub's results. */
const END_MS = 3200;
const ABORT_MS = 600;

interface MatchPush {
  matchId: string;
  status: 'loading' | 'playing' | 'over';
  view?: View;
  result?: { seats: { player: string; place: number }[] };
}

const canvas = document.getElementById('view') as HTMLCanvasElement;
const seatMe = document.getElementById('seat-me') as HTMLElement;
const seatThem = document.getElementById('seat-them') as HTMLElement;
const dock = document.getElementById('dock') as HTMLElement;
const statusEl = document.getElementById('status') as HTMLElement;
const bannerEl = document.getElementById('banner') as HTMLElement;
const toastEl = document.getElementById('toast') as HTMLElement;
const lookBtn = document.getElementById('look') as HTMLButtonElement;
const shuffleBtn = document.getElementById('shuffle') as HTMLButtonElement;
const radarBtn = document.getElementById('radar') as HTMLButtonElement;
const goBtn = document.getElementById('go') as HTMLButtonElement;

const view = new BattleView(canvas);
const sounds = new Sounds();

let me = '';
let seats: BridgeSeat[] = [];
let matchId: string | null = null;
let status: MatchPush['status'] = 'loading';
/** The view on screen (pushes still to play wait in `queue`). */
let shown: View | null = null;
const queue: MatchPush[] = [];
let busy = false;
/** The player's fleet while they place it; kept for the next Match. */
let layout: Placement[] = randomFleet(Math.random);
let aim: Point | null = null;
let radarMode = false;
let sending = false;
/** The sea the player chose to look at, over the one the game would show. */
let looking: Side | null = null;
let doneFor: string | null = null;
let doneTimer = 0;
let ending = false;
let drag: {
  id: number;
  grab: number;
  start: Point;
  at: Placement;
  moved: boolean;
  pointer: number;
} | null = null;

for (const card of [seatMe, seatThem]) {
  const roster = card.querySelector('.roster') as HTMLElement;
  for (const ship of FLEET) {
    const li = document.createElement('li');
    li.title = ship.name;
    for (let i = 0; i < ship.size; i++) li.append(document.createElement('i'));
    roster.append(li);
  }
}

const bridge = createGameBridge({
  onInit(init) {
    sounds.apply(init.settings);
    view.setGraphics(init.settings.graphics === 'low');
    me = init.player.id;
    seats = init.room.seats;
    matchId = null;
    status = 'loading';
    queue.length = 0;
    clearTimeout(doneTimer);
    ending = false;
    aim = null;
    radarMode = false;
    sending = false;
    looking = null;
    drag = null;
    const match = (init.match as View | null) ?? null;
    shown = match;
    if (match) draw(match, false);
    layoutHud();
  },
  onMessage(event, data) {
    if (event !== 'match:state') return;
    queue.push(data as MatchPush);
    void pump();
  },
  onSettings(settings) {
    sounds.apply(settings);
    view.setGraphics(settings.graphics === 'low');
  },
  onVisibility(hidden) {
    sounds.setHidden(hidden);
    view.pause(hidden);
    document.documentElement.classList.toggle('paused', hidden);
  },
});

/** The seat whose sea is drawn on the left: the player's, or the first seat's for a spectator. */
const homeId = (v: View) => (v.players.includes(me) ? me : v.players[0]);
const enemyId = (v: View) => (v.players[0] === homeId(v) ? v.players[1] : v.players[0]);
const sideOf = (v: View, id: string): Side => (id === homeId(v) ? 'home' : 'enemy');
const seated = (v: View | null) => !!v && v.players.includes(me);
const placing = (v: View | null) => !!v && v.phase === 'setup' && seated(v) && !v.seas[me]?.ready;
const myTurn = (v: View | null) =>
  !!v && v.phase === 'battle' && v.turn === me && !busy && !queue.length && !ending;

/** What the left sea shows: the fleet being placed, or the view's. */
function homePicture(v: View): SeaPicture {
  const sea = v.seas[homeId(v)];
  if (placing(v) || !sea) {
    return {
      ships: drag ? withShip(layout, drag.id, drag.at) : layout,
      sunk: FLEET.map(() => false),
      marks: sea?.marks ?? [],
      scans: [],
    };
  }
  if (v.phase === 'setup' && !sea.ships.some(Boolean) && seated(v)) {
    return { ...sea, ships: layout };
  }
  return sea;
}

/** Draws a view at once (`animate`: sinkings and reveals play out). */
function draw(v: View, animate: boolean) {
  view.show('home', homePicture(v), animate);
  const enemy = v.seas[enemyId(v)];
  if (enemy) view.show('enemy', enemy, animate);
  if (!ending) void view.focus(looking ?? autoSide(v), animate);
  updateHud(v);
}

/** The sea the game shows by itself. */
function autoSide(v: View): Side {
  if (v.phase === 'setup') return 'home';
  if (v.phase === 'over') return 'enemy';
  return sideOf(v, v.turn) === 'home' ? 'enemy' : 'home';
}

/** Plays queued pushes one after another. */
async function pump() {
  if (busy) return;
  busy = true;
  try {
    while (queue.length) {
      const push = queue.shift() as MatchPush;
      const fresh = push.matchId !== matchId;
      matchId = push.matchId;
      status = push.status;
      if (fresh) {
        clearTimeout(doneTimer);
        ending = false;
        aim = null;
        radarMode = false;
        looking = null;
        if (push.view) {
          shown = push.view;
          draw(push.view, false);
          if (push.view.phase === 'setup') sounds.play('ready');
        }
      } else if (push.view) {
        const before = shown;
        for (const beat of beats(before, push.view)) await play(beat, push.view);
        shown = push.view;
        const wasMine = before?.turn === me && before.phase === 'battle';
        draw(push.view, true);
        if (push.view.phase === 'battle' && push.view.turn === me && !wasMine) sounds.play('turn');
      }
      if (push.status === 'over') finish(push);
      updateHud(shown);
    }
  } finally {
    busy = false;
    if (shown) updateHud(shown);
  }
}

/** Plays one beat on screen; the view after it is `after`. */
async function play(beat: Beat, after: View) {
  setAim(null);
  if (beat.kind === 'battle') {
    looking = null;
    draw(after, false);
    banner('Khai hoả!', 'good');
    sounds.play('turn');
    await view.focus(autoSide(after));
    await wait(500);
    return;
  }
  if (beat.kind === 'over') {
    ending = true;
    draw(after, true);
    await view.focus('enemy');
    const win = beat.winner === me;
    if (!seated(after)) banner(`${nameOf(beat.winner ?? '')} thắng`, 'good');
    else banner(win ? 'Chiến thắng!' : 'Thua trận', win ? 'good' : 'bad', END_MS);
    sounds.play(!seated(after) || win ? 'win' : 'lose');
    return;
  }
  const side = sideOf(after, beat.target);
  const mine = beat.by === me;
  await view.focus(side);
  if (beat.kind === 'scan') {
    sounds.play('radar');
    await view.scan(side, beat);
    view.show(side, side === 'home' ? homePicture(after) : (after.seas[beat.target] as SeaPicture), true);
    banner(`Ra-đa: ${beat.count}`, 'scan');
    await wait(700);
    return;
  }
  sounds.play('fire');
  sounds.play('whistle', 220);
  await view.fire(side, beat);
  const sea = side === 'home' ? homePicture(after) : (after.seas[beat.target] as SeaPicture);
  view.show(side, sea, true);
  if (beat.result === 'miss') {
    view.splash(side, beat);
    sounds.play('splash');
    banner(mine ? 'Trượt' : 'Hụt', 'calm', 900);
    await wait(750);
    return;
  }
  const at = beat.ship !== undefined ? sea.ships[beat.ship] : null;
  const sunkCells = beat.result === 'sunk' && at && beat.ship !== undefined ? cellsOf(beat.ship, at) : null;
  view.explode(side, beat, sunkCells);
  sounds.play(beat.result === 'sunk' ? 'sunk' : 'hit');
  const ship = FLEET[beat.ship ?? -1]?.name ?? '';
  if (beat.result === 'sunk') banner(mine ? `Chìm ${ship}!` : `Mất ${ship}`, mine ? 'good' : 'bad', 1800);
  else banner(mine ? 'Trúng!' : 'Trúng tàu ta', mine ? 'good' : 'bad', 900);
  await wait(beat.result === 'sunk' ? 1700 : 800);
}

/** The Match is over: once its end has shown, tells the Hub, once per Match. */
function finish(push: MatchPush) {
  const id = push.matchId;
  if (doneFor === id) return;
  doneFor = id;
  let left = END_MS;
  if (!ending) {
    left = ABORT_MS;
    const mine = push.result?.seats.find((s) => s.player === me);
    if (mine) {
      banner(mine.place === 1 ? 'Chiến thắng!' : 'Thua trận', mine.place === 1 ? 'good' : 'bad', END_MS);
      left = END_MS;
    }
  }
  clearTimeout(doneTimer);
  doneTimer = window.setTimeout(() => bridge.done(), left);
}

const nameOf = (id: string) => seats.find((s) => s.id === id)?.name ?? '';

/** Fills both cards and the buttons. */
function updateHud(v: View | null) {
  if (!v) {
    seatMe.hidden = seatThem.hidden = true;
    return;
  }
  const home = homeId(v);
  const enemy = enemyId(v);
  fillSeat(seatMe, v, home);
  fillSeat(seatThem, v, enemy);

  const setup = v.phase === 'setup';
  const battle = v.phase === 'battle';
  const myReady = !!v.seas[me]?.ready;
  const theirReady = !!v.seas[enemy]?.ready;
  shuffleBtn.hidden = !setup || !seated(v) || myReady;
  radarBtn.hidden = !battle || !seated(v) || (v.seas[me]?.radar ?? 0) <= 0 && !radarMode;
  (radarBtn.querySelector('.count') as HTMLElement).textContent = String(v.seas[me]?.radar ?? 0);
  radarBtn.setAttribute('aria-pressed', String(radarMode));
  lookBtn.hidden = v.phase !== 'battle';
  (lookBtn.querySelector('span') as HTMLElement).textContent =
    view.focused === 'home' ? 'Biển địch' : 'Biển ta';

  goBtn.hidden = !seated(v) || v.phase === 'over';
  goBtn.classList.remove('waiting');
  const label = goBtn.querySelector('span') as HTMLElement;
  if (setup) {
    label.textContent = myReady ? 'Sửa lại' : 'Sẵn sàng';
    goBtn.classList.toggle('waiting', myReady);
    goBtn.disabled = sending || (myReady && theirReady);
  } else {
    label.textContent = radarMode ? 'Quét' : 'Bắn';
    goBtn.disabled = !myTurn(v) || !aim || sending;
  }
  radarBtn.disabled = !myTurn(v) || sending;

  statusEl.textContent = setup
    ? !seated(v)
      ? 'Hai bên đang xếp tàu'
      : myReady
        ? theirReady
          ? ''
          : 'Chờ đối thủ xếp tàu'
        : theirReady
          ? 'Đối thủ đã sẵn sàng'
          : ''
    : '';
  layoutHud();
}

/** One seat's card: who, series score, turn and fleet. */
function fillSeat(card: HTMLElement, v: View, id: string) {
  card.hidden = false;
  const seat = seats.find((s) => s.id === id);
  (card.querySelector('.name') as HTMLElement).textContent = seat?.name ?? '';
  (card.querySelector('.who') as HTMLElement).textContent = id === me ? 'Bạn' : seat?.bot ? 'Máy' : '';
  showAvatar(card, seat);
  const wins = card.querySelector('.wins') as HTMLElement;
  const score = String(v.wins[id] ?? 0);
  if (wins.dataset.player === id && wins.textContent !== score) {
    wins.classList.remove('bump');
    void wins.offsetWidth;
    wins.classList.add('bump');
  }
  wins.dataset.player = id;
  wins.textContent = score;
  const won = v.phase === 'over' && v.winner === id;
  const active =
    won || (v.phase === 'battle' && v.turn === id) || (v.phase === 'setup' && !v.seas[id]?.ready);
  card.classList.toggle('active', active);
  card.classList.toggle('won', won);
  (card.querySelector('.turn') as HTMLElement).textContent = won
    ? 'Thắng'
    : v.phase === 'setup'
      ? 'Đang xếp'
      : 'Đến lượt';

  const sea = v.seas[id];
  const visible = id === homeId(v) ? homePicture(v) : sea;
  for (const [ship, li] of [...card.querySelectorAll('.roster li')].entries()) {
    li.classList.toggle('sunk', !!sea?.sunk[ship]);
    const at = visible?.ships[ship];
    const cells = at ? cellsOf(ship, at) : [];
    for (const [i, seg] of [...li.querySelectorAll('i')].entries()) {
      const c = cells[i];
      seg.classList.toggle('hit', !!c && sea?.marks[index(c)] === Hit && !sea.sunk[ship]);
    }
  }
}

function showAvatar(card: HTMLElement, seat: BridgeSeat | undefined) {
  (card.querySelector('.initial') as HTMLElement).textContent = (seat?.name[0] ?? '?').toUpperCase();
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

let bannerTimer = 0;
function banner(text: string, tone: 'good' | 'bad' | 'calm' | 'scan', ms = BANNER_MS) {
  bannerEl.textContent = text;
  bannerEl.className = `banner shown ${tone}`;
  clearTimeout(bannerTimer);
  bannerTimer = window.setTimeout(() => bannerEl.classList.remove('shown'), ms);
}

let toastTimer = 0;
function say(message: string) {
  toastEl.textContent = message;
  toastEl.classList.add('shown');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('shown'), TOAST_MS);
}

/** Shows a refusal from the server, unless the Hub already explains it. */
function refused(error: unknown) {
  const code = error instanceof BridgeError ? error.code : '';
  if (code && code !== BRIDGE_RESET && code !== BRIDGE_UNAVAILABLE) {
    sounds.play('refused');
    say(code);
  }
}

function setAim(p: Point | null) {
  aim = p;
  view.setAim(p && shown ? { side: 'enemy', p, radar: radarMode } : null);
  if (shown) updateHud(shown);
}

/** Fires (or scans) at the aimed cell. */
function shoot() {
  if (!myTurn(shown) || !aim || sending) return;
  const target = aim;
  const event = radarMode ? 'scan' : 'fire';
  sending = true;
  updateHud(shown);
  bridge
    .send(event, target)
    .then(() => {
      radarMode = false;
    })
    .catch(refused)
    .finally(() => {
      sending = false;
      setAim(null);
    });
}

canvas.addEventListener('pointerdown', (event) => {
  const v = shown;
  if (!v) return;
  if (placing(v)) {
    const cell = view.cellAt('home', event.clientX, event.clientY);
    if (view.focused !== 'home' || !cell) return;
    const id = shipAt(layout, cell);
    if (id < 0) return;
    const at = layout[id] as Placement;
    const grab = at.v ? cell.y - at.y : cell.x - at.x;
    drag = { id, grab, start: cell, at, moved: false, pointer: event.pointerId };
    canvas.setPointerCapture(event.pointerId);
    view.lift('home', id, true);
    return;
  }
  if (!myTurn(v) || view.focused !== 'enemy') return;
  const cell = view.cellAt('enemy', event.clientX, event.clientY);
  if (!cell) return;
  const mark = v.seas[enemyId(v)]?.marks[index(cell)];
  if (!radarMode && mark !== Unknown) {
    sounds.play('refused');
    return;
  }
  if (aim && aim.x === cell.x && aim.y === cell.y) {
    shoot();
    return;
  }
  sounds.play('rotate');
  setAim(cell);
});

canvas.addEventListener('pointermove', (event) => {
  if (!drag || event.pointerId !== drag.pointer || !shown) return;
  const point = view.pointAt('home', event.clientX, event.clientY);
  if (!point) return;
  const cell = { x: Math.floor(point.x), y: Math.floor(point.y) };
  if (!drag.moved && cell.x === drag.start.x && cell.y === drag.start.y) return;
  drag.moved = true;
  const from = layout[drag.id] as Placement;
  const next = dragTo(drag.id, from, drag.grab, cell);
  if (next.x === drag.at.x && next.y === drag.at.y) return;
  drag.at = next;
  const ok = fits(layout, drag.id, next);
  view.lift('home', drag.id, true, !ok);
  view.show('home', homePicture(shown), false);
  view.shade('home', homePicture(shown), cellIndexes(drag.id, next), ok);
});

function endDrag(event: PointerEvent) {
  if (!drag || event.pointerId !== drag.pointer || !shown) return;
  const { id, grab, at, moved } = drag;
  drag = null;
  view.lift('home', id, false);
  if (moved) {
    if (fits(layout, id, at)) {
      layout = withShip(layout, id, at);
      sounds.play('place');
    } else sounds.play('refused');
  } else {
    const turned = turn(layout, id, grab);
    if (turned) {
      layout = withShip(layout, id, turned);
      sounds.play('rotate');
    } else {
      view.refuse('home', id);
      sounds.play('refused');
    }
  }
  view.show('home', homePicture(shown), false);
  updateHud(shown);
}

canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

shuffleBtn.addEventListener('click', () => {
  if (!placing(shown) || !shown) return;
  layout = randomFleet(Math.random);
  sounds.play('place');
  view.show('home', homePicture(shown), false);
  updateHud(shown);
});

goBtn.addEventListener('click', () => {
  const v = shown;
  if (!v || sending) return;
  if (v.phase === 'setup') {
    const ready = !!v.seas[me]?.ready;
    sending = true;
    updateHud(v);
    if (!ready) sounds.play('ready');
    bridge
      .send(ready ? 'unready' : 'fleet', ready ? {} : { ships: layout })
      .catch(refused)
      .finally(() => {
        sending = false;
        if (shown) updateHud(shown);
      });
    return;
  }
  shoot();
});

radarBtn.addEventListener('click', () => {
  if (!myTurn(shown)) return;
  radarMode = !radarMode;
  sounds.play('rotate');
  setAim(aim);
});

lookBtn.addEventListener('click', () => {
  if (!shown || busy) return;
  looking = view.focused === 'home' ? 'enemy' : 'home';
  void view.focus(looking);
  updateHud(shown);
});

let sized = '';
/** The rect between the cards where the seas are drawn. */
function layoutHud() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const them = seatThem.getBoundingClientRect();
  const mine = dock.getBoundingClientRect();
  const pad = 6;
  const rect =
    w > h
      ? { x: mine.right + pad, y: pad, w: Math.max(50, them.left - mine.right - pad * 2), h: h - pad * 2 }
      : {
          x: pad,
          y: them.bottom + pad,
          w: w - pad * 2,
          h: Math.max(50, mine.top - them.bottom - pad * 2),
        };
  if (seatThem.hidden) Object.assign(rect, { x: pad, y: pad, w: w - pad * 2, h: h - pad * 2 });
  const key = JSON.stringify([w, h, rect]);
  if (key === sized) return;
  sized = key;
  view.resize(w, h, rect);
}

new ResizeObserver(layoutHud).observe(document.body);
const demo = new URLSearchParams(location.search);
if (demo.has('demo') || demo.has('splash')) {
  me = 'me';
  seats = [
    { id: 'me', name: 'Thuyền trưởng', bot: false },
    { id: 'them', name: 'Máy', bot: true },
  ];
  shown = demoView();
  if (demo.has('splash')) document.body.classList.add('splash');
  draw(shown, false);
  void view.focus(demo.get('side') === 'home' ? 'home' : 'enemy', false);
  setAim({ x: 3, y: 4 });
  window.setTimeout(() => document.body.setAttribute('data-ready', ''), 1500);
} else bridge.ready();
layoutHud();
view.frame();
