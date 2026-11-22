import type { ReactNode } from 'react';
import { OnlineDot } from '../../kit/index.js';
import styles from './PersonRow.module.css';

export interface PersonRowProps {
  name: string;
  /** The line under the name: where they are, or their username. */
  detail: string;
  /** Shows the green dot on the picture. */
  online?: boolean;
  /** Greys the row (offline or already answered). */
  dim?: boolean;
  /** Buttons on the right. */
  children?: ReactNode;
}

/** One person in a list: picture, name, a line of detail and their actions. */
export function PersonRow({ name, detail, online, dim, children }: PersonRowProps) {
  return (
    <li className={`${styles.row} ${dim ? styles.dim : ''}`}>
      <span className={styles.face} aria-hidden="true">
        {name.slice(0, 1).toUpperCase()}
        {online && <OnlineDot className={styles.dot} />}
      </span>
      <span className={styles.text}>
        <span className={styles.name}>{name}</span>
        <span className={styles.detail}>{detail}</span>
      </span>
      {children && <span className={styles.actions}>{children}</span>}
    </li>
  );
}
