import type { GameManifest } from '@xomdao/sdk';

/** "2 người" or "2–4 người". */
export function playersLabel({ minPlayers, maxPlayers }: GameManifest): string {
  return minPlayers === maxPlayers ? `${minPlayers} người` : `${minPlayers}–${maxPlayers} người`;
}

/** "5 phút" or "2–3 phút". */
export function durationLabel({ duration }: GameManifest): string {
  return duration.min === duration.max
    ? `${duration.min} phút`
    : `${duration.min}–${duration.max} phút`;
}

/** The CSS `object-position` that keeps the manifest's `focus` in view when art is cropped. */
export function focusPosition({ focus }: GameManifest): string {
  return `${focus.x}% ${focus.y}%`;
}
