import { describe, expect, it } from 'vitest';
import { parseInline } from './inline.js';

describe('parseInline', () => {
  it('keeps plain text whole', () => {
    expect(parseInline('Không có gì: ♠ < ♣ × 2')).toEqual([
      { kind: 'plain', text: 'Không có gì: ♠ < ♣ × 2', at: 0 },
    ]);
  });

  it('splits bold, italic and code runs', () => {
    expect(parseInline('Là **tứ quý**, *đôi* và `3♠`.')).toEqual([
      { kind: 'plain', text: 'Là ', at: 0 },
      { kind: 'strong', text: 'tứ quý', at: 3 },
      { kind: 'plain', text: ', ', at: 13 },
      { kind: 'em', text: 'đôi', at: 15 },
      { kind: 'plain', text: ' và ', at: 20 },
      { kind: 'code', text: '3♠', at: 24 },
      { kind: 'plain', text: '.', at: 28 },
    ]);
  });
});
