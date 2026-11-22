import type { CSSProperties, ReactNode } from 'react';
import styles from './Loops.module.css';

/** Signal bars that light up in turn: connecting. */
export function SignalIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      className={styles.signal}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
    >
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={3 + i * 5}
          y={18 - i * 4}
          width={3}
          height={3 + i * 4}
          style={{ '--i': i } as CSSProperties}
          data-loop
        />
      ))}
    </svg>
  );
}

/** A turning diamond: syncing or retrying. `mirror` turns it the other way. */
export function SyncIcon({ size = 24, mirror }: { size?: number; mirror?: boolean }) {
  return (
    <span
      className={`${styles.sync} ${mirror ? styles.mirror : ''}`}
      style={{ '--size': `${size}px` } as CSSProperties}
      aria-hidden="true"
    >
      <span data-loop />
      <span data-loop />
    </span>
  );
}

/** The green dot of someone online, with a ring that pings out of it. */
export function OnlineDot({ className }: { className?: string }) {
  return (
    <span className={`${styles.online} ${className ?? ''}`} aria-hidden="true">
      <span data-loop />
    </span>
  );
}

export interface LoopProps {
  /** `swing`: a bell rings now and then; `bob`: a letter hops; `glint`: light crosses a coin. */
  kind: 'swing' | 'bob' | 'glint';
  /** Stands still when false, e.g. a mail icon with nothing new. */
  active?: boolean;
  /** A red pip on the icon's corner while it moves. */
  pip?: boolean;
  children: ReactNode;
}

/** Wraps a HUD icon in one of the looping motions. */
export function Loop({ kind, active = true, pip = false, children }: LoopProps) {
  if (!active) return <span className={styles.still}>{children}</span>;
  return (
    <span className={styles[kind]} data-loop>
      {children}
      {pip && <i className={styles.pip} />}
    </span>
  );
}
