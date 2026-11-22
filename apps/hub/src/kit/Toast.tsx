import {
  IconAlertTriangle,
  IconCircleCheck,
  IconCircleX,
  IconInfoCircle,
} from '@tabler/icons-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../settings/graphics.js';
import { Icon } from './Icon.js';
import styles from './Toast.module.css';
import { type ToastData, toasts } from './toasts.js';

const LIFETIME_MS = 4000;
/** A press shorter than this is a tap that dismisses; a longer one only held the timer. */
const TAP_MS = 500;
const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
const ICONS = {
  info: IconInfoCircle,
  success: IconCircleCheck,
  warning: IconAlertTriangle,
  danger: IconCircleX,
};

type Notifier = { ariaNotify?(message: string): void };

const still = (el: Element) => el.closest('[data-reduce]') !== null || prefersReducedMotion();

function ToastItem({
  data,
  top,
  register,
}: {
  data: ToastData;
  /** Where it stays while it fades out. */
  top: number | undefined;
  register(el: HTMLButtonElement | null): void;
}) {
  const bar = useRef<HTMLSpanElement>(null);
  const life = useRef<Animation | null>(null);
  const pressedAt = useRef(0);
  const leaving = data.leaving === true;

  useEffect(() => {
    const el = bar.current;
    if (!el?.animate) {
      const timer = setTimeout(() => toasts.dismiss(data.id), LIFETIME_MS);
      return () => clearTimeout(timer);
    }
    const a = el.animate([{ scale: '1 1' }, { scale: '0 1' }], {
      duration: LIFETIME_MS,
      fill: 'forwards',
    });
    life.current = a;
    a.onfinish = () => toasts.dismiss(data.id);
    return () => a.cancel();
  }, [data.id]);

  const hold = (on: boolean) => {
    if (leaving) return;
    if (on) life.current?.pause();
    else life.current?.play();
  };

  return (
    <button
      ref={register}
      type="button"
      className={`${styles.toast} ${styles[data.tone]} glass cut-br`}
      style={leaving ? { top } : undefined}
      data-leaving={leaving || undefined}
      onPointerEnter={(e) => e.pointerType === 'mouse' && hold(true)}
      onPointerLeave={() => hold(false)}
      onPointerDown={() => {
        pressedAt.current = performance.now();
        hold(true);
      }}
      onPointerUp={(e) => e.pointerType !== 'mouse' && hold(false)}
      onPointerCancel={() => hold(false)}
      onFocus={() => hold(true)}
      onBlur={() => hold(false)}
      onClick={(e) => {
        if (e.detail === 0 || performance.now() - pressedAt.current < TAP_MS)
          toasts.dismiss(data.id);
      }}
    >
      <Icon icon={ICONS[data.tone]} size={26} />
      <span>{data.message}</span>
      <span ref={bar} className={styles.life} aria-hidden="true" />
    </button>
  );
}

/**
 * Where toasts show: one `popover="manual"` region under the HUD at the top right, oldest on top,
 * raised again over any dialog that opens (except one marked `data-over-toasts`). The others glide
 * to their new places when one comes or goes (FLIP). A tap dismisses one; hovering or holding it
 * stops its clock. Mount it once.
 * Messages are announced with `ariaNotify`, or through a live region where that is missing.
 */
export function ToastRegion() {
  const [items, setItems] = useState(toasts.snapshot);
  const region = useRef<HTMLElement>(null);
  const els = useRef(new Map<number, HTMLElement>());
  const before = useRef(new Map<number, { top: number; offset: number }>());
  const tops = useRef(new Map<number, number>());
  const announced = useRef(0);
  const [live, setLive] = useState('');
  const canNotify = typeof document !== 'undefined' && 'ariaNotify' in document;

  useEffect(() => {
    const sync = () => {
      before.current = new Map(
        [...els.current].map(([id, el]) => [
          id,
          { top: el.getBoundingClientRect().top, offset: el.offsetTop },
        ]),
      );
      setItems(toasts.snapshot());
    };
    sync();
    return toasts.subscribe(sync);
  }, []);

  const showing = items.length > 0;
  useEffect(() => {
    const el = region.current;
    if (!el?.showPopover) return;
    const open = el.matches(':popover-open');
    if (showing && !open) el.showPopover();
    if (!showing && open) el.hidePopover();
    if (!showing) return;
    const raise = new MutationObserver((changes) => {
      const opened = changes.some(
        (c) =>
          c.target instanceof HTMLDialogElement &&
          c.target.open &&
          !c.target.hasAttribute('data-over-toasts'),
      );
      if (!opened || !el.matches(':popover-open')) return;
      el.hidePopover();
      el.showPopover();
    });
    raise.observe(document.body, { subtree: true, attributeFilter: ['open'] });
    return () => raise.disconnect();
  }, [showing]);

  const drop = useCallback((id: number) => {
    els.current.delete(id);
    tops.current.delete(id);
    toasts.remove(id);
  }, []);

  useLayoutEffect(() => {
    for (const t of items) {
      const el = els.current.get(t.id);
      if (!el) continue;
      const calm = still(el);
      if (t.leaving) {
        if ('out' in el.dataset) continue;
        el.dataset.out = '';
        if (!el.animate) {
          drop(t.id);
          continue;
        }
        for (const a of el.getAnimations()) a.cancel();
        const out = el.animate(
          calm
            ? [{ opacity: 1 }, { opacity: 0 }]
            : [
                { opacity: 1, translate: '0 0' },
                { opacity: 0, translate: '32px 0' },
              ],
          { duration: 200, easing: EASE, fill: 'forwards' },
        );
        out.onfinish = () => drop(t.id);
        continue;
      }
      if (!el.animate) continue;
      const prev = before.current.get(t.id);
      for (const a of el.getAnimations()) a.cancel();
      const top = el.getBoundingClientRect().top;
      if (prev === undefined) {
        el.animate(
          calm
            ? [{ opacity: 0 }, { opacity: 1 }]
            : [
                { opacity: 0, translate: '0 16px', scale: 0.96 },
                { opacity: 1, translate: '0 0', scale: 1 },
              ],
          { duration: 260, easing: EASE },
        );
      } else if (!calm && Math.abs(prev.top - top) > 0.5) {
        el.animate([{ translate: `0 ${prev.top - top}px` }, { translate: '0 0' }], {
          duration: 280,
          easing: EASE,
        });
      }
    }
  }, [items, drop]);

  useEffect(() => {
    const fresh = items.filter((t) => t.id > announced.current);
    const last = fresh.at(-1);
    if (!last) return;
    announced.current = last.id;
    if (canNotify) {
      for (const t of fresh) (document as unknown as Notifier).ariaNotify?.(t.message);
    } else setLive(last.message);
  }, [items, canNotify]);

  for (const t of items) {
    if (t.leaving && !tops.current.has(t.id))
      tops.current.set(t.id, before.current.get(t.id)?.offset ?? 0);
  }

  return (
    <>
      {!canNotify && (
        <p role="status" className={styles.live}>
          {live}
        </p>
      )}
      <section ref={region} popover="manual" aria-label="Thông báo" className={styles.region}>
        {items.map((data) => (
          <ToastItem
            key={data.id}
            data={data}
            top={tops.current.get(data.id)}
            register={(el) => {
              if (el) els.current.set(data.id, el);
            }}
          />
        ))}
      </section>
    </>
  );
}
