import { IconAnchor } from '@tabler/icons-react';
import { useSyncExternalStore } from 'react';
import { LoadingEmblem } from '../room/MatchLoading.js';
import loading from '../room/MatchLoading.module.css';
import styles from './Homeward.module.css';
import { homeward } from './homeward.js';

/** The Hub's loading screen over everything while a player leaves a Match for the Bến. Mount it once. */
export function Homeward() {
  const state = useSyncExternalStore(homeward.subscribe, homeward.snapshot);

  if (!state) return null;
  const percent = state === 'leaving' ? 40 : 100;
  return (
    <div
      className={`${loading.loading} ${styles.homeward}`}
      data-leaving={state === 'out' || undefined}
      role="status"
    >
      <span className={loading.stripes} data-loop aria-hidden="true" />
      <LoadingEmblem>
        <IconAnchor className={styles.anchor} stroke={2} aria-hidden />
      </LoadingEmblem>
      <div className={loading.info}>
        <span className={loading.kicker}>Đang về</span>
        <h2 className={loading.title}>Bến</h2>
        <progress className={loading.bar} max={100} value={percent} aria-label="Đang tải" />
        <span className={loading.percent}>{percent}%</span>
      </div>
    </div>
  );
}
