import type { AnyManifest, Island } from '@xomdao/sdk';
import type { HubGame, SoonGame } from '../../games.js';

/** One card on the Sea chart. `game` is set when the Game can be played. */
export interface ChartCard {
  id: string;
  name: string;
  manifest: AnyManifest;
  emblem: string;
  game?: HubGame;
  /** The screen's art while the card is focused. */
  splash: string;
  /** The art inside the card, if the Game has its own. */
  picture?: string;
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'vi');

/** An Island's cards: its playable Games, then its Games to come (with the Island's art), each by name. */
export function islandCards(
  island: Island,
  games: HubGame[],
  soon: SoonGame[],
  islandArt: string,
): ChartCard[] {
  const made = games
    .filter((g) => g.manifest.island === island)
    .map((game) => ({
      id: game.manifest.id,
      name: game.manifest.name,
      manifest: game.manifest,
      emblem: game.emblem,
      game,
      splash: game.art.lobby,
      picture: game.art.card,
    }));
  const later = soon
    .filter((s) => s.manifest.island === island)
    .map(({ manifest, emblem }) => ({
      id: manifest.id,
      name: manifest.name,
      manifest,
      emblem,
      splash: islandArt,
    }));
  return [...made.sort(byName), ...later.sort(byName)];
}
