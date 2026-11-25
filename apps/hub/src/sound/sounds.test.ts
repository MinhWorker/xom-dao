import { describe, expect, it, vi } from 'vitest';
import {
  type AudioContextLike,
  createSounds,
  EFFECTS_KEY,
  MUSIC_KEY,
  MUTED_KEY,
  type SoundDeps,
  type SoundName,
  STALE_MS,
  VOLUME_KEY,
} from './sounds.js';

const NAMES: SoundName[] = ['click', 'close', 'flip', 'enter', 'locked', 'win', 'lose'];
const urls = Object.fromEntries(NAMES.map((n) => [n, `/${n}.wav`])) as Record<SoundName, string>;

function fakeContext(initial = 'suspended') {
  const started: unknown[] = [];
  const master = { gain: { value: 1 }, connect: vi.fn() };
  const ctx = {
    state: initial,
    destination: { dest: true },
    resume: vi.fn(async () => {
      ctx.state = 'running';
    }),
    decodeAudioData: vi.fn(async (bytes: ArrayBuffer) => ({ decoded: bytes.byteLength })),
    createBuffer: vi.fn(() => ({ silent: true })),
    createGain: vi.fn(() => master),
    createBufferSource: vi.fn(() => {
      const source = {
        buffer: null as unknown,
        connect: vi.fn(),
        start: vi.fn(() => started.push(source.buffer)),
      };
      return source;
    }),
  };
  return { ctx: ctx as typeof ctx & AudioContextLike, master, started };
}

function setup(overrides: Partial<SoundDeps> = {}, initial?: string) {
  const fake = fakeContext(initial);
  const createContext = vi.fn(() => fake.ctx);
  const sounds = createSounds({
    createContext,
    fetchBytes: async () => new ArrayBuffer(8),
    urls,
    ...overrides,
  });
  return { sounds, createContext, ...fake };
}

/** Plays the silent unlock buffer first, so real sounds are those after it. */
const SILENCE = { silent: true };

describe('sounds', () => {
  it('makes no sound and creates no AudioContext before the first tap', async () => {
    const { sounds, createContext, started } = setup();
    await sounds.play('click');
    expect(createContext).not.toHaveBeenCalled();
    expect(started).toEqual([]);
  });

  it('unlocks inside a tap: resumes, plays a silent buffer, then plays sounds', async () => {
    const { sounds, ctx, started } = setup();
    sounds.unlock();
    expect(ctx.resume).toHaveBeenCalled();
    expect(started).toEqual([SILENCE]);
    await sounds.play('click');
    expect(started).toEqual([SILENCE, { decoded: 8 }]);
  });

  it('keeps the iPhone silent switch from muting it, once', () => {
    const prepareSession = vi.fn();
    const { sounds } = setup({ prepareSession });
    sounds.unlock();
    sounds.unlock();
    expect(prepareSession).toHaveBeenCalledTimes(1);
  });

  it('unlocks on a tap event, not on pointerdown', () => {
    const { sounds, createContext } = setup();
    const target = new EventTarget();
    sounds.listen(target);
    target.dispatchEvent(new Event('pointerdown'));
    expect(createContext).not.toHaveBeenCalled();
    target.dispatchEvent(new Event('touchend'));
    expect(createContext).toHaveBeenCalledTimes(1);
  });

  it('stops listening when asked', () => {
    const { sounds, createContext } = setup();
    const target = new EventTarget();
    sounds.listen(target)();
    target.dispatchEvent(new Event('click'));
    expect(createContext).not.toHaveBeenCalled();
  });

  it('wakes an interrupted context on the next tap', () => {
    const { sounds, ctx } = setup();
    sounds.unlock();
    ctx.state = 'interrupted';
    sounds.unlock();
    expect(ctx.resume).toHaveBeenCalledTimes(2);
  });

  it('plays nothing while the context will not run', async () => {
    const { sounds, ctx, started } = setup();
    ctx.resume.mockRejectedValue(new Error('blocked'));
    sounds.unlock();
    await sounds.play('click');
    expect(started).toEqual([SILENCE]);
  });

  it('drops a sound that is ready too late', async () => {
    let time = 0;
    let finish: (bytes: ArrayBuffer) => void = () => {};
    const slow = new Promise<ArrayBuffer>((resolve) => {
      finish = resolve;
    });
    const { sounds, started } = setup({ now: () => time, fetchBytes: () => slow });
    sounds.unlock();
    const playing = sounds.play('click');
    time = STALE_MS + 1;
    finish(new ArrayBuffer(4));
    await playing;
    expect(started).toEqual([SILENCE]);
  });

  it('mutes: nothing plays, the master gain drops, the choice is stored and announced', async () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
    const { sounds, master, started } = setup({ storage });
    const listener = vi.fn();
    sounds.subscribe(listener);
    sounds.unlock();
    sounds.setMuted(true);
    expect(master.gain.value).toBe(0);
    expect(store.get(MUTED_KEY)).toBe('1');
    expect(listener).toHaveBeenCalledTimes(1);
    await sounds.play('click');
    expect(started).toEqual([SILENCE]);
    sounds.setMuted(true);
    expect(listener).toHaveBeenCalledTimes(1);
    sounds.setMuted(false);
    expect(master.gain.value).toBe(1);
    await sounds.play('click');
    expect(started).toHaveLength(2);
  });

  it('starts muted when the player muted it last time', () => {
    const storage = { getItem: () => '1', setItem: () => {} };
    const { sounds, master } = setup({ storage });
    expect(sounds.getState().muted).toBe(true);
    sounds.unlock();
    expect(master.gain.value).toBe(0);
  });

  it('survives storage that throws', () => {
    const storage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const { sounds } = setup({ storage });
    expect(sounds.getState().muted).toBe(false);
    expect(() => sounds.setMuted(true)).not.toThrow();
    expect(sounds.getState().muted).toBe(true);
  });

  it('sets the master volume, keeps it, announces it and clamps it', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
    const { sounds, master } = setup({ storage });
    const listener = vi.fn();
    sounds.subscribe(listener);
    sounds.unlock();
    sounds.setVolume(0.4);
    expect(master.gain.value).toBe(0.4);
    expect(store.get(VOLUME_KEY)).toBe('0.4');
    expect(listener).toHaveBeenCalledTimes(1);
    sounds.setVolume(0.4);
    expect(listener).toHaveBeenCalledTimes(1);
    sounds.setVolume(7);
    expect(sounds.getState().volume).toBe(1);
    sounds.setVolume(-1);
    expect(sounds.getState().volume).toBe(0);
  });

  it('keeps the master gain at zero while muted, then restores the volume', () => {
    const { sounds, master } = setup();
    sounds.unlock();
    sounds.setVolume(0.5);
    sounds.setMuted(true);
    sounds.setVolume(0.8);
    expect(master.gain.value).toBe(0);
    sounds.setMuted(false);
    expect(master.gain.value).toBe(0.8);
  });

  it('starts at the volume stored last time, and at full volume when it is unreadable', () => {
    const stored = setup({
      storage: { getItem: (k) => (k === VOLUME_KEY ? '0.3' : null), setItem: () => {} },
    });
    expect(stored.sounds.getState().volume).toBe(0.3);
    stored.sounds.unlock();
    expect(stored.master.gain.value).toBe(0.3);
    const junk = setup({
      storage: { getItem: (k) => (k === VOLUME_KEY ? 'loud' : null), setItem: () => {} },
    });
    expect(junk.sounds.getState().volume).toBe(1);
  });

  it('keeps music and effects apart: effects scale the Hub sounds, music does not', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
    const { sounds, master } = setup({ storage });
    const listener = vi.fn();
    sounds.subscribe(listener);
    sounds.unlock();
    sounds.setVolume(0.5);
    sounds.setEffects(0.5);
    expect(master.gain.value).toBe(0.25);
    sounds.setMusic(0.2);
    expect(master.gain.value).toBe(0.25);
    expect(sounds.getState()).toMatchObject({ volume: 0.5, effects: 0.5, music: 0.2 });
    expect(store.get(EFFECTS_KEY)).toBe('0.5');
    expect(store.get(MUSIC_KEY)).toBe('0.2');
    expect(listener).toHaveBeenCalledTimes(3);
    sounds.setMusic(0.2);
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('starts with music and effects at full, or as stored', () => {
    expect(setup().sounds.getState()).toMatchObject({ music: 1, effects: 1 });
    const stored = setup({
      storage: {
        getItem: (k) => (k === MUSIC_KEY ? '0.1' : k === EFFECTS_KEY ? '0.6' : null),
        setItem: () => {},
      },
    });
    expect(stored.sounds.getState()).toMatchObject({ music: 0.1, effects: 0.6 });
    stored.sounds.unlock();
    expect(stored.master.gain.value).toBe(0.6);
  });
});
