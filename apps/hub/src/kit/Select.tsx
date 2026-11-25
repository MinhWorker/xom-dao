import { IconCheck, IconChevronDown } from '@tabler/icons-react';
import { useId, useRef } from 'react';
import { playSound } from '../sound/index.js';
import { Icon } from './Icon.js';
import { rovingKeyDown } from './roving.js';
import styles from './Select.module.css';
import { listPlacement } from './select.js';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  label: string;
  options: readonly SelectOption[];
  value: string;
  onChange(value: string): void;
  disabled?: boolean;
  className?: string;
}

const GAP = 4;
const MARGIN = 8;

/**
 * A labelled dropdown: a button and a popover list of options in the kit's own look (the browser's
 * `<select>` list cannot be styled). The list is placed by hand against the button, below or above
 * it, and scrolls when the screen is short. Arrow keys move, Escape closes.
 */
export function Select({ label, options, value, onChange, disabled, className }: SelectProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const valueId = `${id}-value`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  /** Whether the list was open when the button was pressed: the press itself light-dismisses it first. */
  const wasOpen = useRef(false);
  const selected = options.find((option) => option.value === value) ?? options[0];

  /** Shows the list and puts it against the button; lengths are divided by the HUD scale, which zooms the page. */
  const open = () => {
    const trigger = triggerRef.current;
    const popover = popoverRef.current;
    if (!trigger || !popover || popover.matches(':popover-open')) return;
    popover.showPopover();
    const scale =
      Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--hud-scale'),
      ) || 1;
    const rect = trigger.getBoundingClientRect();
    const { above, space } = listPlacement(
      rect,
      window.innerHeight,
      popover.scrollHeight * scale,
      GAP,
      MARGIN,
    );
    const { style } = popover;
    style.left = `${rect.left / scale}px`;
    style.minWidth = `${rect.width / scale}px`;
    style.maxHeight = `${space / scale}px`;
    style.top = above ? 'auto' : `${(rect.bottom + GAP) / scale}px`;
    style.bottom = above ? `${(window.innerHeight - rect.top + GAP) / scale}px` : 'auto';
  };

  const choose = (next: string) => {
    playSound('click');
    popoverRef.current?.hidePopover();
    if (next !== value) onChange(next);
  };

  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <span id={labelId} className={styles.label}>
        {label}
      </span>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-haspopup="listbox"
        aria-expanded="false"
        aria-labelledby={`${labelId} ${valueId}`}
        disabled={disabled}
        onPointerDown={() => {
          wasOpen.current = !!popoverRef.current?.matches(':popover-open');
        }}
        onClick={() => {
          playSound('click');
          const shown = wasOpen.current || !!popoverRef.current?.matches(':popover-open');
          wasOpen.current = false;
          if (shown) popoverRef.current?.hidePopover();
          else open();
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            open();
          }
        }}
      >
        <span id={valueId} className={styles.value}>
          {selected?.label}
        </span>
        <span className={styles.arrow} aria-hidden="true">
          <Icon icon={IconChevronDown} size={20} />
        </span>
      </button>
      <div
        ref={popoverRef}
        popover="auto"
        className={`${styles.popover} glass cut-br`}
        onToggle={(e) => {
          const isOpen = e.nativeEvent.newState === 'open';
          triggerRef.current?.setAttribute('aria-expanded', String(isOpen));
          if (isOpen) {
            popoverRef.current
              ?.querySelector<HTMLElement>('[aria-selected="true"]')
              ?.focus({ preventScroll: false });
          }
        }}
      >
        <div
          role="listbox"
          aria-labelledby={labelId}
          className={styles.list}
          onKeyDown={(e) => {
            if (e.key === 'Tab') popoverRef.current?.hidePopover();
            else rovingKeyDown(e, '[role="option"]', false);
          }}
        >
          {options.map((option) => {
            const on = option.value === selected?.value;
            return (
              // biome-ignore lint/a11y/useSemanticElements: a styled button inside a custom listbox
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={on}
                tabIndex={on ? 0 : -1}
                className={styles.item}
                onClick={() => choose(option.value)}
              >
                <span>{option.label}</span>
                {on && <Icon icon={IconCheck} size={20} />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
