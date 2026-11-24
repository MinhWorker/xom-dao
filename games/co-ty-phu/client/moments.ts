/**
 * The moments the whole table shouts at (#355), drawn in HTML over the board: money flying from
 * one player card to another, grander as it grows (`grandeur`), a headline across the middle and
 * confetti. Every `pace` below 1 plays faster; 0 skips the show.
 */
import { money } from './decisions.js';

/** Coins per `grandeur`, and on low graphics. */
const COINS = [5, 9, 16, 28] as const;
const LOW_COINS = [2, 3, 4, 6] as const;
const FLIGHT_MS = [620, 820, 1000, 1200] as const;
/** Ms between one coin leaving and the next. */
const STAGGER = [70, 55, 45, 38] as const;

export type Tone = 'gold' | 'good' | 'bad';

const el = (tag: string, className: string) => {
  const e = document.createElement(tag);
  e.className = className;
  return e;
};

const centre = (e: Element) => {
  const r = e.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

/** Restarts a CSS animation on `e` by toggling `className` off and on. */
const replay = (e: HTMLElement, className: string) => {
  e.classList.remove(className);
  void e.offsetWidth;
  e.classList.add(className);
};

export class Moments {
  private readonly layer = el('div', 'moments');
  private readonly headline = el('div', 'headline');
  private readonly amount = el('div', 'amount');
  private headlineTimer = 0;
  private amountTimer = 0;

  constructor() {
    this.headline.innerHTML = '<b></b><span></span>';
    this.headline.hidden = true;
    this.amount.innerHTML = '<b></b><span></span>';
    this.amount.hidden = true;
    this.layer.append(this.amount, this.headline);
    document.body.append(this.layer);
  }

  /**
   * Coins (and notes, once it is more) fly in an arc from card `from` to card `to`; the payer's
   * card shudders and the payee's glows as they land. From `grandeur` 2 the amount shows over the
   * board with `caption` under it, from 3 it shakes. Resolves when the last coin lands.
   */
  async pay(
    from: HTMLElement | undefined,
    to: HTMLElement | undefined,
    amount: number,
    grand: number,
    pace: number,
    low: boolean,
    caption = '',
  ) {
    if (!from || !to || pace <= 0) return;
    const tier = Math.min(3, Math.max(0, grand)) as 0 | 1 | 2 | 3;
    const stagger = STAGGER[tier] * pace;
    const a = centre(from);
    const b = centre(to);
    const mid = { x: innerWidth / 2, y: innerHeight / 2 };
    const ms = FLIGHT_MS[tier] * pace;
    const n = (low ? LOW_COINS : COINS)[tier];
    replay(from, 'paying');
    if (tier >= 2) this.showAmount(amount, caption, tier, ms + n * stagger + 500 * pace);
    const flights: Promise<unknown>[] = [];
    for (let k = 0; k < n; k++) {
      const coin = el('i', tier >= 1 && k % 3 === 2 ? 'coin note' : 'coin');
      this.layer.append(coin);
      const bend = 0.35 + Math.random() * 0.25;
      const jitter = () => (Math.random() - 0.5) * 60;
      const via = {
        x: a.x + (b.x - a.x) * 0.5 + (mid.x - (a.x + b.x) / 2) * bend + jitter(),
        y: a.y + (b.y - a.y) * 0.5 + (mid.y - (a.y + b.y) / 2) * bend + jitter(),
      };
      const spin = (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 360);
      const at = (p: { x: number; y: number }, scale: number, turn: number) =>
        `translate(${p.x}px, ${p.y}px) translate(-50%, -50%) scale(${scale}) rotate(${turn}deg)`;
      const flight = coin.animate(
        [
          { transform: at(a, 0.4, 0), opacity: 0 },
          { transform: at(a, 1, 0), opacity: 1, offset: 0.08 },
          { transform: at(via, 1.25 + tier * 0.12, spin / 2), offset: 0.5 },
          { transform: at(b, 0.7, spin), opacity: 1, offset: 0.94 },
          { transform: at(b, 0.3, spin), opacity: 0 },
        ],
        {
          duration: ms,
          delay: k * stagger,
          easing: 'cubic-bezier(0.45, 0, 0.35, 1)',
          fill: 'both',
        },
      );
      flights.push(
        flight.finished
          .then(() => {
            if (k === 0) replay(to, 'earning');
          })
          .catch(() => {})
          .finally(() => coin.remove()),
      );
    }
    await Promise.all(flights);
  }

  /** The amount of a large payment over the board. */
  private showAmount(amount: number, caption: string, grand: number, ms: number) {
    const [b, span] = this.amount.children as unknown as [HTMLElement, HTMLElement];
    b.textContent = money(amount);
    span.textContent = caption;
    this.amount.classList.toggle('huge', grand >= 3);
    this.amount.hidden = false;
    this.amount.style.setProperty('--ms', `${ms}ms`);
    replay(this.amount, 'shown');
    clearTimeout(this.amountTimer);
    this.amountTimer = window.setTimeout(() => {
      this.amount.hidden = true;
    }, ms);
  }

  /**
   * A big line over the board, with a smaller one under it, for `ms` at `pace`: near the top, or
   * near the bottom when a panel fills the middle.
   */
  announce(
    title: string,
    sub: string,
    tone: Tone,
    ms: number,
    pace: number,
    { color, low = false }: { color?: string; low?: boolean } = {},
  ) {
    if (pace <= 0) return;
    const [b, span] = this.headline.children as unknown as [HTMLElement, HTMLElement];
    b.textContent = title;
    span.textContent = sub;
    this.headline.dataset.tone = tone;
    this.headline.classList.toggle('low', low);
    this.headline.style.setProperty('--tint', color ?? '');
    this.headline.style.setProperty('--ms', `${ms * pace}ms`);
    this.headline.hidden = false;
    replay(this.headline, 'shown');
    clearTimeout(this.headlineTimer);
    this.headlineTimer = window.setTimeout(() => {
      this.headline.hidden = true;
    }, ms * pace);
  }

  /** Confetti in `colors` falling over the whole screen; none on low graphics. */
  confetti(colors: readonly string[], pace: number, low: boolean, n = 90) {
    if (low || pace <= 0) return;
    for (let k = 0; k < n; k++) {
      const bit = el('i', 'confetti');
      bit.style.background = colors[k % colors.length] ?? '#fff';
      this.layer.append(bit);
      const x = Math.random() * innerWidth;
      const drift = (Math.random() - 0.5) * 160;
      const turn = (Math.random() - 0.5) * 1440;
      const ms = (1800 + Math.random() * 1600) * Math.max(0.5, pace);
      bit
        .animate(
          [
            { transform: `translate(${x}px, -20px) rotate(0deg)`, opacity: 1 },
            {
              transform: `translate(${x + drift}px, ${innerHeight + 20}px) rotate(${turn}deg)`,
              opacity: 0.9,
            },
          ],
          {
            duration: ms,
            delay: Math.random() * 700 * pace,
            easing: 'cubic-bezier(.2,.6,.4,1)',
            fill: 'both',
          },
        )
        .finished.catch(() => {})
        .finally(() => bit.remove());
    }
  }

  /** Drops what is showing: a redraw took over. */
  clear() {
    for (const e of this.layer.querySelectorAll('.coin, .confetti')) e.remove();
    this.headline.hidden = true;
    this.amount.hidden = true;
  }
}
