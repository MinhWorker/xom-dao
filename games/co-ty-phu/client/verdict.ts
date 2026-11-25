/**
 * The beat before a token is thrown into jail, in 2D over the whole screen: a faceless lawyer
 * swings in pointing, and "Có tội!!!" bursts out of a jagged shout beside their finger. A tap ends
 * it early; `pace` below 1 plays faster, 0 skips it.
 */

const el = (tag: string, className: string) => {
  const e = document.createElement(tag);
  e.className = className;
  return e;
};

/** The lawyer, 420×260: dark suit, red tie, the right arm out and pointing, and no face. */
const LAWYER = `<svg class="art" viewBox="0 0 420 260" aria-hidden="true">
  <g stroke="#14141c" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">
    <path d="M40 270l14-120q46-26 104-6l20 126z" fill="#2b2f45"/>
    <path d="M92 132l20 30 20-32z" fill="#f4f4f8" stroke-width="3"/>
    <path d="M107 150l5-8 5 8-3 70h-4z" fill="#d1312a" stroke-width="3"/>
    <path d="M84 128l26 60-30-24zM140 126l-26 62 30-26z" fill="#3b405c" stroke-width="3"/>
    <path d="M150 140L318 112" stroke="#14141c" stroke-width="38"/>
    <path d="M150 140L318 112" stroke="#2b2f45" stroke-width="28"/>
    <path d="M306 100l18-3 4 26-18 3z" fill="#f4f4f8" stroke-width="3"/>
    <path d="M326 98q20-6 30 2l42-6q10 0 10 7t-10 8l-38 6q-4 14-22 16l-12 2z" fill="#e9b48a"/>
    <path d="M58 166q-10 40-6 104" fill="none" stroke-width="3"/>
    <rect x="98" y="100" width="26" height="26" fill="#d99f75"/>
    <ellipse cx="110" cy="78" rx="34" ry="38" fill="#e9b48a"/>
    <path d="M76 74q-4-40 36-44 36 0 34 40-12-18-36-18t-34 22z" fill="#1d1f2b"/>
  </g>
  <path d="M342 104q8-2 12 4" stroke="#c98d63" stroke-width="3" fill="none" stroke-linecap="round"/>
</svg>`;

/** A jagged shout bubble, 300×180, white with a red rim. */
const BURST = `<svg class="art" viewBox="0 0 300 180" aria-hidden="true">
  <path d="M150 4l18 34 40-26 4 42 52-14-22 40 52 14-46 24 34 36-50-4 4 44-40-30-26 38-18-40-40 26 2-44-52 8 30-38-50-20 48-16-30-38 52 8 6-42 38 28z" fill="#fff" stroke="#d1312a" stroke-width="6" stroke-linejoin="round"/>
</svg>`;

export class Verdict {
  private readonly root = el('div', 'verdict');
  private run = 0;
  private release: (() => void) | null = null;

  constructor() {
    this.root.hidden = true;
    this.root.addEventListener('pointerdown', () => this.release?.());
    document.body.append(this.root);
  }

  /** "Có tội!!!" over `who` going to jail; about 1.7 s at `pace` 1, or until a tap. */
  async play(who: string, pace: number, low: boolean) {
    if (pace <= 0) return;
    const run = ++this.run;
    const root = this.root;
    root.innerHTML = `<i class="burst-lines"></i><div class="lawyer">${LAWYER}</div><div class="shout">${BURST}<b class="shout-title">Có tội!!!</b></div><p class="who"></p>`;
    (root.querySelector('.who') as HTMLElement).textContent = `${who} vào tù`;
    root.style.setProperty('--pace', `${pace}`);
    root.classList.toggle('low', low);
    root.classList.remove('leaving');
    root.hidden = false;
    await new Promise<void>((done) => {
      const timer = setTimeout(done, 1700 * pace);
      this.release = () => {
        clearTimeout(timer);
        done();
      };
    });
    this.release = null;
    if (run !== this.run) return;
    root.classList.add('leaving');
    await new Promise((done) => setTimeout(done, 220 * pace));
    if (run === this.run) this.hide();
  }

  /** Takes it away at once. */
  hide() {
    this.run++;
    this.release?.();
    this.release = null;
    this.root.hidden = true;
    this.root.innerHTML = '';
  }
}
