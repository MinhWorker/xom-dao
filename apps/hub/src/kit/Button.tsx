import { IconChevronRight } from '@tabler/icons-react';
import type { ButtonHTMLAttributes, PointerEvent } from 'react';
import { prefersReducedMotion } from '../settings/graphics.js';
import { playSound, type SoundName } from '../sound/index.js';
import styles from './Button.module.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  /** The screen's main way forward: chevrons march after the label and a sheen passes now and then. */
  forward?: boolean;
  /** Played on click: `close` for a way back or out. */
  sound?: SoundName;
}

const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

/** On touch, a press plays the underline and sheen a mouse gets on hover. */
function pressFlash(button: HTMLButtonElement, forward: boolean) {
  if (!button.animate) return;
  button.animate(
    [
      { scale: '0 1' },
      { scale: '1 1', offset: 0.3 },
      { scale: '1 1', offset: 0.7 },
      { scale: '0 1' },
    ],
    { duration: 600, easing: EASE, pseudoElement: '::after' },
  );
  if (forward || prefersReducedMotion()) return;
  button.animate([{ translate: '-150% 0' }, { translate: '350% 0' }], {
    duration: 520,
    easing: EASE,
    pseudoElement: '::before',
  });
}

export function Button({
  variant = 'secondary',
  forward = false,
  sound = 'click',
  className,
  type = 'button',
  onClick,
  onPointerDown,
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    styles.button,
    variant !== 'secondary' && styles[variant],
    forward && styles.forward,
    'cut-br',
    className,
  ];
  return (
    <button
      type={type}
      className={classes.filter(Boolean).join(' ')}
      data-loop={forward || undefined}
      onClick={(e) => {
        playSound(sound);
        onClick?.(e);
      }}
      onPointerDown={(e: PointerEvent<HTMLButtonElement>) => {
        if (e.pointerType !== 'mouse') pressFlash(e.currentTarget, forward);
        onPointerDown?.(e);
      }}
      {...rest}
    >
      {children}
      {forward && (
        <span className={styles.chevrons} aria-hidden="true">
          <IconChevronRight size={24} stroke={3} data-loop />
          <IconChevronRight size={24} stroke={3} data-loop />
          <IconChevronRight size={24} stroke={3} data-loop />
        </span>
      )}
    </button>
  );
}
