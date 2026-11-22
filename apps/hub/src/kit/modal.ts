import { type SyntheticEvent, useEffect, useRef } from 'react';

/** Longest a dialog's exit may hold it open, should an animation never finish. */
const EXIT_LIMIT_MS = 600;

/**
 * Plays a modal `<dialog>`'s exit (its CSS under `[data-closing]`) and then closes it. Only finite
 * animations are waited on, so a looping icon inside never holds it open. `keepOpen` is asked once
 * the exit is over: a dialog wanted open again by then stays.
 */
export async function closeAnimated(
  dialog: HTMLDialogElement,
  keepOpen: () => boolean = () => false,
) {
  dialog.setAttribute('data-closing', '');
  const running = (dialog.getAnimations?.({ subtree: true }) ?? []).filter(
    (a) => a.effect?.getComputedTiming().endTime !== Infinity,
  );
  await Promise.race([
    Promise.allSettled(running.map((a) => a.finished)),
    new Promise((resolve) => setTimeout(resolve, EXIT_LIMIT_MS)),
  ]);
  dialog.removeAttribute('data-closing');
  if (!keepOpen()) dialog.close();
}

/**
 * Drives a modal `<dialog>` from `open`: `showModal()` when it turns true, the animated exit when it
 * turns false. Spread the returned props on the `<dialog>`; Escape and a close from elsewhere call `onClose`.
 */
export function useModal(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  const wanted = useRef(open);
  wanted.current = open;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open) {
      dialog.removeAttribute('data-closing');
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open && !dialog.hasAttribute('data-closing')) {
      void closeAnimated(dialog, () => wanted.current);
    }
  }, [open]);

  return {
    ref,
    onClose() {
      if (wanted.current) onClose();
    },
    onCancel(e: SyntheticEvent<HTMLDialogElement>) {
      e.preventDefault();
      onClose();
    },
  };
}
