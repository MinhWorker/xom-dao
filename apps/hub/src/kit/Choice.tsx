import { useId } from 'react';
import { playSound } from '../sound/index.js';
import styles from './Choice.module.css';
import { rovingKeyDown } from './roving.js';

export interface ChoiceOption {
  value: string;
  label: string;
}

export interface ChoiceProps {
  label: string;
  options: ChoiceOption[];
  value: string;
  onChange(value: string): void;
  disabled?: boolean;
}

/** One of a few options, as a `radiogroup`: arrow keys move and select. */
export function Choice({ label, options, value, onChange, disabled }: ChoiceProps) {
  const labelId = useId();
  return (
    <div className={styles.choice}>
      <span id={labelId} className={styles.label}>
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className={styles.options}
        onKeyDown={(e) => rovingKeyDown(e, '[role="radio"]')}
      >
        {options.map((option) => (
          // biome-ignore lint/a11y/useSemanticElements: a styled button with roving arrow keys
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={option.value === value}
            tabIndex={option.value === value ? 0 : -1}
            disabled={disabled}
            className={`${styles.option} cut-br`}
            onClick={() => {
              playSound('click');
              onChange(option.value);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
