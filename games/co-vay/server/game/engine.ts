/**
 * The computer's reading of a position: a fast board for random games played to the end
 * (playouts), and a Monte Carlo tree search with RAVE over them. Its work is counted in playout
 * moves, not time, so a move takes the same effort on any machine and tests stay repeatable.
 */
import type { Rng } from '@xomdao/sdk';
import { BLACK, type Cell, EMPTY, KOMI, type Stone, WHITE } from './model.js';

const BORDER = 3;
const PASS = 0;

/** A board with a border, strings kept as rings with pseudo-liberty sums (fast to play on). */
export class FastBoard {
  readonly w: number;
  readonly n: number;
  readonly colour: Int8Array;
  readonly head: Int32Array;
  readonly next: Int32Array;
  readonly libs: Int32Array;
  readonly libSum: Float64Array;
  readonly libSq: Float64Array;
  readonly size: Int32Array;
  readonly empty: Int32Array;
  readonly emptyAt: Int32Array;
  emptyCount = 0;
  ko = -1;
  toMove: Stone = BLACK;
  passes = 0;
  readonly nbr: Int32Array;

  constructor(readonly side: number) {
    this.w = side + 2;
    this.n = this.w * this.w;
    this.colour = new Int8Array(this.n);
    this.head = new Int32Array(this.n);
    this.next = new Int32Array(this.n);
    this.libs = new Int32Array(this.n);
    this.libSum = new Float64Array(this.n);
    this.libSq = new Float64Array(this.n);
    this.size = new Int32Array(this.n);
    this.empty = new Int32Array(this.n);
    this.emptyAt = new Int32Array(this.n).fill(-1);
    this.nbr = new Int32Array([-1, 1, -this.w, this.w]);
    for (let p = 0; p < this.n; p++) {
      const x = p % this.w;
      const y = Math.floor(p / this.w);
      if (x === 0 || y === 0 || x === this.w - 1 || y === this.w - 1) this.colour[p] = BORDER;
      else this.addEmpty(p);
    }
  }

  /** The padded position of a board index, and back. */
  pos(i: number) {
    return (Math.floor(i / this.side) + 1) * this.w + (i % this.side) + 1;
  }

  index(p: number) {
    return (Math.floor(p / this.w) - 1) * this.side + (p % this.w) - 1;
  }

  copyFrom(o: FastBoard) {
    this.colour.set(o.colour);
    this.head.set(o.head);
    this.next.set(o.next);
    this.libs.set(o.libs);
    this.libSum.set(o.libSum);
    this.libSq.set(o.libSq);
    this.size.set(o.size);
    this.empty.set(o.empty);
    this.emptyAt.set(o.emptyAt);
    this.emptyCount = o.emptyCount;
    this.ko = o.ko;
    this.toMove = o.toMove;
    this.passes = o.passes;
  }

  /** Sets up a position (no ko) with `toMove` to play. */
  load(board: readonly Cell[], toMove: Stone) {
    for (let i = 0; i < board.length; i++) {
      const c = board[i];
      if (c === BLACK || c === WHITE) {
        this.toMove = c;
        this.play(this.pos(i));
      }
    }
    this.toMove = toMove;
    this.ko = -1;
    this.passes = 0;
  }

  private addEmpty(p: number) {
    this.emptyAt[p] = this.emptyCount;
    this.empty[this.emptyCount++] = p;
  }

  private removeEmpty(p: number) {
    const at = this.emptyAt[p] as number;
    const last = this.empty[--this.emptyCount] as number;
    this.empty[at] = last;
    this.emptyAt[last] = at;
    this.emptyAt[p] = -1;
  }

  private addLib(h: number, lib: number) {
    this.libs[h] = (this.libs[h] as number) + 1;
    this.libSum[h] = (this.libSum[h] as number) + lib;
    this.libSq[h] = (this.libSq[h] as number) + lib * lib;
  }

  private subLib(h: number, lib: number) {
    this.libs[h] = (this.libs[h] as number) - 1;
    this.libSum[h] = (this.libSum[h] as number) - lib;
    this.libSq[h] = (this.libSq[h] as number) - lib * lib;
  }

  /** Whether string `h` has exactly one liberty (all its pseudo-liberties are one point). */
  atari(h: number) {
    const n = this.libs[h] as number;
    const s = this.libSum[h] as number;
    return n > 0 && n * (this.libSq[h] as number) === s * s;
  }

  /** The one liberty of a string in atari. */
  atariLib(h: number) {
    return (this.libSum[h] as number) / (this.libs[h] as number);
  }

  /** Whether the side to move may play `p` (no suicide, no simple ko). */
  legal(p: number) {
    if (this.colour[p] !== EMPTY || p === this.ko) return false;
    const me = this.toMove;
    for (let k = 0; k < 4; k++) {
      const q = p + (this.nbr[k] as number);
      const c = this.colour[q];
      if (c === EMPTY) return true;
      if (c === BORDER) continue;
      const h = this.head[q] as number;
      if (c === me) {
        if (!this.atari(h)) return true;
      } else if (this.atari(h)) return true;
    }
    return false;
  }

  /** `p` is an eye of `c`: walled by it, with few enemy stones on the diagonals. */
  eye(p: number, c: number) {
    for (let k = 0; k < 4; k++) {
      const q = this.colour[p + (this.nbr[k] as number)];
      if (q !== c && q !== BORDER) return false;
    }
    let enemy = 0;
    let edge = 0;
    const w = this.w;
    for (const d of [-w - 1, -w + 1, w - 1, w + 1]) {
      const q = this.colour[p + d];
      if (q === BORDER) edge = 1;
      else if (q !== EMPTY && q !== c) enemy++;
    }
    return enemy + edge < 2;
  }

  /** Plays `p` (or PASS) for the side to move; the caller has checked it is legal. */
  play(p: number) {
    const me = this.toMove;
    const them = (3 - me) as Stone;
    this.toMove = them;
    if (p === PASS) {
      this.passes++;
      this.ko = -1;
      return 0;
    }
    this.passes = 0;
    this.colour[p] = me;
    this.head[p] = p;
    this.next[p] = p;
    this.size[p] = 1;
    this.libs[p] = 0;
    this.libSum[p] = 0;
    this.libSq[p] = 0;
    this.removeEmpty(p);
    for (let k = 0; k < 4; k++) {
      const q = p + (this.nbr[k] as number);
      const c = this.colour[q];
      if (c === EMPTY) this.addLib(p, q);
      else if (c === me || c === them) this.subLib(this.head[q] as number, p);
    }
    for (let k = 0; k < 4; k++) {
      const q = p + (this.nbr[k] as number);
      if (this.colour[q] === me && this.head[q] !== this.head[p]) {
        this.merge(this.head[p] as number, this.head[q] as number);
      }
    }
    let captured = 0;
    let capturedAt = -1;
    for (let k = 0; k < 4; k++) {
      const q = p + (this.nbr[k] as number);
      if (this.colour[q] === them && this.libs[this.head[q] as number] === 0) {
        const n = this.size[this.head[q] as number] as number;
        captured += n;
        capturedAt = q;
        this.capture(this.head[q] as number);
      }
    }
    const h = this.head[p] as number;
    this.ko = captured === 1 && this.size[h] === 1 && this.atari(h) ? capturedAt : -1;
    return captured;
  }

  private merge(a: number, b: number) {
    let big = a;
    let small = b;
    if ((this.size[a] as number) < (this.size[b] as number)) {
      big = b;
      small = a;
    }
    let s = small;
    do {
      this.head[s] = big;
      s = this.next[s] as number;
    } while (s !== small);
    const t = this.next[big] as number;
    this.next[big] = this.next[small] as number;
    this.next[small] = t;
    this.size[big] = (this.size[big] as number) + (this.size[small] as number);
    this.libs[big] = (this.libs[big] as number) + (this.libs[small] as number);
    this.libSum[big] = (this.libSum[big] as number) + (this.libSum[small] as number);
    this.libSq[big] = (this.libSq[big] as number) + (this.libSq[small] as number);
  }

  private capture(h: number) {
    let s = h;
    const stones: number[] = [];
    do {
      stones.push(s);
      s = this.next[s] as number;
    } while (s !== h);
    for (const p of stones) {
      this.colour[p] = EMPTY;
      this.addEmpty(p);
    }
    for (const p of stones) {
      for (let k = 0; k < 4; k++) {
        const q = p + (this.nbr[k] as number);
        const c = this.colour[q];
        if (c === BLACK || c === WHITE) this.addLib(this.head[q] as number, p);
      }
    }
  }

  /** A move for a random game: take a stone in atari next to the last move, else any move that
   * fills no own eye. PASS when there is none. */
  randomMove(rng: Rng, last: number): number {
    const me = this.toMove;
    if (last > 0) {
      for (let k = 0; k < 4; k++) {
        const q = last + (this.nbr[k] as number);
        if (this.colour[q] === 3 - me && this.atari(this.head[q] as number)) {
          const lib = this.atariLib(this.head[q] as number);
          if (this.legal(lib)) return lib;
        }
      }
      for (let k = 0; k < 4; k++) {
        const q = last + (this.nbr[k] as number);
        if (this.colour[q] === me && this.atari(this.head[q] as number) && rng() < 0.6) {
          const lib = this.atariLib(this.head[q] as number);
          if (this.legal(lib) && this.emptyAround(lib) >= 2) return lib;
        }
      }
    }
    const count = this.emptyCount;
    if (!count) return PASS;
    const start = Math.floor(rng() * count);
    for (let i = 0; i < count; i++) {
      const p = this.empty[(start + i) % count] as number;
      if (this.legal(p) && !this.eye(p, me) && !this.selfAtari(p)) return p;
    }
    return PASS;
  }

  private emptyAround(p: number) {
    let n = 0;
    for (let k = 0; k < 4; k++) if (this.colour[p + (this.nbr[k] as number)] === EMPTY) n++;
    return n;
  }

  /** Playing `p` would leave a big string of the mover with one liberty (a cheap check). */
  private selfAtari(p: number) {
    const me = this.toMove;
    let libs = 0;
    let stones = 1;
    for (let k = 0; k < 4; k++) {
      const q = p + (this.nbr[k] as number);
      const c = this.colour[q];
      if (c === EMPTY) libs++;
      else if (c === me) {
        const h = this.head[q] as number;
        stones += this.size[h] as number;
        if (!this.atari(h)) libs += 2;
      } else if (c !== BORDER && this.atari(this.head[q] as number)) return false;
    }
    return libs <= 1 && stones >= 3;
  }

  /** Black's area minus White's, komi included, at the end of a random game. */
  score(owner?: Float64Array): number {
    let total = -KOMI;
    for (let y = 1; y <= this.side; y++) {
      for (let x = 1; x <= this.side; x++) {
        const p = y * this.w + x;
        let c = this.colour[p] as number;
        if (c === EMPTY) {
          let b = 0;
          let wh = 0;
          for (let k = 0; k < 4; k++) {
            const q = this.colour[p + (this.nbr[k] as number)];
            if (q === BLACK) b++;
            else if (q === WHITE) wh++;
          }
          c = b && !wh ? BLACK : wh && !b ? WHITE : EMPTY;
        }
        if (c === BLACK) total++;
        else if (c === WHITE) total--;
        if (owner && c !== EMPTY) {
          const i = (y - 1) * this.side + x - 1;
          owner[i] = (owner[i] as number) + (c === BLACK ? 1 : -1);
        }
      }
    }
    return total;
  }

  /** Plays random moves to the end; returns the number of moves played and fills `amaf` with
   * who played each point first (0 none). */
  playout(rng: Rng, last: number, amaf: Int8Array | null, owner?: Float64Array) {
    const limit = this.side * this.side * 3;
    let moves = 0;
    while (this.passes < 2 && moves < limit) {
      const me = this.toMove;
      const p = this.randomMove(rng, last);
      if (amaf && p !== PASS && amaf[p] === 0) amaf[p] = me;
      this.play(p);
      last = p;
      moves++;
    }
    return { moves, score: this.score(owner) };
  }
}

interface Node {
  moves: Int32Array;
  n: Float64Array;
  w: Float64Array;
  rn: Float64Array;
  rw: Float64Array;
  kids: (Node | null)[];
  visits: number;
}

function newNode(board: FastBoard, banned: ReadonlySet<number>): Node {
  const moves: number[] = [];
  const me = board.toMove;
  for (let i = 0; i < board.emptyCount; i++) {
    const p = board.empty[i] as number;
    if (!banned.has(p) && board.legal(p) && !board.eye(p, me)) moves.push(p);
  }
  moves.push(PASS);
  const k = moves.length;
  const node: Node = {
    moves: Int32Array.from(moves),
    n: new Float64Array(k),
    w: new Float64Array(k),
    rn: new Float64Array(k),
    rw: new Float64Array(k),
    kids: new Array(k).fill(null),
    visits: 0,
  };
  for (let i = 0; i < k; i++) {
    const p = node.moves[i] as number;
    const prior = p === PASS ? 0.1 : priorOf(board, p);
    node.n[i] = 6;
    node.w[i] = 6 * prior;
  }
  return node;
}

/** A guess at a move's worth before any playout: the first line is poor early on. */
function priorOf(board: FastBoard, p: number) {
  const x = (p % board.w) - 1;
  const y = Math.floor(p / board.w) - 1;
  const edge = Math.min(x, y, board.side - 1 - x, board.side - 1 - y);
  let near = false;
  for (let dy = -2; dy <= 2 && !near; dy++) {
    for (let dx = -2; dx <= 2 && !near; dx++) {
      const q = p + dy * board.w + dx;
      const c = board.colour[q];
      if (q >= 0 && q < board.n && (c === BLACK || c === WHITE)) near = true;
    }
  }
  if (edge === 0) return near ? 0.4 : 0.25;
  if (edge === 1 && board.side > 9) return near ? 0.5 : 0.4;
  return near ? 0.6 : 0.5;
}

const RAVE_K = 600;

function select(node: Node): number {
  let best = 0;
  let top = -Infinity;
  const logN = Math.log(node.visits + 1);
  for (let i = 0; i < node.moves.length; i++) {
    const n = node.n[i] as number;
    const rn = node.rn[i] as number;
    const q = (node.w[i] as number) / n;
    const rq = rn > 0 ? (node.rw[i] as number) / rn : q;
    const beta = rn / (rn + n + (rn * n) / RAVE_K + 1e-9);
    const value = (1 - beta) * q + beta * rq + 0.15 * Math.sqrt(logN / n);
    if (value > top) {
      top = value;
      best = i;
    }
  }
  return best;
}

/** What the search found at the root. */
export interface Thought {
  /** The board index to play, or -1 to pass. */
  move: number;
  /** The chance the side to move wins after it, as the playouts saw it. */
  winrate: number;
  /** Per point, from -1 (White's) to 1 (Black's), averaged over the playouts. */
  owner: Float64Array;
  /** Root moves by visits, best first (board indexes, -1 for a pass). */
  ranked: { move: number; visits: number; winrate: number }[];
}

/**
 * Searches `budget` playout moves from `board` (Black/White cells, `toMove` to play). `banned`
 * lists board indexes that would repeat an earlier position.
 */
export function think(
  cells: readonly Cell[],
  side: number,
  toMove: Stone,
  banned: readonly number[],
  budget: number,
  rng: Rng,
): Thought {
  const root = new FastBoard(side);
  root.load(cells, toMove);
  const bannedPos = new Set(banned.map((i) => root.pos(i)));
  const tree = newNode(root, bannedPos);
  const work = new FastBoard(side);
  const amaf = new Int8Array(root.n);
  const owner = new Float64Array(side * side);
  const path: { node: Node; i: number; mover: Stone }[] = [];
  let spent = 0;
  let playouts = 0;
  const none = new Set<number>();
  while (spent < budget || playouts < 8) {
    work.copyFrom(root);
    amaf.fill(0);
    path.length = 0;
    let node = tree;
    let last = -1;
    for (;;) {
      const i = select(node);
      const p = node.moves[i] as number;
      const mover = work.toMove;
      path.push({ node, i, mover });
      if (p !== PASS && !work.legal(p)) {
        node.n[i] = (node.n[i] as number) + 1;
        break;
      }
      if (p !== PASS && amaf[p] === 0) amaf[p] = mover;
      work.play(p);
      last = p;
      spent++;
      if (work.passes >= 2) break;
      const kid = node.kids[i];
      if (kid) {
        node = kid;
        continue;
      }
      if ((node.n[i] as number) > 8) node.kids[i] = newNode(work, none);
      break;
    }
    const result =
      work.passes >= 2
        ? { moves: 0, score: work.score(owner) }
        : work.playout(rng, last, amaf, owner);
    spent += result.moves;
    playouts++;
    const blackWins = result.score > 0;
    for (const { node: at, i, mover } of path) {
      const won = (mover === BLACK) === blackWins ? 1 : 0;
      at.visits++;
      at.n[i] = (at.n[i] as number) + 1;
      at.w[i] = (at.w[i] as number) + won;
      for (let j = 0; j < at.moves.length; j++) {
        const m = at.moves[j] as number;
        if (m !== PASS && amaf[m] === mover) {
          at.rn[j] = (at.rn[j] as number) + 1;
          at.rw[j] = (at.rw[j] as number) + won;
        }
      }
    }
  }
  for (let i = 0; i < owner.length; i++) owner[i] = (owner[i] as number) / playouts;
  const ranked = [...tree.moves].map((p, i) => ({
    move: p === PASS ? -1 : root.index(p),
    visits: (tree.n[i] as number) - 6,
    winrate: (tree.w[i] as number) / (tree.n[i] as number),
  }));
  ranked.sort((a, b) => b.visits - a.visits || b.winrate - a.winrate);
  const best = ranked[0] ?? { move: -1, winrate: 0.5 };
  return { move: best.move, winrate: best.winrate, owner, ranked };
}

/** Who owns each point, from `playouts` random games from the position (for the count). */
export function ownership(
  cells: readonly Cell[],
  side: number,
  toMove: Stone,
  playouts: number,
  rng: Rng,
) {
  const root = new FastBoard(side);
  root.load(cells, toMove);
  const work = new FastBoard(side);
  const owner = new Float64Array(side * side);
  for (let i = 0; i < playouts; i++) {
    work.copyFrom(root);
    work.playout(rng, -1, null, owner);
  }
  for (let i = 0; i < owner.length; i++) owner[i] = (owner[i] as number) / playouts;
  return owner;
}
