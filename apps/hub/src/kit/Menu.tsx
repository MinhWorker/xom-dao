import { type ReactNode, useId, useRef } from 'react';
import { hoverSound, playSound } from '../sound/index.js';
import styles from './Menu.module.css';
import { rovingKeyDown } from './roving.js';

export interface MenuItem {
  label: string;
  onSelect(): void;
  danger?: boolean;
}

export interface MenuProps {
  /** Names the trigger button, which usually holds only an icon. */
  label: string;
  trigger: ReactNode;
  items: MenuItem[];
}

/** Not in React's types yet: the invoker attributes that let the button toggle the popover. */
const invoker = (id: string) => ({ commandfor: id, command: 'toggle-popover' }) as object;

/** A popover menu under its trigger; arrow keys move between items, Escape closes. */
export function Menu({ label, trigger, items }: MenuProps) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const fromKeyboard = useRef(false);
  const hasInvoker = 'commandForElement' in HTMLButtonElement.prototype;

  const close = () => {
    triggerRef.current?.focus();
    popoverRef.current?.hidePopover();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-label={label}
        aria-haspopup="menu"
        {...(hasInvoker ? invoker(id) : {})}
        onPointerEnter={hoverSound}
        onClick={(e) => {
          playSound('click');
          fromKeyboard.current = e.detail === 0;
          if (hasInvoker) return;
          popoverRef.current?.togglePopover({ source: triggerRef.current ?? undefined });
        }}
      >
        {trigger}
      </button>
      <div
        ref={popoverRef}
        id={id}
        popover="auto"
        className={`${styles.popover} glass cut-br`}
        onToggle={(e) => {
          const open = e.nativeEvent.newState === 'open';
          triggerRef.current?.setAttribute('aria-expanded', String(open));
          if (open && fromKeyboard.current) {
            popoverRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
          }
        }}
      >
        <div
          role="menu"
          aria-label={label}
          className={styles.menu}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              close();
              return;
            }
            if (e.key === 'Tab') {
              popoverRef.current?.hidePopover();
              return;
            }
            rovingKeyDown(e, '[role="menuitem"]', false);
          }}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={[styles.item, item.danger && styles.danger].filter(Boolean).join(' ')}
              onPointerEnter={hoverSound}
              onClick={() => {
                playSound('click');
                item.onSelect();
                close();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
