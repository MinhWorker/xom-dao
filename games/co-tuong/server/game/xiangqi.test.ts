import { describe, expect, it } from 'vitest';
import { findMove, Position, START } from './xiangqi.js';

function perft(pos: Position, depth: number): number {
  if (depth === 0) return 1;
  let n = 0;
  for (const m of pos.pseudo([])) {
    if (!pos.make(m)) continue;
    n += perft(pos, depth - 1);
    pos.unmake();
  }
  return n;
}

const p = (r: number, c: number) => r * 9 + c;
const empty = () => '.'.repeat(90).split('');

describe('xiangqi rules', () => {
  it('counts the known move tree from the start', () => {
    const pos = Position.from(START, 'r');
    expect(perft(pos, 1)).toBe(44);
    expect(perft(pos, 2)).toBe(1920);
    expect(perft(pos, 3)).toBe(79666);
  });

  it('restores the position and its key after make and unmake', () => {
    const pos = Position.from(START, 'r');
    const key = pos.key();
    for (const m of pos.legal()) {
      pos.make(m);
      pos.unmake();
    }
    expect(pos.key()).toBe(key);
    expect(pos.boardString()).toBe(START);
  });

  it('forbids the generals from facing each other', () => {
    const b = empty();
    b[p(0, 4)] = 'k';
    b[p(9, 3)] = 'K';
    b[p(5, 0)] = 'R';
    const pos = Position.from(b.join(''), 'r');
    expect(findMove(pos, p(9, 3), p(9, 4))).toBeNull();
  });

  it('blocks a horse by its leg and an elephant by its eye, and keeps elephants home', () => {
    const b = empty();
    b[p(0, 4)] = 'k';
    b[p(9, 3)] = 'K';
    b[p(7, 1)] = 'N';
    b[p(6, 1)] = 'P';
    b[p(5, 2)] = 'B';
    const pos = Position.from(b.join(''), 'r');
    expect(findMove(pos, p(7, 1), p(5, 0))).toBeNull();
    expect(findMove(pos, p(7, 1), p(8, 3))).not.toBeNull();
    expect(findMove(pos, p(5, 2), p(3, 0))).toBeNull();
    expect(findMove(pos, p(5, 2), p(7, 4))).not.toBeNull();
  });

  it('lets a cannon take only over one screen', () => {
    const b = empty();
    b[p(0, 3)] = 'k';
    b[p(9, 4)] = 'K';
    b[p(7, 0)] = 'C';
    b[p(4, 0)] = 'p';
    b[p(2, 0)] = 'r';
    const pos = Position.from(b.join(''), 'r');
    expect(findMove(pos, p(7, 0), p(4, 0))).toBeNull();
    expect(findMove(pos, p(7, 0), p(2, 0))).not.toBeNull();
    expect(findMove(pos, p(7, 0), p(5, 0))).not.toBeNull();
  });

  it('moves pawns sideways only across the river', () => {
    const b = empty();
    b[p(0, 4)] = 'k';
    b[p(9, 3)] = 'K';
    b[p(6, 0)] = 'P';
    b[p(4, 6)] = 'P';
    const pos = Position.from(b.join(''), 'r');
    expect(findMove(pos, p(6, 0), p(6, 1))).toBeNull();
    expect(findMove(pos, p(4, 6), p(4, 7))).not.toBeNull();
    expect(findMove(pos, p(4, 6), p(5, 6))).toBeNull();
  });
});
