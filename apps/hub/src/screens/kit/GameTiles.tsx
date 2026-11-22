import { IconLock } from '@tabler/icons-react';
import type { CSSProperties, PointerEvent, ReactNode } from 'react';
import { Icon } from '../../kit/index.js';
import styles from './GameTiles.module.css';

const INK = '#0b0d10';
const PAPER = '#e8ecf1';
const PAPER_HI = '#f8fafc';
const PAPER_LO = '#c3ccd7';
const RED = '#ff4d3d';
const BLUE = '#2ec8e6';
const GOLD = '#ffc234';

/** Mouse position over the tile, -1 to 1 on each axis, for the layers' parallax. */
export function tilt(e: PointerEvent<HTMLElement>) {
  if (e.pointerType !== 'mouse') return;
  const el = e.currentTarget;
  if (el.closest('[data-reduce]') || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const r = el.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * 2 - 1;
  const y = ((e.clientY - r.top) / r.height) * 2 - 1;
  el.style.setProperty('--px', x.toFixed(3));
  el.style.setProperty('--py', y.toFixed(3));
}

export function untilt(e: PointerEvent<HTMLElement>) {
  e.currentTarget.style.removeProperty('--px');
  e.currentTarget.style.removeProperty('--py');
}

function Tile({
  kind,
  name,
  locked,
  index,
  children,
}: {
  kind: 'card' | 'piece';
  name: string;
  locked?: boolean;
  index: number;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`${styles.tile} ${styles[kind]}`}
      data-locked={locked || undefined}
      style={{ '--i': index } as CSSProperties}
      onPointerMove={tilt}
      onPointerLeave={untilt}
    >
      <span className={styles.stage}>{children}</span>
      <span className={styles.name}>
        {locked && <Icon icon={IconLock} size={18} />}
        {name}
      </span>
      {locked && <span className={styles.soon}>Sắp có</span>}
    </button>
  );
}

/** A card game's tile: a back glass pane, the grey art layer, a front glass pane, apart in depth. */
export function CardTile({
  name,
  art,
  tint,
  locked,
  index,
}: {
  name: string;
  art: ReactNode;
  tint?: string;
  locked?: boolean;
  index: number;
}) {
  return (
    <Tile kind="card" name={name} locked={locked} index={index}>
      <span className={styles.stack}>
        <span className={styles.back} />
        <span className={styles.middle} style={tint ? ({ '--tint': tint } as CSSProperties) : {}}>
          {art}
        </span>
        <span className={styles.front} />
      </span>
    </Tile>
  );
}

/** A board game's tile: two objects, a piece and its block, with a soft shadow and no frame. */
export function PieceTile({
  name,
  block,
  piece,
  locked,
  index,
}: {
  name: string;
  block: ReactNode;
  piece: ReactNode;
  locked?: boolean;
  index: number;
}) {
  return (
    <Tile kind="piece" name={name} locked={locked} index={index}>
      <span className={styles.shadow} />
      <svg className={styles.pieces} viewBox="0 0 160 190" aria-hidden="true">
        <g className={styles.blockLayer}>{block}</g>
        <g className={styles.pieceLayer}>{piece}</g>
      </svg>
    </Tile>
  );
}

const SPADE = '0,-10 8,0 5,5 1,3 3,9 -3,9 -1,3 -5,5 -8,0';
const HEART = '0,8 -8,0 -8,-4 -4,-7 0,-4 4,-7 8,-4 8,0';
const DIAMOND = '0,-9 6,0 0,9 -6,0';
const CLUB = '0,-9 4,-5 8,-2 4,1 2,2 3,9 -3,9 -2,2 -4,1 -8,-2 -4,-5';

function PlayingCard({
  angle,
  suit,
  colour,
  label,
}: {
  angle: number;
  suit: string;
  colour: string;
  label: string;
}) {
  return (
    <g transform={`rotate(${angle} 50 86)`}>
      <rect
        x="32"
        y="22"
        width="36"
        height="52"
        rx="3"
        fill={PAPER}
        stroke={INK}
        strokeWidth="2.5"
      />
      <polygon points="50,22 68,22 68,74 58,74" fill={PAPER_LO} opacity="0.5" />
      <text
        x="36"
        y="35"
        fill={colour}
        fontFamily="Barlow Condensed, sans-serif"
        fontWeight="700"
        fontSize="12"
      >
        {label}
      </text>
      <polygon
        points={suit}
        transform="translate(50 50) scale(1.15)"
        fill={colour}
        stroke={INK}
        strokeWidth="1"
      />
    </g>
  );
}

/** Tiến Lên: a fan of three cards, the 2 of hearts on top. */
export function FanArt() {
  return (
    <svg viewBox="10 12 80 80" aria-hidden="true">
      <PlayingCard angle={-22} suit={SPADE} colour={INK} label="A" />
      <PlayingCard angle={22} suit={DIAMOND} colour={GOLD} label="K" />
      <PlayingCard angle={0} suit={HEART} colour={RED} label="2" />
    </svg>
  );
}

/** Phỏm: two cards side by side over a face-down one. */
export function PairArt() {
  return (
    <svg viewBox="10 12 80 80" aria-hidden="true">
      <g transform="rotate(-8 50 60)">
        <rect
          x="26"
          y="18"
          width="48"
          height="66"
          rx="3"
          fill="#2c3e57"
          stroke={INK}
          strokeWidth="2.5"
        />
        <rect x="31" y="23" width="38" height="56" fill="none" stroke={BLUE} strokeWidth="1.5" />
        <polygon points="50,30 62,51 50,72 38,51" fill="none" stroke={BLUE} strokeWidth="1.5" />
      </g>
      <g transform="translate(-14 6)">
        <PlayingCard angle={-10} suit={CLUB} colour={INK} label="7" />
      </g>
      <g transform="translate(14 8)">
        <PlayingCard angle={12} suit={HEART} colour={RED} label="7" />
      </g>
    </svg>
  );
}

/** Xì dách, not out yet: one card back. */
export function BackArt() {
  return (
    <svg viewBox="10 12 80 80" aria-hidden="true">
      <rect
        x="28"
        y="16"
        width="44"
        height="68"
        rx="3"
        fill="#3a4048"
        stroke={INK}
        strokeWidth="2.5"
      />
      <rect x="33" y="21" width="34" height="58" fill="none" stroke={PAPER_LO} strokeWidth="1.5" />
      <polygon points="50,30 60,50 50,70 40,50" fill={PAPER_LO} />
      <polygon points="50,30 60,50 50,50" fill={PAPER_HI} />
    </svg>
  );
}

/** Top face of the iso block: (u, v) from 0 to 1 → a point. */
function iso(u: number, v: number, cx = 80, top = 100, w = 62, h = 31): [number, number] {
  return [cx + (u - v) * w, top + (u + v) * h];
}

function pts(...p: [number, number][]) {
  return p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}

/** An isometric block: top, left and right faces, with an optional pattern on top and a glow on its side. */
function Block({
  top,
  glow,
  depth = 24,
  faces = [PAPER, '#9aa5b2', '#6b7580'],
}: {
  top?: ReactNode;
  glow?: string;
  depth?: number;
  faces?: [string, string, string];
}) {
  const [a, b, c, d] = [iso(0, 0), iso(1, 0), iso(1, 1), iso(0, 1)];
  const down = (p: [number, number]): [number, number] => [p[0], p[1] + depth];
  return (
    <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
      <polygon points={pts(d, c, down(c), down(d))} fill={faces[1]} />
      <polygon points={pts(c, b, down(b), down(c))} fill={faces[2]} />
      <polygon points={pts(a, b, c, d)} fill={faces[0]} />
      {top}
      {glow && (
        <g stroke="none">
          <circle cx="111" cy="158" r="9" fill={glow} opacity="0.35" className={styles.glow} />
          <circle cx="111" cy="158" r="4.5" fill={glow} />
        </g>
      )}
    </g>
  );
}

function GridLines() {
  const lines = [0.25, 0.5, 0.75].flatMap((t): [[number, number], [number, number]][] => [
    [iso(t, 0), iso(t, 1)],
    [iso(0, t), iso(1, t)],
  ]);
  return (
    <g stroke="#6b7580" strokeWidth="1.5">
      {lines.map(([p, q]) => (
        <line key={`${p}${q}`} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} />
      ))}
    </g>
  );
}

function Checker() {
  const cells = [];
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++)
      if ((i + j) % 2)
        cells.push(
          <polygon
            key={`${i}${j}`}
            points={pts(
              iso(i / 4, j / 4),
              iso((i + 1) / 4, j / 4),
              iso((i + 1) / 4, (j + 1) / 4),
              iso(i / 4, (j + 1) / 4),
            )}
            fill="#6b7580"
            stroke="none"
          />,
        );
  return <g>{cells}</g>;
}

/** Caro: an X and an O standing on a lined board block. */
export function caroPieces() {
  return {
    block: <Block top={<GridLines />} glow={GOLD} />,
    piece: (
      <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
        <g transform="translate(56 110) scale(1.3)">
          <polygon points="-22,-40 -12,-46 22,4 12,10" fill={RED} />
          <polygon points="12,-46 22,-40 -12,10 -22,4" fill={RED} />
          <polygon points="-22,-40 -12,-46 0,-28 -5,-21" fill="#ff8a7d" stroke="none" />
        </g>
        <g transform="translate(112 100) scale(1.25)">
          <path
            fillRule="evenodd"
            d="M0-30 21-21 30 0 21 21 0 30-21 21-30 0-21-21ZM0-15 10.6-10.6 15 0 10.6 10.6 0 15-10.6 10.6-15 0-10.6-10.6Z"
            fill={BLUE}
          />
          <polygon
            points="0,-30 -21,-21 -30,0 -15,0 -10.6,-10.6 0,-15"
            fill="#8fe6f5"
            stroke="none"
          />
        </g>
      </g>
    ),
  };
}

/** Cờ: a knight on a checkered block. */
export function knightPieces() {
  return {
    block: <Block top={<Checker />} glow={BLUE} faces={[PAPER, '#8a95a3', '#5c6570']} />,
    piece: (
      <g
        transform="translate(46 22) scale(1.2)"
        stroke={INK}
        strokeWidth="3"
        strokeLinejoin="round"
      >
        <polygon
          points="0,96 60,96 56,80 48,76 50,52 60,40 56,20 40,4 26,6 22,16 8,28 2,44 10,50 24,42 28,50 14,70 6,78"
          fill={PAPER}
        />
        <polygon
          points="40,4 56,20 60,40 50,52 48,76 56,80 60,96 34,96 38,60 44,40 36,14"
          fill={PAPER_LO}
          stroke="none"
        />
        <polygon points="0,96 60,96 58,88 2,88" fill={GOLD} />
        <circle cx="30" cy="22" r="4" fill={GOLD} stroke="none" className={styles.glow} />
      </g>
    ),
  };
}

/** A game not out yet: a plain pawn on a plain box. */
export function pawnPieces() {
  return {
    block: <Block faces={['#9aa5b2', '#6b7580', '#4d555f']} />,
    piece: (
      <g
        transform="translate(80 52) scale(1.3)"
        stroke={INK}
        strokeWidth="3"
        strokeLinejoin="round"
      >
        <polygon points="-24,58 24,58 18,44 8,38 10,10 -10,10 -8,38 -18,44" fill={PAPER} />
        <polygon points="0,-16 13,-9 16,4 8,13 -8,13 -16,4 -13,-9" fill={PAPER} />
        <polygon points="0,-16 13,-9 16,4 8,13 2,13 4,0" fill={PAPER_LO} stroke="none" />
      </g>
    ),
  };
}
