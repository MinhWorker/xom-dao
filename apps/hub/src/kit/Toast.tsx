import { IconX } from '@tabler/icons-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Icon } from './Icon.js';
import styles from './Toast.module.css';
import { type ToastData, toasts } from './toasts.js';

const LIFETIME_MS = 5000;

type Notifier = { ariaNotify?(message: string): void };

function ToastItem({ data }: { data: ToastData }) {
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (held) return;
    const timer = setTimeout(() => toasts.dismiss(data.id), LIFETIME_MS);
    return () => clearTimeout(timer);
  }, [held, data.id]);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover and focus only hold the timer
    <div
      className={[styles.toast, styles[data.tone], 'cut-br'].join(' ')}
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <span>{data.message}</span>
      <button
        type="button"
        className={styles.close}
        aria-label="Đóng"
        onClick={() => toasts.dismiss(data.id)}
      >
        <Icon icon={IconX} size={20} />
      </button>
    </div>
  );
}

/**
 * Where toasts show: one `popover="manual"` region, opened while a toast is queued. Mount it once.
 * Messages are announced with `ariaNotify`, or through a live region where that is missing.
 */
export function ToastRegion() {
  const items = useSyncExternalStore(toasts.subscribe, toasts.snapshot);
  const ref = useRef<HTMLDivElement>(null);
  const announced = useRef(0);
  const [live, setLive] = useState('');
  const canNotify = typeof document !== 'undefined' && 'ariaNotify' in document;

  useEffect(() => {
    const region = ref.current;
    if (!region) return;
    const open = region.matches(':popover-open');
    if (items.length > 0 && !open) region.showPopover();
    if (items.length === 0 && open) region.hidePopover();
  }, [items.length]);

  useEffect(() => {
    const fresh = items.filter((t) => t.id > announced.current);
    const last = fresh.at(-1);
    if (!last) return;
    announced.current = last.id;
    if (canNotify) {
      for (const t of fresh) (document as unknown as Notifier).ariaNotify?.(t.message);
    } else setLive(last.message);
  }, [items, canNotify]);

  return (
    <>
      {!canNotify && (
        <p role="status" className={styles.live}>
          {live}
        </p>
      )}
      <section ref={ref} popover="manual" aria-label="Thông báo" className={styles.region}>
        {items.map((data) => (
          <ToastItem key={data.id} data={data} />
        ))}
      </section>
    </>
  );
}
