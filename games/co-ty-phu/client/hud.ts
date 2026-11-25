/**
 * The HTML over the board: the player cards (cash, Effects, jail, the turn clock), the decision
 * panel, a Tile's details and the end of the Match. Events are printed on the board (`say`).
 */
import { BOARD, setTiles } from '../server/game/board.js';
import {
  cityRent,
  isFullSet,
  isMonopoly,
  landPrice,
  levelCost,
  stationRent,
  takeoverPrice,
} from '../server/game/economy.js';
import { type EffectId, HOTEL, type View } from '../server/game/model.js';
import { TUNING } from '../server/game/tuning.js';
import { type Button, levelName, money } from './decisions.js';
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

/** A die, flat and dark, for what Điện lực and Cấp nước charge per point rolled. */
const DIE_ICON =
  '<rect x="1.5" y="1.5" width="13" height="13" rx="3" fill="#3b3026"/><g fill="#f3ead8"><circle cx="5" cy="5" r="1.3"/><circle cx="8" cy="8" r="1.3"/><circle cx="11" cy="11" r="1.3"/></g>';

const svg = (body: string) => `<svg viewBox="0 0 16 16" aria-hidden="true">${body}</svg>`;

export class Hud {
  private readonly roster = $<HTMLOListElement>('roster');
  private readonly panel = $<HTMLElement>('panel');
  private readonly clock = $<HTMLElement>('clock').firstElementChild as HTMLElement;
  private readonly info = $<HTMLElement>('info');
  private readonly toast = $<HTMLElement>('toast');
  private readonly end = $<HTMLElement>('end');
  private cards: HTMLElement[] = [];
  private cashShown: number[] = [];
  /** Bumped per seat by each count: an older one stops. */
  private counting: number[] = [];
  private toastTimer = 0;

  /** Called with a button the player tapped. */
  onButton: (button: Button) => void = () => {};

  constructor() {
    this.info.addEventListener('pointerdown', () => {
      this.info.hidden = true;
    });
  }

  /** Builds one card per seat; `avatars` are the accounts' pictures' ids (`bot` for the computer). */
  seats(names: readonly string[], avatars: readonly (string | undefined)[] = []) {
    this.roster.innerHTML = '';
    this.cards = names.map((name, seat) => {
      const li = document.createElement('li');
      li.className = `seat seat-${seat}`;
      li.style.setProperty('--seat', SEAT_COLORS[seat] ?? '#888');
      li.innerHTML = `<span class="avatar"></span><span class="who"><b></b></span><span class="cash"></span><span class="tags"></span><span class="timer" hidden></span><span class="stamp">Phá sản</span>`;
      const medallion = li.querySelector('.avatar') as HTMLElement;
      medallion.textContent = (name[0] ?? '?').toUpperCase();
      const avatar = avatars[seat];
      if (avatar) {
        const img = document.createElement('img');
        img.alt = '';
        img.draggable = false;
        img.classList.toggle('bot', avatar === 'bot');
        img.addEventListener('error', () => img.remove());
        img.src = `/avatars/${encodeURIComponent(avatar)}.webp`;
        medallion.append(img);
      }
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

  /** A "+200" or "−72" rising from a player's card while its cash counts there over `ms`. */
  delta(seat: number, amount: number, ms = 0) {
    const li = this.cards[seat];
    if (!li) return;
    const el = document.createElement('span');
    el.className = `delta ${amount > 0 ? 'up' : 'down'}`;
    el.textContent = `${amount > 0 ? '+' : '−'}${money(Math.abs(amount))}`;
    li.append(el);
    el.addEventListener('animationend', () => el.remove());
    const cash = li.querySelector('.cash') as HTMLElement;
    const from = this.cashShown[seat] ?? 0;
    const to = from + amount;
    this.cashShown[seat] = to;
    const run = (this.counting[seat] ?? 0) + 1;
    this.counting[seat] = run;
    const start = performance.now();
    const step = () => {
      if (this.counting[seat] !== run) return;
      const k = ms > 0 ? Math.min(1, (performance.now() - start) / ms) : 1;
      cash.textContent = money(Math.round(from + (to - from) * k));
      cash.classList.toggle('counting', k < 1);
      cash.classList.toggle('falling', k < 1 && amount < 0);
      if (k < 1) requestAnimationFrame(step);
    };
    step();
  }

  /**
   * The buttons of the decision this player makes, at the bottom; none hides them. What the
   * decision is about is printed on the board.
   */
  show(buttons: Button[]) {
    this.panel.hidden = buttons.length === 0;
    const box = $('panel-buttons');
    box.innerHTML = '';
    buttons.forEach((b, i) => {
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

  /** The turn clock: how much of it is left, from 0 to 1; `null` hides it. */
  timer(left: number | null, seat: number) {
    const bar = this.panel.querySelector('.clock') as HTMLElement;
    bar.hidden = left === null;
    if (left !== null) this.clock.style.transform = `scaleX(${left})`;
    this.cards.forEach((li, s) => {
      const el = li.querySelector('.timer') as HTMLElement;
      el.hidden = left === null || s !== seat;
      if (left === null) return;
      el.style.setProperty('--left', String(left));
      el.style.setProperty('--ring', left < 0.3 ? '#ff5a3c' : '');
    });
  }

  /** The server's refusal of a move. */
  refuse(text: string) {
    this.toast.textContent = text;
    this.toast.classList.add('shown');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toast.classList.remove('shown'), 2200);
  }

  /**
   * A Tile's details as a land deed in two halves either side of the board: on the left what it
   * is and whose, with its Colour set; on the right what it charges, the row in force lit.
   * `null` hides them.
   */
  tile(view: View | null, tile: number | null, names: readonly string[]) {
    this.info.hidden = tile === null || !view;
    if (tile === null || !view) return;
    const board = BOARD[tile];
    if (!board) return;
    const lot = view.lots[tile];
    const ownable = board.kind === 'city' || board.kind === 'station' || board.kind === 'utility';
    const owned = (kind: string) =>
      lot
        ? view.lots.filter((l, i) => l?.owner === lot.owner && BOARD[i]?.kind === kind).length
        : 0;
    /** The rows of what the Tile charges; `now` marks the one in force. */
    const rows: { label: string; value: string; now?: boolean; die?: boolean }[] = [];
    const facts: [string, string][] = [];
    let band = '#5b4a34';
    let kind = '';
    if (board.kind === 'city') {
      band = SET_COLORS[board.set];
      kind = 'Đất';
      const full = isFullSet(view, tile);
      facts.push(['Giá đất', money(landPrice(t, tile))]);
      t.levelRent.forEach((_, i) => {
        rows.push({
          label: levelName(i + 1),
          value: money(cityRent(t, tile, i + 1, full)),
          now: lot?.level === i + 1,
        });
      });
    } else if (board.kind === 'station') {
      kind = 'Bến xe';
      facts.push(['Giá', money(t.stationPrice)]);
      for (let n = 1; n <= 4; n++)
        rows.push({
          label: `Chủ có ${n} bến`,
          value: money(stationRent(t, n)),
          now: owned('station') === n,
        });
    } else if (board.kind === 'utility') {
      kind = 'Công ty';
      facts.push(['Giá', money(t.utilityPrice)]);
      const n = owned('utility');
      rows.push({ label: 'Chủ có 1 ô', value: `${t.utilityRent[0]} ×`, now: n === 1, die: true });
      rows.push({ label: 'Chủ có cả 2', value: `${t.utilityRent[1]} ×`, now: n >= 2, die: true });
    } else if (board.kind === 'tax') {
      const tax = t.taxes[board.tax];
      facts.push(['Nộp', `${Math.round(tax.rate * 100)}% tiền mặt`], ['Ít nhất', money(tax.min)]);
    } else if (board.kind === 'airport') facts.push(['Phí bay', money(t.airportFee)]);
    else if (board.kind === 'jail') facts.push(['Trả để ra', money(t.jailFine)]);
    else if (board.kind === 'start') facts.push(['Đi qua nhận', money(t.startBonus)]);
    const extra: [string, string][] = [];
    if (board.kind === 'city') extra.push(['Nâng một cấp', money(levelCost(t, tile))]);
    if (board.kind === 'city' && isFullSet(view, tile))
      extra.push(['Đủ bộ màu', `thuê ×${t.fullSet}`]);
    if (isMonopoly(view, tile))
      extra.push([
        'Độc quyền',
        board.kind === 'station' ? 'Ông hoàng vận tải' : 'Con cưng Nhà nước',
      ]);
    const takeover = lot ? takeoverPrice(t, view, tile) : null;
    if (takeover !== null) extra.push(['Mua lại', money(takeover)]);
    const marks = [
      view.festival === tile ? `Lễ hội · thuê ×${t.festivalRent}` : '',
      view.blackout?.tile === tile ? 'Mất điện' : '',
      lot?.level === HOTEL ? 'Khách sạn không mua lại được' : '',
    ].filter(Boolean);
    const esc = (text: string) =>
      text.replace(
        /[&<>"]/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c,
      );
    const dl = (pairs: [string, string][]) =>
      pairs.length
        ? `<dl class="facts">${pairs.map(([a, b]) => `<div><dt>${esc(a)}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl>`
        : '';
    const seal = !ownable
      ? ''
      : lot
        ? `<div class="seal" style="--seat:${SEAT_COLORS[lot.owner]}"><span>Chủ sở hữu</span><b>${esc(names[lot.owner] ?? '')}</b>${board.kind === 'city' ? `<i>${esc(levelName(lot.level))}</i>` : ''}</div>`
        : '<div class="seal free"><span>Chủ sở hữu</span><b>Chưa có chủ</b></div>';
    const set =
      board.kind === 'city'
        ? `<ul class="set">${setTiles(board.set)
            .map((i) => {
              const l = view.lots[i];
              const color = l ? SEAT_COLORS[l.owner] : 'transparent';
              return `<li${i === tile ? ' class="me"' : ''}><i style="--seat:${color}"></i>${esc(BOARD[i]?.name ?? '')}</li>`;
            })
            .join('')}</ul>`
        : '';
    const left = `<article class="deed left" style="--band:${band}"><header>${kind ? `<span>Giấy chứng nhận · ${kind}</span>` : ''}<h2>${esc(board.name)}</h2></header>${dl(facts)}${seal}${set}${marks.map((m) => `<p class="mark">${esc(m)}</p>`).join('')}</article>`;
    const right =
      rows.length > 0
        ? `<article class="deed right" style="--band:${band}"><header><span>Tiền thuê</span><h2>${esc(board.name)}</h2></header><table>${rows
            .map(
              (r) =>
                `<tr${r.now ? ' class="now"' : ''}><td>${esc(r.label)}</td><td>${esc(r.value)}${r.die ? `<i class="die">${svg(DIE_ICON)}</i>` : ''}</td></tr>`,
            )
            .join('')}</table>${dl(extra)}</article>`
        : '';
    this.info.innerHTML = left + right;
  }

  /**
   * The end of the Match: the winner and every place, at once or, with `fanfare`, coming in one
   * after another under a crown after the last move.
   */
  over(view: View | null, names: readonly string[], me: number, fanfare = false) {
    this.end.hidden = !view;
    this.end.classList.toggle('fanfare', fanfare);
    if (!view) return;
    this.show([]);
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
