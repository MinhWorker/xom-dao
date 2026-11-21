import type { ReactNode } from 'react';
import styles from './Chip.module.css';

export function Chip({
  tone,
  children,
}: {
  tone?: 'accent' | 'ok' | 'danger';
  children: ReactNode;
}) {
  return (
    <span className={[styles.chip, tone && styles[tone]].filter(Boolean).join(' ')}>
      {children}
    </span>
  );
}
