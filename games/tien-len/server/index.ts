import type { GameServer } from '@xomdao/sdk';
import manifest from '../manifest.js';
import type { Options, State, View } from './game/model.js';
import { TienLenGame } from './game/TienLenGame.js';

export default { manifest, game: new TienLenGame() } satisfies GameServer<State, Options, View>;
