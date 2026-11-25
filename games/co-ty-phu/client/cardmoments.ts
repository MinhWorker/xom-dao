/**
 * The HTML moments of a few Cards, over the board: a crow flying off with a wallet (Mất ví, over
 * a clear screen, while the cash counts down), viruses round the screen with "Mất lượt" (Ốm), and
 * a jail-free pass that is signed as it shows (Vé ra tù). `pace` below 1 plays faster, 0 skips.
 */

const el = (tag: string, className: string) => {
  const e = document.createElement(tag);
  e.className = className;
  return e;
};

/** A crow side on, flying right, a brown wallet in its beak; its wings flap (`.wing`). */
const CROW = `<svg viewBox="0 0 220 140" aria-hidden="true">
  <g stroke="#0d0d12" stroke-width="3" stroke-linejoin="round">
    <path class="wing back" d="M96 62q-30-50-80-46 26 22 30 52z" fill="#26262f"/>
    <path d="M40 74l-34-8 18 18-16 10 36-4z" fill="#1b1b22"/>
    <ellipse cx="96" cy="78" rx="56" ry="28" fill="#1b1b22"/>
    <circle cx="152" cy="62" r="20" fill="#1b1b22"/>
    <path d="M168 56l30 8-30 8z" fill="#e8b23a"/>
    <path class="wing front" d="M104 70q-20-58-84-62 30 30 34 70z" fill="#2c2c36"/>
  </g>
  <circle cx="158" cy="56" r="4" fill="#fff"/>
  <circle cx="159" cy="56" r="2" fill="#0d0d12"/>
  <g transform="translate(176 70) rotate(12)">
    <rect x="0" y="0" width="34" height="24" rx="4" fill="#8a5a2b" stroke="#3a2412" stroke-width="3"/>
    <path d="M0 8h34" stroke="#3a2412" stroke-width="2"/>
    <circle cx="27" cy="15" r="3" fill="#e8b23a"/>
  </g>
</svg>`;

/** A virus: a green ball with knobbed spikes. */
const VIRUS = `<svg viewBox="0 0 100 100" aria-hidden="true">
  <g stroke="#1f4d1a" stroke-width="4" fill="#7ccf4f">
    ${Array.from({ length: 10 }, (_, k) => {
      const a = (k / 10) * Math.PI * 2;
      const x = 50 + Math.cos(a) * 40;
      const y = 50 + Math.sin(a) * 40;
      return `<path d="M${50 + Math.cos(a) * 26} ${50 + Math.sin(a) * 26}L${x} ${y}"/><circle cx="${x}" cy="${y}" r="5"/>`;
    }).join('')}
    <circle cx="50" cy="50" r="28"/>
  </g>
  <circle cx="42" cy="44" r="5" fill="#2f7a26"/><circle cx="58" cy="58" r="7" fill="#2f7a26"/><circle cx="58" cy="38" r="3" fill="#2f7a26"/>
</svg>`;

/** The jail's door: bars in an arch. */
const DOOR = `<svg viewBox="0 0 60 70" aria-hidden="true">
  <path d="M6 68V30a24 24 0 0148 0v38z" fill="#4a3a2c" stroke="#1f160f" stroke-width="4"/>
  <path d="M18 66V22M30 66V12M42 66V22" stroke="#d9c9a8" stroke-width="5" stroke-linecap="round"/>
  <path d="M8 44h44" stroke="#d9c9a8" stroke-width="4"/>
</svg>`;

/** A signature, drawn as it shows. */
const SIGN = `<svg viewBox="0 0 160 50" aria-hidden="true"><path class="ink" d="M6 38c10-26 18-30 20-14s-4 22 4 10 14-30 18-12-2 20 8 6 10-16 14-6 6 8 14-2 10-10 16-2 30-4 50-6" fill="none" stroke="#1b2a6b" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export class CardMoments {
  private readonly layer = el('div', 'card-moments');
  private run = 0;

  constructor() {
    document.body.append(this.layer);
  }

  /** A crow crosses the screen with a wallet in its beak; nothing waits for it. */
  crow(pace: number) {
    if (pace <= 0) return;
    const bird = el('div', 'crow');
    bird.innerHTML = CROW;
    bird.style.setProperty('--pace', `${pace}`);
    this.layer.append(bird);
    const y = innerHeight * (0.18 + Math.random() * 0.12);
    bird
      .animate(
        [
          { transform: `translate(-30vw, ${y + 40}px) rotate(-6deg)` },
          { transform: `translate(40vw, ${y - 10}px) rotate(-2deg)`, offset: 0.45 },
          { transform: `translate(110vw, ${y - 70}px) rotate(-10deg)` },
        ],
        { duration: 2200 * pace, easing: 'cubic-bezier(.3,.1,.6,1)', fill: 'both' },
      )
      .finished.catch(() => {})
      .finally(() => bird.remove());
  }

  /** Viruses creep in round the edges and "Mất lượt" shows, long enough to read, then all fade. */
  async sick(pace: number) {
    if (pace <= 0) return;
    const run = ++this.run;
    const root = el('div', 'sick');
    root.style.setProperty('--pace', `${pace}`);
    for (let k = 0; k < 14; k++) {
      const v = el('i', 'virus');
      v.innerHTML = VIRUS;
      const edge = k % 4;
      const along = 5 + ((k * 37) % 90);
      const [x, y] = [
        [along, -3],
        [97, along],
        [along, 97],
        [-3, along],
      ][edge] as [number, number];
      v.style.left = `${x}%`;
      v.style.top = `${y}%`;
      v.style.setProperty('--k', `${k}`);
      v.style.setProperty('--s', `${0.7 + ((k * 13) % 7) / 10}`);
      root.append(v);
    }
    const word = el('b', 'sick-word');
    word.textContent = 'Mất lượt';
    root.append(word);
    this.layer.append(root);
    await this.sleep(1900 * pace);
    root.classList.add('leaving');
    await this.sleep(350 * pace);
    if (run === this.run) root.remove();
  }

  /** A jail-free pass for `who` shows, its signature drawn in the bottom right, then it goes. */
  async ticket(who: string, pace: number) {
    if (pace <= 0) return;
    const root = el('div', 'pass');
    root.style.setProperty('--pace', `${pace}`);
    root.innerHTML = `<div class="pass-card"><div class="pass-head"><span>Bộ Tư pháp Xóm Đảo</span><b>Vé ra tù</b></div><p class="pass-body">Cấp cho <strong></strong>. Người giữ vé được ra tù ngay, không cần gieo, không cần nộp tiền. Có giá trị một lần.</p><div class="pass-foot"><i class="pass-door">${DOOR}</i><span class="pass-sign">${SIGN}<em>Giám đốc trại</em></span></div></div>`;
    (root.querySelector('strong') as HTMLElement).textContent = who;
    this.layer.append(root);
    await Promise.race([
      this.sleep(2600 * pace),
      new Promise((done) => root.addEventListener('pointerdown', done, { once: true })),
    ]);
    root.classList.add('leaving');
    await this.sleep(300 * pace);
    root.remove();
  }

  /** Drops everything showing: a redraw took over. */
  clear() {
    this.run++;
    this.layer.innerHTML = '';
  }

  private sleep(ms: number) {
    return new Promise((done) => setTimeout(done, ms));
  }
}
