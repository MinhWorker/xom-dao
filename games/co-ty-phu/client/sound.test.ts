import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Sounds, ticks } from './sound.js';

class FakeSource {
  buffer: unknown = null;
  loop = false;
  readonly playbackRate = { value: 1 };
  onended: (() => void) | null = null;
  startedAt: number | null = null;
  stopped = false;
  target: FakeGain | null = null;
  connect(target: FakeGain) {
    this.target = target;
  }
  start(at: number) {
    this.startedAt = at;
  }
  stop() {
    this.stopped = true;
  }
}

class FakeGain {
  readonly gain = {
    value: 1,
    setValueAtTime: (value: number) => {
      this.gain.value = value;
    },
  };
  connect() {}
}

class FakeAudioContext {
  static last: FakeAudioContext;
  currentTime = 5;
  state = 'running';
  readonly sources: FakeSource[] = [];
  readonly gains: FakeGain[] = [];
  readonly destination = {};
  constructor() {
    FakeAudioContext.last = this;
  }
  createGain() {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }
  createBufferSource() {
    const source = new FakeSource();
    this.sources.push(source);
    return source;
  }
  decodeAudioData() {
    return Promise.resolve({});
  }
  async suspend() {
    this.state = 'suspended';
  }
  async resume() {
    this.state = 'running';
  }
}

describe('Sounds', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { addEventListener() {} });
    vi.stubGlobal('AudioContext', FakeAudioContext);
    vi.stubGlobal('fetch', () => Promise.resolve({ arrayBuffer: () => new ArrayBuffer(0) }));
  });
  afterEach(() => vi.unstubAllGlobals());

  const loaded = async (music: string[] = []) => {
    const sounds = new Sounds(music);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const ctx = FakeAudioContext.last;
    const [effects, track] = ctx.gains as [FakeGain, FakeGain];
    return { sounds, ctx, effects, track };
  };

  it('plays effects and music at their own share of the Hub volume', async () => {
    const { sounds, effects, track } = await loaded(['a.mp3']);
    sounds.apply({ volume: 0.8, muted: false, effects: 0.5, music: 0.25 });
    expect(effects.gain.value).toBeCloseTo(0.4);
    expect(track.gain.value).toBeCloseTo(0.2);
    sounds.apply({ volume: 0.8, muted: true });
    expect(effects.gain.value).toBe(0);
    expect(track.gain.value).toBe(0);
  });

  it('loops a background track when one is supplied, and none without', async () => {
    const quiet = await loaded();
    expect(quiet.ctx.sources).toHaveLength(0);
    const { ctx, track } = await loaded(['a.mp3']);
    const music = ctx.sources[0];
    expect(music?.loop).toBe(true);
    expect(music?.target).toBe(track);
  });

  it('plays an effect on the effects channel, later when asked', async () => {
    const { sounds, ctx, effects } = await loaded();
    sounds.play('dice-hit', { at: 300, rate: 1.5 });
    expect(ctx.sources[0]?.target).toBe(effects);
    expect(ctx.sources[0]?.startedAt).toBeCloseTo(5.3);
    expect(ctx.sources[0]?.playbackRate.value).toBe(1.5);
  });

  it('plays a quieter beat through its own level into the effects channel', async () => {
    const { sounds, ctx } = await loaded();
    sounds.play('dice-hit', { gain: 0.3 });
    const level = ctx.gains[2];
    expect(level?.gain.value).toBe(0.3);
    expect(ctx.sources[0]?.target).toBe(level);
  });

  it('drops effects still due and plays none while hidden, keeping the music', async () => {
    const { sounds, ctx } = await loaded(['a.mp3']);
    sounds.play('step', { at: 300 });
    sounds.setHidden(true);
    expect(ctx.sources[1]?.stopped).toBe(true);
    expect(ctx.sources[0]?.stopped).toBe(false);
    expect(ctx.state).toBe('suspended');
    sounds.play('step');
    expect(ctx.sources).toHaveLength(2);
    sounds.setHidden(false);
    expect(ctx.state).toBe('running');
  });
});

describe('Sounds, cut short', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { addEventListener() {} });
    vi.stubGlobal('AudioContext', FakeAudioContext);
    vi.stubGlobal('fetch', () => Promise.resolve({ arrayBuffer: () => new ArrayBuffer(0) }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('stops effects still due when what they went with is cut short', async () => {
    const sounds = new Sounds([]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const ctx = FakeAudioContext.last;
    sounds.play('slam', { at: 700 });
    sounds.stop();
    expect(ctx.sources[0]?.stopped).toBe(true);
  });

  it('plays nothing before the first tap unlocks audio, so none pile up', async () => {
    const sounds = new Sounds([]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const ctx = FakeAudioContext.last;
    ctx.state = 'suspended';
    sounds.play('step');
    expect(ctx.sources).toHaveLength(0);
  });
});

describe('ticks', () => {
  it('ticks once as each of the last five seconds begins', () => {
    expect(ticks(6200, 5900)).toBe(false);
    expect(ticks(6100, 4900)).toBe(true);
    expect(ticks(4900, 4800)).toBe(false);
    expect(ticks(4100, 3950)).toBe(true);
    expect(ticks(900, 0)).toBe(false);
  });
});
