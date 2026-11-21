import { IconDeviceMobileRotated } from '@tabler/icons-react';
import { Icon } from '../kit/index.js';
import styles from './RotateNotice.module.css';

/** Covers the Hub while a phone is held upright; the CSS decides when it shows. */
export function RotateNotice() {
  return (
    <div className={styles.notice} role="status">
      <Icon icon={IconDeviceMobileRotated} size={64} />
      <p>Xoay ngang điện thoại</p>
    </div>
  );
}
