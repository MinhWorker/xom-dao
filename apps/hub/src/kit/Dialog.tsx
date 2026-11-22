import { type ReactNode, useId } from 'react';
import styles from './Dialog.module.css';
import { useModal } from './modal.js';

export interface DialogProps {
  open: boolean;
  /** Escape: the dialog asks to close. */
  onClose(): void;
  title: string;
  /** `box` fades in place; `band` is a full-width strip that opens from its middle line, for a question that needs an answer. */
  look?: 'box' | 'band';
  /** A small line over the title (`band` only). */
  kicker?: string;
  children?: ReactNode;
  actions: ReactNode;
}

/** A modal `<dialog>` of frosted glass opened with `showModal()`; it plays its exit before it closes. */
export function Dialog({
  open,
  onClose,
  title,
  look = 'box',
  kicker,
  children,
  actions,
}: DialogProps) {
  const modal = useModal(open, onClose);
  const titleId = useId();
  const body = (
    <>
      {look === 'band' && kicker && <span className={styles.kicker}>{kicker}</span>}
      <h2 id={titleId}>{title}</h2>
      {children}
      <div className={styles.actions}>{actions}</div>
    </>
  );

  return (
    <dialog
      {...modal}
      className={
        look === 'band' ? `${styles.dialog} ${styles.band} glass` : `${styles.dialog} glass cut-br`
      }
      aria-labelledby={titleId}
    >
      {look === 'band' ? <div className={styles.inner}>{body}</div> : body}
    </dialog>
  );
}
