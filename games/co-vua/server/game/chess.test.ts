import { describe, expect, it } from 'vitest';
import { fen, Position } from './chess.js';

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

describe('chess rules', () => {
  it('counts the moves from the start (perft)', () => {
    const pos = fen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    expect(perft(pos, 1)).toBe(20);
    expect(perft(pos, 2)).toBe(400);
    expect(perft(pos, 3)).toBe(8902);
    expect(perft(pos, 4)).toBe(197281);
  });

  it('counts castling, en passant and promotions right (Kiwipete, position 3, 4, 5)', () => {
    expect(
      perft(fen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1'), 3),
    ).toBe(97862);
    expect(perft(fen('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1'), 4)).toBe(43238);
    expect(perft(fen('r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1'), 3)).toBe(
      9467,
    );
    expect(perft(fen('rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8'), 3)).toBe(62379);
  });

  it('keeps the hash in step after making and unmaking moves', () => {
    const pos = fen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
    const key = pos.key();
    const board = pos.boardString();
    for (const m of pos.pseudo([])) {
      if (!pos.make(m)) continue;
      const fresh = Position.from(
        pos.boardString(),
        pos.side ? 'b' : 'w',
        pos.castlingString(),
        pos.ep >= 0 ? (pos.ep >> 4) * 8 + (pos.ep & 15) : -1,
        0,
        1,
      );
      expect(pos.key()).toBe(fresh.key());
      pos.unmake();
    }
    expect(pos.key()).toBe(key);
    expect(pos.boardString()).toBe(board);
  });

  it('writes moves in standard notation', () => {
    const pos = fen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
    const sans = pos.legal().map((m) => pos.san(m));
    expect(sans).toContain('O-O');
    expect(sans).toContain('O-O-O');
    expect(sans).toContain('Nxf7');
    expect(sans).toContain('dxe6');
    expect(sans).toContain('Qxf6');
    const mate = fen('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
    expect(mate.legal().map((m) => mate.san(m))).toContain('Ra8#');
  });
});
