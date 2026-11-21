import type { GameManifest } from '@xomdao/sdk';
import { describe, expect, it } from 'vitest';
import { durationLabel, focusPosition, playersLabel } from './summary.js';

const manifest = (over: Partial<GameManifest>): GameManifest =>
  ({
    minPlayers: 2,
    maxPlayers: 4,
    duration: { min: 2, max: 3 },
    focus: { x: 64, y: 50 },
    ...over,
  }) as GameManifest;

describe('lobby summary', () => {
  it('writes a range only when the numbers differ', () => {
    expect(playersLabel(manifest({}))).toBe('2–4 người');
    expect(playersLabel(manifest({ maxPlayers: 2 }))).toBe('2 người');
    expect(durationLabel(manifest({}))).toBe('2–3 phút');
    expect(durationLabel(manifest({ duration: { min: 5, max: 5 } }))).toBe('5 phút');
  });

  it('keeps the focus point in view', () => {
    expect(focusPosition(manifest({}))).toBe('64% 50%');
  });
});
