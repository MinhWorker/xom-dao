/**
 * Things a player can own (Túi đồ) and buy at Chợ. The live list is the server's `items` table,
 * edited from the console (/console/items); `SEED_ITEMS` is what that table started with (and
 * what a server without a database uses). Ids are namespaced (`core:` for the platform's own; a
 * game or event adds `<id>:…`). Avatar, frame and card-back items change a player's appearance;
 * emote items are sent in a room and drawn by the game's table.
 *
 * Free items (price 0) belong to everyone and are never stored. Never reuse or rename an id,
 * since inventories keep them. An item's `look` must be one the client has art for
 * (`ITEM_LOOKS`).
 */
import { z } from 'zod';
import {
  AVATARS,
  type Avatar,
  DEFAULT_AVATAR,
  DEFAULT_FRAME,
  FRAMES,
  type Frame,
  STARTER_AVATARS,
} from './account.js';

/** The kind of item: an appearance slot or a room emote. */
export const ITEM_SLOTS = ['avatar', 'frame', 'card-back', 'emote'] as const;
export type ItemSlot = (typeof ITEM_SLOTS)[number];

/** Card backs (`card-back-<id>.webp` in the client's SDK). */
export const CARD_BACKS = ['lattice', 'lotus'] as const;
export type CardBack = (typeof CARD_BACKS)[number];
export const DEFAULT_CARD_BACK: CardBack = 'lattice';

export interface ItemDef {
  id: string;
  slot: ItemSlot;
  /** Its look id: an `Avatar`, `Frame`, `CardBack`, or emote id. */
  look: string;
  /** Shown at Chợ and in Túi đồ. */
  name: string;
  /** In `core:coin`; 0 = everyone has it. */
  price: number;
}

const FRAME_ITEMS: Record<Frame, { name: string; price: number }> = {
  gold: { name: 'Khung vàng', price: 0 },
  silver: { name: 'Khung bạc', price: 0 },
  bronze: { name: 'Khung đồng', price: 0 },
  jade: { name: 'Khung ngọc bích', price: 180 },
  sapphire: { name: 'Khung lam ngọc', price: 270 },
  ruby: { name: 'Khung hồng ngọc', price: 360 },
  amethyst: { name: 'Khung thạch anh tím', price: 360 },
  rose: { name: 'Khung hoa hồng', price: 540 },
  coral: { name: 'Khung san hô', price: 360 },
  turquoise: { name: 'Khung ngọc biển', price: 360 },
  obsidian: { name: 'Khung hắc diện', price: 450 },
};

const BACK_ITEMS: Record<CardBack, { name: string; price: number }> = {
  lattice: { name: 'Lưng bài ô trám', price: 0 },
  lotus: { name: 'Lưng bài hoa sen', price: 270 },
};

const AVATAR_ITEMS: Record<Avatar, { name: string; price: number }> = {
  boy: { name: 'Ảnh bé trai', price: 0 },
  girl: { name: 'Ảnh bé gái', price: 0 },
  long: { name: 'Ảnh Long', price: 120 },
  cat: { name: 'Ảnh mèo', price: 0 },
  dog: { name: 'Ảnh chó', price: 120 },
  fox: { name: 'Ảnh cáo', price: 150 },
  panda: { name: 'Ảnh gấu trúc', price: 150 },
  frog: { name: 'Ảnh ếch', price: 120 },
  tiger: { name: 'Ảnh hổ', price: 150 },
  rabbit: { name: 'Ảnh thỏ', price: 120 },
  bear: { name: 'Ảnh gấu nâu', price: 120 },
  koala: { name: 'Ảnh gấu koala', price: 150 },
  monkey: { name: 'Ảnh khỉ', price: 120 },
  pig: { name: 'Ảnh heo', price: 120 },
  hamster: { name: 'Ảnh chuột hamster', price: 120 },
  lion: { name: 'Ảnh sư tử', price: 150 },
  unicorn: { name: 'Ảnh kỳ lân', price: 180 },
  penguin: { name: 'Ảnh chim cánh cụt', price: 120 },
  owl: { name: 'Ảnh cú mèo', price: 120 },
  chick: { name: 'Ảnh gà con', price: 120 },
  octopus: { name: 'Ảnh bạch tuộc', price: 150 },
  alien: { name: 'Ảnh người ngoài hành tinh', price: 180 },
  ghost: { name: 'Ảnh ma nhỏ', price: 150 },
};

const STARTER_AVATAR_SET: ReadonlySet<string> = new Set(STARTER_AVATARS);

/** Shared room emotes. `look` is the id passed through `emote:send` and drawn by the game. */
export const EMOTES = [
  { look: 'happy', name: 'Vui vẻ', price: 0 },
  { look: 'love', name: 'Thương mến', price: 80 },
  { look: 'wow', name: 'Ngạc nhiên', price: 80 },
  { look: 'sad', name: 'Buồn bã', price: 80 },
  { look: 'angry', name: 'Bực mình', price: 100 },
  { look: 'laugh', name: 'Cười lớn', price: 80 },
] as const;

/** The items the shop started with (migration `0008_items` and the memory store). */
export const SEED_ITEMS: readonly ItemDef[] = [
  ...AVATARS.map((look) => ({
    id: `core:avatar-${look}`,
    slot: 'avatar' as const,
    look,
    ...AVATAR_ITEMS[look],
    price: STARTER_AVATAR_SET.has(look) ? 0 : AVATAR_ITEMS[look].price,
  })),
  ...FRAMES.map((look) => ({
    id: `core:frame-${look}`,
    slot: 'frame' as const,
    look,
    ...FRAME_ITEMS[look],
  })),
  ...CARD_BACKS.map((look) => ({
    id: `core:card-back-${look}`,
    slot: 'card-back' as const,
    look,
    ...BACK_ITEMS[look],
  })),
  ...EMOTES.map(({ look, ...item }) => ({
    id: `core:emote-${look}`,
    slot: 'emote' as const,
    look,
    ...item,
  })),
];

/** The looks the client has art for, per slot: an item can only give one of these. */
export const ITEM_LOOKS: Record<ItemSlot, readonly string[]> = {
  avatar: AVATARS,
  frame: FRAMES,
  'card-back': CARD_BACKS,
  emote: EMOTES.map((emote) => emote.look),
};

/** A new item, as the console sends it. */
export const itemSchema = z
  .object({
    id: z
      .string()
      .trim()
      .regex(/^[a-z0-9-]+:[a-z0-9-]+$/, 'Mã món dạng <nhóm>:<tên>, chỉ chữ thường, số và -'),
    slot: z.enum(ITEM_SLOTS, 'Loại món không hợp lệ'),
    look: z.string(),
    name: z.string().trim().min(1, 'Bạn cần nhập tên món').max(40, 'Tên món tối đa 40 ký tự'),
    price: z
      .number('Giá phải là số')
      .int('Giá phải là số nguyên')
      .min(0, 'Giá không được âm')
      .max(1_000_000, 'Giá tối đa 1.000.000 xu'),
  })
  .refine((item) => ITEM_LOOKS[item.slot].includes(item.look), {
    message: 'Hình này không có cho loại món đã chọn',
    path: ['look'],
  });

/** What the console may change on an item (its id never changes). */
export const itemChangeSchema = z.object({
  slot: z.enum(ITEM_SLOTS, 'Loại món không hợp lệ').optional(),
  look: z.string().optional(),
  name: z
    .string()
    .trim()
    .min(1, 'Bạn cần nhập tên món')
    .max(40, 'Tên món tối đa 40 ký tự')
    .optional(),
  price: z
    .number('Giá phải là số')
    .int('Giá phải là số nguyên')
    .min(0, 'Giá không được âm')
    .max(1_000_000, 'Giá tối đa 1.000.000 xu')
    .optional(),
});

/** The look each slot has before anything is equipped. */
export const DEFAULT_LOOKS: Record<Exclude<ItemSlot, 'emote'>, string> = {
  avatar: DEFAULT_AVATAR,
  frame: DEFAULT_FRAME,
  'card-back': DEFAULT_CARD_BACK,
};
