import { useSyncExternalStore } from 'react';
import clickUrl from '../../../../assets/app/audio/button-click.wav';
import closeUrl from '../../../../assets/app/audio/button-close.wav';
import enterUrl from '../../../../assets/app/audio/game-enter.wav';
import loseUrl from '../../../../assets/app/audio/game-lose.wav';
import winUrl from '../../../../assets/app/audio/game-win.wav';
import flipUrl from '../../../../assets/app/audio/island-flip.wav';
import lockedUrl from '../../../../assets/app/audio/island-locked.wav';
import { type AudioContextLike, createSounds, type SoundName } from './sounds.js';

export type { SoundName } from './sounds.js';

type WithSession = Navigator & { audioSession?: { type: string } };

/** The page's one set of Hub sounds. */
export const sounds = createSounds({
  createContext: () => new AudioContext() as unknown as AudioContextLike,
  fetchBytes: (url) => fetch(url).then((r) => r.arrayBuffer()),
  prepareSession() {
    const session = (navigator as WithSession).audioSession;
    if (session) session.type = 'playback';
  },
  storage: localStorage,
  urls: {
    click: clickUrl,
    close: closeUrl,
    flip: flipUrl,
    enter: enterUrl,
    locked: lockedUrl,
    win: winUrl,
    lose: loseUrl,
  },
});

export const playSound = (name: SoundName) => void sounds.play(name);

export function useMuted() {
  return useSyncExternalStore(sounds.subscribe, () => sounds.getState().muted);
}

export function useVolume() {
  return useSyncExternalStore(sounds.subscribe, () => sounds.getState().volume);
}

export function useMusic() {
  return useSyncExternalStore(sounds.subscribe, () => sounds.getState().music);
}

export function useEffects() {
  return useSyncExternalStore(sounds.subscribe, () => sounds.getState().effects);
}

/** Every sound choice at once; the object changes whenever one of them does. */
export function useSoundState() {
  return useSyncExternalStore(sounds.subscribe, sounds.getState);
}
