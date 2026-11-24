/**
 * The Card drawn, as 2D cards over the board. `draw` plays the deck, lying on the table backs up:
 * its top card slides off to the left, then the deck and that card fade, and a moment later the
 * Card, face on, turns over. `hold` keeps it until a tap
 * or the time runs out; `choose` deals the Card's choices beside it as cards to tap.
 */
import { type CardId, cardOf } from '../server/game/cards.js';
import type { Deck } from '../server/game/model.js';
import { TUNING } from '../server/game/tuning.js';
import type { Button } from './decisions.js';
import { cardBack } from './print.js';
import { CREAM, DECK_COLORS, drawSpecial } from './special.js';

const DECK_NAMES: Record<Deck, string> = { chance: 'Cơ hội', chest: 'Khí vận' };

/** The Card backs, drawn once per deck and shape as an image the CSS can use. */
const backs = new Map<string, string>();
const backOf = (deck: Deck, wide: boolean) => {
  const key = `${deck}:${wide}`;
  let url = backs.get(key);
  if (!url) {
    url = (wide ? cardBack(deck) : cardBack(deck, 400, 560)).toDataURL();
    backs.set(key, url);
  }
  return url;
};

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string) => {
  const e = document.createElement(tag);
  e.className = className;
  return e;
};

export class CardShow {
  private readonly root = el('div', 'cardshow');
  private readonly pile = el('div', 'pile');
  private readonly card = el('button', 'flip');
  private readonly choices = el('div', 'choices');
  /** Bumped by every show and hide: a sequence under way for an older one stops. */
  private run = 0;
  private release: (() => void) | null = null;
  private shown: CardId | null = null;

  constructor() {
    this.card.type = 'button';
    this.card.innerHTML = '<span class="face back"></span><span class="face front"></span>';
    for (let k = 0; k < 4; k++) this.pile.append(el('i', 'back'));
    const stage = el('div', 'stage');
    stage.append(this.card, this.choices);
    this.root.append(this.pile, stage);
    this.root.hidden = true;
    this.card.addEventListener('click', () => this.release?.());
    document.body.append(this.root);
  }

  /**
   * Plays drawing `id` by `by` at `pace` (1 is normal): the deck, then the Card turning over.
   * On `low` graphics the Card just appears face up. Resolves once it shows.
   */
  async draw(id: CardId, by: string, pace: number, low: boolean) {
    const run = this.start(id, by, pace);
    if (low) {
      this.root.dataset.step = 'face';
      return this.sleep(run, 200 * pace);
    }
    this.root.dataset.step = 'pile';
    if (!(await this.sleep(run, 260 * pace))) return;
    this.root.dataset.step = 'pull';
    if (!(await this.sleep(run, 520 * pace))) return;
    this.root.dataset.step = 'gone';
    if (!(await this.sleep(run, (250 + 200) * pace))) return;
    this.root.dataset.step = 'turn';
    await this.sleep(run, 650 * pace);
  }

  /** Keeps the Card until it is tapped or `ms` pass, then hides it. */
  async hold(ms: number) {
    const run = this.run;
    await new Promise<void>((done) => {
      const timer = window.setTimeout(done, ms);
      this.release = () => {
        clearTimeout(timer);
        done();
      };
    });
    this.release = null;
    if (run === this.run) this.hide();
  }

  /**
   * Shows the Card `id` (face up at once if it is not already) with `buttons` dealt beside it as
   * cards; a tap on one calls `onPick`.
   */
  choose(id: CardId, by: string, buttons: Button[], onPick: (button: Button) => void) {
    if (this.shown !== id || this.root.hidden) {
      this.start(id, by, 1);
      this.root.dataset.step = 'face';
    }
    this.choices.replaceChildren(
      ...buttons.map((button, k) => {
        const option = el('button', 'choice face');
        option.type = 'button';
        option.disabled = !!button.disabled;
        option.style.setProperty('--k', String(k));
        option.textContent = button.label;
        option.addEventListener('click', () => onPick(button), { once: true });
        return option;
      }),
    );
    this.root.dataset.choosing = '';
  }

  /** Every choice card stops answering while a pick is on its way. */
  busy(on: boolean) {
    for (const c of this.choices.children) (c as HTMLButtonElement).disabled ||= on;
  }

  hide() {
    this.run++;
    this.release?.();
    this.release = null;
    this.shown = null;
    this.root.hidden = true;
    delete this.root.dataset.step;
    delete this.root.dataset.choosing;
    this.choices.replaceChildren();
  }

  private start(id: CardId, by: string, pace: number) {
    this.hide();
    const card = cardOf(TUNING, id);
    this.shown = id;
    this.root.style.setProperty('--deck', DECK_COLORS[card.deck]);
    this.root.style.setProperty('--back', `url(${backOf(card.deck, false)})`);
    this.root.style.setProperty('--pile-back', `url(${backOf(card.deck, true)})`);
    this.root.style.setProperty('--pace', String(pace));
    const front = this.card.querySelector('.front') as HTMLElement;
    front.replaceChildren(
      Object.assign(el('span', 'deck'), { textContent: `${DECK_NAMES[card.deck]} · ${by}` }),
      icon(card.deck),
      Object.assign(el('span', 'name'), { textContent: card.name }),
      Object.assign(el('span', 'text'), { textContent: card.text }),
    );
    this.root.hidden = false;
    return this.run;
  }

  /** Waits `ms`; false when a newer show or a hide took over meanwhile. */
  private async sleep(run: number, ms: number) {
    await new Promise((done) => setTimeout(done, ms));
    return run === this.run;
  }
}

/** The deck's icon, as its Tile prints it. */
function icon(deck: Deck) {
  const c = el('canvas', 'icon');
  c.width = c.height = 96;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  ctx.translate(48, 48);
  drawSpecial(ctx, deck, 80, DECK_COLORS[deck], CREAM);
  return c;
}
