import { describe, expect, it } from 'vitest';
import type { CardId } from '../server/game/cards.js';
import type { State } from '../server/game/model.js';
import { all, open, own, player, viewOf } from '../server/game/test-match.js';
import { decide, money } from './decisions.js';

/** `a` rolls onto Cơ hội (7) and draws `id`. */
const draw = (id: CardId, arrange = (s: State) => s) =>
  open({ rolls: [[3, 4]], chance: [id], arrange }).send('a', 'roll');

const NAMES = ['An', 'Bình'];

describe('the decision panel', () => {
  it('asks the turn player to roll and tells the others who is rolling', () => {
    const game = open();
    const mine = decide(viewOf(game, 'a'), 0, NAMES);
    expect(mine.buttons.map((b) => [b.label, b.event])).toEqual([['Gieo', 'roll']]);
    const theirs = decide(viewOf(game, 'b'), 1, NAMES);
    expect(theirs.buttons).toEqual([]);
    expect(theirs.title).toBe('An đang gieo');
  });

  it('offers bail and the jail-free Card before a roll in jail', () => {
    const game = open({ arrange: player(0, { tile: 10, jailed: true, jailCards: 1 }) });
    const panel = decide(viewOf(game, 'a'), 0, NAMES);
    expect(panel.title).toBe('Bạn đang ở tù');
    expect(panel.buttons.map((b) => [b.label, b.event])).toEqual([
      ['Gieo ra đôi', 'roll'],
      ['Trả 50', 'pay-bail'],
      ['Dùng vé ra tù', 'use-card'],
    ]);
  });

  it('offers only the roll on the last try in jail', () => {
    const game = open({ arrange: player(0, { tile: 10, jailed: true, jailTries: 2 }) });
    expect(decide(viewOf(game, 'a'), 0, NAMES).buttons.map((b) => b.event)).toEqual(['roll']);
  });

  it('offers to buy the Lot with its price', () => {
    const game = open({ rolls: [[1, 2]] }).send('a', 'roll');
    const panel = decide(viewOf(game, 'a'), 0, NAMES);
    expect(panel.title).toBe('Mua Việt Trì?');
    expect(panel.buttons.map((b) => [b.label, b.event])).toEqual([
      ['Mua 180', 'buy'],
      ['Bỏ qua', 'pass'],
    ]);
    expect(decide(viewOf(game, 'b'), 1, NAMES).title).toBe('An đang cân nhắc mua Việt Trì');
  });

  it('offers the next Level with what it costs', () => {
    const game = open({ rolls: [[1, 2]], arrange: own(0, [3], 1) }).send('a', 'roll');
    const panel = decide(viewOf(game, 'a'), 0, NAMES);
    expect(panel.title).toBe('Nâng Việt Trì lên 2 nhà?');
    expect(panel.buttons.map((b) => [b.label, b.event])).toEqual([
      ['Nâng cấp 90', 'upgrade'],
      ['Bỏ qua', 'pass'],
    ]);
  });

  it('calls Level 5 a Hotel', () => {
    const game = open({ rolls: [[1, 2]], arrange: own(0, [3], 4) }).send('a', 'roll');
    expect(decide(viewOf(game, 'a'), 0, NAMES).title).toBe('Nâng Việt Trì lên Khách sạn?');
  });

  it('offers the Takeover at its price after the rent', () => {
    const game = open({ rolls: [[1, 2]], arrange: own(1, [3], 1) }).send('a', 'roll');
    const panel = decide(viewOf(game, 'a'), 0, NAMES);
    expect(panel.title).toBe('Mua lại Việt Trì của Bình?');
    expect(panel.buttons.map((b) => [b.label, b.event])).toEqual([
      ['Mua lại 270', 'takeover'],
      ['Bỏ qua', 'pass'],
    ]);
  });

  it('lets the player at Sân bay pick any other Tile to fly to', () => {
    const game = open({ rolls: [[1, 2]], arrange: player(0, { tile: 17 }) }).send('a', 'roll');
    const panel = decide(viewOf(game, 'a'), 0, NAMES);
    expect(panel.title).toBe('Bay tới ô nào? (100)');
    expect(panel.buttons.map((b) => [b.label, b.event])).toEqual([['Ở lại', 'pass']]);
    expect(panel.pick?.event).toBe('fly');
    expect(panel.pick?.tiles).toHaveLength(39);
    expect(panel.pick?.tiles).not.toContain(20);
    expect(panel.pick?.payload(5)).toEqual({ to: 5 });
    expect(decide(viewOf(game, 'b'), 1, NAMES).pick).toBeUndefined();
  });

  it('shows a Card that offers two things with both, the safe one first', () => {
    const game = draw('chance-bonus');
    const panel = decide(viewOf(game, 'a'), 0, NAMES);
    expect(panel.title).toBe('Thưởng nóng');
    expect(panel.text).toBe('Nhận 150, hoặc gieo thêm một lần.');
    expect(panel.buttons.map((b) => [b.label, b.event, b.payload])).toEqual([
      ['Nhận 150', 'pick', { pick: 0 }],
      ['Gieo thêm', 'pick', { pick: 1 }],
    ]);
    const theirs = decide(viewOf(game, 'b'), 1, NAMES);
    expect([theirs.title, theirs.text, theirs.buttons]).toEqual([
      'An rút thẻ Thưởng nóng',
      'Nhận 150, hoặc gieo thêm một lần.',
      [],
    ]);
  });

  it('names the Quiz choice', () => {
    const labels = decide(viewOf(draw('chance-quiz'), 'a'), 0, NAMES).buttons.map((b) => b.label);
    expect(labels).toEqual(['Nhận 100', 'Giải đố']);
  });

  it('lets the drawer pick one of their Lots on the board for a Festival', () => {
    const game = draw('chance-festival', all(own(0, [3, 5]), own(1, [6])));
    const panel = decide(viewOf(game, 'a'), 0, NAMES);
    expect(panel.buttons).toEqual([]);
    expect(panel.pick?.tiles).toEqual([3, 5]);
    expect(panel.pick?.event).toBe('pick');
    expect(panel.pick?.payload(5)).toEqual({ pick: 5 });
  });

  it('lists the players to swap places with', () => {
    const game = draw('chance-swap');
    expect(decide(viewOf(game, 'a'), 0, NAMES).buttons).toEqual([
      { label: 'Bình', event: 'pick', payload: { pick: 1 } },
    ]);
  });

  it('gives the Quiz four big answers to its drawer and shows them to the others', () => {
    const game = draw('chance-quiz').send('a', 'pick', { pick: 1 });
    const quiz = viewOf(game, 'a').quiz;
    const panel = decide(viewOf(game, 'a'), 0, NAMES);
    expect(panel.title).toBe('Đố');
    expect(panel.text).toBe(quiz?.text);
    expect(panel.buttons.map((b) => [b.label, b.payload])).toEqual(
      quiz?.choices.map((c, i) => [money(c), { choice: i }]),
    );
    const theirs = decide(viewOf(game, 'b'), 1, NAMES);
    expect(theirs.title).toBe('An đang giải đố');
    expect(theirs.text).toBe(quiz?.text);
    expect(theirs.buttons.every((b) => b.disabled)).toBe(true);
  });

  it('shows the Debt and the suggested sale, sold with one tap', () => {
    const game = open({
      rolls: [[1, 2]],
      arrange: all(own(1, [3], 1), own(0, [6], 2), player(0, { cash: 10 })),
    }).send('a', 'roll');
    const panel = decide(viewOf(game, 'a'), 0, NAMES);
    expect(panel.title).toBe('Nợ Bình 72');
    expect(panel.text).toBe('Gợi ý: Hạ Long bớt 1 cấp (+70)');
    expect(panel.buttons).toEqual([
      { label: 'Bán theo gợi ý', event: 'sell', payload: { sale: [{ tile: 6, levels: 1 }] } },
    ]);
    expect(decide(viewOf(game, 'b'), 1, NAMES).title).toBe('An đang bán đất trả nợ');
  });
});
