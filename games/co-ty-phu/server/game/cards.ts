/**
 * The Cơ hội and Khí vận decks. A Card does one thing (`CardAction`) when drawn; the jail-free
 * Card is kept instead. Some Cards ask the drawer to pick: one of two offers (the first is the
 * safe one), a Lot or a player. Every number on a Card, and in its text, comes from
 * `Tuning.cards` and the rest of tuning.ts. Applying a Card is CoTyPhuGame.ts.
 */
import { BOARD, tilesOf } from './board.js';
import { rent } from './economy.js';
import { type Deck, type EffectId, HOTEL, type State } from './model.js';
import type { Tuning } from './tuning.js';

export type CardAction =
  | { kind: 'jail-free' }
  /** Gets (or, below 0, loses) this share of the drawer's cash. */
  | { kind: 'cash-share'; share: number }
  /** Gets (or pays) this much per Lot the drawer owns. */
  | { kind: 'per-lot'; amount: number }
  /** Gets (or pays) this much per Level the drawer has built. */
  | { kind: 'per-level'; amount: number }
  /** The richest player pays the poorest. */
  | { kind: 'rich-to-poor'; amount: number }
  /** Whoever has the most Hotels pays the bank this much per Hotel. */
  | { kind: 'hotel-tax'; amount: number }
  /** Pick: take `amount`, or roll and move once more. */
  | { kind: 'cash-or-roll'; amount: number }
  /** Pick: take `amount`, or go to Xuất phát. */
  | { kind: 'cash-or-start'; amount: number }
  /** Pick: take the safe reward, or try a Quiz. */
  | { kind: 'quiz' }
  /** Pick a Lot of yours: it holds the Festival. */
  | { kind: 'festival' }
  /** Pick someone else's Lot: it charges no rent until your next turn. */
  | { kind: 'blackout' }
  /** Pick a City of yours: it gets a Level for free. */
  | { kind: 'planning' }
  /** Walks to the nearest Tile of this kind ahead. */
  | { kind: 'nearest'; tile: 'station' | 'utility' }
  /** Pick a player: you swap places, and neither lands. */
  | { kind: 'swap' }
  | { kind: 'back'; steps: number }
  | { kind: 'go'; to: 'start' | 'jail' }
  | { kind: 'effect'; effect: EffectId };

export interface Card {
  deck: Deck;
  name: string;
  text: string;
  action: CardAction;
}

/** A Card before the numbers of a `Tuning` are put in. */
interface CardDef {
  deck: Deck;
  name: string;
  text: (t: Tuning) => string;
  action: (t: Tuning) => CardAction;
}

const money = (n: number) => n.toLocaleString('vi-VN');
const percent = (share: number) => `${Math.round(share * 100)}%`;
const TIMES: Record<number, string> = { 2: 'gấp đôi', 3: 'gấp ba', 4: 'gấp bốn' };
const times = (n: number) => TIMES[n] ?? `gấp ${n} lần`;
const discount = (share: number) => (share === 0.5 ? 'giảm nửa giá' : `giảm ${percent(1 - share)}`);

/** A Card whose text and action do not depend on the numbers. */
const fixed = (deck: Deck, name: string, text: string, action: CardAction): CardDef => ({
  deck,
  name,
  text: () => text,
  action: () => action,
});

const festival = (deck: Deck): CardDef => ({
  deck,
  name: 'Lễ hội',
  text: (t) => `Chọn một ô đất của bạn: tiền thuê ${times(t.festivalRent)} tới Lễ hội sau.`,
  action: () => ({ kind: 'festival' }),
});
const quiz = (deck: Deck): CardDef => ({
  deck,
  name: 'Đố',
  text: (t) => `Nhận ${money(t.quiz.safe)}, hoặc giải đố để nhận ${times(t.quiz.times)}.`,
  action: () => ({ kind: 'quiz' }),
});
const planning = (deck: Deck) =>
  fixed(deck, 'Quy hoạch', 'Chọn một thành phố của bạn: nâng một cấp miễn phí.', {
    kind: 'planning',
  });
const jailFree = (deck: Deck) =>
  fixed(deck, 'Vé ra tù', 'Giữ lại, dùng khi ở tù.', { kind: 'jail-free' });
const traffic = (deck: Deck) =>
  fixed(deck, 'Kẹt xe', 'Chỉ gieo một xúc xắc.', { kind: 'effect', effect: 'traffic' });

const DEFS = {
  'chance-jail': jailFree('chance'),
  'chance-interest': {
    deck: 'chance',
    name: 'Lãi tiết kiệm',
    text: (t) => `Nhận ${percent(t.cards.interest)} tiền mặt.`,
    action: (t) => ({ kind: 'cash-share', share: t.cards.interest }),
  },
  'chance-upkeep': {
    deck: 'chance',
    name: 'Phí bảo trì',
    text: (t) => `Trả ${money(t.cards.upkeep)} cho mỗi ô đất.`,
    action: (t) => ({ kind: 'per-lot', amount: -t.cards.upkeep }),
  },
  'chance-repairs': {
    deck: 'chance',
    name: 'Sửa nhà',
    text: (t) => `Trả ${money(t.cards.repairs)} cho mỗi cấp nhà.`,
    action: (t) => ({ kind: 'per-level', amount: -t.cards.repairs }),
  },
  'chance-charity': {
    deck: 'chance',
    name: 'Từ thiện',
    text: (t) => `Người giàu nhất đưa người nghèo nhất ${money(t.cards.charity)}.`,
    action: (t) => ({ kind: 'rich-to-poor', amount: t.cards.charity }),
  },
  'chance-hotel-tax': {
    deck: 'chance',
    name: 'Thuế Khách sạn',
    text: (t) => `Người có nhiều Khách sạn nhất nộp ${money(t.cards.hotelTax)} cho mỗi Khách sạn.`,
    action: (t) => ({ kind: 'hotel-tax', amount: t.cards.hotelTax }),
  },
  'chance-bonus': {
    deck: 'chance',
    name: 'Thưởng nóng',
    text: (t) => `Nhận ${money(t.cards.bonus)}, hoặc gieo thêm một lần.`,
    action: (t) => ({ kind: 'cash-or-roll', amount: t.cards.bonus }),
  },
  'chance-quiz': quiz('chance'),
  'chance-festival': festival('chance'),
  'chance-blackout': fixed(
    'chance',
    'Mất điện',
    'Chọn một ô đất của người khác: không thu tiền thuê tới lượt sau của bạn.',
    { kind: 'blackout' },
  ),
  'chance-planning': planning('chance'),
  'chance-station': fixed('chance', 'Về bến', 'Đi tới bến xe gần nhất.', {
    kind: 'nearest',
    tile: 'station',
  }),
  'chance-swap': fixed('chance', 'Đổi chỗ', 'Chọn một người để đổi chỗ.', { kind: 'swap' }),
  'chance-back': {
    deck: 'chance',
    name: 'Quên đồ',
    text: (t) => `Lùi ${t.cards.back} ô.`,
    action: (t) => ({ kind: 'back', steps: t.cards.back }),
  },
  'chance-lucky': {
    deck: 'chance',
    name: 'Thần tài',
    text: (t) => `Thu tiền thuê ${times(t.luckyRent)}.`,
    action: () => ({ kind: 'effect', effect: 'lucky' }),
  },
  'chance-traffic': traffic('chance'),
  'chest-jail': jailFree('chest'),
  'chest-quiz': quiz('chest'),
  'chest-harvest': {
    deck: 'chest',
    name: 'Được mùa',
    text: (t) => `Nhận ${money(t.cards.harvest)} cho mỗi ô đất.`,
    action: (t) => ({ kind: 'per-lot', amount: t.cards.harvest }),
  },
  'chest-wallet': {
    deck: 'chest',
    name: 'Mất ví',
    text: (t) => `Mất ${percent(t.cards.wallet)} tiền mặt.`,
    action: (t) => ({ kind: 'cash-share', share: -t.cards.wallet }),
  },
  'chest-tourism': {
    deck: 'chest',
    name: 'Du lịch',
    text: (t) => `Nhận ${money(t.cards.tourism)} cho mỗi cấp nhà.`,
    action: (t) => ({ kind: 'per-level', amount: t.cards.tourism }),
  },
  'chest-share': {
    deck: 'chest',
    name: 'San sẻ',
    text: (t) => `Người giàu nhất đưa người nghèo nhất ${money(t.cards.share)}.`,
    action: (t) => ({ kind: 'rich-to-poor', amount: t.cards.share }),
  },
  'chest-gift': {
    deck: 'chest',
    name: 'Quà quê',
    text: (t) => `Nhận ${money(t.cards.gift)}, hoặc về Xuất phát.`,
    action: (t) => ({ kind: 'cash-or-start', amount: t.cards.gift }),
  },
  'chest-festival': festival('chest'),
  'chest-planning': planning('chest'),
  'chest-utility': fixed(
    'chest',
    'Đóng tiền điện nước',
    'Đi tới Điện lực hoặc Cấp nước gần nhất.',
    { kind: 'nearest', tile: 'utility' },
  ),
  'chest-start': fixed('chest', 'Về quê', 'Đi tới Xuất phát.', { kind: 'go', to: 'start' }),
  'chest-jailed': fixed('chest', 'Bị bắt', 'Vào tù ngay.', { kind: 'go', to: 'jail' }),
  'chest-exempt': fixed('chest', 'Miễn thuê', 'Lần trả tiền thuê tới được miễn.', {
    kind: 'effect',
    effect: 'exempt',
  }),
  'chest-sick': fixed('chest', 'Ốm', 'Bỏ lượt tới.', { kind: 'effect', effect: 'sick' }),
  'chest-startup': {
    deck: 'chest',
    name: 'Khởi nghiệp',
    text: (t) => `Nâng cấp nhà ${discount(t.startupCost)}.`,
    action: () => ({ kind: 'effect', effect: 'startup' }),
  },
  'chest-traffic': traffic('chest'),
} as const satisfies Record<string, CardDef>;

export type CardId = keyof typeof DEFS;

/** Card `id` with the numbers of `t`. */
export function cardOf(t: Tuning, id: CardId): Card {
  const def: CardDef = DEFS[id];
  return { deck: def.deck, name: def.name, text: def.text(t), action: def.action(t) };
}

/** The jail-free Card of each deck. */
export const JAIL_CARD = { chance: 'chance-jail', chest: 'chest-jail' } as const satisfies Record<
  Deck,
  CardId
>;

/** Every Card of `deck`, in the order above. */
export const deckOf = (deck: Deck) =>
  (Object.keys(DEFS) as CardId[]).filter((id) => DEFS[id].deck === deck);

/** What `seat` may pick for a Card that asks; an empty list means the Card does nothing. */
export function picksOf(state: State, seat: number, action: CardAction): number[] {
  const lots = (mine: boolean) =>
    state.lots.flatMap((l, tile) => (l && (l.owner === seat) === mine ? [tile] : []));
  switch (action.kind) {
    case 'cash-or-roll':
    case 'cash-or-start':
    case 'quiz':
      return [0, 1];
    case 'festival':
      return lots(true);
    case 'blackout':
      return lots(false);
    case 'planning':
      return lots(true).filter(
        (tile) => BOARD[tile]?.kind === 'city' && (state.lots[tile]?.level ?? HOTEL) < HOTEL,
      );
    case 'swap':
      return state.players.flatMap((p, s) => (s !== seat && !p.bankrupt && !p.jailed ? [s] : []));
    default:
      return [];
  }
}

/**
 * What a Card that asks is picked from: one of two offers (`offer`, the first being the safe one
 * a timeout takes), a Lot or a player (the computer's pick on a timeout).
 */
const ASKS: Partial<Record<CardAction['kind'], 'offer' | 'lot' | 'player'>> = {
  'cash-or-roll': 'offer',
  'cash-or-start': 'offer',
  quiz: 'offer',
  festival: 'lot',
  blackout: 'lot',
  planning: 'lot',
  swap: 'player',
};

/** Whether a Card asks the drawer to pick. */
export const asks = (action: CardAction) => ASKS[action.kind] !== undefined;

/** Whether a Card offers two choices, the first one safe. */
export const offers = (action: CardAction) => ASKS[action.kind] === 'offer';

/** The dice sum the computer prices a utility's rent with. */
export const AVERAGE_ROLL = 7;

/** The pick the computer makes, from `picks` (not empty). */
export function botPick(
  t: Tuning,
  state: State,
  action: CardAction,
  picks: readonly number[],
): number {
  const best = (score: (n: number) => number) =>
    picks.reduce((a, b) => (score(b) > score(a) ? b : a));
  const rentOf = (s: State, tile: number) => rent(t, s, tile, AVERAGE_ROLL);
  switch (action.kind) {
    case 'cash-or-start':
      return t.startBonus > action.amount ? 1 : 0;
    case 'quiz':
      return t.quiz.botRight * t.quiz.times > 1 ? 1 : 0;
    case 'festival':
    case 'blackout':
      return best((tile) => rentOf(state, tile));
    case 'planning':
      return best((tile) => {
        const lot = state.lots[tile];
        if (!lot) return 0;
        const up = {
          ...state,
          lots: state.lots.map((l, i) => (i === tile ? { ...lot, level: lot.level + 1 } : l)),
        };
        return rentOf(up, tile) - rentOf(state, tile);
      });
    case 'swap':
      return best((s) => state.players[s]?.tile ?? 0);
    default:
      return picks[0] as number;
  }
}

/** The Tile of `kind` nearest ahead of `from`. */
export function nearest(from: number, kind: 'station' | 'utility') {
  const tiles = tilesOf(kind);
  return tiles.find((tile) => tile > from) ?? (tiles[0] as number);
}
