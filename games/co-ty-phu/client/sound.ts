/** Cờ Tỷ Phú's sound effects and background music, played through Web Audio at the Hub's levels. */
import type { BridgeSettings } from '@xomdao/bridge';

const file = (name: string) => new URL(`../assets/${name}.wav`, import.meta.url).href;

const FILES = {
  'dice-hit': file('dice-hit'),
  step: file('step'),
  slam: file('slam'),
  coin: file('coin'),
  coins: file('coins'),
  stamp: file('stamp'),
  buy: file('buy'),
  build: file('build'),
  sell: file('sell'),
  takeover: file('takeover'),
  hotel: file('hotel'),
  chime: file('chime'),
  fullset: file('fullset'),
  'card-slide': file('card-slide'),
  card: file('card'),
  right: file('right'),
  wrong: file('wrong'),
  jail: file('jail'),
  release: file('release'),
  plane: file('plane'),
  crumble: file('crumble'),
  bankrupt: file('bankrupt'),
  victory: file('victory'),
  convoy: file('convoy'),
  rain: file('rain'),
  thunder: file('thunder'),
  guilty: file('guilty'),
  horn: file('horn'),
  crow: file('crow'),
  hammer: file('hammer'),
  tick: file('tick'),
};

export type Sound = keyof typeof FILES;

/** The owner's background tracks: any `assets/music-*.mp3`; one is picked per page load. */
const TRACKS = Object.values(
  import.meta.glob<string>('../assets/music-*.mp3', {
    eager: true,
    query: '?url',
    import: 'default',
  }),
);

/** The clock ticks through its last seconds. */
const TICK_FROM_S = 5;

/** Whether the decision clock ticks between `before` and `after` ms left: as each of its last seconds begins. */
export const ticks = (before: number, after: number) => {
  const was = Math.ceil(before / 1000);
  const now = Math.ceil(after / 1000);
  return now < was && now >= 1 && now <= TICK_FROM_S;
};

export class Sounds {
  private ctx: AudioContext | null = null;
  private effects: GainNode | null = null;
  private music: GainNode | null = null;
  private readonly buffers = new Map<Sound, AudioBuffer>();
  private readonly playing = new Set<AudioBufferSourceNode>();
  private levels = { effects: 1, music: 1 };
  private hidden = false;

  constructor(private readonly tracks: readonly string[] = TRACKS) {
    this.start();
    const unlock = () => {
      this.start();
      void this.ctx?.resume();
    };
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
  }

  /** Follows the Hub's master volume, mute, and its effects and music levels. */
  apply(settings: BridgeSettings) {
    const master = settings.muted ? 0 : settings.volume;
    this.levels = {
      effects: master * (settings.effects ?? 1),
      music: master * (settings.music ?? 1),
    };
    const at = this.ctx?.currentTime ?? 0;
    this.effects?.gain.setValueAtTime(this.levels.effects, at);
    this.music?.gain.setValueAtTime(this.levels.music, at);
  }

  /** Silences everything while the tab is hidden, dropping effects still due to play. */
  setHidden(hidden: boolean) {
    this.hidden = hidden;
    if (!hidden) {
      void this.ctx?.resume();
      return;
    }
    this.stop();
    void this.ctx?.suspend();
  }

  /** Stops the effects playing and those still due: what they went with was cut short. */
  stop() {
    for (const source of this.playing) source.stop();
    this.playing.clear();
  }

  /**
   * Plays an effect `at` ms from now, `rate` times its speed and pitch and at `gain` of the effects
   * level; dropped if audio is not available yet.
   */
  play(
    sound: Sound,
    { at = 0, rate = 1, gain = 1 }: { at?: number; rate?: number; gain?: number } = {},
  ) {
    this.start();
    const { ctx, effects } = this;
    const buffer = this.buffers.get(sound);
    if (!ctx || !effects || !buffer || this.hidden || this.levels.effects === 0) return;
    if (ctx.state !== 'running') return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    let out: AudioNode = effects;
    if (gain !== 1) {
      const level = ctx.createGain();
      level.gain.value = gain;
      level.connect(effects);
      out = level;
    }
    source.connect(out);
    source.onended = () => this.playing.delete(source);
    this.playing.add(source);
    source.start(ctx.currentTime + Math.max(0, at) / 1000);
  }

  private start() {
    if (this.ctx || typeof AudioContext === 'undefined') return;
    const ctx = new AudioContext();
    const effects = ctx.createGain();
    effects.gain.value = this.levels.effects;
    effects.connect(ctx.destination);
    const music = ctx.createGain();
    music.gain.value = this.levels.music;
    music.connect(ctx.destination);
    this.ctx = ctx;
    this.effects = effects;
    this.music = music;
    for (const [name, url] of Object.entries(FILES) as [Sound, string][])
      void load(ctx, url).then((buffer) => buffer && this.buffers.set(name, buffer));
    const track = this.tracks[Math.floor(Math.random() * this.tracks.length)];
    if (track)
      void load(ctx, track).then((buffer) => {
        if (!buffer) return;
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(music);
        source.start();
      });
  }
}

const load = (ctx: AudioContext, url: string) =>
  fetch(url)
    .then((response) => response.arrayBuffer())
    .then((data) => ctx.decodeAudioData(data))
    .catch(() => null);
