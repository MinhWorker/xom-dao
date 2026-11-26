/** Cờ Vây's sound effects, played through Web Audio at the Hub's volume. */
import type { BridgeSettings } from '@xomdao/bridge';

const FILES = {
  place: new URL('../assets/place.wav', import.meta.url).href,
  other: new URL('../assets/other.wav', import.meta.url).href,
  capture: new URL('../assets/capture.wav', import.meta.url).href,
  captureMany: new URL('../assets/capture-many.wav', import.meta.url).href,
  pass: new URL('../assets/pass.wav', import.meta.url).href,
  mark: new URL('../assets/mark.wav', import.meta.url).href,
  turn: new URL('../assets/turn.wav', import.meta.url).href,
  count: new URL('../assets/count.wav', import.meta.url).href,
  refused: new URL('../assets/refused.wav', import.meta.url).href,
  win: new URL('../assets/win.wav', import.meta.url).href,
  lose: new URL('../assets/lose.wav', import.meta.url).href,
};

export type Sound = keyof typeof FILES;

export class Sounds {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private readonly buffers = new Map<Sound, AudioBuffer>();
  private readonly playing = new Set<AudioBufferSourceNode>();
  private level = 1;
  private hidden = false;

  constructor() {
    this.start();
    const unlock = () => {
      this.start();
      void this.ctx?.resume();
    };
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
  }

  /** Follows the Hub's master volume, mute and effects level. */
  apply(settings: BridgeSettings) {
    this.level = settings.muted ? 0 : settings.volume * (settings.effects ?? 1);
    this.gain?.gain.setValueAtTime(this.level, this.ctx?.currentTime ?? 0);
  }

  /** Silences everything while the tab is hidden, dropping sounds still due to play. */
  setHidden(hidden: boolean) {
    this.hidden = hidden;
    if (!hidden) {
      void this.ctx?.resume();
      return;
    }
    for (const source of this.playing) source.stop();
    this.playing.clear();
    void this.ctx?.suspend();
  }

  /** Plays a sound `delay` ms from now; dropped if audio is not available yet. */
  play(sound: Sound, delay = 0) {
    this.start();
    const { ctx, gain } = this;
    const buffer = this.buffers.get(sound);
    if (!ctx || !gain || !buffer || this.hidden || this.level === 0) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    source.onended = () => this.playing.delete(source);
    this.playing.add(source);
    source.start(ctx.currentTime + delay / 1000);
  }

  private start() {
    if (this.ctx || typeof AudioContext === 'undefined') return;
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.gain.value = this.level;
    gain.connect(ctx.destination);
    this.ctx = ctx;
    this.gain = gain;
    for (const [name, url] of Object.entries(FILES) as [Sound, string][]) {
      fetch(url)
        .then((response) => response.arrayBuffer())
        .then((data) => ctx.decodeAudioData(data))
        .then((buffer) => this.buffers.set(name, buffer))
        .catch(() => {});
    }
  }
}
