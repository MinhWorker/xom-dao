// Synthesizes the sound effects of the Games made without recorded sounds, as mono 16-bit WAV:
//   node scripts/sfx.mjs [hai-chien|co-vay|co-vua|co-tuong]     (no argument: all of them)
// Every sound is built from noise, oscillators, envelopes, filters and a small room reverb, so a
// sound changes by editing its recipe below and running the script again.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const RATE = 44100;

/** A seeded random source, so the files only change when a recipe does. */
function random(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 4294967296) * 2 - 1;
  };
}

const buffer = (seconds) => new Float32Array(Math.ceil(seconds * RATE));

/** Adds `b` into `a` from `at` seconds, times `gain`. */
function mix(a, b, at = 0, gain = 1) {
  const start = Math.round(at * RATE);
  for (let i = 0; i < b.length && start + i < a.length; i++) a[start + i] += b[i] * gain;
  return a;
}

/** An envelope: attack, then exponential decay with time constant `decay`. */
function env(out, attack, decay, hold = 0) {
  for (let i = 0; i < out.length; i++) {
    const t = i / RATE;
    const g = t < attack ? t / attack : t < attack + hold ? 1 : Math.exp(-(t - attack - hold) / decay);
    out[i] *= g;
  }
  return out;
}

function noise(seconds, seed = 1) {
  const r = random(seed);
  const out = buffer(seconds);
  for (let i = 0; i < out.length; i++) out[i] = r();
  return out;
}

/** An oscillator whose frequency follows `freq(t)` (Hz); `shape` sine, tri, square or saw. */
function osc(seconds, freq, shape = 'sine') {
  const out = buffer(seconds);
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / RATE;
    phase += (typeof freq === 'function' ? freq(t) : freq) / RATE;
    const p = phase % 1;
    out[i] =
      shape === 'sine'
        ? Math.sin(2 * Math.PI * p)
        : shape === 'tri'
          ? 4 * Math.abs(p - 0.5) - 1
          : shape === 'square'
            ? p < 0.5
              ? 1
              : -1
            : 2 * p - 1;
  }
  return out;
}

/** A biquad filter (RBJ): `type` lowpass, highpass or bandpass; `freq` may follow time. */
function biquad(input, type, freq, q = 0.707) {
  const out = new Float32Array(input.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < input.length; i++) {
    const f = typeof freq === 'function' ? freq(i / RATE) : freq;
    const w = (2 * Math.PI * Math.min(f, RATE * 0.45)) / RATE;
    const alpha = Math.sin(w) / (2 * q);
    const cos = Math.cos(w);
    let b0;
    let b1;
    let b2;
    if (type === 'lowpass') {
      b0 = (1 - cos) / 2;
      b1 = 1 - cos;
      b2 = (1 - cos) / 2;
    } else if (type === 'highpass') {
      b0 = (1 + cos) / 2;
      b1 = -(1 + cos);
      b2 = (1 + cos) / 2;
    } else {
      b0 = alpha;
      b1 = 0;
      b2 = -alpha;
    }
    const a0 = 1 + alpha;
    const a1 = -2 * cos;
    const a2 = 1 - alpha;
    const x = input[i];
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    out[i] = y;
  }
  return out;
}

/** A small Schroeder reverb: `wet` of the result is the room. */
function reverb(input, { size = 1, wet = 0.25, tail = 1.2 } = {}) {
  const out = new Float32Array(input.length + Math.round(tail * RATE));
  out.set(input);
  const combs = [1557, 1617, 1491, 1422].map((n) => Math.round(n * size));
  const wetBuf = new Float32Array(out.length);
  for (const delay of combs) {
    const line = new Float32Array(delay);
    let k = 0;
    for (let i = 0; i < out.length; i++) {
      const y = line[k];
      line[k] = out[i] + y * 0.8;
      wetBuf[i] += y / combs.length;
      k = (k + 1) % delay;
    }
  }
  for (const delay of [225, 556]) {
    const line = new Float32Array(delay);
    let k = 0;
    for (let i = 0; i < wetBuf.length; i++) {
      const buf = line[k];
      const y = -wetBuf[i] + buf;
      line[k] = wetBuf[i] + buf * 0.5;
      wetBuf[i] = y;
      k = (k + 1) % delay;
    }
  }
  for (let i = 0; i < out.length; i++) out[i] = out[i] * (1 - wet) + wetBuf[i] * wet;
  return out;
}

/** Soft clipping, for weight. */
const drive = (input, amount) => input.map((x) => Math.tanh(x * amount) / Math.tanh(amount));

/** Scales to `peak` and fades out the last `fade` seconds, cutting trailing silence. */
function finish(input, peak = 0.85, fade = 0.08) {
  let max = 0;
  for (const x of input) max = Math.max(max, Math.abs(x));
  let end = input.length;
  while (end > 1 && Math.abs(input[end - 1]) < max * 0.004) end--;
  const out = input.slice(0, end);
  const g = max ? peak / max : 1;
  const n = Math.round(fade * RATE);
  for (let i = 0; i < out.length; i++) {
    const tail = out.length - i;
    out[i] *= g * (tail < n ? tail / n : 1);
  }
  return out;
}

function wav(path, samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), i * 2);
  }
  const head = Buffer.alloc(44);
  head.write('RIFF', 0);
  head.writeUInt32LE(36 + data.length, 4);
  head.write('WAVEfmt ', 8);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(RATE, 24);
  head.writeUInt32LE(RATE * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write('data', 36);
  head.writeUInt32LE(data.length, 40);
  writeFileSync(resolve(ROOT, path), Buffer.concat([head, data]));
  console.log(`wrote ${path} (${(samples.length / RATE).toFixed(2)} s)`);
}

/** A boom: a falling sine thump under a burst of low noise. */
function boom(seconds, { from = 120, to = 38, body = 0.35, seed = 3, bright = 900 } = {}) {
  const thump = env(osc(seconds, (t) => to + (from - to) * Math.exp(-t * 9)), 0.004, body);
  const rumble = env(biquad(noise(seconds, seed), 'lowpass', (t) => 200 + bright * Math.exp(-t * 6)), 0.003, body * 0.9);
  return drive(mix(mix(buffer(seconds), thump, 0, 1), rumble, 0, 0.9), 2.2);
}

/** A splash: bright noise falling in pitch, with droplets. */
function splash(seconds, seed = 5) {
  const out = env(
    biquad(noise(seconds, seed), 'bandpass', (t) => 2600 * Math.exp(-t * 2.2) + 300, 0.8),
    0.01,
    0.28,
  );
  const r = random(seed + 9);
  for (let i = 0; i < 14; i++) {
    const at = 0.08 + Math.abs(r()) * (seconds * 0.6);
    const f = 900 + Math.abs(r()) * 1800;
    const drop = env(osc(0.06, (t) => f + t * 6000), 0.001, 0.015);
    mix(out, drop, at, 0.12);
  }
  return out;
}

/** A bell-like tone: a few inharmonic partials decaying. */
function bell(freq, seconds, decay = 0.6) {
  const out = buffer(seconds);
  for (const [ratio, gain] of [
    [1, 1],
    [2.01, 0.45],
    [2.98, 0.22],
    [4.1, 0.1],
  ]) {
    mix(out, env(osc(seconds, freq * ratio), 0.003, decay / ratio), 0, gain);
  }
  return out;
}

/** A knock on wood or stone: a short resonant ping over a click. */
function knock(freq, { q = 9, decay = 0.05, click = 0.4, seed = 11, seconds = 0.25 } = {}) {
  const hit = env(noise(seconds, seed), 0.0005, 0.004);
  const body = env(biquad(noise(seconds, seed + 1), 'bandpass', freq, q), 0.0008, decay);
  const tone = env(osc(seconds, freq), 0.0008, decay * 0.8);
  return mix(mix(mix(buffer(seconds), hit, 0, click), body, 0, 1.6), tone, 0, 0.5);
}

/** Notes one after another as bells: `[semitones from root, at seconds]`. */
function arpeggio(root, notes, seconds, decay = 0.7) {
  const out = buffer(seconds);
  for (const [semi, at, gain = 1] of notes) {
    mix(out, bell(root * 2 ** (semi / 12), seconds - at, decay), at, gain);
  }
  return out;
}

/** A stone set down on a wooden board: a hard click and a short hollow knock under it. */
function stoneClack(seed, pitch = 1) {
  const click = env(biquad(noise(0.3, seed), 'highpass', 2500), 0.0003, 0.006);
  const knockBody = knock(420 * pitch, { q: 6, decay: 0.07, click: 0.1, seed: seed + 5, seconds: 0.3 });
  const ring = env(osc(0.3, 2350 * pitch), 0.0005, 0.02);
  return mix(mix(mix(buffer(0.3), click, 0, 1.2), knockBody, 0, 1), ring, 0, 0.12);
}

/** Stones gathered from the board: a few small clicks close together. */
function rattle(count, seed) {
  const r = random(seed);
  const out = buffer(0.25 + count * 0.04);
  for (let i = 0; i < count; i++) {
    const at = 0.02 + Math.abs(r()) * (0.06 + count * 0.025);
    mix(out, env(biquad(noise(0.06, seed + i), 'bandpass', 3000 + Math.abs(r()) * 3000, 3), 0.0005, 0.01), at, 0.7);
  }
  return out;
}


/** A wooden piece set on a board: a soft felt thud and a short knock; `weight` makes it deeper. */
function woodPiece(seed, pitch = 1, weight = 1) {
  const thud = env(biquad(noise(0.3, seed), 'lowpass', 500 * pitch), 0.001, 0.025 * weight);
  const knockBody = knock(520 * pitch, { q: 4, decay: 0.035 * weight, click: 0.12, seed: seed + 3, seconds: 0.3 });
  const low = env(osc(0.3, 150 * pitch), 0.001, 0.03 * weight);
  return mix(mix(mix(buffer(0.3), thud, 0, 1.4), knockBody, 0, 0.9), low, 0, 0.5 * weight);
}

/** Pieces for a chess-like game: every move, capture and result. */
function boardGame(pitch, weight) {
  return {
    move: () => finish(reverb(woodPiece(51, pitch, weight), { wet: 0.1, size: 0.6 }), 0.75),
    other: () => finish(reverb(woodPiece(52, pitch * 0.93, weight), { wet: 0.1, size: 0.6 }), 0.65),
    capture: () => {
      const out = buffer(0.5);
      mix(out, woodPiece(53, pitch * 1.08, weight), 0, 0.8);
      mix(out, woodPiece(54, pitch * 0.9, weight * 1.2), 0.05, 1);
      return finish(reverb(out, { wet: 0.14, size: 0.6 }), 0.85);
    },
    castle: () => {
      const out = buffer(0.5);
      mix(out, woodPiece(55, pitch, weight), 0, 1);
      mix(out, woodPiece(56, pitch * 0.95, weight), 0.11, 0.85);
      return finish(reverb(out, { wet: 0.12, size: 0.6 }), 0.75);
    },
    check: () => finish(reverb(arpeggio(880, [[0, 0], [-2, 0.07]], 0.8, 0.18), { wet: 0.25 }), 0.4),
    promote: () =>
      finish(reverb(mix(woodPiece(57, pitch, weight), arpeggio(659.25, [[0, 0.04], [7, 0.12], [12, 0.2]], 1.1, 0.35), 0, 0.5), { wet: 0.25 }), 0.7),
    pick: () => finish(knock(1300 * pitch, { q: 5, decay: 0.012, click: 0.15, seed: 58, seconds: 0.08 }), 0.25),
    offer: () => finish(reverb(arpeggio(587.33, [[0, 0], [5, 0.14]], 1.0, 0.35), { wet: 0.3 }), 0.45),
    refused: () => finish(env(biquad(osc(0.2, 140, 'square'), 'lowpass', 600), 0.005, 0.06), 0.35),
    win: () =>
      finish(reverb(arpeggio(523.25, [[0, 0], [4, 0.12], [7, 0.24], [12, 0.4, 1.2]], 2.0, 0.7), { wet: 0.3 }), 0.65),
    lose: () => finish(reverb(arpeggio(392, [[3, 0], [0, 0.22], [-4, 0.46, 1.1]], 2.0, 0.7), { wet: 0.35 }), 0.55),
    draw: () => finish(reverb(arpeggio(440, [[0, 0], [5, 0.18], [0, 0.36, 0.8]], 1.6, 0.5), { wet: 0.3 }), 0.5),
  };
}

const SOUNDS = {
  'co-vua': boardGame(1, 1),
  'co-tuong': (({ castle, promote, ...rest }) => rest)(boardGame(0.8, 1.5)),
  'co-vay': {
    place: () => finish(reverb(stoneClack(1), { wet: 0.12, size: 0.6 }), 0.8),
    other: () => finish(reverb(stoneClack(2, 0.92), { wet: 0.12, size: 0.6 }), 0.7),
    capture: () => finish(reverb(rattle(3, 4), { wet: 0.15, size: 0.6 }), 0.6),
    'capture-many': () => finish(reverb(rattle(9, 5), { wet: 0.15, size: 0.6 }), 0.7),
    pass: () => finish(env(biquad(noise(0.35, 41), 'bandpass', 700, 1.2), 0.02, 0.08), 0.35),
    mark: () => finish(knock(1500, { decay: 0.02, seed: 42 }), 0.35),
    turn: () => finish(reverb(arpeggio(784, [[0, 0]], 0.9, 0.25), { wet: 0.3 }), 0.3),
    count: () => finish(reverb(arpeggio(523.25, [[0, 0], [7, 0.1], [12, 0.2]], 1.4, 0.4), { wet: 0.3 }), 0.5),
    refused: () => finish(env(biquad(osc(0.2, 140, 'square'), 'lowpass', 600), 0.005, 0.06), 0.35),
    win: () =>
      finish(reverb(arpeggio(523.25, [[0, 0], [4, 0.12], [7, 0.24], [12, 0.4, 1.2]], 2.0, 0.7), { wet: 0.3 }), 0.65),
    lose: () => finish(reverb(arpeggio(392, [[3, 0], [0, 0.22], [-4, 0.46, 1.1]], 2.0, 0.7), { wet: 0.35 }), 0.55),
  },
  'hai-chien': {
    fire: () => finish(reverb(boom(0.9, { from: 150, to: 45, body: 0.22 }), { wet: 0.3, size: 1.3 })),
    whistle: () =>
      finish(
        env(
          mix(
            osc(0.75, (t) => 1500 - t * 1300),
            biquad(noise(0.75, 21), 'bandpass', (t) => 1500 - t * 1300, 6),
            0,
            0.4,
          ),
          0.25,
          0.6,
          0.3,
        ),
        0.4,
      ),
    splash: () => finish(reverb(splash(1.1), { wet: 0.2 }), 0.7),
    hit: () =>
      finish(reverb(boom(1.4, { from: 110, to: 32, body: 0.45, bright: 1400, seed: 7 }), { wet: 0.35, size: 1.4 })),
    sunk: () => {
      const out = buffer(3.2);
      mix(out, boom(1.6, { from: 90, to: 28, body: 0.6, bright: 1100, seed: 8 }), 0, 1);
      mix(out, boom(1.2, { from: 120, to: 35, body: 0.4, seed: 9 }), 0.45, 0.7);
      mix(out, boom(1.2, { from: 100, to: 30, body: 0.4, seed: 10 }), 0.9, 0.55);
      const groan = env(
        biquad(osc(2.2, (t) => 70 - t * 18, 'saw'), 'lowpass', 260, 4),
        0.4,
        0.8,
        0.6,
      );
      mix(out, groan, 0.9, 0.35);
      mix(out, splash(1.6, 12), 1.6, 0.4);
      return finish(reverb(out, { wet: 0.35, size: 1.5 }));
    },
    radar: () => {
      const out = buffer(1.6);
      for (const [at, gain] of [
        [0, 1],
        [0.38, 0.45],
        [0.76, 0.2],
      ]) {
        mix(out, env(osc(0.5, 1320), 0.004, 0.09), at, gain);
        mix(out, env(osc(0.5, 1980), 0.004, 0.05), at, gain * 0.3);
      }
      return finish(reverb(out, { wet: 0.4, size: 1.1 }), 0.6);
    },
    place: () =>
      finish(
        mix(
          knock(180, { q: 3, decay: 0.06, click: 0.2, seed: 31 }),
          env(biquad(noise(0.3, 32), 'lowpass', 900), 0.01, 0.07),
          0,
          0.5,
        ),
        0.6,
      ),
    rotate: () => finish(mix(knock(620, { decay: 0.03, seed: 33 }), knock(880, { decay: 0.025, seed: 34 }), 0.06, 0.7), 0.5),
    ready: () => finish(reverb(arpeggio(523.25, [[0, 0], [7, 0.09]], 1.0, 0.35), { wet: 0.25 }), 0.55),
    turn: () => finish(reverb(arpeggio(659.25, [[0, 0], [5, 0.12]], 1.0, 0.3), { wet: 0.3 }), 0.45),
    refused: () => finish(env(biquad(osc(0.25, 110, 'square'), 'lowpass', 700), 0.005, 0.07), 0.4),
    win: () =>
      finish(
        reverb(
          arpeggio(392, [[0, 0], [4, 0.14], [7, 0.28], [12, 0.42, 1.2], [16, 0.62, 0.6]], 2.2, 0.8),
          { wet: 0.3 },
        ),
        0.7,
      ),
    lose: () =>
      finish(reverb(arpeggio(330, [[7, 0], [3, 0.2], [0, 0.42], [-5, 0.7, 1.1]], 2.2, 0.8), { wet: 0.35 }), 0.6),
  },
};

const wanted = process.argv[2] ? [process.argv[2]] : Object.keys(SOUNDS);
for (const game of wanted) {
  const recipes = SOUNDS[game];
  if (!recipes) throw new Error(`no sounds for "${game}"; use ${Object.keys(SOUNDS).join(', ')}`);
  for (const [name, make] of Object.entries(recipes)) wav(`games/${game}/assets/${name}.wav`, make());
}
