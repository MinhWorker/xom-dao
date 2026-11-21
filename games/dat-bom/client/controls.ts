/** The player's controls: keys, the on-screen direction pad and the Bom button. */
import type { Dir } from '../server/game/model.js';

const KEYS: Record<string, Dir> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
};
const BOMB_KEYS = new Set(['Space', 'Enter', 'KeyE']);

/** Fraction of the pad's half size inside which a touch holds no direction. */
const DEAD_ZONE = 0.22;

/**
 * The direction of a touch `dx`, `dy` away from the pad's centre, in units of the pad's half
 * size: the stronger axis wins, and near the centre there is none.
 */
export function directionOf(dx: number, dy: number): Dir {
  if (Math.hypot(dx, dy) < DEAD_ZONE) return 'none';
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

/** Directions held at once; the one pressed last wins, and letting go falls back to the one before. */
export class HeldDirections {
  private stack: Dir[] = [];

  get current(): Dir {
    return this.stack[this.stack.length - 1] ?? 'none';
  }

  press(dir: Dir) {
    if (dir === 'none') return;
    this.stack = [...this.stack.filter((d) => d !== dir), dir];
  }

  release(dir: Dir) {
    this.stack = this.stack.filter((d) => d !== dir);
  }

  clear() {
    this.stack = [];
  }
}

export interface Controls {
  /** What the player asks for; called when the held direction changes or a bomb is wanted. */
  onChange(move: Dir, bomb: boolean): void;
}

/** Wires keys and the touch controls to `controls`; returns the held directions and a way to let go of all. */
export function attachControls(
  controls: Controls,
  pad: HTMLElement,
  bombButton: HTMLElement,
): { release(): void; held: () => Dir } {
  const keys = new HeldDirections();
  let touch: Dir = 'none';
  const held = (): Dir => (touch !== 'none' ? touch : keys.current);
  let sent: Dir = 'none';
  const update = (bomb = false) => {
    const now = held();
    if (now === sent && !bomb) return;
    sent = now;
    controls.onChange(now, bomb);
  };

  addEventListener('keydown', (event) => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    const dir = KEYS[event.code];
    if (dir) {
      event.preventDefault();
      keys.press(dir);
      update();
    } else if (BOMB_KEYS.has(event.code)) {
      event.preventDefault();
      update(true);
    }
  });
  addEventListener('keyup', (event) => {
    const dir = KEYS[event.code];
    if (!dir) return;
    keys.release(dir);
    update();
  });

  const buttons = [...pad.querySelectorAll<HTMLElement>('[data-dir]')];
  const lit = (dir: Dir) => {
    for (const button of buttons) button.classList.toggle('held', button.dataset.dir === dir);
  };
  const pointers = new Set<number>();
  const aim = (event: PointerEvent) => {
    const box = pad.getBoundingClientRect();
    touch = directionOf(
      (event.clientX - (box.left + box.width / 2)) / (box.width / 2),
      (event.clientY - (box.top + box.height / 2)) / (box.height / 2),
    );
    lit(touch);
    update();
  };
  pad.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    pad.setPointerCapture(event.pointerId);
    pointers.add(event.pointerId);
    aim(event);
  });
  pad.addEventListener('pointermove', (event) => {
    if (pointers.has(event.pointerId)) aim(event);
  });
  const lift = (event: PointerEvent) => {
    if (!pointers.delete(event.pointerId)) return;
    touch = 'none';
    lit('none');
    update();
  };
  pad.addEventListener('pointerup', lift);
  pad.addEventListener('pointercancel', lift);

  bombButton.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    bombButton.classList.add('held');
    update(true);
  });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
    bombButton.addEventListener(type, () => bombButton.classList.remove('held'));
  }

  return {
    held,
    release() {
      keys.clear();
      touch = 'none';
      pointers.clear();
      lit('none');
      update();
    },
  };
}
