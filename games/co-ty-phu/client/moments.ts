/**
 * The moments the whole table shouts at (#355), drawn in HTML over the board: a payment's bill,
 * stamped paid, then its money flying from one player card to the other, grander as it grows
 * (`grandeur`), and confetti. Every `pace` below 1 plays faster; 0 skips the show.
 */
import { money } from './decisions.js';

/** Coins per `grandeur`, and on low graphics. */
const COINS = [5, 9, 16, 28] as const;
const LOW_COINS = [2, 3, 4, 6] as const;
const FLIGHT_MS = [620, 820, 1000, 1200] as const;
/** Ms between one coin leaving and the next. */
const STAGGER = [70, 55, 45, 38] as const;
/** How long a player who watches reads a bill before it is stamped, per `grandeur`. */
const READ_MS = [1000, 1250, 1600, 1900] as const;
/** How long a bill waits for its payer's tap before it is paid anyway. */
const PAYER_MS = 5000;

/** What a bill says: why, who pays whom, and how much. */
export interface Bill {
  title: string;
  /** How the amount was worked out, under the title. */
  note?: string;
  from: string;
  to: string;
  amount: number;
}

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
const replay = (e: Element, className: string) => {
  e.classList.remove(className);
  void (e as HTMLElement).offsetWidth;
  e.classList.add(className);
};

export class Moments {
  private readonly layer = el('div', 'moments');
  /** A red glow round the screen while a large bill is up. */
  private readonly alarm = el('div', 'alarm');
  /** Bumped by `clear`: a bill under way stops. */
  private run = 0;

  constructor() {
    this.layer.append(this.alarm);
    document.body.append(this.layer);
  }

  /**
   * A bill for `bill` drops onto the board, its paper warmer the larger it is (`grand` is
   * `grandeur(amount)`, 0 to 3); from 2 the screen shakes and its edge glows red. The `payer`
   * taps "Thanh toán" (or it pays itself after 5 s); for the others it shows a moment, or until a
   * tap. Then it is stamped "Đã thanh toán" as the payer's card shudders, and flies off while its
   * money flies from card `from` to card `to` (no `to`: the bank, the middle of the board). `onPaid` is told at the stamp, `onCoin` as each
   * coin lands and `onFly` how long the flight takes. Resolves when the last coin lands.
   */
  async pay(
    from: HTMLElement | undefined,
    to: HTMLElement | undefined,
    bill: Bill,
    grand: number,
    pace: number,
    {
      low,
      payer,
      onPaid,
      onCoin,
      onFly,
    }: {
      low: boolean;
      payer: boolean;
      onPaid?: () => void;
      onCoin?: () => void;
      onFly: (ms: number) => void;
    },
  ) {
    if (!from || pace <= 0) {
      onFly(0);
      return;
    }
    const run = ++this.run;
    const tier = grand as 0 | 1 | 2 | 3;
    const paper = this.paper(bill, tier, pace, payer);
    if (tier >= 2) {
      this.alarm.classList.toggle('huge', tier >= 3);
      replay(this.alarm, 'shown');
      replay(document.body, 'quake');
      window.setTimeout(() => document.body.classList.remove('quake'), 500);
    }
    const limit = payer ? PAYER_MS : READ_MS[tier] * pace;
    paper.style.setProperty('--limit', `${limit}ms`);
    const tapped = new Promise<void>((done) =>
      paper.addEventListener('pointerdown', () => done(), { once: true }),
    );
    await Promise.race([tapped, this.sleep(run, limit)]);
    if (run !== this.run) return;
    paper.classList.add('paid');
    onPaid?.();
    replay(from, 'paying');
    if (!(await this.sleep(run, 520 * pace))) return;
    paper.classList.add('gone');
    await this.fly(from, to, tier, pace, low, onFly, onCoin);
    paper.remove();
  }

  /** The bill itself, dropping in. */
  private paper(bill: Bill, tier: number, pace: number, payer: boolean) {
    const paper = el('div', 'bill');
    paper.dataset.tier = String(tier);
    paper.style.setProperty('--pace', String(pace));
    paper.innerHTML =
      '<b class="head">Hóa đơn</b><span class="what"></span><span class="note"></span><dl><dt>Người trả</dt><dd class="from"></dd><dt>Người nhận</dt><dd class="to"></dd></dl><div class="total"><span>Tổng</span><b></b></div><i class="seal"><span>Đã</span>thanh toán</i>';
    if (payer) {
      paper.classList.add('payer');
      const button = el('button', 'settle');
      (button as HTMLButtonElement).type = 'button';
      button.innerHTML = 'Thanh toán<i></i>';
      paper.append(button);
    }
    const put = (selector: string, text: string) => {
      (paper.querySelector(selector) as HTMLElement).textContent = text;
    };
    put('.what', bill.title);
    put('.note', bill.note ?? '');
    put('.from', bill.from);
    put('.to', bill.to);
    put('.total b', money(bill.amount));
    this.layer.append(paper);
    return paper;
  }

  /** Coins (and notes, once it is more) fly in an arc from card `from` to card `to`. */
  private async fly(
    from: HTMLElement,
    to: HTMLElement | undefined,
    tier: 0 | 1 | 2 | 3,
    pace: number,
    low: boolean,
    onFly: (ms: number) => void,
    onCoin?: () => void,
  ) {
    const stagger = STAGGER[tier] * pace;
    const a = centre(from);
    const mid = { x: innerWidth / 2, y: innerHeight / 2 };
    const b = to ? centre(to) : mid;
    const ms = FLIGHT_MS[tier] * pace;
    const n = (low ? LOW_COINS : COINS)[tier];
    onFly(ms + (n - 1) * stagger);
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
            onCoin?.();
            if (k === 0 && to) replay(to, 'earning');
          })
          .catch(() => {})
          .finally(() => coin.remove()),
      );
    }
    await Promise.all(flights);
  }

  /**
   * Money flies from a point of the screen (`from`, CSS pixels: a hoard on the board) to card `to`;
   * `onCoin` is told as each coin lands. Resolves when the last one lands.
   */
  async shower(
    from: { x: number; y: number },
    to: HTMLElement | undefined,
    grand: number,
    pace: number,
    low: boolean,
    onCoin?: () => void,
  ) {
    if (pace <= 0) return;
    const anchor = el('i', 'anchor');
    Object.assign(anchor.style, {
      position: 'fixed',
      left: `${from.x}px`,
      top: `${from.y}px`,
      width: '0',
      height: '0',
    });
    this.layer.append(anchor);
    await this.fly(anchor, to, grand as 0 | 1 | 2 | 3, pace, low, () => {}, onCoin);
    anchor.remove();
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

  /** The tab was hidden: whatever is flying lands at once. */
  land() {
    for (const e of this.layer.querySelectorAll('.coin, .confetti'))
      for (const a of e.getAnimations()) a.finish();
  }

  /** Drops what is showing: a redraw took over. */
  clear() {
    this.run++;
    for (const e of this.layer.querySelectorAll('.coin, .confetti, .bill')) e.remove();
    this.alarm.classList.remove('shown');
  }

  /** Waits `ms`; false when `clear` took over meanwhile. */
  private async sleep(run: number, ms: number) {
    await new Promise((done) => setTimeout(done, ms));
    return run === this.run;
  }
}
