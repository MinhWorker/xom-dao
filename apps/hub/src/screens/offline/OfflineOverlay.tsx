import { Button, SyncIcon } from '../../kit/index.js';
import { useModal } from '../../kit/modal.js';
import styles from './OfflineOverlay.module.css';

/** A fishing boat adrift on flat faceted water under a lost signal. */
function AdriftArt() {
  return (
    <svg className={styles.adrift} viewBox="36 22 148 138" aria-hidden="true">
      <g className={styles.lost} data-loop>
        <path
          d="M84 46a40 40 0 0 1 52 0M94 58a24 24 0 0 1 32 0"
          fill="none"
          stroke="#ffc234"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray="7 7"
        />
        <polygon points="104,70 116,70 110,78" fill="#ffc234" />
      </g>
      <path d="M86 32 134 78" stroke="#e8ecf1" strokeWidth="5" strokeLinecap="round" />
      <g className={styles.boat} data-loop>
        <g stroke="#0b0d10" strokeWidth="3" strokeLinejoin="round">
          <polygon points="108,92 108,128 76,128" fill="#e8ecf1" />
          <polygon points="112,98 112,128 136,128" fill="#c3ccd7" />
          <polygon points="62,130 158,130 146,148 74,148" fill="#e8ecf1" />
        </g>
        <polygon points="62,130 110,130 104,148 74,148" fill="#f8fafc" />
        <polygon points="62,130 158,130 157,134 63,134" fill="#ffc234" />
        <path d="M110 88V130" stroke="#0b0d10" strokeWidth="3" />
      </g>
      <g className={styles.waves} data-loop fill="#3a4048">
        <polygon points="0,150 30,144 60,152 90,145 120,152 150,145 180,152 210,145 240,152 240,170 0,170" />
      </g>
      <g fill="#2f343b">
        <polygon points="0,160 40,155 80,161 120,156 160,161 200,156 220,159 220,170 0,170" />
      </g>
    </svg>
  );
}

export interface OfflineOverlayProps {
  open: boolean;
  /** "Thoát": the player stops waiting on the overlay; the Hub keeps retrying. */
  onDismiss(): void;
}

/** The connection is lost: frosted glass over everything, HUD included, while the Hub retries. */
export function OfflineOverlay({ open, onDismiss }: OfflineOverlayProps) {
  const modal = useModal(open);
  return (
    <dialog {...modal} className={styles.offline} aria-labelledby="offline-title" data-over-toasts>
      <div className={styles.inner}>
        <AdriftArt />
        <div className={styles.text}>
          <h2 id="offline-title">Có gì đó sai sai</h2>
          <p>Server không phản hồi</p>
          <span className={styles.retry} role="status">
            <SyncIcon size={20} />
            Đang kết nối lại
          </span>
          <Button variant="primary" sound="close" onClick={onDismiss}>
            Thoát
          </Button>
        </div>
      </div>
    </dialog>
  );
}
