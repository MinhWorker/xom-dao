/**
 * Where a dropdown list goes against its button: below it when the list fits there, else above it
 * when it fits there, else the roomier side. `space` is the height that side has (the list scrolls
 * past it). Sizes are in px of the screen.
 */
export function listPlacement(
  trigger: { top: number; bottom: number },
  screenHeight: number,
  listHeight: number,
  gap: number,
  margin: number,
): { above: boolean; space: number } {
  const below = screenHeight - trigger.bottom - gap - margin;
  const above = trigger.top - gap - margin;
  if (listHeight <= below) return { above: false, space: below };
  if (listHeight <= above) return { above: true, space: above };
  return below >= above ? { above: false, space: below } : { above: true, space: above };
}
