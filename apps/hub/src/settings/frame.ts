/** A screen shape the Hub can be framed to: what the dropdown offers. `ratio` is width / height. */
export interface FrameChoice {
  id: string;
  label: string;
  ratio: number | null;
}

/** `auto` fills the screen; the others keep that shape in the middle of it with dark space around. */
export const FRAMES = [
  { id: 'auto', label: 'Vừa màn hình', ratio: null },
  { id: '4:3', label: '4:3 (máy tính bảng)', ratio: 4 / 3 },
  { id: '16:9', label: '16:9 (tiêu chuẩn)', ratio: 16 / 9 },
  { id: '18:9', label: '18:9', ratio: 18 / 9 },
  { id: '20:9', label: '20:9 (điện thoại dài)', ratio: 20 / 9 },
] as const satisfies readonly FrameChoice[];

export type FrameId = (typeof FRAMES)[number]['id'];

export const isFrameId = (value: unknown): value is FrameId =>
  FRAMES.some((frame) => frame.id === value);

/** The ratio of a frame choice; `null` (fill the screen) for `auto` or anything unknown. */
export function frameRatio(id: string): number | null {
  return FRAMES.find((frame) => frame.id === id)?.ratio ?? null;
}

/** The framed area in px: its size and the dark space (`x` at each side, `y` above and below). */
export interface FrameBox {
  w: number;
  h: number;
  x: number;
  y: number;
}

/**
 * The biggest box of this ratio that fits the screen, centred. `null` when there is nothing to frame:
 * the choice fills the screen, the screen already has that shape, or it is held upright (the rotate
 * notice shows then).
 */
export function fitFrame(
  screen: { width: number; height: number },
  ratio: number | null,
): FrameBox | null {
  const { width, height } = screen;
  if (!ratio || height > width) return null;
  const wide = width / height > ratio;
  const w = wide ? Math.floor(height * ratio) : width;
  const h = wide ? height : Math.floor(width / ratio);
  if (w >= width && h >= height) return null;
  if (Math.abs(width / height - ratio) < 0.005) return null;
  return { w, h, x: Math.floor((width - w) / 2), y: Math.floor((height - h) / 2) };
}

const VARIABLES = [
  '--frame-w',
  '--frame-h',
  '--frame-x',
  '--frame-y',
  '--frame-vw',
  '--frame-vh',
  '--frame-vmin',
] as const;

/**
 * Puts the box on the page: `data-frame`, its size and dark space, and the size of one percent of it
 * (`--frame-vw`, `--frame-vh`, `--frame-vmin`), which `tokens.css` turns into `--vw`, `--dvh` and
 * `--vmin`. `null` takes them all off, so the page fills the screen again.
 */
export function applyFrame(root: HTMLElement, box: FrameBox | null) {
  for (const name of VARIABLES) root.style.removeProperty(name);
  if (!box) {
    delete root.dataset.frame;
    return;
  }
  root.dataset.frame = '';
  const set = (name: (typeof VARIABLES)[number], px: number) =>
    root.style.setProperty(name, `${px}px`);
  set('--frame-w', box.w);
  set('--frame-h', box.h);
  set('--frame-x', box.x);
  set('--frame-y', box.y);
  set('--frame-vw', box.w / 100);
  set('--frame-vh', box.h / 100);
  set('--frame-vmin', Math.min(box.w, box.h) / 100);
}
