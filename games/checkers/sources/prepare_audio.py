"""Copy the project's existing audio and synthesize the rest; no external audio or licenses.

Run from the repository root: python3 games/checkers/sources/prepare_audio.py
Short effects are converted to mono PCM 16-bit WAV 48 kHz, music remains 128 kbps MP3.
Then copy the effects the table plays into godot/sounds/ (without the `checkers-` prefix).
"""
from pathlib import Path
import shutil
import subprocess
import wave

import numpy as np

GAME = Path(__file__).resolve().parents[1]
GAMES = GAME.parent
APP_AUDIO = GAMES.parent / 'assets' / 'app' / 'audio'
RATE = 48000
SOUNDS = {
    'checkers-start': GAMES / 'xiangqi' / 'assets' / 'xiangqi-start.wav',
    'checkers-select': GAMES / 'xiangqi' / 'assets' / 'xiangqi-piece-select.wav',
    'checkers-move': GAMES / 'go' / 'assets' / 'go-place-1.wav',
    'checkers-capture': GAMES / 'go' / 'assets' / 'go-capture.wav',
    'checkers-promote': GAMES / 'xiangqi' / 'assets' / 'xiangqi-decisive-move.wav',
    'checkers-draw': GAMES / 'xiangqi' / 'assets' / 'xiangqi-draw.wav',
    'checkers-win': GAMES / 'xiangqi' / 'assets' / 'xiangqi-game-win.wav',
    'checkers-illegal': GAMES / 'xiangqi' / 'assets' / 'xiangqi-illegal.wav',
    'checkers-turn': GAMES / 'xiangqi' / 'assets' / 'xiangqi-turn.wav',
    'checkers-victory': APP_AUDIO / 'game-win.wav',
    'checkers-lose': APP_AUDIO / 'game-lose.wav',
}


def marimba(freq: float, seconds: float) -> np.ndarray:
    """One struck wooden bar: the fundamental and the bar's 4th and 10th partials, fading fast."""
    t = np.arange(int(RATE * seconds)) / RATE
    tone = (
        np.sin(2 * np.pi * freq * t) * np.exp(-t * 9)
        + 0.35 * np.sin(2 * np.pi * freq * 3.93 * t) * np.exp(-t * 28)
        + 0.12 * np.sin(2 * np.pi * freq * 9.9 * t) * np.exp(-t * 60)
    )
    attack = np.minimum(1.0, t / 0.002)
    return tone * attack


def combo() -> np.ndarray:
    """A multi-jump: three quick rising bars and a soft high shimmer."""
    out = np.zeros(int(RATE * 0.75))
    for i, freq in enumerate([784.0, 987.8, 1318.5]):
        start = int(RATE * 0.07 * i)
        note = marimba(freq, 0.75 - 0.07 * i) * (0.8 + 0.1 * i)
        out[start:start + note.size] += note
    t = np.arange(out.size) / RATE
    shimmer = np.sin(2 * np.pi * 2637.0 * t) * np.exp(-np.maximum(t - 0.14, 0) * 7) * (t > 0.14)
    out += 0.12 * shimmer * (1 + 0.5 * np.sin(2 * np.pi * 11 * t))
    return out


def write(name: str, samples: np.ndarray) -> None:
    peak = np.max(np.abs(samples))
    data = (samples / peak * 0.8 * 32767).astype('<i2')
    with wave.open(str(GAME / 'assets' / f'{name}.wav'), 'wb') as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(RATE)
        out.writeframes(data.tobytes())


for target, source in SOUNDS.items():
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(source),
                    '-ac', '1', '-ar', str(RATE), '-c:a', 'pcm_s16le', str(GAME / 'assets' / f'{target}.wav')], check=True)
write('checkers-combo', combo())
shutil.copyfile(GAMES / 'go' / 'assets' / 'music-go.mp3', GAME / 'assets' / 'music-checkers.mp3')
