import { useSyncExternalStore } from 'react';

type FullscreenDoc = Pick<
  Document,
  'documentElement' | 'fullscreenElement' | 'fullscreenEnabled' | 'exitFullscreen'
>;

interface Orientation {
  lock?(orientation: 'landscape'): Promise<void>;
  unlock?(): void;
}

/** What the page runs in: the document, its orientation API and whether it is an installed app. */
export interface DisplayEnv {
  doc: FullscreenDoc;
  orientation?: Orientation;
  installed: boolean;
}

/** An installed app (home-screen icon) already has no browser bars. */
export function isInstalled(
  win: Pick<Window, 'matchMedia'> & { navigator: object } = window,
): boolean {
  const { standalone } = win.navigator as { standalone?: boolean };
  return standalone === true || win.matchMedia('(display-mode: standalone)').matches;
}

export function displayEnv(): DisplayEnv {
  return {
    doc: document,
    orientation: screen.orientation as Orientation,
    installed: isInstalled(),
  };
}

/** Whether the page can take the whole screen itself: not on iPhone, and not once installed. */
export function canFullscreen({ doc, installed }: DisplayEnv): boolean {
  return doc.fullscreenEnabled === true && !installed;
}

/**
 * Takes the whole screen and locks it to landscape (Android Chrome only allows the lock in
 * fullscreen). Needs a tap. Returns whether the page is fullscreen afterwards; refusals are ignored.
 */
export async function enterFullscreen(env: DisplayEnv = displayEnv()): Promise<boolean> {
  const { doc, orientation } = env;
  if (!canFullscreen(env)) return false;
  try {
    if (!doc.fullscreenElement)
      await doc.documentElement.requestFullscreen({ navigationUI: 'hide' });
  } catch {
    return false;
  }
  try {
    await orientation?.lock?.('landscape');
  } catch {}
  return true;
}

export async function exitFullscreen({ doc, orientation }: DisplayEnv = displayEnv()) {
  try {
    orientation?.unlock?.();
  } catch {}
  if (!doc.fullscreenElement) return;
  try {
    await doc.exitFullscreen();
  } catch {}
}

function subscribe(onChange: () => void) {
  document.addEventListener('fullscreenchange', onChange);
  return () => document.removeEventListener('fullscreenchange', onChange);
}

/** Whether the page is fullscreen right now. */
export function useFullscreen(): boolean {
  return useSyncExternalStore(subscribe, () => document.fullscreenElement !== null);
}
