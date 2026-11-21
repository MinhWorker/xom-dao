import { IconX } from '@tabler/icons-react';
import { type ReactNode, useEffect, useId, useRef } from 'react';
import { Icon } from './Icon.js';
import styles from './Sheet.module.css';

export interface SheetProps {
  open: boolean;
  /** Escape, the backdrop or the close button: the sheet asks to close. */
  onClose(): void;
  title: string;
  children?: ReactNode;
}

/** A modal `<dialog>` docked to the right edge, full height, for lists that scroll. Children mount only while open. */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: a tap on the backdrop is a pointer shortcut; Escape and the close button are the keyboard routes
    <dialog
      ref={ref}
      className={styles.sheet}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby={titleId}
    >
      <header className={styles.top}>
        <h2 id={titleId}>{title}</h2>
        <button type="button" className={styles.close} aria-label="Đóng" onClick={onClose}>
          <Icon icon={IconX} />
        </button>
      </header>
      <div className={styles.body}>{open && children}</div>
    </dialog>
  );
}
