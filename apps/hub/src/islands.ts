import type { Island } from '@xomdao/sdk';
import bai from './emblems/bai.svg?raw';
import co from './emblems/co.svg?raw';
import naoNhiet from './emblems/nao-nhiet.svg?raw';
import xucXac from './emblems/xuc-xac.svg?raw';

export { default as HUB_EMBLEM } from './emblems/hub.svg?raw';

/** A group of Games of one kind, as the Hub presents it. */
export interface HubIsland {
  id: Island;
  name: string;
  /** One-colour SVG markup painted with `currentColor`, inlined by the Hub. */
  emblem: string;
}

const ISLAND_INFO: Record<Island, { name: string; emblem: string }> = {
  co: { name: 'Cờ', emblem: co },
  bai: { name: 'Bài', emblem: bai },
  'xuc-xac': { name: 'Xúc Xắc', emblem: xucXac },
  'nao-nhiet': { name: 'Náo Nhiệt', emblem: naoNhiet },
};

/** Every Island, in the order the Hub lists them. */
export const ISLANDS: HubIsland[] = (Object.keys(ISLAND_INFO) as Island[]).map((id) => ({
  id,
  ...ISLAND_INFO[id],
}));
