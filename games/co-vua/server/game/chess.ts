/**
 * The rules of chess on a 0x88 board, made for speed: moves are made and unmade in place, so the
 * computer's search can use the same code as the referee.
 *
 * Squares: `y * 16 + x` with y = 0 the 8th rank (Black's back rank, at the top) and x = 0 the a
 * file. Pieces: 1 pawn, 2 knight, 3 bishop, 4 rook, 5 queen, 6 king, plus 8 for Black.
 * A move is `from | to << 7 | promotion << 14 | flag << 17`.
 */

export const PAWN = 1;
export const KNIGHT = 2;
export const BISHOP = 3;
export const ROOK = 4;
export const QUEEN = 5;
export const KING = 6;
export const BLACK_BIT = 8;

/** Flags for moves that do more than move one piece. */
const EP = 1;
const CASTLE = 2;
const DOUBLE = 3;

const KNIGHT_STEPS = [-33, -31, -18, -14, 14, 18, 31, 33];
const KING_STEPS = [-17, -16, -15, -1, 1, 15, 16, 17];
const BISHOP_STEPS = [-17, -15, 15, 17];
const ROOK_STEPS = [-16, -1, 1, 16];

/** Castling rights as bits: White short and long, Black short and long. */
const WK = 1;
const WQ = 2;
const BK = 4;
const BQ = 8;

export const fromOf = (m: number) => m & 127;
export const toOf = (m: number) => (m >> 7) & 127;
export const promoOf = (m: number) => (m >> 14) & 7;
const flagOf = (m: number) => (m >> 17) & 7;
const encode = (from: number, to: number, promo = 0, flag = 0) =>
  from | (to << 7) | (promo << 14) | (flag << 17);

/** 0..63 (row by row from the top) to 0x88 and back. */
export const sq88 = (i: number) => (i >> 3) * 16 + (i & 7);
export const sq64 = (s: number) => (s >> 4) * 8 + (s & 15);

const LETTERS = ' pnbrqk';

/** A square's name, `a1`…`h8`, from its 0..63 index. */
export const squareName = (i: number) => `${'abcdefgh'[i & 7]}${8 - (i >> 3)}`;

/** Random 32-bit keys for hashing positions (fixed seed: the same everywhere). */
const ZOBRIST = (() => {
  let s = 0x2545f491;
  const next = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return s >>> 0;
  };
  const table = Array.from({ length: 16 * 128 * 2 }, next);
  return {
    table,
    side: [next(), next()],
    castle: Array.from({ length: 32 }, next),
    ep: Array.from({ length: 256 }, next),
  };
})();

interface Undo {
  move: number;
  captured: number;
  castling: number;
  ep: number;
  half: number;
  hash: number;
  hash2: number;
}

export class Position {
  readonly board = new Int8Array(128);
  /** 0 White, 1 Black. */
  side = 0;
  castling = 0;
  /** The square a pawn may be taken en passant on, or -1. */
  ep = -1;
  /** Half-moves since the last capture or pawn move. */
  half = 0;
  full = 1;
  readonly kings = [0, 0];
  hash = 0;
  hash2 = 0;
  private readonly undos: Undo[] = [];

  /** The position from a 64-character board (`.` empty, `PNBRQK` White, `pnbrqk` Black). */
  static from(
    board: string,
    side: 'w' | 'b',
    castling: string,
    ep: number,
    half: number,
    full: number,
  ) {
    const p = new Position();
    for (let i = 0; i < 64; i++) {
      const ch = board[i] ?? '.';
      const lower = ch.toLowerCase();
      const type = LETTERS.indexOf(lower);
      if (type <= 0) continue;
      const piece = type | (ch === lower ? BLACK_BIT : 0);
      const s = sq88(i);
      p.board[s] = piece;
      if (type === KING) p.kings[ch === lower ? 1 : 0] = s;
    }
    p.side = side === 'w' ? 0 : 1;
    p.castling =
      (castling.includes('K') ? WK : 0) |
      (castling.includes('Q') ? WQ : 0) |
      (castling.includes('k') ? BK : 0) |
      (castling.includes('q') ? BQ : 0);
    p.ep = ep >= 0 ? sq88(ep) : -1;
    p.half = half;
    p.full = full;
    p.rehash();
    return p;
  }

  /** The board as 64 characters. */
  boardString() {
    let out = '';
    for (let i = 0; i < 64; i++) {
      const piece = this.board[sq88(i)] as number;
      const ch = LETTERS[piece & 7] ?? ' ';
      out += piece === 0 ? '.' : piece & BLACK_BIT ? ch : ch.toUpperCase();
    }
    return out;
  }

  castlingString() {
    const c = this.castling;
    return `${c & WK ? 'K' : ''}${c & WQ ? 'Q' : ''}${c & BK ? 'k' : ''}${c & BQ ? 'q' : ''}`;
  }

  private rehash() {
    let h = 0;
    let h2 = 0;
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) continue;
      const piece = this.board[s] as number;
      if (!piece) continue;
      h ^= ZOBRIST.table[piece * 128 + s] as number;
      h2 ^= ZOBRIST.table[2048 + piece * 128 + s] as number;
    }
    h ^= (ZOBRIST.castle[this.castling] as number) ^ (ZOBRIST.side[this.side] as number);
    if (this.ep >= 0) h ^= ZOBRIST.ep[this.ep] as number;
    h2 ^= (ZOBRIST.castle[this.castling + 16] as number) ^ this.side;
    if (this.ep >= 0) h2 ^= ZOBRIST.ep[this.ep + 128] as number;
    this.hash = h >>> 0;
    this.hash2 = h2 >>> 0;
  }

  /** A key for repetitions: pieces, side to move, castling rights and en passant square. */
  key() {
    return this.hash * 2 ** 21 + (this.hash2 & 0x1fffff);
  }

  /** Whether square `s` is attacked by side `by`. */
  attacked(s: number, by: number): boolean {
    const b = this.board;
    const colour = by ? BLACK_BIT : 0;
    const pawnFrom = by ? [s - 15, s - 17] : [s + 15, s + 17];
    for (const p of pawnFrom) if (!(p & 0x88) && b[p] === (PAWN | colour)) return true;
    for (const d of KNIGHT_STEPS) {
      const p = s + d;
      if (!(p & 0x88) && b[p] === (KNIGHT | colour)) return true;
    }
    for (const d of KING_STEPS) {
      const p = s + d;
      if (!(p & 0x88) && b[p] === (KING | colour)) return true;
    }
    for (const d of BISHOP_STEPS) {
      for (let p = s + d; !(p & 0x88); p += d) {
        const q = b[p] as number;
        if (!q) continue;
        if (q === (BISHOP | colour) || q === (QUEEN | colour)) return true;
        break;
      }
    }
    for (const d of ROOK_STEPS) {
      for (let p = s + d; !(p & 0x88); p += d) {
        const q = b[p] as number;
        if (!q) continue;
        if (q === (ROOK | colour) || q === (QUEEN | colour)) return true;
        break;
      }
    }
    return false;
  }

  inCheck(side = this.side) {
    return this.attacked(this.kings[side] as number, side ^ 1);
  }

  /** Every move that follows the pieces' rules, ignoring whether it leaves the king in check;
   * `captures` only: captures and promotions. */
  pseudo(out: number[], captures = false) {
    const b = this.board;
    const us = this.side;
    const mine = us ? BLACK_BIT : 0;
    const forward = us ? 16 : -16;
    const startRow = us ? 1 : 6;
    const lastRow = us ? 7 : 0;
    for (let s = 0; s < 120; s++) {
      if (s & 0x88) {
        s += 7;
        continue;
      }
      const piece = b[s] as number;
      if (!piece || (piece & BLACK_BIT) !== mine) continue;
      const type = piece & 7;
      if (type === PAWN) {
        const one = s + forward;
        if (!(one & 0x88) && !b[one]) {
          if (one >> 4 === lastRow) {
            for (const promo of [QUEEN, KNIGHT, ROOK, BISHOP]) out.push(encode(s, one, promo));
          } else if (!captures) {
            out.push(encode(s, one));
            const two = one + forward;
            if (s >> 4 === startRow && !b[two]) out.push(encode(s, two, 0, DOUBLE));
          }
        }
        for (const side of [-1, 1]) {
          const t = one + side;
          if (t & 0x88) continue;
          const q = b[t] as number;
          if (q && (q & BLACK_BIT) !== mine) {
            if (t >> 4 === lastRow) {
              for (const promo of [QUEEN, KNIGHT, ROOK, BISHOP]) out.push(encode(s, t, promo));
            } else out.push(encode(s, t));
          } else if (t === this.ep) out.push(encode(s, t, 0, EP));
        }
        continue;
      }
      const steps =
        type === KNIGHT
          ? KNIGHT_STEPS
          : type === BISHOP
            ? BISHOP_STEPS
            : type === ROOK
              ? ROOK_STEPS
              : KING_STEPS;
      const slides = type === BISHOP || type === ROOK || type === QUEEN;
      for (const d of steps) {
        for (let t = s + d; !(t & 0x88); t += d) {
          const q = b[t] as number;
          if (q) {
            if ((q & BLACK_BIT) !== mine) out.push(encode(s, t));
            break;
          }
          if (!captures) out.push(encode(s, t));
          if (!slides) break;
        }
      }
      if (type === KING && !captures) this.castles(s, out);
    }
    return out;
  }

  private castles(s: number, out: number[]) {
    const b = this.board;
    const us = this.side;
    const short = us ? BK : WK;
    const long = us ? BQ : WQ;
    if (this.inCheck()) return;
    if (
      this.castling & short &&
      !b[s + 1] &&
      !b[s + 2] &&
      (b[s + 3] as number) === (ROOK | (us ? BLACK_BIT : 0))
    ) {
      if (!this.attacked(s + 1, us ^ 1) && !this.attacked(s + 2, us ^ 1))
        out.push(encode(s, s + 2, 0, CASTLE));
    }
    if (
      this.castling & long &&
      !b[s - 1] &&
      !b[s - 2] &&
      !b[s - 3] &&
      (b[s - 4] as number) === (ROOK | (us ? BLACK_BIT : 0))
    ) {
      if (!this.attacked(s - 1, us ^ 1) && !this.attacked(s - 2, us ^ 1))
        out.push(encode(s, s - 2, 0, CASTLE));
    }
  }

  /** The legal moves. */
  legal(captures = false): number[] {
    const moves = this.pseudo([], captures);
    const out: number[] = [];
    for (const m of moves) {
      if (this.make(m)) {
        out.push(m);
        this.unmake();
      }
    }
    return out;
  }

  private toggle(piece: number, s: number) {
    this.hash = (this.hash ^ (ZOBRIST.table[piece * 128 + s] as number)) >>> 0;
    this.hash2 = (this.hash2 ^ (ZOBRIST.table[2048 + piece * 128 + s] as number)) >>> 0;
  }

  private setMeta(castling: number, ep: number, side: number) {
    this.hash ^= (ZOBRIST.castle[this.castling] as number) ^ (ZOBRIST.side[this.side] as number);
    this.hash2 ^= (ZOBRIST.castle[this.castling + 16] as number) ^ this.side;
    if (this.ep >= 0) {
      this.hash ^= ZOBRIST.ep[this.ep] as number;
      this.hash2 ^= ZOBRIST.ep[this.ep + 128] as number;
    }
    this.castling = castling;
    this.ep = ep;
    this.side = side;
    this.hash ^= (ZOBRIST.castle[castling] as number) ^ (ZOBRIST.side[side] as number);
    this.hash2 ^= (ZOBRIST.castle[castling + 16] as number) ^ side;
    if (ep >= 0) {
      this.hash ^= ZOBRIST.ep[ep] as number;
      this.hash2 ^= ZOBRIST.ep[ep + 128] as number;
    }
    this.hash >>>= 0;
    this.hash2 >>>= 0;
  }

  /** Plays a move; returns false (and takes it back) if it leaves the mover's king in check. */
  make(m: number): boolean {
    const b = this.board;
    const from = fromOf(m);
    const to = toOf(m);
    const flag = flagOf(m);
    const piece = b[from] as number;
    const us = this.side;
    let captured = b[to] as number;
    this.undos.push({
      move: m,
      captured,
      castling: this.castling,
      ep: this.ep,
      half: this.half,
      hash: this.hash,
      hash2: this.hash2,
    });
    if (captured) this.toggle(captured, to);
    this.toggle(piece, from);
    b[from] = 0;
    let placed = piece;
    const promo = promoOf(m);
    if (promo) placed = promo | (piece & BLACK_BIT);
    b[to] = placed;
    this.toggle(placed, to);
    if (flag === EP) {
      const victim = to - (us ? 16 : -16);
      captured = b[victim] as number;
      this.toggle(captured, victim);
      b[victim] = 0;
      const last = this.undos[this.undos.length - 1] as Undo;
      last.captured = captured;
    } else if (flag === CASTLE) {
      const rookFrom = to > from ? from + 3 : from - 4;
      const rookTo = to > from ? from + 1 : from - 1;
      const rook = b[rookFrom] as number;
      this.toggle(rook, rookFrom);
      b[rookFrom] = 0;
      b[rookTo] = rook;
      this.toggle(rook, rookTo);
    }
    if ((piece & 7) === KING) this.kings[us] = to;
    let castling = this.castling;
    for (const s of [from, to]) {
      if (s === 0x74) castling &= ~(WK | WQ);
      else if (s === 0x04) castling &= ~(BK | BQ);
      else if (s === 0x77) castling &= ~WK;
      else if (s === 0x70) castling &= ~WQ;
      else if (s === 0x07) castling &= ~BK;
      else if (s === 0x00) castling &= ~BQ;
    }
    const ep = flag === DOUBLE ? (from + to) >> 1 : -1;
    this.setMeta(castling, ep, us ^ 1);
    this.half = (piece & 7) === PAWN || captured ? 0 : this.half + 1;
    if (us === 1) this.full++;
    if (this.attacked(this.kings[us] as number, us ^ 1)) {
      this.unmake();
      return false;
    }
    return true;
  }

  unmake() {
    const u = this.undos.pop();
    if (!u) return;
    const b = this.board;
    const from = fromOf(u.move);
    const to = toOf(u.move);
    const flag = flagOf(u.move);
    const us = this.side ^ 1;
    let piece = b[to] as number;
    if (promoOf(u.move)) piece = PAWN | (piece & BLACK_BIT);
    b[from] = piece;
    b[to] = 0;
    if (flag === EP) b[to - (us ? 16 : -16)] = u.captured;
    else b[to] = u.captured;
    if (flag === CASTLE) {
      const rookFrom = to > from ? from + 3 : from - 4;
      const rookTo = to > from ? from + 1 : from - 1;
      b[rookFrom] = b[rookTo] as number;
      b[rookTo] = 0;
    }
    if ((piece & 7) === KING) this.kings[us] = from;
    this.side = us;
    this.castling = u.castling;
    this.ep = u.ep;
    this.half = u.half;
    this.hash = u.hash;
    this.hash2 = u.hash2;
    if (us === 1) this.full--;
  }

  /** A null move for the search: the other side moves twice. */
  makeNull() {
    this.undos.push({
      move: 0,
      captured: 0,
      castling: this.castling,
      ep: this.ep,
      half: this.half,
      hash: this.hash,
      hash2: this.hash2,
    });
    this.setMeta(this.castling, -1, this.side ^ 1);
  }

  unmakeNull() {
    const u = this.undos.pop();
    if (!u) return;
    this.side ^= 1;
    this.ep = u.ep;
    this.hash = u.hash;
    this.hash2 = u.hash2;
  }

  /** Not enough pieces left for either side to mate. */
  insufficient() {
    const minors: number[] = [];
    for (let s = 0; s < 120; s++) {
      if (s & 0x88) continue;
      const t = (this.board[s] as number) & 7;
      if (!t || t === KING) continue;
      if (t === PAWN || t === ROOK || t === QUEEN) return false;
      minors.push(t === BISHOP ? (((s >> 4) + (s & 15)) % 2) + 10 : t);
    }
    if (minors.length <= 1) return true;
    return minors.every((m) => m >= 10) && new Set(minors).size === 1;
  }

  /** The move in standard notation (Nf3, exd5, O-O, e8=Q+). Call before making it. */
  san(m: number, legal = this.legal()): string {
    const from = fromOf(m);
    const to = toOf(m);
    const piece = this.board[from] as number;
    const type = piece & 7;
    const name = (s: number) => squareName(sq64(s));
    let out: string;
    if (flagOf(m) === CASTLE) out = to > from ? 'O-O' : 'O-O-O';
    else {
      const capture = !!this.board[to] || flagOf(m) === EP;
      if (type === PAWN) {
        out = capture ? `${name(from)[0]}x${name(to)}` : name(to);
        const promo = promoOf(m);
        if (promo) out += `=${(LETTERS[promo] as string).toUpperCase()}`;
      } else {
        const rivals = legal.filter(
          (o) => o !== m && toOf(o) === to && ((this.board[fromOf(o)] as number) & 7) === type,
        );
        let tag = '';
        if (rivals.length) {
          const sameFile = rivals.some((o) => (fromOf(o) & 15) === (from & 15));
          const sameRank = rivals.some((o) => fromOf(o) >> 4 === from >> 4);
          tag = !sameFile
            ? (name(from)[0] as string)
            : !sameRank
              ? (name(from)[1] as string)
              : name(from);
        }
        out = `${(LETTERS[type] as string).toUpperCase()}${tag}${capture ? 'x' : ''}${name(to)}`;
      }
    }
    if (this.make(m)) {
      const check = this.inCheck();
      const mate = check && this.legal().length === 0;
      this.unmake();
      if (mate) out += '#';
      else if (check) out += '+';
    }
    return out;
  }

  /** The piece on a 0..63 square as its letter, or `.`. */
  pieceAt(i: number) {
    return this.boardString()[i] ?? '.';
  }
}

/** The starting position. */
export const START = 'rnbqkbnrpppppppp................................PPPPPPPPRNBQKBNR';

/** A move given as 0..63 squares, if it is legal in `pos` (promotion to a queen by default). */
export function findMove(pos: Position, from: number, to: number, promo?: string): number | null {
  const want = promo ? LETTERS.indexOf(promo) : QUEEN;
  for (const m of pos.legal()) {
    if (sq64(fromOf(m)) !== from || sq64(toOf(m)) !== to) continue;
    if (promoOf(m) && promoOf(m) !== want) continue;
    return m;
  }
  return null;
}

/** A position from FEN. */
export function fen(text: string) {
  const [rows = '', side = 'w', castling = '-', ep = '-', half = '0', full = '1'] = text.split(' ');
  const board = rows
    .split('/')
    .map((row) => row.replace(/\d/g, (n) => '.'.repeat(Number(n))))
    .join('');
  const epIndex = ep === '-' ? -1 : (8 - Number(ep[1])) * 8 + 'abcdefgh'.indexOf(ep[0] as string);
  return Position.from(board, side as 'w' | 'b', castling, epIndex, Number(half), Number(full));
}
