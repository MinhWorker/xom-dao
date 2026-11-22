import type { Island } from '@xomdao/sdk';

/** A group of Games of one kind, as the Hub presents it. */
export interface HubIsland {
  id: Island;
  name: string;
}

const NAMES: Record<Island, string> = {
  co: 'Cờ',
  bai: 'Bài',
  'xuc-xac': 'Xúc Xắc',
  'nao-nhiet': 'Náo Nhiệt',
};

/** Every Island, in the order the Hub lists them. */
export const ISLANDS: HubIsland[] = (Object.keys(NAMES) as Island[]).map((id) => ({
  id,
  name: NAMES[id],
}));
