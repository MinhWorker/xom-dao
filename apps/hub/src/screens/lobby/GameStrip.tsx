import type { HubGame } from '../../games.js';
import { rovingKeyDown } from '../../kit/roving.js';
import styles from './GameStrip.module.css';
import { focusPosition } from './summary.js';

export interface GameStripProps {
  games: HubGame[];
  selectedId: string;
  /** Games whose server is not running: shown, but dimmed and marked. */
  closedIds: string[];
  onSelect(id: string): void;
}

/** Brings the card just picked to the middle of the strip. */
function centre(card: HTMLButtonElement | null) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  card?.scrollIntoView({
    behavior: reduce ? 'instant' : 'smooth',
    inline: 'center',
    block: 'nearest',
  });
}

/**
 * The slanted card strip: a `radiogroup`. Swiping scrolls it (snapping) but only a tap picks a
 * Game, with arrow keys moving the pick for the keyboard.
 */
export function GameStrip({ games, selectedId, closedIds, onSelect }: GameStripProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Chọn trò"
      className={styles.strip}
      onKeyDown={(e) => rovingKeyDown(e, '[role="radio"]')}
    >
      {games.map(({ manifest, art }) => {
        const on = manifest.id === selectedId;
        return (
          // biome-ignore lint/a11y/useSemanticElements: a card with roving arrow keys
          <button
            key={manifest.id}
            ref={on ? centre : undefined}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            className={styles.card}
            onClick={() => onSelect(manifest.id)}
          >
            <img
              src={art.card}
              alt=""
              width={480}
              height={270}
              decoding="async"
              style={{ objectPosition: focusPosition(manifest) }}
            />
            <span className={styles.name}>{manifest.name}</span>
            {closedIds.includes(manifest.id) && <span className={styles.closed}>Tạm đóng</span>}
            <span className={styles.bar} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
