import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Sounds } from './sound.js';

class FakeSource {
  buffer: unknown = null;
  onended: (() => void) | null = null;
  startedAt: number | null = null;
  stopped = false;
  connect() {}
  start(at: number) {
    this.startedAt = at;
  }
  stop() {
    this.stopped = true;
  }
}

class FakeAudioContext {
  static last: FakeAudioContext;
  currentTime = 5;
  state = 'running';
  readonly sources: FakeSource[] = [];
  readonly gain = {
    gain: {
      value: 1,
      setValueAtTime: (value: number) => {
        this.gain.gain.value = value;
      },
    },
    connect() {},
  };
  readonly destination = {};
  constructor() {
    FakeAudioContext.last = this;
  }
  createGain() {
    return this.gain;
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

  const loaded = async () => {
    const sounds = new Sounds();
    await new Promise((resolve) => setTimeout(resolve, 0));
    return { sounds, ctx: FakeAudioContext.last };
  };

  it('follows a volume change from the Hub at once', async () => {
    const { sounds, ctx } = await loaded();
    sounds.apply({ volume: 0.8, muted: false, effects: 0.5 });
    expect(ctx.gain.gain.value).toBeCloseTo(0.4);
    sounds.apply({ volume: 0.8, muted: true });
    expect(ctx.gain.gain.value).toBe(0);
    sounds.play('place');
    expect(ctx.sources).toHaveLength(0);
  });

  it('drops sounds still due and plays none while hidden', async () => {
    const { sounds, ctx } = await loaded();
    sounds.play('turn', 300);
    sounds.setHidden(true);
    expect(ctx.sources[0]?.stopped).toBe(true);
    expect(ctx.state).toBe('suspended');
    sounds.play('other');
    expect(ctx.sources).toHaveLength(1);
    sounds.setHidden(false);
    expect(ctx.state).toBe('running');
    sounds.play('other');
    expect(ctx.sources).toHaveLength(2);
  });
});
