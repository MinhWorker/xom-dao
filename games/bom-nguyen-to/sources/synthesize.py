"""Original toy-like sound effects, generated offline with Python's standard library.

Run ``python games/bom-nguyen-to/sources/synthesize.py`` from the repository
root. No samples or third-party audio are used. Every cue has its own seeded
noise, gentle attacks, and a silent tail for click-free, deterministic playback.
"""

import math
import random
import struct
import wave
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "assets"
RATE = 44100
TAU = 2 * math.pi


def envelope(t, length, attack=0.004, decay=3.0):
    if t < 0 or t >= length:
        return 0.0
    onset = min(1.0, t / attack)
    release = min(1.0, (length - t) / 0.025)
    return onset * release * math.exp(-decay * t / length)


def tone(buffer, at, length, start, end=None, gain=1.0, decay=3.0,
         attack=0.004, overtone=0.0, wobble=0.0):
    """Integrate a smooth pitch glide rather than resetting phase every sample."""
    end = start if end is None else end
    phase = 0.0
    offset = round(at * RATE)
    for i in range(round(length * RATE)):
        if offset + i >= len(buffer):
            break
        t = i / RATE
        progress = t / length
        pitch = end + (start - end) * (1 - progress) ** 2
        pitch *= 1 + wobble * math.sin(TAU * 15 * t)
        phase += TAU * pitch / RATE
        value = math.sin(phase) + overtone * math.sin(2 * phase)
        buffer[offset + i] += value * gain * envelope(t, length, attack, decay)


def mallet(buffer, at, pitch, gain=1.0, length=0.4):
    """A round wooden/bell note: fast body, lightly inharmonic bright transient."""
    tone(buffer, at, length, pitch, gain=gain * 0.78, decay=5.5)
    tone(buffer, at, length * 0.58, pitch * 2.76, gain=gain * 0.15, decay=7)
    tone(buffer, at, length * 0.35, pitch * 4.15, gain=gain * 0.055, decay=8)


def puff(buffer, at, length, gain=1.0, cutoff=850, seed=1, swell=False):
    """Low-pass noise with no brittle white-noise top end."""
    rng = random.Random(seed)
    pole = math.exp(-TAU * cutoff / RATE)
    filtered = 0.0
    offset = round(at * RATE)
    for i in range(round(length * RATE)):
        if offset + i >= len(buffer):
            break
        t = i / RATE
        filtered = pole * filtered + (1 - pole) * rng.uniform(-1, 1)
        shape = envelope(t, length, 0.014, 2.4)
        if swell:
            shape *= math.sin(math.pi * t / length) ** 0.65
        buffer[offset + i] += filtered * gain * shape


def cue(name, duration, compose, peak=0.48):
    buffer = [0.0] * round(duration * RATE)
    compose(buffer)
    # Remove negligible DC, normalize well below clipping, and add a final fade.
    average = sum(buffer) / len(buffer)
    buffer = [value - average for value in buffer]
    maximum = max(abs(value) for value in buffer)
    fade = round(0.01 * RATE)
    for i in range(fade):
        buffer[i] *= i / fade
        buffer[-1 - i] *= i / fade
    scale = peak / maximum if maximum else 0
    frames = b"".join(struct.pack("<h", round(value * scale * 32767))
                      for value in buffer)
    with wave.open(str(OUT / f"{name}.wav"), "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(RATE)
        audio.writeframes(frames)


def place(buffer):
    tone(buffer, 0, 0.15, 480, 145, gain=0.8, decay=4.5, overtone=0.14)
    tone(buffer, 0.025, 0.12, 170, 95, gain=0.35, decay=5)
    mallet(buffer, 0.01, 1150, gain=0.07, length=0.09)


def explode(buffer):
    # A round cartoon boom: a falling low thump under a burst of soft noise, then crackles.
    tone(buffer, 0, 0.5, 150, 38, gain=0.95, decay=3.2, attack=0.002, overtone=0.22)
    puff(buffer, 0, 0.55, gain=1.25, cutoff=900, seed=104)
    puff(buffer, 0.0, 0.09, gain=0.55, cutoff=3200, seed=105)
    rng = random.Random(106)
    for i in range(7):
        at = 0.08 + rng.uniform(0, 0.32)
        puff(buffer, at, 0.035, gain=0.22 * (1 - at), cutoff=2600, seed=107 + i)


def count(buffer):
    mallet(buffer, 0, 659.25, gain=0.7, length=0.32)
    tone(buffer, 0, 0.18, 1318.5, gain=0.06, decay=6)


def go(buffer):
    for i, pitch in enumerate((523.25, 659.25, 783.99, 1046.5)):
        mallet(buffer, i * 0.045, pitch, gain=0.5, length=0.5)
    tone(buffer, 0.12, 0.42, 880, 1320, gain=0.12, decay=2.2, wobble=0.012)
    puff(buffer, 0.1, 0.35, gain=0.35, cutoff=2400, seed=300, swell=True)


def rumble(buffer):
    # The ground starts to shake: slow low rolls and pebbles.
    puff(buffer, 0, 1.1, gain=1.2, cutoff=180, seed=310, swell=True)
    tone(buffer, 0, 1.1, 52, 44, gain=0.4, decay=0.8, attack=0.25, wobble=0.08)
    rng = random.Random(311)
    for i in range(9):
        puff(buffer, rng.uniform(0.15, 0.95), 0.05, gain=0.18, cutoff=2200, seed=312 + i)


def thud(buffer):
    # A laterite rock landing on the paving.
    tone(buffer, 0, 0.3, 110, 46, gain=1.0, decay=4.5, attack=0.002, overtone=0.3)
    puff(buffer, 0, 0.28, gain=0.9, cutoff=700, seed=330)
    puff(buffer, 0.02, 0.06, gain=0.4, cutoff=3000, seed=331)


def crate(buffer):
    # Planks cracking apart: short bright knocks over a dry rustle.
    rng = random.Random(340)
    for i in range(5):
        at = i * 0.028 + rng.uniform(0, 0.01)
        tone(buffer, at, 0.07, rng.uniform(380, 620), rng.uniform(180, 260), gain=0.4,
             decay=6, attack=0.001, overtone=0.4)
    puff(buffer, 0, 0.25, gain=0.55, cutoff=2600, seed=341)


def ko(buffer):
    # Someone is out: a descending sting with a soft gong.
    for at, pitch in ((0, 987.77), (0.09, 783.99), (0.18, 587.33)):
        mallet(buffer, at, pitch, gain=0.55, length=0.36)
    tone(buffer, 0.18, 0.7, 196, 190, gain=0.32, decay=2.6, overtone=0.35, wobble=0.004)


def tick(buffer):
    mallet(buffer, 0, 1760, gain=0.45, length=0.07)
    tone(buffer, 0, 0.05, 880, gain=0.2, decay=8)


def skill(buffer):
    for i, pitch in enumerate((523.25, 659.25, 783.99, 1046.5)):
        mallet(buffer, i * 0.064, pitch, gain=0.52, length=0.35)
    tone(buffer, 0, 0.24, 450, 1100, gain=0.09, decay=2.5)
    mallet(buffer, 0.24, 1567.98, gain=0.13, length=0.27)


def start(buffer):
    for at, pitch, gain in ((0, 523.25, 0.55), (0.11, 659.25, 0.55),
                            (0.22, 783.99, 0.55), (0.36, 1046.5, 0.65)):
        mallet(buffer, at, pitch, gain=gain, length=0.4)
    mallet(buffer, 0.36, 523.25, gain=0.18, length=0.4)


def pickup(buffer):
    mallet(buffer, 0, 783.99, gain=0.55, length=0.21)
    mallet(buffer, 0.085, 1174.66, gain=0.62, length=0.27)
    tone(buffer, 0.085, 0.2, 1567.98, gain=0.1, decay=6)


def hurt(buffer):
    tone(buffer, 0, 0.2, 390, 135, gain=0.6, decay=3.7,
         overtone=0.18, wobble=0.05)
    tone(buffer, 0.085, 0.17, 205, 120, gain=0.18, decay=4.2)


def dash(buffer):
    puff(buffer, 0, 0.27, gain=1.0, cutoff=1450, seed=210, swell=True)
    tone(buffer, 0.015, 0.22, 240, 650, gain=0.075, decay=2.4)


def win(buffer):
    notes = ((0, 523.25), (0.105, 659.25), (0.21, 783.99),
             (0.39, 1046.5), (0.57, 783.99), (0.7, 1046.5))
    for at, pitch in notes:
        mallet(buffer, at, pitch, gain=0.52, length=0.45)
    for pitch in (523.25, 659.25, 783.99):
        mallet(buffer, 0.7, pitch, gain=0.2, length=0.58)
    mallet(buffer, 0.87, 1567.98, gain=0.13, length=0.41)


def lose(buffer):
    for at, pitch in ((0, 659.25), (0.15, 523.25), (0.32, 392)):
        mallet(buffer, at, pitch, gain=0.55, length=0.42)
    tone(buffer, 0.32, 0.31, 230, 140, gain=0.08, decay=5)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, duration, compose, peak in (
        ("place", 0.21, place, 0.42),
        ("explode", 0.62, explode, 0.55),
        ("count", 0.36, count, 0.42),
        ("go", 0.62, go, 0.46),
        ("rumble", 1.15, rumble, 0.5),
        ("thud", 0.34, thud, 0.52),
        ("crate", 0.3, crate, 0.4),
        ("ko", 0.9, ko, 0.45),
        ("tick", 0.1, tick, 0.32),
        ("skill", 0.58, skill, 0.45),
        ("start", 0.83, start, 0.46),
        ("pickup", 0.42, pickup, 0.43),
        ("hurt", 0.32, hurt, 0.38),
        ("dash", 0.33, dash, 0.4),
        ("win", 1.4, win, 0.46),
        ("lose", 0.82, lose, 0.4),
    ):
        cue(name, duration, compose, peak)
