import type { KeyboardEvent } from 'react';

/** The index an arrow, Home or End key moves to in a list that wraps; `null` for other keys. */
export function nextIndex(key: string, index: number, count: number): number | null {
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (index + 1) % count;
    case 'ArrowLeft':
    case 'ArrowUp':
      return (index - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

/** Moves focus between the enabled `selector` elements of a group, and clicks the new one if `select`. */
export function rovingKeyDown(event: KeyboardEvent<HTMLElement>, selector: string, select = true) {
  const items = [...event.currentTarget.querySelectorAll<HTMLElement>(selector)].filter(
    (item) => !item.matches(':disabled'),
  );
  const index = items.indexOf(document.activeElement as HTMLElement);
  if (index < 0) return;
  const next = nextIndex(event.key, index, items.length);
  if (next === null) return;
  event.preventDefault();
  items[next]?.focus();
  if (select) items[next]?.click();
}
