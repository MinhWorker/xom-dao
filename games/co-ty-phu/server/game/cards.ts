/**
 * The Cơ hội and Khí vận decks. A Card does one thing (`CardAction`) when drawn; the jail-free
 * Card is kept instead. Some Cards ask the drawer to pick: one of two offers (the first is the
 * safe one), a Lot or a player. Card amounts are tuned here; Effect lengths and the Quiz's
 * rewards are in tuning.ts. Applying a Card is CoTyPhuGame.ts.
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

export const CARDS = {
  'chance-jail': {
    deck: 'chance',
    name: 'Vé ra tù',
    text: 'Giữ lại, dùng khi ở tù.',
    action: { kind: 'jail-free' },
  },
  'chance-interest': {
    deck: 'chance',
    name: 'Lãi tiết kiệm',
    text: 'Nhận 10% tiền mặt.',
    action: { kind: 'cash-share', share: 0.1 },
  },
  'chance-upkeep': {
    deck: 'chance',
    name: 'Phí bảo trì',
    text: 'Trả 25 cho mỗi ô đất.',
    action: { kind: 'per-lot', amount: -25 },
  },
  'chance-repairs': {
    deck: 'chance',
    name: 'Sửa nhà',
    text: 'Trả 20 cho mỗi cấp nhà.',
    action: { kind: 'per-level', amount: -20 },
  },
  'chance-charity': {
    deck: 'chance',
    name: 'Từ thiện',
    text: 'Người giàu nhất đưa người nghèo nhất 150.',
    action: { kind: 'rich-to-poor', amount: 150 },
  },
  'chance-hotel-tax': {
    deck: 'chance',
    name: 'Thuế Khách sạn',
    text: 'Người có nhiều Khách sạn nhất nộp 100 cho mỗi Khách sạn.',
    action: { kind: 'hotel-tax', amount: 100 },
  },
  'chance-bonus': {
    deck: 'chance',
    name: 'Thưởng nóng',
    text: 'Nhận 150, hoặc gieo thêm một lần.',
    action: { kind: 'cash-or-roll', amount: 150 },
  },
  'chance-quiz': {
    deck: 'chance',
    name: 'Đố',
    text: 'Nhận tiền ngay, hoặc giải đố để nhận gấp bốn.',
    action: { kind: 'quiz' },
  },
  'chance-festival': {
    deck: 'chance',
    name: 'Lễ hội',
    text: 'Chọn một ô đất của bạn: tiền thuê gấp đôi tới Lễ hội sau.',
    action: { kind: 'festival' },
  },
  'chance-blackout': {
    deck: 'chance',
    name: 'Mất điện',
    text: 'Chọn một ô đất của người khác: không thu tiền thuê tới lượt sau của bạn.',
    action: { kind: 'blackout' },
  },
  'chance-planning': {
    deck: 'chance',
    name: 'Quy hoạch',
    text: 'Chọn một thành phố của bạn: nâng một cấp miễn phí.',
    action: { kind: 'planning' },
  },
  'chance-station': {
    deck: 'chance',
    name: 'Về bến',
    text: 'Đi tới bến xe gần nhất.',
    action: { kind: 'nearest', tile: 'station' },
  },
  'chance-swap': {
    deck: 'chance',
    name: 'Đổi chỗ',
    text: 'Chọn một người để đổi chỗ.',
    action: { kind: 'swap' },
  },
  'chance-back': {
    deck: 'chance',
    name: 'Quên đồ',
    text: 'Lùi 3 ô.',
    action: { kind: 'back', steps: 3 },
  },
  'chance-lucky': {
    deck: 'chance',
    name: 'Thần tài',
    text: 'Thu tiền thuê gấp đôi.',
    action: { kind: 'effect', effect: 'lucky' },
  },
  'chance-traffic': {
    deck: 'chance',
    name: 'Kẹt xe',
    text: 'Chỉ gieo một xúc xắc.',
    action: { kind: 'effect', effect: 'traffic' },
  },
  'chest-jail': {
    deck: 'chest',
    name: 'Vé ra tù',
    text: 'Giữ lại, dùng khi ở tù.',
    action: { kind: 'jail-free' },
  },
  'chest-quiz': {
    deck: 'chest',
    name: 'Đố',
    text: 'Nhận tiền ngay, hoặc giải đố để nhận gấp bốn.',
    action: { kind: 'quiz' },
  },
  'chest-harvest': {
    deck: 'chest',
    name: 'Được mùa',
    text: 'Nhận 30 cho mỗi ô đất.',
    action: { kind: 'per-lot', amount: 30 },
  },
  'chest-wallet': {
    deck: 'chest',
    name: 'Mất ví',
    text: 'Mất 10% tiền mặt.',
    action: { kind: 'cash-share', share: -0.1 },
  },
  'chest-tourism': {
    deck: 'chest',
    name: 'Du lịch',
    text: 'Nhận 15 cho mỗi cấp nhà.',
    action: { kind: 'per-level', amount: 15 },
  },
  'chest-share': {
    deck: 'chest',
    name: 'San sẻ',
    text: 'Người giàu nhất đưa người nghèo nhất 100.',
    action: { kind: 'rich-to-poor', amount: 100 },
  },
  'chest-gift': {
    deck: 'chest',
    name: 'Quà quê',
    text: 'Nhận 250, hoặc về Xuất phát.',
    action: { kind: 'cash-or-start', amount: 250 },
  },
  'chest-festival': {
    deck: 'chest',
    name: 'Lễ hội',
    text: 'Chọn một ô đất của bạn: tiền thuê gấp đôi tới Lễ hội sau.',
    action: { kind: 'festival' },
  },
  'chest-planning': {
    deck: 'chest',
    name: 'Quy hoạch',
    text: 'Chọn một thành phố của bạn: nâng một cấp miễn phí.',
    action: { kind: 'planning' },
  },
  'chest-utility': {
    deck: 'chest',
    name: 'Đóng tiền điện nước',
    text: 'Đi tới Điện lực hoặc Cấp nước gần nhất.',
    action: { kind: 'nearest', tile: 'utility' },
  },
  'chest-start': {
    deck: 'chest',
    name: 'Về quê',
    text: 'Đi tới Xuất phát.',
    action: { kind: 'go', to: 'start' },
  },
  'chest-jailed': {
    deck: 'chest',
    name: 'Bị bắt',
    text: 'Vào tù ngay.',
    action: { kind: 'go', to: 'jail' },
  },
  'chest-exempt': {
    deck: 'chest',
    name: 'Miễn thuê',
    text: 'Lần trả tiền thuê tới được miễn.',
    action: { kind: 'effect', effect: 'exempt' },
  },
  'chest-sick': {
    deck: 'chest',
    name: 'Ốm',
    text: 'Bỏ lượt tới.',
    action: { kind: 'effect', effect: 'sick' },
  },
  'chest-startup': {
    deck: 'chest',
    name: 'Khởi nghiệp',
    text: 'Nâng cấp nhà giảm nửa giá.',
    action: { kind: 'effect', effect: 'startup' },
  },
  'chest-traffic': {
    deck: 'chest',
    name: 'Kẹt xe',
    text: 'Chỉ gieo một xúc xắc.',
    action: { kind: 'effect', effect: 'traffic' },
  },
} as const satisfies Record<string, Card>;

export type CardId = keyof typeof CARDS;

export const cardOf = (id: CardId): Card => CARDS[id];

/** The jail-free Card of each deck. */
export const JAIL_CARD = { chance: 'chance-jail', chest: 'chest-jail' } as const satisfies Record<
  Deck,
  CardId
>;

/** Every Card of `deck`, in the order above. */
export const deckOf = (deck: Deck) =>
  (Object.keys(CARDS) as CardId[]).filter((id) => CARDS[id].deck === deck);

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
