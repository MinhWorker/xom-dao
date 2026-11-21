/** The page a horizontal scroller shows: the one its scroll position is nearest to. */
export function nearestPage(scrollLeft: number, pageWidth: number, count: number): number {
  if (pageWidth <= 0 || count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(Math.abs(scrollLeft) / pageWidth)));
}

/** "2 trên 5": the label of one page for screen readers. */
export const pageLabel = (index: number, count: number) => `${index + 1} trên ${count}`;
