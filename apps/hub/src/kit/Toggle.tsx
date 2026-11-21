import styles from './Toggle.module.css';

export interface ToggleProps {
  label: string;
  checked: boolean;
  onChange(checked: boolean): void;
  disabled?: boolean;
}

/** An on/off switch: a `role="switch"` button with its label beside it. */
export function Toggle({ label, checked, onChange, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={styles.toggle}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.track} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
