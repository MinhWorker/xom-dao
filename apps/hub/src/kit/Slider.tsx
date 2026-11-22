import { type CSSProperties, useId } from 'react';
import { playSound } from '../sound/index.js';
import styles from './Slider.module.css';

export interface SliderProps {
  label: string;
  value: number;
  onChange(value: number): void;
  min?: number;
  max?: number;
  step?: number;
  /** What the value reads as, e.g. `70%`; the number itself when left out. */
  format?(value: number): string;
  /** Draws a tick at every step, for a slider that moves between a few stops. */
  marks?: boolean;
  disabled?: boolean;
}

/** A native range input with its label and current value; it clicks when let go. */
export function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  format = String,
  marks,
  disabled,
}: SliderProps) {
  const id = useId();
  const text = format(value);
  const stops = marks ? Math.floor((max - min) / step) + 1 : 0;
  const style = { '--min': min, '--max': max, '--value': value } as CSSProperties;
  return (
    <div className={styles.slider}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <output htmlFor={id} className={styles.value}>
        {text}
      </output>
      <input
        id={id}
        type="range"
        className={styles.input}
        style={style}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-valuetext={text}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
        onPointerUp={() => playSound('click')}
        onKeyUp={(e) => {
          if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End') playSound('click');
        }}
      />
      {stops > 1 && (
        <span className={styles.marks} aria-hidden="true">
          {Array.from({ length: stops }, (_, i) => min + i * step).map((stop) => (
            <i key={stop} />
          ))}
        </span>
      )}
    </div>
  );
}
