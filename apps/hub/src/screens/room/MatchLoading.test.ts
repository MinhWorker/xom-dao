import { describe, expect, it } from 'vitest';
import { loadingSeats } from './MatchLoading.js';

const seats = [
  { id: 'minh', name: 'Minh', connected: true },
  null,
  { id: 'lan', name: 'Lan', connected: true },
  { id: 'bot', name: 'Máy 1', bot: true, connected: true },
  { id: 'an', name: 'An', connected: false },
];

describe('match loading seats', () => {
  it('shows my progress, the others once ready, bots as loaded and the gone as away', () => {
    expect(loadingSeats(seats, 'minh', 0.4, ['lan'], [])).toEqual([
      { id: 'minh', name: 'Minh', load: 0.4, away: false },
      { id: 'lan', name: 'Lan', load: 1, away: false },
      { id: 'bot', name: 'Máy 1', load: 1, away: false },
      { id: 'an', name: 'An', load: 0, away: true },
    ]);
  });

  it('keeps my load short of done until the server hears I am ready', () => {
    expect(loadingSeats(seats, 'minh', 1, [], ['lan'])).toMatchObject([
      { id: 'minh', load: 0.99 },
      { id: 'lan', load: 0, away: true },
      { id: 'bot' },
      { id: 'an' },
    ]);
  });
});
