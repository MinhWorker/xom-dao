import type { InputHTMLAttributes } from 'react';
import styles from './TextField.module.css';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

/** A labelled input; 16 px text at least so iOS does not zoom in on focus. */
export function TextField({ label, className, ...rest }: TextFieldProps) {
  return (
    <label className={[styles.field, className].filter(Boolean).join(' ')}>
      <span className={styles.label}>{label}</span>
      <input className={styles.input} {...rest} />
    </label>
  );
}
