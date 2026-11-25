import { IconX } from '@tabler/icons-react';
import { type ReactNode, useId } from 'react';
import { playSound } from '../sound/index.js';
import { Icon } from './Icon.js';
import { useModal } from './modal.js';
import styles from './Sheet.module.css';

export interface SheetProps {
  open: boolean;
  /** Escape, the backdrop or the close button: the sheet asks to close. */
  onClose(): void;
  title: string;
  children?: ReactNode;
}

/**
 * A modal `<dialog>` of frosted glass docked to the right edge, full height, for lists that scroll.
 * It slides in and its rows follow one by one; children mount only while open.
 */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const modal = useModal(open, onClose);
  const titleId = useId();
  const dismiss = () => {
    playSound('close');
    onClose();
  };

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: a tap on the backdrop is a pointer shortcut; Escape and the close button are the keyboard routes
    <dialog
      {...modal}
      className={`${styles.sheet} glass`}
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
      aria-labelledby={titleId}
    >
      <header className={styles.top}>
        <h2 id={titleId}>{title}</h2>
        <button type="button" className={styles.close} aria-label="Đóng" onClick={dismiss}>
          <Icon icon={IconX} size={28} />
        </button>
      </header>
      <div className={styles.body}>{open && children}</div>
    </dialog>
  );
}
