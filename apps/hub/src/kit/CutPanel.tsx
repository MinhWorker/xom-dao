import type { HTMLAttributes, ReactNode } from 'react';
import styles from './CutPanel.module.css';

export interface CutPanelProps extends HTMLAttributes<HTMLElement> {
  /** A small mono label above the content. */
  label?: string;
  children: ReactNode;
}

/** A panel of frosted glass with its bottom-right corner cut off. */
export function CutPanel({ label, children, className, ...rest }: CutPanelProps) {
  return (
    <section
      className={[styles.panel, 'glass', 'cut-br', className].filter(Boolean).join(' ')}
      {...rest}
    >
      {label && <span className={styles.label}>{label}</span>}
      {children}
    </section>
  );
}
