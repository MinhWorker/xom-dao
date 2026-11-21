import { type ReactNode, useEffect, useRef } from 'react';
import styles from './Dialog.module.css';

export interface DialogProps {
  open: boolean;
  /** Escape or the backdrop: the dialog asks to close. */
  onClose(): void;
  title: string;
  children?: ReactNode;
  actions: ReactNode;
}

/** A modal `<dialog>` opened with `showModal()`. */
export function Dialog({ open, onClose, title, children, actions }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`${styles.dialog} cut-br`}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-labelledby="dialog-title"
    >
      <h2 id="dialog-title">{title}</h2>
      {children}
      <div className={styles.actions}>{actions}</div>
    </dialog>
  );
}
