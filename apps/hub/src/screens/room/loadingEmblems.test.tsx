// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HUB_EMBLEM } from '../../islands.js';
import { Homeward } from '../homeward/Homeward.js';
import { homeward } from '../homeward/homeward.js';
import { MatchLoading } from './MatchLoading.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('the loading screens', () => {
  it("show the Game's own Emblem on the match loading screen, not its initial", () => {
    const emblem = '<svg viewBox="0 0 64 64" data-game="caro"><path fill="currentColor"/></svg>';
    act(() =>
      root.render(
        <MatchLoading gameName="Caro" emblem={emblem} seats={[]} meId="minh" leaving={false} />,
      ),
    );
    expect(host.querySelector('svg[data-game="caro"]')).not.toBeNull();
    expect(host.querySelector('h2')?.textContent).toBe('Caro');
    expect(
      host.querySelector('svg[data-game="caro"]')?.closest('[aria-hidden="true"]')?.textContent,
    ).toBe('');
  });

  it("show the Hub's Emblem on the way back to the Bến", () => {
    act(() => root.render(<Homeward />));
    act(() => {
      void homeward.run(() => new Promise(() => {}));
    });
    expect(host.innerHTML).toContain('id="hub-points"');
    expect(HUB_EMBLEM).toContain('id="hub-points"');
    expect(host.querySelector('svg.tabler-icon-anchor')).toBeNull();
  });
});
