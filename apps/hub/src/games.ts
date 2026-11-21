import type { GameManifest } from '@xomdao/sdk';

/** The art `tools/hub-assets` wrote for a Game (`dist/hub/hub.json`); URLs under `/games/<id>/hub/`. */
export interface GameArt {
  lobby: string;
  card: string;
  thumb: string;
  /** A short muted loop for the lobby background, when the Game has one. */
  loop?: string;
}

/** A Game the Hub ships: its manifest, its art and the version of its bundle (`dist/version.json`). */
export interface HubGame {
  manifest: GameManifest;
  art: GameArt;
  version: string;
}

const manifests = import.meta.glob<GameManifest>('../../../games/*/manifest.ts', {
  eager: true,
  import: 'default',
});
const versions = import.meta.glob<string>('../../../games/*/dist/version.json', {
  eager: true,
  import: 'version',
});

const arts = import.meta.glob<{ art: Pick<GameArt, 'lobby' | 'card' | 'thumb'>; loop?: string }>(
  '../../../games/*/dist/hub/hub.json',
  { eager: true, import: 'default' },
);

const folder = (path: string) => path.split('/')[4] ?? '';

const sibling = <T>(files: Record<string, T>, path: string) =>
  Object.entries(files).find(([file]) => folder(file) === folder(path))?.[1];

/** Every Game with a manifest, art and a built bundle; `wip` ones only outside production. */
export const GAMES: HubGame[] = Object.entries(manifests)
  .map(([path, manifest]) => {
    const hubJson = sibling(arts, path);
    return {
      manifest,
      art: hubJson && { ...hubJson.art, loop: hubJson.loop },
      version: sibling(versions, path) ?? '',
    };
  })
  .flatMap(({ manifest, art, version }) => (art && version ? [{ manifest, art, version }] : []))
  .filter(({ manifest }) => __SHOW_WIP__ || manifest.status === 'ready')
  .sort((a, b) => a.manifest.name.localeCompare(b.manifest.name, 'vi'));

export const gameById = (id: string) => GAMES.find((g) => g.manifest.id === id);
