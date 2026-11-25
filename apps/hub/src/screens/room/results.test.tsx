// @vitest-environment jsdom
import type { RoomState } from '@xomdao/shared/client';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Peek } from './Peek.js';
import { outcomeFor, Results } from './Results.js';

const played = vi.hoisted(() => [] as string[]);
vi.mock('../../sound/index.js', () => ({
  playSound: (name: string) => played.push(name),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  played.length = 0;
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const pointer = (type: string, pointerType: string) =>
  new PointerEvent(type, { bubbles: true, pointerType, pointerId: 1 });

describe('Peek', () => {
  function renderPeek() {
    const onPeek = vi.fn();
    act(() => root.render(<Peek onPeek={onPeek} />));
    const button = host.querySelector('button') as HTMLButtonElement;
    return { onPeek, button };
  }

  it('hides the HUD while a mouse hovers it', () => {
    const { onPeek, button } = renderPeek();
    act(() => button.dispatchEvent(pointer('pointerover', 'mouse')));
    expect(onPeek).toHaveBeenLastCalledWith(true);
    expect(button.dataset.active).toBe('true');
    act(() => button.dispatchEvent(pointer('pointerout', 'mouse')));
    expect(onPeek).toHaveBeenLastCalledWith(false);
    expect(button.dataset.active).toBeUndefined();
  });

  it('hides the HUD while a finger holds it, not on a touch passing over', () => {
    const { onPeek, button } = renderPeek();
    act(() => button.dispatchEvent(pointer('pointerover', 'touch')));
    expect(onPeek).not.toHaveBeenCalled();
    act(() => button.dispatchEvent(pointer('pointerdown', 'touch')));
    expect(onPeek).toHaveBeenLastCalledWith(true);
    act(() => button.dispatchEvent(pointer('pointerup', 'touch')));
    expect(onPeek).toHaveBeenLastCalledWith(false);
  });

  it('brings the HUD back when the browser cancels the touch', () => {
    const { onPeek, button } = renderPeek();
    act(() => button.dispatchEvent(pointer('pointerdown', 'touch')));
    act(() => button.dispatchEvent(pointer('pointercancel', 'touch')));
    expect(onPeek).toHaveBeenLastCalledWith(false);
  });

  it('hides the HUD while Space is held', () => {
    const { onPeek, button } = renderPeek();
    act(() => button.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })));
    expect(onPeek).toHaveBeenLastCalledWith(true);
    act(() => button.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true })));
    expect(onPeek).toHaveBeenLastCalledWith(false);
  });

  it('brings the HUD back when it goes away mid-peek', () => {
    const { onPeek, button } = renderPeek();
    act(() => button.dispatchEvent(pointer('pointerdown', 'touch')));
    act(() => root.render(null));
    expect(onPeek).toHaveBeenLastCalledWith(false);
  });
});

const room = {
  code: 'ABCD',
  gameId: 'caro',
  hostId: 'a',
  status: 'idle',
  seats: [
    { id: 'a', name: 'An' },
    { id: 'b', name: 'Bình' },
  ],
} as unknown as RoomState;

describe('outcomeFor', () => {
  it('tells a win, a loss and a draw apart', () => {
    const won = [
      { player: 'a', place: 1 },
      { player: 'b', place: 2 },
    ];
    expect(outcomeFor(won, 'a')).toBe('win');
    expect(outcomeFor(won, 'b')).toBe('lose');
    const tied = won.map((s) => ({ ...s, place: 1 }));
    expect(outcomeFor(tied, 'b')).toBe('draw');
    expect(outcomeFor(won, 'c')).toBeNull();
  });
});

describe('Results', () => {
  function renderResults(
    me: string,
    places: [number, number] | null,
    {
      seats = room.seats,
      canReplay = true,
    }: { seats?: RoomState['seats']; canReplay?: boolean } = {},
  ) {
    const result = places && [
      { player: 'a', place: places[0] },
      { player: 'b', place: places[1] },
    ];
    const onReplay = vi.fn();
    const onBack = vi.fn();
    act(() =>
      root.render(
        <Results
          room={{ ...room, seats }}
          names={
            new Map([
              ['a', 'An'],
              ['b', 'Bình'],
            ])
          }
          result={result}
          me={me}
          busy={false}
          canReplay={canReplay}
          onReplay={onReplay}
          onBack={onBack}
        />,
      ),
    );
    const text = (selector: string) => host.querySelector(selector)?.textContent ?? null;
    const button = (name: string) =>
      [...host.querySelectorAll('button')].find((b) => b.textContent === name);
    return { onReplay, onBack, text, button };
  }

  it('shows the winner a win, places first and lets the host play again', () => {
    const { text, button, onReplay } = renderResults('a', [1, 2]);
    expect(text('h2')).toBe('Thắng');
    expect([...host.querySelectorAll('li')].map((li) => li.textContent)).toEqual([
      '1AnThắng',
      '2Bình',
    ]);
    expect(played).toEqual(['win']);
    act(() => button('Chơi lại')?.click());
    expect(onReplay).toHaveBeenCalled();
  });

  it('shows the loser a loss and has a guest wait for the host', () => {
    const { text, button, onBack } = renderResults('b', [1, 2]);
    expect(text('h2')).toBe('Thua');
    expect(button('Chơi lại')).toBeUndefined();
    expect(host.textContent).toContain('Chờ chủ phòng');
    expect(played).toEqual(['lose']);
    act(() => button('Về phòng chờ')?.click());
    expect(onBack).toHaveBeenCalled();
  });

  it('shows a draw without a winner or a sound', () => {
    const { text } = renderResults('a', [1, 1]);
    expect(text('h2')).toBe('Hoà');
    expect(host.textContent).not.toContain('Thắng');
    expect(played).toEqual([]);
  });

  it('names a player who left and marks them gone', () => {
    const { text } = renderResults('a', [1, 2], { seats: [room.seats[0] ?? null, null] });
    expect(text('h2')).toBe('Thắng');
    expect([...host.querySelectorAll('li')].map((li) => li.textContent)).toEqual([
      '1AnThắng',
      '2BìnhĐã rời',
    ]);
  });

  it('keeps the host from playing again without enough players', () => {
    const { button } = renderResults('a', [1, 2], { canReplay: false });
    expect(button('Chơi lại')?.disabled).toBe(true);
  });

  it('says an aborted Match has no result', () => {
    const { text } = renderResults('a', null);
    expect(text('h2')).toBeNull();
    expect(host.textContent).toContain('Ván đã huỷ');
  });
});
