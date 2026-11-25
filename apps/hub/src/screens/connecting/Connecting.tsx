import { useEffect, useState } from 'react';
import { BACKGROUNDS, pickArt } from '../../harbour-art/arts.js';
import { SignalIcon } from '../../kit/index.js';
import { useHarbourLook } from '../../settings/harbour.js';
import styles from './Connecting.module.css';

/** How long a connect may take before the server is assumed to be waking from a cold start. */
const COLD_START_MS = 2500;

/** Covers the screen with the player's Bến backdrop while the first connection is made. */
export function Connecting() {
  const background = pickArt(BACKGROUNDS, useHarbourLook().background);
  const [waking, setWaking] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setWaking(true), COLD_START_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <main className={styles.wrap}>
      <img
        className={styles.scene}
        src={background.src}
        style={{ objectPosition: background.position }}
        alt=""
        draggable={false}
      />
      <p className={`${styles.status} glass cut-br`} role="status">
        <SignalIcon size={28} />
        {waking ? 'Đang gọi server dậy…' : 'Đang kết nối…'}
      </p>
    </main>
  );
}
