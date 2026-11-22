import type { AnyManifest, GameManifest, SoonManifest } from '@xomdao/sdk';

/** The art `tools/hub-assets` wrote for a Game (`dist/hub/hub.json`); URLs under `/games/<id>/hub/`. */
export interface GameArt {
  lobby: string;
  card: string;
  thumb: string;
  /** A short muted loop for the lobby background, when the Game has one. */
  loop?: string;
}

export type RulesBlock =
  | { kind: 'text'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'table'; head: string[]; rows: string[][] };

/** One page of a Game's rules (a `##` of its `RULES.md`), as `tools/hub-assets` wrote it. */
export interface RulesPage {
  title: string;
  image?: { url: string; alt: string };
  blocks: RulesBlock[];
}

/** A Game the Hub ships: its manifest, its Emblem, its art, its rules and the version of its bundle (`dist/version.json`). */
export interface HubGame {
  manifest: GameManifest;
  /** `hub/emblem.svg`: one-colour SVG markup painted with `currentColor`. */
  emblem: string;
  art: GameArt;
  rules: RulesPage[];
  version: string;
}

/** A Game the Hub will have: its `soon` manifest and its Emblem. */
export interface SoonGame {
  manifest: SoonManifest;
  emblem: string;
}

const manifests = import.meta.glob<AnyManifest>('../../../games/*/manifest.ts', {
  eager: true,
  import: 'default',
});
const versions = import.meta.glob<string>('../../../games/*/dist/version.json', {
  eager: true,
  import: 'version',
});

const emblems = import.meta.glob<string>('../../../games/*/hub/emblem.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
});

const arts = import.meta.glob<{
  art: Pick<GameArt, 'lobby' | 'card' | 'thumb'>;
  loop?: string;
  rules?: RulesPage[];
}>('../../../games/*/dist/hub/hub.json', { eager: true, import: 'default' });

const folder = (path: string) => path.split('/')[4] ?? '';

const sibling = <T>(files: Record<string, T>, path: string) =>
  Object.entries(files).find(([file]) => folder(file) === folder(path))?.[1];

/** Every Game with a manifest, Emblem, art and a built bundle (never `soon`); `wip` ones only outside production. */
export const GAMES: HubGame[] = Object.entries(manifests)
  .map(([path, manifest]) => {
    const hubJson = sibling(arts, path);
    return {
      manifest,
      emblem: sibling(emblems, path) ?? '',
      art: hubJson && { ...hubJson.art, loop: hubJson.loop },
      rules: hubJson?.rules ?? [],
      version: sibling(versions, path) ?? '',
    };
  })
  .flatMap(({ manifest, emblem, art, rules, version }) =>
    manifest.status !== 'soon' && emblem && art && version
      ? [{ manifest, emblem, art, rules, version }]
      : [],
  )
  .filter(({ manifest }) => __SHOW_WIP__ || manifest.status === 'ready')
  .sort((a, b) => a.manifest.name.localeCompare(b.manifest.name, 'vi'));

export const gameById = (id: string) => GAMES.find((g) => g.manifest.id === id);

/** Every `soon` Game, shown locked on the Sea chart. */
export const SOON_GAMES: SoonGame[] = Object.entries(manifests).flatMap(([path, manifest]) =>
  manifest.status === 'soon' ? [{ manifest, emblem: sibling(emblems, path) ?? '' }] : [],
);
