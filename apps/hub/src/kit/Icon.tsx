import type { Icon as TablerIcon } from '@tabler/icons-react';
import type { SVGProps } from 'react';

export interface IconProps {
  /** A Tabler icon, imported one at a time (`import { IconX } from '@tabler/icons-react'`). */
  icon: TablerIcon;
  size?: number;
  /** Set when the icon stands alone; otherwise it is hidden from screen readers. */
  label?: string;
}

export function Icon({ icon: Glyph, size = 24, label }: IconProps) {
  return (
    <Glyph
      size={size}
      stroke={2}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
    />
  );
}

type CurrencyProps = Omit<SVGProps<SVGSVGElement>, 'viewBox'> & { size?: number };

export function CoinIcon({ size = 24, ...rest }: CurrencyProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" {...rest}>
      <circle cx="12" cy="12" r="10" fill="#ffc234" />
      <circle cx="12" cy="12" r="7" fill="none" stroke="#9a6b00" strokeWidth="2" />
      <path d="M12 8v8" stroke="#9a6b00" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function GemIcon({ size = 24, ...rest }: CurrencyProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" {...rest}>
      <path d="M12 2 21 9 12 22 3 9z" fill="#2ec8e6" />
      <path
        d="M3 9h18M12 2 8 9l4 13 4-13z"
        fill="none"
        stroke="#0b5a6b"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
