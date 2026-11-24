/**
 * The 40 Tiles of the board, clockwise from Xuất phát, in the legacy Classic order. Land prices
 * are the legacy ones; what they cost to build and the rent they charge come from `Tuning`.
 */

/** The eight Colour sets, three Cities each. */
export type ColourSet =
  | 'than-chi'
  | 'cyan'
  | 'tim-lan'
  | 'tim-violet'
  | 'magenta'
  | 'xam-bac'
  | 'tim-man'
  | 'xanh-dau';

export type Tile =
  | { kind: 'start'; name: string }
  | { kind: 'city'; name: string; set: ColourSet; price: number }
  | { kind: 'station'; name: string }
  | { kind: 'utility'; name: string }
  | { kind: 'tax'; name: string; tax: 'income' | 'luxury' }
  | { kind: 'chance'; name: string }
  | { kind: 'chest'; name: string }
  | { kind: 'jail'; name: string }
  | { kind: 'airport'; name: string }
  | { kind: 'go-jail'; name: string };

export type LotTile = Extract<Tile, { kind: 'city' | 'station' | 'utility' }>;

const city = (name: string, set: ColourSet, price: number): Tile => ({
  kind: 'city',
  name,
  set,
  price,
});

export const BOARD: readonly Tile[] = [
  { kind: 'start', name: 'Xuất phát' },
  city('Phú Quốc', 'than-chi', 200),
  city('Lào Cai', 'than-chi', 150),
  city('Việt Trì', 'than-chi', 180),
  { kind: 'tax', name: 'Thuế thu nhập', tax: 'income' },
  { kind: 'station', name: 'Bến Bắc' },
  city('Hạ Long', 'cyan', 280),
  { kind: 'chance', name: 'Cơ hội' },
  city('Hải Phòng', 'cyan', 320),
  city('Hà Nội', 'cyan', 350),
  { kind: 'jail', name: 'Nhà tù' },
  city('Hải Dương', 'tim-lan', 220),
  { kind: 'utility', name: 'Điện lực' },
  city('Thái Bình', 'tim-lan', 260),
  city('Nam Định', 'tim-lan', 240),
  { kind: 'station', name: 'Bến Tây' },
  city('Thanh Hóa', 'tim-violet', 270),
  { kind: 'chest', name: 'Khí vận' },
  city('Vinh', 'tim-violet', 260),
  city('Hà Tĩnh', 'tim-violet', 170),
  { kind: 'airport', name: 'Sân bay' },
  city('Huế', 'magenta', 270),
  { kind: 'chance', name: 'Cơ hội' },
  city('Đà Nẵng', 'magenta', 300),
  city('Hội An', 'magenta', 250),
  { kind: 'station', name: 'Bến Nam' },
  city('Kon Tum', 'xam-bac', 140),
  city('Pleiku', 'xam-bac', 160),
  { kind: 'utility', name: 'Cấp nước' },
  city('Đà Lạt', 'xam-bac', 270),
  { kind: 'go-jail', name: 'Vào tù' },
  city('Nha Trang', 'tim-man', 280),
  city('Vũng Tàu', 'tim-man', 260),
  { kind: 'chest', name: 'Khí vận' },
  city('Biên Hòa', 'tim-man', 220),
  { kind: 'station', name: 'Bến Đông' },
  city('Tp. HCM', 'xanh-dau', 350),
  city('Cần Thơ', 'xanh-dau', 300),
  { kind: 'tax', name: 'Thuế xa xỉ', tax: 'luxury' },
  city('Cà Mau', 'xanh-dau', 180),
];

export const JAIL_TILE = BOARD.findIndex((t) => t.kind === 'jail');
export const AIRPORT_TILE = BOARD.findIndex((t) => t.kind === 'airport');

export const isLot = (tile: Tile | undefined): tile is LotTile =>
  tile?.kind === 'city' || tile?.kind === 'station' || tile?.kind === 'utility';

/** The Tiles of one Colour set. */
export const setTiles = (set: ColourSet) =>
  BOARD.flatMap((t, i) => (t.kind === 'city' && t.set === set ? [i] : []));

/** The Tiles of one kind (every station, both utilities). */
export const tilesOf = (kind: Tile['kind']) =>
  BOARD.flatMap((t, i) => (t.kind === kind ? [i] : []));
