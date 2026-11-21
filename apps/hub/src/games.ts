import type { GameManifest } from '@xomdao/sdk';

/** A Game the Hub ships: its manifest and the version of its bundle (`dist/version.json`). */
export interface HubGame {
  manifest: GameManifest;
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

const folder = (path: string) => path.split('/')[4] ?? '';

/** Every Game with a manifest and a built bundle; `wip` ones only outside production. */
export const GAMES: HubGame[] = Object.entries(manifests)
  .map(([path, manifest]) => ({
    manifest,
    version: Object.entries(versions).find(([v]) => folder(v) === folder(path))?.[1] ?? '',
  }))
  .filter(({ manifest, version }) => version && (__SHOW_WIP__ || manifest.status === 'ready'))
  .sort((a, b) => a.manifest.name.localeCompare(b.manifest.name, 'vi'));

export const gameById = (id: string) => GAMES.find((g) => g.manifest.id === id);
