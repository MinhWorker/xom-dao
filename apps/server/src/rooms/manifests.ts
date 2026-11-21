import type { GameManifest } from '@xomdao/sdk';

/** The Game manifests of the Games this server runs: Rooms open only for these. */
export const GAME_MANIFESTS = Symbol('GAME_MANIFESTS');

/** Empty until GameHostModule loads the Game servers and their manifests. */
export const manifestsProvider = { provide: GAME_MANIFESTS, useValue: [] as GameManifest[] };
