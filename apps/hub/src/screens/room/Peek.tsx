import { IconEye } from '@tabler/icons-react';
import { type PointerEvent, useEffect, useState } from 'react';
import { Icon } from '../../kit/index.js';
import styles from './Peek.module.css';

export interface PeekProps {
  /** Called with `true` while the player looks past the HUD, `false` when they stop. */
  onPeek(peeking: boolean): void;
}

/**
 * The eye button over the results: a mouse hovering it, a finger holding it or a held Space or
 * Enter key hides the HUD so the Game's last state shows; letting go brings the HUD back.
 */
export function Peek({ onPeek }: PeekProps) {
  const [peeking, setPeeking] = useState(false);
  const set = (next: boolean) => {
    setPeeking(next);
    onPeek(next);
  };
  const isMouse = (e: PointerEvent) => e.pointerType === 'mouse';

  // biome-ignore lint/correctness/useExhaustiveDependencies: the HUD comes back when the button goes
  useEffect(() => () => onPeek(false), []);

  return (
    <button
      type="button"
      className={styles.peek}
      aria-label="Xem ván"
      data-active={peeking || undefined}
      onPointerEnter={(e) => isMouse(e) && set(true)}
      onPointerLeave={(e) => isMouse(e) && set(false)}
      onPointerDown={(e) => !isMouse(e) && set(true)}
      onPointerUp={(e) => !isMouse(e) && set(false)}
      onPointerCancel={() => set(false)}
      onKeyDown={(e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
          e.preventDefault();
          set(true);
        }
      }}
      onKeyUp={(e) => (e.key === ' ' || e.key === 'Enter') && set(false)}
      onBlur={() => peeking && set(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Icon icon={IconEye} />
    </button>
  );
}
