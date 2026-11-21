import type { GameManifest } from '@xomdao/sdk';
import { serverGames } from '@xomdao/shared';

export const GAME_SERVERS = Symbol('GAME_SERVERS');
export const GAME_MANIFESTS = Symbol('GAME_MANIFESTS');

export const gameServersProvider = { provide: GAME_SERVERS, useValue: serverGames };
export const manifestsProvider = {
  provide: GAME_MANIFESTS,
  useValue: serverGames.map(({ manifest }) => manifest) as GameManifest[],
};
