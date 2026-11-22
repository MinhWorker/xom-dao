import { IconChevronDown } from '@tabler/icons-react';
import type { SelectHTMLAttributes } from 'react';
import { playSound } from '../sound/index.js';
import { Icon } from './Icon.js';
import styles from './Select.module.css';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
  label: string;
  options: readonly SelectOption[];
  value: string;
  onChange(value: string): void;
}

/** A labelled dropdown on the native `<select>`: the phone's own picker, and the keyboard for free. */
export function Select({ label, options, value, onChange, className, ...rest }: SelectProps) {
  return (
    <label className={[styles.field, className].filter(Boolean).join(' ')}>
      <span className={styles.label}>{label}</span>
      <span className={styles.box}>
        <select
          className={styles.select}
          value={value}
          onChange={(e) => {
            playSound('click');
            onChange(e.target.value);
          }}
          {...rest}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className={styles.arrow} aria-hidden="true">
          <Icon icon={IconChevronDown} size={20} />
        </span>
      </span>
    </label>
  );
}
