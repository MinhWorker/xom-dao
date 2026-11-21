import type { HTMLAttributes, ReactNode } from 'react';
import styles from './CutPanel.module.css';

export interface CutPanelProps extends HTMLAttributes<HTMLElement> {
  /** A small mono label above the content. */
  label?: string;
  children: ReactNode;
}

export function CutPanel({ label, children, className, ...rest }: CutPanelProps) {
  return (
    <section className={[styles.panel, 'cut-br', className].filter(Boolean).join(' ')} {...rest}>
      {label && <span className={styles.label}>{label}</span>}
      {children}
    </section>
  );
}
