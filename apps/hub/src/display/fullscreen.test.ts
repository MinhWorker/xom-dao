import { describe, expect, it, vi } from 'vitest';
import {
  canFullscreen,
  type DisplayEnv,
  enterFullscreen,
  exitFullscreen,
  isInstalled,
} from './fullscreen.js';

function env(over: { enabled?: boolean; installed?: boolean; active?: boolean } = {}) {
  const request = vi.fn(async () => {});
  const lock = vi.fn(async () => {});
  const unlock = vi.fn();
  const exit = vi.fn(async () => {});
  const value = {
    doc: {
      documentElement: { requestFullscreen: request },
      fullscreenElement: over.active ? {} : null,
      fullscreenEnabled: over.enabled ?? true,
      exitFullscreen: exit,
    },
    orientation: { lock, unlock },
    installed: over.installed ?? false,
  } as unknown as DisplayEnv;
  return { value, request, lock, unlock, exit };
}

describe('isInstalled', () => {
  const win = (standalone: boolean | undefined, media: boolean) => ({
    navigator: { standalone },
    matchMedia: () => ({ matches: media }) as MediaQueryList,
  });

  it('is true for an iOS home-screen app or a standalone display mode', () => {
    expect(isInstalled(win(true, false))).toBe(true);
    expect(isInstalled(win(undefined, true))).toBe(true);
    expect(isInstalled(win(undefined, false))).toBe(false);
  });
});

describe('canFullscreen', () => {
  it('needs browser support and a page that is not installed', () => {
    expect(canFullscreen(env().value)).toBe(true);
    expect(canFullscreen(env({ enabled: false }).value)).toBe(false);
    expect(canFullscreen(env({ installed: true }).value)).toBe(false);
  });
});

describe('enterFullscreen', () => {
  it('goes fullscreen, then locks landscape', async () => {
    const e = env();
    expect(await enterFullscreen(e.value)).toBe(true);
    expect(e.request).toHaveBeenCalledWith({ navigationUI: 'hide' });
    expect(e.lock).toHaveBeenCalledWith('landscape');
  });

  it('does nothing where fullscreen is unavailable', async () => {
    const e = env({ enabled: false });
    expect(await enterFullscreen(e.value)).toBe(false);
    expect(e.request).not.toHaveBeenCalled();
    expect(e.lock).not.toHaveBeenCalled();
  });

  it('does not ask again when already fullscreen', async () => {
    const e = env({ active: true });
    expect(await enterFullscreen(e.value)).toBe(true);
    expect(e.request).not.toHaveBeenCalled();
    expect(e.lock).toHaveBeenCalled();
  });

  it('gives up quietly when the browser refuses', async () => {
    const e = env();
    e.request.mockRejectedValueOnce(new Error('denied'));
    expect(await enterFullscreen(e.value)).toBe(false);
    expect(e.lock).not.toHaveBeenCalled();
  });

  it('stays fullscreen when the orientation lock is refused', async () => {
    const e = env();
    e.lock.mockRejectedValueOnce(new Error('NotSupportedError'));
    expect(await enterFullscreen(e.value)).toBe(true);
  });
});

describe('exitFullscreen', () => {
  it('unlocks the orientation and leaves fullscreen', async () => {
    const e = env({ active: true });
    await exitFullscreen(e.value);
    expect(e.unlock).toHaveBeenCalled();
    expect(e.exit).toHaveBeenCalled();
  });

  it('leaves a page that is not fullscreen alone', async () => {
    const e = env();
    await exitFullscreen(e.value);
    expect(e.exit).not.toHaveBeenCalled();
  });
});
