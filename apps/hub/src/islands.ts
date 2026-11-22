import type { Island } from '@xomdao/sdk';
import bai from './emblems/bai.svg?raw';
import co from './emblems/co.svg?raw';
import naoNhiet from './emblems/nao-nhiet.svg?raw';
import xucXac from './emblems/xuc-xac.svg?raw';
import baiArt from './island-art/bai.png?url';
import coArt from './island-art/co.png?url';
import naoNhietArt from './island-art/nao-nhiet.png?url';
import xucXacArt from './island-art/xuc-xac.png?url';

export { default as HUB_EMBLEM } from './emblems/hub.svg?raw';

/** A group of Games of one kind, as the Hub presents it. */
export interface HubIsland {
  id: Island;
  name: string;
  /** One-colour SVG markup painted with `currentColor`, inlined by the Hub. */
  emblem: string;
  /** The Island's splash art (20:9), behind its Games to come on the Sea chart. */
  art: string;
}

const ISLAND_INFO: Record<Island, Omit<HubIsland, 'id'>> = {
  co: { name: 'Cờ', emblem: co, art: coArt },
  bai: { name: 'Bài', emblem: bai, art: baiArt },
  'xuc-xac': { name: 'Xúc Xắc', emblem: xucXac, art: xucXacArt },
  'nao-nhiet': { name: 'Náo Nhiệt', emblem: naoNhiet, art: naoNhietArt },
};

/** Every Island, in the order the Hub lists them. */
export const ISLANDS: HubIsland[] = (Object.keys(ISLAND_INFO) as Island[]).map((id) => ({
  id,
  ...ISLAND_INFO[id],
}));
