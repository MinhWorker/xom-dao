/**
 * The Card drawn, as 2D cards over the board. `draw` plays the deck, lying on the table backs up:
 * its top card slides off to the left, then the deck and that card fade, and a moment later the
 * Card, face on, turns over. `hold` keeps it until a tap
 * or the time runs out; `choose` deals the Card's choices beside it as cards to tap. `quiz`
 * prints a Quiz on the Card with its four answers dealt round it, two each side.
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
  private readonly stage = el('div', 'stage');
  /** The time left to decide, as a bright rim running out round the Card. */
  private readonly countdown = el('i', 'countdown');
  /** Bumped by every show and hide: a sequence under way for an older one stops. */
  private run = 0;
  private release: (() => void) | null = null;
  private shown: CardId | null = null;

  constructor() {
    this.card.type = 'button';
    this.card.innerHTML = '<span class="face back"></span><span class="face front"></span>';
    this.countdown.append(el('i', 'ring'));
    this.countdown.hidden = true;
    for (let k = 0; k < 4; k++) this.pile.append(el('i', 'back'));
    this.stage.append(this.card, this.choices);
    this.root.append(this.pile, this.stage);
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

  /**
   * The Quiz `text` on a Card of `deck`, taken on by `by`, with `buttons`, its answers, dealt round
   * it; a tap on one calls `onPick`, or nothing for a player who watches. Kept as it is when that
   * Quiz already shows.
   */
  quiz(
    deck: Deck,
    by: string,
    text: string,
    buttons: Button[],
    onPick: ((button: Button) => void) | null,
  ) {
    const key = `${deck}|${by}|${text}`;
    if (this.root.dataset.quiz === key && !this.root.hidden) return;
    this.hide();
    this.dress(deck, 1);
    const front = this.card.querySelector('.front') as HTMLElement;
    const question = el('span', 'question');
    const words = el('span', 'words');
    words.append(...numbered(text));
    question.append(words);
    const head = el('span', 'quiz-head');
    head.append(
      Object.assign(el('span', 'deck'), { textContent: by }),
      Object.assign(el('span', 'name'), { textContent: 'Đố' }),
    );
    front.replaceChildren(head, question);
    this.root.hidden = false;
    this.root.dataset.step = 'face';
    this.root.dataset.quiz = key;
    requestAnimationFrame(() => fitText(question, 30, 13));
    this.stage.append(
      ...buttons.map((button, k) => {
        const answer = el('button', `choice face answer a${k}`);
        answer.type = 'button';
        answer.disabled = !onPick || !!button.disabled;
        answer.style.setProperty('--k', String(k));
        answer.textContent = button.label;
        if (onPick) answer.addEventListener('click', () => onPick(button), { once: true });
        return answer;
      }),
    );
  }

  /** Before the Quiz's answer shows: the answer picked pulses, the others dim. */
  quizWait(picked: number | null) {
    this.root.dataset.waiting = '';
    this.answers().forEach((a, i) => {
      a.classList.toggle('picked', i === picked);
    });
  }

  /** Marks the Quiz's right answer, and the one picked when it was wrong. */
  quizResult(answer: number, picked: number | null) {
    delete this.root.dataset.waiting;
    this.answers().forEach((a, i) => {
      a.classList.remove('picked');
      a.classList.toggle('right', i === answer);
      a.classList.toggle('wrong', i === picked && i !== answer);
    });
  }

  /** The clock of the decision on the Card: how much of it is left, from 0 to 1; `null` hides it. */
  timer(left: number | null) {
    const on = left !== null && !this.root.hidden && this.root.dataset.step === 'face';
    this.countdown.hidden = !on;
    if (!on) return;
    const front = this.card.querySelector('.front') as HTMLElement;
    if (this.countdown.parentElement !== front) front.append(this.countdown);
    this.countdown.style.setProperty('--left', String(left));
    this.countdown.classList.toggle('short', left < 0.3);
  }

  private answers() {
    return [...this.stage.querySelectorAll<HTMLButtonElement>('.answer')];
  }

  /** Every choice card stops answering while a pick is on its way. */
  busy(on: boolean) {
    for (const c of [...this.choices.children, ...this.answers()])
      (c as HTMLButtonElement).disabled ||= on;
  }

  hide() {
    this.run++;
    this.release?.();
    this.release = null;
    this.shown = null;
    this.root.hidden = true;
    delete this.root.dataset.step;
    delete this.root.dataset.choosing;
    delete this.root.dataset.quiz;
    delete this.root.dataset.waiting;
    this.choices.replaceChildren();
    for (const a of this.answers()) a.remove();
  }

  private start(id: CardId, by: string, pace: number) {
    this.hide();
    const card = cardOf(TUNING, id);
    this.shown = id;
    this.dress(card.deck, pace);
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

  /** Colours the cards as `deck`'s and sets how fast they move. */
  private dress(deck: Deck, pace: number) {
    this.root.style.setProperty('--deck', DECK_COLORS[deck]);
    this.root.style.setProperty('--back', `url(${backOf(deck, false)})`);
    this.root.style.setProperty('--pile-back', `url(${backOf(deck, true)})`);
    this.root.style.setProperty('--pace', String(pace));
  }

  /** Waits `ms`; false when a newer show or a hide took over meanwhile. */
  private async sleep(run: number, ms: number) {
    await new Promise((done) => setTimeout(done, ms));
    return run === this.run;
  }
}

/** `text` with its numbers (and fractions) in their own `<b class="num">`. */
function numbered(text: string) {
  return text
    .split(/(\d+(?:[.,]\d+)?(?:\/\d+)?)/)
    .map((part, k) =>
      k % 2 ? Object.assign(el('b', 'num'), { textContent: part }) : document.createTextNode(part),
    );
}

/** The largest font size from `max` down to `min` px at which `e` fits its box. */
function fitText(e: HTMLElement, max: number, min: number) {
  for (let px = max; px >= min; px--) {
    e.style.fontSize = `${px}px`;
    if (e.scrollHeight <= e.clientHeight && e.scrollWidth <= e.clientWidth) return;
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
