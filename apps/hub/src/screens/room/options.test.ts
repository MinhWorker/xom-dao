import type { ChoiceOption } from '@xomdao/sdk';
import { describe, expect, it } from 'vitest';
import { choiceFromString, pickedChoice, withPick } from './options.js';

const rounds: ChoiceOption = {
  type: 'choice',
  label: 'Số vòng',
  default: 3,
  choices: [
    { value: 1, label: '1 vòng' },
    { value: 3, label: '3 vòng' },
    { value: 5, label: '5 vòng' },
  ],
};

describe('room options', () => {
  it('shows the pick, or the default when the pick is not a choice', () => {
    expect(pickedChoice(rounds, 5)).toBe(5);
    expect(pickedChoice(rounds, 7)).toBe(3);
    expect(pickedChoice(rounds, undefined)).toBe(3);
  });

  it('turns the string the kit hands back into the original value', () => {
    expect(choiceFromString(rounds, '5')).toBe(5);
    expect(choiceFromString(rounds, 'nope')).toBe(3);
  });

  it('replaces one pick and keeps the rest', () => {
    expect(withPick({ rounds: 3, fast: false }, 'rounds', 1)).toEqual({ rounds: 1, fast: false });
  });
});
