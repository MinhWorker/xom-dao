"""Synthesizes the Hub's interface sounds into the folder given: short, soft and of one family
(48 kHz mono 16-bit). Run: python3 assets/app/audio/sources/hub-ui.py assets/app/audio"""
import sys
import wave

import numpy as np

RATE = 48000
OUT = sys.argv[1]


def t(sec):
    return np.arange(int(RATE * sec)) / RATE


def env(n, attack, decay):
    """A fast attack, then an exponential fall with time constant `decay` (s)."""
    x = np.arange(n) / RATE
    a = np.clip(x / max(attack, 1e-4), 0, 1)
    return a * np.exp(-x / decay)


def tone(freq, sec, attack=0.002, decay=0.05, glide=None, partials=((1, 1.0),)):
    x = t(sec)
    f = np.full_like(x, freq) if glide is None else np.geomspace(freq, glide, len(x))
    phase = 2 * np.pi * np.cumsum(f) / RATE
    wave_ = sum(amp * np.sin(phase * k) for k, amp in partials)
    return fade_tail(wave_ * env(len(x), attack, decay), min(sec / 3, 0.04))


def noise(sec, decay, lowpass=0.3):
    rng = np.random.default_rng(7)
    n = rng.standard_normal(len(t(sec)))
    out = np.zeros_like(n)
    for i in range(1, len(n)):
        out[i] = out[i - 1] + lowpass * (n[i] - out[i - 1])
    return fade_tail(out * env(len(n), 0.0005, decay), min(sec / 3, 0.04))


def mix(sec, *parts):
    out = np.zeros(len(t(sec)))
    for at, sig in parts:
        i = int(at * RATE)
        seg = sig[: max(0, len(out) - i)]
        out[i : i + len(seg)] += seg
    return out


def fade_tail(x, sec=0.01):
    n = min(len(x), int(RATE * sec))
    x[-n:] *= np.linspace(1, 0, n)
    return x


def save(name, x, peak_db):
    x = fade_tail(x.astype(np.float64))
    x = x / (np.max(np.abs(x)) or 1) * 10 ** (peak_db / 20)
    data = (np.clip(x, -1, 1) * 32767).astype('<i2')
    with wave.open(f'{OUT}/{name}.wav', 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(data.tobytes())


# A button: a soft, woody "tock" with a hint of a key's click.
click = mix(
    0.07,
    (0, tone(1500, 0.07, 0.001, 0.018, glide=900, partials=((1, 1), (2, 0.15)))),
    (0, noise(0.02, 0.003, 0.5) * 0.18),
)
save('button-click', click, -9)

# A mouse over a button: barely there, a tiny high tick.
hover = tone(3400, 0.03, 0.001, 0.006, partials=((1, 1), (2, 0.2)))
save('button-hover', hover, -24)

# A mouse over an island's card: a glassy "tink".
card = tone(1760, 0.16, 0.001, 0.045, partials=((1, 1), (2.76, 0.25), (5.4, 0.08)))
save('island-hover', card, -19)

# Picking an island: two notes up, a fifth apart, with a breath of air under them.
pick = mix(
    0.42,
    (0, tone(659, 0.3, 0.004, 0.09, partials=((1, 1), (2, 0.25), (3, 0.06)))),
    (0.07, tone(988, 0.35, 0.004, 0.12, partials=((1, 1), (2, 0.25), (3, 0.06)))),
    (0, noise(0.2, 0.06, 0.08) * 0.25),
)
save('island-click', pick, -7)

# A locked island: two muted low knocks, "no".
knock = lambda: tone(220, 0.08, 0.001, 0.022, glide=150, partials=((1, 1), (2, 0.3)))
locked = mix(0.2, (0, knock()), (0.09, knock() * 0.8))
save('island-locked', locked, -11)

# Winning: a bright, quick arpeggio up to the octave, ringing out.
bell = lambda f, d: tone(f, d, 0.003, d / 3.2, partials=((1, 1), (2, 0.3), (3, 0.08), (4.2, 0.04)))
win = mix(
    1.25,
    (0.0, bell(523.25, 0.9)),
    (0.08, bell(659.25, 0.9)),
    (0.16, bell(783.99, 0.9)),
    (0.26, bell(1046.5, 1.0)),
    (0.26, bell(1318.5, 1.0) * 0.35),
)
save('game-win', win, -5)

# Losing: two soft notes stepping down, rounded and short.
soft = lambda f, d: tone(f, d, 0.01, d / 3, partials=((1, 1), (2, 0.12)))
lose = mix(0.75, (0.0, soft(392.0, 0.4)), (0.16, soft(311.13, 0.55)))
save('game-lose', lose, -12)
