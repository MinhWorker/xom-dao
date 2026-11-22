import { useSyncExternalStore } from 'react';
import { SyncIcon } from './Loops.js';
import styles from './WaitBadge.module.css';
import { waits } from './wait.js';

/**
 * The strip at the bottom of the screen while a request is slow (`wait()`); a blocking wait also
 * dims the screen and takes its taps. A `popover="manual"`, so it shows over open dialogs. Mount it once.
 */
export function WaitBadge() {
  const state = useSyncExternalStore(waits.subscribe, waits.snapshot);

  if (!state) return null;
  return (
    <div
      ref={(node) => {
        if (node?.showPopover && !node.matches(':popover-open')) node.showPopover();
      }}
      popover="manual"
      className={styles.wait}
    >
      {state === 'block' && <div className={styles.scrim} />}
      <div className={`${styles.badge} glass`} role="status">
        <span className={styles.rule} aria-hidden="true" />
        <SyncIcon size={22} />
        <span className={styles.text}>Đang tải</span>
        <SyncIcon size={22} mirror />
        <span className={styles.rule} aria-hidden="true" />
      </div>
    </div>
  );
}
