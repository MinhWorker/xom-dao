// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRouter, parseRoute } from './router.js';

afterEach(() => {
  history.replaceState(null, '', '/');
});

describe('parseRoute', () => {
  it('reads the Hub screens from a path', () => {
    expect(parseRoute('/')).toEqual({ name: 'harbour' });
    expect(parseRoute('/room/ab3x')).toEqual({ name: 'room', code: 'AB3X' });
    expect(parseRoute('/room/AB3X/')).toEqual({ name: 'room', code: 'AB3X' });
    expect(parseRoute('/dev/kit')).toEqual({ name: 'kit' });
    expect(parseRoute('/sea')).toEqual({ name: 'sea' });
    expect(parseRoute('/profile')).toEqual({ name: 'profile' });
    expect(parseRoute('/profile/u-1')).toEqual({ name: 'profile', userId: 'u-1' });
  });

  it('sends unknown paths to the Harbour', () => {
    expect(parseRoute('/nowhere')).toEqual({ name: 'harbour' });
    expect(parseRoute('/room/')).toEqual({ name: 'harbour' });
  });
});

describe('createRouter', () => {
  it('starts on the address bar and follows navigate', () => {
    history.replaceState(null, '', '/room/QWER');
    const router = createRouter();
    expect(router.route()).toEqual({ name: 'room', code: 'QWER' });

    const seen = vi.fn();
    router.subscribe(seen);
    router.navigate('/');
    expect(location.pathname).toBe('/');
    expect(router.route()).toEqual({ name: 'harbour' });
    expect(seen).toHaveBeenCalledTimes(1);
    router.dispose();
  });

  it('keeps the same route object until the path changes', () => {
    const router = createRouter();
    const first = router.route();
    router.navigate('/');
    expect(router.route()).toBe(first);
    router.dispose();
  });

  it('follows the back button', () => {
    const router = createRouter();
    router.navigate('/room/AAAA');
    history.replaceState(null, '', '/');
    dispatchEvent(new PopStateEvent('popstate'));
    expect(router.route()).toEqual({ name: 'harbour' });
    router.dispose();
  });

  it('replace swaps the entry instead of adding one', () => {
    const router = createRouter();
    const before = history.length;
    router.navigate('/room/AAAA', { replace: true });
    expect(history.length).toBe(before);
    expect(router.route()).toEqual({ name: 'room', code: 'AAAA' });
    router.dispose();
  });

  it('stays put while blocked, also on the back button', () => {
    const router = createRouter();
    router.navigate('/room/AAAA');
    const unblock = router.block();
    router.navigate('/');
    expect(router.route()).toEqual({ name: 'room', code: 'AAAA' });

    history.replaceState(null, '', '/');
    dispatchEvent(new PopStateEvent('popstate'));
    expect(location.pathname).toBe('/room/AAAA');
    expect(router.route()).toEqual({ name: 'room', code: 'AAAA' });

    unblock();
    router.navigate('/');
    expect(router.route()).toEqual({ name: 'harbour' });
    router.dispose();
  });

  it('tells the screen holding it that the back button was pressed', () => {
    const router = createRouter();
    router.navigate('/room/AAAA');
    const onBack = vi.fn();
    const unblock = router.block(onBack);

    history.replaceState(null, '', '/');
    dispatchEvent(new PopStateEvent('popstate'));
    expect(onBack).toHaveBeenCalledOnce();
    expect(router.route()).toEqual({ name: 'room', code: 'AAAA' });

    unblock();
    history.replaceState(null, '', '/');
    dispatchEvent(new PopStateEvent('popstate'));
    expect(onBack).toHaveBeenCalledOnce();
    router.dispose();
  });

  it('force leaves even while blocked', () => {
    const router = createRouter();
    router.navigate('/room/AAAA');
    router.block();
    router.navigate('/', { force: true });
    expect(router.route()).toEqual({ name: 'harbour' });
    router.dispose();
  });
});
