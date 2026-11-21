import type { ButtonHTMLAttributes } from 'react';
import { hoverSound, playSound } from '../sound/index.js';
import styles from './Button.module.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
}

export function Button({
  variant = 'secondary',
  className,
  type = 'button',
  onClick,
  onPointerEnter,
  ...rest
}: ButtonProps) {
  const classes = [styles.button, variant !== 'secondary' && styles[variant], 'cut-br', className];
  return (
    <button
      type={type}
      className={classes.filter(Boolean).join(' ')}
      onClick={(e) => {
        playSound('click');
        onClick?.(e);
      }}
      onPointerEnter={(e) => {
        hoverSound(e);
        onPointerEnter?.(e);
      }}
      {...rest}
    />
  );
}
