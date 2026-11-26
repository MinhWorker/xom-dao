/**
 * The rules of Cờ Tướng, made for speed: moves are made and unmade in place, so the computer's
 * search can use the same code as the referee.
 *
 * Points: `row * 9 + col`, row 0 at the top (Black's back row), row 9 Red's back row. Pieces:
 * 1 tướng, 2 sĩ, 3 tượng, 4 mã, 5 xe, 6 pháo, 7 tốt, plus 8 for Black. A move is `from | to << 7`.
 */

export const KING = 1;
export const ADVISOR = 2;
export const ELEPHANT = 3;
export const HORSE = 4;
export const ROOK = 5;
export const CANNON = 6;
export const PAWN = 7;
export const BLACK_BIT = 8;

/** Letters for the board string: upper case Red, lower case Black. */
export const LETTERS = ' kabnrcp';

export const fromOf = (m: number) => m & 127;
export const toOf = (m: number) => (m >> 7) & 127;
const encode = (from: number, to: number) => from | (to << 7);

const rowOf = (s: number) => Math.floor(s / 9);
const colOf = (s: number) => s % 9;
const at = (r: number, c: number) => (r >= 0 && r < 10 && c >= 0 && c < 9 ? r * 9 + c : -1);
const inPalace = (s: number) => {
  const r = rowOf(s);
  const c = colOf(s);
  return c >= 3 && c <= 5 && (r <= 2 || r >= 7);
};
/** Whether a Red (side 0) or Black (side 1) piece on `s` stands on its own half. */
const ownHalf = (s: number, side: number) => (side ? rowOf(s) <= 4 : rowOf(s) >= 5);

const ORTH = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

/** Precomputed moves for each point. */
const TABLES = (() => {
  const rays: number[][][] = [];
  const king: number[][] = [];
  const advisor: number[][] = [];
  const elephant: [number, number][][] = [];
  const horse: [number, number][][] = [];
  /** Where a horse attacking `s` stands, with its leg. */
  const horseFrom: [number, number][][] = [];
  for (let s = 0; s < 90; s++) {
    const r = rowOf(s);
    const c = colOf(s);
    rays.push(
      ORTH.map(([dr, dc]) => {
        const out: number[] = [];
        for (let k = 1; ; k++) {
          const t = at(r + (dr as number) * k, c + (dc as number) * k);
          if (t < 0) break;
          out.push(t);
        }
        return out;
      }),
    );
    king.push(
      ORTH.map(([dr, dc]) => at(r + (dr as number), c + (dc as number))).filter(
        (t) => t >= 0 && inPalace(t),
      ),
    );
    advisor.push(
      [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ]
        .map(([dr, dc]) => at(r + (dr as number), c + (dc as number)))
        .filter((t) => t >= 0 && inPalace(t)),
    );
    elephant.push(
      [
        [-2, -2],
        [-2, 2],
        [2, -2],
        [2, 2],
      ]
        .map(
          ([dr, dc]) =>
            [
              at(r + (dr as number), c + (dc as number)),
              at(r + (dr as number) / 2, c + (dc as number) / 2),
            ] as [number, number],
        )
        .filter(([t]) => t >= 0 && r <= 4 === rowOf(t) <= 4),
    );
    const hs: [number, number][] = [];
    const hf: [number, number][] = [];
    for (const [dr, dc] of [
      [-2, -1],
      [-2, 1],
      [2, -1],
      [2, 1],
      [-1, -2],
      [1, -2],
      [-1, 2],
      [1, 2],
    ] as [number, number][]) {
      const t = at(r + dr, c + dc);
      if (t < 0) continue;
      hs.push([
        t,
        at(r + (Math.abs(dr) === 2 ? dr / 2 : 0), c + (Math.abs(dc) === 2 ? dc / 2 : 0)),
      ]);
      // A horse on t reaches s through the leg next to t, toward s.
      hf.push([
        t,
        at(
          rowOf(t) - (Math.abs(dr) === 2 ? dr / 2 : 0),
          colOf(t) - (Math.abs(dc) === 2 ? dc / 2 : 0),
        ),
      ]);
    }
    horse.push(hs);
    horseFrom.push(hf);
  }
  return { rays, king, advisor, elephant, horse, horseFrom };
})();

/** Random 32-bit keys for hashing positions (fixed seed: the same everywhere). */
const ZOBRIST = (() => {
  let s = 0x6d2b79f5;
  const next = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return s >>> 0;
  };
  return { table: Array.from({ length: 16 * 90 * 2 }, next), side: [next(), next()] };
})();

interface Undo {
  move: number;
  captured: number;
  hash: number;
  hash2: number;
}

export class Position {
  readonly board = new Int8Array(90);
  /** 0 Red, 1 Black. */
  side = 0;
  readonly kings = [0, 0];
  hash = 0;
  hash2 = 0;
  private readonly undos: Undo[] = [];

  /** The position from a 90-character board (`.` empty, upper case Red, lower case Black). */
  static from(board: string, side: 'r' | 'b') {
    const p = new Position();
    for (let i = 0; i < 90; i++) {
      const ch = board[i] ?? '.';
      const lower = ch.toLowerCase();
      const type = LETTERS.indexOf(lower);
      if (type <= 0) continue;
      const black = ch === lower;
      p.board[i] = type | (black ? BLACK_BIT : 0);
      if (type === KING) p.kings[black ? 1 : 0] = i;
    }
    p.side = side === 'r' ? 0 : 1;
    p.rehash();
    return p;
  }

  boardString() {
    let out = '';
    for (let i = 0; i < 90; i++) {
      const piece = this.board[i] as number;
      const ch = LETTERS[piece & 7] ?? '.';
      out += piece === 0 ? '.' : piece & BLACK_BIT ? ch : ch.toUpperCase();
    }
    return out;
  }

  private rehash() {
    let h = 0;
    let h2 = 0;
    for (let s = 0; s < 90; s++) {
      const piece = this.board[s] as number;
      if (!piece) continue;
      h ^= ZOBRIST.table[piece * 90 + s] as number;
      h2 ^= ZOBRIST.table[1440 + piece * 90 + s] as number;
    }
    this.hash = (h ^ (ZOBRIST.side[this.side] as number)) >>> 0;
    this.hash2 = (h2 ^ this.side) >>> 0;
  }

  /** A key for repetitions: the pieces and the side to move. */
  key() {
    return this.hash * 2 ** 21 + (this.hash2 & 0x1fffff);
  }

  /** Whether the two generals face each other on a file with nothing between. */
  facing() {
    const red = this.kings[0] as number;
    const black = this.kings[1] as number;
    if (colOf(red) !== colOf(black)) return false;
    for (let s = black + 9; s < red; s += 9) if (this.board[s]) return false;
    return true;
  }

  /** Whether point `s` is attacked by side `by` (generals facing aside). */
  attacked(s: number, by: number): boolean {
    const b = this.board;
    const colour = by ? BLACK_BIT : 0;
    const rays = TABLES.rays[s] as number[][];
    for (const ray of rays) {
      let screen = false;
      for (const t of ray) {
        const q = b[t] as number;
        if (!q) continue;
        if (!screen) {
          if (q === (ROOK | colour)) return true;
          screen = true;
          continue;
        }
        if (q === (CANNON | colour)) return true;
        break;
      }
    }
    for (const [h, leg] of TABLES.horseFrom[s] as [number, number][]) {
      if (b[h] === (HORSE | colour) && !b[leg]) return true;
    }
    const r = rowOf(s);
    const c = colOf(s);
    const pawn = PAWN | colour;
    const ahead = at(r + (by ? -1 : 1), c);
    if (ahead >= 0 && b[ahead] === pawn) return true;
    for (const dc of [-1, 1]) {
      const t = at(r, c + dc);
      if (t >= 0 && b[t] === pawn && !ownHalf(t, by)) return true;
    }
    return false;
  }

  inCheck(side = this.side) {
    return this.attacked(this.kings[side] as number, side ^ 1) || this.facing();
  }

  /** Every move by the pieces' rules, ignoring whether it leaves the general in danger;
   * `captures` only: captures. */
  pseudo(out: number[], captures = false) {
    const b = this.board;
    const us = this.side;
    const mine = us ? BLACK_BIT : 0;
    const add = (s: number, t: number) => {
      const q = b[t] as number;
      if (q) {
        if ((q & BLACK_BIT) !== mine) out.push(encode(s, t));
      } else if (!captures) out.push(encode(s, t));
    };
    for (let s = 0; s < 90; s++) {
      const piece = b[s] as number;
      if (!piece || (piece & BLACK_BIT) !== mine) continue;
      switch (piece & 7) {
        case KING:
          for (const t of TABLES.king[s] as number[]) add(s, t);
          break;
        case ADVISOR:
          for (const t of TABLES.advisor[s] as number[]) add(s, t);
          break;
        case ELEPHANT:
          for (const [t, eye] of TABLES.elephant[s] as [number, number][]) if (!b[eye]) add(s, t);
          break;
        case HORSE:
          for (const [t, leg] of TABLES.horse[s] as [number, number][]) if (!b[leg]) add(s, t);
          break;
        case ROOK:
          for (const ray of TABLES.rays[s] as number[][]) {
            for (const t of ray) {
              add(s, t);
              if (b[t]) break;
            }
          }
          break;
        case CANNON:
          for (const ray of TABLES.rays[s] as number[][]) {
            let screen = false;
            for (const t of ray) {
              const q = b[t] as number;
              if (!screen) {
                if (q) screen = true;
                else if (!captures) out.push(encode(s, t));
              } else if (q) {
                if ((q & BLACK_BIT) !== mine) out.push(encode(s, t));
                break;
              }
            }
          }
          break;
        case PAWN: {
          const r = rowOf(s);
          const c = colOf(s);
          const ahead = at(r + (us ? 1 : -1), c);
          if (ahead >= 0) add(s, ahead);
          if (!ownHalf(s, us)) {
            for (const dc of [-1, 1]) {
              const t = at(r, c + dc);
              if (t >= 0) add(s, t);
            }
          }
          break;
        }
      }
    }
    return out;
  }

  /** The legal moves. */
  legal(captures = false): number[] {
    const out: number[] = [];
    for (const m of this.pseudo([], captures)) {
      if (this.make(m)) {
        out.push(m);
        this.unmake();
      }
    }
    return out;
  }

  private toggle(piece: number, s: number) {
    this.hash = (this.hash ^ (ZOBRIST.table[piece * 90 + s] as number)) >>> 0;
    this.hash2 = (this.hash2 ^ (ZOBRIST.table[1440 + piece * 90 + s] as number)) >>> 0;
  }

  /** Makes a move; returns false (and takes it back) if it leaves the mover's general in check. */
  make(m: number): boolean {
    const from = fromOf(m);
    const to = toOf(m);
    const piece = this.board[from] as number;
    const captured = this.board[to] as number;
    this.undos.push({ move: m, captured, hash: this.hash, hash2: this.hash2 });
    if (captured) this.toggle(captured, to);
    this.toggle(piece, from);
    this.toggle(piece, to);
    this.board[to] = piece;
    this.board[from] = 0;
    if ((piece & 7) === KING) this.kings[this.side] = to;
    const us = this.side;
    this.side ^= 1;
    this.hash = (this.hash ^ (ZOBRIST.side[0] as number) ^ (ZOBRIST.side[1] as number)) >>> 0;
    this.hash2 = (this.hash2 ^ 1) >>> 0;
    if (this.inCheck(us)) {
      this.unmake();
      return false;
    }
    return true;
  }

  unmake() {
    const u = this.undos.pop();
    if (!u) return;
    const from = fromOf(u.move);
    const to = toOf(u.move);
    const piece = this.board[to] as number;
    this.board[from] = piece;
    this.board[to] = u.captured;
    this.side ^= 1;
    if ((piece & 7) === KING) this.kings[this.side] = from;
    this.hash = u.hash;
    this.hash2 = u.hash2;
  }

  makeNull() {
    this.undos.push({ move: -1, captured: 0, hash: this.hash, hash2: this.hash2 });
    this.side ^= 1;
    this.hash = (this.hash ^ (ZOBRIST.side[0] as number) ^ (ZOBRIST.side[1] as number)) >>> 0;
    this.hash2 = (this.hash2 ^ 1) >>> 0;
  }

  unmakeNull() {
    const u = this.undos.pop();
    if (!u) return;
    this.side ^= 1;
    this.hash = u.hash;
    this.hash2 = u.hash2;
  }

  /** Whether neither side has a piece that can cross the river to attack. */
  insufficient() {
    for (let s = 0; s < 90; s++) {
      const t = (this.board[s] as number) & 7;
      if (t === HORSE || t === ROOK || t === CANNON || t === PAWN) return false;
    }
    return true;
  }
}

/** The starting position. */
export const START =
  'rnbakabnr' +
  '.........' +
  '.c.....c.' +
  'p.p.p.p.p' +
  '.........' +
  '.........' +
  'P.P.P.P.P' +
  '.C.....C.' +
  '.........' +
  'RNBAKABNR';

/** A move given as 0..89 points, if it is legal in `pos`. */
export function findMove(pos: Position, from: number, to: number): number | null {
  for (const m of pos.legal()) if (fromOf(m) === from && toOf(m) === to) return m;
  return null;
}
