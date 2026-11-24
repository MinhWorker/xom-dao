/**
 * The HTML over the board: the player cards (cash, Effects, jail, the turn clock), the decision
 * panel, a Tile's details, short banners and the end of the Match.
 */
import { BOARD, setTiles } from '../server/game/board.js';
import {
  cityRent,
  isFullSet,
  landPrice,
  levelCost,
  stationRent,
  takeoverPrice,
} from '../server/game/economy.js';
import { type EffectId, HOTEL, type View } from '../server/game/model.js';
import { TUNING } from '../server/game/tuning.js';
import { type Button, levelName, money, type Panel } from './decisions.js';
import { SET_COLORS } from './print.js';
import { SEAT_COLORS } from './scene.js';

const t = TUNING;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const EFFECTS: Record<EffectId, { name: string; good: boolean; icon: string }> = {
  lucky: {
    name: 'Thần tài',
    good: true,
    icon: '<circle cx="8" cy="8" r="6" fill="#e6b422"/><path d="M6 5h4M6 8h4M8 5v6" stroke="#7a5200" stroke-width="1.6"/>',
  },
  traffic: {
    name: 'Kẹt xe',
    good: false,
    icon: '<rect x="2" y="5" width="12" height="6" rx="2" fill="#e0553d"/><circle cx="5" cy="12" r="1.8" fill="#222"/><circle cx="11" cy="12" r="1.8" fill="#222"/>',
  },
  exempt: {
    name: 'Miễn thuê',
    good: true,
    icon: '<path d="M8 1l6 2.5v4C14 11 11.5 13.8 8 15 4.5 13.8 2 11 2 7.5v-4z" fill="#4a8fe0"/><path d="M5 8l2 2 4-4" stroke="#fff" stroke-width="1.6" fill="none"/>',
  },
  sick: {
    name: 'Ốm',
    good: false,
    icon: '<circle cx="8" cy="8" r="6.5" fill="#f0f0f0"/><path d="M8 4v8M4 8h8" stroke="#e0553d" stroke-width="2.4"/>',
  },
  startup: {
    name: 'Khởi nghiệp',
    good: true,
    icon: '<path d="M8 15V7" stroke="#58b368" stroke-width="1.8"/><path d="M8 8C8 4 11 2 14 2c0 3-2 6-6 6zM8 10C8 7 5 5 2 5c0 3 2 5 6 5z" fill="#58b368"/>',
  },
};

const JAIL_ICON =
  '<rect x="2" y="2" width="12" height="12" rx="1.5" fill="none" stroke="#cfc4ad" stroke-width="1.5"/><path d="M5.5 2v12M8 2v12M10.5 2v12" stroke="#cfc4ad" stroke-width="1.4"/>';
const TICKET_ICON =
  '<path d="M1 5h14v2a1.5 1.5 0 000 3v2H1v-2a1.5 1.5 0 000-3z" fill="#e2731c"/><path d="M6 5v7" stroke="#fff6e1" stroke-dasharray="1.2 1.2"/>';

const svg = (body: string) => `<svg viewBox="0 0 16 16" aria-hidden="true">${body}</svg>`;

export class Hud {
  private readonly roster = $<HTMLOListElement>('roster');
  private readonly panel = $<HTMLElement>('panel');
  private readonly clock = $<HTMLElement>('clock').firstElementChild as HTMLElement;
  private readonly info = $<HTMLElement>('info');
  private readonly banner = $<HTMLElement>('banner');
  private readonly toast = $<HTMLElement>('toast');
  private readonly end = $<HTMLElement>('end');
  private cards: HTMLElement[] = [];
  private cashShown: number[] = [];
  private toastTimer = 0;
  private bannerTimer = 0;

  /** Called with a button the player tapped. */
  onButton: (button: Button) => void = () => {};

  constructor() {
    this.info.addEventListener('pointerdown', () => {
      this.info.hidden = true;
    });
  }

  /** Builds one card per seat. */
  seats(names: readonly string[]) {
    this.roster.innerHTML = '';
    this.cards = names.map((name, seat) => {
      const li = document.createElement('li');
      li.className = `seat seat-${seat}`;
      li.style.setProperty('--seat', SEAT_COLORS[seat] ?? '#888');
      li.innerHTML = `<span class="avatar"></span><span class="who"><b></b></span><span class="cash"></span><span class="tags"></span><span class="timer" hidden></span><span class="stamp">Phá sản</span>`;
      (li.querySelector('.avatar') as HTMLElement).textContent = (name[0] ?? '?').toUpperCase();
      (li.querySelector('b') as HTMLElement).textContent = name;
      this.roster.append(li);
      return li;
    });
    this.cashShown = [];
  }

  /** The player cards as `view` says. */
  players(view: View) {
    view.players.forEach((p, seat) => {
      const li = this.cards[seat];
      if (!li) return;
      const out = p.bankrupt;
      li.classList.toggle('turn', !out && seat === view.turn);
      li.classList.toggle('out', out);
      (li.querySelector('.cash') as HTMLElement).textContent = out ? 'Phá sản' : money(p.cash);
      const tags: string[] = [];
      if (p.jailed) tags.push(`<span class="tag bad">${svg(JAIL_ICON)}Tù</span>`);
      if (p.jailCards > 0)
        tags.push(
          `<span class="tag good" title="Vé ra tù">${svg(TICKET_ICON)}${p.jailCards}</span>`,
        );
      for (const e of p.effects) {
        const def = EFFECTS[e.id];
        tags.push(
          `<span class="tag ${def.good ? 'good' : 'bad'}" title="${def.name}">${svg(def.icon)}${e.id === 'exempt' ? '' : e.turns}</span>`,
        );
      }
      (li.querySelector('.tags') as HTMLElement).innerHTML = tags.join('');
      this.cashShown[seat] = p.cash;
    });
  }

  /** A seat's player card. */
  card(seat: number): HTMLElement | undefined {
    return this.cards[seat];
  }

  /** "Phá sản" is stamped on `seat`'s card. */
  broke(seat: number) {
    const li = this.cards[seat];
    if (!li) return;
    li.classList.add('out', 'stamping');
    (li.querySelector('.cash') as HTMLElement).textContent = 'Phá sản';
    li.querySelector('.stamp')?.addEventListener(
      'animationend',
      () => li.classList.remove('stamping'),
      { once: true },
    );
  }

  /** A "+200" or "−72" rising from a player's card. */
  delta(seat: number, amount: number) {
    const li = this.cards[seat];
    if (!li) return;
    const el = document.createElement('span');
    el.className = `delta ${amount > 0 ? 'up' : 'down'}`;
    el.textContent = `${amount > 0 ? '+' : '−'}${money(Math.abs(amount))}`;
    li.append(el);
    el.addEventListener('animationend', () => el.remove());
    const cash = li.querySelector('.cash') as HTMLElement;
    this.cashShown[seat] = (this.cashShown[seat] ?? 0) + amount;
    cash.textContent = money(this.cashShown[seat] ?? 0);
  }

  /** The decision panel; `null` hides it. */
  show(panel: Panel | null, mine: boolean) {
    this.panel.hidden = !panel;
    if (!panel) return;
    this.panel.classList.toggle('picking', !!panel.pick && panel.buttons.length <= 1);
    const quiz = panel.buttons.some((b) => b.event === 'answer');
    this.panel.classList.toggle('quiz', quiz);
    this.panel.classList.remove('waiting');
    this.panel.classList.toggle('watch', !mine && !quiz);
    $('panel-title').textContent = panel.title;
    $('panel-text').textContent = panel.text ?? '';
    const box = $('panel-buttons');
    box.innerHTML = '';
    panel.buttons.forEach((b, i) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.textContent = b.label;
      el.disabled = !!b.disabled;
      if (b.event === 'pass' || (i > 0 && b.event !== 'answer' && b.event !== 'pick'))
        el.classList.add('quiet');
      el.addEventListener('click', () => {
        if (!el.disabled) this.onButton(b);
      });
      box.append(el);
    });
  }

  /** Greys out the panel's buttons while a move is on its way. */
  busy(busy: boolean) {
    for (const b of this.panel.querySelectorAll('button')) {
      if (busy) b.disabled = true;
    }
  }

  /** Before the Quiz's answer shows: the answer picked pulses, the others dim. */
  quizWait(picked: number | null) {
    this.panel.classList.add('waiting');
    [...$('panel-buttons').querySelectorAll('button')].forEach((b, i) => {
      b.classList.toggle('picked', i === picked);
    });
  }

  /** Marks the Quiz's right answer, and the one picked when it was wrong. */
  quizResult(answer: number, picked: number | null) {
    this.panel.classList.remove('waiting');
    const buttons = [...$('panel-buttons').querySelectorAll('button')];
    buttons.forEach((b, i) => {
      b.classList.remove('picked');
      b.classList.toggle('right', i === answer);
      b.classList.toggle('wrong', i === picked && i !== answer);
    });
  }

  /** The turn clock: how much of it is left, from 0 to 1; `null` hides it. */
  timer(left: number | null, seat: number) {
    const bar = this.panel.querySelector('.clock') as HTMLElement;
    bar.hidden = left === null;
    if (left !== null) this.clock.style.transform = `scaleX(${left})`;
    this.cards.forEach((li, s) => {
      const el = li.querySelector('.timer') as HTMLElement;
      el.hidden = left === null || s !== seat;
      if (left !== null) el.style.transform = `scaleX(${left})`;
    });
  }

  /** A short line at the top of the screen. */
  say(text: string, ms = 1600) {
    this.banner.textContent = text;
    this.banner.hidden = false;
    clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => {
      this.banner.hidden = true;
    }, ms);
  }

  /** The server's refusal of a move. */
  refuse(text: string) {
    this.toast.textContent = text;
    this.toast.classList.add('shown');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toast.classList.remove('shown'), 2200);
  }

  /** What one Tile costs and charges, and whose it is; `null` hides it. */
  tile(view: View | null, tile: number | null, names: readonly string[]) {
    this.info.hidden = tile === null || !view;
    if (tile === null || !view) return;
    const board = BOARD[tile];
    if (!board) return;
    const lot = view.lots[tile];
    const rows: [string, string][] = [];
    let band = '';
    if (board.kind === 'city') {
      band = SET_COLORS[board.set];
      const price = landPrice(t, tile);
      const full = isFullSet(view, tile);
      rows.push(['Giá đất', money(price)]);
      t.levelRent.forEach((_, i) => {
        rows.push([`Thuê ${levelName(i + 1)}`, money(cityRent(t, tile, i + 1, full))]);
      });
      rows.push(['Nâng một cấp', money(levelCost(t, tile))]);
      if (full) rows.push(['Đủ bộ màu', `×${t.fullSet}`]);
    } else if (board.kind === 'station') {
      rows.push(['Giá', money(t.stationPrice)]);
      for (let n = 1; n <= 4; n++) rows.push([`Chủ có ${n} bến`, money(stationRent(t, n))]);
    } else if (board.kind === 'utility') {
      rows.push(['Giá', money(t.utilityPrice)]);
      rows.push(['Chủ có 1 ô', `xúc xắc ×${t.utilityRent[0]}`]);
      rows.push(['Chủ có cả 2', `xúc xắc ×${t.utilityRent[1]}`]);
    } else if (board.kind === 'tax') {
      const tax = t.taxes[board.tax];
      rows.push(['Nộp', `${Math.round(tax.rate * 100)}% tiền mặt`]);
      rows.push(['Ít nhất', money(tax.min)]);
    } else if (board.kind === 'airport') {
      rows.push(['Phí bay', money(t.airportFee)]);
    } else if (board.kind === 'jail') {
      rows.push(['Trả để ra', money(t.jailFine)]);
    } else if (board.kind === 'start') {
      rows.push(['Đi qua nhận', money(t.startBonus)]);
    }
    const takeover = lot ? takeoverPrice(t, view, tile) : null;
    if (takeover !== null) rows.push(['Mua lại', money(takeover)]);
    const owner = lot
      ? `${names[lot.owner] ?? ''}${board.kind === 'city' ? ` · ${levelName(lot.level)}` : ''}`
      : board.kind === 'city' || board.kind === 'station' || board.kind === 'utility'
        ? 'Chưa có chủ'
        : '';
    const marks = [
      view.festival === tile ? `Lễ hội: thuê ×${t.festivalRent}` : '',
      view.blackout?.tile === tile ? 'Mất điện' : '',
      lot?.level === HOTEL ? 'Khách sạn không mua lại được' : '',
    ].filter(Boolean);
    const set =
      board.kind === 'city'
        ? setTiles(board.set)
            .filter((i) => i !== tile)
            .map((i) => BOARD[i]?.name)
            .join(', ')
        : '';
    this.info.innerHTML = `${band ? `<div class="band" style="background:${band}"></div>` : ''}<h2></h2><div class="owner"></div><table>${rows
      .map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`)
      .join('')}</table>`;
    (this.info.querySelector('h2') as HTMLElement).textContent = board.name;
    (this.info.querySelector('.owner') as HTMLElement).textContent = [
      owner,
      set && `Cùng màu: ${set}`,
      ...marks,
    ]
      .filter(Boolean)
      .join(' · ');
  }

  /**
   * The end of the Match: the winner and every place, at once or, with `fanfare`, coming in one
   * after another under a crown after the last move.
   */
  over(view: View | null, names: readonly string[], me: number, fanfare = false) {
    this.end.hidden = !view;
    this.end.classList.toggle('fanfare', fanfare);
    if (!view) return;
    this.show(null, false);
    const n = view.players.length;
    const places = view.players
      .map((p, seat) => {
        const out = view.bankrupt.indexOf(seat);
        return { seat, place: out < 0 ? 1 : n - out, cash: p.cash };
      })
      .sort((a, b) => a.place - b.place);
    const winner = places[0]?.seat ?? 0;
    $('end-title').textContent = winner === me ? 'Bạn thắng!' : `${names[winner] ?? ''} thắng`;
    $('end-places').innerHTML = places
      .map(
        (p) =>
          `<li style="--seat:${SEAT_COLORS[p.seat]};--k:${p.place}"><span class="place">${p.place}</span><span class="dot"></span><span class="name"></span><span class="cash">${p.place === 1 ? money(p.cash) : 'Phá sản'}</span></li>`,
      )
      .join('');
    $('end-places')
      .querySelectorAll('.name')
      .forEach((el, i) => {
        el.textContent = names[places[i]?.seat ?? 0] ?? '';
      });
  }
}
