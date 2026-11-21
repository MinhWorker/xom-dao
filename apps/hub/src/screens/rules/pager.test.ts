import { describe, expect, it } from 'vitest';
import { nearestPage, pageLabel } from './pager.js';

describe('nearestPage', () => {
  it('rounds the scroll position to a page and stays in range', () => {
    expect(nearestPage(0, 400, 5)).toBe(0);
    expect(nearestPage(190, 400, 5)).toBe(0);
    expect(nearestPage(210, 400, 5)).toBe(1);
    expect(nearestPage(1600, 400, 5)).toBe(4);
    expect(nearestPage(9000, 400, 5)).toBe(4);
    expect(nearestPage(-400, 400, 5)).toBe(1);
  });

  it('is page 0 before the scroller has a size', () => {
    expect(nearestPage(300, 0, 5)).toBe(0);
    expect(nearestPage(300, 400, 0)).toBe(0);
  });
});

describe('pageLabel', () => {
  it('counts from one', () => {
    expect(pageLabel(1, 6)).toBe('2 trên 6');
  });
});
