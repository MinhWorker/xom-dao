import harbourDang from './harbour-dang.webp';
import harbourMaster from './harbour-master.webp';
import harbourNam from './harbour-nam.webp';
import harbourNight from './harbour-night.webp';

/** One picture the player can put on the Bến: a character or a backdrop. */
export interface HarbourArt {
  id: string;
  name: string;
  src: string;
  /** CSS `object-position` for a backdrop cropped to the screen. */
  position?: string;
}

type Arts = [HarbourArt, ...HarbourArt[]];

/** Standing characters (transparent, full body); the first is the default. Add new art here. */
export const CHARACTERS: Arts = [
  { id: 'quan-ben', name: 'Quản bến', src: harbourMaster },
  { id: 'dang', name: 'Đăng', src: harbourDang },
  { id: 'nam', name: 'Nam', src: harbourNam },
];

/** Backdrops (20:9 works best); the first is the default. Add new art here. */
export const BACKGROUNDS: Arts = [
  { id: 'ben-dem', name: 'Bến đêm', src: harbourNight, position: '50% 78%' },
];

/** The art with this id, or the list's first when there is none. */
export function pickArt(list: Arts, id: unknown): HarbourArt {
  return list.find((art) => art.id === id) ?? list[0];
}
