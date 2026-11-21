import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
}

export function Button({
  variant = 'secondary',
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [styles.button, variant !== 'secondary' && styles[variant], 'cut-br', className];
  return <button type={type} className={classes.filter(Boolean).join(' ')} {...rest} />;
}
