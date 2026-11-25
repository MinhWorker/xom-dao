export type SoundName = 'click' | 'close' | 'flip' | 'enter' | 'locked' | 'win' | 'lose';

/** The part of `AudioContext` the Hub uses, so tests can fake it. */
export interface AudioContextLike {
  readonly state: string;
  readonly destination: unknown;
  resume(): Promise<void>;
  decodeAudioData(bytes: ArrayBuffer): Promise<unknown>;
  createBuffer(channels: number, length: number, rate: number): unknown;
  createBufferSource(): {
    buffer: unknown;
    connect(node: unknown): void;
    start(when?: number): void;
  };
  createGain(): { gain: { value: number }; connect(node: unknown): void };
}

export interface SoundDeps {
  createContext(): AudioContextLike;
  fetchBytes(url: string): Promise<ArrayBuffer>;
  /** Called once, inside the first tap, to keep sound on while an iPhone is on silent. */
  prepareSession?(): void;
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
  urls: Record<SoundName, string>;
  now?(): number;
}

export interface SoundState {
  muted: boolean;
  /** The master level from 0 to 1; it only counts while not muted. */
  volume: number;
  /** The level of music from 0 to 1, on top of `volume`. The Hub plays none; Games read it. */
  music: number;
  /** The level of sound effects from 0 to 1, on top of `volume`. Scales the Hub's own sounds. */
  effects: number;
}

/** The levels a player sets. */
export type SoundLevel = 'volume' | 'music' | 'effects';

export interface Sounds {
  /** Starts audio. Must run inside a tap; before it, `play` makes no sound. */
  unlock(): void;
  /** Unlocks on the player's first tap, and again after the browser interrupts audio. */
  listen(target: EventTarget): () => void;
  play(name: SoundName): Promise<void>;
  setMuted(muted: boolean): void;
  setVolume(volume: number): void;
  setMusic(music: number): void;
  setEffects(effects: number): void;
  getState(): SoundState;
  subscribe(listener: () => void): () => void;
}

export const MUTED_KEY = 'xomdao.muted';
export const VOLUME_KEY = 'xomdao.volume';
export const MUSIC_KEY = 'xomdao.music';
export const EFFECTS_KEY = 'xomdao.effects';

const LEVEL_KEYS: Record<SoundLevel, string> = {
  volume: VOLUME_KEY,
  music: MUSIC_KEY,
  effects: EFFECTS_KEY,
};

/** A sound that is not ready this long after the tap that asked for it is dropped. */
export const STALE_MS = 300;

/** These count as a tap for the browser; `touchstart` and `pointerdown` do not on iOS. */
const GESTURES = ['pointerup', 'touchend', 'click', 'keydown'] as const;

function readMuted(storage: SoundDeps['storage']) {
  try {
    return storage?.getItem(MUTED_KEY) === '1';
  } catch {
    return false;
  }
}

function readLevel(storage: SoundDeps['storage'], key: string) {
  try {
    const stored = storage?.getItem(key);
    return stored == null ? 1 : clampVolume(Number(stored));
  } catch {
    return 1;
  }
}

/** A level between 0 and 1 in steps of 0.01; anything that is not a number is full volume. */
export function clampVolume(volume: number) {
  if (!Number.isFinite(volume)) return 1;
  return Math.round(Math.min(1, Math.max(0, volume)) * 100) / 100;
}

/** What the Hub's own sounds play at: they are effects. */
const level = ({ muted, volume, effects }: SoundState) => (muted ? 0 : volume * effects);

/**
 * The Hub's interface sounds on Web Audio. Nothing is created until `unlock` runs inside a tap,
 * which is what iOS requires; mute is kept in storage and applied to one master gain.
 */
export function createSounds(deps: SoundDeps): Sounds {
  const now = deps.now ?? (() => Date.now());
  const listeners = new Set<() => void>();
  let state: SoundState = {
    muted: readMuted(deps.storage),
    volume: readLevel(deps.storage, VOLUME_KEY),
    music: readLevel(deps.storage, MUSIC_KEY),
    effects: readLevel(deps.storage, EFFECTS_KEY),
  };
  let context: AudioContextLike | null = null;
  let master: ReturnType<AudioContextLike['createGain']> | null = null;
  let running: Promise<boolean> = Promise.resolve(false);
  const buffers = new Map<SoundName, Promise<unknown>>();

  function decode(ctx: AudioContextLike, name: SoundName) {
    const loaded = deps
      .fetchBytes(deps.urls[name])
      .then((bytes) => ctx.decodeAudioData(bytes))
      .catch(() => null);
    buffers.set(name, loaded);
  }

  function wake(ctx: AudioContextLike) {
    if (ctx.state === 'running') {
      running = Promise.resolve(true);
      return;
    }
    running = ctx.resume().then(
      () => ctx.state === 'running',
      () => false,
    );
  }

  function unlock() {
    if (context) {
      wake(context);
      return;
    }
    try {
      deps.prepareSession?.();
      const ctx = deps.createContext();
      const gain = ctx.createGain();
      gain.gain.value = level(state);
      gain.connect(ctx.destination);
      const silence = ctx.createBufferSource();
      silence.buffer = ctx.createBuffer(1, 1, 22050);
      silence.connect(ctx.destination);
      silence.start(0);
      context = ctx;
      master = gain;
      wake(ctx);
      for (const name of Object.keys(deps.urls) as SoundName[]) decode(ctx, name);
    } catch {
      context = null;
      master = null;
    }
  }

  async function play(name: SoundName) {
    const ctx = context;
    const out = master;
    if (!ctx || !out || state.muted) return;
    const asked = now();
    const [ok, buffer] = await Promise.all([running, buffers.get(name)]);
    if (!ok || !buffer || state.muted || now() - asked > STALE_MS) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(out);
    source.start(0);
  }

  function save(key: string, value: string) {
    try {
      deps.storage?.setItem(key, value);
    } catch {
      // Storage can be blocked; the choice then lasts until the page closes.
    }
  }

  function setLevel(which: SoundLevel, next: number) {
    const value = clampVolume(next);
    if (value === state[which]) return;
    state = { ...state, [which]: value };
    if (master) master.gain.value = level(state);
    save(LEVEL_KEYS[which], String(value));
    emit();
  }

  function emit() {
    for (const listener of listeners) listener();
  }

  return {
    unlock,
    listen(target) {
      const handler = () => unlock();
      for (const type of GESTURES) target.addEventListener(type, handler, { capture: true });
      return () => {
        for (const type of GESTURES) target.removeEventListener(type, handler, { capture: true });
      };
    },
    play,
    setMuted(muted) {
      if (muted === state.muted) return;
      state = { ...state, muted };
      if (master) master.gain.value = level(state);
      save(MUTED_KEY, muted ? '1' : '0');
      emit();
    },
    setVolume: (next) => setLevel('volume', next),
    setMusic: (next) => setLevel('music', next),
    setEffects: (next) => setLevel('effects', next),
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
