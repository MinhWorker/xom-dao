/**
 * A monopoly's moment in 2D over the whole screen, like a mobile game's banner: for the four bến
 * xe a convoy of buses and trucks roaring across a road under gold rays, for Điện lực and Cấp nước
 * a storm (clouds, rain, lightning) over a faceless engineer in a yellow hard hat rising into view.
 * The title slams in over either. A tap ends it early; `pace` below 1 plays faster, 0 skips it.
 */

const el = (tag: string, className: string) => {
  const e = document.createElement(tag);
  e.className = className;
  return e;
};

const wheel = (x: number) =>
  `<g transform="translate(${x} 78)"><g class="spin"><circle r="12" fill="#1d1d24"/><circle r="6" fill="#b9bcc6"/><path d="M-6 0h12M0-6v12" stroke="#55586a" stroke-width="2"/></g></g>`;

/** A coach in `color`, 200×92, facing right. */
const bus = (color: string) => `<svg viewBox="0 0 200 92" aria-hidden="true">
  <rect x="4" y="10" width="190" height="64" rx="12" fill="${color}"/>
  <rect x="4" y="52" width="190" height="10" fill="#000" opacity=".18"/>
  ${[16, 48, 80, 112, 144].map((x) => `<rect x="${x}" y="20" width="26" height="22" rx="4" fill="#cfe9ff"/>`).join('')}
  <path d="M174 20h12a6 6 0 016 6v20h-18z" fill="#cfe9ff"/>
  <rect x="186" y="56" width="8" height="6" rx="2" fill="#ffe58e"/>
  <rect x="2" y="58" width="6" height="6" rx="2" fill="#e0553d"/>
  ${wheel(40)}${wheel(160)}
</svg>`;

/** A lorry in `color` with a container, 220×92, facing right. */
const truck = (color: string) => `<svg viewBox="0 0 220 92" aria-hidden="true">
  <rect x="4" y="8" width="150" height="62" rx="5" fill="#f3ead8"/>
  <rect x="4" y="8" width="150" height="62" rx="5" fill="none" stroke="${color}" stroke-width="6"/>
  ${[30, 60, 90, 120].map((x) => `<path d="M${x} 16v46" stroke="${color}" stroke-width="3" opacity=".45"/>`).join('')}
  <path d="M160 26h30l22 24v24h-52z" fill="${color}"/>
  <path d="M168 32h20l14 16h-34z" fill="#cfe9ff"/>
  <rect x="206" y="58" width="8" height="6" rx="2" fill="#ffe58e"/>
  ${wheel(36)}${wheel(120)}${wheel(186)}
</svg>`;

/** The engineer: a yellow hard hat, a hi-vis vest, a wrench raised, and no face. */
const ENGINEER = `<svg viewBox="0 0 200 300" aria-hidden="true">
  <g stroke="#1b1b26" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">
    <path d="M72 194h24v80H72zM104 194h24v80h-24z" fill="#2c3f6b"/>
    <path d="M66 272h32v14H58c0-8 3-14 8-14zM102 272h32c5 0 8 6 8 14h-40z" fill="#4a3324"/>
    <path d="M70 112L50 176" stroke="#1b1b26" stroke-width="22"/>
    <path d="M70 112L50 176" stroke="#3d7bd1" stroke-width="14"/>
    <circle cx="48" cy="184" r="10" fill="#e9b48a"/>
    <path d="M130 112L170 64" stroke="#1b1b26" stroke-width="22"/>
    <path d="M130 112L170 64" stroke="#3d7bd1" stroke-width="14"/>
    <g transform="translate(174 56) rotate(20)">
      <rect x="-5" y="-44" width="10" height="46" rx="4" fill="#c3c8d4"/>
      <path d="M-13-46a13 13 0 0126 0v4h-7v-10h-12v10h-7z" fill="#c3c8d4"/>
    </g>
    <circle cx="172" cy="60" r="10" fill="#e9b48a"/>
    <path d="M62 108q38-16 76 0l4 90H58z" fill="#3d7bd1"/>
    <path d="M62 108q16-7 30-9v101H58zM108 99q16 2 30 9l4 92h-34z" fill="#ff8a1f"/>
    <path d="M60 148h32v10H60zM108 148h33v10h-33zM59 174h33v10H59zM108 174h34v10h-34z" fill="#e8ecf2" stroke-width="2"/>
    <rect x="86" y="80" width="28" height="22" fill="#d99f75"/>
    <ellipse cx="100" cy="62" rx="28" ry="32" fill="#e9b48a"/>
    <path d="M68 54a32 30 0 0164 0z" fill="#ffd21f"/>
    <path d="M93 25h14v29H93z" fill="#f2b705" stroke-width="3"/>
    <rect x="58" y="50" width="84" height="11" rx="5" fill="#f2b705"/>
  </g>
  <path d="M78 44a24 20 0 0112-14" stroke="#fff6c2" stroke-width="4" stroke-linecap="round" fill="none"/>
</svg>`;

const CLOUD = `<svg viewBox="0 0 240 90" aria-hidden="true"><path d="M30 80a28 28 0 010-56 40 40 0 0174-10 34 34 0 0160 8 32 32 0 0146 58z" fill="currentColor"/></svg>`;

/** A lightning bolt, 60×160. */
const BOLT = `<svg viewBox="0 0 60 160" aria-hidden="true"><path d="M34 0L6 84h20L12 160 56 60H34L48 0z" fill="#fff6c2" stroke="#ffd21f" stroke-width="3" stroke-linejoin="round"/></svg>`;

const VEHICLE_COLORS = ['#e0553d', '#2f80ed', '#27ae60', '#f2b705', '#9b51e0', '#eb5757'];

export class MonopolyShow {
  private readonly root = el('div', 'monopoly');
  private run = 0;
  private release: (() => void) | null = null;

  constructor() {
    this.root.hidden = true;
    this.root.addEventListener('pointerdown', () => this.release?.());
    document.body.append(this.root);
  }

  /**
   * Plays the monopoly of `of` for the owner in `color`: `title` big over it, `sub` under. Ends
   * after about 3.4 s at `pace` 1, or on a tap.
   */
  async play(
    of: 'station' | 'utility',
    title: string,
    sub: string,
    color: string,
    pace: number,
    low: boolean,
  ) {
    if (pace <= 0) return;
    const run = ++this.run;
    const root = this.root;
    root.innerHTML = '';
    root.dataset.of = of;
    root.style.setProperty('--pace', `${pace}`);
    root.classList.toggle('low', low);
    root.hidden = false;
    if (of === 'station') this.convoy(color, pace, low);
    else this.storm(pace, low);
    const banner = el('div', 'banner');
    banner.innerHTML = '<b></b><span></span>';
    (banner.querySelector('b') as HTMLElement).textContent = title;
    (banner.querySelector('span') as HTMLElement).textContent = sub;
    root.append(banner);
    await new Promise<void>((done) => {
      const timer = setTimeout(done, 3400 * pace);
      this.release = () => {
        clearTimeout(timer);
        done();
      };
    });
    this.release = null;
    if (run !== this.run) return;
    root.classList.add('leaving');
    await new Promise((done) => setTimeout(done, 280 * pace));
    if (run !== this.run) return;
    this.hide();
  }

  /** Takes it away at once. */
  hide() {
    this.run++;
    this.release?.();
    this.release = null;
    this.root.hidden = true;
    this.root.classList.remove('leaving');
    this.root.innerHTML = '';
  }

  /** Gold rays, a road across the middle and the convoy driving over it, two lanes deep. */
  private convoy(color: string, pace: number, low: boolean) {
    const rays = el('div', 'rays');
    const road = el('div', 'road');
    this.root.append(rays, road);
    const count = low ? 3 : 7;
    for (let k = 0; k < count; k++) {
      const far = k % 2 === 1;
      const v = el('div', `vehicle ${far ? 'far' : 'near'}`);
      const paint = k === 0 ? color : (VEHICLE_COLORS[k % VEHICLE_COLORS.length] as string);
      v.innerHTML = (k % 3 === 2 ? truck : bus)(paint) + (low ? '' : '<i class="lines"></i>');
      road.append(v);
      const width = v.getBoundingClientRect().width || 260;
      const dir = far ? -1 : 1;
      const from = dir > 0 ? -width - 40 : innerWidth + 40;
      const to = dir > 0 ? innerWidth + 40 : -width - 40;
      v.animate(
        [
          { transform: `translateX(${from}px) ${dir < 0 ? 'scaleX(-1)' : ''}` },
          { transform: `translateX(${to}px) ${dir < 0 ? 'scaleX(-1)' : ''}` },
        ],
        {
          duration: (far ? 1900 : 1500) * pace,
          delay: (k * 330 + (far ? 120 : 0)) * pace,
          easing: 'cubic-bezier(.35,.1,.65,.9)',
          fill: 'both',
        },
      );
    }
  }

  /** Dark clouds, rain, lightning striking now and then, and the engineer rising into view. */
  private storm(pace: number, low: boolean) {
    const clouds = el('div', 'clouds');
    for (let k = 0; k < 5; k++) {
      const c = el('i', 'cloud');
      c.innerHTML = CLOUD;
      c.style.left = `${k * 22 - 6}%`;
      c.style.setProperty('--k', `${k}`);
      clouds.append(c);
    }
    const rain = el('div', 'rain');
    for (let k = 0; k < (low ? 30 : 110); k++) {
      const d = el('i', 'drop');
      d.style.left = `${Math.random() * 110 - 5}%`;
      d.style.animationDelay = `${-Math.random() * 0.8}s`;
      d.style.animationDuration = `${0.45 + Math.random() * 0.3}s`;
      d.style.opacity = `${0.35 + Math.random() * 0.5}`;
      rain.append(d);
    }
    const flash = el('div', 'flash');
    const engineer = el('div', 'engineer');
    engineer.innerHTML = ENGINEER;
    this.root.append(clouds, rain, flash, engineer);
    const strikes = low ? [700] : [450, 1250, 2200];
    for (const [k, at] of strikes.entries()) {
      const bolt = el('i', 'bolt');
      bolt.innerHTML = BOLT;
      bolt.style.left = `${[62, 18, 78][k] ?? 50}%`;
      this.root.append(bolt);
      const frames = [
        { opacity: 0 },
        { opacity: 1, offset: 0.08 },
        { opacity: 0.2, offset: 0.2 },
        { opacity: 1, offset: 0.3 },
        { opacity: 0 },
      ];
      bolt.animate(frames, { duration: 520 * pace, delay: at * pace, fill: 'both' });
      flash.animate(
        [
          { opacity: 0 },
          { opacity: 0.75, offset: 0.1 },
          { opacity: 0.1, offset: 0.3 },
          { opacity: 0.5, offset: 0.4 },
          { opacity: 0 },
        ],
        { duration: 520 * pace, delay: at * pace },
      );
    }
  }
}
