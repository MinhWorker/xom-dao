/**
 * What the decision panel offers: from a `View` and the viewer's seat, the title, the text and
 * the buttons, and which Tiles a tap on the board may pick. The other players see who is
 * deciding and no buttons (a Quiz shows them its question and answers).
 */
import { AIRPORT_TILE, BOARD } from '../server/game/board.js';
import { type CardAction, type CardId, cardOf, picksOf } from '../server/game/cards.js';
import { landPrice, takeoverPrice, upgradeCost } from '../server/game/economy.js';
import { HOTEL, JAIL_TRIES, type Player, type Sale, type View } from '../server/game/model.js';
import { levelValue, lotValue } from '../server/game/selling.js';
import { TUNING } from '../server/game/tuning.js';

export interface Button {
  label: string;
  event: string;
  payload?: Record<string, unknown>;
  disabled?: boolean;
}

/** Tiles a tap on the board may pick, and what that sends. */
export interface Pick {
  tiles: number[];
  event: string;
  payload: (tile: number) => Record<string, unknown>;
}

export interface Panel {
  title: string;
  text?: string;
  buttons: Button[];
  pick?: Pick;
  /** The Card the decision is about: its buttons show as cards to tap. */
  card?: CardId;
}

/** How players read a City's Level: "2 nhà", or Khách sạn. */
export const levelName = (level: number) => (level >= HOTEL ? 'Khách sạn' : `${level} nhà`);

const t = TUNING;
export const money = (n: number) => n.toLocaleString('vi-VN');
const take = (a: CardAction) => `Nhận ${money('amount' in a ? a.amount : 0)}`;

/** The two choices of a Card that offers them, the safe one first. */
const OFFERS: Partial<Record<CardAction['kind'], (action: CardAction) => [string, string]>> = {
  'cash-or-roll': (a) => [take(a), 'Gieo thêm'],
  'cash-or-start': (a) => [take(a), 'Về Xuất phát'],
  quiz: () => [`Nhận ${money(t.quiz.safe)}`, 'Giải đố'],
};
const PASS: Button = { label: 'Bỏ qua', event: 'pass' };

/** The seat whose decision the view waits for: the debtor during a Debt, else the turn player. */
export const decider = (view: View) =>
  view.phase === 'debt' && view.debt ? view.debt.from : view.turn;

/** The event a tap on a Lot sends during a Debt: it changes the sale being chosen, never the server. */
export const CHOOSE_SALE = 'choose-sale';

/** What one part of a sale fetches: Levels off a City, or the whole Lot. */
export const partValue = (view: View, { tile, levels }: Sale) =>
  levels === undefined ? lotValue(t, view, tile) : levels * levelValue(t, tile);

/** What a tap on `tile` makes of its part of `sale`: one more Level off, then the whole Lot, then nothing. */
export function nextSale(view: View, sale: readonly Sale[], tile: number): Sale[] {
  const lot = view.lots[tile];
  const rest = sale.filter((s) => s.tile !== tile);
  if (!lot) return rest;
  const now = sale.find((s) => s.tile === tile);
  const off = now === undefined ? 0 : now.levels === undefined ? Infinity : now.levels;
  if (off === Infinity) return rest;
  if (off + 1 <= lot.level - 1) return [...rest, { tile, levels: off + 1 }];
  return [...rest, { tile }];
}

/** How a part of a sale reads on its Lot. */
export const partLabel = ({ levels }: Sale) =>
  levels === undefined ? 'Bán đất' : `Bớt ${levels} cấp`;

/** The decision of `view` for seat `me`; `sale` is what the debtor has picked to Sell so far. */
export function decide(
  view: View,
  me: number,
  names: readonly string[],
  sale: readonly Sale[] = [],
): Panel {
  const seat = decider(view);
  const mine = seat === me;
  const who = names[seat] ?? '';
  const player = view.players[seat] as Player;
  const here = BOARD[player.tile]?.name ?? '';
  /** The panel for the turn player, or for the others while they wait. */
  const ask = (
    title: string,
    watching: string,
    buttons: Button[],
    { pick, text }: { pick?: Pick; text?: string } = {},
  ): Panel => ({
    ...(mine
      ? { title, buttons, ...(pick && { pick }) }
      : { title: `${who} ${watching}`, buttons: [] }),
    ...(text && { text }),
  });
  const lot = view.lots[player.tile];

  switch (view.phase) {
    case 'quiz': {
      const quiz = view.quiz;
      if (!quiz) break;
      const answers = quiz.choices.map((choice, i) => ({
        label: money(choice),
        event: 'answer',
        payload: { choice: i },
        ...(!mine && { disabled: true }),
      }));
      return { title: mine ? 'Đố' : `${who} đang giải đố`, text: quiz.text, buttons: answers };
    }
    case 'debt': {
      const debt = view.debt;
      if (!debt) break;
      const to = debt.to === null ? 'ngân hàng' : (names[debt.to] ?? '');
      const short = Math.max(0, debt.amount - player.cash);
      const raised = sale.reduce((sum, part) => sum + partValue(view, part), 0);
      const lots = view.lots.flatMap((l, tile) => (l?.owner === seat ? [tile] : []));
      return ask(
        `Nợ ${to} ${money(debt.amount)}`,
        'đang bán đất trả nợ',
        [{ label: 'Bán', event: 'sell', payload: { sale: [...sale] }, disabled: raised < short }],
        {
          text: `Đã chọn ${money(raised)} / ${money(short)}`,
          pick: { tiles: lots, event: CHOOSE_SALE, payload: (tile) => ({ tile }) },
        },
      );
    }
    case 'buy':
      return ask(`Mua ${here}?`, `đang cân nhắc mua ${here}`, [
        { label: `Mua ${money(landPrice(t, player.tile))}`, event: 'buy' },
        PASS,
      ]);
    case 'upgrade': {
      const next = levelName((lot?.level ?? 0) + 1);
      return ask(`Nâng ${here} lên ${next}?`, `đang cân nhắc nâng ${here}`, [
        { label: `Nâng cấp ${money(upgradeCost(t, view, seat, player.tile))}`, event: 'upgrade' },
        PASS,
      ]);
    }
    case 'takeover': {
      const owner = names[lot?.owner ?? -1] ?? '';
      return ask(`Mua lại ${here} của ${owner}?`, `đang cân nhắc mua lại ${here}`, [
        { label: `Mua lại ${money(takeoverPrice(t, view, player.tile) ?? 0)}`, event: 'takeover' },
        PASS,
      ]);
    }
    case 'fly':
      return ask(
        `Bay tới ô nào? (${money(t.airportFee)})`,
        'đang chọn nơi bay tới',
        [{ label: 'Ở lại', event: 'pass' }],
        {
          pick: {
            tiles: BOARD.flatMap((_, i) => (i === AIRPORT_TILE ? [] : [i])),
            event: 'fly',
            payload: (to) => ({ to }),
          },
        },
      );
    case 'card': {
      if (!view.card) break;
      const card = cardOf(t, view.card.id);
      const { action } = card;
      const picks = picksOf(view, seat, action);
      const choose = (label: string, pick: number): Button => ({
        label,
        event: 'pick',
        payload: { pick },
      });
      const offer = OFFERS[action.kind]?.(action);
      const buttons = offer
        ? offer.map(choose)
        : action.kind === 'swap'
          ? picks.map((s) => choose(names[s] ?? '', s))
          : [];
      const pick: Pick | undefined =
        offer || action.kind === 'swap'
          ? undefined
          : { tiles: picks, event: 'pick', payload: (tile) => ({ pick: tile }) };
      return {
        ...ask(card.name, `rút thẻ ${card.name}`, buttons, {
          text: card.text,
          ...(pick && { pick }),
        }),
        card: view.card.id,
      };
    }
  }
  if (!player.jailed)
    return ask('Lượt của bạn', 'đang gieo', [{ label: 'Gieo xúc xắc', event: 'roll' }]);
  const buttons: Button[] = [{ label: 'Gieo ra đôi', event: 'roll' }];
  if (player.jailTries < JAIL_TRIES - 1) {
    buttons.push({
      label: `Trả ${money(t.jailFine)}`,
      event: 'pay-bail',
      ...(player.cash < t.jailFine && { disabled: true }),
    });
    if (player.jailCards > 0) buttons.push({ label: 'Dùng vé ra tù', event: 'use-card' });
  }
  return ask('Bạn đang ở tù', 'đang ở tù', buttons);
}
