import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { ApiError } from './api';

/** What to show for a failed request. */
export const message = (err: unknown) =>
  err instanceof ApiError ? err.message : 'Máy chủ gặp lỗi';

/** A modal form; closing (Esc, Huỷ, backdrop) calls `onClose`. */
export function Dialog(props: {
  title: string;
  children: ReactNode;
  submitLabel: string;
  danger?: boolean;
  busy?: boolean;
  error?: string;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  function submit(e: FormEvent) {
    e.preventDefault();
    props.onSubmit();
  }

  return (
    <dialog
      ref={ref}
      className="dialog"
      onClose={props.onClose}
      onClick={(e) => {
        if (e.target === ref.current) props.onClose();
      }}
      onKeyDown={() => {}}
    >
      <form onSubmit={submit}>
        <h2>{props.title}</h2>
        <div className="fields">{props.children}</div>
        {props.error && <p className="error">{props.error}</p>}
        <div className="actions">
          <button type="button" className="ghost" onClick={props.onClose}>
            Huỷ
          </button>
          <button
            type="submit"
            className={props.danger ? 'danger' : 'primary'}
            disabled={props.busy}
          >
            {props.submitLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}

/** A labelled field. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is passed in as `children`
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

/** Runs a request for a dialog: busy while it runs, its error shown on failure. */
export function useSubmit(onDone: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      onDone();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}
